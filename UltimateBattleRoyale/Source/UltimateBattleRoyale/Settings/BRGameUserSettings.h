#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameUserSettings.h"
#include "BRGameUserSettings.generated.h"

// Position/size of one touch control in normalised screen space (editable in the layout editor).
USTRUCT(BlueprintType)
struct FBRTouchControlLayout
{
	GENERATED_BODY()
	UPROPERTY(Config) FName Id;
	UPROPERTY(Config) FVector2D Center = FVector2D(0.5f, 0.5f);  // 0..1 of the viewport
	UPROPERTY(Config) float Size = 0.09f;                         // fraction of viewport height
	UPROPERTY(Config) float Opacity = 0.6f;
};

// Player settings persisted in GameUserSettings.ini (per device).
UCLASS(Config = GameUserSettings)
class ULTIMATEBATTLEROYALE_API UBRGameUserSettings : public UGameUserSettings
{
	GENERATED_BODY()

public:
	static UBRGameUserSettings* GetBR();

	virtual void SetToDefaults() override;

	// -1 = automatic (detected), 0 low, 1 medium, 2 high.
	UPROPERTY(Config) int32 QualityTierOverride = -1;
	UPROPERTY(Config) int32 DetectedQualityTier = -1;
	UPROPERTY(Config) bool bDynamicResolution = true;
	UPROPERTY(Config) bool bShowFPS = false;

	// Controls
	UPROPERTY(Config) float LookSensitivity = 1.f;
	UPROPERTY(Config) float AimSensitivityMultiplier = 0.6f;
	UPROPERTY(Config) float StickSensitivity = 1.f;
	UPROPERTY(Config) float TouchSensitivity = 1.f;
	UPROPERTY(Config) bool bInvertY = false;
	UPROPERTY(Config) float AimAssistStrength = 0.5f;
	UPROPERTY(Config) bool bGyroEnabled = false;
	UPROPERTY(Config) bool bGyroOnlyWhenAiming = true;
	UPROPERTY(Config) float GyroSensitivity = 1.f;
	UPROPERTY(Config) bool bVibrationEnabled = true;
	UPROPERTY(Config) bool bForceTouchControls = false;
	UPROPERTY(Config) float TouchButtonScale = 1.f;
	UPROPERTY(Config) TArray<FBRTouchControlLayout> TouchLayout;

	// Audio / voice
	UPROPERTY(Config) float MasterVolume = 1.f;
	UPROPERTY(Config) float MusicVolume = 0.6f;
	UPROPERTY(Config) float SfxVolume = 1.f;
	UPROPERTY(Config) bool bVoiceChatEnabled = true;
	UPROPERTY(Config) bool bPushToTalk = true;
};
