#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Core/BRTypes.h"
#include "BRHealthComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FBRHealthChanged, float, Health, float, Shield, float, Delta);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FBRLifeStateChanged, EBRLifeState, NewState);

// Health + shield + down-but-not-out. All mutations are server-only; values replicate.
UCLASS(ClassGroup = (BR), meta = (BlueprintSpawnableComponent))
class ULTIMATEBATTLEROYALE_API UBRHealthComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UBRHealthComponent();

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	// Server: returns damage actually applied (shield + health).
	float ApplyDamage(float Damage, AController* InstigatorController, AActor* Causer, bool bIgnoreShield, bool bHeadshot);
	void Heal(float Amount, float Cap);
	void AddShield(float Amount, float Cap);
	void Revive(float HealthAfterRevive = 30.f);
	void ResetToFull();
	void Kill(AController* InstigatorController, AActor* Causer);

	UFUNCTION(BlueprintPure) float GetHealth() const { return Health; }
	UFUNCTION(BlueprintPure) float GetShield() const { return Shield; }
	UFUNCTION(BlueprintPure) float GetMaxHealth() const { return MaxHealth; }
	UFUNCTION(BlueprintPure) float GetMaxShield() const { return MaxShield; }
	UFUNCTION(BlueprintPure) float GetDownedHealth() const { return DownedHealth; }
	UFUNCTION(BlueprintPure) EBRLifeState GetLifeState() const { return LifeState; }
	UFUNCTION(BlueprintPure) bool IsAlive() const { return LifeState == EBRLifeState::Alive; }
	UFUNCTION(BlueprintPure) bool IsDowned() const { return LifeState == EBRLifeState::Downed; }
	UFUNCTION(BlueprintPure) bool IsEliminated() const { return LifeState == EBRLifeState::Eliminated; }

	UPROPERTY(BlueprintAssignable) FBRHealthChanged OnHealthChanged;
	UPROPERTY(BlueprintAssignable) FBRLifeStateChanged OnLifeStateChanged;

	UPROPERTY(EditAnywhere, Category = "Health") float MaxHealth = 100.f;
	UPROPERTY(EditAnywhere, Category = "Health") float MaxShield = 100.f;
	UPROPERTY(EditAnywhere, Category = "Health") float MaxDownedHealth = 100.f;
	UPROPERTY(EditAnywhere, Category = "Health") float BleedOutPerSecond = 5.f;
	// Invulnerable (warm-up, creative, bus).
	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Health") bool bInvulnerable = false;

	// Last controller that damaged us (for elimination credit on storm/fall deaths).
	TWeakObjectPtr<AController> LastDamager;
	float LastDamageTime = -100.f;

private:
	void SetLifeState(EBRLifeState NewState, AController* InstigatorController, AActor* Causer, bool bHeadshot);

	UFUNCTION() void OnRep_Health(float OldHealth);
	UFUNCTION() void OnRep_Shield(float OldShield);
	UFUNCTION() void OnRep_LifeState();

	UPROPERTY(ReplicatedUsing = OnRep_Health) float Health = 100.f;
	UPROPERTY(ReplicatedUsing = OnRep_Shield) float Shield = 0.f;
	UPROPERTY(Replicated) float DownedHealth = 0.f;
	UPROPERTY(ReplicatedUsing = OnRep_LifeState) EBRLifeState LifeState = EBRLifeState::Alive;
};
