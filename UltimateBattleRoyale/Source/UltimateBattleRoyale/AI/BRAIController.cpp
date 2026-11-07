#include "AI/BRAIController.h"

#include "BehaviorTree/BehaviorTree.h"
#include "BehaviorTree/BlackboardComponent.h"
#include "Building/BRBuildComponent.h"
#include "Characters/BRCharacter.h"
#include "Characters/BRCharacterMovementComponent.h"
#include "Characters/BRHealthComponent.h"
#include "Core/BRSettings.h"
#include "EngineUtils.h"
#include "GameModes/BRGameState.h"
#include "GameModes/BRPlayerState.h"
#include "Inventory/BRInventoryComponent.h"
#include "Items/BRItemRegistry.h"
#include "Items/BRLootContainer.h"
#include "Items/BRPickup.h"
#include "Navigation/PathFollowingComponent.h"
#include "Perception/AIPerceptionComponent.h"
#include "Perception/AISenseConfig_Damage.h"
#include "Perception/AISenseConfig_Hearing.h"
#include "Perception/AISenseConfig_Sight.h"
#include "Systems/BRStormController.h"
#include "Weapons/BRWeapon.h"
#include "World/BRWorldSubsystem.h"

ABRAIController::ABRAIController()
{
	bWantsPlayerState = true;
	PrimaryActorTick.bCanEverTick = true;

	UAIPerceptionComponent* Perception = CreateDefaultSubobject<UAIPerceptionComponent>(TEXT("Perception"));
	SetPerceptionComponent(*Perception);

	SightConfig = CreateDefaultSubobject<UAISenseConfig_Sight>(TEXT("Sight"));
	SightConfig->SightRadius = 6000.f;
	SightConfig->LoseSightRadius = 7500.f;
	SightConfig->PeripheralVisionAngleDegrees = 75.f;
	SightConfig->DetectionByAffiliation.bDetectEnemies = true;
	SightConfig->DetectionByAffiliation.bDetectNeutrals = true;
	SightConfig->DetectionByAffiliation.bDetectFriendlies = true;
	SightConfig->SetMaxAge(5.f);
	Perception->ConfigureSense(*SightConfig);

	HearingConfig = CreateDefaultSubobject<UAISenseConfig_Hearing>(TEXT("Hearing"));
	HearingConfig->HearingRange = 5000.f;
	HearingConfig->DetectionByAffiliation.bDetectEnemies = true;
	HearingConfig->DetectionByAffiliation.bDetectNeutrals = true;
	HearingConfig->DetectionByAffiliation.bDetectFriendlies = true;
	Perception->ConfigureSense(*HearingConfig);

	DamageConfig = CreateDefaultSubobject<UAISenseConfig_Damage>(TEXT("Damage"));
	Perception->ConfigureSense(*DamageConfig);
	Perception->SetDominantSense(SightConfig->GetSenseImplementation());
}

ABRCharacter* ABRAIController::GetBRCharacter() const { return Cast<ABRCharacter>(GetPawn()); }

void ABRAIController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);
	GetPerceptionComponent()->OnTargetPerceptionUpdated.AddUniqueDynamic(this, &ABRAIController::OnPerceptionUpdated);
	Skill = FMath::FRandRange(0.25f, 0.8f);
	bHasLandingTarget = false;
	Target.Reset();
	UBehaviorTree* BT = UBRSettings::Get()->BotBehaviorTree.IsNull() ? nullptr : UBRSettings::Get()->BotBehaviorTree.LoadSynchronous();
	bUsingBehaviorTree = BT && RunBehaviorTree(BT);
}

void ABRAIController::OnUnPossess()
{
	StopEngaging();
	Super::OnUnPossess();
}

void ABRAIController::OnPerceptionUpdated(AActor* Actor, FAIStimulus Stimulus)
{
	// Damage and sounds give a threat direction even without line of sight.
	if (Stimulus.WasSuccessfullySensed())
	{
		const ABRCharacter* Other = Cast<ABRCharacter>(Actor);
		const ABRCharacter* Me = GetBRCharacter();
		if (!Other || !Me || !Me->IsTeammate(Other))
		{
			LastThreatLocation = Stimulus.StimulusLocation;
			LastThreatTime = GetWorld()->GetTimeSeconds();
		}
	}
}

