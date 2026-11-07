#include "World/BRWorldGenerator.h"

#include "Characters/BRCharacter.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Core/BRSettings.h"
#include "Core/BRVisuals.h"
#include "Engine/Texture2D.h"
#include "Inventory/BRInventoryComponent.h"
#include "Net/UnrealNetwork.h"
#include "ProceduralMeshComponent.h"
#include "Settings/BRPerformanceSubsystem.h"
#include "Systems/BRDoor.h"
#include "Systems/BRDestructibleProp.h"
#include "Systems/BRGasPump.h"
#include "World/BRWorldSubsystem.h"
#include "Audio/BRProceduralAudio.h"
#include "UltimateBattleRoyale.h"

namespace
{
	using BRRules::Biome;

	FLinearColor BiomeColor(Biome B, double X, double Y)
	{
		switch (B)
		{
		case Biome::Ocean: case Biome::Riverbed: return FLinearColor(0.42f, 0.38f, 0.26f);
		case Biome::Beach: return FLinearColor(0.86f, 0.77f, 0.52f);
		case Biome::Forest: return FLinearColor(0.16f, 0.36f, 0.13f);
		case Biome::Farm:
			// Crop rows alternate colour every 8 m.
			return (int32(FMath::FloorToFloat(float(X) / 800.f)) & 1) ? FLinearColor(0.78f, 0.66f, 0.2f) : FLinearColor(0.55f, 0.6f, 0.18f);
		case Biome::Mountain: return FLinearColor(0.42f, 0.4f, 0.37f);
		case Biome::Snow: return FLinearColor(0.93f, 0.95f, 0.98f);
		case Biome::Urban: return FLinearColor(0.5f, 0.5f, 0.48f);
		case Biome::Road: return FLinearColor(0.16f, 0.16f, 0.18f);
		default: return FLinearColor(0.32f, 0.56f, 0.2f);
		}
	}

	const FLinearColor WallColors[] = {
		FLinearColor(0.85f, 0.82f, 0.74f), FLinearColor(0.72f, 0.42f, 0.32f), FLinearColor(0.55f, 0.66f, 0.78f),
		FLinearColor(0.93f, 0.86f, 0.6f), FLinearColor(0.6f, 0.75f, 0.6f), FLinearColor(0.78f, 0.78f, 0.8f),
	};
	const FLinearColor RoofColors[] = { FLinearColor(0.6f, 0.18f, 0.14f), FLinearColor(0.2f, 0.22f, 0.26f), FLinearColor(0.35f, 0.25f, 0.18f) };
	constexpr float Module = 400.f;
	constexpr float WallT = 25.f;
}

ABRWorldGenerator::ABRWorldGenerator()
{
	bReplicates = true;
	bAlwaysRelevant = true;
	NetUpdateFrequency = 2.f;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
}

void ABRWorldGenerator::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRWorldGenerator, Seed);
	DOREPLIFETIME(ABRWorldGenerator, Harvested);
}

void ABRWorldGenerator::BeginPlay()
{
	Super::BeginPlay();
	if (HasAuthority() && Seed == 0)
	{
		const int32 Fixed = UBRSettings::Get()->FixedWorldSeed;
		Seed = Fixed != 0 ? uint32(Fixed) : uint32(FMath::Rand()) | 1u;
	}
	if (Seed != 0) { Generate(); }
}

void ABRWorldGenerator::OnRep_Seed()
{
	if (!bGenerated && HasActorBegunPlay()) { Generate(); }
}

void ABRWorldGenerator::Generate()
{
	if (bGenerated) { return; }
	bGenerated = true;
	const double Start = FPlatformTime::Seconds();
	const float HalfSize = UBRSettings::Get()->MapHalfSizeCm;
	Model = MakeUnique<BRRules::WorldModel>(HalfSize, Seed);
	if (UBRWorldSubsystem* WS = GetWorld()->GetSubsystem<UBRWorldSubsystem>()) { WS->SetGenerator(this, Seed, HalfSize); }

	BuildTerrain();
	BuildWater();
	BuildSettlements();
	BuildRoadStructures();
	ScatterFoliage();
	FlushBatches();
	BuildMinimap();

	if (HasAuthority())
	{
		for (const FDoorSpot& D : DoorSpots)
		{
			FActorSpawnParameters SP;
			SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
			if (ABRDoor* Door = GetWorld()->SpawnActorDeferred<ABRDoor>(ABRDoor::StaticClass(), FTransform(FRotator(0, D.Yaw, 0), D.Hinge), nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn))
			{
				Door->SetDoorColor(D.Color);
				Door->FinishSpawning(FTransform(FRotator(0, D.Yaw, 0), D.Hinge));
			}
		}
		for (const TPair<uint8, FTransform>& P : PropSpots)
		{
			if (ABRDestructibleProp* Prop = GetWorld()->SpawnActorDeferred<ABRDestructibleProp>(ABRDestructibleProp::StaticClass(), P.Value, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn))
			{
				Prop->SetKind(EBRPropKind(P.Key));
				Prop->FinishSpawning(P.Value);
			}
		}
		for (const FTransform& T : PumpSpots)
		{
			GetWorld()->SpawnActor<ABRGasPump>(ABRGasPump::StaticClass(), T);
		}
	}

	UE_LOG(LogBR, Log, TEXT("World generated (seed %u) in %.2fs: %d loot spots, %d chests, %d doors, %d vehicles, %d batches."),
		Seed, FPlatformTime::Seconds() - Start, FloorLootSpots.Num(), ChestSpots.Num(), DoorSpots.Num(), VehicleSpawns.Num(), Batches.Num());
	OnWorldGenerated.Broadcast();
}

// ---------------------------------------------------------------------------------------------- terrain
void ABRWorldGenerator::BuildTerrain()
{
	const double Half = Model->GetHalfSize();
	const int32 ChunksPerSide = 10;
	const int32 QuadsPerChunk = 20;
	const double Cell = (Half * 2.0) / (ChunksPerSide * QuadsPerChunk);
	const bool bServerOnly = GetNetMode() == NM_DedicatedServer;

	UMaterialInterface* VertexColorMat = bServerOnly ? nullptr : LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/EngineDebugMaterials/VertexColorMaterial.VertexColorMaterial"));

	// Height/normal cache shared by all chunks (each grid vertex evaluated once).
	const int32 GridN = ChunksPerSide * QuadsPerChunk + 1;
	TArray<float> Heights; Heights.SetNumUninitialized(GridN * GridN);
	for (int32 Y = 0; Y < GridN; ++Y)
	{
		for (int32 X = 0; X < GridN; ++X)
		{
			Heights[Y * GridN + X] = float(Model->Height(-Half + X * Cell, -Half + Y * Cell));
		}
	}
	auto HeightAt = [&Heights, GridN](int32 X, int32 Y) { return Heights[FMath::Clamp(Y, 0, GridN - 1) * GridN + FMath::Clamp(X, 0, GridN - 1)]; };

	for (int32 CY = 0; CY < ChunksPerSide; ++CY)
	{
		for (int32 CX = 0; CX < ChunksPerSide; ++CX)
		{
			UProceduralMeshComponent* PMC = NewObject<UProceduralMeshComponent>(this);
			PMC->bUseAsyncCooking = true;
			PMC->SetupAttachment(Root);
			PMC->SetCollisionProfileName(UCollisionProfile::BlockAll_ProfileName);
			PMC->SetCanEverAffectNavigation(true);
			PMC->RegisterComponent();
			AddInstanceComponent(PMC);
			TerrainChunks.Add(PMC);

			// Section per biome when no vertex-colour material is available; one section otherwise.
			const int32 NumSections = (VertexColorMat || bServerOnly) ? 1 : int32(Biome::Count);
			TArray<TArray<FVector>> Verts; Verts.SetNum(NumSections);
			TArray<TArray<int32>> Tris; Tris.SetNum(NumSections);
			TArray<TArray<FVector>> Normals; Normals.SetNum(NumSections);
			TArray<TArray<FLinearColor>> Colors; Colors.SetNum(NumSections);
			TArray<TArray<FVector2D>> UVs; UVs.SetNum(NumSections);

			auto Sample = [&HeightAt, Half, Cell](int32 GX, int32 GY, FVector& OutPos, FVector& OutNormal)
			{
				OutPos = FVector(-Half + GX * Cell, -Half + GY * Cell, HeightAt(GX, GY));
				const double HX = HeightAt(GX + 1, GY) - HeightAt(GX - 1, GY);
				const double HY = HeightAt(GX, GY + 1) - HeightAt(GX, GY - 1);
				OutNormal = FVector(-HX, -HY, 2.0 * Cell).GetSafeNormal();
			};

			for (int32 QY = 0; QY < QuadsPerChunk; ++QY)
			{
				for (int32 QX = 0; QX < QuadsPerChunk; ++QX)
				{
					const int32 GX = CX * QuadsPerChunk + QX, GY = CY * QuadsPerChunk + QY;
					const double X0 = -Half + GX * Cell, Y0 = -Half + GY * Cell;
					const double MX = X0 + Cell * 0.5, MY = Y0 + Cell * 0.5;
					const Biome B = bServerOnly ? Biome::Grass : Model->BiomeAt(MX, MY, (HeightAt(GX, GY) + HeightAt(GX + 1, GY + 1)) * 0.5);
					const int32 S = NumSections == 1 ? 0 : int32(B);
					const FLinearColor Color = BiomeColor(B, MX, MY);
					const int32 Base = Verts[S].Num();
					const int32 Corners[4][2] = { { GX, GY }, { GX + 1, GY }, { GX + 1, GY + 1 }, { GX, GY + 1 } };
					for (const auto& C : Corners)
					{
						FVector P, N;
						Sample(C[0], C[1], P, N);
						Verts[S].Add(P); Normals[S].Add(N); Colors[S].Add(Color);
						UVs[S].Add(FVector2D(P.X / 1000.0, P.Y / 1000.0));
					}
					// Front faces are clockwise as seen from above in UE (X forward/up-screen, Y right).
					Tris[S].Append({ Base, Base + 1, Base + 2, Base, Base + 2, Base + 3 });
				}
			}

			for (int32 S = 0; S < NumSections; ++S)
			{
				if (Verts[S].Num() == 0) { continue; }
				PMC->CreateMeshSection_LinearColor(S, Verts[S], Tris[S], Normals[S], UVs[S], Colors[S], TArray<FProcMeshTangent>(), true);
				if (!bServerOnly)
				{
					UMaterialInterface* Mat = VertexColorMat ? VertexColorMat : BRVisuals::ColorMaterial(BiomeColor(Biome(S), 0.0, 0.0));
					PMC->SetMaterial(S, Mat);
				}
			}
			PMC->SetVisibility(!bServerOnly);
		}
	}
}

