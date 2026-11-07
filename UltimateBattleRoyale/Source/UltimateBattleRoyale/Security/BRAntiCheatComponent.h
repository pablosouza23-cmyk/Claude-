#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Rules/BRSecurityRules.h"
#include "BRAntiCheatComponent.generated.h"

UENUM()
enum class EBRRpcBucket : uint8 { Fire, Build, Interact, Inventory, Chat, Report, Ping, Count };

// Server-side guard attached to each player controller:
// - movement plausibility (speed / teleport) on top of the engine's movement checks,
// - per-RPC token buckets (fire, build, interact, inventory, chat, reports, pings),
// - suspicion score with correction and kick thresholds, every flag written to the match log.
UCLASS(ClassGroup = (BR))
class ULTIMATEBATTLEROYALE_API UBRAntiCheatComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UBRAntiCheatComponent();
	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	bool ConsumeToken(EBRRpcBucket Bucket);
	void Flag(const FString& Reason, float Weight);
	void NotifyTeleport();
	float GetSuspicion() const { return Suspicion; }

private:
	APawn* GetPawn() const;
	void Kick(const FString& Reason);

	BRRules::TokenBucket Buckets[int32(EBRRpcBucket::Count)];
	FVector LastValidLocation = FVector::ZeroVector;
	bool bHasLast = false;
	double Suspicion = 0.0;
	float GraceUntil = 0.f;
	bool bKicked = false;
};
