#include "Items/BRItemRegistry.h"

#include "Engine/AssetManager.h"
#include "Engine/Engine.h"
#include "Core/BRVisuals.h"
#include "UltimateBattleRoyale.h"

#define LOCTEXT_NAMESPACE "BRItems"

namespace
{
	struct FWeaponTemplate
	{
		const TCHAR* Key;
		const TCHAR* Name;
		EBRWeaponCategory Category;
		EBRFireMode Mode;
		EBRAmmoType Ammo;
		float Damage, Rpm;
		int32 Mag;
		float Reload, Range, FullRange, MinRange, MinMult;
		int32 Pellets;
		float Hip, Bloom, RecoilV, RecoilH, HeadMult;
		bool bHitscan;
		float ProjSpeed, Gravity, ExplosionRadius;
		EBRRarity MinRarity, MaxRarity;
		uint32 Color;
	};

	// Original arsenal. Stats are base (Common) values; rarity scales damage and reload.
	const FWeaponTemplate GWeapons[] = {
		// Key            Name                    Category                          Mode                    Ammo                  Dmg   RPM   Mag Reload Range  Full  Min   MinM Pel Hip  Bloom RcV  RcH  Head  Hitscan Speed  Grav Expl  MinR                 MaxR                  Color
		{ TEXT("SparrowP9"),   TEXT("Pistola Sparrow P9"),   EBRWeaponCategory::Pistol,       EBRFireMode::SemiAuto, EBRAmmoType::Light,   24.f, 400.f, 16, 1.4f, 9000.f, 1500.f, 4500.f, 0.65f, 1, 2.0f, 0.9f, 0.9f, 0.3f, 2.0f, true, 0.f, 0.f, 0.f, EBRRarity::Common, EBRRarity::Epic, 0x8C8C8C },
		{ TEXT("HornetSMG"),   TEXT("Submetralhadora Hornet"), EBRWeaponCategory::SMG,        EBRFireMode::FullAuto, EBRAmmoType::Light,   17.f, 900.f, 30, 2.0f, 9000.f, 1200.f, 4000.f, 0.6f, 1, 2.8f, 0.35f, 0.35f, 0.25f, 1.75f, true, 0.f, 0.f, 0.f, EBRRarity::Common, EBRRarity::Legendary, 0x4A5D6E },
		{ TEXT("TalonAR"),     TEXT("Rifle de Assalto Talon"), EBRWeaponCategory::AssaultRifle, EBRFireMode::FullAuto, EBRAmmoType::Medium, 30.f, 330.f, 30, 2.2f, 25000.f, 2500.f, 8000.f, 0.65f, 1, 2.6f, 0.6f, 0.6f, 0.25f, 1.5f, true, 0.f, 0.f, 0.f, EBRRarity::Common, EBRRarity::Legendary, 0x3D4A3A },
		{ TEXT("BastionBurst"),TEXT("Rifle Bastion Rajada"), EBRWeaponCategory::AssaultRifle,   EBRFireMode::Burst,    EBRAmmoType::Medium, 27.f, 600.f, 21, 2.5f, 25000.f, 3000.f, 9000.f, 0.65f, 1, 2.0f, 0.5f, 0.5f, 0.2f, 1.5f, true, 0.f, 0.f, 0.f, EBRRarity::Uncommon, EBRRarity::Epic, 0x5A4632 },
		{ TEXT("LongshotSR"),  TEXT("Rifle de Precisão Longshot"), EBRWeaponCategory::SniperRifle, EBRFireMode::SemiAuto, EBRAmmoType::Heavy, 100.f, 33.f, 1, 2.6f, 60000.f, 30000.f, 60000.f, 1.f, 1, 6.0f, 0.f, 4.5f, 0.6f, 2.5f, false, 40000.f, 0.45f, 0.f, EBRRarity::Rare, EBRRarity::Mythic, 0x2F3B2A },
		{ TEXT("BreakerPump"), TEXT("Escopeta Breaker"),     EBRWeaponCategory::Shotgun,       EBRFireMode::SemiAuto, EBRAmmoType::Shells,  10.f, 55.f, 5, 4.6f, 4500.f, 600.f, 2500.f, 0.3f, 10, 6.0f, 0.f, 3.5f, 0.8f, 1.8f, true, 0.f, 0.f, 0.f, EBRRarity::Uncommon, EBRRarity::Legendary, 0x6B3E26 },
		{ TEXT("RattlerTac"),  TEXT("Escopeta Tática Rattler"), EBRWeaponCategory::Shotgun,    EBRFireMode::SemiAuto, EBRAmmoType::Shells,   8.f, 110.f, 8, 5.5f, 4000.f, 500.f, 2200.f, 0.3f, 9, 5.5f, 0.f, 2.2f, 0.6f, 1.6f, true, 0.f, 0.f, 0.f, EBRRarity::Common, EBRRarity::Epic, 0x3A3A3A },
		{ TEXT("BulwarkLMG"),  TEXT("Metralhadora Bulwark"), EBRWeaponCategory::LMG,           EBRFireMode::FullAuto, EBRAmmoType::Medium,  24.f, 650.f, 100, 4.5f, 22000.f, 2000.f, 7000.f, 0.6f, 1, 3.4f, 0.25f, 0.45f, 0.3f, 1.5f, true, 0.f, 0.f, 0.f, EBRRarity::Rare, EBRRarity::Legendary, 0x2B2F36 },
		{ TEXT("ThunderRPG"),  TEXT("Lança-Foguetes Thunder"), EBRWeaponCategory::Explosive,  EBRFireMode::SemiAuto, EBRAmmoType::Rockets, 110.f, 40.f, 1, 2.8f, 30000.f, 0.f, 0.f, 1.f, 1, 1.0f, 0.f, 3.0f, 0.4f, 1.f, false, 6500.f, 0.05f, 450.f, EBRRarity::Epic, EBRRarity::Legendary, 0x445533 },
		{ TEXT("VoltRifle"),   TEXT("Rifle de Pulso Volt"),  EBRWeaponCategory::Special,       EBRFireMode::FullAuto, EBRAmmoType::Energy,  19.f, 720.f, 40, 2.4f, 18000.f, 3000.f, 9000.f, 0.6f, 1, 1.8f, 0.2f, 0.3f, 0.1f, 1.6f, true, 0.f, 0.f, 0.f, EBRRarity::Epic, EBRRarity::Mythic, 0x1E6E8C },
	};

