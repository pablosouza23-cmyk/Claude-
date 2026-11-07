#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Characters/BRInteractable.h"
#include "World/BRWorldGenerator.h"
#include "BRVehicle.generated.h"

class UBoxComponent;
class UAudioComponent;
class UStaticMeshComponent;
class ABRCharacter;

USTRUCT()
struct FBRVehicleConfig
{
	GENERATED_BODY()
	FText Name;
	float Mass = 1300.f;                 // kg
	FVector HalfExtent = FVector(220, 95, 55);
	TArray<FVector> Wheels;              // local attach points
	TArray<bool> DrivenWheel;
	TArray<bool> SteeredWheel;
	float WheelRadius = 38.f;
	float SuspensionLength = 45.f;
	float SpringAccel = 3200.f;          // cm/s² at full compression (per wheel share)
	float DampingAccel = 260.f;
	float EngineAccel = 950.f;           // cm/s² at standstill
	float TopSpeed = 3000.f;             // cm/s (108 km/h)
	float MaxSteerDeg = 32.f;
	float Grip = 5.f;                    // 1/s lateral velocity cancel rate
	float FuelCapacity = 60.f;
	float MaxHealth = 800.f;
	bool bBoat = false;
	bool bBike = false;
	TArray<FVector> Seats;
	FLinearColor Color = FLinearColor(0.85f, 0.15f, 0.1f);

	static FBRVehicleConfig For(EBRVehicleSpawnType Type);
};

// Drivable vehicle with raycast suspension (cars, pickups, motorcycles, utility vans, boats).
// Server simulates physics from the driver's input; clients get physics replication.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRVehicle : public AActor, public IBRInteractable
{
	GENERATED_BODY()

public:
	ABRVehicle();
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual float TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

	void InitVehicle(EBRVehicleSpawnType InType);

	// IBRInteractable
	virtual bool CanInteract(const ABRCharacter* By) const override;
	virtual FText GetInteractPrompt(const ABRCharacter* By) const override;
	virtual FVector GetInteractLocation() const override { return GetActorLocation(); }
	virtual void ExecuteInteract(ABRCharacter* By) override;
	virtual float GetInteractRange() const override { return 450.f; }

	USceneComponent* GetSeatComponent(int32 Seat) const;
	FVector GetExitLocation(int32 Seat) const;
	void OnOccupantExited(ABRCharacter* Character);
	void SetDriverInput(float Throttle, float Steer, bool bHandbrake);
	void SetLocalDriveInput(float Throttle, float Steer) { VisualSteer = Steer; }
	void Refuel(float Fraction);

	float GetFuelFraction() const { return Config.FuelCapacity > 0.f ? Fuel / Config.FuelCapacity : 0.f; }
	float GetHealthFraction() const { return Config.MaxHealth > 0.f ? Health / Config.MaxHealth : 0.f; }
	float GetSpeedKmh() const;
	bool IsDestroyedVehicle() const { return bWrecked; }
	EBRVehicleSpawnType GetVehicleType() const { return Type; }

protected:
	UFUNCTION() void OnRep_Type();
	UFUNCTION() void OnRep_Wrecked();
	UFUNCTION() void OnBodyHit(UPrimitiveComponent* HitComp, AActor* OtherActor, UPrimitiveComponent* OtherComp, FVector NormalImpulse, const FHitResult& Hit);

private:
	void BuildVisual();
	void SimulateCar(float Dt);
	void SimulateBoat(float Dt);
	void Wreck(AController* Instigator);
	int32 FindFreeSeat(bool bPreferDriver) const;
	AController* GetDriverController() const;

	UPROPERTY(VisibleAnywhere) TObjectPtr<UBoxComponent> Body;
	UPROPERTY(Transient) TArray<TObjectPtr<USceneComponent>> SeatComps;
	UPROPERTY(Transient) TArray<TObjectPtr<USceneComponent>> WheelVisuals;
	UPROPERTY(Transient) TObjectPtr<UAudioComponent> EngineAudio;
	UPROPERTY(Transient) TArray<TObjectPtr<UStaticMeshComponent>> PaintParts;

	UPROPERTY(ReplicatedUsing = OnRep_Type) EBRVehicleSpawnType Type = EBRVehicleSpawnType::SportsCar;
	UPROPERTY(Replicated) TArray<TObjectPtr<ABRCharacter>> Seats;
	UPROPERTY(Replicated) float Fuel = 60.f;
	UPROPERTY(Replicated) float Health = 800.f;
	UPROPERTY(Replicated) float ReplicatedSteer = 0.f;
	UPROPERTY(ReplicatedUsing = OnRep_Wrecked) bool bWrecked = false;

	FBRVehicleConfig Config;
	float Throttle = 0.f, Steer = 0.f, VisualSteer = 0.f;
	bool bHandbrake = false;
	float LastInputTime = 0.f;
	TArray<float> PrevCompression;
	FVector LastVelocity = FVector::ZeroVector;
	float WheelSpin = 0.f;
	float LastCollisionDamageTime = 0.f;
};
