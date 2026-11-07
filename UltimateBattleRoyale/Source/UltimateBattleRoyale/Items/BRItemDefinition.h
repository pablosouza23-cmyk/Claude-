#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Core/BRTypes.h"
#include "BRItemDefinition.generated.h"

class UStaticMesh;
class UTexture2D;
class USoundBase;
class UAnimMontage;
class UNiagaraSystem;

// Base item definition. Built-in items are created by UBRItemRegistry at startup;
// designers can add more as Data Assets (Primary Asset Type "BRItem").
UCLASS(BlueprintType)
class ULTIMATEBATTLEROYALE_API UBRItemDefinition : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") FName ItemId;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") FText DisplayName;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") FText Description;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") EBRRarity Rarity = EBRRarity::Common;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") EBRItemType ItemType = EBRItemType::Special;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") int32 MaxStack = 1;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") FLinearColor TintColor = FLinearColor::White;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") TSoftObjectPtr<UStaticMesh> PickupMesh;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") TSoftObjectPtr<UTexture2D> Icon;
	// Loot weight inside its rarity bucket (0 = never drops from random loot).
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") float LootWeight = 1.f;

	// Ammo / material specifics.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") EBRAmmoType AmmoType = EBRAmmoType::None;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") EBRBuildMaterial Material = EBRBuildMaterial::Wood;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") EBRSpecialItem Special = EBRSpecialItem::None;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Item") int32 DefaultDropCount = 1;

	virtual FPrimaryAssetId GetPrimaryAssetId() const override { return FPrimaryAssetId(TEXT("BRItem"), ItemId); }
	bool UsesSlot() const { return ItemType == EBRItemType::Weapon || ItemType == EBRItemType::Consumable || ItemType == EBRItemType::Special; }
};

UCLASS(BlueprintType)
class ULTIMATEBATTLEROYALE_API UBRWeaponDefinition : public UBRItemDefinition
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") EBRWeaponCategory Category = EBRWeaponCategory::AssaultRifle;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") EBRFireMode FireMode = EBRFireMode::FullAuto;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float Damage = 30.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float HeadshotMultiplier = 1.5f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float LimbMultiplier = 0.9f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float StructureMultiplier = 1.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float RoundsPerMinute = 330.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") int32 BurstCount = 3;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") int32 MagazineSize = 30;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float ReloadSeconds = 2.2f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float EquipSeconds = 0.5f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float MaxRange = 25000.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float FullDamageRange = 2500.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float MinDamageRange = 8000.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float MinDamageMultiplier = 0.6f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") int32 Pellets = 1;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float HipSpreadDeg = 3.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float AimSpreadMultiplier = 0.35f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float BloomPerShotDeg = 0.6f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float MaxBloomDeg = 4.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float RecoilVerticalDeg = 0.6f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float RecoilHorizontalDeg = 0.25f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float AimFOV = 65.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") bool bHitscan = true;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float ProjectileSpeed = 30000.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float ProjectileGravityScale = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float ExplosionRadius = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float FuseSeconds = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") float KnockbackImpulse = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") bool bThrowable = false;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon") bool bHasScope = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Presentation") TSoftObjectPtr<USoundBase> FireSound;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Presentation") TSoftObjectPtr<USoundBase> ReloadSound;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Presentation") TSoftObjectPtr<UAnimMontage> FireMontage;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Presentation") TSoftObjectPtr<UAnimMontage> ReloadMontage;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Presentation") TSoftObjectPtr<UNiagaraSystem> MuzzleFX;

	BRRules::FalloffParams Falloff() const
	{
		BRRules::FalloffParams P;
		P.FullDamageRange = FullDamageRange; P.MinDamageRange = MinDamageRange; P.MinMultiplier = MinDamageMultiplier;
		return P;
	}

	BRRules::SpreadParams Spread() const
	{
		BRRules::SpreadParams P;
		P.HipSpreadDeg = HipSpreadDeg; P.AimMultiplier = AimSpreadMultiplier;
		P.BloomPerShotDeg = BloomPerShotDeg; P.MaxBloomDeg = MaxBloomDeg;
		return P;
	}
};

UCLASS(BlueprintType)
class ULTIMATEBATTLEROYALE_API UBRConsumableDefinition : public UBRItemDefinition
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Consumable") float HealthRestore = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Consumable") float HealthCap = 100.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Consumable") float ShieldRestore = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Consumable") float ShieldCap = 100.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Consumable") float UseSeconds = 2.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Consumable") float MoveSpeedWhileUsing = 0.5f;
};
