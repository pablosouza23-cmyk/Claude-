#include "Building/BRBuildingPiece.h"

#include "Audio/BRProceduralAudio.h"
#include "Building/BRBuildGridSubsystem.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Core/BRVisuals.h"
#include "Net/UnrealNetwork.h"
#include "Settings/BRPerformanceSubsystem.h"
#include "Components/StaticMeshComponent.h"

ABRBuildingPiece::ABRBuildingPiece()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickInterval = 0.1f;
	bReplicates = true;
	NetCullDistanceSquared = FMath::Square(30000.f);
	NetUpdateFrequency = 5.f;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
	Tiles = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("Tiles"));
	Tiles->SetupAttachment(Root);
	Tiles->SetCollisionProfileName(UCollisionProfile::BlockAll_ProfileName);
	Tiles->SetCanEverAffectNavigation(true);
	Tiles->SetCachedMaxDrawDistance(30000.f);
	Tiles->bCastDynamicShadow = true;
}

void ABRBuildingPiece::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRBuildingPiece, Key);
	DOREPLIFETIME(ABRBuildingPiece, Material);
	DOREPLIFETIME(ABRBuildingPiece, EditMask);
	DOREPLIFETIME(ABRBuildingPiece, Health);
	DOREPLIFETIME(ABRBuildingPiece, MaxHealthNow);
	DOREPLIFETIME(ABRBuildingPiece, TeamId);
}

FVector ABRBuildingPiece::GetPieceExtent(EBRBuildPieceType Type)
{
	const float H = float(BRRules::BuildCellSize) * 0.5f;
	switch (Type)
	{
	case EBRBuildPieceType::Wall: return FVector(10.f, H, float(BRRules::BuildCellHeight) * 0.5f);
	case EBRBuildPieceType::Floor: return FVector(H, H, 10.f);
	case EBRBuildPieceType::Ramp: return FVector(FMath::Sqrt(FMath::Square(float(BRRules::BuildCellSize)) + FMath::Square(float(BRRules::BuildCellHeight))) * 0.5f, H, 10.f);
	default: return FVector(H, H, 45.f);
	}
}

FTransform ABRBuildingPiece::ComputeTransform(const FBRGridKey& InKey)
{
	const BRRules::PieceKey K = BRRules::NormalizeKey(InKey.ToRules());
	const FVector Center = BRTypes::ToFVector(BRRules::PieceWorldCenter(K));
	FRotator Rot(0.f, float(BRRules::PieceYawDeg(K)), 0.f);
	if (K.Type == BRRules::PieceType::Ramp) { Rot.Pitch = float(BRRules::RampPitchDeg()); }
	return FTransform(Rot, Center);
}

void ABRBuildingPiece::GetTileBoxes(EBRBuildPieceType Type, TArray<FTransform>& OutTiles)
{
	OutTiles.Reset();
	const float S = float(BRRules::BuildCellSize);
	const float Hgt = float(BRRules::BuildCellHeight);
	switch (Type)
	{
	case EBRBuildPieceType::Wall:
		for (int32 R = 0; R < 3; ++R)
		{
			for (int32 C = 0; C < 3; ++C)
			{
				const FVector Loc(0.f, -S * 0.5f + (C + 0.5f) * S / 3.f, Hgt * 0.5f - (R + 0.5f) * Hgt / 3.f);
				OutTiles.Add(BRVisuals::PartTransform(Loc, FVector(20.f, S / 3.f + 0.5f, Hgt / 3.f + 0.5f)));
			}
		}
		break;
	case EBRBuildPieceType::Floor:
	case EBRBuildPieceType::Ramp:
	{
		const float Len = Type == EBRBuildPieceType::Ramp ? FMath::Sqrt(S * S + Hgt * Hgt) : S;
		for (int32 R = 0; R < 2; ++R)
		{
			for (int32 C = 0; C < 2; ++C)
			{
				const FVector Loc(Len * 0.5f - (R + 0.5f) * Len * 0.5f, -S * 0.5f + (C + 0.5f) * S * 0.5f, 0.f);
				OutTiles.Add(BRVisuals::PartTransform(Loc, FVector(Len * 0.5f + 0.5f, S * 0.5f + 0.5f, 20.f)));
			}
		}
		break;
	}
	case EBRBuildPieceType::Roof:
		for (int32 R = 0; R < 2; ++R)
		{
			for (int32 C = 0; C < 2; ++C)
			{
				const float X = R == 0 ? S * 0.25f : -S * 0.25f;
				const float Y = C == 0 ? -S * 0.25f : S * 0.25f;
				// Each quarter slopes up toward the centre => pyramid roof.
				const FRotator Rot(R == 0 ? 18.f : -18.f, 0.f, C == 0 ? 18.f : -18.f);
				OutTiles.Add(BRVisuals::PartTransform(FVector(X, Y, 40.f), FVector(S * 0.5f + 20.f, S * 0.5f + 20.f, 18.f), Rot));
			}
		}
		break;
	}
}

