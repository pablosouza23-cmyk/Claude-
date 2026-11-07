#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Core/BRTypes.h"
#include "BRAnimInstance.generated.h"

class ABRCharacter;

// Parent class for the character Anim Blueprint (when an authored skeletal mesh is used).
// Exposes every gameplay state the AnimGraph needs (locomotion blend spaces, aim offsets,
// skydive/parachute/swim states, foot IK offsets) so the ABP contains no gameplay logic.
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRAnimInstance : public UAnimInstance
{
	GENERATED_BODY()

public:
	virtual void NativeInitializeAnimation() override;
	virtual void NativeUpdateAnimation(float DeltaSeconds) override;

	UPROPERTY(BlueprintReadOnly, Category = "Locomotion") float Speed = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Locomotion") float Direction = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Locomotion") float VerticalSpeed = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Locomotion") float LeanAngle = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Locomotion") bool bIsInAir = false;
	UPROPERTY(BlueprintReadOnly, Category = "Locomotion") bool bIsCrouching = false;
	UPROPERTY(BlueprintReadOnly, Category = "Locomotion") bool bIsSprinting = false;
	UPROPERTY(BlueprintReadOnly, Category = "Locomotion") bool bIsSliding = false;
	UPROPERTY(BlueprintReadOnly, Category = "Locomotion") bool bIsSwimming = false;
	UPROPERTY(BlueprintReadOnly, Category = "Locomotion") bool bIsSkydiving = false;
	UPROPERTY(BlueprintReadOnly, Category = "Locomotion") bool bIsParachuting = false;
	UPROPERTY(BlueprintReadOnly, Category = "Locomotion") bool bIsInVehicle = false;
	UPROPERTY(BlueprintReadOnly, Category = "State") bool bIsDowned = false;
	UPROPERTY(BlueprintReadOnly, Category = "State") bool bIsEliminated = false;
	UPROPERTY(BlueprintReadOnly, Category = "Combat") bool bIsAiming = false;
	UPROPERTY(BlueprintReadOnly, Category = "Combat") bool bHasWeapon = false;
	UPROPERTY(BlueprintReadOnly, Category = "Combat") bool bIsReloading = false;
	UPROPERTY(BlueprintReadOnly, Category = "Combat") bool bIsHarvesting = false;
	UPROPERTY(BlueprintReadOnly, Category = "Combat") bool bIsBuilding = false;
	UPROPERTY(BlueprintReadOnly, Category = "Combat") EBRWeaponCategory WeaponCategory = EBRWeaponCategory::AssaultRifle;
	UPROPERTY(BlueprintReadOnly, Category = "Combat") float AimPitch = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Combat") float AimYaw = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Emote") FName ActiveEmote;
	// Foot IK (feed into Two Bone IK / Leg IK nodes).
	UPROPERTY(BlueprintReadOnly, Category = "IK") float FootOffsetLeft = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "IK") float FootOffsetRight = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "IK") float PelvisOffset = 0.f;

	UPROPERTY(EditDefaultsOnly, Category = "IK") FName LeftFootBone = TEXT("foot_l");
	UPROPERTY(EditDefaultsOnly, Category = "IK") FName RightFootBone = TEXT("foot_r");

private:
	float TraceFootOffset(FName Bone) const;

	TWeakObjectPtr<ABRCharacter> Character;
	FRotator LastRotation = FRotator::ZeroRotator;
};
