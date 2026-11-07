#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "Core/BRTypes.h"
#include "BRProfileSaveGame.generated.h"

USTRUCT(BlueprintType)
struct FBRChallenge
{
	GENERATED_BODY()
	UPROPERTY(SaveGame, BlueprintReadOnly) FName Id;
	UPROPERTY(SaveGame, BlueprintReadOnly) FText Description;
	UPROPERTY(SaveGame, BlueprintReadOnly) FName Stat;
	UPROPERTY(SaveGame, BlueprintReadOnly) int32 Target = 1;
	UPROPERTY(SaveGame, BlueprintReadOnly) int32 Progress = 0;
	UPROPERTY(SaveGame, BlueprintReadOnly) int32 XpReward = 1000;
	UPROPERTY(SaveGame, BlueprintReadOnly) bool bWeekly = false;
	UPROPERTY(SaveGame, BlueprintReadOnly) bool bCompleted = false;
};

UCLASS()
class ULTIMATEBATTLEROYALE_API UBRProfileSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	UPROPERTY(SaveGame) int32 Version = 1;
	UPROPERTY(SaveGame) int64 TotalXp = 0;
	UPROPERTY(SaveGame) int64 SeasonXp = 0;
	UPROPERTY(SaveGame) int32 Coins = 500;
	UPROPERTY(SaveGame) bool bPremiumPass = false;
	UPROPERTY(SaveGame) TArray<int32> ClaimedFreeTiers;
	UPROPERTY(SaveGame) TArray<int32> ClaimedPremiumTiers;
	UPROPERTY(SaveGame) TArray<FName> OwnedCosmetics;
	UPROPERTY(SaveGame) FBRCosmeticLoadout Loadout;
	UPROPERTY(SaveGame) TMap<FName, int64> Stats;
	UPROPERTY(SaveGame) TArray<FBRChallenge> Challenges;
	UPROPERTY(SaveGame) FString DailyKey;
	UPROPERTY(SaveGame) FString WeeklyKey;
	UPROPERTY(SaveGame) FString LastServer;
};
