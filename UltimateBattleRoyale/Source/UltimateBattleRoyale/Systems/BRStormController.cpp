#include "Systems/BRStormController.h"

#include "Audio/BRProceduralAudio.h"
#include "Camera/CameraComponent.h"
#include "Characters/BRCharacter.h"
#include "Characters/BRHealthComponent.h"
#include "Components/AudioComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Core/BRSettings.h"
#include "Core/BRVisuals.h"
#include "EngineUtils.h"
#include "GameFramework/GameStateBase.h"
#include "Kismet/GameplayStatics.h"
#include "Net/UnrealNetwork.h"
#include "Settings/BRPerformanceSubsystem.h"
#include "TimerManager.h"
#include "Weapons/BRDamageTypes.h"
#include "World/BRWorldSubsystem.h"

ABRStormController::ABRStormController()
{
	PrimaryActorTick.bCanEverTick = true;
	bReplicates = true;
	bAlwaysRelevant = true;
	NetUpdateFrequency = 1.f;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
}

void ABRStormController::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRStormController, State);
}

double ABRStormController::Now() const
{
	const AGameStateBase* GS = GetWorld()->GetGameState();
	return GS ? GS->GetServerWorldTimeSeconds() : GetWorld()->GetTimeSeconds();
}

void ABRStormController::BeginPlay()
{
	Super::BeginPlay();
	if (GetNetMode() == NM_DedicatedServer) { return; }
	UMaterialInterface* WallMat = UBRSettings::Get()->StormWallMaterial.IsNull() ? nullptr : UBRSettings::Get()->StormWallMaterial.LoadSynchronous();
	if (WallMat)
	{
		Wall = BRVisuals::AddPart(this, Root, BRVisuals::Cylinder(), FVector::ZeroVector, FVector(100.f), FRotator::ZeroRotator, FLinearColor::White, false);
		Wall->SetMaterial(0, WallMat);
		Wall->bCastDynamicShadow = false;
		Wall->SetVisibility(false);
	}
	else
	{
		// No translucent material authored: a ring of tall light beams marks the edge.
		const int32 Count = UBRPerformanceSubsystem::GetQualityTierStatic(this) == EBRQualityTier::Low ? 32 : 64;
		for (int32 I = 0; I < Count; ++I)
		{
			UStaticMeshComponent* B = BRVisuals::AddPart(this, Root, BRVisuals::Cylinder(), FVector::ZeroVector, FVector(60.f, 60.f, 40000.f), FRotator::ZeroRotator, FLinearColor(0.55f, 0.2f, 0.9f), false);
			if (B) { B->bCastDynamicShadow = false; B->SetVisibility(false); Beams.Add(B); }
		}
	}
	StormAudio = UBRProceduralAudio::CreateLoop(this, EBRSfx::StormLoop);
}

void ABRStormController::StartStorm(const FVector2D& Center, float Radius, uint32 Seed)
{
	if (!HasAuthority()) { return; }
	StormSeed = Seed;
	State = FBRStormState();
	State.bActive = true;
	State.ToCenter = State.FromCenter = Center;
	State.ToRadius = State.FromRadius = Radius;
	BeginPhase(0);
	GetWorldTimerManager().SetTimer(DamageTimer, this, &ABRStormController::ApplyDamage, 1.f, true);
}

void ABRStormController::StopStorm()
{
	GetWorldTimerManager().ClearTimer(PhaseTimer);
	GetWorldTimerManager().ClearTimer(DamageTimer);
	State.bActive = false;
	OnRep_State();
}

void ABRStormController::BeginPhase(int32 Phase)
{
	if (Phase >= BRRules::DefaultStormPhaseCount())
	{
		State.bFinished = true;
		State.bShrinking = false;
		OnRep_State();
		return;
	}
	const BRRules::StormPhaseDef Def = BRRules::DefaultStormPhase(Phase);
	// Current circle becomes the start; pick the next (contained, preferring land).
	State.FromCenter = State.ToCenter;
	State.FromRadius = State.ToRadius;
	BRRules::Rng Rng(BRRules::HashCombine(StormSeed, uint32(Phase) + 17u));
	const UBRWorldSubsystem* WS = GetWorld()->GetSubsystem<UBRWorldSubsystem>();
	const BRRules::Circle Prev{ State.FromCenter.X, State.FromCenter.Y, State.FromRadius };
	const BRRules::Circle Next = BRRules::ChooseNextCircleValidated(Prev, State.FromRadius * Def.RadiusScale, Rng,
		[WS](double X, double Y) { return !WS || WS->IsLand(float(X), float(Y)); });
	State.ToCenter = FVector2D(Next.X, Next.Y);
	State.ToRadius = float(Next.Radius);
	State.Phase = Phase;
	State.bShrinking = false;
	State.DamagePerSecond = float(Def.DamagePerSecond);
	State.SegmentStart = Now();
	State.SegmentEnd = State.SegmentStart + Def.WaitSeconds;
	GetWorldTimerManager().SetTimer(PhaseTimer, this, &ABRStormController::BeginShrink, float(Def.WaitSeconds), false);
	OnRep_State();
}

