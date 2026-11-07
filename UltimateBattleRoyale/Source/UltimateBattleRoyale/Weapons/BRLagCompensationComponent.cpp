#include "Weapons/BRLagCompensationComponent.h"

#include "Components/CapsuleComponent.h"
#include "GameFramework/Character.h"

UBRLagCompensationComponent::UBRLagCompensationComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickGroup = TG_PostPhysics;
}

void UBRLagCompensationComponent::BeginPlay()
{
	Super::BeginPlay();
	// Only the server needs history.
	SetComponentTickEnabled(GetOwnerRole() == ROLE_Authority);
	History.Reserve(Capacity);
}

void UBRLagCompensationComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	const ACharacter* C = Cast<ACharacter>(GetOwner());
	if (!C) { return; }
	FSample S{ GetWorld()->GetTimeSeconds(), C->GetActorLocation(), C->GetCapsuleComponent()->GetScaledCapsuleHalfHeight() };
	if (History.Num() < Capacity) { History.Add(S); Head = History.Num() - 1; }
	else { Head = (Head + 1) % Capacity; History[Head] = S; }
}

bool UBRLagCompensationComponent::GetCapsuleAt(double ServerTime, FVector& OutCenter, float& OutHalfHeight, float& OutRadius) const
{
	const ACharacter* C = Cast<ACharacter>(GetOwner());
	if (!C) { return false; }
	OutRadius = C->GetCapsuleComponent()->GetScaledCapsuleRadius();
	const double Now = GetWorld()->GetTimeSeconds();
	ServerTime = FMath::Clamp(ServerTime, Now - MaxRewindSeconds, Now);
	if (History.Num() == 0)
	{
		OutCenter = C->GetActorLocation();
		OutHalfHeight = C->GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
		return true;
	}
	// Walk back from newest to find the bracketing samples.
	const int32 N = History.Num();
	const FSample* Newer = &History[Head];
	if (ServerTime >= Newer->Time) { OutCenter = C->GetActorLocation(); OutHalfHeight = Newer->HalfHeight; return true; }
	for (int32 I = 1; I < N; ++I)
	{
		const FSample* Older = &History[(Head - I + N) % N];
		if (Older->Time <= ServerTime)
		{
			const double Span = FMath::Max(1e-4, Newer->Time - Older->Time);
			const float Alpha = float((ServerTime - Older->Time) / Span);
			OutCenter = FMath::Lerp(Older->Center, Newer->Center, Alpha);
			OutHalfHeight = FMath::Lerp(Older->HalfHeight, Newer->HalfHeight, Alpha);
			return true;
		}
		Newer = Older;
	}
	OutCenter = Newer->Center;
	OutHalfHeight = Newer->HalfHeight;
	return true;
}
