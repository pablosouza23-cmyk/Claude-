#include "Systems/BRBattleBus.h"

#include "Audio/BRProceduralAudio.h"
#include "Camera/CameraComponent.h"
#include "Components/AudioComponent.h"
#include "Core/BRVisuals.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/SpringArmComponent.h"
#include "Net/UnrealNetwork.h"

ABRBattleBus::ABRBattleBus()
{
	PrimaryActorTick.bCanEverTick = true;
	bReplicates = true;
	bAlwaysRelevant = true;
	SetReplicatingMovement(false);
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
	Boom = CreateDefaultSubobject<USpringArmComponent>(TEXT("Boom"));
	Boom->SetupAttachment(Root);
	Boom->TargetArmLength = 2200.f;
	Boom->bDoCollisionTest = false;
	Boom->SetRelativeRotation(FRotator(-20.f, 0.f, 0.f));
	Boom->bEnableCameraRotationLag = true;
	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(Boom);
}

void ABRBattleBus::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRBattleBus, StartPoint);
	DOREPLIFETIME(ABRBattleBus, EndPoint);
	DOREPLIFETIME(ABRBattleBus, StartTime);
	DOREPLIFETIME(ABRBattleBus, Duration);
}

void ABRBattleBus::InitFlight(const FVector& Start, const FVector& End, double StartServerTime, float DurationSeconds)
{
	StartPoint = Start;
	EndPoint = End;
	StartTime = StartServerTime;
	Duration = FMath::Max(1.f, DurationSeconds);
	SetActorLocationAndRotation(Start, (End - Start).Rotation());
}

void ABRBattleBus::BeginPlay()
{
	Super::BeginPlay();
	BuildVisual();
	EngineAudio = UBRProceduralAudio::CreateLoop(this, EBRSfx::BusEngineLoop);
	if (EngineAudio) { EngineAudio->SetVolumeMultiplier(0.5f); }
}

void ABRBattleBus::BuildVisual()
{
	if (GetNetMode() == NM_DedicatedServer) { return; }
	auto P = [this](UStaticMesh* M, FVector L, FVector S, FLinearColor C, FRotator R = FRotator::ZeroRotator)
	{
		BRVisuals::AddPart(this, Root, M, L, S, R, C, false, 0.f);
	};
	const FLinearColor Body(0.12f, 0.45f, 0.95f), Stripe(1.f, 0.82f, 0.1f), Glass(0.6f, 0.85f, 1.f), Tire(0.05f, 0.05f, 0.05f);
	P(BRVisuals::Cube(), FVector(0, 0, 0), FVector(1100, 300, 320), Body);
	P(BRVisuals::Cube(), FVector(0, 0, -40), FVector(1110, 310, 50), Stripe);
	for (int32 I = 0; I < 6; ++I) { for (int32 S : { -1, 1 }) { P(BRVisuals::Cube(), FVector(-400 + I * 160.f, S * 152.f, 70), FVector(120, 6, 90), Glass); } }
	P(BRVisuals::Cube(), FVector(552, 0, 60), FVector(6, 260, 130), Glass);
	for (int32 X : { -350, 350 }) { for (int32 S : { -1, 1 }) { P(BRVisuals::Cylinder(), FVector(X, S * 140.f, -170), FVector(120, 120, 50), Tire, FRotator(0, 0, 90)); } }
	// Balloon + ropes.
	P(BRVisuals::Sphere(), FVector(0, 0, 1400), FVector(1400, 1400, 1600), FLinearColor(0.95f, 0.3f, 0.25f));
	P(BRVisuals::Sphere(), FVector(0, 0, 1400), FVector(1420, 300, 1620), Stripe);
	for (int32 SX : { -1, 1 }) { for (int32 SY : { -1, 1 }) { P(BRVisuals::Cylinder(), FVector(SX * 380.f, SY * 110.f, 550), FVector(6, 6, 800), FLinearColor::White, FRotator(SX * 18.f, 0, SY * -8.f)); } }
	// Propellers.
	P(BRVisuals::Cube(), FVector(-600, 0, 40), FVector(20, 400, 40), FLinearColor(0.2f, 0.2f, 0.2f));
}

double ABRBattleBus::Now() const
{
	const AGameStateBase* GS = GetWorld()->GetGameState();
	return GS ? GS->GetServerWorldTimeSeconds() : GetWorld()->GetTimeSeconds();
}

float ABRBattleBus::GetProgress() const
{
	return FMath::Clamp(float((Now() - StartTime) / Duration), 0.f, 1.f);
}

FVector ABRBattleBus::GetLocationAt(double ServerTime) const
{
	const float Alpha = FMath::Clamp(float((ServerTime - StartTime) / Duration), 0.f, 1.f);
	return FMath::Lerp(FVector(StartPoint), FVector(EndPoint), Alpha);
}

void ABRBattleBus::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	const FVector Loc = GetLocationAt(Now());
	const FRotator Rot = (FVector(EndPoint) - FVector(StartPoint)).Rotation();
	SetActorLocationAndRotation(Loc + FVector(0, 0, FMath::Sin(GetWorld()->GetTimeSeconds() * 0.8f) * 60.f), FRotator(0.f, Rot.Yaw, 0.f));
	// Spectating passengers orbit the bus with their control rotation.
	if (const APlayerController* PC = GetWorld()->GetFirstPlayerController())
	{
		if (PC->GetViewTarget() == this)
		{
			const FRotator Control = PC->GetControlRotation();
			Boom->SetWorldRotation(FRotator(FMath::ClampAngle(Control.Pitch, -60.f, 10.f), Control.Yaw, 0.f));
		}
	}
}
