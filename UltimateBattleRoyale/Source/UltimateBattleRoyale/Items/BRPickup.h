#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Characters/BRInteractable.h"
#include "Core/BRTypes.h"
#include "BRPickup.generated.h"

class USphereComponent;

// Item lying on the ground. Weapons/heals need Interact; ammo and materials are
// collected automatically by walking over them (server-side overlap).
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRPickup : public AActor, public IBRInteractable
{
	GENERATED_BODY()

public:
	ABRPickup();

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	void InitPickup(const FBRItemStack& InStack);
	const FBRItemStack& GetStack() const { return Stack; }

	virtual bool CanInteract(const ABRCharacter* By) const override;
	virtual FText GetInteractPrompt(const ABRCharacter* By) const override;
	virtual FVector GetInteractLocation() const override { return GetActorLocation(); }
	virtual void ExecuteInteract(ABRCharacter* By) override;

protected:
	UFUNCTION() void OnRep_Stack();
	UFUNCTION() void OnOverlap(UPrimitiveComponent* OverlappedComp, AActor* Other, UPrimitiveComponent* OtherComp, int32 BodyIndex, bool bFromSweep, const FHitResult& Sweep);

private:
	void BuildVisual();
	bool IsAutoPickup() const;
	void GiveTo(ABRCharacter* By, bool bSwapIfFull);

	UPROPERTY(VisibleAnywhere) TObjectPtr<USphereComponent> Collision;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> VisualRoot;
	UPROPERTY(ReplicatedUsing = OnRep_Stack) FBRItemStack Stack;

	bool bConsumed = false;
	float SpinPhase = 0.f;
	FTimerHandle DormancyTimer;
};
