#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "BRSkyController.generated.h"

class UDirectionalLightComponent;
class USkyLightComponent;
class USkyAtmosphereComponent;
class UExponentialHeightFogComponent;
class UInstancedStaticMeshComponent;
class UAudioComponent;
class UNiagaraComponent;

UENUM(BlueprintType)
enum class EBRWeather : uint8 { Clear, Cloudy, Rain, Fog };

// Dynamic sky: day/night cycle (sun + moonlight), atmosphere, fog and weather (rain/fog),
// replicated from the server so everyone sees the same time and weather.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRSkyController : public AActor
{
	GENERATED_BODY()

public:
	ABRSkyController();
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	void SetTimeOfDay(float Hours);
	void SetWeather(EBRWeather NewWeather);
	float GetTimeOfDayHours() const;
	EBRWeather GetWeather() const { return Weather; }

	// Lobby / range can freeze time.
	UPROPERTY(Replicated) bool bFrozen = false;

private:
	double Now() const;
	void ServerWeatherTick();
	void UpdateRainFallback(float DeltaSeconds);

	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UDirectionalLightComponent> Sun;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USkyLightComponent> SkyLight;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USkyAtmosphereComponent> Atmosphere;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UExponentialHeightFogComponent> Fog;
	UPROPERTY(Transient) TObjectPtr<UInstancedStaticMeshComponent> RainDrops;
	UPROPERTY(Transient) TObjectPtr<UNiagaraComponent> RainFX;
	UPROPERTY(Transient) TObjectPtr<UAudioComponent> RainAudio;
	UPROPERTY(Transient) TObjectPtr<UAudioComponent> WindAudio;

	UPROPERTY(Replicated) float StartHours = 14.f;
	UPROPERTY(Replicated) double StartServerTime = 0.0;
	UPROPERTY(Replicated) float DayLengthMinutes = 24.f;
	UPROPERTY(Replicated) EBRWeather Weather = EBRWeather::Clear;

	float WeatherBlend = 0.f;
	float NextRecapture = 0.f;
	FTimerHandle WeatherTimer;
	TArray<FVector> DropOffsets;
};
