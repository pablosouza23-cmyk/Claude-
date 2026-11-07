#include "Characters/BRAnimInstance.h"

#include "Building/BRBuildComponent.h"
#include "Characters/BRCharacter.h"
#include "Characters/BRCharacterMovementComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Weapons/BRWeapon.h"

void UBRAnimInstance::NativeInitializeAnimation()
{
	Super::NativeInitializeAnimation();
	Character = Cast<ABRCharacter>(TryGetPawnOwner());
}

void UBRAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
	Super::NativeUpdateAnimation(DeltaSeconds);
	ABRCharacter* C = Character.Get();
	if (!C) { Character = Cast<ABRCharacter>(TryGetPawnOwner()); return; }

	const UBRCharacterMovementComponent* Move = C->GetBRMovement();
	const FVector Vel = C->GetVelocity();
	Speed = Vel.Size2D();
	VerticalSpeed = Vel.Z;

	const FRotator ActorRot = C->GetActorRotation();
	if (Speed > 3.f)
	{
		const FVector Local = ActorRot.UnrotateVector(Vel.GetSafeNormal2D());
		Direction = FMath::RadiansToDegrees(FMath::Atan2(Local.Y, Local.X));
	}
	const float YawDelta = FRotator::NormalizeAxis(ActorRot.Yaw - LastRotation.Yaw);
	LeanAngle = FMath::FInterpTo(LeanAngle, FMath::Clamp(YawDelta / FMath::Max(DeltaSeconds, 0.001f) * 0.05f, -15.f, 15.f), DeltaSeconds, 6.f);
	LastRotation = ActorRot;

	bIsSkydiving = Move->IsSkydiving();
	bIsParachuting = Move->IsParachuting();
	bIsSwimming = Move->IsSwimming();
	bIsInAir = Move->IsFalling();
	bIsCrouching = Move->IsCrouching();
	bIsSprinting = Move->IsSprinting();
	bIsSliding = Move->IsSliding();
	bIsInVehicle = C->IsInVehicle();
	bIsDowned = C->IsDowned();
	bIsEliminated = C->IsEliminated();
	bIsAiming = C->IsAiming();
	bIsHarvesting = C->IsHarvesting();
	bIsBuilding = C->GetBuild() && (C->GetBuild()->IsBuildMode() || C->GetBuild()->IsEditMode());
	ActiveEmote = C->GetActiveEmote();

	const ABRWeapon* W = C->GetCurrentWeapon();
	bHasWeapon = W != nullptr;
	bIsReloading = W && W->IsReloading();
	if (W && W->GetDefinition()) { WeaponCategory = W->GetDefinition()->Category; }

	const FRotator Aim = (C->GetBaseAimRotation() - ActorRot).GetNormalized();
	AimPitch = Aim.Pitch;
	AimYaw = Aim.Yaw;

	// Foot IK only when standing on the ground and close to the camera (cheap on mobile).
	if (!bIsInAir && !bIsSwimming && !bIsInVehicle && Speed < 10.f && C->WasRecentlyRendered(0.2f))
	{
		const float L = TraceFootOffset(LeftFootBone);
		const float R = TraceFootOffset(RightFootBone);
		PelvisOffset = FMath::FInterpTo(PelvisOffset, FMath::Min(0.f, FMath::Min(L, R)), DeltaSeconds, 12.f);
		FootOffsetLeft = FMath::FInterpTo(FootOffsetLeft, L - PelvisOffset, DeltaSeconds, 15.f);
		FootOffsetRight = FMath::FInterpTo(FootOffsetRight, R - PelvisOffset, DeltaSeconds, 15.f);
	}
	else
	{
		PelvisOffset = FMath::FInterpTo(PelvisOffset, 0.f, DeltaSeconds, 12.f);
		FootOffsetLeft = FMath::FInterpTo(FootOffsetLeft, 0.f, DeltaSeconds, 15.f);
		FootOffsetRight = FMath::FInterpTo(FootOffsetRight, 0.f, DeltaSeconds, 15.f);
	}
}

float UBRAnimInstance::TraceFootOffset(FName Bone) const
{
	const USkeletalMeshComponent* Mesh = GetSkelMeshComponent();
	if (!Mesh || Mesh->GetBoneIndex(Bone) == INDEX_NONE) { return 0.f; }
	const FVector Foot = Mesh->GetSocketLocation(Bone);
	const float RootZ = Mesh->GetComponentLocation().Z;
	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(BRFootIK), false, Mesh->GetOwner());
	const FVector Start(Foot.X, Foot.Y, RootZ + 50.f);
	const FVector End(Foot.X, Foot.Y, RootZ - 75.f);
	if (Mesh->GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params))
	{
		return FMath::Clamp(Hit.ImpactPoint.Z - RootZ, -45.f, 45.f);
	}
	return 0.f;
}
