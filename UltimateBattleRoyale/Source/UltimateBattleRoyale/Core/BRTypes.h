#pragma once

#include "CoreMinimal.h"
#include "Rules/BRRules.h"
#include "BRTypes.generated.h"

UENUM(BlueprintType)
enum class EBRRarity : uint8 { Common, Uncommon, Rare, Epic, Legendary, Mythic };

UENUM(BlueprintType)
enum class EBRItemType : uint8 { Weapon, Ammo, Consumable, Material, Backpack, Special };

UENUM(BlueprintType)
enum class EBRWeaponCategory : uint8 { Pistol, SMG, AssaultRifle, SniperRifle, Shotgun, LMG, Explosive, Special, Throwable };

UENUM(BlueprintType)
enum class EBRAmmoType : uint8 { None, Light, Medium, Heavy, Shells, Rockets, Energy, MAX UMETA(Hidden) };

UENUM(BlueprintType)
enum class EBRFireMode : uint8 { SemiAuto, FullAuto, Burst };

UENUM(BlueprintType)
enum class EBRBuildMaterial : uint8 { Wood, Stone, Metal, MAX UMETA(Hidden) };

UENUM(BlueprintType)
enum class EBRBuildPieceType : uint8 { Wall, Floor, Ramp, Roof };

UENUM(BlueprintType)
enum class EBRMatchPhase : uint8 { WaitingForPlayers, BusFlight, Playing, EndGame, PostMatch };

UENUM(BlueprintType)
enum class EBRGameModeType : uint8 { Solo, Duos, Squads, BuildBattle, ZeroBuild, Training, ShootingRange, Creative };

UENUM(BlueprintType)
enum class EBRLifeState : uint8 { Alive, Downed, Eliminated };

UENUM(BlueprintType)
enum class EBRQualityTier : uint8 { Low, Medium, High };

UENUM(BlueprintType)
enum class EBRContainerKind : uint8 { Floor, Chest, AmmoBox, SupplyDrop, Llama };

UENUM(BlueprintType)
enum class EBRSpecialItem : uint8 { None, LaunchPad, Backpack };

USTRUCT(BlueprintType)
struct ULTIMATEBATTLEROYALE_API FBRItemStack
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite) FName ItemId = NAME_None;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Count = 0;
	// Rounds loaded in the magazine for weapons; -1 = "full magazine" when spawned as loot.
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 AmmoInMag = -1;

	FBRItemStack() = default;
	FBRItemStack(FName InId, int32 InCount, int32 InAmmo = -1) : ItemId(InId), Count(InCount), AmmoInMag(InAmmo) {}
	bool IsEmpty() const { return ItemId.IsNone() || Count <= 0; }
	void Clear() { ItemId = NAME_None; Count = 0; AmmoInMag = -1; }
	bool operator==(const FBRItemStack& O) const { return ItemId == O.ItemId && Count == O.Count && AmmoInMag == O.AmmoInMag; }
};

// Grid address of a building piece (mirrors BRRules::PieceKey, replicable).
USTRUCT(BlueprintType)
struct ULTIMATEBATTLEROYALE_API FBRGridKey
{
	GENERATED_BODY()

	UPROPERTY() int32 X = 0;
	UPROPERTY() int32 Y = 0;
	UPROPERTY() int32 Z = 0;
	UPROPERTY() EBRBuildPieceType Type = EBRBuildPieceType::Wall;
	UPROPERTY() uint8 Dir = 0;

	BRRules::PieceKey ToRules() const
	{
		BRRules::PieceKey K;
		K.Cell = BRRules::GridCoord{ X, Y, Z };
		K.Type = BRRules::PieceType(uint8(Type));
		K.Dir = Dir;
		return K;
	}
	static FBRGridKey FromRules(const BRRules::PieceKey& K)
	{
		FBRGridKey G;
		G.X = K.Cell.X; G.Y = K.Cell.Y; G.Z = K.Cell.Z;
		G.Type = EBRBuildPieceType(uint8(K.Type));
		G.Dir = K.Dir;
		return G;
	}
	uint64 Pack() const { return BRRules::PackKey(BRRules::NormalizeKey(ToRules())); }
	bool operator==(const FBRGridKey& O) const { return Pack() == O.Pack(); }
};

