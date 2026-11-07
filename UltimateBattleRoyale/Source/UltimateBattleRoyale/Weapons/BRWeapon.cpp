#include "Weapons/BRWeapon.h"

#include "Audio/BRProceduralAudio.h"
#include "Building/BRBuildingPiece.h"
#include "Characters/BRCharacter.h"
#include "Characters/BRCharacterMovementComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Core/BRCollision.h"
#include "Core/BRSettings.h"
#include "Core/BRVisuals.h"
#include "GameFramework/GameStateBase.h"
#include "GameModes/BRPlayerController.h"
#include "Inventory/BRInventoryComponent.h"
#include "Items/BRItemRegistry.h"
#include "Kismet/GameplayStatics.h"
#include "Net/UnrealNetwork.h"
#include "NiagaraFunctionLibrary.h"
#include "TimerManager.h"
#include "Weapons/BRDamageTypes.h"
#include "Weapons/BRLagCompensationComponent.h"
#include "Weapons/BRProjectile.h"

ABRWeapon::ABRWeapon()
{
	PrimaryActorTick.bCanEverTick = true;
	bReplicates = true;
	SetReplicatingMovement(false);
	NetUpdateFrequency = 20.f;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
	Muzzle = CreateDefaultSubobject<USceneComponent>(TEXT("Muzzle"));
	Muzzle->SetupAttachment(Root);
	Muzzle->SetRelativeLocation(FVector(70.f, 0.f, 6.f));
}

void ABRWeapon::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRWeapon, ItemId);
	DOREPLIFETIME(ABRWeapon, AmmoInMag);
	DOREPLIFETIME(ABRWeapon, bReloading);
	DOREPLIFETIME(ABRWeapon, ReloadEndServerTime);
}

void ABRWeapon::InitWeapon(FName InItemId, int32 InAmmoInMag)
{
	ItemId = InItemId;
	CachedDef = nullptr;
	const UBRWeaponDefinition* Def = GetDefinition();
	AmmoInMag = (InAmmoInMag < 0 && Def) ? Def->MagazineSize : FMath::Max(0, InAmmoInMag);
	if (Def && Def->bThrowable) { AmmoInMag = 1; }
	PredictedAmmo = AmmoInMag;
	BuildVisual();
}

const UBRWeaponDefinition* ABRWeapon::GetDefinition() const
{
	if (!CachedDef.IsValid())
	{
		const UBRItemRegistry* Reg = UBRItemRegistry::Get();
		CachedDef = Reg ? Reg->FindWeapon(ItemId) : nullptr;
	}
	return CachedDef.Get();
}

ABRCharacter* ABRWeapon::GetCharacterOwner() const
{
	return Cast<ABRCharacter>(GetOwner());
}

void ABRWeapon::BeginPlay()
{
	Super::BeginPlay();
	const UBRWeaponDefinition* Def = GetDefinition();
	LocalReadyTime = GetWorld()->GetTimeSeconds() + (Def ? Def->EquipSeconds : 0.4f);
	PredictedAmmo = AmmoInMag;
	if (VisualParts.Num() == 0) { BuildVisual(); }
	if (ABRCharacter* C = GetCharacterOwner())
	{
		// Clients receive the pointer through the character; attach visually here as well.
		C->SetCurrentWeapon(C->GetCurrentWeapon());
	}
	UBRProceduralAudio::PlaySfx(this, EBRSfx::Equip, GetActorLocation(), 0.6f);
}

void ABRWeapon::OnRep_ItemId()
{
	CachedDef = nullptr;
	BuildVisual();
}

