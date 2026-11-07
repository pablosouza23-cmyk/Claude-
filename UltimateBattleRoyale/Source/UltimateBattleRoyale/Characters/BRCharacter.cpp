#include "Characters/BRCharacter.h"

#include "Building/BRBuildComponent.h"
#include "Camera/CameraComponent.h"
#include "Characters/BRCharacterMovementComponent.h"
#include "Characters/BRHealthComponent.h"
#include "Characters/BRInputConfig.h"
#include "Characters/BRProceduralBodyComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Core/BRSettings.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "Engine/OverlapResult.h"
#include "Engine/World.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameModes/BRGameMode.h"
#include "GameModes/BRGameState.h"
#include "GameModes/BRPlayerController.h"
#include "GameModes/BRPlayerState.h"
#include "Inventory/BRInventoryComponent.h"
#include "Net/UnrealNetwork.h"
#include "Progression/BRCosmetics.h"
#include "Settings/BRGameUserSettings.h"
#include "Vehicles/BRVehicle.h"
#include "Weapons/BRDamageTypes.h"
#include "Weapons/BRLagCompensationComponent.h"
#include "Weapons/BRWeapon.h"
#include "World/BRWorldSubsystem.h"
#include "Audio/BRProceduralAudio.h"
#include "Kismet/GameplayStatics.h"
#include "InputActionValue.h"

#define LOCTEXT_NAMESPACE "BRCharacter"

ABRCharacter::ABRCharacter(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer.SetDefaultSubobjectClass<UBRCharacterMovementComponent>(ACharacter::CharacterMovementComponentName))
{
	PrimaryActorTick.bCanEverTick = true;
	bReplicates = true;
	NetUpdateFrequency = 30.f;
	MinNetUpdateFrequency = 10.f;
	NetCullDistanceSquared = FMath::Square(25000.f);

	GetCapsuleComponent()->InitCapsuleSize(38.f, 92.f);
	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;

	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->TargetArmLength = DefaultArmLength;
	CameraBoom->SocketOffset = FVector(0.f, 65.f, 75.f);
	CameraBoom->bUsePawnControlRotation = true;
	CameraBoom->bEnableCameraLag = true;
	CameraBoom->CameraLagSpeed = 18.f;
	CameraBoom->ProbeSize = 14.f;

	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;
	FollowCamera->SetFieldOfView(DefaultFOV);

	Health = CreateDefaultSubobject<UBRHealthComponent>(TEXT("Health"));
	Inventory = CreateDefaultSubobject<UBRInventoryComponent>(TEXT("Inventory"));
	Build = CreateDefaultSubobject<UBRBuildComponent>(TEXT("Build"));
	LagCompensation = CreateDefaultSubobject<UBRLagCompensationComponent>(TEXT("LagCompensation"));
	Body = CreateDefaultSubobject<UBRProceduralBodyComponent>(TEXT("Body"));
	Body->SetupAttachment(GetCapsuleComponent());
	Body->SetRelativeLocation(FVector(0.f, 0.f, -92.f));

	GetMesh()->SetRelativeLocationAndRotation(FVector(0.f, 0.f, -92.f), FRotator(0.f, -90.f, 0.f));
	GetMesh()->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::OnlyTickPoseWhenRendered;
}

UBRCharacterMovementComponent* ABRCharacter::GetBRMovement() const
{
	return Cast<UBRCharacterMovementComponent>(GetCharacterMovement());
}

void ABRCharacter::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRCharacter, CurrentWeapon);
	DOREPLIFETIME(ABRCharacter, CurrentVehicle);
	DOREPLIFETIME(ABRCharacter, VehicleSeat);
	DOREPLIFETIME_CONDITION(ABRCharacter, bIsAiming, COND_SkipOwner);
	DOREPLIFETIME_CONDITION(ABRCharacter, InteractProgress, COND_OwnerOnly);
	DOREPLIFETIME(ABRCharacter, ActiveEmote);
	DOREPLIFETIME(ABRCharacter, EmoteStartTime);
	DOREPLIFETIME_CONDITION(ABRCharacter, HarvestSwingCounter, COND_SkipOwner);
}

void ABRCharacter::BeginPlay()
{
	Super::BeginPlay();

	// Authored skeletal mesh + Anim Blueprint (parent class UBRAnimInstance) replace the procedural body.
	const UBRSettings* Settings = UBRSettings::Get();
	USkeletalMesh* SkelMesh = Settings->CharacterMesh.IsNull() ? nullptr : Settings->CharacterMesh.LoadSynchronous();
	UClass* AnimClass = Settings->CharacterAnimClass.IsNull() ? nullptr : Settings->CharacterAnimClass.LoadSynchronous();
	if (SkelMesh && AnimClass)
	{
		GetMesh()->SetSkeletalMesh(SkelMesh);
		GetMesh()->SetAnimInstanceClass(AnimClass);
		Body->SetUseSkeletalMesh(true);
	}
	ApplyCosmetics();
}

void ABRCharacter::NotifyControllerChanged()
{
	Super::NotifyControllerChanged();
	if (APlayerController* PC = Cast<APlayerController>(Controller))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Sub = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			Sub->AddMappingContext(UBRInputConfig::Get()->DefaultContext, 0);
		}
	}
}

void ABRCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!EIC) { return; }
	const UBRInputConfig* In = UBRInputConfig::Get();

	EIC->BindAction(In->Move, ETriggerEvent::Triggered, this, &ABRCharacter::OnMove);
	EIC->BindAction(In->Move, ETriggerEvent::Completed, this, &ABRCharacter::OnMove);
	EIC->BindAction(In->LookMouse, ETriggerEvent::Triggered, this, &ABRCharacter::OnLookMouse);
	EIC->BindAction(In->LookStick, ETriggerEvent::Triggered, this, &ABRCharacter::OnLookStick);
	EIC->BindAction(In->LookGyro, ETriggerEvent::Triggered, this, &ABRCharacter::OnLookGyro);
	EIC->BindAction(In->Jump, ETriggerEvent::Started, this, &ABRCharacter::JumpPressed);
	EIC->BindAction(In->Jump, ETriggerEvent::Completed, this, &ABRCharacter::JumpReleased);
	EIC->BindAction(In->Crouch, ETriggerEvent::Started, this, &ABRCharacter::ToggleCrouch);
	EIC->BindAction(In->Sprint, ETriggerEvent::Started, this, &ABRCharacter::OnSprintPressed);
	EIC->BindAction(In->Sprint, ETriggerEvent::Completed, this, &ABRCharacter::OnSprintReleased);
	EIC->BindAction(In->Fire, ETriggerEvent::Started, this, &ABRCharacter::OnFirePressed);
	EIC->BindAction(In->Fire, ETriggerEvent::Completed, this, &ABRCharacter::OnFireReleased);
	EIC->BindAction(In->Aim, ETriggerEvent::Started, this, &ABRCharacter::OnAimPressed);
	EIC->BindAction(In->Aim, ETriggerEvent::Completed, this, &ABRCharacter::OnAimReleased);
	EIC->BindAction(In->Reload, ETriggerEvent::Started, this, &ABRCharacter::ReloadWeapon);
	EIC->BindAction(In->Interact, ETriggerEvent::Started, this, &ABRCharacter::InteractPressed);
	EIC->BindAction(In->Interact, ETriggerEvent::Completed, this, &ABRCharacter::InteractReleased);
	EIC->BindAction(In->Pickaxe, ETriggerEvent::Started, this, &ABRCharacter::OnSlot, -1);
	for (int32 I = 0; I < In->Slots.Num(); ++I)
	{
		EIC->BindAction(In->Slots[I], ETriggerEvent::Started, this, &ABRCharacter::OnSlot, I);
	}
	EIC->BindAction(In->NextSlot, ETriggerEvent::Started, this, &ABRCharacter::OnNextSlot);
	EIC->BindAction(In->PrevSlot, ETriggerEvent::Started, this, &ABRCharacter::OnPrevSlot);
	EIC->BindAction(In->BuildMode, ETriggerEvent::Started, this, &ABRCharacter::ToggleBuildMode);
	EIC->BindAction(In->EditMode, ETriggerEvent::Started, this, &ABRCharacter::ToggleEditMode);
	EIC->BindAction(In->CycleMaterial, ETriggerEvent::Started, this, &ABRCharacter::CycleBuildMaterial);
	EIC->BindAction(In->Emote, ETriggerEvent::Started, this, &ABRCharacter::OnEmoteKey);
	EIC->BindAction(In->Drop, ETriggerEvent::Started, this, &ABRCharacter::DropActiveItem);
}

void ABRCharacter::PossessedBy(AController* NewController)
{
	Super::PossessedBy(NewController);
	ApplyCosmetics();
}

void ABRCharacter::OnRep_PlayerState()
{
	Super::OnRep_PlayerState();
	ApplyCosmetics();
}

ABRPlayerState* ABRCharacter::GetBRPlayerState() const
{
	return GetPlayerState<ABRPlayerState>();
}

void ABRCharacter::ApplyCosmetics()
{
	if (const ABRPlayerState* PS = GetBRPlayerState())
	{
		Body->ApplyLoadout(PS->GetCosmetics());
	}
	else
	{
		Body->ApplyLoadout(FBRCosmeticLoadout());
	}
}

// ------------------------------------------------------------------------------------------ state
bool ABRCharacter::IsDowned() const { return Health && Health->IsDowned(); }
bool ABRCharacter::IsEliminated() const { return Health && Health->IsEliminated(); }
bool ABRCharacter::IsAliveAndWell() const { return Health && Health->IsAlive(); }

int32 ABRCharacter::GetTeamId() const
{
	const ABRPlayerState* PS = GetBRPlayerState();
	return PS ? PS->GetTeamId() : INDEX_NONE;
}

bool ABRCharacter::IsTeammate(const ABRCharacter* Other) const
{
	if (!Other || Other == this) { return Other == this; }
	const int32 A = GetTeamId(), B = Other->GetTeamId();
	return A != INDEX_NONE && A == B;
}

bool ABRCharacter::IsHarvesting() const
{
	return GetWorld() && GetWorld()->GetTimeSeconds() - LastHarvestSwingTime < 0.45f;
}

float ABRCharacter::GetMovementSpeedMultiplier() const
{
	float M = 1.f;
	if (Inventory && Inventory->IsUsingConsumable()) { M *= 0.5f; }
	if (!ActiveEmote.IsNone()) { M *= 0.f; }
	return M;
}

void ABRCharacter::GetAimViewPoint(FVector& OutLocation, FRotator& OutRotation) const
{
	if (const APlayerController* PC = Cast<APlayerController>(Controller))
	{
		if (PC->PlayerCameraManager)
		{
			PC->PlayerCameraManager->GetCameraViewPoint(OutLocation, OutRotation);
			return;
		}
	}
	// Bots / server-side: eyes + control rotation.
	OutLocation = GetPawnViewLocation();
	OutRotation = Controller ? Controller->GetControlRotation() : GetActorRotation();
}

