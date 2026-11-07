#pragma once

#include "CoreMinimal.h"
#include "BehaviorTree/BTTaskNode.h"
#include "BehaviorTree/BTService.h"
#include "BehaviorTree/BTDecorator.h"
#include "EnvironmentQuery/EnvQueryTest.h"
#include "BRBTNodes.generated.h"

// Behavior Tree building blocks for authored bot trees (Content/AI/BT_Bot). Each node calls the
// same actions as the built-in utility brain in ABRAIController.
// Blackboard keys used: TargetActor (Object), MoveGoal (Vector), HasTarget (Bool), InStorm (Bool).

UCLASS(meta = (DisplayName = "BR: Update Bot Knowledge"))
class ULTIMATEBATTLEROYALE_API UBTService_BRUpdateKnowledge : public UBTService
{
	GENERATED_BODY()
public:
	UBTService_BRUpdateKnowledge();
protected:
	virtual void TickNode(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory, float DeltaSeconds) override;
};

UCLASS(meta = (DisplayName = "BR: Find Loot"))
class ULTIMATEBATTLEROYALE_API UBTTask_BRFindLoot : public UBTTaskNode
{
	GENERATED_BODY()
protected:
	virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
};

UCLASS(meta = (DisplayName = "BR: Move To Goal (nav or direct)"))
class ULTIMATEBATTLEROYALE_API UBTTask_BRMoveToGoal : public UBTTaskNode
{
	GENERATED_BODY()
public:
	UBTTask_BRMoveToGoal();
	UPROPERTY(EditAnywhere) float AcceptRadius = 150.f;
protected:
	virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
	virtual void TickTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory, float DeltaSeconds) override;
};

UCLASS(meta = (DisplayName = "BR: Engage Target"))
class ULTIMATEBATTLEROYALE_API UBTTask_BREngage : public UBTTaskNode
{
	GENERATED_BODY()
public:
	UBTTask_BREngage();
	UPROPERTY(EditAnywhere) float Duration = 2.f;
protected:
	virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
	virtual void TickTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory, float DeltaSeconds) override;
	virtual uint16 GetInstanceMemorySize() const override { return sizeof(float); }
};

UCLASS(meta = (DisplayName = "BR: Interact With Target"))
class ULTIMATEBATTLEROYALE_API UBTTask_BRInteract : public UBTTaskNode
{
	GENERATED_BODY()
protected:
	virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
};

UCLASS(meta = (DisplayName = "BR: Heal"))
class ULTIMATEBATTLEROYALE_API UBTTask_BRHeal : public UBTTaskNode
{
	GENERATED_BODY()
protected:
	virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
};

UCLASS(meta = (DisplayName = "BR: Build Cover"))
class ULTIMATEBATTLEROYALE_API UBTTask_BRBuildCover : public UBTTaskNode
{
	GENERATED_BODY()
protected:
	virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
};

UCLASS(meta = (DisplayName = "BR: Set Safe Zone Goal"))
class ULTIMATEBATTLEROYALE_API UBTTask_BRSafeZoneGoal : public UBTTaskNode
{
	GENERATED_BODY()
protected:
	virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
};

UCLASS(meta = (DisplayName = "BR: Is Outside Safe Zone"))
class ULTIMATEBATTLEROYALE_API UBTDecorator_BROutsideSafeZone : public UBTDecorator
{
	GENERATED_BODY()
public:
	UPROPERTY(EditAnywhere) float Margin = 500.f;
protected:
	virtual bool CalculateRawConditionValue(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) const override;
};

// EQS test: scores points by how deep they are inside the next safe circle (filters storm points).
UCLASS(meta = (DisplayName = "BR: Inside Safe Zone"))
class ULTIMATEBATTLEROYALE_API UEnvQueryTest_BRSafeZone : public UEnvQueryTest
{
	GENERATED_BODY()
public:
	UEnvQueryTest_BRSafeZone();
protected:
	virtual void RunTest(FEnvQueryInstance& QueryInstance) const override;
};
