#include "Systems/BRDoor.h"

#include "Audio/BRProceduralAudio.h"
#include "Characters/BRCharacter.h"
#include "Components/StaticMeshComponent.h"
#include "Core/BRVisuals.h"
#include "Inventory/BRInventoryComponent.h"
#include "Net/UnrealNetwork.h"
#include "Weapons/BRDamageTypes.h"

#define LOCTEXT_NAMESPACE "BRDoor"

ABRDoor::ABRDoor()
{
	PrimaryActorTick.bCanEverTick = true;
	bReplicates = true;
	NetCullDistanceSquared = FMath::Square(12000.f);
	NetUpdateFrequency = 4.f;

	Hinge = CreateDefaultSubobject<USceneComponent>(TEXT("Hinge"));
	RootComponent = Hinge;
	Panel = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Panel"));
	Panel->SetupAttachment(Hinge);
	// Door 160 x 235 cm, 8 cm thick; hinge at local origin, panel extends along +X.
	Panel->SetRelativeTransform(BRVisuals::PartTransform(FVector(80.f, 0.f, 120.f), FVector(160.f, 8.f, 235.f)));
	Panel->SetCollisionProfileName(UCollisionProfile::BlockAllDynamic_ProfileName);
	Panel->SetCachedMaxDrawDistance(12000.f);
}

void ABRDoor::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRDoor, OpenDirection);
	DOREPLIFETIME(ABRDoor, Color);
}

void ABRDoor::BeginPlay()
{
	Super::BeginPlay();
	Panel->SetStaticMesh(BRVisuals::Cube());
	Panel->SetMaterial(0, BRVisuals::ColorMaterial(Color));
	if (HasAuthority())
	{
		FTimerHandle H;
		GetWorldTimerManager().SetTimer(H, FTimerDelegate::CreateWeakLambda(this, [this]() { SetNetDormancy(DORM_DormantAll); }), 2.f, false);
	}
}

FVector ABRDoor::GetInteractLocation() const
{
	return Panel->GetComponentLocation();
}

FText ABRDoor::GetInteractPrompt(const ABRCharacter* By) const
{
	return OpenDirection == 0 ? LOCTEXT("Open", "Abrir porta") : LOCTEXT("Close", "Fechar porta");
}

void ABRDoor::ExecuteInteract(ABRCharacter* By)
{
	if (!HasAuthority() || !By) { return; }
	FlushNetDormancy();
	if (OpenDirection != 0)
	{
		OpenDirection = 0;
	}
	else
	{
		// Swing away from the user: which side of the door plane is the character on?
		const float Side = FVector::DotProduct(By->GetActorLocation() - GetActorLocation(), GetActorRightVector());
		OpenDirection = Side > 0.f ? -1 : 1;
	}
	OnRep_Open();
}

void ABRDoor::OnRep_Open()
{
	UBRProceduralAudio::PlaySfx(this, EBRSfx::Door, GetActorLocation());
	SetActorTickEnabled(true);
}

void ABRDoor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	const float Target = OpenDirection * 95.f;
	Angle = FMath::FInterpConstantTo(Angle, Target, DeltaSeconds, 360.f);
	Panel->SetRelativeRotation(FRotator(0.f, Angle, 0.f));
	Panel->SetRelativeLocation(FRotator(0.f, Angle, 0.f).RotateVector(FVector(80.f, 0.f, 120.f)));
	if (FMath::IsNearlyEqual(Angle, Target)) { SetActorTickEnabled(false); }
}

float ABRDoor::TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	if (!HasAuthority()) { return 0.f; }
	Health -= Damage;
	if (DamageEvent.DamageTypeClass && DamageEvent.DamageTypeClass->IsChildOf(UBRDamageType_Pickaxe::StaticClass()))
	{
		if (ABRCharacter* C = Cast<ABRCharacter>(DamageCauser)) { C->GetInventory()->AddMaterial(EBRBuildMaterial::Wood, 8); }
	}
	if (Health <= 0.f) { Destroy(); }
	return Damage;
}

#undef LOCTEXT_NAMESPACE
