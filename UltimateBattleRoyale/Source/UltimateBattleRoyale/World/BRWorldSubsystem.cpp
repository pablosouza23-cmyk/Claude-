#include "World/BRWorldSubsystem.h"

#include "World/BRWorldGenerator.h"

void UBRWorldSubsystem::SetGenerator(ABRWorldGenerator* InGenerator, uint32 Seed, double HalfSize)
{
	Generator = InGenerator;
	Model = MakeUnique<BRRules::WorldModel>(HalfSize, Seed);
	NamedLocations.Reset();
	for (int32 I = 0; I < BRRules::WorldPoiCount; ++I)
	{
		const BRRules::Poi& P = BRRules::GetPoi(I);
		FBRNamedLocation L;
		L.Name = FText::FromString(UTF8_TO_TCHAR(P.Name));
		L.Location = FVector(Model->PoiX(I), Model->PoiY(I), Model->Height(Model->PoiX(I), Model->PoiY(I)));
		L.Radius = float(Model->PoiRadius(I));
		NamedLocations.Add(L);
	}
}

float UBRWorldSubsystem::GetTerrainHeight(float X, float Y) const
{
	return Model ? float(Model->Height(X, Y)) : 0.f;
}

bool UBRWorldSubsystem::GetWaterSurfaceZ(const FVector& Location, float& OutZ) const
{
	if (!Model) { return false; }
	if (Model->Height(Location.X, Location.Y) >= BRRules::WorldModel::WaterLevel) { return false; }
	OutZ = float(BRRules::WorldModel::WaterLevel);
	return true;
}

bool UBRWorldSubsystem::IsLand(float X, float Y) const
{
	return Model && Model->Height(X, Y) > BRRules::WorldModel::WaterLevel + 50.0;
}

FText UBRWorldSubsystem::GetLocationName(const FVector& Location) const
{
	if (!Model) { return FText::GetEmpty(); }
	const int32 I = Model->PoiAt(Location.X, Location.Y);
	return NamedLocations.IsValidIndex(I) ? NamedLocations[I].Name : FText::GetEmpty();
}

FVector UBRWorldSubsystem::FindRandomLandPoint(BRRules::Rng& Rng, float MinHeight) const
{
	const float H = GetHalfSize() * 0.8f;
	for (int32 Try = 0; Try < 64; ++Try)
	{
		const float X = float(Rng.Range(-H, H)), Y = float(Rng.Range(-H, H));
		const float Z = GetTerrainHeight(X, Y);
		if (Z > MinHeight && Z < BRRules::WorldModel::RockLine) { return FVector(X, Y, Z); }
	}
	return FVector(0, 0, GetTerrainHeight(0, 0));
}

bool UBRWorldSubsystem::TryHarvest(const FHitResult& Hit, ABRCharacter* By)
{
	ABRWorldGenerator* Gen = Generator.Get();
	return Gen && Gen->HarvestHit(Hit, By);
}