float ABRAIController::DistanceToNearestHuman() const
{
	const APawn* Me = GetPawn();
	if (!Me) { return 1e9f; }
	float Best = 1e9f;
	for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
	{
		if (const APawn* P = It->Get() ? It->Get()->GetPawn() : nullptr) { Best = FMath::Min(Best, FVector::Dist(P->GetActorLocation(), Me->GetActorLocation())); }
	}
	return Best;
}

// ------------------------------------------------------------------------------------------- queries
ABRCharacter* ABRAIController::FindBestTarget() const
{
	const ABRCharacter* Me = GetBRCharacter();
	if (!Me) { return nullptr; }
	TArray<AActor*> Seen;
	GetPerceptionComponent()->GetCurrentlyPerceivedActors(UAISense_Sight::StaticClass(), Seen);
	ABRCharacter* Best = nullptr;
	float BestScore = TNumericLimits<float>::Max();
	for (AActor* A : Seen)
	{
		ABRCharacter* C = Cast<ABRCharacter>(A);
		if (!C || C == Me || C->IsEliminated() || Me->IsTeammate(C)) { continue; }
		// Prefer close, weak and downed-but-threatening targets less (finish standing enemies first).
		const float Dist = FVector::Dist(C->GetActorLocation(), Me->GetActorLocation());
		const float Score = Dist * (C->IsDowned() ? 1.8f : 1.f);
		if (Score < BestScore) { BestScore = Score; Best = C; }
	}
	return Best;
}

bool ABRAIController::FindLoot(FVector& OutLocation, AActor*& OutActor) const
{
	const ABRCharacter* Me = GetBRCharacter();
	if (!Me) { return false; }
	if (CachedLoot.IsValid())
	{
		const ABRLootContainer* Box = Cast<ABRLootContainer>(CachedLoot.Get());
		if (!Box || !Box->IsOpened()) { OutActor = CachedLoot.Get(); OutLocation = OutActor->GetActorLocation(); return true; }
	}
	const bool bNeedsWeapon = Me->GetInventory()->GetActiveSlot() < 0 && Me->GetInventory()->FindFreeSlot() == 0;
	float BestScore = 4500.f;
	AActor* Best = nullptr;
	for (TActorIterator<ABRPickup> It(GetWorld()); It; ++It)
	{
		const float D = FVector::Dist(It->GetActorLocation(), Me->GetActorLocation());
		if (D > 4500.f) { continue; }
		const UBRItemDefinition* Def = UBRItemRegistry::Get()->Find(It->GetStack().ItemId);
		if (!Def) { continue; }
		const bool bUseful = Def->ItemType != EBRItemType::Weapon || Me->GetInventory()->FindFreeSlot() != INDEX_NONE;
		if (!bUseful) { continue; }
		const float Score = D * ((bNeedsWeapon && Def->ItemType == EBRItemType::Weapon) ? 0.4f : 1.f);
		if (Score < BestScore) { BestScore = Score; Best = *It; }
	}
	for (TActorIterator<ABRLootContainer> It(GetWorld()); It; ++It)
	{
		if (It->IsOpened()) { continue; }
		const float Score = FVector::Dist(It->GetActorLocation(), Me->GetActorLocation()) * 0.7f;
		if (Score < BestScore) { BestScore = Score; Best = *It; }
	}
	if (!Best) { return false; }
	const_cast<ABRAIController*>(this)->CachedLoot = Best;
	OutActor = Best;
	OutLocation = Best->GetActorLocation();
	return true;
}

bool ABRAIController::FindDownedTeammate(ABRCharacter*& Out) const
{
	const ABRCharacter* Me = GetBRCharacter();
	if (!Me) { return false; }
	for (TActorIterator<ABRCharacter> It(GetWorld()); It; ++It)
	{
		if (*It != Me && It->IsDowned() && Me->IsTeammate(*It) && FVector::Dist(It->GetActorLocation(), Me->GetActorLocation()) < 3500.f)
		{
			Out = *It;
			return true;
		}
	}
	return false;
}