void ABRWorldGenerator::BuildWater()
{
	if (GetNetMode() == NM_DedicatedServer) { return; }
	UMaterialInterface* WaterMat = UBRSettings::Get()->WaterMaterial.IsNull() ? nullptr : UBRSettings::Get()->WaterMaterial.LoadSynchronous();
	const float Size = float(Model->GetHalfSize()) * 4.f;
	Water = BRVisuals::AddPart(this, Root, BRVisuals::Plane(), FVector(0, 0, float(BRRules::WorldModel::WaterLevel)), FVector(Size, Size, 1.f), FRotator::ZeroRotator, FLinearColor(0.08f, 0.36f, 0.55f), false);
	if (Water)
	{
		if (WaterMat) { Water->SetMaterial(0, WaterMat); }
		Water->bCastDynamicShadow = false;
	}
}

// ---------------------------------------------------------------------------------------------- helpers
void ABRWorldGenerator::Shape(UStaticMesh* Mesh, const FVector& Center, const FVector& Size, const FRotator& Rot, const FLinearColor& Color, bool bCollision)
{
	if (!Mesh) { return; }
	const FBatchKey Key{ Mesh, Color.ToFColor(false).DWColor(), bCollision };
	PendingBatches.FindOrAdd(Key).Add(BRVisuals::PartTransform(Center, Size, Rot));
}

void ABRWorldGenerator::Box(const FVector& Center, const FVector& Size, const FRotator& Rot, const FLinearColor& Color, bool bCollision)
{
	Shape(BRVisuals::Cube(), Center, Size, Rot, Color, bCollision);
}

void ABRWorldGenerator::LocalBox(const FVector& Origin, float Yaw, const FVector& LocalCenter, const FVector& Size, const FLinearColor& Color, const FRotator& LocalRot, bool bCollision)
{
	const FRotator YawRot(0.f, Yaw, 0.f);
	const FQuat Q = YawRot.Quaternion() * LocalRot.Quaternion();
	Box(Origin + YawRot.RotateVector(LocalCenter), Size, Q.Rotator(), Color, bCollision);
}

void ABRWorldGenerator::FlushBatches()
{
	const bool bServer = GetNetMode() == NM_DedicatedServer;
	const EBRQualityTier Tier = UBRPerformanceSubsystem::GetQualityTierStatic(this);
	const float CullEnd = float(BRRules::CullDistanceForTier(BRRules::QualityTier(uint8(Tier)), 60000.0));
	for (TPair<FBatchKey, TArray<FTransform>>& Pair : PendingBatches)
	{
		if (bServer && !Pair.Key.bCollision) { continue; }
		UHierarchicalInstancedStaticMeshComponent* H = NewObject<UHierarchicalInstancedStaticMeshComponent>(this);
		H->SetupAttachment(Root);
		H->SetMobility(EComponentMobility::Static);
		H->SetStaticMesh(const_cast<UStaticMesh*>(Pair.Key.Mesh));
		H->SetMaterial(0, BRVisuals::ColorMaterial(FLinearColor(FColor(Pair.Key.Color))));
		H->SetCollisionProfileName(Pair.Key.bCollision ? UCollisionProfile::BlockAll_ProfileName : UCollisionProfile::NoCollision_ProfileName);
		H->SetCanEverAffectNavigation(Pair.Key.bCollision);
		H->SetCullDistances(int32(CullEnd * 0.8f), int32(CullEnd));
		H->bCastDynamicShadow = Tier != EBRQualityTier::Low;
		H->SetVisibility(!bServer);
		H->RegisterComponent();
		AddInstanceComponent(H);
		H->AddInstances(Pair.Value, false, true);
		Batches.Add(H);
	}
	PendingBatches.Reset();
}

