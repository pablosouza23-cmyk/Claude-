#include "Settings/BRGameUserSettings.h"

#include "Engine/Engine.h"

UBRGameUserSettings* UBRGameUserSettings::GetBR()
{
	return GEngine ? Cast<UBRGameUserSettings>(GEngine->GetGameUserSettings()) : nullptr;
}

void UBRGameUserSettings::SetToDefaults()
{
	Super::SetToDefaults();
	QualityTierOverride = -1;
	bDynamicResolution = true;
	LookSensitivity = 1.f;
	AimSensitivityMultiplier = 0.6f;
	StickSensitivity = 1.f;
	TouchSensitivity = 1.f;
	AimAssistStrength = 0.5f;
	bGyroEnabled = false;
	bVibrationEnabled = true;
	TouchButtonScale = 1.f;
	TouchLayout.Reset();
	MasterVolume = 1.f;
	MusicVolume = 0.6f;
	SfxVolume = 1.f;
}
