#pragma once

#include "CoreMinimal.h"
#include "Subsystems/EngineSubsystem.h"
#include "Items/BRItemDefinition.h"
#include "BRItemRegistry.generated.h"

// Resolves replicated item ids (FName) to definitions on every machine.
// Inventories and pickups replicate ids, never pointers to runtime objects.
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRItemRegistry : public UEngineSubsystem
{
	GENERATED_BODY()

public:
	static UBRItemRegistry* Get();

	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	const UBRItemDefinition* Find(FName ItemId) const;
	const UBRWeaponDefinition* FindWeapon(FName ItemId) const { return Cast<UBRWeaponDefinition>(Find(ItemId)); }
	const UBRConsumableDefinition* FindConsumable(FName ItemId) const { return Cast<UBRConsumableDefinition>(Find(ItemId)); }

	FName AmmoItemId(EBRAmmoType Type) const;
	FName MaterialItemId(EBRBuildMaterial Mat) const;

	// Items of a type that can drop at a rarity (weighted by LootWeight).
	void GetLootCandidates(EBRItemType Type, EBRRarity Rarity, TArray<const UBRItemDefinition*>& Out) const;
	const UBRItemDefinition* PickLoot(EBRItemType Type, EBRRarity Rarity, BRRules::Rng& Rng) const;

	const TArray<TObjectPtr<UBRItemDefinition>>& GetAll() const { return Definitions; }

	// Registers authored Data Assets (Primary Asset Type "BRItem"). Called by the game instance.
	void LoadAuthoredItems();
	void Register(UBRItemDefinition* Def);

private:
	void BuildDefaults();

	UPROPERTY(Transient)
	TArray<TObjectPtr<UBRItemDefinition>> Definitions;

	TMap<FName, TObjectPtr<UBRItemDefinition>> ById;
};
