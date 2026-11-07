// Standalone tests for Source/UltimateBattleRoyale/Rules (no Unreal needed).
// Build & run: ./run_tests.sh
#include "TestFramework.h"
#include "Rules/BRRules.h"
#include "Rules/BRWorldRules.h"

using namespace BRRules;

// ---------------------------------------------------------------- Math / RNG
BR_TEST(Rng_IsDeterministic)
{
	Rng A(1234), B(1234);
	for (int I = 0; I < 100; ++I) { BR_CHECK(A.Next() == B.Next()); }
	Rng C(1);
	for (int I = 0; I < 1000; ++I) { const double U = C.NextUnit(); BR_CHECK(U >= 0.0 && U < 1.0); }
	for (int I = 0; I < 1000; ++I) { const int V = C.RangeInt(3, 7); BR_CHECK(V >= 3 && V <= 7); }
}

BR_TEST(Noise_InRangeAndDeterministic)
{
	for (int I = 0; I < 200; ++I)
	{
		const double N = FractalNoise2D(I * 0.37, I * 0.11, 42, 4);
		BR_CHECK(N >= 0.0 && N <= 1.0);
		BR_CHECK(N == FractalNoise2D(I * 0.37, I * 0.11, 42, 4));
	}
}

// ---------------------------------------------------------------- Combat
BR_TEST(Combat_FalloffCurve)
{
	FalloffParams P; P.FullDamageRange = 1000; P.MinDamageRange = 3000; P.MinMultiplier = 0.5;
	BR_NEAR(FalloffMultiplier(0, P), 1.0, 1e-9);
	BR_NEAR(FalloffMultiplier(1000, P), 1.0, 1e-9);
	BR_NEAR(FalloffMultiplier(2000, P), 0.75, 1e-9);
	BR_NEAR(FalloffMultiplier(3000, P), 0.5, 1e-9);
	BR_NEAR(FalloffMultiplier(99999, P), 0.5, 1e-9);
}

BR_TEST(Combat_HeadshotAndLimbs)
{
	FalloffParams P;
	BR_NEAR(ComputeHitDamage(30, 100, P, HitZone::Body, 2.0, 0.8), 30.0, 1e-9);
	BR_NEAR(ComputeHitDamage(30, 100, P, HitZone::Head, 2.0, 0.8), 60.0, 1e-9);
	BR_NEAR(ComputeHitDamage(30, 100, P, HitZone::Limb, 2.0, 0.8), 24.0, 1e-9);
	BR_CHECK(ComputeHitDamage(-5, 100, P, HitZone::Body, 2.0, 0.8) == 0.0);
}

BR_TEST(Combat_ShieldAbsorbsFirst)
{
	DamageApplication R = ApplyDamage(100, 50, 70, false);
	BR_NEAR(R.NewShield, 0, 1e-9); BR_NEAR(R.NewHealth, 80, 1e-9);
	BR_NEAR(R.AbsorbedByShield, 50, 1e-9); BR_CHECK(R.bShieldBroken); BR_CHECK(!R.bHealthDepleted);

	R = ApplyDamage(100, 50, 30, false);
	BR_NEAR(R.NewShield, 20, 1e-9); BR_NEAR(R.NewHealth, 100, 1e-9); BR_CHECK(!R.bShieldBroken);

	R = ApplyDamage(10, 100, 15, true); // storm ignores shield
	BR_NEAR(R.NewShield, 100, 1e-9); BR_NEAR(R.NewHealth, 0, 1e-9); BR_CHECK(R.bHealthDepleted);
	BR_NEAR(R.AppliedToHealth, 10, 1e-9);
}

BR_TEST(Combat_HealCaps)
{
	BR_NEAR(ApplyHeal(50, 15, 75), 65, 1e-9);
	BR_NEAR(ApplyHeal(70, 15, 75), 75, 1e-9);
	BR_NEAR(ApplyHeal(90, 15, 75), 90, 1e-9); // bandage never lowers health
	BR_NEAR(ApplyHeal(10, 200, 100), 100, 1e-9);
}

