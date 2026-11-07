#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Characters/BRInteractable.h"
#include "Core/BRTypes.h"
#include "BRLootContainer.generated.h"

class UBoxComponent;

// Chests, ammo boxes, supply drops (fall from the sky) and supply llamas.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRLootContainer : public AActor, public IBRInteractable
{
	GENERATED_BODY()

public:
	ABRLootContainer();

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	void InitContainer(EBRContainerKind InKind);
	EBRContainerKind GetKind() const { return Kind; }
	bool IsOpened() const { return bOpened; }

	virtual bool CanInteract(const ABRCharacter* By) const override;
	virtual FText GetInteractPrompt(const ABRCharacter* By) const override;
	virtual FVector GetInteractLocation() const override { return GetActorLocation(); }
	virtual float GetInteractDuration(const ABRCharacter* By) const override;
	virtual void ExecuteInteract(ABRCharacter* By) override;

protected:
	UFUNCTION() void OnRep_Kind();
	UFUNCTION() void OnRep_Opened();

private:
	void BuildVisual();

	UPROPERTY(VisibleAnywhere) TObjectPtr<UBoxComponent> Box;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> Lid;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> Balloon;
	UPROPERTY(ReplicatedUsing = OnRep_Kind) EBRContainerKind Kind = EBRContainerKind::Chest;
	UPROPERTY(ReplicatedUsing = OnRep_Opened) bool bOpened = false;
	UPROPERTY(Replicated) bool bLanded = true;
	float LidAngle = 0.f;
};
