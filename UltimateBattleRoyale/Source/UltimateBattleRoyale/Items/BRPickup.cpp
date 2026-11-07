#include "Items/BRPickup.h"

#include "Audio/BRProceduralAudio.h"
#include "Characters/BRCharacter.h"
#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Core/BRVisuals.h"
#include "Engine/StaticMesh.h"
#include "Inventory/BRInventoryComponent.h"
#include "Items/BRItemRegistry.h"
#include "Net/UnrealNetwork.h"
#include "Settings/BRPerformanceSubsystem.h"
#include "TimerManager.h"

#define LOCTEXT_NAMESPACE "BRPickup"

ABRPickup::ABRPickup()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickInterval = 0.f;
	bReplicates = true;
	NetCullDistanceSquared = FMath::Square(15000.f);
	NetUpdateFrequency = 2.f;

	Collision = CreateDefaultSubobject<USphereComponent>(TEXT("Collision"));
	Collision->InitSphereRadius(90.f);
	Collision->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	Collision->SetCollisionObjectType(ECC_WorldDynamic);
	Collision->SetCollisionResponseToAllChannels(ECR_Ignore);
	Collision->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
	Collision->SetGenerateOverlapEvents(true);
	RootComponent = Collision;

	VisualRoot = CreateDefaultSubobject<USceneComponent>(TEXT("VisualRoot"));
	VisualRoot->SetupAttachment(Collision);
}

void ABRPickup::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRPickup, Stack);
}

void ABRPickup::InitPickup(const FBRItemStack& InStack)
{
	Stack = InStack;
	BuildVisual();
}

void ABRPickup::BeginPlay()
{
	Super::BeginPlay();
	if (HasAuthority())
	{
		Collision->OnComponentBeginOverlap.AddDynamic(this, &ABRPickup::OnOverlap);
		// Static loot goes dormant after its first replication: hundreds of pickups cost no bandwidth.
		GetWorldTimerManager().SetTimer(DormancyTimer, FTimerDelegate::CreateWeakLambda(this, [this]() { SetNetDormancy(DORM_DormantAll); }), 2.f, false);
	}
	if (VisualRoot->GetNumChildrenComponents() == 0) { BuildVisual(); }
	SpinPhase = FMath::FRandRange(0.f, 6.f);
	// Ticking only animates the visual; far pickups stop.
	SetActorTickInterval(GetNetMode() == NM_DedicatedServer ? 1.f : 0.f);
	if (GetNetMode() == NM_DedicatedServer) { SetActorTickEnabled(false); }
}

void ABRPickup::OnRep_Stack()
{
	BuildVisual();
}

bool ABRPickup::IsAutoPickup() const
{
	const UBRItemDefinition* Def = UBRItemRegistry::Get()->Find(Stack.ItemId);
	return Def && (Def->ItemType == EBRItemType::Ammo || Def->ItemType == EBRItemType::Material);
}