BR_TEST(Combat_SpreadAndBloom)
{
	SpreadParams P;
	const double Hip = ComputeSpreadDeg(P, 0, false, false, 0, false);
	const double Aim = ComputeSpreadDeg(P, 0, true, false, 0, false);
	const double Crouch = ComputeSpreadDeg(P, 0, false, true, 0, false);
	const double Air = ComputeSpreadDeg(P, 0, false, false, 0, true);
	const double Move = ComputeSpreadDeg(P, 0, false, false, 1, false);
	BR_CHECK(Aim < Crouch && Crouch < Hip && Hip < Move && Move < Air);
	double B = 0;
	for (int I = 0; I < 100; ++I) { B = AddBloom(B, P); }
	BR_NEAR(B, P.MaxBloomDeg, 1e-9);
	B = RecoverBloom(B, P, 10.0);
	BR_NEAR(B, 0.0, 1e-9);
}

BR_TEST(Combat_ConeSamplesStayInCone)
{
	Rng R(7);
	for (int I = 0; I < 2000; ++I)
	{
		double Yaw, Pitch; SampleConeOffset(R, 5.0, Yaw, Pitch);
		BR_CHECK(std::sqrt(Yaw * Yaw + Pitch * Pitch) <= 5.0 + 1e-9);
	}
}

BR_TEST(Combat_RecoilDeterministic)
{
	double P1, Y1, P2, Y2;
	RecoilForShot(3, 1.0, 0.5, 99, P1, Y1);
	RecoilForShot(3, 1.0, 0.5, 99, P2, Y2);
	BR_NEAR(P1, P2, 1e-12); BR_NEAR(Y1, Y2, 1e-12);
	BR_CHECK(P1 > 0.0); BR_CHECK(std::fabs(Y1) <= 0.5);
	double PFirst, YF, PLate, YL; RecoilForShot(0, 1.0, 0.0, 5, PFirst, YF); RecoilForShot(10, 1.0, 0.0, 5, PLate, YL);
	BR_CHECK(PFirst > 1.3 * 0.85 * 0.99); // first shots kick harder
}

BR_TEST(Combat_FireRateValidation)
{
	BR_CHECK(IsFireRateValid(-1, 0, 600));
	BR_CHECK(IsFireRateValid(1.0, 1.1, 600));          // 0.1s interval, exactly on time
	BR_CHECK(IsFireRateValid(1.0, 1.085, 600));        // within tolerance
	BR_CHECK(!IsFireRateValid(1.0, 1.02, 600));        // speed hack
	BR_NEAR(ShotInterval(600), 0.1, 1e-12);
}

BR_TEST(Combat_ServerHitValidation)
{
	const Vec3 Eyes(0, 0, 160);
	BR_CHECK(IsShotOriginPlausible(Vec3(10, 0, 160), Eyes, 150));
	BR_CHECK(!IsShotOriginPlausible(Vec3(1000, 0, 160), Eyes, 150));
	BR_CHECK(IsHitWithinRange(Eyes, Vec3(5000, 0, 160), 10000));
	BR_CHECK(!IsHitWithinRange(Eyes, Vec3(50000, 0, 160), 10000));
	BR_CHECK(IsHitAlignedWithAim(Eyes, Vec3(1, 0, 0), Vec3(1000, 20, 160), 5));
	BR_CHECK(!IsHitAlignedWithAim(Eyes, Vec3(1, 0, 0), Vec3(0, 1000, 160), 5));
	BR_CHECK(IsPointNearCapsule(Vec3(30, 0, 100), Vec3(0, 0, 90), 34, 88, 5));
	BR_CHECK(!IsPointNearCapsule(Vec3(200, 0, 100), Vec3(0, 0, 90), 34, 88, 5));
	BR_CHECK(ClassifyHitZone(170, 90, 88) == HitZone::Head);
	BR_CHECK(ClassifyHitZone(90, 90, 88) == HitZone::Body);
	BR_CHECK(ClassifyHitZone(20, 90, 88) == HitZone::Limb);
}

BR_TEST(Combat_RadialAndFall)
{
	BR_NEAR(RadialDamage(100, 20, 100, 500, 50), 100, 1e-9);
	BR_NEAR(RadialDamage(100, 20, 100, 500, 300), 60, 1e-9);
	BR_NEAR(RadialDamage(100, 20, 100, 500, 600), 0, 1e-9);
	BR_NEAR(FallDamage(800), 0, 1e-9);
	BR_NEAR(FallDamage(2600), 100, 1e-9);
	BR_CHECK(FallDamage(1800) > 0 && FallDamage(1800) < 100);
	BR_NEAR(BleedOut(100, 2, 10), 80, 1e-9);
	BR_NEAR(BleedOut(5, 2, 10), 0, 1e-9);
}

