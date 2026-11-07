#include "Weapons/BRProjectile.h"

#include "Audio/BRProceduralAudio.h"
#include "Building/BRBuildingPiece.h"
#include "Characters/BRCharacter.h"
#include "Components/CapsuleComponent.h"
#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Core/BRCollision.h"
#include "Core/BRSettings.h"
#include "Core/BRVisuals.h"
#include "Engine/OverlapResult.h"
#include "GameModes/BRGameState.h"
#include "GameFramework/ProjectileMovementComponent.h"
#include "Items/BRItemRegistry.h"
#include "Kismet/GameplayStatics.h"
#include "Net/UnrealNetwork.h"
#include "NiagaraFunctionLibrary.h"
#include "TimerManager.h"
#include "Weapons/BRDamageTypes.h"

ABRProjectile::ABRProjectile()
{
	bReplicates = true;
	SetReplicatingMovement(true);
	InitialLifeSpan = 12.f;

	Collision = CreateDefaultSubobject<USphereComponent>(TEXT("Collision"));
	Collision->InitSphereRadius(8.f);
	Collision->SetCollisionProfileName(UCollisionProfile::BlockAllDynamic_ProfileName);
	Collision->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
	Collision->SetCollisionResponseToChannel(ECC_Visibility, ECR_Ignore);
	RootComponent = Collision;

	Movement = CreateDefaultSubobject<UProjectileMovementComponent>(TEXT("Movement"));
	Movement->UpdatedComponent = Collision;
	Movement->bRotationFollowsVelocity = true;
	Movement->InitialSpeed = 0.f;
	Movement->MaxSpeed = 60000.f;
	Movement->ProjectileGravityScale = 0.f;
}

void ABRProjectile::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRProjectile, ItemId);
}

const UBRWeaponDefinition* ABRProjectile::GetDefinition() const
{
	const UBRItemRegistry* Reg = UBRItemRegistry::Get();
	return Reg ? Reg->FindWeapon(ItemId) : nullptr;
}

void ABRProjectile::InitProjectile(FName InItemId, const FVector& Velocity)
{
	ItemId = InItemId;
	const UBRWeaponDefinition* Def = GetDefinition();
	Movement->Velocity = Velocity;
	if (Def)
	{
		Movement->ProjectileGravityScale = Def->ProjectileGravityScale;
		Movement->bShouldBounce = Def->bThrowable;
		Movement->Bounciness = 0.35f;
		Movement->Friction = 0.4f;
		if (Def->bThrowable && Def->FuseSeconds > 0.f)
		{
			GetWorldTimerManager().SetTimer(FuseTimer, this, &ABRProjectile::Detonate, Def->FuseSeconds, false);
		}
	}
	if (APawn* Inst = GetInstigator()) { Collision->IgnoreActorWhenMoving(Inst, true); }
	BuildVisual();
}

void ABRProjectile::BeginPlay()
{
	Super::BeginPlay();
	Collision->OnComponentHit.AddDynamic(this, &ABRProjectile::OnProjectileHit);
	if (!ItemId.IsNone()) { BuildVisual(); }
}

void ABRProjectile::OnRep_ItemId()
{
	BuildVisual();
}

void ABRProjectile::BuildVisual()
{
	if (GetNetMode() == NM_DedicatedServer || GetComponentByClass<UStaticMeshComponent>()) { return; }
	const UBRWeaponDefinition* Def = GetDefinition();
	if (!Def) { return; }
	if (Def->bThrowable)
	{
		BRVisuals::AddPart(this, Collision, BRVisuals::Sphere(), FVector::ZeroVector, FVector(14, 14, 16), FRotator::ZeroRotator, Def->TintColor, false);
	}
	else if (Def->Category == EBRWeaponCategory::Explosive)
	{
		BRVisuals::AddPart(this, Collision, BRVisuals::Cylinder(), FVector::ZeroVector, FVector(10, 10, 50), FRotator(90, 0, 0), FLinearColor(0.3f, 0.35f, 0.2f), false);
		BRVisuals::AddPart(this, Collision, BRVisuals::Cone(), FVector(-30, 0, 0), FVector(14, 14, 20), FRotator(90, 0, 0), FLinearColor(1.f, 0.5f, 0.1f), false);
	}
	else
	{
		BRVisuals::AddPart(this, Collision, BRVisuals::Cube(), FVector::ZeroVector, FVector(60, 2, 2), FRotator::ZeroRotator, FLinearColor(1.f, 0.9f, 0.5f), false);
	}
}

