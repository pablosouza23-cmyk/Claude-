#include "Items/BRLootSubsystem.h"

#include "Engine/World.h"
#include "Items/BRItemRegistry.h"
#include "Items/BRLootContainer.h"
#include "Items/BRPickup.h"

ABRPickup* UBRLootSubsystem::SpawnPickup(const FBRItemStack& Stack, const FVector& Location, bool bSnapToGround)
{
	UWorld* World = GetWorld();
	if (!World || World->GetNetMode() == NM_Client || Stack.IsEmpty()) { return nullptr; }
	FVector Loc = Location;
	if (bSnapToGround)
	{
		FHitResult Hit;
		FCollisionQueryParams Params(SCENE_QUERY_STAT(BRLootGround), false);
		if (World->LineTraceSingleByChannel(Hit, Loc + FVector(0, 0, 120.f), Loc - FVector(0, 0, 2000.f), ECC_Visibility, Params))
		{
			Loc = Hit.ImpactPoint + FVector(0, 0, 32.f);
		}
	}
	FActorSpawnParameters SP;
	SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	ABRPickup* P = World->SpawnActorDeferred<ABRPickup>(ABRPickup::StaticClass(), FTransform(Loc), nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
	if (!P) { return nullptr; }
	P->InitPickup(Stack);
	P->FinishSpawning(FTransform(Loc));
	++SpawnedPickups;
	return P;
}

ABRLootContainer* UBRLootSubsystem::SpawnContainer(EBRContainerKind Kind, const FTransform& Transform)
{
	UWorld* World = GetWorld();
	if (!World || World->GetNetMode() == NM_Client) { return nullptr; }
	ABRLootContainer* C = World->SpawnActorDeferred<ABRLootContainer>(ABRLootContainer::StaticClass(), Transform, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn);
	if (!C) { return nullptr; }
	C->InitContainer(Kind);
	C->FinishSpawning(Transform);
	return C;
}

ABRLootContainer* UBRLootSubsystem::SpawnSupplyDrop(const FVector& GroundLocation, float Altitude)
{
	return SpawnContainer(EBRContainerKind::SupplyDrop, FTransform(GroundLocation + FVector(0, 0, Altitude)));
}

void UBRLootSubsystem::AddWeaponWithAmmo(EBRRarity Rarity, TArray<FBRItemStack>& Out)
{
	const UBRItemRegistry* Reg = UBRItemRegistry::Get();
	const UBRItemDefinition* Def = Reg->PickLoot(EBRItemType::Weapon, Rarity, Rng);
	const UBRWeaponDefinition* W = Cast<UBRWeaponDefinition>(Def);
	if (!W) { return; }
	Out.Add(FBRItemStack(W->ItemId, W->bThrowable ? W->DefaultDropCount : 1, -1));
	if (W->AmmoType != EBRAmmoType::None)
	{
		if (const UBRItemDefinition* A = Reg->Find(Reg->AmmoItemId(W->AmmoType)))
		{
			Out.Add(FBRItemStack(A->ItemId, A->DefaultDropCount));
		}
	}
}

void UBRLootSubsystem::AddItemOfType(EBRItemType Type, EBRRarity Rarity, TArray<FBRItemStack>& Out)
{
	const UBRItemRegistry* Reg = UBRItemRegistry::Get();
	if (const UBRItemDefinition* Def = Reg->PickLoot(Type, Rarity, Rng))
	{
		Out.Add(FBRItemStack(Def->ItemId, FMath::Max(1, Def->DefaultDropCount)));
	}
}

void UBRLootSubsystem::RollFloor(TArray<FBRItemStack>& Out)
{
	if (Rng.NextUnit() > BRRules::FloorSpawnChance()) { return; }
	const EBRRarity R = BRTypes::FromRules(BRRules::RollRarity(BRRules::ContainerKind::Floor, Rng));
	const double Kind[] = { 45.0, 25.0, 15.0, 10.0, 5.0 }; // weapon, consumable, ammo, materials, special
	switch (BRRules::WeightedIndex(Kind, 5, Rng))
	{
	case 0: AddWeaponWithAmmo(R, Out); break;
	case 1: AddItemOfType(EBRItemType::Consumable, R, Out); break;
	case 2: AddItemOfType(EBRItemType::Ammo, EBRRarity::Common, Out); break;
	case 3: AddItemOfType(EBRItemType::Material, EBRRarity::Common, Out); break;
	default:
		if (Rng.NextUnit() < 0.5) { AddItemOfType(EBRItemType::Special, R, Out); } else { AddItemOfType(EBRItemType::Backpack, R, Out); }
		break;
	}
}

void UBRLootSubsystem::RollContainer(EBRContainerKind Kind, TArray<FBRItemStack>& Out)
{
	const BRRules::ContainerKind RK = BRTypes::ToRules(Kind);
	switch (Kind)
	{
	case EBRContainerKind::AmmoBox:
		AddItemOfType(EBRItemType::Ammo, EBRRarity::Common, Out);
		AddItemOfType(EBRItemType::Ammo, EBRRarity::Common, Out);
		if (Rng.NextUnit() < 0.35) { AddItemOfType(EBRItemType::Weapon, EBRRarity::Uncommon, Out); }
		break;
	case EBRContainerKind::Llama:
		for (int32 I = 0; I < 3; ++I) { AddItemOfType(EBRItemType::Ammo, EBRRarity::Common, Out); }
		for (EBRBuildMaterial M : { EBRBuildMaterial::Wood, EBRBuildMaterial::Stone, EBRBuildMaterial::Metal })
		{
			Out.Add(FBRItemStack(UBRItemRegistry::Get()->MaterialItemId(M), 250));
		}
		AddItemOfType(EBRItemType::Consumable, BRTypes::FromRules(BRRules::RollRarity(RK, Rng)), Out);
		AddWeaponWithAmmo(BRTypes::FromRules(BRRules::RollRarity(RK, Rng)), Out);
		break;
	default:
	{
		// Chest / supply drop: weapon + ammo, consumable, materials, maybe extra.
		AddWeaponWithAmmo(BRTypes::FromRules(BRRules::RollRarity(RK, Rng)), Out);
		AddItemOfType(EBRItemType::Consumable, BRTypes::FromRules(BRRules::RollRarity(RK, Rng)), Out);
		const EBRBuildMaterial M = EBRBuildMaterial(Rng.RangeInt(0, 2));
		Out.Add(FBRItemStack(UBRItemRegistry::Get()->MaterialItemId(M), Kind == EBRContainerKind::SupplyDrop ? 100 : 30));
		if (Kind == EBRContainerKind::SupplyDrop)
		{
			AddWeaponWithAmmo(BRTypes::FromRules(BRRules::RollRarity(RK, Rng)), Out);
			AddItemOfType(EBRItemType::Consumable, EBRRarity::Rare, Out);
		}
		else if (Rng.NextUnit() < 0.3)
		{
			AddItemOfType(EBRItemType::Weapon, EBRRarity::Uncommon, Out); // throwables appear here too
		}
		break;
	}
	}
}

void UBRLootSubsystem::SpawnContainerLoot(EBRContainerKind Kind, const FVector& Origin)
{
	TArray<FBRItemStack> Items;
	RollContainer(Kind, Items);
	for (int32 I = 0; I < Items.Num(); ++I)
	{
		const FVector Offset = FRotator(0.f, I * (360.f / FMath::Max(1, Items.Num())), 0.f).Vector() * 110.f;
		SpawnPickup(Items[I], Origin + Offset);
	}
}

void UBRLootSubsystem::SpawnFloorLoot(const FVector& Location)
{
	TArray<FBRItemStack> Items;
	RollFloor(Items);
	for (int32 I = 0; I < Items.Num(); ++I)
	{
		SpawnPickup(Items[I], Location + FVector(I * 70.f, 0.f, 0.f));
	}
}