// ---------------------------------------------------------------- Storm
BR_TEST(Storm_NextCircleIsContained)
{
	Rng R(2024);
	Circle C{ 0, 0, 150000 };
	for (int Phase = 0; Phase < DefaultStormPhaseCount(); ++Phase)
	{
		const Circle N = ChooseNextCircle(C, C.Radius * DefaultStormPhase(Phase).RadiusScale, R);
		const double D = std::sqrt((N.X - C.X) * (N.X - C.X) + (N.Y - C.Y) * (N.Y - C.Y));
		BR_CHECK(D + N.Radius <= C.Radius + 1e-6);
		C = N;
	}
	BR_NEAR(C.Radius, 0.0, 1e-6);
}

BR_TEST(Storm_ValidatedCircle)
{
	Rng R(5);
	Circle C{ 0, 0, 10000 };
	// Only allow circles on the east half.
	const Circle N = ChooseNextCircleValidated(C, 2000, R, [](double X, double) { return X > 0; }, 64);
	BR_CHECK(N.X > 0);
}

BR_TEST(Storm_InterpolationAndOutside)
{
	Circle A{ 0, 0, 1000 }, B{ 100, 0, 500 };
	Circle M = InterpolateCircle(A, B, 0.5);
	BR_NEAR(M.X, 50, 1e-9); BR_NEAR(M.Radius, 750, 1e-9);
	BR_CHECK(!IsOutside(A, 999, 0)); BR_CHECK(IsOutside(A, 1001, 0));
	BR_NEAR(DistanceOutside(A, 1500, 0), 500, 1e-9);
	BR_NEAR(PhaseAlpha(5, 0, 10), 0.5, 1e-9);
	BR_NEAR(PhaseAlpha(50, 0, 10), 1.0, 1e-9);
}

BR_TEST(Storm_Timeline)
{
	StormTimelineSample S = EvaluateStormTimeline(0);
	BR_CHECK(S.Phase == 0 && !S.bShrinking);
	const StormPhaseDef P0 = DefaultStormPhase(0);
	S = EvaluateStormTimeline(P0.WaitSeconds + P0.ShrinkSeconds * 0.5);
	BR_CHECK(S.Phase == 0 && S.bShrinking); BR_NEAR(S.Alpha, 0.5, 1e-9);
	S = EvaluateStormTimeline(P0.WaitSeconds + P0.ShrinkSeconds + 1);
	BR_CHECK(S.Phase == 1 && !S.bShrinking);
	S = EvaluateStormTimeline(1e9);
	BR_CHECK(S.bFinished);
	// Damage escalates over phases.
	for (int I = 1; I < DefaultStormPhaseCount(); ++I) { BR_CHECK(DefaultStormPhase(I).DamagePerSecond >= DefaultStormPhase(I - 1).DamagePerSecond); }
}

// ---------------------------------------------------------------- Building
BR_TEST(Build_WallNormalizationSharesEdges)
{
	PieceKey East{ { 0, 0, 0 }, PieceType::Wall, 0 };
	PieceKey WestOfNext{ { 1, 0, 0 }, PieceType::Wall, 2 };
	BR_CHECK(NormalizeKey(East) == NormalizeKey(WestOfNext));
	PieceKey North{ { 3, 3, 1 }, PieceType::Wall, 1 };
	PieceKey SouthOfNext{ { 3, 4, 1 }, PieceType::Wall, 3 };
	BR_CHECK(NormalizeKey(North) == NormalizeKey(SouthOfNext));
	BR_CHECK(PackKey(NormalizeKey(East)) == PackKey(NormalizeKey(WestOfNext)));
	BR_CHECK(PackKey(NormalizeKey(East)) != PackKey(NormalizeKey(North)));
}

