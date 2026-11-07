#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Tickable.h"
#include "Core/BRTypes.h"
#include "BRPerformanceSubsystem.generated.h"

// Device-adaptive quality for Android/iOS/PC:
// - first launch: hardware detection + synthetic benchmark -> Low / Medium / High,
// - applies scalability groups, shadows, view distance, foliage, effects, texture pool, frame cap,
// - dynamic resolution keeps the target frame time (30 / 45 / 60 FPS on mobile),
// - if the device keeps missing the target at minimum resolution (thermal throttling), it drops a tier,
// - responds to OS memory warnings by trimming streaming pools.
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRPerformanceSubsystem : public UGameInstanceSubsystem, public FTickableGameObject
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	// FTickableGameObject
	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override { RETURN_QUICK_DECLARE_CYCLE_STAT(UBRPerformanceSubsystem, STATGROUP_Tickables); }
	virtual bool IsTickable() const override { return !IsTemplate(); }
	virtual bool IsTickableInEditor() const override { return false; }

	EBRQualityTier GetQualityTier() const { return Tier; }
	static EBRQualityTier GetQualityTierStatic(const UObject* WorldContext);
	void SetQualityTier(EBRQualityTier NewTier, bool bPersist);
	void UseAutomaticQuality();
	EBRQualityTier DetectTier();
	float GetAverageFps() const { return AvgFrameMs > 0.f ? 1000.f / AvgFrameMs : 0.f; }
	float GetResolutionScale() const { return ResolutionScale; }
	int32 GetTargetFps() const;

private:
	void ApplyTier(EBRQualityTier InTier);
	void OnMemoryWarning();

	EBRQualityTier Tier = EBRQualityTier::Medium;
	float AvgFrameMs = 16.f;
	float ResolutionScale = 100.f;
	float EvalTimer = 0.f;
	float MissTimer = 0.f;
	FDelegateHandle MemoryHandle;
};
