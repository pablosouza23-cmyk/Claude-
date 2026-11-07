#include "Systems/BRSkyController.h"

#include "Audio/BRProceduralAudio.h"
#include "Components/AudioComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Components/SkyLightComponent.h"
#include "Core/BRSettings.h"
#include "Core/BRVisuals.h"
#include "GameFramework/GameStateBase.h"
#include "Net/UnrealNetwork.h"
#include "NiagaraComponent.h"
#include "NiagaraFunctionLibrary.h"
#include "Settings/BRPerformanceSubsystem.h"
#include "TimerManager.h"

ABRSkyController::ABRSkyController()
{
	PrimaryActorTick.bCanEverTick = true;
	bReplicates = true;
	bAlwaysRelevant = true;
	NetUpdateFrequency = 1.f;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;

	Sun = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Sun"));
	Sun->SetupAttachment(Root);
	Sun->SetMobility(EComponentMobility::Movable);
	Sun->SetAtmosphereSunLight(true);
	Sun->Intensity = 8.f;
	Sun->DynamicShadowDistanceMovableLight = 8000.f;
	Sun->DynamicShadowCascades = 2;

	SkyLight = CreateDefaultSubobject<USkyLightComponent>(TEXT("SkyLight"));
	SkyLight->SetupAttachment(Root);
	SkyLight->SetMobility(EComponentMobility::Movable);
	SkyLight->bLowerHemisphereIsBlack = false;
	SkyLight->Intensity = 1.f;

	Atmosphere = CreateDefaultSubobject<USkyAtmosphereComponent>(TEXT("Atmosphere"));
	Atmosphere->SetupAttachment(Root);

	Fog = CreateDefaultSubobject<UExponentialHeightFogComponent>(TEXT("Fog"));
	Fog->SetupAttachment(Root);
	Fog->SetFogDensity(0.002f);
	Fog->SetFogHeightFalloff(0.1f);
}

void ABRSkyController::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRSkyController, StartHours);
	DOREPLIFETIME(ABRSkyController, StartServerTime);
	DOREPLIFETIME(ABRSkyController, DayLengthMinutes);
	DOREPLIFETIME(ABRSkyController, Weather);
	DOREPLIFETIME(ABRSkyController, bFrozen);
}

double ABRSkyController::Now() const
{
	const AGameStateBase* GS = GetWorld()->GetGameState();
	return GS ? GS->GetServerWorldTimeSeconds() : GetWorld()->GetTimeSeconds();
}

void ABRSkyController::BeginPlay()
{
	Super::BeginPlay();
	const EBRQualityTier Tier = UBRPerformanceSubsystem::GetQualityTierStatic(this);
	Sun->SetCastShadows(Tier != EBRQualityTier::Low);
	Sun->DynamicShadowCascades = Tier == EBRQualityTier::High ? 3 : 1;
	Fog->SetVisibility(Tier != EBRQualityTier::Low);

	if (HasAuthority())
	{
		StartServerTime = Now();
		GetWorldTimerManager().SetTimer(WeatherTimer, this, &ABRSkyController::ServerWeatherTick, 240.f, true, 120.f);
	}
	if (GetNetMode() != NM_DedicatedServer)
	{
		RainAudio = UBRProceduralAudio::CreateLoop(this, EBRSfx::RainLoop);
		WindAudio = UBRProceduralAudio::CreateLoop(this, EBRSfx::WindLoop);
		if (!UBRSettings::Get()->RainFX.IsNull())
		{
			RainFX = UNiagaraFunctionLibrary::SpawnSystemAttached(UBRSettings::Get()->RainFX.LoadSynchronous(), Root, NAME_None, FVector::ZeroVector, FRotator::ZeroRotator, EAttachLocation::KeepRelativeOffset, false);
			if (RainFX) { RainFX->Deactivate(); }
		}
		else if (Tier != EBRQualityTier::Low)
		{
			// Fallback rain: a few hundred instanced streaks recycled around the camera.
			RainDrops = NewObject<UInstancedStaticMeshComponent>(this);
			RainDrops->SetupAttachment(Root);
			RainDrops->SetStaticMesh(BRVisuals::Cube());
			RainDrops->SetMaterial(0, BRVisuals::ColorMaterial(FLinearColor(0.7f, 0.75f, 0.85f)));
			RainDrops->SetCollisionEnabled(ECollisionEnabled::NoCollision);
			RainDrops->bCastDynamicShadow = false;
			RainDrops->SetUsingAbsoluteLocation(true);
			RainDrops->RegisterComponent();
			const int32 Count = Tier == EBRQualityTier::High ? 500 : 250;
			for (int32 I = 0; I < Count; ++I)
			{
				DropOffsets.Add(FVector(FMath::FRandRange(-2500.f, 2500.f), FMath::FRandRange(-2500.f, 2500.f), FMath::FRandRange(0.f, 2000.f)));
				RainDrops->AddInstance(FTransform(FRotator::ZeroRotator, FVector::ZeroVector, FVector(0.01f, 0.01f, 0.6f)));
			}
			RainDrops->SetVisibility(false);
		}
	}
}

