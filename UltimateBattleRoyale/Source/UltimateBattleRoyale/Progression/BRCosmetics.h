#pragma once

#include "CoreMinimal.h"
#include "Core/BRTypes.h"
#include "UObject/Object.h"
#include "BRCosmetics.generated.h"

class UAnimMontage;
class USkeletalMesh;

UENUM(BlueprintType)
enum class EBRCosmeticType : uint8 { Outfit, Backpack, Pickaxe, Glider, Emote };

UENUM(BlueprintType)
enum class EBREmoteAnim : uint8 { Wave, Dance, Salute, Spin, Flex, Cheer, Robot, Clap };

// One cosmetic item. All visuals are original; the procedural body renders them from
// colours/shapes, and an authored skeletal mesh / montage can be attached per item.
USTRUCT(BlueprintType)
struct ULTIMATEBATTLEROYALE_API FBRCosmeticDef
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) FName Id;
	UPROPERTY(BlueprintReadOnly) FText Name;
	UPROPERTY(BlueprintReadOnly) FText Description;
	UPROPERTY(BlueprintReadOnly) EBRCosmeticType Type = EBRCosmeticType::Outfit;
	UPROPERTY(BlueprintReadOnly) EBRRarity Rarity = EBRRarity::Common;
	UPROPERTY(BlueprintReadOnly) int32 Price = 0;
	UPROPERTY(BlueprintReadOnly) bool bDefaultOwned = false;
	UPROPERTY(BlueprintReadOnly) bool bShopItem = true;
	UPROPERTY(BlueprintReadOnly) int32 PassTier = 0;          // >0: season pass reward at this tier
	UPROPERTY(BlueprintReadOnly) bool bPremiumPass = false;
	UPROPERTY(BlueprintReadOnly) FLinearColor Primary = FLinearColor::Gray;
	UPROPERTY(BlueprintReadOnly) FLinearColor Secondary = FLinearColor::Gray;
	UPROPERTY(BlueprintReadOnly) FLinearColor Accent = FLinearColor::Black;
	UPROPERTY(BlueprintReadOnly) FLinearColor Skin = FLinearColor(0.8f, 0.6f, 0.45f);
	UPROPERTY(BlueprintReadOnly) FLinearColor Hair = FLinearColor(0.1f, 0.07f, 0.05f);
	UPROPERTY(BlueprintReadOnly) uint8 Shape = 0;              // style variant for backpacks/pickaxes/gliders
	UPROPERTY(BlueprintReadOnly) uint8 DefaultHeadGear = 0;
	UPROPERTY(BlueprintReadOnly) EBREmoteAnim EmoteAnim = EBREmoteAnim::Wave;
	UPROPERTY(BlueprintReadOnly) float EmoteSeconds = 4.f;
	UPROPERTY(BlueprintReadOnly) TSoftObjectPtr<UAnimMontage> Montage;
	UPROPERTY(BlueprintReadOnly) TSoftObjectPtr<USkeletalMesh> Mesh;
};

USTRUCT(BlueprintType)
struct ULTIMATEBATTLEROYALE_API FBRSeasonReward
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly) int32 Tier = 0;
	UPROPERTY(BlueprintReadOnly) bool bPremium = false;
	UPROPERTY(BlueprintReadOnly) FName CosmeticId;   // or None
	UPROPERTY(BlueprintReadOnly) int32 Coins = 0;
};

UCLASS()
class ULTIMATEBATTLEROYALE_API UBRCosmeticCatalog : public UObject
{
	GENERATED_BODY()

public:
	static const TArray<FBRCosmeticDef>& All();
	static const FBRCosmeticDef* Find(FName Id);
	static void GetByType(EBRCosmeticType Type, TArray<const FBRCosmeticDef*>& Out);
	// Deterministic daily shop rotation (same for every player on a given UTC day).
	static void GetDailyShop(const FDateTime& UtcNow, TArray<const FBRCosmeticDef*>& Out, int32 Count = 8);
	static const TArray<FBRSeasonReward>& SeasonRewards();
	// Applies the variant tint (0..2) to an outfit's colours.
	static void GetOutfitColors(const FBRCosmeticDef& Outfit, uint8 Variant, FLinearColor& OutPrimary, FLinearColor& OutSecondary, FLinearColor& OutAccent);
	// Server: replaces unknown/mismatched ids with defaults.
	static FBRCosmeticLoadout Sanitize(const FBRCosmeticLoadout& In);
	static FBRCosmeticLoadout DefaultLoadout();
};