void ABRWeapon::BuildVisual()
{
	for (USceneComponent* P : VisualParts) { if (P) { P->DestroyComponent(); } }
	VisualParts.Reset();
	TracerPool.Reset();
	TracerHideTimes.Reset();
	const UBRWeaponDefinition* Def = GetDefinition();
	if (!Def || GetNetMode() == NM_DedicatedServer) { return; }

	const FLinearColor Body = Def->TintColor;
	const FLinearColor Dark(0.05f, 0.05f, 0.06f);
	const FLinearColor Rarity = BRTypes::RarityColor(Def->Rarity);
	UStaticMesh* Cube = BRVisuals::Cube();
	UStaticMesh* Cyl = BRVisuals::Cylinder();
	UStaticMesh* Sphere = BRVisuals::Sphere();
	auto Add = [this](UStaticMesh* M, FVector L, FVector S, FLinearColor C, FRotator R = FRotator::ZeroRotator)
	{
		if (UStaticMeshComponent* P = BRVisuals::AddPart(this, Root, M, L, S, R, C, false, 20000.f))
		{
			P->bCastDynamicShadow = false;
			VisualParts.Add(P);
		}
	};

	float Length = 60.f;
	switch (Def->Category)
	{
	case EBRWeaponCategory::Pistol:
		Add(Cube, FVector(10, 0, 4), FVector(28, 4, 8), Body); Add(Cube, FVector(0, 0, -6), FVector(8, 4, 14), Dark, FRotator(-15, 0, 0));
		Length = 26.f; break;
	case EBRWeaponCategory::SMG:
		Add(Cube, FVector(12, 0, 3), FVector(40, 6, 10), Body); Add(Cube, FVector(16, 0, -10), FVector(5, 4, 16), Dark);
		Add(Cube, FVector(-14, 0, 2), FVector(16, 4, 6), Dark); Length = 36.f; break;
	case EBRWeaponCategory::SniperRifle:
		Add(Cube, FVector(10, 0, 2), FVector(60, 6, 10), Body); Add(Cyl, FVector(62, 0, 4), FVector(3, 3, 60), Dark, FRotator(90, 0, 0));
		Add(Cyl, FVector(14, 0, 12), FVector(5, 5, 26), Dark, FRotator(90, 0, 0)); Add(Cube, FVector(-30, 0, -2), FVector(26, 5, 12), Body);
		Length = 92.f; break;
	case EBRWeaponCategory::Shotgun:
		Add(Cube, FVector(8, 0, 2), FVector(46, 7, 10), Body); Add(Cyl, FVector(46, 0, 4), FVector(5, 5, 40), Dark, FRotator(90, 0, 0));
		Add(Cube, FVector(30, 0, -4), FVector(20, 6, 6), Dark); Add(Cube, FVector(-24, 0, -2), FVector(22, 5, 11), Body);
		Length = 66.f; break;
	case EBRWeaponCategory::LMG:
		Add(Cube, FVector(10, 0, 3), FVector(66, 8, 12), Body); Add(Cyl, FVector(10, 0, -10), FVector(16, 16, 9), Dark, FRotator(0, 0, 90));
		Add(Cyl, FVector(55, 0, 4), FVector(4, 4, 30), Dark, FRotator(90, 0, 0)); Length = 72.f; break;
	case EBRWeaponCategory::Explosive:
		Add(Cyl, FVector(10, 0, 4), FVector(14, 14, 90), Body, FRotator(90, 0, 0)); Add(Cube, FVector(0, 0, -10), FVector(10, 5, 16), Dark);
		Length = 56.f; break;
	case EBRWeaponCategory::Throwable:
		Add(Sphere, FVector(6, 0, 0), FVector(10, 10, 12), Body); Add(Cube, FVector(6, 0, 7), FVector(3, 3, 4), Dark);
		Length = 8.f; break;
	case EBRWeaponCategory::Special:
		Add(Cube, FVector(10, 0, 3), FVector(50, 7, 10), Body); Add(Cyl, FVector(36, 0, 4), FVector(9, 9, 22), FLinearColor(0.2f, 0.9f, 1.f), FRotator(90, 0, 0));
		Length = 52.f; break;
	default:
		Add(Cube, FVector(10, 0, 3), FVector(52, 6, 10), Body); Add(Cube, FVector(14, 0, -9), FVector(6, 4, 14), Dark, FRotator(-10, 0, 0));
		Add(Cyl, FVector(44, 0, 4), FVector(3, 3, 24), Dark, FRotator(90, 0, 0)); Add(Cube, FVector(-22, 0, 0), FVector(18, 5, 10), Body);
		Length = 56.f; break;
	}
	// Rarity stripe so loot tier is readable at a glance.
	Add(Cube, FVector(4, 0, 9), FVector(14, 6.5f, 2), Rarity);
	Muzzle->SetRelativeLocation(FVector(Length, 0.f, 4.f));

	// Pools for tracers and muzzle flash (no actor spawns while firing).
	for (int32 I = 0; I < 4; ++I)
	{
		UStaticMeshComponent* T = BRVisuals::AddPart(this, nullptr, Cube, FVector::ZeroVector, FVector(1, 1, 1), FRotator::ZeroRotator, FLinearColor(1.f, 0.85f, 0.4f), false);
		if (T)
		{
			T->SetUsingAbsoluteLocation(true); T->SetUsingAbsoluteRotation(true); T->SetUsingAbsoluteScale(true);
			T->SetVisibility(false); T->bCastDynamicShadow = false;
			TracerPool.Add(T); TracerHideTimes.Add(0.f); VisualParts.Add(T);
		}
	}
	MuzzleFlash = BRVisuals::AddPart(this, Muzzle, BRVisuals::Cone(), FVector(6, 0, 0), FVector(10, 10, 16), FRotator(-90, 0, 0), FLinearColor(1.f, 0.75f, 0.2f), false);
	if (MuzzleFlash) { MuzzleFlash->SetVisibility(false); MuzzleFlash->bCastDynamicShadow = false; VisualParts.Add(MuzzleFlash); }
}

