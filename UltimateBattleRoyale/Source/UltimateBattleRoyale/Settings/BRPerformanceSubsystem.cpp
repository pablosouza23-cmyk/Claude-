#include "Settings/BRPerformanceSubsystem.h"

#include "Engine/Engine.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "HAL/IConsoleManager.h"
#include "HAL/PlatformMemory.h"
#include "Misc/CoreDelegates.h"
#include "Scalability.h"
#include "Settings/BRGameUserSettings.h"
#include "UltimateBattleRoyale.h"

namespace
{
	void SetCVar(const TCHAR* Name, int32 Value)
	{
		if (IConsoleVariable* V = IConsoleManager::Get().FindConsoleVariable(Name)) { V->Set(Value, ECVF_SetByGameSetting); }
	}
	void SetCVar(const TCHAR* Name, float Value)
	{
		if (IConsoleVariable* V = IConsoleManager::Get().FindConsoleVariable(Name)) { V->Set(Value, ECVF_SetByGameSetting); }
	}
	bool IsMobilePlatform()
	{
#if PLATFORM_ANDROID || PLATFORM_IOS
		return true;
#else
		return false;
#endif
	}
	TWeakObjectPtr<UBRPerformanceSubsystem> GActive;
}

void UBRPerformanceSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	GActive = this;
	UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	if (IsRunningDedicatedServer())
	{
		Tier = EBRQualityTier::Low;
		return;
	}
	if (S && S->QualityTierOverride >= 0) { Tier = EBRQualityTier(FMath::Clamp(S->QualityTierOverride, 0, 2)); }
	else if (S && S->DetectedQualityTier >= 0) { Tier = EBRQualityTier(FMath::Clamp(S->DetectedQualityTier, 0, 2)); }
	else
	{
		Tier = DetectTier();
		if (S) { S->DetectedQualityTier = int32(Tier); S->SaveSettings(); }
	}
	ApplyTier(Tier);
	MemoryHandle = FCoreDelegates::GetMemoryTrimDelegate().AddUObject(this, &UBRPerformanceSubsystem::OnMemoryWarning);
}

void UBRPerformanceSubsystem::Deinitialize()
{
	FCoreDelegates::GetMemoryTrimDelegate().Remove(MemoryHandle);
	Super::Deinitialize();
}

EBRQualityTier UBRPerformanceSubsystem::GetQualityTierStatic(const UObject* WorldContext)
{
	if (IsRunningDedicatedServer()) { return EBRQualityTier::Low; }
	const UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	const UGameInstance* GI = World ? World->GetGameInstance() : nullptr;
	if (const UBRPerformanceSubsystem* P = GI ? GI->GetSubsystem<UBRPerformanceSubsystem>() : nullptr) { return P->Tier; }
	return GActive.IsValid() ? GActive->Tier : EBRQualityTier::Medium;
}

EBRQualityTier UBRPerformanceSubsystem::DetectTier()
{
	BRRules::DeviceInfo D;
	D.bMobile = IsMobilePlatform();
	D.RamGB = double(FPlatformMemory::GetConstants().TotalPhysicalGB);
	D.CpuCores = FPlatformMisc::NumberOfCoresIncludingHyperthreads();
	// Synthetic CPU/GPU benchmark shipped with the engine (scores ~100 = reference hardware).
	if (UBRGameUserSettings* S = UBRGameUserSettings::GetBR())
	{
		S->RunHardwareBenchmark(10, 1.f, 1.f);
		D.CpuScore = S->GetLastCPUBenchmarkResult();
		D.GpuScore = S->GetLastGPUBenchmarkResult();
	}
	const EBRQualityTier Result = EBRQualityTier(uint8(BRRules::ClassifyDevice(D)));
	UE_LOG(LogBR, Log, TEXT("Device: %.1f GB RAM, %d cores, CPU %.0f, GPU %.0f -> tier %d"), D.RamGB, D.CpuCores, D.CpuScore, D.GpuScore, int32(Result));
	return Result;
}

int32 UBRPerformanceSubsystem::GetTargetFps() const
{
	return BRRules::TargetFps(BRRules::QualityTier(uint8(Tier)), IsMobilePlatform());
}

void UBRPerformanceSubsystem::SetQualityTier(EBRQualityTier NewTier, bool bPersist)
{
	Tier = NewTier;
	ApplyTier(Tier);
	if (UBRGameUserSettings* S = UBRGameUserSettings::GetBR(); S && bPersist)
	{
		S->QualityTierOverride = int32(NewTier);
		S->SaveSettings();
	}
}

void UBRPerformanceSubsystem::UseAutomaticQuality()
{
	if (UBRGameUserSettings* S = UBRGameUserSettings::GetBR()) { S->QualityTierOverride = -1; S->SaveSettings(); }
	Tier = DetectTier();
	ApplyTier(Tier);
}