	const EBRRarity GAllRarities[] = { EBRRarity::Common, EBRRarity::Uncommon, EBRRarity::Rare, EBRRarity::Epic, EBRRarity::Legendary, EBRRarity::Mythic };

	FString RaritySuffix(EBRRarity R)
	{
		switch (R)
		{
		case EBRRarity::Uncommon: return TEXT("Uncommon");
		case EBRRarity::Rare: return TEXT("Rare");
		case EBRRarity::Epic: return TEXT("Epic");
		case EBRRarity::Legendary: return TEXT("Legendary");
		case EBRRarity::Mythic: return TEXT("Mythic");
		default: return TEXT("Common");
		}
	}
}

UBRItemRegistry* UBRItemRegistry::Get()
{
	return GEngine ? GEngine->GetEngineSubsystem<UBRItemRegistry>() : nullptr;
}

void UBRItemRegistry::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	BuildDefaults();
}

void UBRItemRegistry::Register(UBRItemDefinition* Def)
{
	if (!Def || Def->ItemId.IsNone()) { return; }
	if (TObjectPtr<UBRItemDefinition>* Existing = ById.Find(Def->ItemId))
	{
		Definitions.Remove(*Existing);
	}
	Definitions.Add(Def);
	ById.Add(Def->ItemId, Def);
}

const UBRItemDefinition* UBRItemRegistry::Find(FName ItemId) const
{
	const TObjectPtr<UBRItemDefinition>* Found = ById.Find(ItemId);
	return Found ? Found->Get() : nullptr;
}