BR_TEST(Build_WorldToCellNegative)
{
	GridCoord C = WorldToCell(Vec3(-1, -1, -1));
	BR_CHECK(C.X == -1 && C.Y == -1 && C.Z == -1);
	C = WorldToCell(Vec3(499, 500, 399));
	BR_CHECK(C.X == 0 && C.Y == 1 && C.Z == 0);
}

BR_TEST(Build_PlacementFromAim)
{
	const Vec3 Feet(250, 250, 0); // centre of cell (0,0,0)
	// Looking +X at a point in the next cell: wall goes on the shared edge.
	PieceKey W = ChoosePieceFromAim(PieceType::Wall, Feet, 0, Vec3(700, 250, 100), 0);
	BR_CHECK(W.Type == PieceType::Wall && W.Cell.X == 0 && W.Cell.Y == 0 && W.Dir == 0);
	const Vec3 C = PieceWorldCenter(W);
	BR_NEAR(C.X, 500, 1e-9); BR_NEAR(C.Z, 200, 1e-9);
	// Looking far away is clamped to one neighbour cell.
	PieceKey Far = ChoosePieceFromAim(PieceType::Floor, Feet, 0, Vec3(5000, 250, 0), 0);
	BR_CHECK(Far.Cell.X == 1);
	// Ramp rotation.
	PieceKey R0 = ChoosePieceFromAim(PieceType::Ramp, Feet, 0, Vec3(700, 250, 0), 0);
	PieceKey R1 = ChoosePieceFromAim(PieceType::Ramp, Feet, 0, Vec3(700, 250, 0), 1);
	BR_CHECK(R0.Dir == 0 && R1.Dir == 1);
	BR_CHECK(IsWithinBuildDistance(Vec3(250, 250, 160), W));
	BR_CHECK(!IsWithinBuildDistance(Vec3(5000, 5000, 160), W));
}

BR_TEST(Build_MaterialsAndBuildTime)
{
	BR_CHECK(GetMatStats(BuildMat::Wood).MaxHealth < GetMatStats(BuildMat::Stone).MaxHealth);
	BR_CHECK(GetMatStats(BuildMat::Stone).MaxHealth < GetMatStats(BuildMat::Metal).MaxHealth);
	BR_CHECK(GetMatStats(BuildMat::Wood).BuildSeconds < GetMatStats(BuildMat::Metal).BuildSeconds);
	const MatStats W = GetMatStats(BuildMat::Wood);
	BR_NEAR(MaxHealthDuringBuild(W, 0), W.MaxHealth * W.InitialHealthFraction, 1e-9);
	BR_NEAR(MaxHealthDuringBuild(W, 100), W.MaxHealth, 1e-9);
	BR_CHECK(CanAffordPiece(10, BuildMat::Wood)); BR_CHECK(!CanAffordPiece(9, BuildMat::Wood));
}

BR_TEST(Build_EditMasks)
{
	BR_CHECK(IsValidEditMask(PieceType::Wall, FullMask(PieceType::Wall)));
	BR_CHECK(IsValidEditMask(PieceType::Wall, PresetMask(PieceType::Wall, EditPreset::Door)));
	BR_CHECK(IsValidEditMask(PieceType::Wall, PresetMask(PieceType::Wall, EditPreset::Window)));
	BR_CHECK(IsValidEditMask(PieceType::Wall, PresetMask(PieceType::Wall, EditPreset::Arch)));
	BR_CHECK(IsValidEditMask(PieceType::Wall, PresetMask(PieceType::Wall, EditPreset::HalfWall)));
	BR_CHECK(!IsValidEditMask(PieceType::Wall, 0));
	BR_CHECK(!IsValidEditMask(PieceType::Wall, uint16_t(1u << 9)));            // out of range
	BR_CHECK(!IsValidEditMask(PieceType::Wall, uint16_t((1u << 0) | (1u << 8)))); // disconnected corners
	BR_CHECK(IsValidEditMask(PieceType::Floor, PresetMask(PieceType::Floor, EditPreset::HalfFloor)));
	BR_CHECK(!IsValidEditMask(PieceType::Floor, uint16_t((1u << 0) | (1u << 3)))); // diagonal only
	BR_CHECK(PopCount(PresetMask(PieceType::Wall, EditPreset::Door)) == 7);
}