// ---------------------------------------------------------------------------------------------- foliage
void ABRWorldGenerator::ScatterFoliage()
{
	const double Half = Model->GetHalfSize();
	const double Step = 1200.0;
	const int32 N = int32(Half * 2.0 / Step);
	FoliageTransforms.SetNum(int32(EBRFoliage::Count));

	for (int32 IY = 0; IY < N; ++IY)
	{
		for (int32 IX = 0; IX < N; ++IX)
		{
			BRRules::Rng R(BRRules::Hash2D(IX, IY, Seed ^ 0xF011A6Eu));
			const double X = -Half + (IX + R.NextUnit()) * Step;
			const double Y = -Half + (IY + R.NextUnit()) * Step;
			const double H = Model->Height(X, Y);
			if (H < 60.0) { continue; }
			const int32 Poi = Model->PoiAt(X, Y);
			if (Poi >= 0 && BRRules::IsSettlement(BRRules::GetPoi(Poi).Kind)) { continue; }
			if (Model->RoadDistance(X, Y) < BRRules::WorldModel::RoadHalfWidth * 2.0) { continue; }
			const Biome B = Model->BiomeAt(X, Y, H);
			const double Roll = R.NextUnit();
			const float Scale = float(R.Range(0.8, 1.35));
			const float Yaw = float(R.Range(0.0, 360.0));
			const FVector Base(X, Y, H - 20.0);
			if (Roll < Model->TreeDensity(B))
			{
				EBRFoliage Type = EBRFoliage::Tree;
				if (B == Biome::Mountain || B == Biome::Snow) { Type = EBRFoliage::Pine; }
				else if (B == Biome::Beach) { Type = EBRFoliage::Palm; }
				else if (B == Biome::Forest && R.NextUnit() < 0.35) { Type = EBRFoliage::Pine; }
				FoliageTransforms[int32(Type)].Add(FTransform(FRotator(0, Yaw, 0), Base, FVector(Scale)));
			}
			else if (Roll < Model->TreeDensity(B) + (B == Biome::Mountain ? 0.1 : 0.025))
			{
				FoliageTransforms[int32(EBRFoliage::Rock)].Add(FTransform(FRotator(R.Range(-15, 15), Yaw, 0), Base, FVector(Scale)));
			}
			else if (Roll < Model->TreeDensity(B) + 0.2 && (B == Biome::Grass || B == Biome::Forest))
			{
				FoliageTransforms[int32(EBRFoliage::Bush)].Add(FTransform(FRotator(0, Yaw, 0), Base, FVector(Scale)));
			}
		}
	}

	const bool bServer = GetNetMode() == NM_DedicatedServer;
	const EBRQualityTier Tier = UBRPerformanceSubsystem::GetQualityTierStatic(this);
	const float Cull = float(BRRules::CullDistanceForTier(BRRules::QualityTier(uint8(Tier)), 45000.0));

	auto MakeHISM = [this, bServer, Tier, Cull](UStaticMesh* Mesh, const FLinearColor& Color, bool bCollision, float CullScale)
	{
		UHierarchicalInstancedStaticMeshComponent* H = NewObject<UHierarchicalInstancedStaticMeshComponent>(this);
		H->SetupAttachment(Root);
		H->SetMobility(EComponentMobility::Movable); // instances are hidden when harvested
		H->SetStaticMesh(Mesh);
		H->SetMaterial(0, BRVisuals::ColorMaterial(Color));
		H->SetCollisionProfileName(bCollision ? UCollisionProfile::BlockAll_ProfileName : UCollisionProfile::NoCollision_ProfileName);
		H->SetCullDistances(int32(Cull * CullScale * 0.8f), int32(Cull * CullScale));
		H->bCastDynamicShadow = Tier == EBRQualityTier::High;
		H->SetVisibility(!bServer);
		H->RegisterComponent();
		AddInstanceComponent(H);
		return H;
	};

	// Per type: trunk (collision, harvest target) + crown (visual only).
	struct FPart { UStaticMesh* Mesh; FVector Loc; FVector Size; FLinearColor Color; };
	const FPart Trunks[] = {
		{ BRVisuals::Cylinder(), FVector(0, 0, 250), FVector(45, 45, 500), FLinearColor(0.36f, 0.24f, 0.14f) },
		{ BRVisuals::Cylinder(), FVector(0, 0, 200), FVector(40, 40, 400), FLinearColor(0.3f, 0.2f, 0.12f) },
		{ BRVisuals::Cylinder(), FVector(0, 0, 350), FVector(35, 35, 700), FLinearColor(0.55f, 0.42f, 0.26f) },
		{ BRVisuals::Sphere(), FVector(0, 0, 40), FVector(260, 220, 160), FLinearColor(0.45f, 0.44f, 0.42f) },
		{ BRVisuals::Sphere(), FVector(0, 0, 40), FVector(140, 140, 100), FLinearColor(0.2f, 0.45f, 0.16f) },
	};
	const FPart Crowns[] = {
		{ BRVisuals::Sphere(), FVector(0, 0, 620), FVector(420, 420, 380), FLinearColor(0.2f, 0.48f, 0.16f) },
		{ BRVisuals::Cone(), FVector(0, 0, 650), FVector(380, 380, 700), FLinearColor(0.12f, 0.33f, 0.18f) },
		{ BRVisuals::Sphere(), FVector(0, 0, 720), FVector(420, 420, 110), FLinearColor(0.25f, 0.55f, 0.18f) },
		{ nullptr, FVector::ZeroVector, FVector::ZeroVector, FLinearColor::Black },
		{ nullptr, FVector::ZeroVector, FVector::ZeroVector, FLinearColor::Black },
	};

	for (int32 T = 0; T < int32(EBRFoliage::Count); ++T)
	{
		const bool bBush = T == int32(EBRFoliage::Bush);
		if (bServer && bBush) { FoliageTrunks.Add(nullptr); FoliageCrowns.Add(nullptr); continue; }
		UHierarchicalInstancedStaticMeshComponent* Trunk = MakeHISM(Trunks[T].Mesh, Trunks[T].Color, !bBush, bBush ? 0.5f : 1.f);
		TArray<FTransform> TrunkXf, CrownXf;
		for (const FTransform& Inst : FoliageTransforms[T])
		{
			TrunkXf.Add(BRVisuals::PartTransform(Trunks[T].Loc, Trunks[T].Size) * Inst);
			if (Crowns[T].Mesh) { CrownXf.Add(BRVisuals::PartTransform(Crowns[T].Loc, Crowns[T].Size) * Inst); }
		}
		Trunk->AddInstances(TrunkXf, false, true);
		FoliageTrunks.Add(Trunk);
		if (Crowns[T].Mesh && !bServer)
		{
			UHierarchicalInstancedStaticMeshComponent* Crown = MakeHISM(Crowns[T].Mesh, Crowns[T].Color, false, 1.2f);
			Crown->AddInstances(CrownXf, false, true);
			FoliageCrowns.Add(Crown);
		}
		else
		{
			FoliageCrowns.Add(nullptr);
		}
	}
	OnRep_Harvested();
}

bool ABRWorldGenerator::HarvestHit(const FHitResult& Hit, ABRCharacter* By)
{
	if (!HasAuthority() || !By || Hit.Item == INDEX_NONE) { return false; }
	const UPrimitiveComponent* HitComp = Hit.GetComponent();
	const int32 Type = FoliageTrunks.IndexOfByPredicate([HitComp](const TObjectPtr<UHierarchicalInstancedStaticMeshComponent>& C) { return C && C.Get() == HitComp; });
	if (Type == INDEX_NONE || Type == int32(EBRFoliage::Bush)) { return false; }
	const int32 Packed = (Type << 24) | (Hit.Item & 0xFFFFFF);
	if (Harvested.Contains(Packed)) { return true; }

	const EBRBuildMaterial Mat = Type == int32(EBRFoliage::Rock) ? EBRBuildMaterial::Stone : EBRBuildMaterial::Wood;
	float& HP = FoliageHealth.FindOrAdd(Packed, Type == int32(EBRFoliage::Rock) ? 300.f : 150.f);
	HP -= 50.f;
	By->GetInventory()->AddMaterial(Mat, BRRules::HarvestAmount(false, 2.0));
	UBRProceduralAudio::PlaySfx(By, Mat == EBRBuildMaterial::Wood ? EBRSfx::HarvestWood : EBRSfx::HarvestStone, Hit.ImpactPoint);
	if (HP <= 0.f)
	{
		By->GetInventory()->AddMaterial(Mat, 25);
		Harvested.Add(Packed);
		FoliageHealth.Remove(Packed);
		OnRep_Harvested();
	}
	return true;
}

void ABRWorldGenerator::OnRep_Harvested()
{
	if (FoliageTrunks.Num() == 0) { return; }
	for (; AppliedHarvested < Harvested.Num(); ++AppliedHarvested)
	{
		const int32 Packed = Harvested[AppliedHarvested];
		const int32 Type = Packed >> 24, Index = Packed & 0xFFFFFF;
		const FTransform Hidden(FQuat::Identity, FVector(0, 0, -100000.f), FVector(0.001f));
		if (FoliageTrunks.IsValidIndex(Type) && FoliageTrunks[Type]) { FoliageTrunks[Type]->UpdateInstanceTransform(Index, Hidden, true, true, true); }
		if (FoliageCrowns.IsValidIndex(Type) && FoliageCrowns[Type]) { FoliageCrowns[Type]->UpdateInstanceTransform(Index, Hidden, true, true, true); }
	}
}

// ---------------------------------------------------------------------------------------------- buildings
void ABRWorldGenerator::AddDoorSpot(const FVector& Hinge, float Yaw, const FLinearColor& Color)
{
	DoorSpots.Add({ Hinge, Yaw, Color });
}

void ABRWorldGenerator::AddProp(uint8 Kind, const FTransform& T)
{
	PropSpots.Add(TPair<uint8, FTransform>(Kind, T));
}

