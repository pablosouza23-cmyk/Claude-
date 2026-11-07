#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "BRProjectile.generated.h"

class USphereComponent;
class UProjectileMovementComponent;
class UBRWeaponDefinition;

// Server-simulated projectile: sniper rounds (drop), rockets and grenades (bounce + fuse).
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRProjectile : public AActor
{
	GENERATED_BODY()

public:
	ABRProjectile();

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void BeginPlay() override;

	void InitProjectile(FName InItemId, const FVector& Velocity);

	// Shared explosion routine (also used by vehicles and explosive props).
	static void Explode(UObject* WorldContext, const FVector& Location, float Damage, float Radius, float Knockback, float StructureMultiplier, AController* Instigator, AActor* Causer);
	// Client-side presentation (Niagara if configured, procedural fireball otherwise).
	static void PlayExplosionFX(UObject* WorldContext, const FVector& Location, float Radius);

protected:
	UFUNCTION() void OnProjectileHit(UPrimitiveComponent* HitComp, AActor* OtherActor, UPrimitiveComponent* OtherComp, FVector NormalImpulse, const FHitResult& Hit);
	UFUNCTION() void OnRep_ItemId();

private:
	const UBRWeaponDefinition* GetDefinition() const;
	void Detonate();
	void BuildVisual();

	UPROPERTY(VisibleAnywhere) TObjectPtr<USphereComponent> Collision;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UProjectileMovementComponent> Movement;
	UPROPERTY(ReplicatedUsing = OnRep_ItemId) FName ItemId;

	bool bDetonated = false;
	FTimerHandle FuseTimer;
};
