#include "AI/BRBTNodes.h"

#include "AI/BRAIController.h"
#include "BehaviorTree/BlackboardComponent.h"
#include "BehaviorTree/BehaviorTreeComponent.h"
#include "Characters/BRCharacter.h"
#include "EnvironmentQuery/Items/EnvQueryItemType_VectorBase.h"
#include "GameModes/BRGameState.h"
#include "Systems/BRStormController.h"

namespace
{
	ABRAIController* Bot(UBehaviorTreeComponent& C) { return Cast<ABRAIController>(C.GetAIOwner()); }
	const FName KeyTarget(TEXT("TargetActor"));
	const FName KeyGoal(TEXT("MoveGoal"));
	const FName KeyHasTarget(TEXT("HasTarget"));
	const FName KeyInStorm(TEXT("InStorm"));
}

UBTService_BRUpdateKnowledge::UBTService_BRUpdateKnowledge()
{
	NodeName = TEXT("BR Update Knowledge");
	Interval = 0.3f;
	RandomDeviation = 0.1f;
}

void UBTService_BRUpdateKnowledge::TickNode(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory, float DeltaSeconds)
{
	Super::TickNode(OwnerComp, NodeMemory, DeltaSeconds);
	ABRAIController* B = Bot(OwnerComp);
	UBlackboardComponent* BB = OwnerComp.GetBlackboardComponent();
	if (!B || !BB) { return; }
	ABRCharacter* T = B->FindBestTarget();
	BB->SetValueAsObject(KeyTarget, T);
	BB->SetValueAsBool(KeyHasTarget, T != nullptr);
	BB->SetValueAsBool(KeyInStorm, B->IsOutsideSafeZone(-500.f));
}

EBTNodeResult::Type UBTTask_BRFindLoot::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory)
{
	ABRAIController* B = Bot(OwnerComp);
	FVector Loc; AActor* Actor = nullptr;
	if (!B || !B->FindLoot(Loc, Actor)) { return EBTNodeResult::Failed; }
	OwnerComp.GetBlackboardComponent()->SetValueAsVector(KeyGoal, Loc);
	OwnerComp.GetBlackboardComponent()->SetValueAsObject(KeyTarget, Actor);
	return EBTNodeResult::Succeeded;
}

UBTTask_BRMoveToGoal::UBTTask_BRMoveToGoal() { bNotifyTick = true; }

EBTNodeResult::Type UBTTask_BRMoveToGoal::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory)
{
	ABRAIController* B = Bot(OwnerComp);
	if (!B) { return EBTNodeResult::Failed; }
	B->MoveTowards(OwnerComp.GetBlackboardComponent()->GetValueAsVector(KeyGoal), AcceptRadius);
	return EBTNodeResult::InProgress;
}

void UBTTask_BRMoveToGoal::TickTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory, float DeltaSeconds)
{
	ABRAIController* B = Bot(OwnerComp);
	if (!B) { FinishLatentTask(OwnerComp, EBTNodeResult::Failed); return; }
	if (B->HasArrived(AcceptRadius)) { FinishLatentTask(OwnerComp, EBTNodeResult::Succeeded); }
}

UBTTask_BREngage::UBTTask_BREngage() { bNotifyTick = true; }

EBTNodeResult::Type UBTTask_BREngage::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory)
{
	*reinterpret_cast<float*>(NodeMemory) = 0.f;
	return Cast<ABRCharacter>(OwnerComp.GetBlackboardComponent()->GetValueAsObject(KeyTarget)) ? EBTNodeResult::InProgress : EBTNodeResult::Failed;
}

void UBTTask_BREngage::TickTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory, float DeltaSeconds)
{
	float& Elapsed = *reinterpret_cast<float*>(NodeMemory);
	Elapsed += DeltaSeconds;
	ABRAIController* B = Bot(OwnerComp);
	ABRCharacter* T = Cast<ABRCharacter>(OwnerComp.GetBlackboardComponent()->GetValueAsObject(KeyTarget));
	if (!B || !T || T->IsEliminated() || Elapsed > Duration)
	{
		if (B) { B->StopEngaging(); }
		FinishLatentTask(OwnerComp, (T && !T->IsEliminated()) ? EBTNodeResult::Succeeded : EBTNodeResult::Failed);
		return;
	}
	B->EngageTarget(T, DeltaSeconds);
}

EBTNodeResult::Type UBTTask_BRInteract::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory)
{
	ABRAIController* B = Bot(OwnerComp);
	AActor* T = Cast<AActor>(OwnerComp.GetBlackboardComponent()->GetValueAsObject(KeyTarget));
	if (!B || !T) { return EBTNodeResult::Failed; }
	B->BeginInteractWith(T);
	return EBTNodeResult::Succeeded;
}

EBTNodeResult::Type UBTTask_BRHeal::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory)
{
	ABRAIController* B = Bot(OwnerComp);
	return (B && B->TryHeal()) ? EBTNodeResult::Succeeded : EBTNodeResult::Failed;
}

EBTNodeResult::Type UBTTask_BRBuildCover::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory)
{
	ABRAIController* B = Bot(OwnerComp);
	const AActor* T = Cast<AActor>(OwnerComp.GetBlackboardComponent()->GetValueAsObject(KeyTarget));
	return (B && T && B->TryBuildCover(T->GetActorLocation())) ? EBTNodeResult::Succeeded : EBTNodeResult::Failed;
}

EBTNodeResult::Type UBTTask_BRSafeZoneGoal::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory)
{
	ABRAIController* B = Bot(OwnerComp);
	FVector Dest;
	if (!B || !B->GetSafeDestination(Dest)) { return EBTNodeResult::Failed; }
	OwnerComp.GetBlackboardComponent()->SetValueAsVector(KeyGoal, Dest);
	return EBTNodeResult::Succeeded;
}

bool UBTDecorator_BROutsideSafeZone::CalculateRawConditionValue(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) const
{
	const ABRAIController* B = Cast<ABRAIController>(OwnerComp.GetAIOwner());
	return B && B->IsOutsideSafeZone(-Margin);
}

UEnvQueryTest_BRSafeZone::UEnvQueryTest_BRSafeZone()
{
	ValidItemType = UEnvQueryItemType_VectorBase::StaticClass();
	Cost = EEnvTestCost::Low;
	SetWorkOnFloatValues(true);
}

void UEnvQueryTest_BRSafeZone::RunTest(FEnvQueryInstance& QueryInstance) const
{
	const UObject* Owner = QueryInstance.Owner.Get();
	const UWorld* World = Owner ? Owner->GetWorld() : nullptr;
	const ABRGameState* GS = World ? World->GetGameState<ABRGameState>() : nullptr;
	const ABRStormController* Storm = GS ? GS->GetStorm() : nullptr;
	FVector2D C = FVector2D::ZeroVector; float R = 1e9f;
	if (Storm && Storm->GetState().bActive) { Storm->GetNextCircle(C, R); }
	FloatValueMin.BindData(Owner, QueryInstance.QueryID);
	FloatValueMax.BindData(Owner, QueryInstance.QueryID);
	const float Min = FloatValueMin.GetValue(), Max = FloatValueMax.GetValue();
	for (FEnvQueryInstance::ItemIterator It(this, QueryInstance); It; ++It)
	{
		const FVector P = GetItemLocation(QueryInstance, It.GetIndex());
		// 1 at the centre, 0 at the edge, negative outside.
		const float Depth = R > 0.f ? 1.f - FVector2D::Distance(FVector2D(P), C) / R : 0.f;
		It.SetScore(TestPurpose, FilterType, Depth, Min, Max);
	}
}
