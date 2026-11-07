#include "Building/BRBuildGridSubsystem.h"

#include "Building/BRBuildingPiece.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "Components/PrimitiveComponent.h"
#include "TimerManager.h"

namespace
{
	void ForEachKeyInCell(const BRRules::GridCoord& Cell, TFunctionRef<void(const BRRules::PieceKey&)> Fn)
	{
		const BRRules::PieceType Types[] = { BRRules::PieceType::Floor, BRRules::PieceType::Roof };
		for (BRRules::PieceType T : Types) { Fn(BRRules::PieceKey{ Cell, T, 0 }); }
		for (uint8 D = 0; D < 2; ++D) { Fn(BRRules::PieceKey{ Cell, BRRules::PieceType::Wall, D }); }
		for (uint8 D = 0; D < 4; ++D) { Fn(BRRules::PieceKey{ Cell, BRRules::PieceType::Ramp, D }); }
	}
}

void UBRBuildGridSubsystem::Register(ABRBuildingPiece* Piece)
{
	if (Piece) { Pieces.Add(Piece->GetKey().Pack(), Piece); }
}

void UBRBuildGridSubsystem::Unregister(ABRBuildingPiece* Piece, bool bDestroyed)
{
	if (!Piece) { return; }
	const uint64 K = Piece->GetKey().Pack();
	if (const TWeakObjectPtr<ABRBuildingPiece>* Found = Pieces.Find(K); Found && Found->Get() == Piece)
	{
		Pieces.Remove(K);
	}
	UWorld* World = GetWorld();
	if (bDestroyed && World && World->GetNetMode() != NM_Client && !World->bIsTearingDown)
	{
		TArray<ABRBuildingPiece*> Neighbours;
		GetNeighbours(Piece->GetKey(), Neighbours);
		TArray<TWeakObjectPtr<ABRBuildingPiece>> Seeds;
		for (ABRBuildingPiece* N : Neighbours) { Seeds.Add(N); }
		// Defer one tick so chains of destruction resolve progressively (looks like a collapse).
		World->GetTimerManager().SetTimerForNextTick(FTimerDelegate::CreateWeakLambda(this, [this, Seeds]() { CheckIntegrity(Seeds); }));
	}
}

ABRBuildingPiece* UBRBuildGridSubsystem::Find(const FBRGridKey& Key) const
{
	const TWeakObjectPtr<ABRBuildingPiece>* Found = Pieces.Find(Key.Pack());
	return Found ? Found->Get() : nullptr;
}

void UBRBuildGridSubsystem::GetNeighbours(const FBRGridKey& Key, TArray<ABRBuildingPiece*>& Out) const
{
	const BRRules::PieceKey Self = BRRules::NormalizeKey(Key.ToRules());
	for (int32 DX = -1; DX <= 1; ++DX)
	{
		for (int32 DY = -1; DY <= 1; ++DY)
		{
			for (int32 DZ = -1; DZ <= 1; ++DZ)
			{
				const BRRules::GridCoord Cell{ Self.Cell.X + DX, Self.Cell.Y + DY, Self.Cell.Z + DZ };
				ForEachKeyInCell(Cell, [&](const BRRules::PieceKey& K)
				{
					if (BRRules::NormalizeKey(K) == Self) { return; }
					if (const TWeakObjectPtr<ABRBuildingPiece>* P = Pieces.Find(BRRules::PackKey(BRRules::NormalizeKey(K))))
					{
						if (P->IsValid()) { Out.AddUnique(P->Get()); }
					}
				});
			}
		}
	}
}

bool UBRBuildGridSubsystem::HasAdjacentPiece(const FBRGridKey& Key) const
{
	TArray<ABRBuildingPiece*> N;
	GetNeighbours(Key, N);
	return N.Num() > 0;
}

bool UBRBuildGridSubsystem::IsGroundedAt(const FBRGridKey& Key) const
{
	// Grounded if any non-player-built geometry lies just below the piece's lowest point.
	UWorld* World = GetWorld();
	if (!World) { return false; }
	const FTransform T = ABRBuildingPiece::ComputeTransform(Key);
	const FVector Extent = ABRBuildingPiece::GetPieceExtent(Key.Type);
	const FVector Center = T.GetLocation();
	const float BottomZ = Key.Type == EBRBuildPieceType::Ramp ? Center.Z - float(BRRules::BuildCellHeight) * 0.5f : Center.Z - Extent.Z;
	const FVector Probes[] = {
		FVector(Center.X, Center.Y, BottomZ),
		T.TransformPosition(FVector(Extent.X * 0.8f, Extent.Y * 0.8f, 0.f)) * FVector(1, 1, 0) + FVector(0, 0, BottomZ),
		T.TransformPosition(FVector(-Extent.X * 0.8f, -Extent.Y * 0.8f, 0.f)) * FVector(1, 1, 0) + FVector(0, 0, BottomZ),
	};
	FCollisionQueryParams Params(SCENE_QUERY_STAT(BRGrounded), false);
	FCollisionObjectQueryParams Objects;
	Objects.AddObjectTypesToQuery(ECC_WorldStatic);
	Objects.AddObjectTypesToQuery(ECC_WorldDynamic);
	for (const FVector& P : Probes)
	{
		// Object-type multi traces report every intersected object, so other player-built pieces
		// in the way do not hide the terrain/houses underneath.
		TArray<FHitResult> Hits;
		World->LineTraceMultiByObjectType(Hits, P + FVector(0, 0, 60.f), P - FVector(0, 0, 90.f), Objects, Params);
		for (const FHitResult& H : Hits)
		{
			const AActor* A = H.GetActor();
			const UPrimitiveComponent* Comp = H.GetComponent();
			const bool bSolid = Comp && Comp->GetCollisionResponseToChannel(ECC_Visibility) == ECR_Block;
			if (bSolid && (!A || (!A->IsA<ABRBuildingPiece>() && !A->IsA<APawn>()))) { return true; }
		}
	}
	return false;
}

void UBRBuildGridSubsystem::CheckIntegrity(const TArray<TWeakObjectPtr<ABRBuildingPiece>>& Seeds)
{
	TSet<ABRBuildingPiece*> Supported;
	for (const TWeakObjectPtr<ABRBuildingPiece>& SeedPtr : Seeds)
	{
		ABRBuildingPiece* Seed = SeedPtr.Get();
		if (!Seed || Seed->IsActorBeingDestroyed() || Supported.Contains(Seed)) { continue; }

		// BFS through connected pieces looking for a grounded one.
		TArray<ABRBuildingPiece*> Queue{ Seed };
		TSet<ABRBuildingPiece*> Visited{ Seed };
		bool bFoundGround = false;
		for (int32 Head = 0; Head < Queue.Num() && Queue.Num() < 4000; ++Head)
		{
			ABRBuildingPiece* Cur = Queue[Head];
			if (Cur->IsGrounded() || Supported.Contains(Cur)) { bFoundGround = true; break; }
			TArray<ABRBuildingPiece*> Next;
			GetNeighbours(Cur->GetKey(), Next);
			for (ABRBuildingPiece* N : Next)
			{
				if (N && !N->IsActorBeingDestroyed() && !Visited.Contains(N)) { Visited.Add(N); Queue.Add(N); }
			}
		}
		if (bFoundGround)
		{
			Supported.Append(Visited);
		}
		else
		{
			for (ABRBuildingPiece* P : Visited) { if (P) { P->Destroy(); } }
		}
	}
}
