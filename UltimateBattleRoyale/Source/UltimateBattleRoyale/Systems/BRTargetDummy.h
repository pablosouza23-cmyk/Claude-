#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "BRTargetDummy.generated.h"

// Shooting-range target: shows hit markers/headshots to the shooter, pops down and resets.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRTargetDummy : public AActor
{
	GENERATED_BODY()

public:
	ABRTargetDummy();
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual float TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

	// Moving targets strafe back and forth.
	UPROPERTY(EditAnywhere, Replicated) float StrafeAmplitude = 0.f;

private:
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Body;
	UPROPERTY(Replicated) bool bDown = false;
	float Health = 200.f;
	float DownTime = 0.f;
	FVector Origin;
	float Phase = 0.f;
};
