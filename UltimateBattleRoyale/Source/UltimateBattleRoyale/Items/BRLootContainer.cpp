#include "Items/BRLootContainer.h"

#include "Audio/BRProceduralAudio.h"
#include "Characters/BRCharacter.h"
#include "Components/BoxComponent.h"
#include "Core/BRVisuals.h"
#include "GameModes/BRPlayerState.h"
#include "Items/BRLootSubsystem.h"
#include "Net/UnrealNetwork.h"

#define LOCTEXT_NAMESPACE "BRLootContainer"

ABRLootContainer::ABRLootContainer()
{
	PrimaryActorTick.bCanEverTick = true;
	bReplicates = true;
	NetCullDistanceSquared = FMath::Square(20000.f);
	NetUpdateFrequency = 2.f;

	Box = CreateDefaultSubobject<UBoxComponent>(TEXT("Box"));
	Box->InitBoxExtent(FVector(45.f, 30.f, 30.f));
	Box->SetCollisionProfileName(UCollisionProfile::BlockAllDynamic_ProfileName);
	RootComponent = Box;
}

void ABRLootContainer::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRLootContainer, Kind);
	DOREPLIFETIME(ABRLootContainer, bOpened);
	DOREPLIFETIME(ABRLootContainer, bLanded);
}

void ABRLootContainer::InitContainer(EBRContainerKind InKind)
{
	Kind = InKind;
	bLanded = Kind != EBRContainerKind::SupplyDrop;
	SetReplicatingMovement(Kind == EBRContainerKind::SupplyDrop);
	if (Kind == EBRContainerKind::SupplyDrop) { NetUpdateFrequency = 10.f; NetCullDistanceSquared = FMath::Square(60000.f); }
	BuildVisual();
}

void ABRLootContainer::BeginPlay()
{
	Super::BeginPlay();
	BuildVisual();
	SetActorTickEnabled(Kind == EBRContainerKind::SupplyDrop || GetNetMode() != NM_DedicatedServer);
}

void ABRLootContainer::OnRep_Kind() { BuildVisual(); }

void ABRLootContainer::BuildVisual()
{
	if (GetNetMode() == NM_DedicatedServer) { return; }
	TArray<USceneComponent*> Old;
	Box->GetChildrenComponents(true, Old);
	for (USceneComponent* C : Old) { C->DestroyComponent(); }
	Lid = nullptr; Balloon = nullptr;

	auto Part = [this](USceneComponent* Parent, UStaticMesh* M, FVector L, FVector S, FLinearColor C)
	{
		return BRVisuals::AddPart(this, Parent, M, L, S, FRotator::ZeroRotator, C, false, 15000.f);
	};

	switch (Kind)
	{
	case EBRContainerKind::AmmoBox:
		Box->SetBoxExtent(FVector(35.f, 22.f, 18.f));
		Part(Box, BRVisuals::Cube(), FVector::ZeroVector, FVector(70, 44, 36), FLinearColor(0.2f, 0.32f, 0.16f));
		Lid = Part(Box, BRVisuals::Cube(), FVector(0, 0, 19), FVector(72, 46, 4), FLinearColor(0.15f, 0.25f, 0.12f));
		break;
	case EBRContainerKind::SupplyDrop:
		Box->SetBoxExtent(FVector(60.f, 60.f, 60.f));
		Part(Box, BRVisuals::Cube(), FVector::ZeroVector, FVector(120, 120, 120), FLinearColor(0.1f, 0.35f, 0.75f));
		Part(Box, BRVisuals::Cube(), FVector(0, 0, 0), FVector(124, 20, 124), FLinearColor(0.95f, 0.75f, 0.1f));
		Lid = Part(Box, BRVisuals::Cube(), FVector(0, 0, 62), FVector(124, 124, 6), FLinearColor(0.08f, 0.28f, 0.6f));
		Balloon = Part(Box, BRVisuals::Sphere(), FVector(0, 0, 420), FVector(300, 300, 340), FLinearColor(0.2f, 0.55f, 1.f));
		Part(Balloon, BRVisuals::Cylinder(), FVector(0, 0, -0.45f), FVector(0.01f, 0.01f, 0.6f), FLinearColor::White);
		break;
	case EBRContainerKind::Llama:
		Box->SetBoxExtent(FVector(50.f, 30.f, 70.f));
		Part(Box, BRVisuals::Cube(), FVector(0, 0, 0), FVector(90, 50, 60), FLinearColor(0.55f, 0.3f, 0.75f));
		Part(Box, BRVisuals::Cube(), FVector(40, 0, 50), FVector(20, 22, 60), FLinearColor(0.55f, 0.3f, 0.75f));
		Part(Box, BRVisuals::Sphere(), FVector(48, 0, 82), FVector(32, 26, 26), FLinearColor(0.95f, 0.8f, 0.2f));
		break;
	default:
		Box->SetBoxExtent(FVector(45.f, 30.f, 30.f));
		Part(Box, BRVisuals::Cube(), FVector::ZeroVector, FVector(90, 60, 50), FLinearColor(0.5f, 0.32f, 0.12f));
		Part(Box, BRVisuals::Cube(), FVector(0, 0, 0), FVector(92, 62, 8), FLinearColor(0.85f, 0.68f, 0.15f));
		Lid = Part(Box, BRVisuals::Cube(), FVector(0, 0, 30), FVector(92, 62, 12), FLinearColor(0.85f, 0.68f, 0.15f));
		break;
	}
	OnRep_Opened();
}

