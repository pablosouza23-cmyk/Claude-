#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Items/BRItemDefinition.h"
#include "BRWeapon.generated.h"

class ABRCharacter;
class UStaticMeshComponent;

USTRUCT()
struct FBRShotHit
{
	GENERATED_BODY()
	UPROPERTY() TObjectPtr<AActor> Actor;
	UPROPERTY() FVector_NetQuantize Location;
};

USTRUCT()
struct FBRShotRequest
{
	GENERATED_BODY()
	UPROPERTY() FVector_NetQuantize10 Origin;
	UPROPERTY() FVector_NetQuantizeNormal Direction;
	UPROPERTY() FVector_NetQuantize Muzzle;
	UPROPERTY() uint32 Seed = 0;
	UPROPERTY() double ClientServerTime = 0.0;
	UPROPERTY() TArray<FBRShotHit> Hits;
	UPROPERTY() TArray<FVector_NetQuantize> PelletEnds;
};

// Equipped firearm/throwable. Client-predicted firing (recoil, spread, FX, local hit detection)
// with fully server-authoritative validation, ammo and damage.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRWeapon : public AActor
{
	GENERATED_BODY()

public:
	ABRWeapon();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	// Server: called right after spawning.
	void InitWeapon(FName InItemId, int32 InAmmoInMag);

	void StartFire();
	void StopFire();
	void RequestReload();

	const UBRWeaponDefinition* GetDefinition() const;
	FName GetItemId() const { return ItemId; }
	int32 GetAmmoInMag() const { return AmmoInMag; }
	bool IsReloading() const { return bReloading; }
	float GetReloadProgress() const;
	float GetCurrentSpreadDeg() const;
	ABRCharacter* GetCharacterOwner() const;

protected:
	UFUNCTION(Server, Reliable) void ServerFire(const FBRShotRequest& Request);
	UFUNCTION(Server, Reliable) void ServerReload();
	UFUNCTION(NetMulticast, Unreliable) void MulticastShotFX(FVector_NetQuantize InMuzzle, const TArray<FVector_NetQuantize>& Ends);
	UFUNCTION(Client, Unreliable) void ClientRejectShot();

	UFUNCTION() void OnRep_ItemId();
	UFUNCTION() void OnRep_Reloading();

private:
	bool CanFireLocal() const;
	void FireOnce();
	void ProcessShot(const FBRShotRequest& Request);
	bool ValidateHit(const FBRShotRequest& Req, const FBRShotHit& Hit, const UBRWeaponDefinition* Def, float& OutDamage, bool& bOutHeadshot) const;
	void FinishReload();
	void BuildVisual();
	void PlayShotFX(const FVector& InMuzzle, const TArray<FVector>& Ends, bool bLocal);
	FVector GetMuzzleLocation() const;

	UPROPERTY(ReplicatedUsing = OnRep_ItemId) FName ItemId;
	UPROPERTY(Replicated) int32 AmmoInMag = 0;
	UPROPERTY(ReplicatedUsing = OnRep_Reloading) bool bReloading = false;
	UPROPERTY(Replicated) float ReloadEndServerTime = 0.f;

	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Muzzle;
	UPROPERTY(Transient) TArray<TObjectPtr<UStaticMeshComponent>> TracerPool;
	UPROPERTY(Transient) TObjectPtr<UStaticMeshComponent> MuzzleFlash;
	UPROPERTY(Transient) TArray<TObjectPtr<USceneComponent>> VisualParts;

	mutable TWeakObjectPtr<const UBRWeaponDefinition> CachedDef;

	// Local (predicting) state
	bool bWantsToFire = false;
	bool bTriggerConsumed = false;
	int32 BurstRemaining = 0;
	double LastLocalShotTime = -1.0;
	float Bloom = 0.f;
	int32 ShotIndex = 0;
	int32 PredictedAmmo = 0;
	uint32 ShotCounter = 0;
	float LocalReadyTime = 0.f;
	float LocalReloadStart = 0.f;
	int32 NextTracer = 0;
	float MuzzleFlashHideTime = 0.f;
	TArray<float> TracerHideTimes;

	// Server state
	double LastServerShotTime = -1.0;
	FTimerHandle ReloadTimer;
};