void ABRWorldGenerator::AddWallRun(const FBuildingSpec& S, const FVector& A, const FVector& B, float Z0, float Height, int32 Modules, int32 DoorModule, BRRules::Rng& Rng)
{
	// A,B: local start/end of the wall line (z = 0). Wall thickness extends inward.
	const FVector Dir = (B - A).GetSafeNormal();
	const float Len = (B - A).Size() / FMath::Max(1, Modules);
	const float WallYaw = FMath::RadiansToDegrees(FMath::Atan2(Dir.Y, Dir.X));
	auto Seg = [&](float From, float To, float Bottom, float Top)
	{
		if (To - From < 1.f || Top - Bottom < 1.f) { return; }
		const FVector Mid = A + Dir * ((From + To) * 0.5f) + FVector(0, 0, (Bottom + Top) * 0.5f);
		LocalBox(S.Origin, S.Yaw, Mid, FVector(To - From, WallT, Top - Bottom), S.Wall, FRotator(0, WallYaw, 0));
	};
	for (int32 M = 0; M < Modules; ++M)
	{
		const float F0 = M * Len, F1 = (M + 1) * Len;
		if (M == DoorModule)
		{
			const float Gap = 160.f, Side = (Len - Gap) * 0.5f;
			Seg(F0, F0 + Side, Z0, Z0 + Height);
			Seg(F1 - Side, F1, Z0, Z0 + Height);
			Seg(F0 + Side, F1 - Side, Z0 + 240.f, Z0 + Height);
			// Hinge on the left edge of the opening, door panel spans +X in its own frame.
			const FVector HingeLocal = A + Dir * (F0 + Side) + FVector(0, 0, Z0);
			AddDoorSpot(S.Origin + FRotator(0, S.Yaw, 0).RotateVector(HingeLocal), S.Yaw + WallYaw, FLinearColor(0.4f, 0.26f, 0.15f));
		}
		else if (S.bWindows && Rng.NextUnit() < 0.65)
		{
			const float Pillar = 70.f;
			Seg(F0, F0 + Pillar, Z0, Z0 + Height);
			Seg(F1 - Pillar, F1, Z0, Z0 + Height);
			Seg(F0 + Pillar, F1 - Pillar, Z0, Z0 + 100.f);
			Seg(F0 + Pillar, F1 - Pillar, Z0 + 230.f, Z0 + Height);
			// Window frame/sill trim (visual).
			const FVector Sill = A + Dir * ((F0 + F1) * 0.5f) + FVector(0, 0, Z0 + 100.f);
			LocalBox(S.Origin, S.Yaw, Sill, FVector(Len - 2 * Pillar, WallT + 12.f, 8.f), S.Trim, FRotator(0, WallYaw, 0), false);
		}
		else
		{
			Seg(F0, F1, Z0, Z0 + Height);
		}
	}
}

void ABRWorldGenerator::AddBuilding(const FBuildingSpec& S, BRRules::Rng& Rng)
{
	const float W = S.Width * Module, D = S.Depth * Module;
	const float X0 = -W * 0.5f, Y0 = -D * 0.5f, X1 = W * 0.5f, Y1 = D * 0.5f;
	const float H = S.FloorHeight;
	const FLinearColor FloorColor(0.55f, 0.5f, 0.45f);
	const FLinearColor Interior(0.8f, 0.78f, 0.72f);

	// Foundation down to the terrain (pads are flat, slopes get a plinth).
	LocalBox(S.Origin, S.Yaw, FVector(0, 0, -150.f + 10.f), FVector(W + 20.f, D + 20.f, 300.f), FLinearColor(0.4f, 0.4f, 0.4f));

	const bool bStairs = S.Floors > 1;
	const float StairW = 170.f;
	for (int32 F = 0; F < S.Floors; ++F)
	{
		const float Z = F * H;
		// Floor slab (with stairwell hole on upper floors).
		if (F == 0)
		{
			LocalBox(S.Origin, S.Yaw, FVector(0, 0, Z + 10.f), FVector(W, D, 20.f), FloorColor);
		}
		else
		{
			LocalBox(S.Origin, S.Yaw, FVector((X0 + Module + X1) * 0.5f, 0, Z + 10.f), FVector(W - Module, D, 20.f), FloorColor);
			LocalBox(S.Origin, S.Yaw, FVector(X0 + Module * 0.5f, (Y0 + StairW + Y1) * 0.5f, Z + 10.f), FVector(Module, D - StairW, 20.f), FloorColor);
		}

		// Exterior walls: front (-Y side) has the entrance on the ground floor.
		const int32 Door = (F == 0) ? S.Width / 2 : INDEX_NONE;
		AddWallRun(S, FVector(X0, Y0, 0), FVector(X1, Y0, 0), Z + 20.f, H - 20.f, S.Width, Door, Rng);
		AddWallRun(S, FVector(X1, Y1, 0), FVector(X0, Y1, 0), Z + 20.f, H - 20.f, S.Width, (F == 0 && S.Width >= 3) ? 0 : INDEX_NONE, Rng);
		AddWallRun(S, FVector(X1, Y0, 0), FVector(X1, Y1, 0), Z + 20.f, H - 20.f, S.Depth, INDEX_NONE, Rng);
		AddWallRun(S, FVector(X0, Y1, 0), FVector(X0, Y0, 0), Z + 20.f, H - 20.f, S.Depth, INDEX_NONE, Rng);

		// Interior partition with an opening.
		if (S.bInterior && S.Width >= 2 && S.Depth >= 2)
		{
			const float Gap = 180.f;
			const float PX = X0 + Module * FMath::Max(1, S.Width / 2);
			const float L0 = (D - Gap) * 0.5f;
			LocalBox(S.Origin, S.Yaw, FVector(PX, Y0 + L0 * 0.5f + (bStairs ? StairW * 0.5f : 0.f), Z + H * 0.5f), FVector(15.f, L0 - (bStairs ? StairW : 0.f), H - 20.f), Interior);
			LocalBox(S.Origin, S.Yaw, FVector(PX, Y1 - L0 * 0.5f, Z + H * 0.5f), FVector(15.f, L0, H - 20.f), Interior);
			// Furniture: table + shelf + bed/sofa (cover and loot hiding spots).
			const float TX = FMath::Lerp(PX, X1, 0.5f), TY = FMath::Lerp(Y0, Y1, float(Rng.Range(0.3, 0.7)));
			LocalBox(S.Origin, S.Yaw, FVector(TX, TY, Z + 20.f + 37.f), FVector(140.f, 80.f, 74.f), FLinearColor(0.45f, 0.3f, 0.18f));
			LocalBox(S.Origin, S.Yaw, FVector(X1 - 40.f, Y1 - 160.f, Z + 20.f + 90.f), FVector(50.f, 200.f, 180.f), FLinearColor(0.5f, 0.36f, 0.22f));
			LocalBox(S.Origin, S.Yaw, FVector(FMath::Lerp(X0, PX, 0.5f), Y1 - 70.f, Z + 20.f + 25.f), FVector(200.f, 110.f, 50.f), FLinearColor(0.3f, 0.35f, 0.55f));
		}

		// Stairs to the next floor: solid steps (29 cm) in the stairwell column.
		if (bStairs && F < S.Floors - 1)
		{
			const int32 Steps = 12;
			const float Rise = H / Steps, Run = (Module - 20.f) / Steps;
			for (int32 I = 0; I < Steps; ++I)
			{
				const float Top = Z + 20.f + Rise * (I + 1);
				const float SX = X0 + Module - 10.f - (I + 0.5f) * Run;
				LocalBox(S.Origin, S.Yaw, FVector(SX, Y0 + StairW * 0.5f + WallT, (Z + Top) * 0.5f), FVector(Run + 1.f, StairW - 10.f, Top - Z), FLinearColor(0.5f, 0.47f, 0.42f));
			}
		}

		// Loot: floor items in rooms, sometimes a chest.
		const FRotator YawRot(0, S.Yaw, 0);
		for (int32 L = 0; L < 2; ++L)
		{
			if (Rng.NextUnit() > S.LootChance) { continue; }
			const FVector Local(Rng.Range(X0 + Module, X1 - 80.f), Rng.Range(Y0 + StairW + 60.f, Y1 - 80.f), Z + 40.f);
			FloorLootSpots.Add(S.Origin + YawRot.RotateVector(Local));
		}
		if (Rng.NextUnit() < 0.22 * S.LootChance || S.bSecret)
		{
			const FVector Local(X1 - 90.f, Y0 + 80.f + WallT, Z + 50.f);
			(S.bSecret ? SpecialChestSpots : ChestSpots).Add(FTransform(FRotator(0, S.Yaw + 90.f, 0), S.Origin + YawRot.RotateVector(Local)));
		}
	}

	// Roof.
	const float Top = S.Floors * H;
	if (S.bGable)
	{
		const float Pitch = 30.f;
		const float Half = D * 0.5f + 40.f;
		const float SlopeLen = Half / FMath::Cos(FMath::DegreesToRadians(Pitch));
		const float Rise = Half * FMath::Tan(FMath::DegreesToRadians(Pitch));
		LocalBox(S.Origin, S.Yaw, FVector(0, 0, Top + 10.f), FVector(W, D, 20.f), FloorColor);
		LocalBox(S.Origin, S.Yaw, FVector(0, -Half * 0.5f, Top + Rise * 0.5f + 15.f), FVector(W + 60.f, SlopeLen, 18.f), S.Roof, FRotator(0, 0, Pitch));
		LocalBox(S.Origin, S.Yaw, FVector(0, Half * 0.5f, Top + Rise * 0.5f + 15.f), FVector(W + 60.f, SlopeLen, 18.f), S.Roof, FRotator(0, 0, -Pitch));
		// Gable ends.
		LocalBox(S.Origin, S.Yaw, FVector(X0, 0, Top + Rise * 0.35f), FVector(WallT, D * 0.6f, Rise * 0.7f), S.Wall);
		LocalBox(S.Origin, S.Yaw, FVector(X1, 0, Top + Rise * 0.35f), FVector(WallT, D * 0.6f, Rise * 0.7f), S.Wall);
	}
	else
	{
		LocalBox(S.Origin, S.Yaw, FVector(0, 0, Top + 10.f), FVector(W, D, 20.f), S.Roof);
		const float P = 90.f;
		LocalBox(S.Origin, S.Yaw, FVector(0, Y0, Top + P * 0.5f + 20.f), FVector(W, 20.f, P), S.Trim);
		LocalBox(S.Origin, S.Yaw, FVector(0, Y1, Top + P * 0.5f + 20.f), FVector(W, 20.f, P), S.Trim);
		LocalBox(S.Origin, S.Yaw, FVector(X0, 0, Top + P * 0.5f + 20.f), FVector(20.f, D, P), S.Trim);
		LocalBox(S.Origin, S.Yaw, FVector(X1, 0, Top + P * 0.5f + 20.f), FVector(20.f, D, P), S.Trim);
		if (Rng.NextUnit() < 0.4) { FloorLootSpots.Add(S.Origin + FVector(0, 0, Top + 50.f)); }
	}
}