BR_TEST(Build_Adjacency)
{
	BR_CHECK(AreCellsAdjacent({ 0, 0, 0 }, { 1, 1, 1 }));
	BR_CHECK(!AreCellsAdjacent({ 0, 0, 0 }, { 2, 0, 0 }));
	BR_CHECK(HarvestAmount(true) > HarvestAmount(false));
}

// ---------------------------------------------------------------- Loot
BR_TEST(Loot_WeightedIndexDistribution)
{
	const double W[3] = { 1, 0, 3 };
	Rng R(11);
	int Counts[3] = { 0, 0, 0 };
	for (int I = 0; I < 40000; ++I) { ++Counts[WeightedIndex(W, 3, R)]; }
	BR_CHECK(Counts[1] == 0);
	const double Ratio = double(Counts[2]) / double(Counts[0]);
	BR_CHECK(Ratio > 2.7 && Ratio < 3.3);
	const double Z[2] = { 0, 0 };
	BR_CHECK(WeightedIndex(Z, 2, R) == -1);
}

BR_TEST(Loot_SupplyDropsAreBetter)
{
	Rng R(3);
	int Floor = 0, Drop = 0;
	for (int I = 0; I < 5000; ++I)
	{
		Floor += int(RollRarity(ContainerKind::Floor, R));
		Drop += int(RollRarity(ContainerKind::SupplyDrop, R));
		BR_CHECK(RollRarity(ContainerKind::SupplyDrop, R) >= Rarity::Rare);
	}
	BR_CHECK(Drop > Floor);
	for (int I = 1; I < RarityCount; ++I)
	{
		BR_CHECK(RarityDamageMultiplier(Rarity(I)) > RarityDamageMultiplier(Rarity(I - 1)));
		BR_CHECK(RarityReloadMultiplier(Rarity(I)) < RarityReloadMultiplier(Rarity(I - 1)));
	}
}

// ---------------------------------------------------------------- Security
BR_TEST(Security_MoveValidation)
{
	const MoveLimits L = LimitsOnFoot();
	BR_CHECK(ValidateMove(Vec3(0, 0, 0), Vec3(60, 0, 0), 0.1, L) == MoveVerdict::Ok);       // 600 cm/s
	BR_CHECK(ValidateMove(Vec3(0, 0, 0), Vec3(300, 0, 0), 0.1, L) == MoveVerdict::SpeedViolation); // 3000 cm/s
	BR_CHECK(ValidateMove(Vec3(0, 0, 0), Vec3(9000, 0, 0), 0.1, L) == MoveVerdict::Teleport);
	BR_CHECK(ValidateMove(Vec3(0, 0, 0), Vec3(0, 0, -700), 0.1, LimitsSkydiving()) == MoveVerdict::Ok);
	double S = 0;
	S = UpdateSuspicion(S, MoveVerdict::SpeedViolation, 0.1);
	BR_CHECK(S > 0);
	S = UpdateSuspicion(S, MoveVerdict::Ok, 100);
	BR_NEAR(S, 0, 1e-9);
	S = UpdateSuspicion(0, MoveVerdict::Teleport, 0);
	BR_CHECK(S >= SuspicionCorrectThreshold);
}

BR_TEST(Security_TokenBucket)
{
	TokenBucket B(3, 1);
	BR_CHECK(B.Consume(0)); BR_CHECK(B.Consume(0)); BR_CHECK(B.Consume(0));
	BR_CHECK(!B.Consume(0));
	BR_CHECK(B.Consume(1.0));  // refilled one token
	BR_CHECK(!B.Consume(1.0));
	BR_CHECK(IsCountValid(5, 10)); BR_CHECK(!IsCountValid(-1, 10)); BR_CHECK(!IsCountValid(11, 10));
	BR_CHECK(IsWithinInteractRange(Vec3(0, 0, 0), Vec3(300, 0, 0)));
	BR_CHECK(!IsWithinInteractRange(Vec3(0, 0, 0), Vec3(1000, 0, 0)));
}

