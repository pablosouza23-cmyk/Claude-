#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "Core/BRTypes.h"
#include "BRLootSubsystem.generated.h"

class ABRPickup;
class ABRLootContainer;

// Server-side loot generation (deterministic per match seed) and spawning helpers.
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRLootSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	void SetSeed(uint32 Seed) { Rng = BRRules::Rng(Seed ^ 0x51ED270Bu); }

	ABRPickup* SpawnPickup(const FBRItemStack& Stack, const FVector& Location, bool bSnapToGround = true);
	ABRLootContainer* SpawnContainer(EBRContainerKind Kind, const FTransform& Transform);
	ABRLootContainer* SpawnSupplyDrop(const FVector& GroundLocation, float Altitude = 25000.f);

	void RollContainer(EBRContainerKind Kind, TArray<FBRItemStack>& Out);
	void RollFloor(TArray<FBRItemStack>& Out);
	void SpawnContainerLoot(EBRContainerKind Kind, const FVector& Origin);
	void SpawnFloorLoot(const FVector& Location);

	int32 GetSpawnedPickupCount() const { return SpawnedPickups; }

private:
	void AddWeaponWithAmmo(EBRRarity Rarity, TArray<FBRItemStack>& Out);
	void AddItemOfType(EBRItemType Type, EBRRarity Rarity, TArray<FBRItemStack>& Out);

	BRRules::Rng Rng{ 1337u };
	int32 SpawnedPickups = 0;
};
