#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "BRBattleBus.generated.h"

class USpringArmComponent;
class UCameraComponent;
class UAudioComponent;

// The flying bus (original design: bus hanging from a hot-air balloon) that crosses the map.
// Position is computed from replicated start/end/time: no movement replication needed.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRBattleBus : public AActor
{
	GENERATED_BODY()

public:
	ABRBattleBus();
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	void InitFlight(const FVector& Start, const FVector& End, double StartServerTime, float DurationSeconds);
	FVector GetLocationAt(double ServerTime) const;
	float GetProgress() const;
	bool IsFinished() const { return GetProgress() >= 1.f; }
	// Drops are allowed after the bus is over the island.
	bool CanDrop() const { return GetProgress() > 0.08f; }

private:
	double Now() const;
	void BuildVisual();

	UPROPERTY(Replicated) FVector_NetQuantize StartPoint;
	UPROPERTY(Replicated) FVector_NetQuantize EndPoint;
	UPROPERTY(Replicated) double StartTime = 0.0;
	UPROPERTY(Replicated) float Duration = 60.f;

	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USpringArmComponent> Boom;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> Camera;
	UPROPERTY(Transient) TObjectPtr<UAudioComponent> EngineAudio;
};