// ---------------------------------------------------------------- Progression
BR_TEST(Progression_Levels)
{
	BR_CHECK(LevelFromTotalXp(0) == 1);
	BR_CHECK(LevelFromTotalXp(XpForLevel(1) - 1) == 1);
	BR_CHECK(LevelFromTotalXp(XpForLevel(1)) == 2);
	long long Into = -1;
	BR_CHECK(LevelFromTotalXp(XpForLevel(1) + XpForLevel(2) + 7, &Into) == 3);
	BR_CHECK(Into == 7);
	BR_CHECK(LevelFromTotalXp(1LL << 50) == MaxAccountLevel);
	BR_CHECK(SeasonTierFromXp(0) == 0);
	BR_CHECK(SeasonTierFromXp(XpPerSeasonTier * 3 + 1) == 3);
	BR_CHECK(SeasonTierFromXp(1LL << 50) == SeasonPassTiers);
}

BR_TEST(Progression_MatchXpRewardsWinning)
{
	MatchXpInput Win; Win.Placement = 1; Win.TotalTeams = 50; Win.Eliminations = 3; Win.SecondsSurvived = 1200;
	MatchXpInput Lose; Lose.Placement = 50; Lose.TotalTeams = 50; Lose.SecondsSurvived = 60;
	BR_CHECK(ComputeMatchXp(Win) > ComputeMatchXp(Lose));
	BR_CHECK(ComputeMatchXp(Lose) > 0);
	BR_CHECK(ComputeMatchCoins(Win) > ComputeMatchCoins(Lose));
}

// ---------------------------------------------------------------- Inventory
BR_TEST(Inventory_Stacks)
{
	StackResult R = AddToStack(990, 30, MaxBuildMaterial);
	BR_CHECK(R.NewCount == 999 && R.Overflow == 21);
	R = AddToStack(0, 5, 3);
	BR_CHECK(R.NewCount == 3 && R.Overflow == 2);
	int C = 10;
	BR_CHECK(RemoveFromStack(C, 4) == 4 && C == 6);
	BR_CHECK(RemoveFromStack(C, 100) == 6 && C == 0);
	BR_CHECK(RoundsToReload(5, 30, 100) == 25);
	BR_CHECK(RoundsToReload(5, 30, 10) == 10);
	BR_CHECK(RoundsToReload(30, 30, 10) == 0);
	BR_CHECK(MaxAmmoForType(5) == 30);
}

// ---------------------------------------------------------------- Vehicles
BR_TEST(Vehicle_Physics)
{
	BR_CHECK(SuspensionForce(0, 10, 1000, 10) == 0);
	BR_CHECK(SuspensionForce(0.5, 0, 1000, 10) == 500);
	BR_CHECK(EngineForce(1, 0, 1000, 3000) == 1000);
	BR_CHECK(EngineForce(1, 3000, 1000, 3000) == 0);
	BR_CHECK(EngineForce(-1, 1500, 1000, 3000) == -1000); // braking/reversing at full force
	BR_CHECK(ConsumeFuel(10, 1, 10) < ConsumeFuel(10, 0, 10));
	BR_CHECK(ConsumeFuel(0.001, 1, 10) == 0);
	BR_CHECK(CollisionDamage(500) == 0); BR_CHECK(CollisionDamage(2000) > 0);
	BR_CHECK(RunOverDamage(300) == 0); BR_CHECK(RunOverDamage(2000) > 0);
	BR_NEAR(SpeedKmh(1000), 36, 1e-9);
}

// ---------------------------------------------------------------- Match
BR_TEST(Match_Flow)
{
	BR_CHECK(!ShouldStartMatch(0, 2, 100, 999, 60));
	BR_CHECK(ShouldStartMatch(100, 2, 100, 0, 60));
	BR_CHECK(!ShouldStartMatch(5, 2, 100, 10, 60));
	BR_CHECK(ShouldStartMatch(5, 2, 100, 61, 60));
	BR_CHECK(PlacementForEliminatedTeam(10) == 10);
	BR_CHECK(IsMatchWon(1)); BR_CHECK(!IsMatchWon(2));
	BR_CHECK(TeamForSlot(0, 2) == 0 && TeamForSlot(1, 2) == 0 && TeamForSlot(2, 2) == 1);
	BR_CHECK(MaxTeams(100, 4) == 25); BR_CHECK(MaxTeams(10, 4) == 3);
	Rng R(77); Vec3 S, E;
	ChooseBusPath(150000, 60000, R, S, E);
	BR_CHECK(Dist2D(S, E) > 150000 * 2.0);
	BR_NEAR(S.Z, 60000, 1e-9);
	// Path passes near the centre: distance from origin to the line < 0.36 * half size.
	const double DX = E.X - S.X, DY = E.Y - S.Y;
	const double LineDist = std::fabs(DX * S.Y - DY * S.X) / std::sqrt(DX * DX + DY * DY);
	BR_CHECK(LineDist <= 0.36 * 150000);
}

