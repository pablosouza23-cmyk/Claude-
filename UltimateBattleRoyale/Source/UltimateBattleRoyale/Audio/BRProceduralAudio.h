#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "Core/BRTypes.h"
#include "BRProceduralAudio.generated.h"

class UAudioComponent;
class USoundAttenuation;

// Real-time synthesised audio: weapon shots, impacts, footsteps, building, UI, vehicle engines,
// weather and music, all spatialised with distance attenuation (direction of gunfire/footsteps is
// audible). Each effect can be replaced by an authored MetaSound via UBRSettings::SoundOverrides.
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRProceduralAudio : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	static void PlaySfx(const UObject* WorldContext, EBRSfx Sfx, const FVector& Location, float Volume = 1.f, bool b2D = false);
	static UAudioComponent* CreateLoop(AActor* Owner, EBRSfx Loop);
	static EBRSfx GunshotFor(EBRWeaponCategory Category);

	// Exposed for tests: generates the PCM (mono, 22.05 kHz) for a one-shot.
	static const TArray<int16>& GetOneShotPCM(EBRSfx Sfx);
	static constexpr int32 SampleRate = 22050;

private:
	static USoundAttenuation* AttenuationFor(EBRSfx Sfx);
	static float MasterVolume(EBRSfx Sfx);
};