FVector ABRCharacter::GetAimPoint(float MaxRange, FHitResult* OutHit) const
{
	FVector ViewLoc; FRotator ViewRot;
	GetAimViewPoint(ViewLoc, ViewRot);
	// Start the trace in front of the character so geometry behind the camera is ignored.
	const FVector Dir = ViewRot.Vector();
	const float Ahead = FVector::DotProduct(GetActorLocation() - ViewLoc, Dir);
	const FVector Start = ViewLoc + Dir * FMath::Max(0.f, Ahead);
	const FVector End = Start + Dir * MaxRange;
	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(BRAim), true, this);
	if (CurrentWeapon) { Params.AddIgnoredActor(CurrentWeapon); }
	if (CurrentVehicle) { Params.AddIgnoredActor(CurrentVehicle); }
	const bool bHit = GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params);
	if (OutHit) { *OutHit = Hit; }
	return bHit ? Hit.ImpactPoint : End;
}

// ------------------------------------------------------------------------------------------ input
void ABRCharacter::OnMove(const FInputActionValue& V) { MoveInput(V.Get<FVector2D>()); }

void ABRCharacter::OnLookMouse(const FInputActionValue& V)
{
	const UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	const float Sens = 0.07f * (S ? S->LookSensitivity : 1.f) * (bIsAiming && S ? S->AimSensitivityMultiplier : 1.f);
	const FVector2D Raw = V.Get<FVector2D>();
	LookInput(FVector2D(Raw.X, Raw.Y * ((S && S->bInvertY) ? -1.f : 1.f)) * Sens, false);
}

void ABRCharacter::OnLookStick(const FInputActionValue& V)
{
	const UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	const float Dt = GetWorld()->GetDeltaSeconds();
	const float DegPerSec = 200.f * (S ? S->StickSensitivity : 1.f) * (bIsAiming && S ? S->AimSensitivityMultiplier : 1.f);
	FVector2D Raw = V.Get<FVector2D>();
	Raw = FVector2D(FMath::Sign(Raw.X) * Raw.X * Raw.X, FMath::Sign(Raw.Y) * Raw.Y * Raw.Y); // response curve
	LookInput(FVector2D(Raw.X, Raw.Y * ((S && S->bInvertY) ? -1.f : 1.f)) * DegPerSec * Dt, true);
}

void ABRCharacter::OnLookGyro(const FInputActionValue& V)
{
	const UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	if (!S || !S->bGyroEnabled || (S->bGyroOnlyWhenAiming && !bIsAiming)) { return; }
	const FVector Rate = V.Get<FVector>(); // rad/s from the device
	const float Dt = GetWorld()->GetDeltaSeconds();
	const float Scale = FMath::RadiansToDegrees(1.f) * S->GyroSensitivity * Dt;
	LookInput(FVector2D(-Rate.Y, Rate.X) * Scale, false);
}

void ABRCharacter::MoveInput(const FVector2D& Axis)
{
	LastMoveInput = Axis;
	if (!Controller || IsEliminated()) { return; }
	if (CurrentVehicle)
	{
		return; // driving input is forwarded in UpdateDriving
	}
	if (!Axis.IsNearlyZero()) { CancelEmote(); }
	const FRotator Yaw(0.f, Controller->GetControlRotation().Yaw, 0.f);
	AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::X), Axis.Y);
	AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::Y), Axis.X);
}

void ABRCharacter::LookInput(const FVector2D& DeltaDegrees, bool bAssisted)
{
	if (!Controller) { return; }
	FVector2D Delta = DeltaDegrees;

	// Aim assist (touch/gamepad only): slow down near targets and gently pull while aiming.
	const UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	FRotator Rot = Controller->GetControlRotation();
	if (bAssisted && S && S->AimAssistStrength > 0.f && CurrentWeapon)
	{
		float Angle = 0.f, Distance = 0.f; FRotator LookAt;
		if (FindAimAssistTarget(Angle, Distance, LookAt))
		{
			BRRules::AimAssistParams P;
			P.Strength01 = S->AimAssistStrength;
			const double W = BRRules::AimAssistWeight(Angle, Distance, P);
			Delta *= float(BRRules::AimSlowdownMultiplier(W, P));
			if (bIsAiming && !DeltaDegrees.IsNearlyZero())
			{
				const float Step = float(BRRules::AimPullStep(W, Angle, GetWorld()->GetDeltaSeconds(), P));
				const FRotator Diff = (LookAt - Rot).GetNormalized();
				const float Len = FMath::Max(KINDA_SMALL_NUMBER, FMath::Sqrt(Diff.Yaw * Diff.Yaw + Diff.Pitch * Diff.Pitch));
				Rot.Yaw += Diff.Yaw / Len * Step;
				Rot.Pitch += Diff.Pitch / Len * Step;
			}
		}
	}

	Rot.Yaw += Delta.X;
	Rot.Pitch = FMath::ClampAngle(Rot.Pitch + Delta.Y, -85.f, 85.f);
	Controller->SetControlRotation(Rot);
	LastLookTime = GetWorld()->GetTimeSeconds();
}

ABRCharacter* ABRCharacter::FindAimAssistTarget(float& OutAngleDeg, float& OutDistance, FRotator& OutLookAt) const
{
	const AGameStateBase* GS = GetWorld()->GetGameState();
	if (!GS || !Controller) { return nullptr; }
	FVector ViewLoc; FRotator ViewRot;
	GetAimViewPoint(ViewLoc, ViewRot);
	const FVector Fwd = ViewRot.Vector();
	ABRCharacter* Best = nullptr;
	float BestAngle = 8.f;
	for (APlayerState* PS : GS->PlayerArray)
	{
		ABRCharacter* Other = PS ? Cast<ABRCharacter>(PS->GetPawn()) : nullptr;
		if (!Other || Other == this || IsTeammate(Other) || !Other->IsAliveAndWell()) { continue; }
		const FVector Target = Other->GetActorLocation() + FVector(0.f, 0.f, 40.f);
		const float Dist = FVector::Dist(ViewLoc, Target);
		if (Dist > 7000.f) { continue; }
		const float Angle = float(BRRules::AngleToPointDeg(BRTypes::ToVec3(ViewLoc), BRTypes::ToVec3(Fwd), BRTypes::ToVec3(Target)));
		if (Angle < BestAngle)
		{
			FHitResult Hit;
			FCollisionQueryParams Params(SCENE_QUERY_STAT(BRAimAssist), false, this);
			Params.AddIgnoredActor(Other);
			if (!GetWorld()->LineTraceSingleByChannel(Hit, ViewLoc, Target, ECC_Visibility, Params))
			{
				Best = Other; BestAngle = Angle; OutDistance = Dist;
				OutLookAt = (Target - ViewLoc).Rotation();
			}
		}
	}
	OutAngleDeg = BestAngle;
	return Best;
}