FVector ABRWeapon::GetMuzzleLocation() const
{
	return Muzzle ? Muzzle->GetComponentLocation() : GetActorLocation();
}

float ABRWeapon::GetCurrentSpreadDeg() const
{
	const UBRWeaponDefinition* Def = GetDefinition();
	const ABRCharacter* C = GetCharacterOwner();
	if (!Def || !C) { return 0.f; }
	const float SpeedRatio = C->GetVelocity().Size2D() / 650.f;
	const bool bAir = C->GetCharacterMovement()->IsFalling();
	return float(BRRules::ComputeSpreadDeg(Def->Spread(), Bloom, C->IsAiming(), C->bIsCrouched, SpeedRatio, bAir));
}

float ABRWeapon::GetReloadProgress() const
{
	const UBRWeaponDefinition* Def = GetDefinition();
	if (!bReloading || !Def) { return 0.f; }
	const AGameStateBase* GS = GetWorld()->GetGameState();
	const double Now = GS ? GS->GetServerWorldTimeSeconds() : GetWorld()->GetTimeSeconds();
	const float Duration = Def->ReloadSeconds;
	return FMath::Clamp(1.f - float(ReloadEndServerTime - Now) / FMath::Max(0.01f, Duration), 0.f, 1.f);
}

void ABRWeapon::StartFire()
{
	bWantsToFire = true;
	bTriggerConsumed = false;
	const UBRWeaponDefinition* Def = GetDefinition();
	if (Def && Def->FireMode == EBRFireMode::Burst && BurstRemaining == 0) { BurstRemaining = Def->BurstCount; }
}

void ABRWeapon::StopFire()
{
	bWantsToFire = false;
}

bool ABRWeapon::CanFireLocal() const
{
	const UBRWeaponDefinition* Def = GetDefinition();
	const ABRCharacter* C = GetCharacterOwner();
	if (!Def || !C || !C->IsAliveAndWell() || bReloading) { return false; }
	if (GetWorld()->GetTimeSeconds() < LocalReadyTime) { return false; }
	if (PredictedAmmo <= 0) { return false; }
	if (C->GetBRMovement()->IsSprinting() && !C->IsAiming()) { return false; }
	const double Now = GetWorld()->GetTimeSeconds();
	return LastLocalShotTime < 0.0 || Now - LastLocalShotTime >= BRRules::ShotInterval(Def->RoundsPerMinute);
}