USTRUCT(BlueprintType)
struct ULTIMATEBATTLEROYALE_API FBRCosmeticLoadout
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite) FName Outfit = TEXT("Outfit_Recruta");
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FName Backpack = TEXT("Back_Basica");
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FName Pickaxe = TEXT("Pick_Padrao");
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FName Glider = TEXT("Glider_Padrao");
	UPROPERTY(EditAnywhere, BlueprintReadWrite) TArray<FName> Emotes;
	// Customisation (applies to any outfit).
	UPROPERTY(EditAnywhere, BlueprintReadWrite) uint8 BodyType = 0;     // 0 male, 1 female
	UPROPERTY(EditAnywhere, BlueprintReadWrite) uint8 BodyStyle = 0;    // 0 regular, 1 slim, 2 strong
	UPROPERTY(EditAnywhere, BlueprintReadWrite) uint8 HairStyle = 0;    // 0 short, 1 long, 2 ponytail, 3 spiky, 4 bald
	UPROPERTY(EditAnywhere, BlueprintReadWrite) uint8 HeadGear = 0;     // 0 none, 1 helmet, 2 mask, 3 cap, 4 hood
	UPROPERTY(EditAnywhere, BlueprintReadWrite) uint8 ColorVariant = 0; // 0..2
};

USTRUCT(BlueprintType)
struct ULTIMATEBATTLEROYALE_API FBRMatchResult
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) int32 Placement = 0;
	UPROPERTY(BlueprintReadOnly) int32 TotalTeams = 0;
	UPROPERTY(BlueprintReadOnly) int32 Eliminations = 0;
	UPROPERTY(BlueprintReadOnly) int32 Assists = 0;
	UPROPERTY(BlueprintReadOnly) int32 Revives = 0;
	UPROPERTY(BlueprintReadOnly) int32 ChestsOpened = 0;
	UPROPERTY(BlueprintReadOnly) int32 DamageDealt = 0;
	UPROPERTY(BlueprintReadOnly) float SecondsSurvived = 0.f;
	UPROPERTY(BlueprintReadOnly) int32 XpEarned = 0;
	UPROPERTY(BlueprintReadOnly) int32 CoinsEarned = 0;
	UPROPERTY(BlueprintReadOnly) EBRGameModeType Mode = EBRGameModeType::Solo;
	UPROPERTY(BlueprintReadOnly) bool bCountsForProgression = true;
};

namespace BRTypes
{
	inline BRRules::Rarity ToRules(EBRRarity R) { return BRRules::Rarity(uint8(R)); }
	inline EBRRarity FromRules(BRRules::Rarity R) { return EBRRarity(uint8(R)); }
	inline BRRules::BuildMat ToRules(EBRBuildMaterial M) { return BRRules::BuildMat(uint8(M)); }
	inline BRRules::PieceType ToRules(EBRBuildPieceType T) { return BRRules::PieceType(uint8(T)); }
	inline BRRules::ContainerKind ToRules(EBRContainerKind K) { return BRRules::ContainerKind(uint8(K)); }
	inline BRRules::Vec3 ToVec3(const FVector& V) { return BRRules::Vec3(V.X, V.Y, V.Z); }
	inline FVector ToFVector(const BRRules::Vec3& V) { return FVector(V.X, V.Y, V.Z); }

	ULTIMATEBATTLEROYALE_API FLinearColor RarityColor(EBRRarity R);
	ULTIMATEBATTLEROYALE_API FText RarityName(EBRRarity R);
	ULTIMATEBATTLEROYALE_API FText MaterialName(EBRBuildMaterial M);
	ULTIMATEBATTLEROYALE_API FText AmmoName(EBRAmmoType A);
	ULTIMATEBATTLEROYALE_API FText ModeName(EBRGameModeType M);
	ULTIMATEBATTLEROYALE_API FLinearColor BuildMaterialColor(EBRBuildMaterial M);
}
