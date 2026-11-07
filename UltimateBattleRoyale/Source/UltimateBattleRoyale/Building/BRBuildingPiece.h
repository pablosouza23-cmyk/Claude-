#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/BRTypes.h"
#include "BRBuildingPiece.generated.h"

class UInstancedStaticMeshComponent;

// A player-built wall/floor/ramp/roof. One instanced mesh per piece keeps it at one draw call;
// edits remove tiles (doors, windows, arches, half walls). Health grows while "building".
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRBuildingPiece : public AActor
{
	GENERATED_BODY()

public:
	ABRBuildingPiece();

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;
	virtual void Tick(float DeltaSeconds) override;
	virtual float TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

	// Server: configure right after deferred spawn.
	void InitPiece(const FBRGridKey& InKey, EBRBuildMaterial InMaterial, int32 InTeam, bool bInGrounded, bool bInstant = false);
	void SetEditMask(uint16 NewMask);
	// Client-only edit preview (tiles marked for removal are hidden locally).
	void SetLocalPreviewMask(int32 PreviewMask);

	const FBRGridKey& GetKey() const { return Key; }
	EBRBuildMaterial GetMaterial() const { return Material; }
	uint16 GetEditMask() const { return EditMask; }
	int32 GetTeam() const { return TeamId; }
	bool IsGrounded() const { return bGrounded; }
	float GetHealth() const { return Health; }
	float GetMaxHealthNow() const { return MaxHealthNow; }
	int32 TileIndexAt(const FVector& WorldPoint) const;

	static FTransform ComputeTransform(const FBRGridKey& Key);
	// Local-space box of each tile (centre + full size) for this piece type.
	static void GetTileBoxes(EBRBuildPieceType Type, TArray<FTransform>& OutTiles);
	static FVector GetPieceExtent(EBRBuildPieceType Type);

protected:
	UFUNCTION() void OnRep_Visual();

private:
	void RebuildTiles();
	void UpdateTint();
	void SpawnDebris();

	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UInstancedStaticMeshComponent> Tiles;

	UPROPERTY(ReplicatedUsing = OnRep_Visual) FBRGridKey Key;
	UPROPERTY(ReplicatedUsing = OnRep_Visual) EBRBuildMaterial Material = EBRBuildMaterial::Wood;
	UPROPERTY(ReplicatedUsing = OnRep_Visual) uint16 EditMask = 0;
	UPROPERTY(ReplicatedUsing = OnRep_Visual) float Health = 1.f;
	UPROPERTY(Replicated) float MaxHealthNow = 1.f;
	UPROPERTY(Replicated) int32 TeamId = INDEX_NONE;

	bool bGrounded = false;
	bool bRegistered = false;
	float BuildElapsed = 0.f;
	float SpawnAnimTime = 0.f;
	int32 LocalPreviewMask = -1;
	int32 LastTintBand = -1;
};