void ABRWorldGenerator::AddTower(const FVector& Base, const FLinearColor& Color)
{
	// Observation tower: 4 legs, 3 platforms, zig-zag ramps (climbable), lookout with loot.
	const float Size = 500.f;
	for (int32 SX : { -1, 1 })
	{
		for (int32 SY : { -1, 1 })
		{
			Shape(BRVisuals::Cylinder(), Base + FVector(SX * Size * 0.5f, SY * Size * 0.5f, 700.f), FVector(35.f, 35.f, 1400.f), FRotator::ZeroRotator, Color);
		}
	}
	const float Levels[] = { 450.f, 900.f, 1350.f };
	for (int32 L = 0; L < 3; ++L)
	{
		const float Z = Levels[L];
		Box(Base + FVector(Size * 0.25f, 0, Z), FVector(Size * 0.5f + 40.f, Size + 40.f, 20.f), FRotator::ZeroRotator, FLinearColor(0.45f, 0.32f, 0.2f));
		const float PrevZ = L == 0 ? 0.f : Levels[L - 1];
		const float Rise = Z - PrevZ;
		// Ramp along Y in the free half of the tower, alternating direction each level (< 40 degrees: walkable).
		const float Run = Size + 100.f;
		const float Pitch = FMath::RadiansToDegrees(FMath::Atan2(Rise, Run));
		const float Len = FMath::Sqrt(Rise * Rise + Run * Run);
		const float Side = (L % 2 == 0) ? 1.f : -1.f;
		Box(Base + FVector(-Size * 0.25f + 40.f, 0.f, (Z + PrevZ) * 0.5f), FVector(Len, 150.f, 18.f), FRotator(Pitch * Side, 90.f, 0.f), FLinearColor(0.5f, 0.36f, 0.22f));
	}
	Box(Base + FVector(0, 0, 1350.f + 60.f), FVector(Size + 40.f, 15.f, 100.f), FRotator(0, 0, 0), Color);
	Box(Base + FVector(0, 0, 1700.f), FVector(Size + 120.f, Size + 120.f, 25.f), FRotator::ZeroRotator, FLinearColor(0.6f, 0.15f, 0.12f), false);
	FloorLootSpots.Add(Base + FVector(Size * 0.25f, 0, 1380.f));
	ChestSpots.Add(FTransform(FRotator::ZeroRotator, Base + FVector(Size * 0.3f, Size * 0.3f, 1400.f)));
}

void ABRWorldGenerator::AddGasStation(const FVector& Center, float Yaw, BRRules::Rng& Rng)
{
	const FRotator YawRot(0, Yaw, 0);
	// Canopy over the pumps.
	for (int32 SX : { -1, 1 })
	{
		for (int32 SY : { -1, 1 })
		{
			Shape(BRVisuals::Cylinder(), Center + YawRot.RotateVector(FVector(SX * 600.f, SY * 350.f, 250.f)), FVector(40, 40, 500), FRotator::ZeroRotator, FLinearColor(0.85f, 0.85f, 0.85f));
		}
	}
	Box(Center + FVector(0, 0, 520.f), FVector(1500.f, 950.f, 50.f), YawRot, FLinearColor(0.85f, 0.2f, 0.18f));
	for (int32 I = -1; I <= 1; I += 2)
	{
		PumpSpots.Add(FTransform(YawRot, Center + YawRot.RotateVector(FVector(I * 300.f, 0, 0))));
		VehicleSpawns.Add({ FTransform(YawRot, Center + YawRot.RotateVector(FVector(I * 300.f, 600.f, 120.f))), I < 0 ? EBRVehicleSpawnType::SportsCar : EBRVehicleSpawnType::Pickup });
	}
	FBuildingSpec Shop;
	Shop.Origin = Center + YawRot.RotateVector(FVector(0, -1300.f, 0));
	Shop.Yaw = Yaw; Shop.Width = 3; Shop.Depth = 2; Shop.Floors = 1; Shop.Wall = FLinearColor(0.95f, 0.95f, 0.9f);
	Shop.Roof = FLinearColor(0.85f, 0.2f, 0.18f); Shop.Trim = FLinearColor(0.85f, 0.2f, 0.18f);
	AddBuilding(Shop, Rng);
	AddProp(uint8(EBRPropKind::Barrel), FTransform(YawRot, Center + YawRot.RotateVector(FVector(900.f, -600.f, 50.f))));
	AddProp(uint8(EBRPropKind::Barrel), FTransform(YawRot, Center + YawRot.RotateVector(FVector(980.f, -650.f, 50.f))));
}

