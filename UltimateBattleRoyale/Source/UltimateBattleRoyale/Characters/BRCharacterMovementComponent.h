#pragma once

#include "CoreMinimal.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "BRCharacterMovementComponent.generated.h"

class ABRCharacter;

UENUM(BlueprintType)
enum class EBRCustomMovement : uint8
{
	None = 0,
	Skydive = 1,
	Parachute = 2,
};

// Predicted movement: sprint, slide, skydive and glider/parachute, custom water.
// Sprint/parachute requests travel in the compressed move flags so client
// prediction and server simulation stay in sync.
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRCharacterMovementComponent : public UCharacterMovementComponent
{
	GENERATED_BODY()

	friend class FSavedMove_BR;

public:
	UBRCharacterMovementComponent();

	virtual void InitializeComponent() override;
	virtual float GetMaxSpeed() const override;
	virtual float GetMaxBrakingDeceleration() const override;
	virtual void UpdateFromCompressedFlags(uint8 Flags) override;
	virtual FNetworkPredictionData_Client* GetPredictionData_Client() const override;
	virtual void UpdateCharacterStateBeforeMovement(float DeltaSeconds) override;
	virtual void PhysCustom(float DeltaTime, int32 Iterations) override;
	virtual bool IsInWater() const override;
	virtual float ImmersionDepth() const override;
	virtual bool CanAttemptJump() const override;
	virtual bool CanCrouchInCurrentState() const override;

	void SetWantsToSprint(bool bWants) { bWantsToSprint = bWants; }
	void RequestParachute(bool bWants) { bWantsParachute = bWants; }
	void StartSkydive();
	void LaunchIntoGlide(float UpSpeed);

	UFUNCTION(BlueprintPure) bool IsSprinting() const;
	UFUNCTION(BlueprintPure) bool IsSliding() const { return bIsSliding; }
	UFUNCTION(BlueprintPure) bool IsSkydiving() const { return MovementMode == MOVE_Custom && CustomMovementMode == uint8(EBRCustomMovement::Skydive); }
	UFUNCTION(BlueprintPure) bool IsParachuting() const { return MovementMode == MOVE_Custom && CustomMovementMode == uint8(EBRCustomMovement::Parachute); }
	UFUNCTION(BlueprintPure) bool IsInAirborneCustomMode() const { return IsSkydiving() || IsParachuting(); }
	bool WantsToSprint() const { return bWantsToSprint; }

	UPROPERTY(EditAnywhere, Category = "BR|Speeds") float RunSpeed = 450.f;
	UPROPERTY(EditAnywhere, Category = "BR|Speeds") float SprintSpeed = 650.f;
	UPROPERTY(EditAnywhere, Category = "BR|Speeds") float AimSpeed = 300.f;
	UPROPERTY(EditAnywhere, Category = "BR|Speeds") float DownedSpeed = 140.f;
	UPROPERTY(EditAnywhere, Category = "BR|Slide") float SlideEnterSpeed = 520.f;
	UPROPERTY(EditAnywhere, Category = "BR|Slide") float SlideExitSpeed = 280.f;
	UPROPERTY(EditAnywhere, Category = "BR|Slide") float SlideImpulse = 380.f;
	UPROPERTY(EditAnywhere, Category = "BR|Slide") float SlideFriction = 0.35f;
	UPROPERTY(EditAnywhere, Category = "BR|Slide") float SlideBraking = 380.f;
	UPROPERTY(EditAnywhere, Category = "BR|Skydive") float SkydiveFallSpeed = 3400.f;
	UPROPERTY(EditAnywhere, Category = "BR|Skydive") float SkydiveDiveFallSpeed = 5200.f;
	UPROPERTY(EditAnywhere, Category = "BR|Skydive") float SkydiveHorizontalSpeed = 1700.f;
	UPROPERTY(EditAnywhere, Category = "BR|Skydive") float ParachuteFallSpeed = 650.f;
	UPROPERTY(EditAnywhere, Category = "BR|Skydive") float ParachuteHorizontalSpeed = 1300.f;
	UPROPERTY(EditAnywhere, Category = "BR|Skydive") float AutoDeployHeight = 5000.f;
	UPROPERTY(EditAnywhere, Category = "BR|Skydive") float MinManualDeployHeight = 1500.f;

private:
	void PhysAirborne(float DeltaTime, int32 Iterations, bool bParachute);
	float HeightAboveGround(float MaxTrace) const;
	ABRCharacter* GetBROwner() const;

	bool bWantsToSprint = false;
	bool bWantsParachute = false;
	bool bIsSliding = false;
	bool bPendingGlide = false;
	float SavedGroundFriction = 8.f;
};

class FSavedMove_BR : public FSavedMove_Character
{
public:
	typedef FSavedMove_Character Super;

	virtual void Clear() override;
	virtual uint8 GetCompressedFlags() const override;
	virtual bool CanCombineWith(const FSavedMovePtr& NewMove, ACharacter* InCharacter, float MaxDelta) const override;
	virtual void SetMoveFor(ACharacter* C, float InDeltaTime, FVector const& NewAccel, FNetworkPredictionData_Client_Character& ClientData) override;
	virtual void PrepMoveFor(ACharacter* C) override;

	uint8 bSavedWantsToSprint : 1;
	uint8 bSavedWantsParachute : 1;
};

class FNetworkPredictionData_Client_BR : public FNetworkPredictionData_Client_Character
{
public:
	typedef FNetworkPredictionData_Client_Character Super;
	explicit FNetworkPredictionData_Client_BR(const UCharacterMovementComponent& ClientMovement) : Super(ClientMovement) {}
	virtual FSavedMovePtr AllocateNewMove() override { return FSavedMovePtr(new FSavedMove_BR()); }
};