void ABRCharacter::StartFire()
{
	if (IsEliminated() || IsDowned()) { return; }
	bFireHeld = true;
	CancelEmote();
	if (Build->IsBuildMode() || Build->IsEditMode()) { Build->OnPrimaryPressed(); return; }
	if (CurrentVehicle && VehicleSeat == 0) { return; } // drivers cannot shoot
	const int32 Active = Inventory->GetActiveSlot();
	if (Active < 0)
	{
		LastHarvestSwingTime = -10.f; // swing immediately
		return;
	}
	if (CurrentWeapon) { CurrentWeapon->StartFire(); return; }
	Inventory->RequestUseActive();
}

void ABRCharacter::StopFire()
{
	bFireHeld = false;
	if (Build->IsBuildMode() || Build->IsEditMode()) { Build->OnPrimaryReleased(); }
	if (CurrentWeapon) { CurrentWeapon->StopFire(); }
}

void ABRCharacter::SetAiming(bool bAim)
{
	if (IsDowned() || IsEliminated()) { bAim = false; }
	if (Build->IsBuildMode() && bAim) { Build->CycleMaterial(); return; }
	if (bIsAiming == bAim) { return; }
	bIsAiming = bAim;
	if (!HasAuthority()) { ServerSetAiming(bAim); }
}

void ABRCharacter::ServerSetAiming_Implementation(bool bAim)
{
	bIsAiming = bAim && !IsDowned();
}

void ABRCharacter::ReloadWeapon()
{
	if (Build->IsBuildMode()) { Build->RotatePiece(); return; }
	if (Build->IsEditMode()) { Build->ResetEdit(); return; }
	if (CurrentWeapon) { CurrentWeapon->RequestReload(); }
}

void ABRCharacter::JumpPressed()
{
	if (IsEliminated()) { return; }
	CancelEmote();
	UBRCharacterMovementComponent* Move = GetBRMovement();
	if (Move->IsSkydiving()) { DeployParachute(); return; }
	if (CurrentVehicle) { return; }
	FVector Launch;
	if (Move->IsMovingOnGround() && ComputeMantle(Launch))
	{
		LaunchCharacter(Launch, true, true); // predicted locally, confirmed by the server
		if (!HasAuthority()) { ServerMantle(); }
		return;
	}
	Jump();
}

void ABRCharacter::JumpReleased()
{
	StopJumping();
}

bool ABRCharacter::ComputeMantle(FVector& OutLaunchVelocity) const
{
	// Climb ledges up to ~2.2 m: wall in front at chest height, free space above it.
	const FVector Fwd = GetActorForwardVector();
	const FVector Feet = GetActorLocation() - FVector(0.f, 0.f, GetCapsuleComponent()->GetScaledCapsuleHalfHeight());
	FCollisionQueryParams Params(SCENE_QUERY_STAT(BRMantle), false, this);
	FHitResult Wall;
	if (!GetWorld()->LineTraceSingleByChannel(Wall, Feet + FVector(0, 0, 90), Feet + FVector(0, 0, 90) + Fwd * 90.f, ECC_Visibility, Params))
	{
		return false;
	}
	const FVector TopStart = Wall.ImpactPoint + Fwd * 25.f + FVector(0, 0, 160.f);
	FHitResult Top;
	if (!GetWorld()->LineTraceSingleByChannel(Top, TopStart, TopStart - FVector(0, 0, 160.f), ECC_Visibility, Params))
	{
		return false;
	}
	const float LedgeHeight = Top.ImpactPoint.Z - Feet.Z;
	if (LedgeHeight < 70.f || LedgeHeight > 225.f || Top.ImpactNormal.Z < 0.7f) { return false; }
	const float Gravity = FMath::Abs(GetCharacterMovement()->GetGravityZ());
	const float Vz = FMath::Sqrt(2.f * Gravity * (LedgeHeight + 45.f));
	OutLaunchVelocity = Fwd * 280.f + FVector(0, 0, Vz);
	return true;
}

void ABRCharacter::ServerMantle_Implementation()
{
	FVector Launch;
	if (GetCharacterMovement()->IsMovingOnGround() && ComputeMantle(Launch))
	{
		LaunchCharacter(Launch, true, true);
	}
}

void ABRCharacter::ToggleCrouch()
{
	if (IsDowned() || CurrentVehicle) { return; }
	if (Build->IsBuildMode()) { Build->SelectPiece(EBRBuildPieceType::Floor); return; }
	if (bIsCrouched || GetCharacterMovement()->bWantsToCrouch) { UnCrouch(); } else { Crouch(); }
}

void ABRCharacter::SetSprinting(bool bSprint)
{
	GetBRMovement()->SetWantsToSprint(bSprint);
	if (bSprint && CurrentWeapon) { CurrentWeapon->StopFire(); }
}

void ABRCharacter::SelectSlot(int32 SlotIndex)
{
	if (IsEliminated() || IsDowned()) { return; }
	if (Build->IsBuildMode() && SlotIndex >= 0 && SlotIndex <= 3)
	{
		Build->SelectPiece(EBRBuildPieceType(SlotIndex));
		return;
	}
	Build->ExitModes();
	Inventory->RequestEquip(SlotIndex);
}

