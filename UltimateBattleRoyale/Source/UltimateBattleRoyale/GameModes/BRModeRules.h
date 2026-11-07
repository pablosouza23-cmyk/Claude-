#pragma once

#include "CoreMinimal.h"
#include "Core/BRTypes.h"
#include "BRModeRules.generated.h"

// Independent rules per game mode (replicated to clients through the game state).
USTRUCT(BlueprintType)
struct ULTIMATEBATTLEROYALE_API FBRModeRules
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) EBRGameModeType Mode = EBRGameModeType::Solo;
	UPROPERTY(BlueprintReadOnly) int32 TeamSize = 1;
	UPROPERTY(BlueprintReadOnly) int32 MaxPlayers = 100;
	UPROPERTY(BlueprintReadOnly) int32 MinPlayersToStart = 2;
	UPROPERTY(BlueprintReadOnly) bool bBuildingEnabled = true;
	UPROPERTY(BlueprintReadOnly) bool bStorm = true;
	UPROPERTY(BlueprintReadOnly) bool bBus = true;
	UPROPERTY(BlueprintReadOnly) bool bRespawn = false;
	UPROPERTY(BlueprintReadOnly) float RespawnDelay = 5.f;
	UPROPERTY(BlueprintReadOnly) bool bDownButNotOut = false;
	UPROPERTY(BlueprintReadOnly) bool bFriendlyFire = false;
	UPROPERTY(BlueprintReadOnly) int32 BotCount = 0;           // explicit bots (always labelled as bots)
	UPROPERTY(BlueprintReadOnly) bool bInfiniteResources = false;
	UPROPERTY(BlueprintReadOnly) bool bWorldLoot = true;
	UPROPERTY(BlueprintReadOnly) bool bSupplyDrops = true;
	UPROPERTY(BlueprintReadOnly) bool bCountsForProgression = true;
	UPROPERTY(BlueprintReadOnly) int32 StartingMaterials = 0;
	UPROPERTY(BlueprintReadOnly) bool bShootingRange = false;
	UPROPERTY(BlueprintReadOnly) bool bCreativeTools = false;
	UPROPERTY(BlueprintReadOnly) bool bInvulnerable = false;

	static FBRModeRules ForMode(EBRGameModeType InMode);
	static EBRGameModeType ParseMode(const FString& Name);
	static FString ModeToString(EBRGameModeType InMode);
};