void ABRWeapon::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	const UBRWeaponDefinition* Def = GetDefinition();
	ABRCharacter* C = GetCharacterOwner();
	const float Now = GetWorld()->GetTimeSeconds();

	// Hide pooled FX.
	for (int32 I = 0; I < TracerPool.Num(); ++I)
	{
		if (TracerPool[I] && TracerPool[I]->IsVisible() && Now > TracerHideTimes[I]) { TracerPool[I]->SetVisibility(false); }
	}
	if (MuzzleFlash && MuzzleFlash->IsVisible() && Now > MuzzleFlashHideTime) { MuzzleFlash->SetVisibility(false); }

	if (!Def || !C || !C->IsLocallyControlled()) { return; }

	Bloom = float(BRRules::RecoverBloom(Bloom, Def->Spread(), DeltaSeconds));
	if (!bReloading && PredictedAmmo != AmmoInMag && Now - LastLocalShotTime > 0.5f) { PredictedAmmo = AmmoInMag; }
	if (bReloading) { PredictedAmmo = AmmoInMag; }

	if (bWantsToFire && PredictedAmmo <= 0 && !bReloading && !Def->bThrowable)
	{
		RequestReload();
		return;
	}

	const bool bTrigger = bWantsToFire || BurstRemaining > 0;
	if (!bTrigger || !CanFireLocal()) { return; }
	if (Def->FireMode == EBRFireMode::SemiAuto && bTriggerConsumed) { return; }

	FireOnce();
	if (Def->FireMode == EBRFireMode::SemiAuto) { bTriggerConsumed = true; }
	if (Def->FireMode == EBRFireMode::Burst && BurstRemaining > 0)
	{
		--BurstRemaining;
		if (BurstRemaining == 0) { bWantsToFire = false; }
	}
	if (!bWantsToFire && BurstRemaining == 0) { ShotIndex = 0; }
}

void ABRWeapon::FireOnce()
{
	const UBRWeaponDefinition* Def = GetDefinition();
	ABRCharacter* C = GetCharacterOwner();
	if (!Def || !C) { return; }
	const double Now = GetWorld()->GetTimeSeconds();
	if (Now - LastLocalShotTime > 0.4) { ShotIndex = 0; }
	LastLocalShotTime = Now;
	--PredictedAmmo;

	FVector ViewLoc; FRotator ViewRot;
	C->GetAimViewPoint(ViewLoc, ViewRot);
	const FVector Fwd = ViewRot.Vector();
	const float Ahead = FMath::Max(0.f, FVector::DotProduct(C->GetActorLocation() - ViewLoc, Fwd));
	const FVector Origin = ViewLoc + Fwd * Ahead;

	FBRShotRequest Req;
	Req.Origin = Origin;
	Req.Direction = Fwd;
	Req.Muzzle = GetMuzzleLocation();
	Req.Seed = BRRules::HashCombine(uint32(GetUniqueID()), ++ShotCounter);
	const AGameStateBase* GS = GetWorld()->GetGameState();
	Req.ClientServerTime = GS ? GS->GetServerWorldTimeSeconds() : Now;

	TArray<FVector> Ends;
	if (Def->bHitscan)
	{
		const float Spread = GetCurrentSpreadDeg();
		BRRules::Rng Rng(Req.Seed);
		FCollisionQueryParams Params(SCENE_QUERY_STAT(BRWeaponTrace), true, C);
		Params.AddIgnoredActor(this);
		for (int32 P = 0; P < FMath::Max(1, Def->Pellets); ++P)
		{
			double Yaw = 0.0, Pitch = 0.0;
			BRRules::SampleConeOffset(Rng, Spread, Yaw, Pitch);
			const FVector Dir = (ViewRot + FRotator(float(Pitch), float(Yaw), 0.f)).Vector();
			const FVector End = Origin + Dir * Def->MaxRange;
			FHitResult Hit;
			if (GetWorld()->LineTraceSingleByChannel(Hit, Origin, End, ECC_BRWeapon, Params))
			{
				Ends.Add(Hit.ImpactPoint);
				if (Hit.GetActor() && Req.Hits.Num() < 16)
				{
					FBRShotHit H; H.Actor = Hit.GetActor(); H.Location = Hit.ImpactPoint;
					Req.Hits.Add(H);
				}
			}
			else
			{
				Ends.Add(End);
			}
		}
	}

	// Recoil + bloom (local feel; the server never trusts these).
	double RecoilPitch = 0.0, RecoilYaw = 0.0;
	BRRules::RecoilForShot(ShotIndex++, Def->RecoilVerticalDeg, Def->RecoilHorizontalDeg, Req.Seed, RecoilPitch, RecoilYaw);
	const float RecoilScale = C->IsAiming() ? 0.7f : 1.f;
	C->LookInput(FVector2D(float(RecoilYaw), float(RecoilPitch)) * RecoilScale, false);
	Bloom = float(BRRules::AddBloom(Bloom, Def->Spread()));

	PlayShotFX(Req.Muzzle, Ends, true);
	for (const FVector& E : Ends) { Req.PelletEnds.Add(E); }

	if (HasAuthority()) { ProcessShot(Req); }
	else { ServerFire(Req); }
}

