#include "Characters/BRCharacterMovementComponent.h"

#include "Characters/BRCharacter.h"
#include "Components/CapsuleComponent.h"
#include "World/BRWorldSubsystem.h"

UBRCharacterMovementComponent::UBRCharacterMovementComponent()
{
	MaxWalkSpeed = RunSpeed;
	MaxWalkSpeedCrouched = 260.f;
	MaxSwimSpeed = 420.f;
	JumpZVelocity = 620.f;
	AirControl = 0.35f;
	GravityScale = 1.6f;
	BrakingDecelerationWalking = 2048.f;
	GroundFriction = 8.f;
	Buoyancy = 1.12f;
	NavAgentProps.bCanCrouch = true;
	NavAgentProps.bCanSwim = true;
	bCanWalkOffLedgesWhenCrouching = true;
	SetCrouchedHalfHeight(60.f);
	bOrientRotationToMovement = true;
	RotationRate = FRotator(0.f, 720.f, 0.f);
	// Server-side movement checks complement the anti-cheat component.
	bIgnoreClientMovementErrorChecksAndCorrection = false;
	bServerAcceptClientAuthoritativePosition = false;
}

void UBRCharacterMovementComponent::InitializeComponent()
{
	Super::InitializeComponent();
	SavedGroundFriction = GroundFriction;
}

ABRCharacter* UBRCharacterMovementComponent::GetBROwner() const
{
	return Cast<ABRCharacter>(CharacterOwner);
}

bool UBRCharacterMovementComponent::IsSprinting() const
{
	return bWantsToSprint && MovementMode == MOVE_Walking && !IsCrouching() && Velocity.SizeSquared2D() > 100.f;
}

float UBRCharacterMovementComponent::GetMaxSpeed() const
{
	const ABRCharacter* C = GetBROwner();
	float Multiplier = 1.f;
	if (C)
	{
		if (C->IsDowned()) { return DownedSpeed; }
		Multiplier = C->GetMovementSpeedMultiplier();
	}

	if (MovementMode == MOVE_Walking || MovementMode == MOVE_NavWalking)
	{
		if (bIsSliding) { return 1200.f; }
		if (IsCrouching()) { return MaxWalkSpeedCrouched * Multiplier; }
		if (C && C->IsAiming()) { return AimSpeed * Multiplier; }
		if (bWantsToSprint) { return SprintSpeed * Multiplier; }
		return RunSpeed * Multiplier;
	}
	if (MovementMode == MOVE_Custom)
	{
		return IsParachuting() ? ParachuteHorizontalSpeed : SkydiveHorizontalSpeed;
	}
	return Super::GetMaxSpeed() * (MovementMode == MOVE_Swimming ? Multiplier : 1.f);
}

float UBRCharacterMovementComponent::GetMaxBrakingDeceleration() const
{
	if (bIsSliding) { return SlideBraking; }
	return Super::GetMaxBrakingDeceleration();
}

bool UBRCharacterMovementComponent::CanAttemptJump() const
{
	const ABRCharacter* C = GetBROwner();
	if (C && (C->IsDowned() || C->IsInVehicle())) { return false; }
	return Super::CanAttemptJump();
}

bool UBRCharacterMovementComponent::CanCrouchInCurrentState() const
{
	if (IsInAirborneCustomMode()) { return false; }
	return Super::CanCrouchInCurrentState();
}

void UBRCharacterMovementComponent::UpdateFromCompressedFlags(uint8 Flags)
{
	Super::UpdateFromCompressedFlags(Flags);
	bWantsToSprint = (Flags & FSavedMove_Character::FLAG_Custom_0) != 0;
	bWantsParachute = (Flags & FSavedMove_Character::FLAG_Custom_1) != 0;
}

FNetworkPredictionData_Client* UBRCharacterMovementComponent::GetPredictionData_Client() const
{
	if (!ClientPredictionData)
	{
		UBRCharacterMovementComponent* Mutable = const_cast<UBRCharacterMovementComponent*>(this);
		Mutable->ClientPredictionData = new FNetworkPredictionData_Client_BR(*this);
	}
	return ClientPredictionData;
}

void UBRCharacterMovementComponent::StartSkydive()
{
	bPendingGlide = false;
	bWantsParachute = false;
	SetMovementMode(MOVE_Custom, uint8(EBRCustomMovement::Skydive));
}

void UBRCharacterMovementComponent::LaunchIntoGlide(float UpSpeed)
{
	bPendingGlide = true;
	Velocity.Z = UpSpeed;
	SetMovementMode(MOVE_Falling);
}

