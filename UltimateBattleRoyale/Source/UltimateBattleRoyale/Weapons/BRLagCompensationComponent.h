#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "BRLagCompensationComponent.generated.h"

// Server-side history of the owner's capsule, used to validate client hit claims
// against where the target actually was on the shooter's screen (bounded rewind).
UCLASS(ClassGroup = (BR))
class ULTIMATEBATTLEROYALE_API UBRLagCompensationComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UBRLagCompensationComponent();
	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	// Returns capsule centre/half-height at a server time (clamped to MaxRewindSeconds).
	bool GetCapsuleAt(double ServerTime, FVector& OutCenter, float& OutHalfHeight, float& OutRadius) const;

	UPROPERTY(EditAnywhere) float MaxRewindSeconds = 0.4f;

private:
	struct FSample { double Time; FVector Center; float HalfHeight; };
	TArray<FSample> History;
	int32 Head = 0;
	static constexpr int32 Capacity = 48;
};
