#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Characters/BRInteractable.h"
#include "BRGasPump.generated.h"

// Refuels the nearest vehicle parked next to it.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRGasPump : public AActor, public IBRInteractable
{
	GENERATED_BODY()

public:
	ABRGasPump();
	virtual void BeginPlay() override;

	virtual bool CanInteract(const ABRCharacter* By) const override;
	virtual FText GetInteractPrompt(const ABRCharacter* By) const override;
	virtual FVector GetInteractLocation() const override { return GetActorLocation() + FVector(0, 0, 100.f); }
	virtual float GetInteractDuration(const ABRCharacter* By) const override { return 2.f; }
	virtual void ExecuteInteract(ABRCharacter* By) override;

private:
	class ABRVehicle* FindVehicle() const;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
};