bool ABRAIController::IsOutsideSafeZone(float Margin) const
{
	const ABRGameState* GS = GetWorld()->GetGameState<ABRGameState>();
	const APawn* Me = GetPawn();
	if (!GS || !GS->GetStorm() || !Me || !GS->GetStorm()->GetState().bActive) { return false; }
	FVector2D C; float R;
	// Rotate early: use the next circle once it is known.
	GS->GetStorm()->GetNextCircle(C, R);
	return FVector2D::Distance(FVector2D(Me->GetActorLocation()), C) > FMath::Max(0.f, R - Margin);
}

bool ABRAIController::GetSafeDestination(FVector& Out) const
{
	const ABRGameState* GS = GetWorld()->GetGameState<ABRGameState>();
	const UBRWorldSubsystem* WS = GetWorld()->GetSubsystem<UBRWorldSubsystem>();
	const APawn* Me = GetPawn();
	if (!GS || !GS->GetStorm() || !Me || !WS) { return false; }
	FVector2D C; float R;
	GS->GetStorm()->GetNextCircle(C, R);
	// Head toward the centre, stopping well inside the edge (with a little randomness).
	const FVector2D From(Me->GetActorLocation());
	const FVector2D Dir = (C - From).GetSafeNormal();
	const float Inside = FMath::Max(0.f, FVector2D::Distance(From, C) - R * 0.6f);
	const FVector2D P = From + Dir * Inside;
	Out = FVector(P.X, P.Y, WS->GetTerrainHeight(P.X, P.Y));
	return true;
}

// ------------------------------------------------------------------------------------------- movement
void ABRAIController::MoveTowards(const FVector& InGoal, float AcceptRadius)
{
	if (bHasGoal && FVector::DistSquared(InGoal, Goal) < FMath::Square(100.f)) { return; }
	Goal = InGoal;
	bHasGoal = true;
	const EPathFollowingRequestResult::Type R = MoveToLocation(InGoal, AcceptRadius, true, true, true, true);
	// No navmesh (procedural world without authored nav bounds): steer directly.
	bDirectSteer = R == EPathFollowingRequestResult::Failed;
}

bool ABRAIController::HasArrived(float AcceptRadius) const
{
	const APawn* Me = GetPawn();
	return !bHasGoal || !Me || FVector::Dist2D(Me->GetActorLocation(), Goal) <= AcceptRadius;
}

void ABRAIController::SteerDirect(float DeltaSeconds)
{
	ABRCharacter* Me = GetBRCharacter();
	if (!Me || !bHasGoal || !bDirectSteer || HasArrived()) { return; }
	const FVector To = (Goal - Me->GetActorLocation()).GetSafeNormal2D();
	// Obstacle avoidance: probe ahead, slide sideways if blocked.
	FVector Dir = To;
	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(BRBotSteer), false, Me);
	const FVector Eye = Me->GetActorLocation();
	if (GetWorld()->LineTraceSingleByChannel(Hit, Eye, Eye + To * 250.f, ECC_Visibility, Params))
	{
		Dir = (To + FVector::CrossProduct(Hit.ImpactNormal, FVector::UpVector) * StrafeSign).GetSafeNormal2D();
	}
	const FRotator Yaw(0.f, GetControlRotation().Yaw, 0.f);
	const FVector Local = Yaw.UnrotateVector(Dir);
	Me->MoveInput(FVector2D(Local.Y, Local.X));
	if (!Target.IsValid()) { SetControlRotation(FMath::RInterpTo(GetControlRotation(), Dir.Rotation(), DeltaSeconds, 5.f)); }

	// Stuck: jump/mantle, then try the other side.
	const float Moved = FVector::Dist2D(LastPos, Me->GetActorLocation());
	LastPos = Me->GetActorLocation();
	StuckTime = Moved < 40.f * DeltaSeconds ? StuckTime + DeltaSeconds : 0.f;
	if (StuckTime > 0.6f) { Me->JumpPressed(); StuckTime = 0.f; StrafeSign *= -1.f; }
}