void ABRWorldGenerator::BuildSettlements()
{
	for (int32 I = 0; I < BRRules::WorldPoiCount; ++I)
	{
		const BRRules::Poi& P = BRRules::GetPoi(I);
		BRRules::Rng Rng(BRRules::HashCombine(Seed, uint32(I) * 7919u));
		const FVector C(Model->PoiX(I), Model->PoiY(I), Model->GetPadHeight(I));
		const float R = float(Model->PoiRadius(I));

		auto LotOk = [this](const FVector& L, float Clear)
		{
			return Model->RoadDistance(L.X, L.Y) > Clear && Model->Height(L.X, L.Y) > 150.0 && Model->RiverDistance(L.X, L.Y) > BRRules::WorldModel::RiverHalfWidth * 2.5;
		};
		auto FacingRoadYaw = [this](const FVector& L)
		{
			// Quantised yaw so the front door faces the nearest road.
			const double Eps = 400.0;
			const double DX = Model->RoadDistance(L.X + Eps, L.Y) - Model->RoadDistance(L.X - Eps, L.Y);
			const double DY = Model->RoadDistance(L.X, L.Y + Eps) - Model->RoadDistance(L.X, L.Y - Eps);
			const float Yaw = FMath::RadiansToDegrees(FMath::Atan2(float(-DY), float(-DX))); // direction toward road
			return FMath::RoundToFloat((Yaw + 90.f) / 90.f) * 90.f; // front (-Y local) faces the road
		};

		switch (P.Kind)
		{
		case BRRules::PoiKind::BigCity:
		case BRRules::PoiKind::City:
		{
			const bool bBig = P.Kind == BRRules::PoiKind::BigCity;
			const float Lot = 2600.f;
			const int32 N = int32(R / Lot);
			for (int32 GX = -N; GX <= N; ++GX)
			{
				for (int32 GY = -N; GY <= N; ++GY)
				{
					FVector L = C + FVector(GX * Lot, GY * Lot, 0.f);
					if (FVector::Dist2D(L, C) > R * 0.95f || !LotOk(L, 1500.f)) { continue; }
					FBuildingSpec S;
					S.Origin = FVector(L.X, L.Y, C.Z);
					S.Yaw = FacingRoadYaw(L);
					S.Width = Rng.RangeInt(3, 4); S.Depth = Rng.RangeInt(2, 4);
					const float CenterFactor = 1.f - FVector::Dist2D(L, C) / R;
					S.Floors = bBig ? FMath::Clamp(int32(2 + CenterFactor * 7 + Rng.RangeInt(0, 2)), 2, 9) : Rng.RangeInt(2, 4);
					S.Wall = WallColors[Rng.RangeInt(0, 5)];
					S.Trim = FLinearColor(0.25f, 0.25f, 0.28f);
					S.Roof = FLinearColor(0.3f, 0.3f, 0.32f);
					S.LootChance = 0.8f;
					AddBuilding(S, Rng);
					if (Rng.NextUnit() < 0.35)
					{
						const FVector Car = L + FRotator(0, S.Yaw, 0).RotateVector(FVector(0, -S.Depth * Module * 0.5f - 500.f, 0));
						if (Rng.NextUnit() < 0.5) { AddProp(uint8(EBRPropKind::CarWreck), FTransform(FRotator(0, S.Yaw + 90.f, 0), FVector(Car.X, Car.Y, C.Z + 60.f))); }
						else { VehicleSpawns.Add({ FTransform(FRotator(0, S.Yaw + 90.f, 0), FVector(Car.X, Car.Y, C.Z + 120.f)), Rng.NextUnit() < 0.5 ? EBRVehicleSpawnType::SportsCar : EBRVehicleSpawnType::Motorcycle }); }
					}
				}
			}
			// Street furniture: lamp posts and crates (cover).
			for (int32 K = 0; K < 30; ++K)
			{
				const FVector L = C + FVector(Rng.Range(-R, R), Rng.Range(-R, R), 0.f);
				if (FVector::Dist2D(L, C) > R || Model->RoadDistance(L.X, L.Y) > 1100.0 || Model->RoadDistance(L.X, L.Y) < 750.0) { continue; }
				Shape(BRVisuals::Cylinder(), FVector(L.X, L.Y, C.Z + 300.f), FVector(15, 15, 600), FRotator::ZeroRotator, FLinearColor(0.2f, 0.2f, 0.22f));
				Shape(BRVisuals::Sphere(), FVector(L.X, L.Y, C.Z + 610.f), FVector(50, 50, 30), FRotator::ZeroRotator, FLinearColor(1.f, 0.95f, 0.7f), false);
			}
			for (int32 K = 0; K < 12; ++K)
			{
				const FVector L = C + FVector(Rng.Range(-R, R), Rng.Range(-R, R), 0.f);
				if (FVector::Dist2D(L, C) < R && LotOk(L, 800.f)) { AddProp(uint8(EBRPropKind::Crate), FTransform(FRotator(0, Rng.Range(0, 90), 0), FVector(L.X, L.Y, C.Z + 50.f))); }
			}
			break;
		}
		case BRRules::PoiKind::Village:
		{
			const int32 Houses = Rng.RangeInt(6, 9);
			for (int32 H = 0; H < Houses; ++H)
			{
				const float Ang = (360.f / Houses) * H + float(Rng.Range(-12, 12));
				const float Dist = R * float(Rng.Range(0.35, 0.75));
				const FVector L = C + FRotator(0, Ang, 0).Vector() * Dist;
				if (!LotOk(L, 1200.f)) { continue; }
				FBuildingSpec S;
				S.Origin = FVector(L.X, L.Y, C.Z); S.Yaw = FacingRoadYaw(L);
				S.Width = Rng.RangeInt(2, 3); S.Depth = 2; S.Floors = Rng.RangeInt(1, 2); S.bGable = true;
				S.Wall = WallColors[Rng.RangeInt(0, 5)]; S.Roof = RoofColors[Rng.RangeInt(0, 2)]; S.Trim = FLinearColor::White;
				AddBuilding(S, Rng);
				if (Rng.NextUnit() < 0.5) { AddProp(uint8(EBRPropKind::Fence), FTransform(FRotator(0, S.Yaw, 0), L + FRotator(0, S.Yaw, 0).RotateVector(FVector(0, 700.f, 60.f)))); }
			}
			VehicleSpawns.Add({ FTransform(FRotator(0, Rng.Range(0, 360), 0), FVector(C.X + 400.f, C.Y, C.Z + 120.f)), EBRVehicleSpawnType::Pickup });
			break;
		}
		case BRRules::PoiKind::Farm:
		{
			FBuildingSpec Barn;
			Barn.Origin = C + FVector(-800.f, 600.f, 0.f); Barn.Origin.Z = C.Z; Barn.Yaw = 0.f;
			Barn.Width = 5; Barn.Depth = 4; Barn.Floors = 1; Barn.FloorHeight = 650.f; Barn.bGable = true; Barn.bWindows = false;
			Barn.Wall = FLinearColor(0.62f, 0.16f, 0.12f); Barn.Roof = FLinearColor(0.25f, 0.22f, 0.2f); Barn.Trim = FLinearColor::White; Barn.LootChance = 1.f;
			AddBuilding(Barn, Rng);
			FBuildingSpec House;
			House.Origin = FVector(C.X + 1600.f, C.Y - 1000.f, C.Z); House.Yaw = 90.f; House.Width = 3; House.Depth = 2; House.Floors = 2; House.bGable = true;
			House.Wall = FLinearColor(0.93f, 0.9f, 0.8f); House.Roof = RoofColors[0];
			AddBuilding(House, Rng);
			for (int32 K = 0; K < 3; ++K)
			{
				Shape(BRVisuals::Cylinder(), FVector(C.X - 2600.f, C.Y - 800.f + K * 600.f, C.Z + 700.f), FVector(450, 450, 1400), FRotator::ZeroRotator, FLinearColor(0.75f, 0.75f, 0.78f));
				Shape(BRVisuals::Cone(), FVector(C.X - 2600.f, C.Y - 800.f + K * 600.f, C.Z + 1500.f), FVector(480, 480, 200), FRotator::ZeroRotator, FLinearColor(0.5f, 0.5f, 0.55f));
			}
			for (int32 K = 0; K < 10; ++K)
			{
				const FVector L = C + FVector(Rng.Range(-R, R), Rng.Range(-R, R), 0.f);
				if (LotOk(L, 900.f)) { Shape(BRVisuals::Cylinder(), FVector(L.X, L.Y, C.Z + 75.f), FVector(150, 150, 150), FRotator(90, Rng.Range(0, 180), 0), FLinearColor(0.85f, 0.72f, 0.3f)); }
			}
			VehicleSpawns.Add({ FTransform(FRotator(0, 30, 0), FVector(C.X + 500.f, C.Y - 1600.f, C.Z + 120.f)), EBRVehicleSpawnType::Pickup });
			VehicleSpawns.Add({ FTransform(FRotator(0, 80, 0), FVector(C.X - 400.f, C.Y - 1800.f, C.Z + 120.f)), EBRVehicleSpawnType::Utility });
			break;
		}
		case BRRules::PoiKind::Military:
		{
			// Perimeter wall with two gates.
			const float Hw = R * 0.8f;
			const FLinearColor Concrete(0.55f, 0.56f, 0.52f);
			for (int32 Side = 0; Side < 4; ++Side)
			{
				const FRotator Rot(0, Side * 90.f, 0);
				const FVector Mid = C + Rot.RotateVector(FVector(Hw, 0, 0)) + FVector(0, 0, 200.f);
				const float Gate = (Side % 2 == 0) ? 900.f : 0.f;
				const float SegLen = Hw - Gate * 0.5f;
				Box(Mid + Rot.RotateVector(FVector(0, -(Gate * 0.5f + SegLen * 0.5f), 0)), FVector(60, SegLen, 400), Rot, Concrete);
				Box(Mid + Rot.RotateVector(FVector(0, (Gate * 0.5f + SegLen * 0.5f), 0)), FVector(60, SegLen, 400), Rot, Concrete);
			}
			for (int32 K = 0; K < 2; ++K)
			{
				FBuildingSpec Hangar;
				Hangar.Origin = C + FVector(-Hw * 0.45f, (K == 0 ? -1.f : 1.f) * Hw * 0.45f, 0.f); Hangar.Origin.Z = C.Z;
				Hangar.Yaw = K == 0 ? 0.f : 180.f; Hangar.Width = 5; Hangar.Depth = 4; Hangar.Floors = 1; Hangar.FloorHeight = 800.f;
				Hangar.Wall = FLinearColor(0.42f, 0.46f, 0.38f); Hangar.Roof = FLinearColor(0.3f, 0.33f, 0.28f); Hangar.bWindows = false; Hangar.LootChance = 1.f;
				AddBuilding(Hangar, Rng);
				FBuildingSpec Bunker;
				Bunker.Origin = C + FVector(Hw * 0.4f, (K == 0 ? -1.f : 1.f) * Hw * 0.35f, 0.f); Bunker.Origin.Z = C.Z;
				Bunker.Yaw = K == 0 ? 90.f : 270.f; Bunker.Width = 2; Bunker.Depth = 2; Bunker.Floors = 2;
				Bunker.Wall = Concrete; Bunker.Roof = Concrete; Bunker.Trim = Concrete; Bunker.LootChance = 1.f;
				AddBuilding(Bunker, Rng);
				AddTower(C + FVector((K == 0 ? -1.f : 1.f) * Hw * 0.85f, (K == 0 ? 1.f : -1.f) * Hw * 0.85f, 0.f), FLinearColor(0.35f, 0.38f, 0.3f));
				VehicleSpawns.Add({ FTransform(FRotator(0, 90.f * K, 0), C + FVector(Hw * 0.1f, (K == 0 ? -1.f : 1.f) * 600.f, 120.f)), EBRVehicleSpawnType::Utility });
			}
			for (int32 K = 0; K < 8; ++K)
			{
				const FVector L = C + FVector(Rng.Range(-Hw * 0.6, Hw * 0.6), Rng.Range(-Hw * 0.6, Hw * 0.6), 0.f);
				Box(FVector(L.X, L.Y, C.Z + 130.f), FVector(600, 240, 260), FRotator(0, Rng.RangeInt(0, 1) * 90.f, 0), FLinearColor(0.3f, 0.4f, 0.25f));
				AmmoBoxSpots.Add(FTransform(FRotator::ZeroRotator, FVector(L.X + 400.f, L.Y, C.Z + 30.f)));
			}
			SpecialChestSpots.Add(FTransform(FRotator::ZeroRotator, C + FVector(0, 0, 40.f)));
			break;
		}
		case BRRules::PoiKind::Industrial:
		{
			for (int32 K = 0; K < 3; ++K)
			{
				FBuildingSpec Ware;
				Ware.Origin = C + FVector(-R * 0.4f + K * R * 0.4f, -R * 0.35f, 0.f); Ware.Origin.Z = C.Z;
				Ware.Yaw = 0.f; Ware.Width = 6; Ware.Depth = 4; Ware.Floors = 1; Ware.FloorHeight = 900.f;
				Ware.Wall = FLinearColor(0.52f, 0.45f, 0.4f); Ware.Roof = FLinearColor(0.35f, 0.3f, 0.28f); Ware.bWindows = K != 1;
				AddBuilding(Ware, Rng);
			}
			const FLinearColor ContainerColors[] = { FLinearColor(0.7f, 0.2f, 0.15f), FLinearColor(0.15f, 0.35f, 0.65f), FLinearColor(0.2f, 0.5f, 0.25f), FLinearColor(0.85f, 0.6f, 0.1f) };
			for (int32 K = 0; K < 18; ++K)
			{
				const FVector L = C + FVector(Rng.Range(-R * 0.7, R * 0.7), Rng.Range(0.0, R * 0.6), 0.f);
				if (!LotOk(L, 900.f)) { continue; }
				const int32 Stack = Rng.RangeInt(1, 3);
				const float Yaw = Rng.RangeInt(0, 1) * 90.f;
				for (int32 S = 0; S < Stack; ++S) { Box(FVector(L.X, L.Y, C.Z + 130.f + S * 260.f), FVector(600, 240, 260), FRotator(0, Yaw, 0), ContainerColors[Rng.RangeInt(0, 3)]); }
				if (Rng.NextUnit() < 0.4) { AmmoBoxSpots.Add(FTransform(FRotator::ZeroRotator, FVector(L.X, L.Y + 300.f, C.Z + 30.f))); }
			}
			Shape(BRVisuals::Cylinder(), C + FVector(R * 0.6f, R * 0.6f, 2500.f), FVector(300, 300, 5000), FRotator::ZeroRotator, FLinearColor(0.55f, 0.35f, 0.3f));
			for (int32 K = 0; K < 2; ++K)
			{
				Shape(BRVisuals::Cylinder(), C + FVector(R * 0.2f + K * 800.f, R * 0.55f, 900.f), FVector(600, 600, 1800), FRotator::ZeroRotator, FLinearColor(0.7f, 0.7f, 0.72f));
			}
			for (int32 K = 0; K < 8; ++K) { AddProp(uint8(EBRPropKind::Barrel), FTransform(FVector(C.X + Rng.Range(-R * 0.5, R * 0.5), C.Y + R * 0.1f, C.Z + 50.f))); }
			VehicleSpawns.Add({ FTransform(FRotator(0, 0, 0), C + FVector(0, R * 0.2f, 120.f)), EBRVehicleSpawnType::Utility });
			break;
		}
		case BRRules::PoiKind::GasStation:
			AddGasStation(C, FacingRoadYaw(C), Rng);
			break;
		case BRRules::PoiKind::Secret:
		{
			FBuildingSpec S;
			S.Origin = C; S.Yaw = 0.f; S.Width = 2; S.Depth = 2; S.Floors = 1; S.bWindows = false; S.bSecret = true;
			S.Wall = FLinearColor(0.35f, 0.36f, 0.33f); S.Roof = FLinearColor(0.28f, 0.3f, 0.26f); S.Trim = S.Roof;
			AddBuilding(S, Rng);
			// Camouflage: rocks piled around the bunker.
			for (int32 K = 0; K < 8; ++K)
			{
				Shape(BRVisuals::Sphere(), C + FRotator(0, K * 45.f, 0).Vector() * 650.f + FVector(0, 0, 150.f), FVector(500, 420, 380), FRotator(0, K * 30.f, 0), FLinearColor(0.45f, 0.44f, 0.4f));
			}
			break;
		}
		case BRRules::PoiKind::Tower:
			AddTower(C, FLinearColor(0.42f, 0.3f, 0.2f));
			break;
		case BRRules::PoiKind::Beach:
		{
			for (int32 K = 0; K < 8; ++K)
			{
				const FVector L = C + FVector(Rng.Range(-R, R), Rng.Range(-R * 0.4, R * 0.4), 0.f);
				const double H = Model->Height(L.X, L.Y);
				if (H < 60.0) { continue; }
				Shape(BRVisuals::Cylinder(), FVector(L.X, L.Y, H + 150.f), FVector(8, 8, 300), FRotator::ZeroRotator, FLinearColor::White);
				Shape(BRVisuals::Cone(), FVector(L.X, L.Y, H + 300.f), FVector(300, 300, 80), FRotator::ZeroRotator, K % 2 ? FLinearColor(0.95f, 0.3f, 0.3f) : FLinearColor(0.2f, 0.6f, 0.95f), false);
			}
			const FVector Life = C + FVector(0, R * 0.2f, 0.f);
			const double LH = Model->Height(Life.X, Life.Y);
			if (LH > 50.0)
			{
				const FVector B(Life.X, Life.Y, LH);
				for (int32 SX : { -1, 1 }) { for (int32 SY : { -1, 1 }) { Shape(BRVisuals::Cylinder(), B + FVector(SX * 150.f, SY * 150.f, 200.f), FVector(20, 20, 400), FRotator::ZeroRotator, FLinearColor::White); } }
				Box(B + FVector(0, 0, 400.f), FVector(400, 400, 20), FRotator::ZeroRotator, FLinearColor(0.9f, 0.85f, 0.6f));
				Box(B + FVector(0, 0, 600.f), FVector(420, 420, 20), FRotator::ZeroRotator, FLinearColor(0.95f, 0.3f, 0.3f), false);
				Box(B + FVector(250.f, 0, 200.f), FVector(460, 120, 15), FRotator(-55, 0, 0), FLinearColor(0.9f, 0.85f, 0.6f));
				ChestSpots.Add(FTransform(B + FVector(0, 0, 440.f)));
			}
			// Boats moored in the sea just off the beach.
			for (int32 K = 0; K < 3; ++K)
			{
				const FVector Sea = C + FVector(-R * 0.6f + K * R * 0.6f, -R * 1.1f, 0.f);
				if (Model->Height(Sea.X, Sea.Y) < -100.0) { VehicleSpawns.Add({ FTransform(FRotator(0, 90, 0), FVector(Sea.X, Sea.Y, 40.f)), EBRVehicleSpawnType::Boat }); }
			}
			break;
		}
		case BRRules::PoiKind::Lake:
		{
			const FVector Dock = C + FVector(R * 0.85f, 0, 0);
			const double DH = Model->Height(Dock.X, Dock.Y);
			Box(FVector(Dock.X - 300.f, Dock.Y, FMath::Max(40.0, DH) + 30.f), FVector(900, 250, 30), FRotator::ZeroRotator, FLinearColor(0.5f, 0.36f, 0.22f));
			VehicleSpawns.Add({ FTransform(FRotator(0, 180, 0), FVector(C.X + R * 0.4f, C.Y, 40.f)), EBRVehicleSpawnType::Boat });
			VehicleSpawns.Add({ FTransform(FRotator(0, 0, 0), FVector(C.X - R * 0.3f, C.Y + R * 0.2f, 40.f)), EBRVehicleSpawnType::Boat });
			break;
		}
		default:
			break;
		}
	}
}