void ABRCharacter::CycleSlot(int32 Direction)
{
	if (Build->IsBuildMode())
	{
		Build->SelectPiece(EBRBuildPieceType((uint8(Build->GetSelectedPiece()) + 4 + Direction) % 4));
		return;
	}
	const int32 Current = Inventory->GetActiveSlot();
	int32 Next = Current;
	for (int32 I = 0; I < 6; ++I)
	{
		Next = ((Next + 1 + Direction + 6) % 6) - 1; // cycles -1..4
		if (Next < 0 || !Inventory->GetSlot(Next).IsEmpty()) { break; }
	}
	SelectSlot(Next);
}

void ABRCharacter::ToggleBuildMode()
{
	if (IsEliminated() || IsDowned() || CurrentVehicle) { return; }
	if (CurrentWeapon) { CurrentWeapon->StopFire(); }
	Build->ToggleBuildMode();
}

void ABRCharacter::ToggleEditMode()
{
	if (IsEliminated() || IsDowned() || CurrentVehicle) { return; }
	Build->ToggleEditMode();
}

void ABRCharacter::CycleBuildMaterial()
{
	Build->CycleMaterial();
}

void ABRCharacter::DropActiveItem()
{
	if (IsEliminated()) { return; }
	Inventory->RequestDropActive();
}

void ABRCharacter::DeployParachute()
{
	GetBRMovement()->RequestParachute(true);
}

// ------------------------------------------------------------------------------------------ emotes
void ABRCharacter::PlayEmote(int32 EmoteIndex)
{
	if (!IsAliveAndWell() || CurrentVehicle || !GetCharacterMovement()->IsMovingOnGround()) { return; }
	const ABRPlayerState* PS = GetBRPlayerState();
	const TArray<FName> Emotes = PS ? PS->GetCosmetics().Emotes : TArray<FName>();
	const FName Id = Emotes.IsValidIndex(EmoteIndex) ? Emotes[EmoteIndex] : FName(TEXT("Emote_Aceno"));
	ServerPlayEmote(Id);
}

void ABRCharacter::ServerPlayEmote_Implementation(FName EmoteId)
{
	const FBRCosmeticDef* Def = UBRCosmeticCatalog::Find(EmoteId);
	if (!Def || Def->Type != EBRCosmeticType::Emote || !IsAliveAndWell()) { return; }
	ActiveEmote = EmoteId;
	EmoteStartTime = GetWorld()->GetTimeSeconds();
	ServerEmoteStartLocation = GetActorLocation();
}

void ABRCharacter::CancelEmote()
{
	if (!ActiveEmote.IsNone() && HasAuthority()) { ActiveEmote = NAME_None; }
}

// ------------------------------------------------------------------------------------------ interaction
AActor* ABRCharacter::FindBestInteractable() const
{
	TArray<FOverlapResult> Overlaps;
	FCollisionObjectQueryParams Objects;
	Objects.AddObjectTypesToQuery(ECC_WorldDynamic);
	Objects.AddObjectTypesToQuery(ECC_WorldStatic);
	Objects.AddObjectTypesToQuery(ECC_Pawn);
	Objects.AddObjectTypesToQuery(ECC_PhysicsBody);
	Objects.AddObjectTypesToQuery(ECC_Vehicle);
	FCollisionQueryParams Params(SCENE_QUERY_STAT(BRInteract), false, this);
	GetWorld()->OverlapMultiByObjectType(Overlaps, GetActorLocation(), FQuat::Identity, Objects, FCollisionShape::MakeSphere(400.f), Params);

	FVector ViewLoc; FRotator ViewRot;
	GetAimViewPoint(ViewLoc, ViewRot);
	const FVector Fwd = ViewRot.Vector();

	AActor* Best = nullptr;
	float BestScore = TNumericLimits<float>::Max();
	TSet<AActor*> Seen;
	for (const FOverlapResult& O : Overlaps)
	{
		AActor* A = O.GetActor();
		if (!A || Seen.Contains(A)) { continue; }
		Seen.Add(A);
		const IBRInteractable* I = Cast<IBRInteractable>(A);
		if (!I || !I->CanInteract(this)) { continue; }
		const FVector Loc = I->GetInteractLocation();
		const float Dist = FVector::Dist(Loc, GetActorLocation());
		if (Dist > I->GetInteractRange()) { continue; }
		const float Facing = FVector::DotProduct((Loc - ViewLoc).GetSafeNormal(), Fwd);
		const float Score = Dist * (2.f - Facing);
		if (Score < BestScore) { BestScore = Score; Best = A; }
	}
	return Best;
}

void ABRCharacter::InteractPressed()
{
	if (IsEliminated()) { return; }
	if (CurrentVehicle) { ServerExitVehicle(); return; }
	if (IsDowned()) { return; }
	AActor* Target = FindBestInteractable();
	LocalInteractTarget = Target;
	if (Target) { ServerBeginInteract(Target); }
}

void ABRCharacter::InteractReleased()
{
	ServerEndInteract();
}

void ABRCharacter::ServerBeginInteract_Implementation(AActor* Target)
{
	IBRInteractable* I = Cast<IBRInteractable>(Target);
	ABRPlayerController* PC = Cast<ABRPlayerController>(Controller);
	if (!I || !IsAliveAndWell() || (PC && !PC->ConsumeRpcToken(EBRRpcBucket::Interact))) { return; }
	if (!BRRules::IsWithinInteractRange(BRTypes::ToVec3(GetActorLocation()), BRTypes::ToVec3(I->GetInteractLocation()), I->GetInteractRange() + 75.f))
	{
		return;
	}
	if (!I->CanInteract(this)) { return; }
	if (I->GetInteractDuration(this) <= 0.f)
	{
		I->ExecuteInteract(this);
		return;
	}
	ServerInteractTarget = Target;
	ServerInteractElapsed = 0.f;
	InteractProgress = 0.f;
}