// ------------------------------------------------------------------------------------------- combat
void ABRAIController::EquipBestWeapon()
{
	ABRCharacter* Me = GetBRCharacter();
	if (!Me) { return; }
	const UBRInventoryComponent* Inv = Me->GetInventory();
	int32 Best = INDEX_NONE; float BestScore = 0.f;
	for (int32 I = 0; I < UBRInventoryComponent::NumSlots; ++I)
	{
		const UBRWeaponDefinition* W = UBRItemRegistry::Get()->FindWeapon(Inv->GetSlot(I).ItemId);
		if (!W || W->bThrowable) { continue; }
		const bool bHasAmmo = Inv->GetSlot(I).AmmoInMag != 0 || Inv->GetAmmo(W->AmmoType) > 0 || Inv->IsInfinite();
		const float Score = W->Damage * W->RoundsPerMinute * W->Pellets * (bHasAmmo ? 1.f : 0.01f);
		if (Score > BestScore) { BestScore = Score; Best = I; }
	}
	if (Best != INDEX_NONE && Inv->GetActiveSlot() != Best) { Me->SelectSlot(Best); }
}

void ABRAIController::EngageTarget(ABRCharacter* InTarget, float DeltaSeconds)
{
	ABRCharacter* Me = GetBRCharacter();
	if (!Me || !InTarget) { StopEngaging(); return; }
	Target = InTarget;
	if (!Me->GetCurrentWeapon()) { EquipBestWeapon(); }
	ClearFocus(EAIFocusPriority::Gameplay);
	StopMovement();
	bHasGoal = false;

	// Aim with human-like error that shrinks with skill and while tracking.
	const FVector Eye = Me->GetPawnViewLocation();
	const FVector Aim = InTarget->GetActorLocation() + FVector(0, 0, InTarget->IsDowned() ? -30.f : 45.f);
	const float Dist = FVector::Dist(Eye, Aim);
	AimError = FMath::Vector2DInterpTo(AimError, FVector2D(FMath::FRandRange(-1.f, 1.f), FMath::FRandRange(-1.f, 1.f)) * FMath::Lerp(4.f, 0.8f, Skill), DeltaSeconds, 2.f);
	const FRotator Desired = (Aim - Eye).Rotation() + FRotator(AimError.Y, AimError.X, 0.f);
	SetControlRotation(FMath::RInterpTo(GetControlRotation(), Desired, DeltaSeconds, FMath::Lerp(4.f, 12.f, Skill)));

	const float AngleOff = FMath::Abs((Desired - GetControlRotation()).GetNormalized().Yaw);
	FireBurstTime -= DeltaSeconds;
	if (AngleOff < 6.f && Dist < 8000.f && FireBurstTime > -0.4f)
	{
		Me->StartFire();
		if (FireBurstTime < -0.35f) { FireBurstTime = FMath::FRandRange(0.4f, 1.2f); }
	}
	else
	{
		Me->StopFire();
		if (FireBurstTime < -0.6f) { FireBurstTime = FMath::FRandRange(0.4f, 1.2f); }
	}

	// Strafe while shooting; crouch sometimes at range.
	StrafeTimer -= DeltaSeconds;
	if (StrafeTimer <= 0.f) { StrafeSign = FMath::RandBool() ? 1.f : -1.f; StrafeTimer = FMath::FRandRange(0.6f, 1.6f); }
	const float Forward = Dist > 2500.f ? 0.5f : (Dist < 700.f ? -0.4f : 0.f);
	Me->MoveInput(FVector2D(StrafeSign * 0.8f, Forward));
	Me->SetAiming(Dist > 1500.f);
	if (Me->GetCurrentWeapon() && Me->GetCurrentWeapon()->GetAmmoInMag() == 0) { Me->ReloadWeapon(); }
}

void ABRAIController::StopEngaging()
{
	if (ABRCharacter* Me = GetBRCharacter()) { Me->StopFire(); Me->SetAiming(false); }
	Target.Reset();
}

bool ABRAIController::TryHeal()
{
	ABRCharacter* Me = GetBRCharacter();
	if (!Me || Me->GetInventory()->IsUsingConsumable()) { return Me && Me->GetInventory()->IsUsingConsumable(); }
	const UBRHealthComponent* H = Me->GetHealth();
	for (int32 I = 0; I < UBRInventoryComponent::NumSlots; ++I)
	{
		const UBRConsumableDefinition* C = UBRItemRegistry::Get()->FindConsumable(Me->GetInventory()->GetSlot(I).ItemId);
		if (!C) { continue; }
		const bool bUseful = (C->HealthRestore > 0.f && H->GetHealth() < FMath::Min(C->HealthCap, 99.f)) || (C->ShieldRestore > 0.f && H->GetShield() < C->ShieldCap);
		if (!bUseful) { continue; }
		Me->SelectSlot(I);
		Me->StartFire();
		Me->StopFire();
		return true;
	}
	return false;
}