void ABRSkyController::ServerWeatherTick()
{
	const float Roll = FMath::FRand();
	SetWeather(Roll < 0.5f ? EBRWeather::Clear : (Roll < 0.7f ? EBRWeather::Cloudy : (Roll < 0.88f ? EBRWeather::Rain : EBRWeather::Fog)));
}

void ABRSkyController::SetTimeOfDay(float Hours)
{
	if (!HasAuthority()) { return; }
	StartHours = FMath::Fmod(Hours, 24.f);
	StartServerTime = Now();
}

void ABRSkyController::SetWeather(EBRWeather NewWeather)
{
	if (HasAuthority()) { Weather = NewWeather; }
}

float ABRSkyController::GetTimeOfDayHours() const
{
	if (bFrozen) { return StartHours; }
	const double Elapsed = Now() - StartServerTime;
	return FMath::Fmod(StartHours + float(Elapsed / (DayLengthMinutes * 60.0)) * 24.f, 24.f);
}

void ABRSkyController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (GetNetMode() == NM_DedicatedServer) { return; }

	const float Hours = GetTimeOfDayHours();
	// Sun elevation: -90 at midnight, +90 at noon. Moonlight keeps nights readable for gameplay.
	const float Elevation = FMath::Sin((Hours - 6.f) / 24.f * 2.f * PI) * 70.f;
	const bool bNight = Elevation < -2.f;
	const float LightPitch = bNight ? -FMath::Max(20.f, -Elevation) : -FMath::Max(5.f, Elevation);
	Sun->SetWorldRotation(FRotator(LightPitch, Hours * 15.f + 30.f, 0.f));

	const float TargetWeather = (Weather == EBRWeather::Clear) ? 0.f : (Weather == EBRWeather::Cloudy ? 0.4f : 1.f);
	WeatherBlend = FMath::FInterpTo(WeatherBlend, TargetWeather, DeltaSeconds, 0.2f);
	const float DayIntensity = FMath::Lerp(8.f, 3.f, WeatherBlend);
	Sun->SetIntensity(bNight ? 0.6f : DayIntensity * FMath::Clamp(Elevation / 20.f, 0.15f, 1.f));
	Sun->SetLightColor(bNight ? FLinearColor(0.55f, 0.65f, 1.f) : FLinearColor::LerpUsingHSV(FLinearColor(1.f, 0.65f, 0.4f), FLinearColor(1.f, 0.97f, 0.92f), FMath::Clamp(Elevation / 30.f, 0.f, 1.f)));
	SkyLight->SetIntensity(bNight ? 0.35f : FMath::Lerp(1.f, 0.7f, WeatherBlend));

	const float FogTarget = Weather == EBRWeather::Fog ? 0.03f : (Weather == EBRWeather::Rain ? 0.012f : 0.002f);
	Fog->SetFogDensity(FMath::FInterpTo(Fog->FogDensity, FogTarget, DeltaSeconds, 0.3f));

	// Sky light recapture (cheap alternative to real-time capture on mobile).
	NextRecapture -= DeltaSeconds;
	if (NextRecapture <= 0.f)
	{
		SkyLight->RecaptureSky();
		NextRecapture = 20.f;
	}

	const bool bRain = Weather == EBRWeather::Rain;
	if (RainFX)
	{
		if (bRain && !RainFX->IsActive()) { RainFX->Activate(); }
		if (!bRain && RainFX->IsActive()) { RainFX->Deactivate(); }
		if (const APlayerController* PC = GetWorld()->GetFirstPlayerController())
		{
			if (PC->PlayerCameraManager) { RainFX->SetWorldLocation(PC->PlayerCameraManager->GetCameraLocation() + FVector(0, 0, 800.f)); }
		}
	}
	UpdateRainFallback(DeltaSeconds);
	if (RainAudio) { RainAudio->SetVolumeMultiplier(FMath::Max(0.001f, bRain ? WeatherBlend * 0.7f : 0.f)); }
	if (WindAudio) { WindAudio->SetVolumeMultiplier(0.12f + 0.3f * WeatherBlend); }
}

void ABRSkyController::UpdateRainFallback(float DeltaSeconds)
{
	if (!RainDrops) { return; }
	const bool bRain = Weather == EBRWeather::Rain && WeatherBlend > 0.3f;
	RainDrops->SetVisibility(bRain);
	if (!bRain) { return; }
	const APlayerController* PC = GetWorld()->GetFirstPlayerController();
	if (!PC || !PC->PlayerCameraManager) { return; }
	const FVector Cam = PC->PlayerCameraManager->GetCameraLocation();
	for (int32 I = 0; I < DropOffsets.Num(); ++I)
	{
		FVector& O = DropOffsets[I];
		O.Z -= 2200.f * DeltaSeconds;
		if (O.Z < -600.f) { O.Z += 2600.f; }
		RainDrops->UpdateInstanceTransform(I, FTransform(FRotator::ZeroRotator, Cam + O, FVector(0.01f, 0.01f, 0.6f)), true, I == DropOffsets.Num() - 1, true);
	}
}
