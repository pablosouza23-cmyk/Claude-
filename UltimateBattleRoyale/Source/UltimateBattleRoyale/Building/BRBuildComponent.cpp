#include "Building/BRBuildComponent.h"

#include "Audio/BRProceduralAudio.h"
#include "Building/BRBuildGridSubsystem.h"
#include "Building/BRBuildingPiece.h"
#include "Characters/BRCharacter.h"
#include "Components/StaticMeshComponent.h"
#include "Core/BRVisuals.h"
#include "GameModes/BRGameState.h"
#include "GameModes/BRPlayerController.h"
#include "Inventory/BRInventoryComponent.h"
#include "Net/UnrealNetwork.h"

UBRBuildComponent::UBRBuildComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	SetIsReplicatedByDefault(true);
}

void UBRBuildComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME_CONDITION(UBRBuildComponent, bBuildMode, COND_SkipOwner);
	DOREPLIFETIME_CONDITION(UBRBuildComponent, bEditMode, COND_SkipOwner);
}

ABRCharacter* UBRBuildComponent::GetCharacter() const { return Cast<ABRCharacter>(GetOwner()); }

bool UBRBuildComponent::IsBuildingAllowed() const
{
	const ABRGameState* GS = GetWorld() ? GetWorld()->GetGameState<ABRGameState>() : nullptr;
	return !GS || GS->GetModeRules().bBuildingEnabled;
}

void UBRBuildComponent::ToggleBuildMode()
{
	if (!IsBuildingAllowed()) { return; }
	if (bEditMode) { CommitEdit(); }
	bBuildMode = !bBuildMode;
	bEditMode = false;
	ShowPreview(bBuildMode);
	ServerSetModes(bBuildMode, bEditMode);
	UBRProceduralAudio::PlaySfx(GetOwner(), EBRSfx::UIClick, GetOwner()->GetActorLocation(), 0.4f);
}

void UBRBuildComponent::ExitModes()
{
	if (bEditMode) { CommitEdit(); }
	if (!bBuildMode && !bEditMode) { return; }
	bBuildMode = bEditMode = false;
	bPrimaryHeld = false;
	ShowPreview(false);
	if (GetOwner() && GetOwner()->HasActorBegunPlay()) { ServerSetModes(false, false); }
}

void UBRBuildComponent::ServerSetModes_Implementation(bool bBuild, bool bEdit)
{
	bBuildMode = bBuild && IsBuildingAllowed();
	bEditMode = bEdit && IsBuildingAllowed();
}

void UBRBuildComponent::SelectPiece(EBRBuildPieceType Type)
{
	if (!bBuildMode) { ToggleBuildMode(); }
	SelectedPiece = Type;
}

void UBRBuildComponent::RotatePiece() { RotationSteps = (RotationSteps + 1) % 4; }

void UBRBuildComponent::CycleMaterial()
{
	SelectedMaterial = EBRBuildMaterial((uint8(SelectedMaterial) + 1) % uint8(EBRBuildMaterial::MAX));
	UBRProceduralAudio::PlaySfx(GetOwner(), EBRSfx::UIClick, GetOwner()->GetActorLocation(), 0.4f);
}

bool UBRBuildComponent::ComputeTargetKey(FBRGridKey& OutKey) const
{
	const ABRCharacter* C = GetCharacter();
	if (!C) { return false; }
	FVector ViewLoc; FRotator ViewRot;
	C->GetAimViewPoint(ViewLoc, ViewRot);
	const FVector Aim = C->GetAimPoint(float(BRRules::BuildCellSize) * 1.6f);
	const FVector Feet = C->GetActorLocation() - FVector(0, 0, C->GetSimpleCollisionHalfHeight());
	const BRRules::PieceKey K = BRRules::ChoosePieceFromAim(BRTypes::ToRules(SelectedPiece), BRTypes::ToVec3(Feet), ViewRot.Yaw, BRTypes::ToVec3(Aim), RotationSteps);
	OutKey = FBRGridKey::FromRules(K);
	return true;
}

void UBRBuildComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	const ABRCharacter* C = GetCharacter();
	if (!C || !C->IsLocallyControlled()) { return; }
	if (bBuildMode)
	{
		UpdatePreview();
		// Hold to build continuously ("turbo build").
		if (bPrimaryHeld && GetWorld()->GetTimeSeconds() - LastPlaceTime > 0.12f) { TryPlace(); }
	}
}

void UBRBuildComponent::EnsurePreview()
{
	if (PreviewActor && PreviewShape == SelectedPiece) { return; }
	if (!PreviewActor)
	{
		FActorSpawnParameters SP;
		SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		SP.ObjectFlags |= RF_Transient;
		PreviewActor = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FTransform::Identity, SP);
		USceneComponent* Root = NewObject<USceneComponent>(PreviewActor);
		PreviewActor->SetRootComponent(Root);
		Root->RegisterComponent();
	}
	for (UStaticMeshComponent* B : PreviewBars) { if (B) { B->DestroyComponent(); } }
	PreviewBars.Reset();
	PreviewShape = SelectedPiece;

	// Wireframe of the piece box: 12 thin bars (+ diagonal on ramps).
	const FVector E = ABRBuildingPiece::GetPieceExtent(SelectedPiece);
	const float T = 4.f;
	USceneComponent* Root = PreviewActor->GetRootComponent();
	auto Bar = [&](const FVector& A, const FVector& B)
	{
		const FVector Mid = (A + B) * 0.5f;
		const FVector D = B - A;
		const FVector Size(FMath::Max(T, FMath::Abs(D.X)), FMath::Max(T, FMath::Abs(D.Y)), FMath::Max(T, FMath::Abs(D.Z)));
		if (UStaticMeshComponent* M = BRVisuals::AddPart(PreviewActor, Root, BRVisuals::Cube(), Mid, Size, FRotator::ZeroRotator, FLinearColor(0.2f, 0.6f, 1.f), false))
		{
			M->bCastDynamicShadow = false;
			PreviewBars.Add(M);
		}
	};
	for (int32 SX : { -1, 1 }) { for (int32 SY : { -1, 1 }) { Bar(FVector(SX * E.X, SY * E.Y, -E.Z), FVector(SX * E.X, SY * E.Y, E.Z)); } }
	for (int32 SX : { -1, 1 }) { for (int32 SZ : { -1, 1 }) { Bar(FVector(SX * E.X, -E.Y, SZ * E.Z), FVector(SX * E.X, E.Y, SZ * E.Z)); } }
	for (int32 SY : { -1, 1 }) { for (int32 SZ : { -1, 1 }) { Bar(FVector(-E.X, SY * E.Y, SZ * E.Z), FVector(E.X, SY * E.Y, SZ * E.Z)); } }
	bPreviewColorValid = true;
}

void UBRBuildComponent::ShowPreview(bool bShow)
{
	if (bShow) { EnsurePreview(); }
	if (PreviewActor) { PreviewActor->SetActorHiddenInGame(!bShow); }
}

void UBRBuildComponent::UpdatePreview()
{
	EnsurePreview();
	FBRGridKey Key;
	if (!ComputeTargetKey(Key)) { ShowPreview(false); return; }
	PreviewKey = Key;
	const UBRBuildGridSubsystem* Grid = GetWorld()->GetSubsystem<UBRBuildGridSubsystem>();
	const ABRCharacter* C = GetCharacter();
	const int32 Owned = C->GetInventory()->GetMaterial(SelectedMaterial);
	bPreviewValid = Grid && !Grid->IsOccupied(Key) && BRRules::CanAffordPiece(Owned, BRTypes::ToRules(SelectedMaterial))
		&& (Grid->HasAdjacentPiece(Key) || Grid->IsGroundedAt(Key));
	PreviewActor->SetActorTransform(ABRBuildingPiece::ComputeTransform(Key));
	if (bPreviewColorValid != bPreviewValid)
	{
		bPreviewColorValid = bPreviewValid;
		UMaterialInterface* Mat = BRVisuals::ColorMaterial(bPreviewValid ? FLinearColor(0.2f, 0.6f, 1.f) : FLinearColor(1.f, 0.2f, 0.15f));
		for (UStaticMeshComponent* B : PreviewBars) { if (B) { B->SetMaterial(0, Mat); } }
	}
}