void UBRPerformanceSubsystem::ApplyTier(EBRQualityTier InTier)
{
	const int32 Q = InTier == EBRQualityTier::Low ? 0 : (InTier == EBRQualityTier::Medium ? 1 : (IsMobilePlatform() ? 2 : 3));
	Scalability::FQualityLevels Levels = Scalability::GetQualityLevels();
	Levels.SetFromSingleQualityLevel(Q);
	Levels.ShadowQuality = InTier == EBRQualityTier::Low ? 0 : Q;
	Levels.EffectsQuality = InTier == EBRQualityTier::Low ? 0 : Q;
	Levels.FoliageQuality = Q;
	Scalability::SetQualityLevels(Levels);

	const bool bMobile = IsMobilePlatform();
	SetCVar(TEXT("t.MaxFPS"), GetTargetFps());
	SetCVar(TEXT("r.ViewDistanceScale"), InTier == EBRQualityTier::Low ? 0.5f : (InTier == EBRQualityTier::Medium ? 0.75f : 1.f));
	SetCVar(TEXT("foliage.DensityScale"), InTier == EBRQualityTier::Low ? 0.4f : (InTier == EBRQualityTier::Medium ? 0.7f : 1.f));
	SetCVar(TEXT("r.Shadow.CSM.MaxCascades"), InTier == EBRQualityTier::High ? 3 : 1);
	SetCVar(TEXT("r.Shadow.MaxResolution"), InTier == EBRQualityTier::Low ? 512 : (InTier == EBRQualityTier::Medium ? 1024 : 2048));
	SetCVar(TEXT("r.Shadow.DistanceScale"), InTier == EBRQualityTier::Low ? 0.4f : (InTier == EBRQualityTier::Medium ? 0.7f : 1.f));
	SetCVar(TEXT("fx.Niagara.QualityLevel"), Q);
	SetCVar(TEXT("r.SkeletalMeshLODBias"), InTier == EBRQualityTier::Low ? 2 : (InTier == EBRQualityTier::Medium ? 1 : 0));
	SetCVar(TEXT("r.StaticMeshLODDistanceScale"), InTier == EBRQualityTier::Low ? 2.f : (InTier == EBRQualityTier::Medium ? 1.4f : 1.f));
	SetCVar(TEXT("r.Streaming.PoolSize"), bMobile ? (InTier == EBRQualityTier::Low ? 300 : (InTier == EBRQualityTier::Medium ? 500 : 800)) : (InTier == EBRQualityTier::High ? 3000 : 1500));
	SetCVar(TEXT("r.Streaming.MipBias"), InTier == EBRQualityTier::Low ? 1.f : 0.f);
	SetCVar(TEXT("r.MaxAnisotropy"), InTier == EBRQualityTier::Low ? 1 : (InTier == EBRQualityTier::Medium ? 4 : 8));
	SetCVar(TEXT("r.BloomQuality"), InTier == EBRQualityTier::Low ? 0 : 3);
	SetCVar(TEXT("r.DepthOfFieldQuality"), 0);
	SetCVar(TEXT("r.MotionBlurQuality"), 0);
	// Lumen/Nanite only on capable desktop hardware at High.
	const bool bHighEnd = !bMobile && InTier == EBRQualityTier::High;
	SetCVar(TEXT("r.DynamicGlobalIlluminationMethod"), bHighEnd ? 1 : 0);
	SetCVar(TEXT("r.ReflectionMethod"), bHighEnd ? 1 : 2);
	SetCVar(TEXT("r.Nanite"), bHighEnd ? 1 : 0);
	if (bMobile)
	{
		SetCVar(TEXT("r.MobileContentScaleFactor"), InTier == EBRQualityTier::Low ? 0.8f : (InTier == EBRQualityTier::Medium ? 1.f : 1.25f));
	}
	ResolutionScale = 100.f;
	SetCVar(TEXT("r.ScreenPercentage"), 100.f);
	UE_LOG(LogBR, Log, TEXT("Quality tier applied: %d (target %d FPS)"), int32(InTier), GetTargetFps());
}

void UBRPerformanceSubsystem::Tick(float DeltaTime)
{
	if (IsRunningDedicatedServer() || DeltaTime <= 0.f) { return; }
	AvgFrameMs = FMath::Lerp(AvgFrameMs, DeltaTime * 1000.f, 0.05f);
	const UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	if (!S || !S->bDynamicResolution) { return; }

	EvalTimer += DeltaTime;
	if (EvalTimer < 0.5f) { return; }
	EvalTimer = 0.f;

	const float TargetMs = 1000.f / float(GetTargetFps());
	const float MinScale = Tier == EBRQualityTier::Low ? 55.f : 65.f;
	const float NewScale = float(BRRules::NextResolutionScale(ResolutionScale, AvgFrameMs, TargetMs, MinScale, 100.0));
	if (!FMath::IsNearlyEqual(NewScale, ResolutionScale, 0.5f))
	{
		ResolutionScale = NewScale;
		SetCVar(TEXT("r.ScreenPercentage"), ResolutionScale);
	}

	// Persistently over budget at minimum resolution (thermal throttling): drop one tier for this session.
	if (ResolutionScale <= MinScale + 0.5f && AvgFrameMs > TargetMs * 1.15f) { MissTimer += 0.5f; } else { MissTimer = 0.f; }
	if (MissTimer > 20.f && Tier != EBRQualityTier::Low && S->QualityTierOverride < 0)
	{
		MissTimer = 0.f;
		UE_LOG(LogBR, Warning, TEXT("Sustained low FPS: lowering quality tier."));
		Tier = EBRQualityTier(uint8(Tier) - 1);
		ApplyTier(Tier);
	}
}

void UBRPerformanceSubsystem::OnMemoryWarning()
{
	UE_LOG(LogBR, Warning, TEXT("Memory warning: trimming streaming pool and collecting garbage."));
	SetCVar(TEXT("r.Streaming.PoolSize"), 200);
	if (GEngine) { GEngine->ForceGarbageCollection(true); }
}