void ABRWeapon::ServerFire_Implementation(const FBRShotRequest& Request)
{
	ProcessShot(Request);
}

void ABRWeapon::ProcessShot(const FBRShotRequest& Req)
{
	const UBRWeaponDefinition* Def = GetDefinition();
	ABRCharacter* C = GetCharacterOwner();
	if (!Def || !C || !C->IsAliveAndWell() || C->GetCurrentWeapon() != this || bReloading) { ClientRejectShot(); return; }
	if (AmmoInMag <= 0) { ClientRejectShot(); return; }

	ABRPlayerController* PC = Cast<ABRPlayerController>(C->GetController());
	const double Now = GetWorld()->GetTimeSeconds();
	if (!BRRules::IsFireRateValid(LastServerShotTime, Now, Def->RoundsPerMinute) || (PC && !PC->ConsumeRpcToken(EBRRpcBucket::Fire)))
	{
		if (PC) { PC->ReportSuspicious(TEXT("fire_rate"), 2.f); }
		ClientRejectShot();
		return;
	}
	// Third-person camera sits up to ~4.5 m from the eyes.
	if (!BRRules::IsShotOriginPlausible(BRTypes::ToVec3(Req.Origin), BRTypes::ToVec3(C->GetPawnViewLocation()), 600.0))
	{
		if (PC) { PC->ReportSuspicious(TEXT("shot_origin"), 5.f); }
		ClientRejectShot();
		return;
	}
	const FVector Dir = FVector(Req.Direction).GetSafeNormal();
	if (FVector::DotProduct(Dir, C->GetControlRotation().Vector()) < 0.75f) // ~41 degrees
	{
		ClientRejectShot();
		return;
	}

	LastServerShotTime = Now;
	UBRInventoryComponent* Inv = C->GetInventory();
	if (Def->bThrowable)
	{
		if (Inv) { Inv->ConsumeActiveThrowable(); }
	}
	else if (!Inv || !Inv->IsInfinite())
	{
		--AmmoInMag;
	}

	if (!Def->bHitscan)
	{
		FActorSpawnParameters SP;
		SP.Owner = C;
		SP.Instigator = C;
		SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		const FVector SpawnLoc = FVector(Req.Origin) + Dir * 120.f;
		if (ABRProjectile* Proj = GetWorld()->SpawnActor<ABRProjectile>(ABRProjectile::StaticClass(), SpawnLoc, Dir.Rotation(), SP))
		{
			Proj->InitProjectile(ItemId, Dir * Def->ProjectileSpeed + (Def->bThrowable ? FVector(0, 0, 350.f) : FVector::ZeroVector));
		}
	}
	else
	{
		TMap<AActor*, float> DamageByActor;
		TMap<AActor*, bool> HeadshotByActor;
		TMap<AActor*, FVector> HitLocByActor;
		int32 Accepted = 0;
		for (const FBRShotHit& Hit : Req.Hits)
		{
			if (Accepted >= FMath::Max(1, Def->Pellets)) { break; }
			float Damage = 0.f; bool bHead = false;
			if (!ValidateHit(Req, Hit, Def, Damage, bHead)) { continue; }
			++Accepted;
			DamageByActor.FindOrAdd(Hit.Actor) += Damage;
			HeadshotByActor.FindOrAdd(Hit.Actor) |= bHead;
			HitLocByActor.Add(Hit.Actor, Hit.Location);
		}
		for (const TPair<AActor*, float>& Pair : DamageByActor)
		{
			FHitResult HR;
			HR.ImpactPoint = HR.Location = HitLocByActor[Pair.Key];
			const bool bHead = HeadshotByActor[Pair.Key];
			UGameplayStatics::ApplyPointDamage(Pair.Key, Pair.Value, Dir, HR, C->GetController(), this,
				bHead ? UBRDamageType_Headshot::StaticClass() : UBRDamageType_Weapon::StaticClass());
		}
	}

	// Cosmetic replication to other players (owner already played it locally).
	TArray<FVector_NetQuantize> Ends;
	for (int32 I = 0; I < FMath::Min(Req.PelletEnds.Num(), 12); ++I) { Ends.Add(Req.PelletEnds[I]); }
	MulticastShotFX(Req.Muzzle, Ends);
}

