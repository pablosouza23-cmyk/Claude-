#include "Systems/BRTargetDummy.h"

#include "Core/BRVisuals.h"
#include "GameModes/BRPlayerController.h"
#include "Net/UnrealNetwork.h"
#include "Weapons/BRDamageTypes.h"

ABRTargetDummy::ABRTargetDummy()
{
	PrimaryActorTick.bCanEverTick = true;
	bReplicates = true;
	SetReplicatingMovement(true);
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
	Body = CreateDefaultSubobject<USceneComponent>(TEXT("Body"));
	Body->SetupAttachment(Root);
}

void ABRTargetDummy::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRTargetDummy, bDown);
	DOREPLIFETIME(ABRTargetDummy, StrafeAmplitude);
}

void ABRTargetDummy::BeginPlay()
{
	Super::BeginPlay();
	Origin = GetActorLocation();
	BRVisuals::AddPart(this, Root, BRVisuals::Cylinder(), FVector(0, 0, 5), FVector(80, 80, 10), FRotator::ZeroRotator, FLinearColor(0.2f, 0.2f, 0.2f), true);
	BRVisuals::AddPart(this, Body, BRVisuals::Cube(), FVector(0, 0, 95), FVector(30, 55, 110), FRotator::ZeroRotator, FLinearColor(0.85f, 0.85f, 0.8f), true);
	BRVisuals::AddPart(this, Body, BRVisuals::Sphere(), FVector(0, 0, 175), FVector(32, 32, 34), FRotator::ZeroRotator, FLinearColor(0.95f, 0.3f, 0.25f), true);
	BRVisuals::AddPart(this, Body, BRVisuals::Cylinder(), FVector(16, 0, 110), FVector(26, 26, 2), FRotator(90, 0, 0), FLinearColor(0.95f, 0.3f, 0.25f), false);
}

void ABRTargetDummy::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Body->SetRelativeRotation(FMath::RInterpTo(Body->GetRelativeRotation(), FRotator(bDown ? -85.f : 0.f, 0.f, 0.f), DeltaSeconds, 10.f));
	if (!HasAuthority()) { return; }
	if (StrafeAmplitude > 0.f && !bDown)
	{
		Phase += DeltaSeconds;
		SetActorLocation(Origin + GetActorRightVector() * FMath::Sin(Phase * 1.3f) * StrafeAmplitude);
	}
	if (bDown && GetWorld()->GetTimeSeconds() - DownTime > 3.f) { bDown = false; Health = 200.f; }
}

float ABRTargetDummy::TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	if (!HasAuthority() || bDown) { return 0.f; }
	const UBRDamageType* DT = DamageEvent.DamageTypeClass ? Cast<UBRDamageType>(DamageEvent.DamageTypeClass->GetDefaultObject()) : nullptr;
	const bool bHead = DT && DT->bHeadshot;
	Health -= Damage;
	if (Health <= 0.f) { bDown = true; DownTime = GetWorld()->GetTimeSeconds(); }
	if (ABRPlayerController* PC = Cast<ABRPlayerController>(EventInstigator))
	{
		PC->ClientConfirmHit(GetActorLocation() + FVector(0, 0, bHead ? 175.f : 100.f), Damage, bHead, false, bDown);
	}
	return Damage;
}
