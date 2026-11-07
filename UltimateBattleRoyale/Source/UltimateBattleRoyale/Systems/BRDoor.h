#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Characters/BRInteractable.h"
#include "BRDoor.generated.h"

class UStaticMeshComponent;

// Functional, replicated, destructible door. Opens away from whoever uses it.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRDoor : public AActor, public IBRInteractable
{
	GENERATED_BODY()

public:
	ABRDoor();
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual float TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

	void SetDoorColor(const FLinearColor& C) { Color = C; }

	virtual bool CanInteract(const ABRCharacter* By) const override { return true; }
	virtual FText GetInteractPrompt(const ABRCharacter* By) const override;
	virtual FVector GetInteractLocation() const override;
	virtual void ExecuteInteract(ABRCharacter* By) override;
	virtual float GetInteractRange() const override { return 250.f; }

protected:
	UFUNCTION() void OnRep_Open();

private:
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Hinge;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Panel;
	UPROPERTY(ReplicatedUsing = OnRep_Open) int8 OpenDirection = 0; // -1, 0 (closed), +1
	UPROPERTY(Replicated) FLinearColor Color = FLinearColor(0.4f, 0.26f, 0.15f);
	float Angle = 0.f;
	float Health = 150.f;
};