bool ABRAIController::TryBuildCover(const FVector& ThreatLocation)
{
	ABRCharacter* Me = GetBRCharacter();
	const ABRGameState* GS = GetWorld()->GetGameState<ABRGameState>();
	if (!Me || !GS || !GS->GetModeRules().bBuildingEnabled) { return false; }
	const float Now = GetWorld()->GetTimeSeconds();
	if (Now - LastBuildTime < 3.f || Me->GetInventory()->GetMaterial(EBRBuildMaterial::Wood) < 10) { return false; }
	LastBuildTime = Now;
	// Face the threat and drop a wall (same validated path as players).
	SetControlRotation((ThreatLocation - Me->GetActorLocation()).Rotation() + FRotator(-15.f, 0.f, 0.f));
	UBRBuildComponent* B = Me->GetBuild();
	B->SelectPiece(EBRBuildPieceType::Wall);
	B->OnPrimaryPressed();
	B->OnPrimaryReleased();
	B->ExitModes();
	return true;
}

void ABRAIController::BeginInteractWith(AActor* InTarget)
{
	ABRCharacter* Me = GetBRCharacter();
	if (!Me || !InTarget) { return; }
	SetControlRotation((InTarget->GetActorLocation() - Me->GetPawnViewLocation()).Rotation());
	InteractTarget = InTarget;
	InteractTime = 0.f;
	Me->InteractPressed();
}

void ABRAIController::UpdateInteract(float DeltaSeconds)
{
	ABRCharacter* Me = GetBRCharacter();
	if (!Me || !InteractTarget.IsValid()) { return; }
	InteractTime += DeltaSeconds;
	const IBRInteractable* I = Cast<IBRInteractable>(InteractTarget.Get());
	const float Needed = I ? I->GetInteractDuration(Me) + 0.3f : 0.3f;
	if (InteractTime >= Needed)
	{
		Me->InteractReleased();
		InteractTarget.Reset();
		CachedLoot.Reset();
	}
}

// ------------------------------------------------------------------------------------------- brain
void ABRAIController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	ABRCharacter* Me = GetBRCharacter();
	if (!Me || Me->IsEliminated()) { return; }

	SteerDirect(DeltaSeconds);
	UpdateInteract(DeltaSeconds);
	if (Target.IsValid() && State == EBRBotState::Fighting) { EngageTarget(Target.Get(), DeltaSeconds); }

	ThinkTimer -= DeltaSeconds;
	if (ThinkTimer > 0.f) { return; }
	ThinkInterval = float(BRRules::AiThinkInterval(DistanceToNearestHuman()));
	ThinkTimer = ThinkInterval;
	if (!bUsingBehaviorTree) { Think(ThinkInterval); }
}