bool ABRWeapon::ValidateHit(const FBRShotRequest& Req, const FBRShotHit& Hit, const UBRWeaponDefinition* Def, float& OutDamage, bool& bOutHeadshot) const
{
	AActor* Target = Hit.Actor;
	if (!IsValid(Target) || Target == GetOwner() || Target == this) { return false; }
	const BRRules::Vec3 Origin = BRTypes::ToVec3(Req.Origin);
	const BRRules::Vec3 Point = BRTypes::ToVec3(Hit.Location);
	if (!BRRules::IsHitWithinRange(Origin, Point, Def->MaxRange + 100.0)) { return false; }

	// Maximum possible cone for this weapon + latency tolerance.
	const double MaxCone = Def->HipSpreadDeg + 1.5 + 4.0 + Def->MaxBloomDeg + 3.0;
	if (!BRRules::IsHitAlignedWithAim(Origin, BRTypes::ToVec3(FVector(Req.Direction)), Point, MaxCone)) { return false; }

	// Line of sight against static world (no shooting through terrain/buildings).
	FHitResult Block;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(BRShotLOS), false, GetOwner());
	Params.AddIgnoredActor(Target);
	Params.AddIgnoredActor(this);
	const FVector ToHit = FVector(Hit.Location) - FVector(Req.Origin);
	const FVector LosEnd = FVector(Req.Origin) + ToHit * 0.97f;
	if (GetWorld()->LineTraceSingleByChannel(Block, Req.Origin, LosEnd, ECC_BRWeapon, Params))
	{
		if (!Block.GetActor() || !Block.GetActor()->IsA<APawn>()) { return false; }
	}

	const float Distance = ToHit.Size();
	BRRules::HitZone Zone = BRRules::HitZone::Body;
	if (const ABRCharacter* Victim = Cast<ABRCharacter>(Target))
	{
		FVector Center; float HalfHeight = 90.f, Radius = 38.f;
		if (!Victim->GetLagCompensation() || !Victim->GetLagCompensation()->GetCapsuleAt(Req.ClientServerTime, Center, HalfHeight, Radius))
		{
			Center = Victim->GetActorLocation();
			HalfHeight = Victim->GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
		}
		if (!BRRules::IsPointNearCapsule(Point, BRTypes::ToVec3(Center), Radius, HalfHeight, 45.0)) { return false; }
		Zone = BRRules::ClassifyHitZone(Point.Z, Center.Z, HalfHeight);
	}
	else
	{
		// Structures/vehicles/props: point must be near the actor's bounds.
		FVector BoxOrigin, Extent;
		Target->GetActorBounds(true, BoxOrigin, Extent);
		if (!FBox(BoxOrigin - Extent - FVector(100.f), BoxOrigin + Extent + FVector(100.f)).IsInside(Hit.Location)) { return false; }
	}

	bOutHeadshot = Zone == BRRules::HitZone::Head;
	OutDamage = float(BRRules::ComputeHitDamage(Def->Damage, Distance, Def->Falloff(), Zone, Def->HeadshotMultiplier, Def->LimbMultiplier));
	if (Target->IsA<ABRBuildingPiece>() || !Target->IsA<APawn>())
	{
		OutDamage = Def->Damage * Def->StructureMultiplier;
	}
	return OutDamage > 0.f;
}