FName UBRItemRegistry::AmmoItemId(EBRAmmoType Type) const
{
	switch (Type)
	{
	case EBRAmmoType::Light: return TEXT("A_Light");
	case EBRAmmoType::Medium: return TEXT("A_Medium");
	case EBRAmmoType::Heavy: return TEXT("A_Heavy");
	case EBRAmmoType::Shells: return TEXT("A_Shells");
	case EBRAmmoType::Rockets: return TEXT("A_Rockets");
	case EBRAmmoType::Energy: return TEXT("A_Energy");
	default: return NAME_None;
	}
}

FName UBRItemRegistry::MaterialItemId(EBRBuildMaterial Mat) const
{
	switch (Mat)
	{
	case EBRBuildMaterial::Stone: return TEXT("M_Stone");
	case EBRBuildMaterial::Metal: return TEXT("M_Metal");
	default: return TEXT("M_Wood");
	}
}

void UBRItemRegistry::GetLootCandidates(EBRItemType Type, EBRRarity Rarity, TArray<const UBRItemDefinition*>& Out) const
{
	for (const UBRItemDefinition* Def : Definitions)
	{
		if (Def && Def->ItemType == Type && Def->Rarity == Rarity && Def->LootWeight > 0.f)
		{
			Out.Add(Def);
		}
	}
}

const UBRItemDefinition* UBRItemRegistry::PickLoot(EBRItemType Type, EBRRarity Rarity, BRRules::Rng& Rng) const
{
	// Walk down rarities until something exists (e.g. no Mythic consumables).
	for (int32 R = int32(Rarity); R >= 0; --R)
	{
		TArray<const UBRItemDefinition*> Candidates;
		GetLootCandidates(Type, EBRRarity(R), Candidates);
		if (Candidates.Num() == 0) { continue; }
		TArray<double> Weights;
		for (const UBRItemDefinition* C : Candidates) { Weights.Add(C->LootWeight); }
		const int32 Index = BRRules::WeightedIndex(Weights.GetData(), Weights.Num(), Rng);
		if (Index >= 0) { return Candidates[Index]; }
	}
	return nullptr;
}

void UBRItemRegistry::LoadAuthoredItems()
{
	if (!UAssetManager::IsInitialized()) { return; }
	UAssetManager& AM = UAssetManager::Get();
	TArray<FPrimaryAssetId> Ids;
	AM.GetPrimaryAssetIdList(FPrimaryAssetType(TEXT("BRItem")), Ids);
	for (const FPrimaryAssetId& Id : Ids)
	{
		const FSoftObjectPath Path = AM.GetPrimaryAssetPath(Id);
		if (UBRItemDefinition* Def = Cast<UBRItemDefinition>(Path.TryLoad()))
		{
			Register(Def);
		}
	}
	UE_LOG(LogBR, Log, TEXT("Item registry: %d definitions (%d authored assets)."), Definitions.Num(), Ids.Num());
}