void ABRAIController::Think(float DeltaSeconds)
{
	ABRCharacter* Me = GetBRCharacter();
	const UBRCharacterMovementComponent* Move = Me->GetBRMovement();

	// 1. In the air: pick a landing spot (named place or loot-rich area) and glide to it.
	if (Move->IsInAirborneCustomMode() || (Move->IsFalling() && Me->GetVelocity().Z < -1500.f))
	{
		State = EBRBotState::Skydiving;
		if (!bHasLandingTarget)
		{
			const UBRWorldSubsystem* WS = GetWorld()->GetSubsystem<UBRWorldSubsystem>();
			if (WS && WS->GetNamedLocations().Num() > 0)
			{
				const TArray<FBRNamedLocation>& L = WS->GetNamedLocations();
				// Closest few places to where we jumped, choose one at random.
				TArray<int32> Idx;
				for (int32 I = 0; I < L.Num(); ++I) { Idx.Add(I); }
				const FVector P = Me->GetActorLocation();
				Idx.Sort([&L, &P](int32 A, int32 B) { return FVector::Dist2D(L[A].Location, P) < FVector::Dist2D(L[B].Location, P); });
				const FBRNamedLocation& Pick = L[Idx[FMath::RandRange(0, FMath::Min(3, Idx.Num() - 1))]];
				LandingTarget = Pick.Location + FVector(FMath::FRandRange(-Pick.Radius, Pick.Radius) * 0.5f, FMath::FRandRange(-Pick.Radius, Pick.Radius) * 0.5f, 0.f);
				bHasLandingTarget = true;
			}
		}
		const FVector To = (LandingTarget - Me->GetActorLocation()).GetSafeNormal2D();
		SetControlRotation(FRotator(-60.f, To.Rotation().Yaw, 0.f));
		Me->MoveInput(FVector2D(0.f, FVector::Dist2D(LandingTarget, Me->GetActorLocation()) > 1500.f ? 1.f : 0.f));
		return;
	}
	bHasLandingTarget = false;

	if (Me->IsDowned())
	{
		State = EBRBotState::Downed;
		StopEngaging();
		ABRCharacter* Mate = nullptr;
		for (TActorIterator<ABRCharacter> It(GetWorld()); It; ++It) { if (*It != Me && Me->IsTeammate(*It) && It->IsAliveAndWell()) { Mate = *It; break; } }
		if (Mate) { MoveTowards(Mate->GetActorLocation(), 200.f); }
		return;
	}
	if (InteractTarget.IsValid()) { return; }

	const UBRHealthComponent* H = Me->GetHealth();
	const float Effective = H->GetHealth() + H->GetShield();
	ABRCharacter* Enemy = FindBestTarget();
	const float Now = GetWorld()->GetTimeSeconds();

	// 2. Fight / retreat.
	if (Enemy && Me->GetInventory()->GetSlots().ContainsByPredicate([](const FBRItemStack& S) { return UBRItemRegistry::Get()->FindWeapon(S.ItemId) != nullptr; }))
	{
		if (Effective < 35.f && FMath::FRand() < 0.5f)
		{
			State = EBRBotState::Retreating;
			StopEngaging();
			TryBuildCover(Enemy->GetActorLocation());
			const FVector Away = Me->GetActorLocation() + (Me->GetActorLocation() - Enemy->GetActorLocation()).GetSafeNormal2D() * 2500.f;
			MoveTowards(Away);
			return;
		}
		State = EBRBotState::Fighting;
		Target = Enemy;
		if (Effective < 70.f && Now - LastThreatTime < 1.f) { TryBuildCover(Enemy->GetActorLocation()); }
		return;
	}
	StopEngaging();

	// 3. Storm rotation has priority over looting once the next circle is known.
	if (IsOutsideSafeZone(-500.f))
	{
		State = EBRBotState::Rotating;
		FVector Dest;
		if (GetSafeDestination(Dest)) { MoveTowards(Dest, 400.f); }
		return;
	}

	// 4. Revive teammates.
	ABRCharacter* Downed = nullptr;
	if (FindDownedTeammate(Downed))
	{
		State = EBRBotState::Reviving;
		if (FVector::Dist(Downed->GetActorLocation(), Me->GetActorLocation()) < 250.f) { StopMovement(); BeginInteractWith(Downed); }
		else { MoveTowards(Downed->GetActorLocation(), 150.f); }
		return;
	}

	// 5. Heal when safe.
	if (Effective < 120.f && Now - LastThreatTime > 4.f && TryHeal())
	{
		State = EBRBotState::Healing;
		return;
	}

	// 6. Loot.
	FVector LootLoc; AActor* Loot = nullptr;
	if (FindLoot(LootLoc, Loot))
	{
		State = EBRBotState::Looting;
		if (FVector::Dist(LootLoc, Me->GetActorLocation()) < 200.f) { StopMovement(); bHasGoal = false; BeginInteractWith(Loot); }
		else { MoveTowards(LootLoc, 120.f); }
		EquipBestWeapon();
		return;
	}

	// 7. Investigate threats or explore toward the safe zone.
	State = EBRBotState::Exploring;
	if (Now - LastThreatTime < 6.f) { MoveTowards(LastThreatLocation, 600.f); return; }
	if (HasArrived(400.f))
	{
		FVector Dest;
		if (GetSafeDestination(Dest)) { MoveTowards(Dest + FVector(FMath::FRandRange(-4000.f, 4000.f), FMath::FRandRange(-4000.f, 4000.f), 0.f), 400.f); }
		else { MoveTowards(Me->GetActorLocation() + FVector(FMath::FRandRange(-5000.f, 5000.f), FMath::FRandRange(-5000.f, 5000.f), 0.f), 400.f); }
	}
}
