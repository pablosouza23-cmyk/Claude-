#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "Core/BRTypes.h"
#include "BRBuildGridSubsystem.generated.h"

class ABRBuildingPiece;

// Occupancy map of the build grid (server and clients) + structural integrity (server):
// when a piece breaks, everything no longer connected to the ground collapses.
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRBuildGridSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	void Register(ABRBuildingPiece* Piece);
	void Unregister(ABRBuildingPiece* Piece, bool bDestroyed);

	ABRBuildingPiece* Find(const FBRGridKey& Key) const;
	bool IsOccupied(const FBRGridKey& Key) const { return Find(Key) != nullptr; }
	bool HasAdjacentPiece(const FBRGridKey& Key) const;
	bool IsGroundedAt(const FBRGridKey& Key) const;
	int32 Num() const { return Pieces.Num(); }

	void GetNeighbours(const FBRGridKey& Key, TArray<ABRBuildingPiece*>& Out) const;

private:
	void CheckIntegrity(const TArray<TWeakObjectPtr<ABRBuildingPiece>>& Seeds);

	TMap<uint64, TWeakObjectPtr<ABRBuildingPiece>> Pieces;
};