void ABRWorldGenerator::BuildRoadStructures()
{
	// Bridges over water and tunnel roofs where roads cut deep into hills.
	const FLinearColor Deck(0.35f, 0.35f, 0.37f);
	const FLinearColor Rail(0.75f, 0.75f, 0.7f);
	const float W = float(BRRules::WorldModel::RoadHalfWidth) * 2.f;
	for (int32 R = 0; R < BRRules::WorldRoadCount; ++R)
	{
		int32 A, B; BRRules::GetRoad(R, A, B);
		const FVector PA(Model->PoiX(A), Model->PoiY(A), Model->GetPadHeight(A));
		const FVector PB(Model->PoiX(B), Model->PoiY(B), Model->GetPadHeight(B));
		const float Len = FVector::Dist2D(PA, PB);
		const FVector Dir = (PB - PA).GetSafeNormal2D();
		const float Yaw = Dir.Rotation().Yaw;
		const int32 Steps = int32(Len / 500.f);
		int32 BridgeRun = 0;
		for (int32 I = 0; I <= Steps; ++I)
		{
			const float T = float(I) / FMath::Max(1, Steps);
			const FVector P = FMath::Lerp(PA, PB, T);
			const double Ground = Model->Height(P.X, P.Y);
			const float RoadZ = FMath::Lerp(PA.Z, PB.Z, T);
			if (Ground < 80.0)
			{
				const float DeckZ = FMath::Max(RoadZ, 380.f);
				Box(FVector(P.X, P.Y, DeckZ - 20.f), FVector(520.f, W, 40.f), FRotator(0, Yaw, 0), Deck);
				Box(FVector(P.X, P.Y, DeckZ + 50.f) + FRotator(0, Yaw, 0).RotateVector(FVector(0, W * 0.5f, 0)), FVector(520.f, 20.f, 100.f), FRotator(0, Yaw, 0), Rail);
				Box(FVector(P.X, P.Y, DeckZ + 50.f) + FRotator(0, Yaw, 0).RotateVector(FVector(0, -W * 0.5f, 0)), FVector(520.f, 20.f, 100.f), FRotator(0, Yaw, 0), Rail);
				if (++BridgeRun % 4 == 0) { Shape(BRVisuals::Cylinder(), FVector(P.X, P.Y, DeckZ * 0.5f - 300.f), FVector(150.f, 150.f, DeckZ + 600.f), FRotator::ZeroRotator, Deck); }
				continue;
			}
			BridgeRun = 0;
			const double Natural = Model->RawHeight(P.X, P.Y);
			if (Natural - RoadZ > 900.0)
			{
				// Tunnel segment: walls + roof over the road cut.
				const FRotator Rot(0, Yaw, 0);
				Box(FVector(P.X, P.Y, RoadZ + 700.f), FVector(520.f, W + 200.f, 60.f), Rot, FLinearColor(0.4f, 0.4f, 0.4f));
				Box(FVector(P.X, P.Y, RoadZ + 350.f) + Rot.RotateVector(FVector(0, W * 0.5f + 70.f, 0)), FVector(520.f, 60.f, 700.f), Rot, FLinearColor(0.45f, 0.45f, 0.45f));
				Box(FVector(P.X, P.Y, RoadZ + 350.f) + Rot.RotateVector(FVector(0, -W * 0.5f - 70.f, 0)), FVector(520.f, 60.f, 700.f), Rot, FLinearColor(0.45f, 0.45f, 0.45f));
				if (I % 6 == 0) { Shape(BRVisuals::Sphere(), FVector(P.X, P.Y, RoadZ + 660.f), FVector(60, 60, 20), FRotator::ZeroRotator, FLinearColor(1.f, 0.9f, 0.6f), false); }
			}
		}
	}
}

