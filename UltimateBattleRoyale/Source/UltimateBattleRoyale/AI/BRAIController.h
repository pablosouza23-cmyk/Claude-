#pragma once

#include "CoreMinimal.h"
#include "AIController.h"
#include "Perception/AIPerceptionTypes.h"
#include "BRAIController.generated.h"

class UAISenseConfig_Sight;
class UAISenseConfig_Hearing;
class UAISenseConfig_Damage;
class ABRCharacter;

UENUM(BlueprintType)
enum class EBRBotState : uint8 { Idle, Skydiving, Looting, Fighting, Retreating, Healing, Reviving, Rotating, Exploring, Downed };

// Bot for training/opt-in modes. Uses AI Perception (sight, hearing, damage), runs an authored
// Behavior Tree when one is configured (nodes in BRBTNodes.h), otherwise a built-in utility brain
// with the same actions. Think rate scales with distance to the nearest human (AI LOD).
// Bots use exactly the same character, inventory, weapons and server validation as players.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRAIController : public AAIController
{
	GENERATED_BODY()

public:
	ABRAIController();

	virtual void OnPossess(APawn* InPawn) override;
	virtual void OnUnPossess() override;
	virtual void Tick(float DeltaSeconds) override;

	// ---- Actions shared by the utility brain and the BT tasks.
	ABRCharacter* GetBRCharacter() const;
	ABRCharacter* FindBestTarget() const;
	bool FindLoot(FVector& OutLocation, AActor*& OutActor) const;
	bool FindDownedTeammate(ABRCharacter*& Out) const;
	bool GetSafeDestination(FVector& Out) const;
	bool IsOutsideSafeZone(float Margin = 0.f) const;
	void MoveTowards(const FVector& Goal, float AcceptRadius = 120.f);
	bool HasArrived(float AcceptRadius = 150.f) const;
	void EngageTarget(ABRCharacter* Target, float DeltaSeconds);
	void StopEngaging();
	bool TryHeal();
	bool TryBuildCover(const FVector& ThreatLocation);
	void EquipBestWeapon();
	void BeginInteractWith(AActor* Target);
	void UpdateInteract(float DeltaSeconds);

	EBRBotState GetBotState() const { return State; }

	UPROPERTY(EditAnywhere, Category = "Bot") float Skill = 0.5f; // 0 = easy, 1 = hard

protected:
	UFUNCTION() void OnPerceptionUpdated(AActor* Actor, FAIStimulus Stimulus);

private:
	void Think(float DeltaSeconds);
	void SteerDirect(float DeltaSeconds);
	float DistanceToNearestHuman() const;

	UPROPERTY(VisibleAnywhere) TObjectPtr<UAISenseConfig_Sight> SightConfig;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UAISenseConfig_Hearing> HearingConfig;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UAISenseConfig_Damage> DamageConfig;

	EBRBotState State = EBRBotState::Idle;
	bool bUsingBehaviorTree = false;
	float ThinkTimer = 0.f;
	float ThinkInterval = 0.2f;

	FVector Goal = FVector::ZeroVector;
	bool bHasGoal = false;
	bool bDirectSteer = false;
	float StuckTime = 0.f;
	FVector LastPos = FVector::ZeroVector;

	TWeakObjectPtr<ABRCharacter> Target;
	TWeakObjectPtr<AActor> InteractTarget;
	float InteractTime = 0.f;
	FVector LastThreatLocation = FVector::ZeroVector;
	float LastThreatTime = -100.f;
	float LastBuildTime = -100.f;
	float FireBurstTime = 0.f;
	float StrafeSign = 1.f;
	float StrafeTimer = 0.f;
	FVector2D AimError = FVector2D::ZeroVector;
	FVector LandingTarget = FVector::ZeroVector;
	bool bHasLandingTarget = false;
	float LootSearchCooldown = 0.f;
	TWeakObjectPtr<AActor> CachedLoot;
};
