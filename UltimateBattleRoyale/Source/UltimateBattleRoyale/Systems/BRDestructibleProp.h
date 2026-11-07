#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "BRDestructibleProp.generated.h"

UENUM()
enum class EBRPropKind : uint8 { CarWreck, Crate, Fence, Barrel };

// Destructible world props: wrecked cars (metal), crates/fences (wood), explosive barrels.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRDestructibleProp : public AActor
{
	GENERATED_BODY()

public:
	ABRDestructibleProp();
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void BeginPlay() override;
	virtual float TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

	void SetKind(EBRPropKind InKind) { Kind = InKind; }

protected:
	UFUNCTION() void OnRep_Kind();

private:
	void BuildVisual();

	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
	UPROPERTY(ReplicatedUsing = OnRep_Kind) EBRPropKind Kind = EBRPropKind::Crate;
	float Health = 100.f;
	bool bDead = false;
};