void ABRLootContainer::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (Kind == EBRContainerKind::SupplyDrop && !bLanded && HasAuthority())
	{
		const FVector Loc = GetActorLocation();
		const FVector Next = Loc - FVector(0, 0, 450.f * DeltaSeconds);
		FHitResult Hit;
		FCollisionQueryParams Params(SCENE_QUERY_STAT(BRSupplyDrop), false, this);
		if (GetWorld()->LineTraceSingleByChannel(Hit, Loc, Next - FVector(0, 0, 61.f), ECC_Visibility, Params))
		{
			SetActorLocation(Hit.ImpactPoint + FVector(0, 0, 61.f));
			bLanded = true;
			UBRProceduralAudio::PlaySfx(this, EBRSfx::Land, GetActorLocation(), 1.f);
		}
		else
		{
			SetActorLocation(Next);
		}
	}
	if (Balloon) { Balloon->SetVisibility(!bLanded); }
	if (Lid && bOpened && LidAngle < 100.f)
	{
		LidAngle = FMath::Min(100.f, LidAngle + DeltaSeconds * 300.f);
		Lid->SetRelativeRotation(FRotator(0.f, 0.f, -LidAngle));
	}
}

void ABRLootContainer::OnRep_Opened()
{
	if (bOpened && GetNetMode() != NM_DedicatedServer)
	{
		UBRProceduralAudio::PlaySfx(this, EBRSfx::ChestOpen, GetActorLocation());
	}
}

bool ABRLootContainer::CanInteract(const ABRCharacter* By) const
{
	return !bOpened && bLanded && By && By->IsAliveAndWell();
}

FText ABRLootContainer::GetInteractPrompt(const ABRCharacter* By) const
{
	switch (Kind)
	{
	case EBRContainerKind::AmmoBox: return LOCTEXT("OpenAmmo", "Abrir caixa de munição");
	case EBRContainerKind::SupplyDrop: return LOCTEXT("OpenDrop", "Abrir suprimentos");
	case EBRContainerKind::Llama: return LOCTEXT("OpenLlama", "Abrir carga especial");
	default: return LOCTEXT("OpenChest", "Abrir baú");
	}
}

float ABRLootContainer::GetInteractDuration(const ABRCharacter* By) const
{
	switch (Kind)
	{
	case EBRContainerKind::AmmoBox: return 0.3f;
	case EBRContainerKind::SupplyDrop: return 1.2f;
	case EBRContainerKind::Llama: return 1.5f;
	default: return 0.6f;
	}
}

void ABRLootContainer::ExecuteInteract(ABRCharacter* By)
{
	if (!HasAuthority() || bOpened) { return; }
	bOpened = true;
	FlushNetDormancy();
	OnRep_Opened();
	if (UBRLootSubsystem* Loot = GetWorld()->GetSubsystem<UBRLootSubsystem>())
	{
		Loot->SpawnContainerLoot(Kind, GetActorLocation() + GetActorForwardVector() * 90.f);
	}
	if (By && Kind != EBRContainerKind::AmmoBox)
	{
		if (ABRPlayerState* PS = By->GetBRPlayerState()) { PS->AddChestOpened(); }
	}
	SetLifeSpan(Kind == EBRContainerKind::SupplyDrop ? 20.f : 0.f);
}

#undef LOCTEXT_NAMESPACE