void ABRBuildingPiece::InitPiece(const FBRGridKey& InKey, EBRBuildMaterial InMaterial, int32 InTeam, bool bInGrounded, bool bInstant)
{
	Key = FBRGridKey::FromRules(BRRules::NormalizeKey(InKey.ToRules()));
	Material = InMaterial;
	TeamId = InTeam;
	bGrounded = bInGrounded;
	EditMask = BRRules::FullMask(BRTypes::ToRules(Key.Type));
	const BRRules::MatStats Stats = BRRules::GetMatStats(BRTypes::ToRules(Material));
	BuildElapsed = bInstant ? float(Stats.BuildSeconds) : 0.f;
	MaxHealthNow = float(BRRules::MaxHealthDuringBuild(Stats, BuildElapsed));
	Health = MaxHealthNow;
	SetActorTransform(ComputeTransform(Key));
}

void ABRBuildingPiece::BeginPlay()
{
	Super::BeginPlay();
	SetActorTransform(ComputeTransform(Key));
	RebuildTiles();
	if (UBRBuildGridSubsystem* Grid = GetWorld()->GetSubsystem<UBRBuildGridSubsystem>())
	{
		Grid->Register(this);
		bRegistered = true;
	}
	SpawnAnimTime = 0.f;
	if (GetNetMode() != NM_DedicatedServer)
	{
		Root->SetRelativeScale3D(FVector(0.2f));
		UBRProceduralAudio::PlaySfx(this, EBRSfx::Build, GetActorLocation(), 0.7f);
	}
}

void ABRBuildingPiece::EndPlay(const EEndPlayReason::Type Reason)
{
	if (bRegistered)
	{
		if (UBRBuildGridSubsystem* Grid = GetWorld()->GetSubsystem<UBRBuildGridSubsystem>())
		{
			Grid->Unregister(this, Reason == EEndPlayReason::Destroyed);
		}
	}
	if (Reason == EEndPlayReason::Destroyed && GetNetMode() != NM_DedicatedServer) { SpawnDebris(); }
	Super::EndPlay(Reason);
}

void ABRBuildingPiece::OnRep_Visual()
{
	SetActorTransform(ComputeTransform(Key));
	RebuildTiles();
}

void ABRBuildingPiece::RebuildTiles()
{
	Tiles->SetStaticMesh(BRVisuals::Cube());
	Tiles->ClearInstances();
	TArray<FTransform> Boxes;
	GetTileBoxes(Key.Type, Boxes);
	const uint16 Mask = LocalPreviewMask >= 0 ? uint16(LocalPreviewMask) : EditMask;
	for (int32 I = 0; I < Boxes.Num(); ++I)
	{
		if (BRRules::IsTilePresent(Mask, I)) { Tiles->AddInstance(Boxes[I]); }
	}
	LastTintBand = -1;
	UpdateTint();
}

void ABRBuildingPiece::UpdateTint()
{
	if (GetNetMode() == NM_DedicatedServer) { return; }
	const float Frac = MaxHealthNow > 0.f ? Health / FMath::Max(1.f, float(BRRules::GetMatStats(BRTypes::ToRules(Material)).MaxHealth)) : 1.f;
	const int32 Band = FMath::Clamp(int32(Frac * 4.f), 0, 4) + (LocalPreviewMask >= 0 ? 10 : 0);
	if (Band == LastTintBand) { return; }
	LastTintBand = Band;
	FLinearColor Color = BRTypes::BuildMaterialColor(Material) * FMath::Lerp(0.55f, 1.f, FMath::Clamp(Frac, 0.f, 1.f));
	if (LocalPreviewMask >= 0) { Color = FMath::Lerp(Color, FLinearColor(0.2f, 0.5f, 1.f), 0.45f); }
	Color.A = 1.f;
	Tiles->SetMaterial(0, BRVisuals::ColorMaterial(Color));
}

