#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Core/BRTypes.h"
#include "BRBuildComponent.generated.h"

class ABRCharacter;
class ABRBuildingPiece;
class UStaticMeshComponent;

// Build & edit modes for a character. The client previews and requests; the server validates
// (mode rules, distance, grid occupancy, structural support, materials, rate) and spawns.
UCLASS(ClassGroup = (BR))
class ULTIMATEBATTLEROYALE_API UBRBuildComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UBRBuildComponent();
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

	bool IsBuildMode() const { return bBuildMode; }
	bool IsEditMode() const { return bEditMode; }
	EBRBuildPieceType GetSelectedPiece() const { return SelectedPiece; }
	EBRBuildMaterial GetSelectedMaterial() const { return SelectedMaterial; }
	bool IsPreviewValid() const { return bPreviewValid; }

	void ToggleBuildMode();
	void ToggleEditMode();
	void ExitModes();
	void SelectPiece(EBRBuildPieceType Type);
	void RotatePiece();
	void CycleMaterial();
	void ResetEdit();
	void ApplyEditPreset(uint8 Preset);
	void OnPrimaryPressed();
	void OnPrimaryReleased();

	// Server: spawn a piece without a player (creative map loading).
	static ABRBuildingPiece* SpawnPieceServer(UWorld* World, const FBRGridKey& Key, EBRBuildMaterial Mat, int32 Team, bool bInstant, uint16 EditMask = 0);

protected:
	UFUNCTION(Server, Reliable) void ServerPlacePiece(FBRGridKey Key, EBRBuildMaterial Mat);
	UFUNCTION(Server, Reliable) void ServerEditPiece(ABRBuildingPiece* Piece, uint16 Mask);
	UFUNCTION(Server, Unreliable) void ServerSetModes(bool bBuild, bool bEdit);

private:
	ABRCharacter* GetCharacter() const;
	bool IsBuildingAllowed() const;
	bool ComputeTargetKey(FBRGridKey& OutKey) const;
	void TryPlace();
	void PlaceServer(const FBRGridKey& Key, EBRBuildMaterial Mat);
	void UpdatePreview();
	void EnsurePreview();
	void ShowPreview(bool bShow);
	void CommitEdit();
	ABRBuildingPiece* FindEditTarget() const;

	UPROPERTY(Replicated) bool bBuildMode = false;
	UPROPERTY(Replicated) bool bEditMode = false;

	EBRBuildPieceType SelectedPiece = EBRBuildPieceType::Wall;
	EBRBuildMaterial SelectedMaterial = EBRBuildMaterial::Wood;
	int32 RotationSteps = 0;
	bool bPrimaryHeld = false;
	bool bPreviewValid = false;
	FBRGridKey PreviewKey;
	uint64 LastPlacedKey = 0;
	float LastPlaceTime = -10.f;

	TWeakObjectPtr<ABRBuildingPiece> EditTarget;
	uint16 PendingMask = 0;

	UPROPERTY(Transient) TObjectPtr<AActor> PreviewActor;
	UPROPERTY(Transient) TArray<TObjectPtr<UStaticMeshComponent>> PreviewBars;
	EBRBuildPieceType PreviewShape = EBRBuildPieceType::Wall;
	bool bPreviewColorValid = true;
};