void UBRItemRegistry::BuildDefaults()
{
	// ---- Weapons, one definition per supported rarity.
	for (const FWeaponTemplate& T : GWeapons)
	{
		for (EBRRarity R : GAllRarities)
		{
			if (int32(R) < int32(T.MinRarity) || int32(R) > int32(T.MaxRarity)) { continue; }
			UBRWeaponDefinition* W = NewObject<UBRWeaponDefinition>(this);
			W->ItemId = FName(*FString::Printf(TEXT("W_%s_%s"), T.Key, *RaritySuffix(R)));
			W->DisplayName = FText::FromString(T.Name);
			W->Rarity = R;
			W->ItemType = EBRItemType::Weapon;
			W->MaxStack = 1;
			W->Category = T.Category;
			W->FireMode = T.Mode;
			W->AmmoType = T.Ammo;
			W->Damage = T.Damage * float(BRRules::RarityDamageMultiplier(BRTypes::ToRules(R)));
			W->RoundsPerMinute = T.Rpm;
			W->MagazineSize = T.Mag;
			W->ReloadSeconds = T.Reload * float(BRRules::RarityReloadMultiplier(BRTypes::ToRules(R)));
			W->MaxRange = T.Range;
			W->FullDamageRange = T.FullRange;
			W->MinDamageRange = T.MinRange;
			W->MinDamageMultiplier = T.MinMult;
			W->Pellets = T.Pellets;
			W->HipSpreadDeg = T.Hip;
			W->BloomPerShotDeg = T.Bloom;
			W->RecoilVerticalDeg = T.RecoilV;
			W->RecoilHorizontalDeg = T.RecoilH;
			W->HeadshotMultiplier = T.HeadMult;
			W->bHitscan = T.bHitscan;
			W->ProjectileSpeed = T.ProjSpeed;
			W->ProjectileGravityScale = T.Gravity;
			W->ExplosionRadius = T.ExplosionRadius;
			W->StructureMultiplier = T.Category == EBRWeaponCategory::Explosive ? 4.f : 1.f;
			W->bHasScope = T.Category == EBRWeaponCategory::SniperRifle;
			W->AimFOV = W->bHasScope ? 25.f : 65.f;
			W->AimSpreadMultiplier = T.Category == EBRWeaponCategory::Shotgun ? 0.8f : 0.35f;
			W->TintColor = BRVisuals::HexColor(T.Color);
			W->LootWeight = (T.Category == EBRWeaponCategory::Explosive || T.Category == EBRWeaponCategory::Special) ? 0.4f : 1.f;
			W->Description = FText::Format(LOCTEXT("WeaponDesc", "{0} • {1}"), BRTypes::RarityName(R), BRTypes::AmmoName(T.Ammo));
			Register(W);
		}
	}

	// ---- Throwables (stackable "weapons" consumed per throw).
	auto MakeThrowable = [this](const TCHAR* Id, const TCHAR* Name, EBRRarity R, float Damage, float Radius, float Knockback, uint32 Color)
	{
		UBRWeaponDefinition* G = NewObject<UBRWeaponDefinition>(this);
		G->ItemId = Id; G->DisplayName = FText::FromString(Name); G->Rarity = R;
		G->ItemType = EBRItemType::Weapon; G->MaxStack = 6; G->DefaultDropCount = 3;
		G->Category = EBRWeaponCategory::Throwable; G->FireMode = EBRFireMode::SemiAuto; G->bThrowable = true;
		G->Damage = Damage; G->ExplosionRadius = Radius; G->KnockbackImpulse = Knockback; G->FuseSeconds = 2.5f;
		G->RoundsPerMinute = 60.f; G->MagazineSize = 1; G->bHitscan = false; G->ProjectileSpeed = 2200.f;
		G->ProjectileGravityScale = 1.f; G->StructureMultiplier = 3.f; G->AmmoType = EBRAmmoType::None;
		G->TintColor = BRVisuals::HexColor(Color); G->LootWeight = 0.8f;
		Register(G);
	};
	MakeThrowable(TEXT("G_Frag"), TEXT("Granada de Fragmentação"), EBRRarity::Uncommon, 100.f, 500.f, 0.f, 0x3E5A2E);
	MakeThrowable(TEXT("G_Impulse"), TEXT("Granada de Impulso"), EBRRarity::Rare, 0.f, 600.f, 1800.f, 0x2EA6D9);

	// ---- Consumables.
	auto MakeConsumable = [this](const TCHAR* Id, const TCHAR* Name, EBRRarity R, float Hp, float HpCap, float Sh, float ShCap, float Secs, int32 Stack, int32 Drop, uint32 Color)
	{
		UBRConsumableDefinition* C = NewObject<UBRConsumableDefinition>(this);
		C->ItemId = Id; C->DisplayName = FText::FromString(Name); C->Rarity = R; C->ItemType = EBRItemType::Consumable;
		C->HealthRestore = Hp; C->HealthCap = HpCap; C->ShieldRestore = Sh; C->ShieldCap = ShCap; C->UseSeconds = Secs;
		C->MaxStack = Stack; C->DefaultDropCount = Drop; C->TintColor = BRVisuals::HexColor(Color);
		Register(C);
	};
	MakeConsumable(TEXT("C_Bandage"), TEXT("Curativo"), EBRRarity::Common, 15.f, 75.f, 0.f, 0.f, 3.5f, 15, 5, 0xE8E2D0);
	MakeConsumable(TEXT("C_Medkit"), TEXT("Kit Médico"), EBRRarity::Uncommon, 100.f, 100.f, 0.f, 0.f, 10.f, 3, 1, 0xD93A3A);
	MakeConsumable(TEXT("C_SmallShield"), TEXT("Célula de Escudo"), EBRRarity::Uncommon, 0.f, 0.f, 25.f, 50.f, 2.f, 6, 3, 0x56B7F0);
	MakeConsumable(TEXT("C_BigShield"), TEXT("Cilindro de Escudo"), EBRRarity::Rare, 0.f, 0.f, 50.f, 100.f, 5.f, 3, 1, 0x2E6BF0);
	MakeConsumable(TEXT("C_Revitalizer"), TEXT("Frasco Revitalizante"), EBRRarity::Legendary, 100.f, 100.f, 100.f, 100.f, 15.f, 1, 1, 0xF0C02E);

	// ---- Ammo.
	auto MakeAmmo = [this](EBRAmmoType Type, int32 Drop, uint32 Color)
	{
		UBRItemDefinition* A = NewObject<UBRItemDefinition>(this);
		A->ItemId = AmmoItemId(Type); A->DisplayName = BRTypes::AmmoName(Type); A->ItemType = EBRItemType::Ammo;
		A->AmmoType = Type; A->MaxStack = BRRules::MaxAmmoForType(int32(Type)); A->DefaultDropCount = Drop;
		A->TintColor = BRVisuals::HexColor(Color); A->LootWeight = 1.f;
		Register(A);
	};
	MakeAmmo(EBRAmmoType::Light, 30, 0x9FD8F5);
	MakeAmmo(EBRAmmoType::Medium, 20, 0x7FD67F);
	MakeAmmo(EBRAmmoType::Heavy, 6, 0x3F5FA8);
	MakeAmmo(EBRAmmoType::Shells, 8, 0xD0A040);
	MakeAmmo(EBRAmmoType::Rockets, 2, 0x8A6A3A);
	MakeAmmo(EBRAmmoType::Energy, 30, 0x40E0E0);

	// ---- Building materials.
	for (EBRBuildMaterial M : { EBRBuildMaterial::Wood, EBRBuildMaterial::Stone, EBRBuildMaterial::Metal })
	{
		UBRItemDefinition* Mat = NewObject<UBRItemDefinition>(this);
		Mat->ItemId = MaterialItemId(M); Mat->DisplayName = BRTypes::MaterialName(M); Mat->ItemType = EBRItemType::Material;
		Mat->Material = M; Mat->MaxStack = BRRules::MaxBuildMaterial; Mat->DefaultDropCount = 30;
		Mat->TintColor = BRTypes::BuildMaterialColor(M);
		Register(Mat);
	}

	// ---- Special items.
	UBRItemDefinition* Pad = NewObject<UBRItemDefinition>(this);
	Pad->ItemId = TEXT("S_LaunchPad"); Pad->DisplayName = LOCTEXT("LaunchPad", "Plataforma de Salto");
	Pad->Description = LOCTEXT("LaunchPadDesc", "Coloque no chão para ser lançado ao céu e planar.");
	Pad->Rarity = EBRRarity::Epic; Pad->ItemType = EBRItemType::Special; Pad->Special = EBRSpecialItem::LaunchPad;
	Pad->MaxStack = 1; Pad->TintColor = BRVisuals::HexColor(0xA84CF0); Pad->LootWeight = 0.5f;
	Register(Pad);

	UBRItemDefinition* Pack = NewObject<UBRItemDefinition>(this);
	Pack->ItemId = TEXT("S_Backpack"); Pack->DisplayName = LOCTEXT("Backpack", "Mochila Tática");
	Pack->Description = LOCTEXT("BackpackDesc", "Aumenta em 50% a capacidade de munição.");
	Pack->Rarity = EBRRarity::Rare; Pack->ItemType = EBRItemType::Backpack; Pack->Special = EBRSpecialItem::Backpack;
	Pack->MaxStack = 1; Pack->TintColor = BRVisuals::HexColor(0x6B5B3A); Pack->LootWeight = 0.5f;
	Register(Pack);
}

#undef LOCTEXT_NAMESPACE
