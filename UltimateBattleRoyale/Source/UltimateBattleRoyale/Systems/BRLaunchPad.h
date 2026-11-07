#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "BRLaunchPad.generated.h"

class UBoxComponent;

// Deployable pad that throws players into the sky; the glider deploys on the way down.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRLaunchPad : public AActor
{
	GENERATED_BODY()

public:
	ABRLaunchPad();
	virtual void BeginPlay() override;
	virtual float TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

protected:
	UFUNCTION() void OnOverlap(UPrimitiveComponent* OverlappedComp, AActor* Other, UPrimitiveComponent* OtherComp, int32 BodyIndex, bool bFromSweep, const FHitResult& Sweep);

private:
	UPROPERTY(VisibleAnywhere) TObjectPtr<UBoxComponent> Trigger;
	TMap<TWeakObjectPtr<AActor>, float> Cooldowns;
	float Health = 200.f;
};