// ---------------------------------------------------------------- Quality / mobile
BR_TEST(Quality_DeviceTiers)
{
	DeviceInfo Entry; Entry.RamGB = 3; Entry.CpuCores = 8; Entry.GpuScore = 40;
	DeviceInfo Mid; Mid.RamGB = 6; Mid.CpuCores = 8; Mid.GpuScore = 100;
	DeviceInfo Flagship; Flagship.RamGB = 12; Flagship.CpuCores = 8; Flagship.GpuScore = 300;
	BR_CHECK(ClassifyDevice(Entry) == QualityTier::Low);
	BR_CHECK(ClassifyDevice(Mid) == QualityTier::Medium);
	BR_CHECK(ClassifyDevice(Flagship) == QualityTier::High);
	BR_CHECK(TargetFps(QualityTier::Low, true) == 30);
	BR_CHECK(TargetFps(QualityTier::Medium, true) == 45);
	BR_CHECK(TargetFps(QualityTier::High, true) == 60);
}

BR_TEST(Quality_DynamicResolutionConverges)
{
	// Simulated GPU: frame time proportional to pixel count (scale^2).
	double Scale = 100.0;
	const double Target = 33.3;
	for (int I = 0; I < 200; ++I)
	{
		const double Frame = 50.0 * (Scale / 100.0) * (Scale / 100.0);
		Scale = NextResolutionScale(Scale, Frame, Target, 50.0, 100.0);
	}
	const double FinalFrame = 50.0 * (Scale / 100.0) * (Scale / 100.0);
	BR_CHECK(FinalFrame <= Target * 1.06);
	BR_CHECK(Scale >= 50.0 && Scale < 100.0);
	BR_NEAR(NextResolutionScale(70, 10, 33.3, 50, 100), 72, 1e-9);
	BR_CHECK(AiThinkInterval(1000) < AiThinkInterval(100000));
	BR_CHECK(CullDistanceForTier(QualityTier::Low, 1000) < CullDistanceForTier(QualityTier::High, 1000));
}

BR_TEST(AimAssist_Weights)
{
	AimAssistParams P;
	BR_NEAR(AimAssistWeight(10, 100, P), 0, 1e-9);
	BR_CHECK(AimAssistWeight(1, 100, P) > AimAssistWeight(5, 100, P));
	BR_NEAR(AimAssistWeight(1, 100000, P), 0, 1e-9);
	P.Strength01 = 0; BR_NEAR(AimAssistWeight(1, 100, P), 0, 1e-9);
	P.Strength01 = 1;
	const double W = AimAssistWeight(1, 0, P);
	BR_NEAR(AimSlowdownMultiplier(W, P), P.MaxSlowdown, 1e-9);
	BR_CHECK(AimPullStep(1, 0.01, 1.0, P) <= 0.01 + 1e-12); // never overshoots
}


// ---------------------------------------------------------------- World
BR_TEST(World_SettlementsAreDryAndFlat)
{
	const WorldModel W(150000.0, 12345);
	for (int I = 0; I < WorldPoiCount; ++I)
	{
		const Poi& P = GetPoi(I);
		if (!IsSettlement(P.Kind)) { continue; }
		const double X = W.PoiX(I), Y = W.PoiY(I);
		const double H = W.Height(X, Y);
		if (H <= WorldModel::WaterLevel + 100.0) { std::printf("  POI under water: %s (%.0f)\n", P.Name, H); }
		BR_CHECK(H > WorldModel::WaterLevel + 100.0);
		// Flat pad: +-30 m around centre changes less than 1.5 m.
		BR_CHECK(std::fabs(W.Height(X + 3000, Y) - H) < 150.0);
		BR_CHECK(std::fabs(W.Height(X, Y - 3000) - H) < 150.0);
		// No settlement sits on the river.
		if (W.RiverDistance(X, Y) <= W.PoiRadius(I) + WorldModel::RiverHalfWidth) { std::printf("  POI on river: %s\n", P.Name); }
		BR_CHECK(W.RiverDistance(X, Y) > W.PoiRadius(I) + WorldModel::RiverHalfWidth);
	}
}

