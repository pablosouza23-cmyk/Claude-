#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/BRTypes.h"
#include "Rules/BRWorldRules.h"
#include "BRWorldGenerator.generated.h"

class UProceduralMeshComponent;
class UHierarchicalInstancedStaticMeshComponent;
class UStaticMeshComponent;
class UTexture2D;
class ABRCharacter;

UENUM()
enum class EBRFoliage : uint8 { Tree, Pine, Palm, Rock, Bush, Count UMETA(Hidden) };

UENUM()
enum class EBRVehicleSpawnType : uint8 { SportsCar, Pickup, Motorcycle, Utility, Boat };

USTRUCT()
struct FBRVehicleSpawn
{
	GENERATED_BODY()
	UPROPERTY() FTransform Transform;
	UPROPERTY() EBRVehicleSpawnType Type = EBRVehicleSpawnType::SportsCar;

	FBRVehicleSpawn() = default;
	FBRVehicleSpawn(const FTransform& InTransform, EBRVehicleSpawnType InType) : Transform(InTransform), Type(InType) {}
};

DECLARE_MULTICAST_DELEGATE(FBRWorldGenerated);

// Builds the whole 9 km² island at runtime from the replicated seed: terrain with biomes,
// water, roads, bridges, tunnels, cities with multi-storey explorable buildings (stairs,
// windows, functional doors), villages, farm, military base, industrial district, gas
// stations, observation towers, a secret bunker, forests and rocks (harvestable).
// Static geometry is batched into hierarchical instanced meshes (few draw calls, culling, LOD).
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRWorldGenerator : public AActor
{
	GENERATED_BODY()

public:
	ABRWorldGenerator();

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void BeginPlay() override;

	// Server: set before BeginPlay (deferred spawn).
	void InitSeed(uint32 InSeed) { Seed = InSeed; }
	uint32 GetSeed() const { return Seed; }
	bool IsGenerated() const { return bGenerated; }

	// Server: pickaxe hit on foliage (trees, rocks). Returns true if handled.
	bool HarvestHit(const FHitResult& Hit, ABRCharacter* By);

	const TArray<FVector>& GetFloorLootSpots() const { return FloorLootSpots; }
	const TArray<FTransform>& GetChestSpots() const { return ChestSpots; }
	const TArray<FTransform>& GetAmmoBoxSpots() const { return AmmoBoxSpots; }
	const TArray<FTransform>& GetSpecialChestSpots() const { return SpecialChestSpots; }
	const TArray<FBRVehicleSpawn>& GetVehicleSpawns() const { return VehicleSpawns; }
	UTexture2D* GetMinimapTexture() const { return MinimapTexture; }

	FBRWorldGenerated OnWorldGenerated;

protected:
	UFUNCTION() void OnRep_Seed();
	UFUNCTION() void OnRep_Harvested();

private:
	struct FBatchKey
	{
		const UStaticMesh* Mesh; uint32 Color; bool bCollision;
		bool operator==(const FBatchKey& O) const { return Mesh == O.Mesh && Color == O.Color && bCollision == O.bCollision; }
		friend uint32 GetTypeHash(const FBatchKey& K) { return HashCombine(HashCombine(::GetTypeHash(K.Mesh), K.Color), uint32(K.bCollision)); }
	};
	struct FBuildingSpec
	{
		FVector Origin = FVector::ZeroVector; float Yaw = 0.f;
		int32 Width = 2, Depth = 2, Floors = 1; float FloorHeight = 350.f;
		FLinearColor Wall = FLinearColor::Gray, Trim = FLinearColor::White, Roof = FLinearColor::Red;
		bool bGable = false; bool bInterior = true; bool bWindows = true; float LootChance = 1.f; bool bSecret = false;
	};

	void Generate();
	void BuildTerrain();
	void BuildWater();
	void ScatterFoliage();
	void BuildSettlements();
	void BuildRoadStructures();
	void BuildMinimap();
	void FlushBatches();

	// Geometry helpers (world space).
	void Box(const FVector& Center, const FVector& Size, const FRotator& Rot, const FLinearColor& Color, bool bCollision = true);
	void Shape(UStaticMesh* Mesh, const FVector& Center, const FVector& Size, const FRotator& Rot, const FLinearColor& Color, bool bCollision = true);
	void LocalBox(const FVector& Origin, float Yaw, const FVector& LocalCenter, const FVector& Size, const FLinearColor& Color, const FRotator& LocalRot = FRotator::ZeroRotator, bool bCollision = true);

	void AddBuilding(const FBuildingSpec& Spec, BRRules::Rng& Rng);
	void AddWallRun(const FBuildingSpec& S, const FVector& A, const FVector& B, float Z0, float Height, int32 Modules, int32 DoorModule, BRRules::Rng& Rng);
	void AddDoorSpot(const FVector& Hinge, float Yaw, const FLinearColor& Color);
	void AddTower(const FVector& Base, const FLinearColor& Color);
	void AddGasStation(const FVector& Center, float Yaw, BRRules::Rng& Rng);
	void AddProp(uint8 Kind, const FTransform& T);

	UPROPERTY(ReplicatedUsing = OnRep_Seed) uint32 Seed = 0;
	UPROPERTY(ReplicatedUsing = OnRep_Harvested) TArray<int32> Harvested;

	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
	UPROPERTY(Transient) TArray<TObjectPtr<UProceduralMeshComponent>> TerrainChunks;
	UPROPERTY(Transient) TArray<TObjectPtr<UHierarchicalInstancedStaticMeshComponent>> Batches;
	UPROPERTY(Transient) TArray<TObjectPtr<UHierarchicalInstancedStaticMeshComponent>> FoliageTrunks;
	UPROPERTY(Transient) TArray<TObjectPtr<UHierarchicalInstancedStaticMeshComponent>> FoliageCrowns;
	UPROPERTY(Transient) TObjectPtr<UStaticMeshComponent> Water;
	UPROPERTY(Transient) TObjectPtr<UTexture2D> MinimapTexture;

	TMap<FBatchKey, TArray<FTransform>> PendingBatches;
	TArray<TArray<FTransform>> FoliageTransforms; // per EBRFoliage, identical on all machines
	TMap<int32, float> FoliageHealth;             // server
	int32 AppliedHarvested = 0;

	// Server spawn lists.
	TArray<FVector> FloorLootSpots;
	TArray<FTransform> ChestSpots;
	TArray<FTransform> AmmoBoxSpots;
	TArray<FTransform> SpecialChestSpots;
	TArray<FBRVehicleSpawn> VehicleSpawns;
	struct FDoorSpot { FVector Hinge; float Yaw; FLinearColor Color; };
	TArray<FDoorSpot> DoorSpots;
	TArray<TPair<uint8, FTransform>> PropSpots;
	TArray<FTransform> PumpSpots;

	bool bGenerated = false;
	TUniquePtr<BRRules::WorldModel> Model;
};