void ABRCharacter::ServerEndInteract_Implementation()
{
	ServerInteractTarget.Reset();
	ServerInteractElapsed = 0.f;
	InteractProgress = 0.f;
}

void ABRCharacter::UpdateServerInteraction(float DeltaSeconds)
{
	AActor* Target = ServerInteractTarget.Get();
	if (!Target) { return; }
	IBRInteractable* I = Cast<IBRInteractable>(Target);
	const bool bInRange = I && FVector::Dist(GetActorLocation(), I->GetInteractLocation()) <= I->GetInteractRange() + 100.f;
	if (!I || !bInRange || !I->CanInteract(this) || !IsAliveAndWell())
	{
		ServerEndInteract_Implementation();
		return;
	}
	ServerInteractElapsed += DeltaSeconds;
	const float Duration = FMath::Max(0.01f, I->GetInteractDuration(this));
	InteractProgress = FMath::Clamp(ServerInteractElapsed / Duration, 0.f, 1.f);
	if (ServerInteractElapsed >= Duration)
	{
		ServerInteractTarget.Reset();
		InteractProgress = 0.f;
		I->ExecuteInteract(this);
	}
}

void ABRCharacter::UpdateInteraction(float DeltaSeconds)
{
	if (GetWorld()->GetTimeSeconds() < NextInteractScanTime) { return; }
	NextInteractScanTime = GetWorld()->GetTimeSeconds() + 0.12f;
	LocalInteractTarget = (IsAliveAndWell() && !CurrentVehicle) ? FindBestInteractable() : nullptr;
}

// Revive downed teammates.
bool ABRCharacter::CanInteract(const ABRCharacter* By) const
{
	return By && By != this && IsDowned() && By->IsAliveAndWell() && IsTeammate(By);
}

FText ABRCharacter::GetInteractPrompt(const ABRCharacter* By) const
{
	const APlayerState* PS = GetPlayerState();
	return FText::Format(LOCTEXT("Revive", "Reanimar {0}"), FText::FromString(PS ? PS->GetPlayerName() : TEXT("")));
}

void ABRCharacter::ExecuteInteract(ABRCharacter* By)
{
	if (!CanInteract(By)) { return; }
	Health->Revive(30.f);
	if (ABRPlayerState* PS = By->GetBRPlayerState()) { PS->AddRevive(); }
	if (ABRGameMode* GM = GetWorld()->GetAuthGameMode<ABRGameMode>()) { GM->OnCharacterRevived(this, By); }
}

// ------------------------------------------------------------------------------------------ harvesting
void ABRCharacter::UpdateHarvest(float DeltaSeconds)
{
	if (!bFireHeld || Inventory->GetActiveSlot() >= 0 || Build->IsBuildMode() || Build->IsEditMode() || CurrentVehicle || !IsAliveAndWell())
	{
		return;
	}
	const float Now = GetWorld()->GetTimeSeconds();
	if (Now - LastHarvestSwingTime < 0.55f) { return; }
	LastHarvestSwingTime = Now;
	FVector ViewLoc; FRotator ViewRot;
	GetAimViewPoint(ViewLoc, ViewRot);
	UBRProceduralAudio::PlaySfx(this, EBRSfx::PickaxeSwing, GetActorLocation());
	if (HasAuthority()) { ServerHarvest_Implementation(ViewRot.Vector()); }
	else { ServerHarvest(ViewRot.Vector()); }
}

void ABRCharacter::ServerHarvest_Implementation(FVector_NetQuantizeNormal AimDirection)
{
	const float Now = GetWorld()->GetTimeSeconds();
	if (Now - ServerLastHarvestTime < 0.45f || !IsAliveAndWell()) { return; }
	ServerLastHarvestTime = Now;
	++HarvestSwingCounter;
	LastHarvestSwingTime = Now;
	// Never trust the client direction beyond ~35 degrees from its replicated control rotation.
	FVector Dir = FVector(AimDirection).GetSafeNormal();
	const FVector ControlDir = GetControlRotation().Vector();
	if (FVector::DotProduct(Dir, ControlDir) < 0.8f) { Dir = ControlDir; }
	DoHarvestTrace(Dir);
}

void ABRCharacter::DoHarvestTrace(const FVector& Direction)
{
	const FVector Start = GetPawnViewLocation();
	const FVector End = Start + Direction * 260.f;
	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(BRHarvest), false, this);
	if (!GetWorld()->SweepSingleByChannel(Hit, Start, End, FQuat::Identity, ECC_Visibility, FCollisionShape::MakeSphere(20.f), Params))
	{
		return;
	}
	AActor* HitActor = Hit.GetActor();
	if (UBRWorldSubsystem* WS = GetWorld()->GetSubsystem<UBRWorldSubsystem>())
	{
		if (WS->TryHarvest(Hit, this)) { return; }
	}
	if (HitActor)
	{
		const bool bCharacter = HitActor->IsA<ABRCharacter>();
		UGameplayStatics::ApplyPointDamage(HitActor, bCharacter ? 20.f : 50.f, Direction, Hit, Controller, this, UBRDamageType_Pickaxe::StaticClass());
	}
}

void ABRCharacter::OnRep_HarvestSwing()
{
	LastHarvestSwingTime = GetWorld()->GetTimeSeconds();
	UBRProceduralAudio::PlaySfx(this, EBRSfx::PickaxeSwing, GetActorLocation());
}