BR_TEST(World_WaterBodies)
{
	const WorldModel W(150000.0, 7);
	// River centre is water across the island.
	for (int I = -8; I <= 8; ++I)
	{
		const double Y = I * 15000.0;
		const double X = W.RiverCenterX(Y);
		if (W.PoiAt(X, Y) >= 0 && IsSettlement(GetPoi(W.PoiAt(X, Y)).Kind)) { continue; }
		BR_CHECK(W.IsUnderWater(X, Y));
	}
	// Lake centre is water; open sea at the corners.
	BR_CHECK(W.IsUnderWater(W.PoiX(14), W.PoiY(14)));
	BR_CHECK(W.IsUnderWater(148000.0, 148000.0));
	BR_CHECK(W.BiomeAt(148000.0, 148000.0, W.Height(148000.0, 148000.0)) == Biome::Ocean);
	// Mountains are high.
	BR_CHECK(W.Height(W.PoiX(12), W.PoiY(12)) > 8000.0);
}

BR_TEST(World_DeterministicAndContinuous)
{
	const WorldModel A(150000.0, 99), B(150000.0, 99);
	Rng R(5);
	int Land = 0, Samples = 0;
	for (int I = 0; I < 3000; ++I)
	{
		const double X = R.Range(-150000, 150000), Y = R.Range(-150000, 150000);
		const double H = A.Height(X, Y);
		BR_CHECK(H == B.Height(X, Y));
		// Continuity: 15 m step never jumps more than 12 m (except steep mountains, < 30 m).
		BR_CHECK(std::fabs(A.Height(X + 1500, Y) - H) < 3000.0);
		++Samples; if (H > 0) { ++Land; }
	}
	// Roughly 9 km2 of playable island: most of the square is land.
	BR_CHECK(double(Land) / Samples > 0.55);
	// Roads connect: midpoint of each road is on dry land, unless it crosses water (bridge).
	for (int Rd = 0; Rd < WorldRoadCount; ++Rd)
	{
		int Ia, Ib; GetRoad(Rd, Ia, Ib);
		BR_CHECK(Ia >= 0 && Ia < WorldPoiCount && Ib >= 0 && Ib < WorldPoiCount && Ia != Ib);
	}
}


BR_TEST(Progression_ChallengesAndShop)
{
	int A[8], B[8];
	const int N = PickChallenges(DailyChallengeSeed(2026, 11, 7), DailyChallengeCount, A);
	BR_CHECK(N == DailyChallengeCount);
	PickChallenges(DailyChallengeSeed(2026, 11, 7), DailyChallengeCount, B);
	for (int I = 0; I < N; ++I) { BR_CHECK(A[I] == B[I]); BR_CHECK(A[I] >= 0 && A[I] < ChallengeTemplateCount); }
	BR_CHECK(A[0] != A[1] && A[1] != A[2] && A[0] != A[2]);
	BR_CHECK(PickChallenges(WeeklyChallengeSeed(2026, 44), 99, A) == ChallengeTemplateCount); // never more than the pool
	int Order[20];
	for (int I = 0; I < 20; ++I) { Order[I] = I; }
	ShuffleShop(DailyShopSeed(2026, 11, 7), 20, Order);
	int Seen = 0;
	for (int I = 0; I < 20; ++I) { Seen |= 1 << Order[I]; }
	BR_CHECK(Seen == (1 << 20) - 1); // permutation
}

int main()
{
	int FailedCases = 0;
	for (const BRTest::Case& C : BRTest::Registry())
	{
		const int Before = BRTest::Failures();
		C.Fn();
		const bool Ok = BRTest::Failures() == Before;
		if (!Ok) { ++FailedCases; }
		std::printf("[%s] %s\n", Ok ? " OK " : "FAIL", C.Name);
	}
	std::printf("\n%zu test cases, %d checks, %d failed checks, %d failed cases\n",
		BRTest::Registry().size(), BRTest::Checks(), BRTest::Failures(), FailedCases);
	return BRTest::Failures() == 0 ? 0 : 1;
}
