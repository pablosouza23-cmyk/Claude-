#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Characters/BRInteractable.h"
#include "Core/BRTypes.h"
#include "BRCharacter.generated.h"

class USpringArmComponent;
class UCameraComponent;
class UBRHealthComponent;
class UBRInventoryComponent;
class UBRBuildComponent;
class UBRLagCompensationComponent;
class UBRProceduralBodyComponent;
class UBRCharacterMovementComponent;
class ABRWeapon;
class ABRVehicle;
class ABRPlayerState;
struct FInputActionValue;

UCLASS()
class ULTIMATEBATTLEROYALE_API ABRCharacter : public ACharacter, public IBRInteractable
{
	GENERATED_BODY()

public:
	ABRCharacter(const FObjectInitializer& ObjectInitializer);

	// AActor / APawn
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual float TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual void NotifyControllerChanged() override;
	virtual void OnRep_PlayerState() override;
	virtual void PossessedBy(AController* NewController) override;
	virtual void Landed(const FHitResult& Hit) override;
	virtual void Destroyed() override;

	// IBRInteractable (revive downed teammates)
	virtual bool CanInteract(const ABRCharacter* By) const override;
	virtual FText GetInteractPrompt(const ABRCharacter* By) const override;
	virtual FVector GetInteractLocation() const override { return GetActorLocation(); }
	virtual float GetInteractDuration(const ABRCharacter* By) const override { return 5.f; }
	virtual void ExecuteInteract(ABRCharacter* By) override;

	// ---- Components
	UBRHealthComponent* GetHealth() const { return Health; }
	UBRInventoryComponent* GetInventory() const { return Inventory; }
	UBRBuildComponent* GetBuild() const { return Build; }
	UBRLagCompensationComponent* GetLagCompensation() const { return LagCompensation; }
	UBRProceduralBodyComponent* GetBody() const { return Body; }
	UBRCharacterMovementComponent* GetBRMovement() const;
	UCameraComponent* GetCamera() const { return FollowCamera; }

	// ---- State queries
	UFUNCTION(BlueprintPure) bool IsAiming() const { return bIsAiming; }
	UFUNCTION(BlueprintPure) bool IsDowned() const;
	UFUNCTION(BlueprintPure) bool IsAliveAndWell() const;
	UFUNCTION(BlueprintPure) bool IsEliminated() const;
	UFUNCTION(BlueprintPure) bool IsInVehicle() const { return CurrentVehicle != nullptr; }
	UFUNCTION(BlueprintPure) ABRVehicle* GetVehicle() const { return CurrentVehicle; }
	UFUNCTION(BlueprintPure) ABRWeapon* GetCurrentWeapon() const { return CurrentWeapon; }
	UFUNCTION(BlueprintPure) int32 GetTeamId() const;
	UFUNCTION(BlueprintPure) bool IsHarvesting() const;
	UFUNCTION(BlueprintPure) FName GetActiveEmote() const { return ActiveEmote; }
	UFUNCTION(BlueprintPure) float GetInteractProgress() const { return InteractProgress; }
	bool IsTeammate(const ABRCharacter* Other) const;
	float GetMovementSpeedMultiplier() const;
	ABRPlayerState* GetBRPlayerState() const;
	float GetLastHarvestSwingTime() const { return LastHarvestSwingTime; }
	float GetEmoteStartTime() const { return EmoteStartTime; }

	// Camera-based aim (works for players and bots).
	void GetAimViewPoint(FVector& OutLocation, FRotator& OutRotation) const;
	FVector GetAimPoint(float MaxRange, FHitResult* OutHit = nullptr) const;

	// ---- Actions shared by keyboard/gamepad, touch controls and AI.
	void MoveInput(const FVector2D& Axis);
	// Delta.X = yaw right, Delta.Y = pitch up, in degrees. bAssisted enables aim assist (touch/gamepad).
	void LookInput(const FVector2D& DeltaDegrees, bool bAssisted);
	void StartFire();
	void StopFire();
	void SetAiming(bool bAim);
	void ReloadWeapon();
	void JumpPressed();
	void JumpReleased();
	void ToggleCrouch();
	void SetSprinting(bool bSprint);
	void SelectSlot(int32 SlotIndex); // -1 = pickaxe; in build mode 0..3 select piece
	void CycleSlot(int32 Direction);
	void ToggleBuildMode();
	void ToggleEditMode();
	void CycleBuildMaterial();
	void InteractPressed();
	void InteractReleased();
	void PlayEmote(int32 EmoteIndex);
	void DropActiveItem();
	void DeployParachute();

	// ---- Server-side transitions
	void SetCurrentWeapon(ABRWeapon* Weapon);
	void BeginSkydive();
	void LaunchToSky(float UpSpeed);
	void EnterVehicle(ABRVehicle* Vehicle, int32 Seat);
	void ExitVehicle();
	void OnLifeStateChanged(EBRLifeState NewState);
	void ApplyCosmetics();