void ABRWeapon::ClientRejectShot_Implementation()
{
	PredictedAmmo = AmmoInMag;
}

void ABRWeapon::MulticastShotFX_Implementation(FVector_NetQuantize InMuzzle, const TArray<FVector_NetQuantize>& InEnds)
{
	const ABRCharacter* C = GetCharacterOwner();
	if (C && C->IsLocallyControlled()) { return; }
	if (GetNetMode() == NM_DedicatedServer) { return; }
	TArray<FVector> Ends;
	for (const FVector_NetQuantize& E : InEnds) { Ends.Add(E); }
	PlayShotFX(GetMuzzleLocation(), Ends, false);
}

void ABRWeapon::PlayShotFX(const FVector& InMuzzle, const TArray<FVector>& Ends, bool bLocal)
{
	if (GetNetMode() == NM_DedicatedServer) { return; }
	const UBRWeaponDefinition* Def = GetDefinition();
	const float Now = GetWorld()->GetTimeSeconds();

	if (MuzzleFlash && Def && !Def->bThrowable)
	{
		MuzzleFlash->SetVisibility(true);
		MuzzleFlash->SetRelativeRotation(FRotator(-90.f, 0.f, FMath::FRandRange(0.f, 360.f)));
		MuzzleFlashHideTime = Now + 0.04f;
	}

	USoundBase* Sound = (Def && !Def->FireSound.IsNull()) ? Def->FireSound.LoadSynchronous() : nullptr;
	if (Sound) { UGameplayStatics::PlaySoundAtLocation(this, Sound, InMuzzle); }
	else if (Def) { UBRProceduralAudio::PlaySfx(this, UBRProceduralAudio::GunshotFor(Def->Category), InMuzzle, bLocal ? 0.9f : 1.f); }

	UNiagaraSystem* MuzzleFX = (Def && !Def->MuzzleFX.IsNull()) ? Def->MuzzleFX.LoadSynchronous() : nullptr;
	if (!MuzzleFX && !UBRSettings::Get()->MuzzleFlashFX.IsNull()) { MuzzleFX = UBRSettings::Get()->MuzzleFlashFX.LoadSynchronous(); }
	if (MuzzleFX) { UNiagaraFunctionLibrary::SpawnSystemAttached(MuzzleFX, Muzzle, NAME_None, FVector::ZeroVector, FRotator::ZeroRotator, EAttachLocation::SnapToTarget, true); }
	UNiagaraSystem* ImpactFX = UBRSettings::Get()->ImpactFX.IsNull() ? nullptr : UBRSettings::Get()->ImpactFX.LoadSynchronous();

	for (const FVector& End : Ends)
	{
		if (TracerPool.Num() > 0)
		{
			const int32 I = NextTracer++ % TracerPool.Num();
			UStaticMeshComponent* T = TracerPool[I];
			const FVector Start = InMuzzle;
			const FVector Delta = End - Start;
			const float Len = Delta.Size();
			if (T && Len > 50.f)
			{
				// Short streak a little ahead of the muzzle (reads as a bullet, not a laser).
				const float StreakLen = FMath::Min(Len * 0.6f, 900.f);
				const FVector Center = Start + Delta.GetSafeNormal() * (StreakLen * 0.5f + 60.f);
				T->SetWorldTransform(FTransform(Delta.Rotation(), Center, FVector(StreakLen / 100.f, 0.025f, 0.025f)));
				T->SetVisibility(true);
				TracerHideTimes[I] = Now + 0.05f;
			}
		}
		if (ImpactFX) { UNiagaraFunctionLibrary::SpawnSystemAtLocation(this, ImpactFX, End); }
	}
}