void UBRBuildComponent::OnPrimaryPressed()
{
	bPrimaryHeld = true;
	if (bEditMode)
	{
		ABRBuildingPiece* Target = EditTarget.Get();
		const ABRCharacter* C = GetCharacter();
		FHitResult Hit;
		C->GetAimPoint(800.f, &Hit);
		if (Target && Hit.GetActor() == Target)
		{
			const int32 Tile = Target->TileIndexAt(Hit.ImpactPoint);
			if (Tile != INDEX_NONE)
			{
				PendingMask ^= uint16(1u << Tile);
				Target->SetLocalPreviewMask(PendingMask);
				UBRProceduralAudio::PlaySfx(GetOwner(), EBRSfx::UIClick, Hit.ImpactPoint, 0.3f);
			}
		}
		return;
	}
	if (bBuildMode) { TryPlace(); }
}

void UBRBuildComponent::OnPrimaryReleased()
{
	bPrimaryHeld = false;
}

void UBRBuildComponent::TryPlace()
{
	FBRGridKey Key;
	if (!ComputeTargetKey(Key)) { return; }
	const uint64 Packed = Key.Pack();
	if (Packed == LastPlacedKey && GetWorld()->GetTimeSeconds() - LastPlaceTime < 0.5f) { return; }
	if (!bPreviewValid) { return; }
	LastPlacedKey = Packed;
	LastPlaceTime = GetWorld()->GetTimeSeconds();
	if (GetOwnerRole() == ROLE_Authority) { PlaceServer(Key, SelectedMaterial); }
	else { ServerPlacePiece(Key, SelectedMaterial); }
}

void UBRBuildComponent::ServerPlacePiece_Implementation(FBRGridKey Key, EBRBuildMaterial Mat)
{
	PlaceServer(Key, Mat);
}

