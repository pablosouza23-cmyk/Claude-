#include "Systems/BRDestructibleProp.h"

#include "Audio/BRProceduralAudio.h"
#include "Characters/BRCharacter.h"
#include "Components/StaticMeshComponent.h"
#include "Core/BRVisuals.h"
#include "Inventory/BRInventoryComponent.h"
#include "Net/UnrealNetwork.h"
#include "Weapons/BRDamageTypes.h"
#include "Weapons/BRProjectile.h"

ABRDestructibleProp::ABRDestructibleProp()
{
	bReplicates = true;
	NetCullDistanceSquared = FMath::Square(15000.f);
	NetUpdateFrequency = 2.f;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
}

void ABRDestructibleProp::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRDestructibleProp, Kind);
}

void ABRDestructibleProp::BeginPlay()
{
	Super::BeginPlay();
	switch (Kind)
	{
	case EBRPropKind::CarWreck: Health = 400.f; break;
	case EBRPropKind::Fence: Health = 80.f; break;
	case EBRPropKind::Barrel: Health = 60.f; break;
	default: Health = 120.f; break;
	}
	BuildVisual();
}

void ABRDestructibleProp::OnRep_Kind() { BuildVisual(); }

void ABRDestructibleProp::BuildVisual()
{
	TArray<USceneComponent*> Old;
	Root->GetChildrenComponents(false, Old);
	for (USceneComponent* C : Old) { C->DestroyComponent(); }
	auto P = [this](UStaticMesh* M, FVector L, FVector S, FLinearColor C, FRotator R = FRotator::ZeroRotator)
	{
		BRVisuals::AddPart(this, Root, M, L, S, R, C, true, 15000.f);
	};
	switch (Kind)
	{
	case EBRPropKind::CarWreck:
		P(BRVisuals::Cube(), FVector(0, 0, 0), FVector(420, 180, 70), FLinearColor(0.45f, 0.25f, 0.18f));
		P(BRVisuals::Cube(), FVector(-20, 0, 65), FVector(220, 160, 60), FLinearColor(0.35f, 0.2f, 0.15f));
		for (int32 SX : { -1, 1 }) { for (int32 SY : { -1, 1 }) { P(BRVisuals::Cylinder(), FVector(SX * 140.f, SY * 95.f, -30.f), FVector(65, 65, 25), FLinearColor(0.08f, 0.08f, 0.08f), FRotator(0, 0, 90)); } }
		break;
	case EBRPropKind::Fence:
		for (int32 I = -2; I <= 2; ++I) { P(BRVisuals::Cube(), FVector(0, I * 100.f, 0), FVector(12, 12, 120), FLinearColor(0.55f, 0.4f, 0.25f)); }
		P(BRVisuals::Cube(), FVector(0, 0, 30), FVector(8, 450, 15), FLinearColor(0.6f, 0.45f, 0.28f));
		P(BRVisuals::Cube(), FVector(0, 0, -20), FVector(8, 450, 15), FLinearColor(0.6f, 0.45f, 0.28f));
		break;
	case EBRPropKind::Barrel:
		P(BRVisuals::Cylinder(), FVector::ZeroVector, FVector(60, 60, 95), FLinearColor(0.75f, 0.12f, 0.1f));
		P(BRVisuals::Cylinder(), FVector(0, 0, 20), FVector(62, 62, 8), FLinearColor(0.95f, 0.85f, 0.1f));
		break;
	default:
		P(BRVisuals::Cube(), FVector::ZeroVector, FVector(100, 100, 100), FLinearColor(0.6f, 0.45f, 0.25f));
		P(BRVisuals::Cube(), FVector(0, 0, 0), FVector(104, 20, 104), FLinearColor(0.45f, 0.32f, 0.18f), FRotator(0, 0, 45));
		break;
	}
}

float ABRDestructibleProp::TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	if (!HasAuthority() || bDead) { return 0.f; }
	Health -= Damage;
	const bool bPickaxe = DamageEvent.DamageTypeClass && DamageEvent.DamageTypeClass->IsChildOf(UBRDamageType_Pickaxe::StaticClass());
	ABRCharacter* Harvester = bPickaxe ? Cast<ABRCharacter>(DamageCauser) : nullptr;
	const EBRBuildMaterial Mat = (Kind == EBRPropKind::CarWreck || Kind == EBRPropKind::Barrel) ? EBRBuildMaterial::Metal : EBRBuildMaterial::Wood;
	if (Harvester)
	{
		Harvester->GetInventory()->AddMaterial(Mat, BRRules::HarvestAmount(false, 1.5));
		UBRProceduralAudio::PlaySfx(this, Mat == EBRBuildMaterial::Metal ? EBRSfx::HarvestMetal : EBRSfx::HarvestWood, GetActorLocation());
	}
	if (Health <= 0.f)
	{
		bDead = true;
		if (Harvester) { Harvester->GetInventory()->AddMaterial(Mat, 30); }
		if (Kind == EBRPropKind::Barrel)
		{
			ABRProjectile::Explode(this, GetActorLocation(), 70.f, 400.f, 0.f, 2.f, EventInstigator, this);
		}
		Destroy();
	}
	return Damage;
}