float UBRCharacterMovementComponent::HeightAboveGround(float MaxTrace) const
{
	if (!UpdatedComponent || !GetWorld()) { return MaxTrace; }
	const FVector Start = UpdatedComponent->GetComponentLocation();
	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(BRGroundTrace), false, CharacterOwner);
	if (GetWorld()->LineTraceSingleByChannel(Hit, Start, Start - FVector(0, 0, MaxTrace), ECC_Visibility, Params))
	{
		return Hit.Distance;
	}
	if (const UBRWorldSubsystem* WS = GetWorld()->GetSubsystem<UBRWorldSubsystem>())
	{
		float WaterZ = 0.f;
		if (WS->GetWaterSurfaceZ(Start, WaterZ)) { return FMath::Max(0.f, Start.Z - WaterZ); }
	}
	return MaxTrace;
}

void UBRCharacterMovementComponent::UpdateCharacterStateBeforeMovement(float DeltaSeconds)
{
	Super::UpdateCharacterStateBeforeMovement(DeltaSeconds);

	// Skydive -> glider: manual request (above minimum height) or automatic near the ground.
	if (IsSkydiving())
	{
		const float Height = HeightAboveGround(AutoDeployHeight + 10.f);
		if (Height <= AutoDeployHeight || (bWantsParachute && Height >= MinManualDeployHeight))
		{
			SetMovementMode(MOVE_Custom, uint8(EBRCustomMovement::Parachute));
		}
	}
	else if (bPendingGlide && MovementMode == MOVE_Falling && Velocity.Z <= 0.f)
	{
		bPendingGlide = false;
		SetMovementMode(MOVE_Custom, uint8(EBRCustomMovement::Parachute));
	}

	// Custom water handling (procedural lakes/rivers have no physics volume).
	const float Depth = ImmersionDepth();
	if (MovementMode == MOVE_Swimming && Depth <= 0.05f)
	{
		SetMovementMode(MOVE_Falling);
	}
	else if (MovementMode != MOVE_Swimming && Depth > 0.55f && !IsInAirborneCustomMode())
	{
		bIsSliding = false;
		SetMovementMode(MOVE_Swimming);
	}
	else if (IsInAirborneCustomMode() && Depth > 0.3f)
	{
		SetMovementMode(MOVE_Swimming);
	}

	// Slide: sprint + crouch at speed.
	if (MovementMode == MOVE_Walking)
	{
		const float Speed2D = Velocity.Size2D();
		if (!bIsSliding && bWantsToCrouch && bWantsToSprint && Speed2D >= SlideEnterSpeed)
		{
			bIsSliding = true;
			SavedGroundFriction = GroundFriction;
			GroundFriction = SlideFriction;
			Velocity += Velocity.GetSafeNormal2D() * SlideImpulse;
		}
		else if (bIsSliding && (!bWantsToCrouch || Speed2D < SlideExitSpeed))
		{
			bIsSliding = false;
			GroundFriction = SavedGroundFriction;
		}
	}
	else if (bIsSliding)
	{
		bIsSliding = false;
		GroundFriction = SavedGroundFriction;
	}

	if (bIsSliding)
	{
		Acceleration *= 0.15f; // limited steering while sliding
	}
}

void UBRCharacterMovementComponent::PhysCustom(float DeltaTime, int32 Iterations)
{
	Super::PhysCustom(DeltaTime, Iterations);
	switch (EBRCustomMovement(CustomMovementMode))
	{
	case EBRCustomMovement::Skydive: PhysAirborne(DeltaTime, Iterations, false); break;
	case EBRCustomMovement::Parachute: PhysAirborne(DeltaTime, Iterations, true); break;
	default: SetMovementMode(MOVE_Falling); break;
	}
}