void ABRWeapon::RequestReload()
{
	const UBRWeaponDefinition* Def = GetDefinition();
	const ABRCharacter* C = GetCharacterOwner();
	if (!Def || !C || bReloading || Def->bThrowable) { return; }
	const UBRInventoryComponent* Inv = C->GetInventory();
	if (AmmoInMag >= Def->MagazineSize || !Inv || (Inv->GetAmmo(Def->AmmoType) <= 0 && !Inv->IsInfinite())) { return; }
	if (HasAuthority()) { ServerReload_Implementation(); }
	else { ServerReload(); }
}

void ABRWeapon::ServerReload_Implementation()
{
	const UBRWeaponDefinition* Def = GetDefinition();
	ABRCharacter* C = GetCharacterOwner();
	if (!Def || !C || bReloading || Def->bThrowable || !C->IsAliveAndWell()) { return; }
	const UBRInventoryComponent* Inv = C->GetInventory();
	if (AmmoInMag >= Def->MagazineSize || !Inv || (Inv->GetAmmo(Def->AmmoType) <= 0 && !Inv->IsInfinite())) { return; }
	bReloading = true;
	ReloadEndServerTime = GetWorld()->GetTimeSeconds() + Def->ReloadSeconds;
	GetWorldTimerManager().SetTimer(ReloadTimer, this, &ABRWeapon::FinishReload, Def->ReloadSeconds, false);
	OnRep_Reloading();
}

void ABRWeapon::FinishReload()
{
	const UBRWeaponDefinition* Def = GetDefinition();
	ABRCharacter* C = GetCharacterOwner();
	bReloading = false;
	if (!Def || !C) { return; }
	UBRInventoryComponent* Inv = C->GetInventory();
	if (!Inv) { return; }
	const int32 Reserve = Inv->IsInfinite() ? Def->MagazineSize : Inv->GetAmmo(Def->AmmoType);
	const int32 Rounds = BRRules::RoundsToReload(AmmoInMag, Def->MagazineSize, Reserve);
	if (!Inv->IsInfinite()) { Inv->ConsumeAmmo(Def->AmmoType, Rounds); }
	AmmoInMag += Rounds;
	OnRep_Reloading();
}

void ABRWeapon::OnRep_Reloading()
{
	if (bReloading)
	{
		LocalReloadStart = GetWorld()->GetTimeSeconds();
		const UBRWeaponDefinition* Def = GetDefinition();
		USoundBase* Sound = (Def && !Def->ReloadSound.IsNull()) ? Def->ReloadSound.LoadSynchronous() : nullptr;
		if (Sound) { UGameplayStatics::PlaySoundAtLocation(this, Sound, GetActorLocation()); }
		else { UBRProceduralAudio::PlaySfx(this, EBRSfx::Reload, GetActorLocation()); }
		if (ACharacter* C = GetCharacterOwner())
		{
			if (Def && !Def->ReloadMontage.IsNull() && C->GetMesh()->GetAnimInstance())
			{
				C->PlayAnimMontage(Def->ReloadMontage.LoadSynchronous());
			}
		}
	}
	PredictedAmmo = AmmoInMag;
}
