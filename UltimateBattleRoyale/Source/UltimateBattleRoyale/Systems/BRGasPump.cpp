#include "Systems/BRGasPump.h"

#include "Audio/BRProceduralAudio.h"
#include "Core/BRVisuals.h"
#include "EngineUtils.h"
#include "Vehicles/BRVehicle.h"

#define LOCTEXT_NAMESPACE "BRGasPump"

ABRGasPump::ABRGasPump()
{
	bReplicates = true;
	NetCullDistanceSquared = FMath::Square(12000.f);
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
}

void ABRGasPump::BeginPlay()
{
	Super::BeginPlay();
	BRVisuals::AddPart(this, Root, BRVisuals::Cube(), FVector(0, 0, 90), FVector(60, 45, 180), FRotator::ZeroRotator, FLinearColor(0.9f, 0.9f, 0.9f), true, 12000.f);
	BRVisuals::AddPart(this, Root, BRVisuals::Cube(), FVector(0, 0, 150), FVector(62, 47, 40), FRotator::ZeroRotator, FLinearColor(0.85f, 0.2f, 0.18f), false, 12000.f);
	BRVisuals::AddPart(this, Root, BRVisuals::Cube(), FVector(0, 24, 110), FVector(30, 4, 25), FRotator::ZeroRotator, FLinearColor(0.1f, 0.1f, 0.1f), false, 6000.f);
}

ABRVehicle* ABRGasPump::FindVehicle() const
{
	ABRVehicle* Best = nullptr;
	float BestD = 900.f;
	for (TActorIterator<ABRVehicle> It(GetWorld()); It; ++It)
	{
		const float D = FVector::Dist(It->GetActorLocation(), GetActorLocation());
		if (D < BestD && !It->IsDestroyedVehicle()) { BestD = D; Best = *It; }
	}
	return Best;
}

bool ABRGasPump::CanInteract(const ABRCharacter* By) const
{
	const ABRVehicle* V = FindVehicle();
	return V && V->GetFuelFraction() < 0.99f;
}

FText ABRGasPump::GetInteractPrompt(const ABRCharacter* By) const
{
	return LOCTEXT("Refuel", "Abastecer veículo");
}

void ABRGasPump::ExecuteInteract(ABRCharacter* By)
{
	if (ABRVehicle* V = FindVehicle())
	{
		V->Refuel(1.f);
		UBRProceduralAudio::PlaySfx(this, EBRSfx::Refuel, GetActorLocation());
	}
}

#undef LOCTEXT_NAMESPACE