void ABRProjectile::OnProjectileHit(UPrimitiveComponent* HitComp, AActor* OtherActor, UPrimitiveComponent* OtherComp, FVector NormalImpulse, const FHitResult& Hit)
{
	if (!HasAuthority() || bDetonated) { return; }
	const UBRWeaponDefinition* Def = GetDefinition();
	if (!Def) { Destroy(); return; }
	if (Def->bThrowable) { return; } // grenades bounce until the fuse ends

	if (Def->ExplosionRadius > 0.f)
	{
		Detonate();
		return;
	}

	// Kinetic round (sniper): direct damage with headshot detection.
	if (OtherActor && OtherActor != GetInstigator())
	{
		bool bHead = false;
		float Damage = Def->Damage;
		if (const ABRCharacter* Victim = Cast<ABRCharacter>(OtherActor))
		{
			const float HalfHeight = Victim->GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
			const BRRules::HitZone Zone = BRRules::ClassifyHitZone(Hit.ImpactPoint.Z, Victim->GetActorLocation().Z, HalfHeight);
			bHead = Zone == BRRules::HitZone::Head;
			const float Dist = FVector::Dist(Hit.ImpactPoint, Hit.TraceStart);
			Damage = float(BRRules::ComputeHitDamage(Def->Damage, Dist, Def->Falloff(), Zone, Def->HeadshotMultiplier, Def->LimbMultiplier));
		}
		else
		{
			Damage *= Def->StructureMultiplier;
		}
		UGameplayStatics::ApplyPointDamage(OtherActor, Damage, GetVelocity().GetSafeNormal(), Hit, GetInstigatorController(), this,
			bHead ? UBRDamageType_Headshot::StaticClass() : UBRDamageType_Weapon::StaticClass());
	}
	Destroy();
}

void ABRProjectile::Detonate()
{
	if (bDetonated || !HasAuthority()) { return; }
	bDetonated = true;
	const UBRWeaponDefinition* Def = GetDefinition();
	if (Def)
	{
		Explode(this, GetActorLocation(), Def->Damage, Def->ExplosionRadius, Def->KnockbackImpulse, Def->StructureMultiplier, GetInstigatorController(), this);
	}
	Destroy();
}

void ABRProjectile::Explode(UObject* WorldContext, const FVector& Location, float Damage, float Radius, float Knockback, float StructureMultiplier, AController* Instigator, AActor* Causer)
{
	UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	if (!World || Radius <= 0.f) { return; }

	TArray<FOverlapResult> Overlaps;
	FCollisionObjectQueryParams Objects(FCollisionObjectQueryParams::AllObjects);
	World->OverlapMultiByObjectType(Overlaps, Location, FQuat::Identity, Objects, FCollisionShape::MakeSphere(Radius));
	TSet<AActor*> Done;
	for (const FOverlapResult& O : Overlaps)
	{
		AActor* A = O.GetActor();
		if (!A || A == Causer || Done.Contains(A)) { continue; }
		Done.Add(A);
		const FVector Target = A->GetActorLocation();
		const float Dist = FVector::Dist(Location, Target);

		// Structures in between absorb the blast for characters.
		if (A->IsA<APawn>())
		{
			FHitResult Block;
			FCollisionQueryParams Params(SCENE_QUERY_STAT(BRExplosionLOS), false, Causer);
			Params.AddIgnoredActor(A);
			if (World->LineTraceSingleByChannel(Block, Location, Target, ECC_BRWeapon, Params) && Block.GetActor() && !Block.GetActor()->IsA<APawn>())
			{
				continue;
			}
		}

		if (Knockback > 0.f)
		{
			if (ABRCharacter* C = Cast<ABRCharacter>(A))
			{
				const FVector Dir = ((Target - Location).GetSafeNormal() + FVector(0, 0, 1.2f)).GetSafeNormal();
				C->LaunchCharacter(Dir * Knockback * (1.f - Dist / Radius * 0.5f), true, true);
			}
			continue;
		}

		float Amount = float(BRRules::RadialDamage(Damage, Damage * 0.25, Radius * 0.2, Radius, Dist));
		if (!A->IsA<APawn>()) { Amount = Damage * StructureMultiplier * (1.f - Dist / Radius * 0.5f); }
		if (Amount > 0.f)
		{
			UGameplayStatics::ApplyDamage(A, Amount, Instigator, Causer, UBRDamageType_Explosion::StaticClass());
		}
	}

	// Routed through the always-relevant game state so it survives the projectile being destroyed.
	if (ABRGameState* GS = World->GetGameState<ABRGameState>()) { GS->MulticastExplosionFX(Location, Radius); }
}

void ABRProjectile::PlayExplosionFX(UObject* WorldContext, const FVector& Location, float Radius)
{
	UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	if (!World || World->GetNetMode() == NM_DedicatedServer) { return; }
	UBRProceduralAudio::PlaySfx(WorldContext, EBRSfx::Explosion, Location);
	if (!UBRSettings::Get()->ExplosionFX.IsNull())
	{
		UNiagaraFunctionLibrary::SpawnSystemAtLocation(WorldContext, UBRSettings::Get()->ExplosionFX.LoadSynchronous(), Location);
		return;
	}
	// Fallback fireball: a short-lived expanding sphere actor.
	FActorSpawnParameters SP;
	SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	if (AActor* Ball = World->SpawnActor<AActor>(AActor::StaticClass(), FTransform(Location), SP))
	{
		USceneComponent* Root = NewObject<USceneComponent>(Ball);
		Ball->SetRootComponent(Root);
		Root->RegisterComponent();
		Root->SetWorldLocation(Location);
		BRVisuals::AddPart(Ball, Root, BRVisuals::Sphere(), FVector::ZeroVector, FVector(Radius * 0.9f), FRotator::ZeroRotator, FLinearColor(1.f, 0.45f, 0.08f), false);
		BRVisuals::AddPart(Ball, Root, BRVisuals::Sphere(), FVector(0, 0, Radius * 0.3f), FVector(Radius * 0.6f), FRotator::ZeroRotator, FLinearColor(0.25f, 0.22f, 0.2f), false);
		Ball->SetLifeSpan(0.35f);
	}
}
