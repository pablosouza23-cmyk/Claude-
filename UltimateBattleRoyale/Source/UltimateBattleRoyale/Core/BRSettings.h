#pragma once

#include "CoreMinimal.h"
#include "Engine/DeveloperSettings.h"
#include "Core/BRTypes.h"
#include "BRSettings.generated.h"

class USkeletalMesh;
class UAnimInstance;
class UMaterialInterface;
class UBehaviorTree;
class UNiagaraSystem;
class USoundBase;

// Project settings (Project Settings > Game > Ultimate Battle Royale).
// Every asset reference is optional: when empty, the game uses its procedural fallback.
UCLASS(Config = Game, DefaultConfig, meta = (DisplayName = "Ultimate Battle Royale"))
class ULTIMATEBATTLEROYALE_API UBRSettings : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	static const UBRSettings* Get() { return GetDefault<UBRSettings>(); }

	// Half the side of the playable square. 150000 cm => 3 km x 3 km = 9 km².
	UPROPERTY(Config, EditAnywhere, Category = "World", meta = (ClampMin = "50000", ClampMax = "200000"))
	float MapHalfSizeCm = 150000.f;

	UPROPERTY(Config, EditAnywhere, Category = "World")
	int32 FixedWorldSeed = 0;

	UPROPERTY(Config, EditAnywhere, Category = "Match")
	float BusAltitudeCm = 60000.f;

	UPROPERTY(Config, EditAnywhere, Category = "Match")
	float BusFlightSeconds = 75.f;

	UPROPERTY(Config, EditAnywhere, Category = "Match")
	float LobbyWaitSeconds = 60.f;

	UPROPERTY(Config, EditAnywhere, Category = "Match")
	float ReconnectWindowSeconds = 120.f;

	UPROPERTY(Config, EditAnywhere, Category = "Art Overrides")
	TSoftObjectPtr<USkeletalMesh> CharacterMesh;

	UPROPERTY(Config, EditAnywhere, Category = "Art Overrides")
	TSoftClassPtr<UAnimInstance> CharacterAnimClass;

	UPROPERTY(Config, EditAnywhere, Category = "Art Overrides")
	TSoftObjectPtr<UMaterialInterface> StormWallMaterial;

	UPROPERTY(Config, EditAnywhere, Category = "Art Overrides")
	TSoftObjectPtr<UMaterialInterface> WaterMaterial;

	UPROPERTY(Config, EditAnywhere, Category = "VFX")
	TSoftObjectPtr<UNiagaraSystem> MuzzleFlashFX;

	UPROPERTY(Config, EditAnywhere, Category = "VFX")
	TSoftObjectPtr<UNiagaraSystem> ImpactFX;

	UPROPERTY(Config, EditAnywhere, Category = "VFX")
	TSoftObjectPtr<UNiagaraSystem> ExplosionFX;

	UPROPERTY(Config, EditAnywhere, Category = "VFX")
	TSoftObjectPtr<UNiagaraSystem> RainFX;

	UPROPERTY(Config, EditAnywhere, Category = "AI")
	TSoftObjectPtr<UBehaviorTree> BotBehaviorTree;

	UPROPERTY(Config, EditAnywhere, Category = "Online")
	FString ProfileBackendUrl;

	UPROPERTY(Config, EditAnywhere, Category = "Online")
	int32 BuildCompatibilityId = 1;
};