// ------------------------------------------------------------------------------------------ damage
float ABRCharacter::TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	if (!HasAuthority() || Damage <= 0.f || IsEliminated()) { return 0.f; }

	const UBRDamageType* DT = DamageEvent.DamageTypeClass ? Cast<UBRDamageType>(DamageEvent.DamageTypeClass->GetDefaultObject()) : nullptr;
	const bool bFriendlyAlways = DT && DT->bFriendlyFireAlways;
	ABRCharacter* InstigatorChar = EventInstigator ? Cast<ABRCharacter>(EventInstigator->GetPawn()) : nullptr;

	if (!bFriendlyAlways)
	{
		if (InstigatorChar == this && DT && !DT->IsA<UBRDamageType_Fall>()) { return 0.f; } // no self damage from own weapons
		if (InstigatorChar && InstigatorChar != this && IsTeammate(InstigatorChar))
		{
			const ABRGameState* GS = GetWorld()->GetGameState<ABRGameState>();
			if (!GS || !GS->GetModeRules().bFriendlyFire) { return 0.f; }
		}
	}

	Damage = Super::TakeDamage(Damage, DamageEvent, EventInstigator, DamageCauser);
	const float ShieldBefore = Health->GetShield();
	const bool bHeadshot = DT && DT->bHeadshot;
	const float Applied = Health->ApplyDamage(Damage, EventInstigator, DamageCauser, DT && DT->bIgnoresShield, bHeadshot);
	if (Applied <= 0.f) { return 0.f; }

	CancelEmote();
	if (ABRPlayerController* InstPC = Cast<ABRPlayerController>(EventInstigator))
	{
		if (InstPC->GetPawn() != this)
		{
			InstPC->ClientConfirmHit(GetActorLocation() + FVector(0, 0, bHeadshot ? 80.f : 30.f), Applied, bHeadshot, ShieldBefore > 0.f, !IsAliveAndWell());
			if (ABRPlayerState* PS = InstPC->GetPlayerState<ABRPlayerState>()) { PS->AddDamageDealt(Applied); }
		}
	}
	const FVector From = DamageCauser ? DamageCauser->GetActorLocation() : GetActorLocation();
	ClientNotifyDamaged(From, Applied);
	return Applied;
}

void ABRCharacter::ClientNotifyDamaged_Implementation(FVector_NetQuantize FromLocation, float Damage)
{
	if (ABRPlayerController* PC = Cast<ABRPlayerController>(Controller))
	{
		PC->OnLocalPawnDamaged(FromLocation, Damage);
	}
}

void ABRCharacter::Landed(const FHitResult& Hit)
{
	Super::Landed(Hit);
	const float ImpactSpeed = -GetVelocity().Z;
	if (HasAuthority())
	{
		const float FallDamage = float(BRRules::FallDamage(ImpactSpeed));
		if (FallDamage > 0.f)
		{
			UGameplayStatics::ApplyDamage(this, FallDamage, Controller, this, UBRDamageType_Fall::StaticClass());
		}
	}
	UBRProceduralAudio::PlaySfx(this, EBRSfx::Land, GetActorLocation(), FMath::Clamp(ImpactSpeed / 1500.f, 0.3f, 1.f));
}

void ABRCharacter::OnLifeStateChanged(EBRLifeState NewState)
{
	if (NewState != EBRLifeState::Alive)
	{
		bIsAiming = false;
		if (CurrentWeapon) { CurrentWeapon->StopFire(); }
		Build->ExitModes();
	}
	if (NewState == EBRLifeState::Downed)
	{
		UnCrouch();
	}
	if (NewState == EBRLifeState::Eliminated)
	{
		GetCharacterMovement()->DisableMovement();
		GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		if (HasAuthority())
		{
			if (CurrentVehicle) { ExitVehicle(); }
			Inventory->DropEverything();
			SetLifeSpan(6.f);
		}
	}
	if (NewState == EBRLifeState::Alive && HasAuthority())
	{
		GetCharacterMovement()->SetMovementMode(MOVE_Walking);
	}
	if (ABRPlayerController* PC = Cast<ABRPlayerController>(Controller))
	{
		PC->OnPawnLifeStateChanged(this, NewState);
	}
}

// ------------------------------------------------------------------------------------------ skydive
void ABRCharacter::BeginSkydive()
{
	GetBRMovement()->StartSkydive();
	if (!IsLocallyControlled()) { ClientStartSkydive(); }
}

void ABRCharacter::ClientStartSkydive_Implementation()
{
	GetBRMovement()->StartSkydive();
}

void ABRCharacter::LaunchToSky(float UpSpeed)
{
	GetBRMovement()->LaunchIntoGlide(UpSpeed);
	if (HasAuthority())
	{
		if (ABRPlayerController* PC = Cast<ABRPlayerController>(Controller)) { PC->NotifyServerTeleport(); }
	}
}

// ------------------------------------------------------------------------------------------ weapons
void ABRCharacter::SetCurrentWeapon(ABRWeapon* Weapon)
{
	CurrentWeapon = Weapon;
	OnRep_CurrentWeapon();
}

void ABRCharacter::OnRep_CurrentWeapon()
{
	Body->SetHeldWeapon(CurrentWeapon);
	UpdateRotationMode();
}

void ABRCharacter::UpdateRotationMode()
{
	// Holding a weapon / building => strafe facing the camera. Otherwise face the movement direction.
	const bool bStrafe = (CurrentWeapon != nullptr || bIsAiming || Build->IsBuildMode() || Build->IsEditMode())
		&& !GetBRMovement()->IsInAirborneCustomMode() && !CurrentVehicle && !IsDowned();
	GetCharacterMovement()->bOrientRotationToMovement = !bStrafe;
	GetCharacterMovement()->bUseControllerDesiredRotation = bStrafe;
}