// ---------------------------------------------------------------------------------------------- minimap
void ABRWorldGenerator::BuildMinimap()
{
	if (GetNetMode() == NM_DedicatedServer) { return; }
	const int32 Res = 256;
	MinimapTexture = UTexture2D::CreateTransient(Res, Res, PF_B8G8R8A8);
	if (!MinimapTexture) { return; }
	MinimapTexture->Filter = TF_Bilinear;
	MinimapTexture->SRGB = true;
	TArray<FColor> Pixels;
	Pixels.SetNum(Res * Res);
	const double Half = Model->GetHalfSize();
	for (int32 Y = 0; Y < Res; ++Y)
	{
		for (int32 X = 0; X < Res; ++X)
		{
			// Texture row 0 = north (+Y world).
			const double WX = -Half + (X + 0.5) / Res * Half * 2.0;
			const double WY = Half - (Y + 0.5) / Res * Half * 2.0;
			const double H = Model->Height(WX, WY);
			FLinearColor C = H < 0.0 ? FLinearColor(0.12f, 0.42f, 0.62f) : BiomeColor(Model->BiomeAt(WX, WY, H), WX, WY);
			if (H >= 0.0) { C *= 0.85f + 0.15f * float(FMath::Clamp(H / 9000.0, 0.0, 1.0)); }
			Pixels[Y * Res + X] = C.ToFColor(true);
		}
	}
	FTexture2DMipMap& Mip = MinimapTexture->GetPlatformData()->Mips[0];
	void* Data = Mip.BulkData.Lock(LOCK_READ_WRITE);
	FMemory::Memcpy(Data, Pixels.GetData(), Pixels.Num() * sizeof(FColor));
	Mip.BulkData.Unlock();
	MinimapTexture->UpdateResource();
}