void ABRBuildingPiece::SetEditMask(uint16 NewMask)
{
	if (!HasAuthority()) { return; }
	EditMask = NewMask;
	RebuildTiles();
}

void ABRBuildingPiece::SetLocalPreviewMask(int32 PreviewMask)
{
	LocalPreviewMask = PreviewMask;
	RebuildTiles();
}

int32 ABRBuildingPiece::TileIndexAt(const FVector& WorldPoint) const
{
	TArray<FTransform> Boxes;
	GetTileBoxes(Key.Type, Boxes);
	const FVector Local = GetActorTransform().InverseTransformPosition(WorldPoint);
	int32 Best = INDEX_NONE;
	float BestDist = TNumericLimits<float>::Max();
	for (int32 I = 0; I < Boxes.Num(); ++I)
	{
		const float D = FVector::DistSquared(Boxes[I].GetLocation(), Local);
		if (D < BestDist) { BestDist = D; Best = I; }
	}
	return Best;
}

void ABRBuildingPiece::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (GetNetMode() != NM_DedicatedServer && SpawnAnimTime < 0.25f)
	{
		SpawnAnimTime += DeltaSeconds;
		const float T = FMath::Clamp(SpawnAnimTime / 0.25f, 0.f, 1.f);
		Root->SetRelativeScale3D(FVector(FMath::InterpEaseOut(0.2f, 1.f, T, 2.f)));
	}
	if (HasAuthority())
	{
		const BRRules::MatStats Stats = BRRules::GetMatStats(BRTypes::ToRules(Material));
		if (BuildElapsed < Stats.BuildSeconds)
		{
			BuildElapsed += DeltaSeconds;
			const float NewMax = float(BRRules::MaxHealthDuringBuild(Stats, BuildElapsed));
			Health = FMath::Min(Health + (NewMax - MaxHealthNow), NewMax);
			MaxHealthNow = NewMax;
		}
		else if (GetNetMode() == NM_DedicatedServer)
		{
			SetActorTickEnabled(false);
		}
	}
	UpdateTint();
}

float ABRBuildingPiece::TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	if (!HasAuthority() || Damage <= 0.f || IsActorBeingDestroyed()) { return 0.f; }
	Health -= Damage;
	UpdateTint();
	if (Health <= 0.f)
	{
		Destroy();
	}
	return Damage;
}

void ABRBuildingPiece::SpawnDebris()
{
	if (UBRPerformanceSubsystem::GetQualityTierStatic(this) == EBRQualityTier::Low) { return; }
	UBRProceduralAudio::PlaySfx(this, EBRSfx::BuildBreak, GetActorLocation());
	FActorSpawnParameters SP;
	SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	AActor* Debris = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), GetActorTransform(), SP);
	if (!Debris) { return; }
	USceneComponent* DRoot = NewObject<USceneComponent>(Debris);
	Debris->SetRootComponent(DRoot);
	DRoot->RegisterComponent();
	DRoot->SetWorldTransform(GetActorTransform());
	const FLinearColor Color = BRTypes::BuildMaterialColor(Material);
	for (int32 I = 0; I < 6; ++I)
	{
		const FVector Offset(FMath::FRandRange(-20.f, 20.f), FMath::FRandRange(-200.f, 200.f), FMath::FRandRange(-150.f, 150.f));
		if (UStaticMeshComponent* Chunk = BRVisuals::AddPart(Debris, DRoot, BRVisuals::Cube(), Offset, FVector(45.f, 45.f, 30.f), FRotator(FMath::FRandRange(0.f, 90.f), 0.f, 0.f), Color, false))
		{
			Chunk->SetCollisionEnabled(ECollisionEnabled::PhysicsOnly);
			Chunk->SetCollisionResponseToAllChannels(ECR_Ignore);
			Chunk->SetCollisionResponseToChannel(ECC_WorldStatic, ECR_Block);
			Chunk->SetSimulatePhysics(true);
			Chunk->AddImpulse(FVector(FMath::FRandRange(-200.f, 200.f), FMath::FRandRange(-200.f, 200.f), 250.f), NAME_None, true);
		}
	}
	Debris->SetLifeSpan(2.f);
}
