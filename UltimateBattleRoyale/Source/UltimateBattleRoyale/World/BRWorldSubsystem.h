#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "Rules/BRWorldRules.h"
#include "BRWorldSubsystem.generated.h"

class ABRWorldGenerator;
class ABRCharacter;

USTRUCT(BlueprintType)
struct FBRNamedLocation
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly) FText Name;
	UPROPERTY(BlueprintReadOnly) FVector Location = FVector::ZeroVector;
	UPROPERTY(BlueprintReadOnly) float Radius = 0.f;
};

// Fast world queries (terrain height, water, named places) for gameplay, AI, storm and HUD.
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRWorldSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	void SetGenerator(ABRWorldGenerator* InGenerator, uint32 Seed, double HalfSize);
	ABRWorldGenerator* GetGenerator() const { return Generator.Get(); }
	const BRRules::WorldModel* GetModel() const { return Model.Get(); }
	bool HasWorld() const { return Model.IsValid(); }

	float GetTerrainHeight(float X, float Y) const;
	bool GetWaterSurfaceZ(const FVector& Location, float& OutZ) const;
	bool IsLand(float X, float Y) const;
	float GetHalfSize() const { return Model ? float(Model->GetHalfSize()) : 150000.f; }
	const TArray<FBRNamedLocation>& GetNamedLocations() const { return NamedLocations; }
	FText GetLocationName(const FVector& Location) const;

	// Finds a random dry spot (for respawn / bot drops / supply drops).
	FVector FindRandomLandPoint(BRRules::Rng& Rng, float MinHeight = 200.f) const;

	// Server: pickaxe hit on world foliage.
	bool TryHarvest(const FHitResult& Hit, ABRCharacter* By);

private:
	TWeakObjectPtr<ABRWorldGenerator> Generator;
	TUniquePtr<BRRules::WorldModel> Model;
	TArray<FBRNamedLocation> NamedLocations;
};
