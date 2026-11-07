#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "BRStormController.generated.h"

class UStaticMeshComponent;
class UAudioComponent;

USTRUCT(BlueprintType)
struct FBRStormState
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly) int32 Phase = -1;
	UPROPERTY(BlueprintReadOnly) bool bShrinking = false;
	UPROPERTY(BlueprintReadOnly) bool bActive = false;
	UPROPERTY(BlueprintReadOnly) bool bFinished = false;
	UPROPERTY() double SegmentStart = 0.0;
	UPROPERTY() double SegmentEnd = 0.0;
	UPROPERTY() FVector2D FromCenter = FVector2D::ZeroVector;
	UPROPERTY() float FromRadius = 0.f;
	UPROPERTY() FVector2D ToCenter = FVector2D::ZeroVector;
	UPROPERTY() float ToRadius = 0.f;
	UPROPERTY() float DamagePerSecond = 1.f;
};

DECLARE_MULTICAST_DELEGATE_OneParam(FBRStormPhaseChanged, const FBRStormState&);

// Server-driven safe zone. Only the phase state replicates; every client computes the
// current circle from synchronised server time, so shrinking is smooth at zero bandwidth.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRStormController : public AActor
{
	GENERATED_BODY()

public:
	ABRStormController();
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	void StartStorm(const FVector2D& Center, float Radius, uint32 Seed);
	void StopStorm();

	void GetCurrentCircle(FVector2D& OutCenter, float& OutRadius) const;
	void GetNextCircle(FVector2D& OutCenter, float& OutRadius) const { OutCenter = State.ToCenter; OutRadius = State.ToRadius; }
	float GetSecondsRemaining() const;
	bool IsOutside(const FVector& Location) const;
	float DistanceOutside(const FVector& Location) const;
	const FBRStormState& GetState() const { return State; }

	FBRStormPhaseChanged OnPhaseChanged;

protected:
	UFUNCTION() void OnRep_State();

private:
	double Now() const;
	void BeginPhase(int32 Phase);
	void BeginShrink();
	void ApplyDamage();
	void UpdateVisuals();
	void UpdateLocalEffects(float DeltaSeconds);

	UPROPERTY(ReplicatedUsing = OnRep_State) FBRStormState State;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
	UPROPERTY(Transient) TObjectPtr<UStaticMeshComponent> Wall;
	UPROPERTY(Transient) TArray<TObjectPtr<UStaticMeshComponent>> Beams;
	UPROPERTY(Transient) TObjectPtr<UAudioComponent> StormAudio;

	uint32 StormSeed = 1;
	FTimerHandle PhaseTimer;
	FTimerHandle DamageTimer;
	float LastVisualRadius = -1.f;
	FVector2D LastVisualCenter = FVector2D::ZeroVector;
	float TintAlpha = 0.f;
};
