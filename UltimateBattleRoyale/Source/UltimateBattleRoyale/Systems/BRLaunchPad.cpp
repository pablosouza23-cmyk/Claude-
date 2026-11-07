#include "Systems/BRLaunchPad.h"

#include "Audio/BRProceduralAudio.h"
#include "Characters/BRCharacter.h"
#include "Components/BoxComponent.h"
#include "Core/BRVisuals.h"

ABRLaunchPad::ABRLaunchPad()
{
	bReplicates = true;
	Trigger = CreateDefaultSubobject<UBoxComponent>(TEXT("Trigger"));
	Trigger->InitBoxExtent(FVector(90.f, 90.f, 40.f));
	Trigger->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	Trigger->SetCollisionResponseToAllChannels(ECR_Ignore);
	Trigger->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
	Trigger->SetCollisionResponseToChannel(ECC_GameTraceChannel1, ECR_Block);
	RootComponent = Trigger;
}

void ABRLaunchPad::BeginPlay()
{
	Super::BeginPlay();
	// Overlaps fire on the server and on the owning client, so the launch is predicted.
	Trigger->OnComponentBeginOverlap.AddDynamic(this, &ABRLaunchPad::OnOverlap);
	if (GetNetMode() != NM_DedicatedServer)
	{
		BRVisuals::AddPart(this, Trigger, BRVisuals::Cylinder(), FVector(0, 0, -30), FVector(170, 170, 16), FRotator::ZeroRotator, FLinearColor(0.15f, 0.15f, 0.2f), false);
		BRVisuals::AddPart(this, Trigger, BRVisuals::Cylinder(), FVector(0, 0, -20), FVector(130, 130, 6), FRotator::ZeroRotator, FLinearColor(0.7f, 0.3f, 1.f), false);
		BRVisuals::AddPart(this, Trigger, BRVisuals::Cone(), FVector(0, 0, -5), FVector(50, 50, 24), FRotator::ZeroRotator, FLinearColor(1.f, 0.9f, 0.2f), false);
	}
}

void ABRLaunchPad::OnOverlap(UPrimitiveComponent* OverlappedComp, AActor* Other, UPrimitiveComponent* OtherComp, int32 BodyIndex, bool bFromSweep, const FHitResult& Sweep)
{
	ABRCharacter* C = Cast<ABRCharacter>(Other);
	if (!C || !C->IsAliveAndWell() || C->IsInVehicle()) { return; }
	if (!HasAuthority() && !C->IsLocallyControlled()) { return; }
	const float Now = GetWorld()->GetTimeSeconds();
	if (const float* Last = Cooldowns.Find(C); Last && Now - *Last < 2.f) { return; }
	Cooldowns.Add(C, Now);
	C->LaunchToSky(3200.f);
	UBRProceduralAudio::PlaySfx(this, EBRSfx::LaunchPad, GetActorLocation());
}

float ABRLaunchPad::TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	if (!HasAuthority()) { return 0.f; }
	Health -= Damage;
	if (Health <= 0.f) { Destroy(); }
	return Damage;
}