	UFUNCTION(Client, Unreliable) void ClientNotifyDamaged(FVector_NetQuantize FromLocation, float Damage);
	UFUNCTION(Client, Reliable) void ClientStartSkydive();

	UPROPERTY(EditAnywhere, Category = "Camera") float DefaultArmLength = 320.f;
	UPROPERTY(EditAnywhere, Category = "Camera") float AimArmLength = 160.f;
	UPROPERTY(EditAnywhere, Category = "Camera") float VehicleArmLength = 850.f;
	UPROPERTY(EditAnywhere, Category = "Camera") float SkydiveArmLength = 550.f;
	UPROPERTY(EditAnywhere, Category = "Camera") float DefaultFOV = 90.f;

protected:
	// Enhanced Input handlers
	void OnMove(const FInputActionValue& V);
	void OnLookMouse(const FInputActionValue& V);
	void OnLookStick(const FInputActionValue& V);
	void OnLookGyro(const FInputActionValue& V);
	void OnFirePressed() { StartFire(); }
	void OnFireReleased() { StopFire(); }
	void OnAimPressed() { SetAiming(true); }
	void OnAimReleased() { SetAiming(false); }
	void OnSprintPressed() { SetSprinting(true); }
	void OnSprintReleased() { SetSprinting(false); }
	void OnSlot(int32 Index) { SelectSlot(Index); }
	void OnNextSlot() { CycleSlot(1); }
	void OnPrevSlot() { CycleSlot(-1); }
	void OnEmoteKey() { PlayEmote(0); }

	UFUNCTION(Server, Unreliable) void ServerSetAiming(bool bAim);
	UFUNCTION(Server, Reliable) void ServerBeginInteract(AActor* Target);
	UFUNCTION(Server, Reliable) void ServerEndInteract();
	UFUNCTION(Server, Reliable) void ServerExitVehicle();
	UFUNCTION(Server, Reliable) void ServerPlayEmote(FName EmoteId);
	UFUNCTION(Server, Reliable) void ServerHarvest(FVector_NetQuantizeNormal AimDirection);
	UFUNCTION(Server, Reliable) void ServerMantle();
	UFUNCTION(Server, Unreliable) void ServerDriveInput(float Throttle, float Steer, bool bHandbrake);

	UFUNCTION() void OnRep_CurrentWeapon();
	UFUNCTION() void OnRep_CurrentVehicle();
	UFUNCTION() void OnRep_HarvestSwing();

private:
	void UpdateCamera(float DeltaSeconds);
	void UpdateRotationMode();
	void UpdateInteraction(float DeltaSeconds);
	void UpdateServerInteraction(float DeltaSeconds);
	void UpdateHarvest(float DeltaSeconds);
	void UpdateDriving();
	AActor* FindBestInteractable() const;
	bool ComputeMantle(FVector& OutLaunchVelocity) const;
	void DoHarvestTrace(const FVector& Direction);
	ABRCharacter* FindAimAssistTarget(float& OutAngleDeg, float& OutDistance, FRotator& OutLookAt) const;
	void CancelEmote();

	UPROPERTY(VisibleAnywhere) TObjectPtr<USpringArmComponent> CameraBoom;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> FollowCamera;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UBRHealthComponent> Health;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UBRInventoryComponent> Inventory;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UBRBuildComponent> Build;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UBRLagCompensationComponent> LagCompensation;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UBRProceduralBodyComponent> Body;

	UPROPERTY(ReplicatedUsing = OnRep_CurrentWeapon) TObjectPtr<ABRWeapon> CurrentWeapon;
	UPROPERTY(ReplicatedUsing = OnRep_CurrentVehicle) TObjectPtr<ABRVehicle> CurrentVehicle;
	UPROPERTY(Replicated) int32 VehicleSeat = -1;
	UPROPERTY(Replicated) bool bIsAiming = false;
	UPROPERTY(Replicated) float InteractProgress = 0.f;
	UPROPERTY(Replicated) FName ActiveEmote;
	UPROPERTY(Replicated) float EmoteStartTime = 0.f;
	UPROPERTY(ReplicatedUsing = OnRep_HarvestSwing) uint8 HarvestSwingCounter = 0;

	// Local
	FVector2D LastMoveInput = FVector2D::ZeroVector;
	bool bFireHeld = false;
	float LastHarvestSwingTime = -10.f;
	float NextInteractScanTime = 0.f;
	TWeakObjectPtr<AActor> LocalInteractTarget;
	float LastDriveSendTime = 0.f;
	float LastLookTime = 0.f;

	// Server
	TWeakObjectPtr<AActor> ServerInteractTarget;
	float ServerInteractElapsed = 0.f;
	float ServerLastHarvestTime = -10.f;
	FVector ServerEmoteStartLocation = FVector::ZeroVector;

public:
	// HUD access
	AActor* GetLocalInteractTarget() const { return LocalInteractTarget.Get(); }
};