ABRBuildingPiece* UBRBuildComponent::SpawnPieceServer(UWorld* World, const FBRGridKey& Key, EBRBuildMaterial Mat, int32 Team, bool bInstant, uint16 EditMask)
{
	if (!World) { return nullptr; }
	UBRBuildGridSubsystem* Grid = World->GetSubsystem<UBRBuildGridSubsystem>();
	if (!Grid || Grid->IsOccupied(Key)) { return nullptr; }
	const FTransform T = ABRBuildingPiece::ComputeTransform(Key);
	ABRBuildingPiece* Piece = World->SpawnActorDeferred<ABRBuildingPiece>(ABRBuildingPiece::StaticClass(), T, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
	if (!Piece) { return nullptr; }
	Piece->InitPiece(Key, Mat, Team, Grid->IsGroundedAt(Key), bInstant);
	Piece->FinishSpawning(T);
	if (EditMask != 0 && BRRules::IsValidEditMask(BRTypes::ToRules(Key.Type), EditMask)) { Piece->SetEditMask(EditMask); }
	return Piece;
}

void UBRBuildComponent::PlaceServer(const FBRGridKey& InKey, EBRBuildMaterial Mat)
{
	ABRCharacter* C = GetCharacter();
	if (!C || !C->IsAliveAndWell() || C->IsInVehicle() || !IsBuildingAllowed()) { return; }
	if (uint8(Mat) >= uint8(EBRBuildMaterial::MAX) || uint8(InKey.Type) > uint8(EBRBuildPieceType::Roof)) { return; }
	ABRPlayerController* PC = Cast<ABRPlayerController>(C->GetController());
	if (PC && !PC->ConsumeRpcToken(EBRRpcBucket::Build)) { return; }

	const FBRGridKey Key = FBRGridKey::FromRules(BRRules::NormalizeKey(InKey.ToRules()));
	if (!BRRules::IsWithinBuildDistance(BRTypes::ToVec3(C->GetPawnViewLocation()), Key.ToRules()))
	{
		if (PC) { PC->ReportSuspicious(TEXT("build_distance"), 3.f); }
		return;
	}
	UBRBuildGridSubsystem* Grid = GetWorld()->GetSubsystem<UBRBuildGridSubsystem>();
	if (!Grid || Grid->IsOccupied(Key)) { return; }
	if (!Grid->HasAdjacentPiece(Key) && !Grid->IsGroundedAt(Key)) { return; }

	UBRInventoryComponent* Inv = C->GetInventory();
	const int32 Cost = BRRules::GetMatStats(BRTypes::ToRules(Mat)).Cost;
	if (!Inv->ConsumeMaterial(Mat, Cost)) { return; }

	if (!SpawnPieceServer(GetWorld(), Key, Mat, C->GetTeamId(), false))
	{
		Inv->AddMaterial(Mat, Cost); // refund on failure
	}
}

ABRBuildingPiece* UBRBuildComponent::FindEditTarget() const
{
	const ABRCharacter* C = GetCharacter();
	FHitResult Hit;
	C->GetAimPoint(700.f, &Hit);
	ABRBuildingPiece* Piece = Cast<ABRBuildingPiece>(Hit.GetActor());
	if (Piece && (Piece->GetTeam() == INDEX_NONE || Piece->GetTeam() == C->GetTeamId())) { return Piece; }
	return nullptr;
}

void UBRBuildComponent::ToggleEditMode()
{
	if (!IsBuildingAllowed()) { return; }
	if (bEditMode) { CommitEdit(); return; }
	ABRBuildingPiece* Target = FindEditTarget();
	if (!Target) { return; }
	bBuildMode = false;
	ShowPreview(false);
	bEditMode = true;
	EditTarget = Target;
	PendingMask = Target->GetEditMask();
	Target->SetLocalPreviewMask(PendingMask);
	ServerSetModes(false, true);
}

void UBRBuildComponent::ResetEdit()
{
	if (ABRBuildingPiece* Target = EditTarget.Get())
	{
		PendingMask = BRRules::FullMask(BRTypes::ToRules(Target->GetKey().Type));
		Target->SetLocalPreviewMask(PendingMask);
	}
}

void UBRBuildComponent::ApplyEditPreset(uint8 Preset)
{
	if (ABRBuildingPiece* Target = EditTarget.Get())
	{
		PendingMask = BRRules::PresetMask(BRTypes::ToRules(Target->GetKey().Type), BRRules::EditPreset(Preset));
		Target->SetLocalPreviewMask(PendingMask);
	}
}

void UBRBuildComponent::CommitEdit()
{
	ABRBuildingPiece* Target = EditTarget.Get();
	bEditMode = false;
	EditTarget.Reset();
	ServerSetModes(bBuildMode, false);
	if (!Target) { return; }
	Target->SetLocalPreviewMask(-1);
	if (PendingMask != Target->GetEditMask() && BRRules::IsValidEditMask(BRTypes::ToRules(Target->GetKey().Type), PendingMask))
	{
		if (GetOwnerRole() == ROLE_Authority) { ServerEditPiece_Implementation(Target, PendingMask); }
		else { ServerEditPiece(Target, PendingMask); }
	}
}

void UBRBuildComponent::ServerEditPiece_Implementation(ABRBuildingPiece* Piece, uint16 Mask)
{
	ABRCharacter* C = GetCharacter();
	if (!C || !Piece || !C->IsAliveAndWell() || !IsBuildingAllowed()) { return; }
	ABRPlayerController* PC = Cast<ABRPlayerController>(C->GetController());
	if (PC && !PC->ConsumeRpcToken(EBRRpcBucket::Build)) { return; }
	if (Piece->GetTeam() != INDEX_NONE && Piece->GetTeam() != C->GetTeamId()) { return; }
	if (FVector::Dist(C->GetActorLocation(), Piece->GetActorLocation()) > 900.f) { return; }
	if (!BRRules::IsValidEditMask(BRTypes::ToRules(Piece->GetKey().Type), Mask)) { return; }
	Piece->SetEditMask(Mask);
}

void UBRBuildComponent::EndPlay(const EEndPlayReason::Type Reason)
{
	if (PreviewActor) { PreviewActor->Destroy(); PreviewActor = nullptr; }
	Super::EndPlay(Reason);
}