// ------------------------------------------------------------------------------------------ vehicles
void ABRCharacter::EnterVehicle(ABRVehicle* Vehicle, int32 Seat)
{
	if (!HasAuthority() || !Vehicle) { return; }
	Build->ExitModes();
	CurrentVehicle = Vehicle;
	VehicleSeat = Seat;
	OnRep_CurrentVehicle();
	if (ABRPlayerController* PC = Cast<ABRPlayerController>(Controller)) { PC->NotifyServerTeleport(); }
}

void ABRCharacter::ExitVehicle()
{
	if (!HasAuthority() || !CurrentVehicle) { return; }
	ABRVehicle* V = CurrentVehicle;
	const FVector ExitLoc = V->GetExitLocation(VehicleSeat);
	V->OnOccupantExited(this);
	CurrentVehicle = nullptr;
	VehicleSeat = -1;
	OnRep_CurrentVehicle();
	TeleportTo(ExitLoc, FRotator(0.f, GetActorRotation().Yaw, 0.f), false, true);
	if (ABRPlayerController* PC = Cast<ABRPlayerController>(Controller)) { PC->NotifyServerTeleport(); }
}

void ABRCharacter::ServerExitVehicle_Implementation()
{
	ExitVehicle();
}

void ABRCharacter::OnRep_CurrentVehicle()
{
	if (CurrentVehicle)
	{
		GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		GetCharacterMovement()->DisableMovement();
		if (USceneComponent* SeatComp = CurrentVehicle->GetSeatComponent(VehicleSeat))
		{
			AttachToComponent(SeatComp, FAttachmentTransformRules::SnapToTargetNotIncludingScale);
		}
	}
	else
	{
		DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);
		SetActorRotation(FRotator(0.f, GetActorRotation().Yaw, 0.f));
		if (!IsEliminated())
		{
			GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
			GetCharacterMovement()->SetMovementMode(MOVE_Falling);
		}
	}
	UpdateRotationMode();
}

void ABRCharacter::UpdateDriving()
{
	if (!CurrentVehicle || VehicleSeat != 0 || !IsLocallyControlled()) { return; }
	const float Now = GetWorld()->GetTimeSeconds();
	if (Now - LastDriveSendTime < 1.f / 30.f) { return; }
	LastDriveSendTime = Now;
	// Steering relative to the camera keeps controls intuitive on touch.
	const bool bHandbrake = bFireHeld; // drivers cannot shoot, so Fire doubles as handbrake
	if (HasAuthority()) { ServerDriveInput_Implementation(LastMoveInput.Y, LastMoveInput.X, bHandbrake); }
	else { ServerDriveInput(LastMoveInput.Y, LastMoveInput.X, bHandbrake); }
	CurrentVehicle->SetLocalDriveInput(LastMoveInput.Y, LastMoveInput.X);
}

void ABRCharacter::ServerDriveInput_Implementation(float Throttle, float Steer, bool bHandbrake)
{
	if (CurrentVehicle && VehicleSeat == 0)
	{
		CurrentVehicle->SetDriverInput(FMath::Clamp(Throttle, -1.f, 1.f), FMath::Clamp(Steer, -1.f, 1.f), bHandbrake);
	}
}

// ------------------------------------------------------------------------------------------ tick
void ABRCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (HasAuthority())
	{
		UpdateServerInteraction(DeltaSeconds);
		if (!ActiveEmote.IsNone())
		{
			const FBRCosmeticDef* Emote = UBRCosmeticCatalog::Find(ActiveEmote);
			const float Length = Emote ? Emote->EmoteSeconds : 4.f;
			if (GetWorld()->GetTimeSeconds() - EmoteStartTime > Length || FVector::DistSquared(ServerEmoteStartLocation, GetActorLocation()) > 400.f)
			{
				ActiveEmote = NAME_None;
			}
		}
	}

	if (IsLocallyControlled())
	{
		UpdateInteraction(DeltaSeconds);
		UpdateHarvest(DeltaSeconds);
		UpdateDriving();
		UpdateCamera(DeltaSeconds);
		if (GetBRMovement()->IsParachuting()) { GetBRMovement()->RequestParachute(false); }
	}
	UpdateRotationMode();
}

void ABRCharacter::UpdateCamera(float DeltaSeconds)
{
	float TargetArm = DefaultArmLength;
	float TargetFOV = DefaultFOV;
	FVector TargetOffset(0.f, 65.f, 75.f);
	if (CurrentVehicle) { TargetArm = VehicleArmLength; TargetOffset = FVector(0.f, 0.f, 220.f); }
	else if (GetBRMovement()->IsInAirborneCustomMode()) { TargetArm = SkydiveArmLength; TargetOffset = FVector(0.f, 0.f, 120.f); }
	else if (bIsAiming && CurrentWeapon)
	{
		TargetArm = AimArmLength;
		TargetFOV = CurrentWeapon->GetDefinition() ? CurrentWeapon->GetDefinition()->AimFOV : 65.f;
		TargetOffset = FVector(0.f, 55.f, 70.f);
	}
	else if (IsDowned()) { TargetArm = 380.f; TargetOffset = FVector(0.f, 0.f, 60.f); }

	CameraBoom->TargetArmLength = FMath::FInterpTo(CameraBoom->TargetArmLength, TargetArm, DeltaSeconds, 10.f);
	CameraBoom->SocketOffset = FMath::VInterpTo(CameraBoom->SocketOffset, TargetOffset, DeltaSeconds, 10.f);
	FollowCamera->SetFieldOfView(FMath::FInterpTo(FollowCamera->FieldOfView, TargetFOV, DeltaSeconds, 12.f));
}

void ABRCharacter::Destroyed()
{
	if (HasAuthority())
	{
		if (CurrentVehicle) { CurrentVehicle->OnOccupantExited(this); }
		if (CurrentWeapon) { CurrentWeapon->Destroy(); }
	}
	Super::Destroyed();
}

#undef LOCTEXT_NAMESPACE