void UBRCharacterMovementComponent::PhysAirborne(float DeltaTime, int32 Iterations, bool bParachute)
{
	if (DeltaTime < MIN_TICK_TIME) { return; }

	const FVector InputDir = Acceleration.GetSafeNormal2D();
	const float InputAmount = FMath::Clamp(Acceleration.Size2D() / FMath::Max(1.f, GetMaxAcceleration()), 0.f, 1.f);
	const float MaxH = bParachute ? ParachuteHorizontalSpeed : SkydiveHorizontalSpeed;

	// Diving (pushing forward relative to the camera) speeds up the descent in skydive.
	float TargetFall = bParachute ? ParachuteFallSpeed : SkydiveFallSpeed;
	if (!bParachute && CharacterOwner && CharacterOwner->Controller)
	{
		const FVector CamFwd = CharacterOwner->Controller->GetControlRotation().Vector().GetSafeNormal2D();
		const float Dive = FMath::Max(0.f, FVector::DotProduct(CamFwd, InputDir)) * InputAmount;
		const float Pitch = FMath::Clamp(-CharacterOwner->Controller->GetControlRotation().GetNormalized().Pitch / 60.f, 0.f, 1.f);
		TargetFall = FMath::Lerp(SkydiveFallSpeed, SkydiveDiveFallSpeed, Dive * Pitch);
	}

	const FVector DesiredH = InputDir * MaxH * InputAmount;
	const FVector CurrentH(Velocity.X, Velocity.Y, 0.f);
	const FVector NewH = FMath::VInterpTo(CurrentH, DesiredH, DeltaTime, bParachute ? 1.6f : 1.2f);
	const float NewZ = FMath::FInterpTo(Velocity.Z, -TargetFall, DeltaTime, bParachute ? 3.f : 1.5f);
	Velocity = FVector(NewH.X, NewH.Y, NewZ);

	Iterations++;
	const FVector Delta = Velocity * DeltaTime;
	FHitResult Hit(1.f);
	SafeMoveUpdatedComponent(Delta, UpdatedComponent->GetComponentQuat(), true, Hit);

	if (Hit.IsValidBlockingHit())
	{
		if (Hit.ImpactNormal.Z >= GetWalkableFloorZ())
		{
			// Touch down: hand over to falling so landing is processed normally.
			Velocity.Z = FMath::Max(Velocity.Z, -ParachuteFallSpeed);
			SetMovementMode(MOVE_Falling);
			StartNewPhysics(DeltaTime * (1.f - Hit.Time), Iterations);
			return;
		}
		HandleImpact(Hit, DeltaTime, Delta);
		SlideAlongSurface(Delta, 1.f - Hit.Time, Hit.Normal, Hit, true);
	}
}

bool UBRCharacterMovementComponent::IsInWater() const
{
	// Matches the swim-entry threshold so landing in ankle-deep water keeps walking.
	return ImmersionDepth() > 0.5f;
}

float UBRCharacterMovementComponent::ImmersionDepth() const
{
	if (!UpdatedComponent || !CharacterOwner || !GetWorld()) { return 0.f; }
	const UBRWorldSubsystem* WS = GetWorld()->GetSubsystem<UBRWorldSubsystem>();
	float WaterZ = 0.f;
	const FVector Loc = UpdatedComponent->GetComponentLocation();
	if (!WS || !WS->GetWaterSurfaceZ(Loc, WaterZ))
	{
		return 0.f; // engine water volumes still work through the default implementation
	}
	const float HalfHeight = CharacterOwner->GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
	const float Bottom = Loc.Z - HalfHeight;
	return FMath::Clamp((WaterZ - Bottom) / (2.f * HalfHeight), 0.f, 1.f);
}

// ---------------------------------------------------------------------------------------------
void FSavedMove_BR::Clear()
{
	Super::Clear();
	bSavedWantsToSprint = false;
	bSavedWantsParachute = false;
}

uint8 FSavedMove_BR::GetCompressedFlags() const
{
	uint8 Result = Super::GetCompressedFlags();
	if (bSavedWantsToSprint) { Result |= FLAG_Custom_0; }
	if (bSavedWantsParachute) { Result |= FLAG_Custom_1; }
	return Result;
}

bool FSavedMove_BR::CanCombineWith(const FSavedMovePtr& NewMove, ACharacter* InCharacter, float MaxDelta) const
{
	const FSavedMove_BR* Other = static_cast<const FSavedMove_BR*>(NewMove.Get());
	if (bSavedWantsToSprint != Other->bSavedWantsToSprint || bSavedWantsParachute != Other->bSavedWantsParachute)
	{
		return false;
	}
	return Super::CanCombineWith(NewMove, InCharacter, MaxDelta);
}

void FSavedMove_BR::SetMoveFor(ACharacter* C, float InDeltaTime, FVector const& NewAccel, FNetworkPredictionData_Client_Character& ClientData)
{
	Super::SetMoveFor(C, InDeltaTime, NewAccel, ClientData);
	if (const UBRCharacterMovementComponent* M = Cast<UBRCharacterMovementComponent>(C->GetCharacterMovement()))
	{
		bSavedWantsToSprint = M->bWantsToSprint;
		bSavedWantsParachute = M->bWantsParachute;
	}
}

void FSavedMove_BR::PrepMoveFor(ACharacter* C)
{
	Super::PrepMoveFor(C);
	if (UBRCharacterMovementComponent* M = Cast<UBRCharacterMovementComponent>(C->GetCharacterMovement()))
	{
		M->bWantsToSprint = bSavedWantsToSprint;
		M->bWantsParachute = bSavedWantsParachute;
	}
}