void ABRPickup::BuildVisual()
{
	if (GetNetMode() == NM_DedicatedServer) { return; }
	TArray<USceneComponent*> Old;
	VisualRoot->GetChildrenComponents(true, Old);
	for (USceneComponent* C : Old) { C->DestroyComponent(); }

	const UBRItemDefinition* Def = UBRItemRegistry::Get()->Find(Stack.ItemId);
	if (!Def) { return; }
	const FLinearColor Rarity = BRTypes::RarityColor(Def->Rarity);
	const float Draw = 12000.f;

	UStaticMesh* Authored = Def->PickupMesh.IsNull() ? nullptr : Def->PickupMesh.LoadSynchronous();
	if (Authored)
	{
		BRVisuals::AddPart(this, VisualRoot, Authored, FVector(0, 0, 0), FVector(100.f), FRotator::ZeroRotator, FLinearColor::White, false, Draw);
	}
	else
	{
		switch (Def->ItemType)
		{
		case EBRItemType::Weapon:
			BRVisuals::AddPart(this, VisualRoot, BRVisuals::Cube(), FVector::ZeroVector, FVector(60, 8, 12), FRotator::ZeroRotator, Def->TintColor, false, Draw);
			BRVisuals::AddPart(this, VisualRoot, BRVisuals::Cube(), FVector(8, 0, -10), FVector(8, 6, 14), FRotator::ZeroRotator, FLinearColor(0.05f, 0.05f, 0.05f), false, Draw);
			break;
		case EBRItemType::Ammo:
			BRVisuals::AddPart(this, VisualRoot, BRVisuals::Cube(), FVector::ZeroVector, FVector(26, 18, 14), FRotator::ZeroRotator, Def->TintColor, false, Draw);
			break;
		case EBRItemType::Material:
			for (int32 I = 0; I < 3; ++I)
			{
				BRVisuals::AddPart(this, VisualRoot, BRVisuals::Cube(), FVector(0, (I - 1) * 14.f, I == 1 ? 10.f : 0.f), FVector(30, 12, 10), FRotator(0, 15.f * I, 0), Def->TintColor, false, Draw);
			}
			break;
		case EBRItemType::Consumable:
			BRVisuals::AddPart(this, VisualRoot, BRVisuals::Cylinder(), FVector::ZeroVector, FVector(18, 18, 26), FRotator::ZeroRotator, Def->TintColor, false, Draw);
			BRVisuals::AddPart(this, VisualRoot, BRVisuals::Cube(), FVector(0, 0, 14), FVector(8, 8, 6), FRotator::ZeroRotator, FLinearColor::White, false, Draw);
			break;
		default:
			BRVisuals::AddPart(this, VisualRoot, BRVisuals::Cube(), FVector::ZeroVector, FVector(30, 30, 30), FRotator(0, 45, 0), Def->TintColor, false, Draw);
			break;
		}
	}
	// Rarity base ring + beam for Epic and above (beam skipped on Low quality).
	BRVisuals::AddPart(this, VisualRoot, BRVisuals::Cylinder(), FVector(0, 0, -28), FVector(46, 46, 2), FRotator::ZeroRotator, Rarity, false, Draw);
	const bool bLow = UBRPerformanceSubsystem::GetQualityTierStatic(this) == EBRQualityTier::Low;
	if (int32(Def->Rarity) >= int32(EBRRarity::Epic) && !bLow)
	{
		BRVisuals::AddPart(this, VisualRoot, BRVisuals::Cylinder(), FVector(0, 0, 220), FVector(4, 4, 480), FRotator::ZeroRotator, Rarity, false, 20000.f);
	}
}

void ABRPickup::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!WasRecentlyRendered(0.5f)) { return; }
	SpinPhase += DeltaSeconds;
	VisualRoot->SetRelativeLocationAndRotation(FVector(0, 0, 10.f + FMath::Sin(SpinPhase * 2.f) * 6.f), FRotator(0.f, SpinPhase * 60.f, 0.f));
}

bool ABRPickup::CanInteract(const ABRCharacter* By) const
{
	return !bConsumed && !Stack.IsEmpty() && By && By->IsAliveAndWell() && !IsAutoPickup();
}

FText ABRPickup::GetInteractPrompt(const ABRCharacter* By) const
{
	const UBRItemDefinition* Def = UBRItemRegistry::Get()->Find(Stack.ItemId);
	if (!Def) { return FText::GetEmpty(); }
	if (Stack.Count > 1)
	{
		return FText::Format(LOCTEXT("PickupN", "Pegar {0} x{1} ({2})"), Def->DisplayName, FText::AsNumber(Stack.Count), BRTypes::RarityName(Def->Rarity));
	}
	return FText::Format(LOCTEXT("Pickup", "Pegar {0} ({1})"), Def->DisplayName, BRTypes::RarityName(Def->Rarity));
}

void ABRPickup::GiveTo(ABRCharacter* By, bool bSwapIfFull)
{
	if (!HasAuthority() || bConsumed || !By || !By->IsAliveAndWell() || By->IsInVehicle()) { return; }
	FBRItemStack Leftover;
	if (!By->GetInventory()->AddStack(Stack, Leftover, bSwapIfFull)) { return; }
	UBRProceduralAudio::PlaySfx(By, EBRSfx::Pickup, GetActorLocation());
	if (Leftover.IsEmpty())
	{
		bConsumed = true; // guard against double-pickup in the same frame (duplication)
		Destroy();
		return;
	}
	FlushNetDormancy();
	Stack = Leftover;
}

void ABRPickup::ExecuteInteract(ABRCharacter* By)
{
	GiveTo(By, true);
}

void ABRPickup::OnOverlap(UPrimitiveComponent* OverlappedComp, AActor* Other, UPrimitiveComponent* OtherComp, int32 BodyIndex, bool bFromSweep, const FHitResult& Sweep)
{
	if (IsAutoPickup())
	{
		GiveTo(Cast<ABRCharacter>(Other), false);
	}
}

#undef LOCTEXT_NAMESPACE
