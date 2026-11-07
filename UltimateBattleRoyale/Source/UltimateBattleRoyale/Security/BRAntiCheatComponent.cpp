#include "Security/BRAntiCheatComponent.h"

#include "Characters/BRCharacter.h"
#include "Characters/BRCharacterMovementComponent.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/GameSession.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerState.h"
#include "Systems/BRMatchLogger.h"
#include "UltimateBattleRoyale.h"

UBRAntiCheatComponent::UBRAntiCheatComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.1f;
	// Capacity / refill per second, tuned above legitimate peaks (fastest SMG = 15 shots/s).
	Buckets[int32(EBRRpcBucket::Fire)] = BRRules::TokenBucket(20.0, 18.0);
	Buckets[int32(EBRRpcBucket::Build)] = BRRules::TokenBucket(12.0, 10.0);
	Buckets[int32(EBRRpcBucket::Interact)] = BRRules::TokenBucket(8.0, 5.0);
	Buckets[int32(EBRRpcBucket::Inventory)] = BRRules::TokenBucket(15.0, 10.0);
	Buckets[int32(EBRRpcBucket::Chat)] = BRRules::TokenBucket(5.0, 0.5);
	Buckets[int32(EBRRpcBucket::Report)] = BRRules::TokenBucket(3.0, 0.02);
	Buckets[int32(EBRRpcBucket::Ping)] = BRRules::TokenBucket(5.0, 1.0);
}

void UBRAntiCheatComponent::BeginPlay()
{
	Super::BeginPlay();
	SetComponentTickEnabled(GetOwnerRole() == ROLE_Authority);
}

APawn* UBRAntiCheatComponent::GetPawn() const
{
	const APlayerController* PC = Cast<APlayerController>(GetOwner());
	return PC ? PC->GetPawn() : nullptr;
}

bool UBRAntiCheatComponent::ConsumeToken(EBRRpcBucket Bucket)
{
	const int32 I = int32(Bucket);
	if (I < 0 || I >= int32(EBRRpcBucket::Count)) { return false; }
	const bool bOk = Buckets[I].Consume(GetWorld()->GetTimeSeconds());
	if (!bOk) { Flag(FString::Printf(TEXT("rpc_flood_%d"), I), 1.f); }
	return bOk;
}

void UBRAntiCheatComponent::NotifyTeleport()
{
	bHasLast = false;
	GraceUntil = GetWorld()->GetTimeSeconds() + 1.5f;
}

void UBRAntiCheatComponent::Flag(const FString& Reason, float Weight)
{
	Suspicion += Weight;
	const APlayerController* PC = Cast<APlayerController>(GetOwner());
	if (UBRMatchLogger* Log = GetWorld()->GetSubsystem<UBRMatchLogger>())
	{
		Log->LogEvent(TEXT("anticheat_flag"), {
			{ TEXT("player"), PC && PC->PlayerState ? PC->PlayerState->GetPlayerName() : TEXT("?") },
			{ TEXT("reason"), Reason },
			{ TEXT("suspicion"), FString::SanitizeFloat(Suspicion) } });
	}
	if (Suspicion >= BRRules::SuspicionKickThreshold) { Kick(Reason); }
}

void UBRAntiCheatComponent::Kick(const FString& Reason)
{
	if (bKicked) { return; }
	bKicked = true;
	APlayerController* PC = Cast<APlayerController>(GetOwner());
	UE_LOG(LogBR, Warning, TEXT("Anti-cheat: removing %s (%s)"), PC && PC->PlayerState ? *PC->PlayerState->GetPlayerName() : TEXT("?"), *Reason);
	if (AGameModeBase* GM = GetWorld()->GetAuthGameMode())
	{
		if (GM->GameSession && PC) { GM->GameSession->KickPlayer(PC, NSLOCTEXT("BR", "Kicked", "Removido pelo sistema anti-trapaça.")); }
	}
}

void UBRAntiCheatComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	Suspicion = BRRules::UpdateSuspicion(Suspicion, BRRules::MoveVerdict::Ok, DeltaTime);

	APawn* Pawn = GetPawn();
	if (!Pawn) { bHasLast = false; return; }
	const FVector Loc = Pawn->GetActorLocation();
	if (!bHasLast || GetWorld()->GetTimeSeconds() < GraceUntil)
	{
		LastValidLocation = Loc;
		bHasLast = true;
		return;
	}

	BRRules::MoveLimits Limits = BRRules::LimitsOnFoot();
	if (const ABRCharacter* C = Cast<ABRCharacter>(Pawn))
	{
		if (C->IsInVehicle()) { Limits = BRRules::LimitsVehicle(); }
		else if (C->GetBRMovement()->IsInAirborneCustomMode() || C->GetBRMovement()->IsFalling()) { Limits = BRRules::LimitsSkydiving(); }
		// Launch pads, explosions and mantles legitimately add vertical speed.
		Limits.MaxUpSpeed = 4500.0;
	}

	const BRRules::MoveVerdict V = BRRules::ValidateMove(BRTypes::ToVec3(LastValidLocation), BRTypes::ToVec3(Loc), DeltaTime, Limits);
	if (V == BRRules::MoveVerdict::Ok)
	{
		LastValidLocation = Loc;
		return;
	}
	Suspicion = BRRules::UpdateSuspicion(Suspicion, V, 0.0);
	Flag(V == BRRules::MoveVerdict::Teleport ? TEXT("teleport") : TEXT("speed"), 0.f);
	if (Suspicion >= BRRules::SuspicionCorrectThreshold)
	{
		// Snap back to the last validated position (the engine then corrects the client).
		Pawn->TeleportTo(LastValidLocation, Pawn->GetActorRotation(), false, true);
	}
}