void ABRStormController::BeginShrink()
{
	const BRRules::StormPhaseDef Def = BRRules::DefaultStormPhase(State.Phase);
	State.bShrinking = true;
	State.SegmentStart = Now();
	State.SegmentEnd = State.SegmentStart + Def.ShrinkSeconds;
	const int32 NextPhase = State.Phase + 1;
	GetWorldTimerManager().SetTimer(PhaseTimer, FTimerDelegate::CreateUObject(this, &ABRStormController::BeginPhase, NextPhase), float(Def.ShrinkSeconds), false);
	OnRep_State();
}

void ABRStormController::OnRep_State()
{
	OnPhaseChanged.Broadcast(State);
}

void ABRStormController::GetCurrentCircle(FVector2D& OutCenter, float& OutRadius) const
{
	if (!State.bShrinking)
	{
		OutCenter = State.FromCenter;
		OutRadius = State.FromRadius;
		if (State.bFinished) { OutCenter = State.ToCenter; OutRadius = State.ToRadius; }
		return;
	}
	const double Alpha = BRRules::PhaseAlpha(Now(), State.SegmentStart, State.SegmentEnd - State.SegmentStart);
	const BRRules::Circle C = BRRules::InterpolateCircle(
		BRRules::Circle{ State.FromCenter.X, State.FromCenter.Y, State.FromRadius },
		BRRules::Circle{ State.ToCenter.X, State.ToCenter.Y, State.ToRadius }, Alpha);
	OutCenter = FVector2D(C.X, C.Y);
	OutRadius = float(C.Radius);
}

float ABRStormController::GetSecondsRemaining() const
{
	return FMath::Max(0.f, float(State.SegmentEnd - Now()));
}

float ABRStormController::DistanceOutside(const FVector& Location) const
{
	if (!State.bActive) { return 0.f; }
	FVector2D C; float R;
	GetCurrentCircle(C, R);
	return float(BRRules::DistanceOutside(BRRules::Circle{ C.X, C.Y, R }, Location.X, Location.Y));
}

bool ABRStormController::IsOutside(const FVector& Location) const
{
	return DistanceOutside(Location) > 0.f;
}

void ABRStormController::ApplyDamage()
{
	if (!State.bActive) { return; }
	for (TActorIterator<ABRCharacter> It(GetWorld()); It; ++It)
	{
		ABRCharacter* C = *It;
		if (C->IsEliminated() || !IsOutside(C->GetActorLocation())) { continue; }
		UGameplayStatics::ApplyDamage(C, State.DamagePerSecond, nullptr, this, UBRDamageType_Storm::StaticClass());
	}
}

void ABRStormController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (GetNetMode() == NM_DedicatedServer) { return; }
	UpdateVisuals();
	UpdateLocalEffects(DeltaSeconds);
}

void ABRStormController::UpdateVisuals()
{
	FVector2D C; float R;
	GetCurrentCircle(C, R);
	const bool bShow = State.bActive && R > 0.f;
	if (FMath::Abs(R - LastVisualRadius) < 30.f && (C - LastVisualCenter).Size() < 30.f) { return; }
	LastVisualRadius = R;
	LastVisualCenter = C;
	if (Wall)
	{
		Wall->SetVisibility(bShow);
		Wall->SetWorldLocation(FVector(C.X, C.Y, 0.f));
		Wall->SetWorldScale3D(FVector(R * 2.f / 100.f, R * 2.f / 100.f, 600.f));
	}
	for (int32 I = 0; I < Beams.Num(); ++I)
	{
		const float Ang = 2.f * PI * I / Beams.Num();
		Beams[I]->SetVisibility(bShow);
		Beams[I]->SetWorldLocation(FVector(C.X + FMath::Cos(Ang) * R, C.Y + FMath::Sin(Ang) * R, 15000.f));
	}
}

void ABRStormController::UpdateLocalEffects(float DeltaSeconds)
{
	const APlayerController* PC = GetWorld()->GetFirstPlayerController();
	const ABRCharacter* Char = PC ? Cast<ABRCharacter>(PC->GetPawn()) : nullptr;
	const float Outside = Char ? DistanceOutside(Char->GetActorLocation()) : 0.f;
	TintAlpha = FMath::FInterpTo(TintAlpha, Outside > 0.f ? 1.f : 0.f, DeltaSeconds, 3.f);
	if (Char && Char->GetCamera())
	{
		FPostProcessSettings& PP = Char->GetCamera()->PostProcessSettings;
		PP.bOverride_SceneColorTint = TintAlpha > 0.01f;
		PP.SceneColorTint = FMath::Lerp(FLinearColor::White, FLinearColor(0.75f, 0.45f, 1.f), TintAlpha);
		PP.bOverride_VignetteIntensity = TintAlpha > 0.01f;
		PP.VignetteIntensity = 0.4f + 0.6f * TintAlpha;
	}
	if (StormAudio)
	{
		// Loud near/inside the storm, silent deep in the safe zone.
		FVector2D C; float R;
		GetCurrentCircle(C, R);
		const float DistToEdge = Char ? FMath::Abs(FVector2D::Distance(FVector2D(Char->GetActorLocation()), C) - R) : 1e9f;
		const float Vol = State.bActive ? FMath::Clamp(1.f - DistToEdge / 4000.f, 0.f, 1.f) * 0.6f + TintAlpha * 0.4f : 0.f;
		StormAudio->SetVolumeMultiplier(FMath::Max(0.001f, Vol));
	}
}
