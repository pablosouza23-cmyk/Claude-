// Prints rule results as JSON so other implementations (the Python backend) can prove they
// compute exactly the same values: XP curve, match rewards, season tiers, challenges, shop order.
#include <cstdio>
#include "Rules/BRRules.h"

using namespace BRRules;

int main()
{
	std::printf("{\n\"xpForLevel\": [");
	for (int L = 1; L <= 60; ++L) { std::printf("%s%lld", L > 1 ? "," : "", XpForLevel(L)); }
	std::printf("],\n\"levelFromXp\": [");
	const long long Xps[] = { 0, 999, 1000, 2249, 2250, 50000, 123456, 999999, 50000000 };
	for (int I = 0; I < 9; ++I) { long long Into = 0; const int L = LevelFromTotalXp(Xps[I], &Into); std::printf("%s[%lld,%d,%lld]", I ? "," : "", Xps[I], L, Into); }
	std::printf("],\n\"matchRewards\": [");
	Rng R(99);
	for (int I = 0; I < 40; ++I)
	{
		MatchXpInput In;
		In.TotalTeams = R.RangeInt(1, 100); In.Placement = R.RangeInt(1, In.TotalTeams); In.Eliminations = R.RangeInt(0, 15);
		In.Assists = 0; In.Revives = R.RangeInt(0, 5); In.ChestsOpened = R.RangeInt(0, 12); In.SecondsSurvived = R.RangeInt(0, 2400);
		std::printf("%s[%d,%d,%d,%d,%d,%d,%d,%d]", I ? "," : "", In.Placement, In.TotalTeams, In.Eliminations, In.Revives, In.ChestsOpened,
			int(In.SecondsSurvived), ComputeMatchXp(In), ComputeMatchCoins(In));
	}
	std::printf("],\n\"seasonTier\": [");
	const long long Sx[] = { 0, 7999, 8000, 80001, 400000, 99999999 };
	for (int I = 0; I < 6; ++I) { std::printf("%s[%lld,%d]", I ? "," : "", Sx[I], SeasonTierFromXp(Sx[I])); }
	std::printf("],\n\"daily\": [");
	for (int D = 1; D <= 10; ++D)
	{
		int P[8]; const int N = PickChallenges(DailyChallengeSeed(2026, 11, D), DailyChallengeCount, P);
		std::printf("%s[%d,[", D > 1 ? "," : "", D);
		for (int I = 0; I < N; ++I) { std::printf("%s%d", I ? "," : "", P[I]); }
		std::printf("]]");
	}
	std::printf("],\n\"weekly\": [");
	for (int W = 40; W < 46; ++W)
	{
		int P[8]; const int N = PickChallenges(WeeklyChallengeSeed(2026, W), WeeklyChallengeCount, P);
		std::printf("%s[%d,[", W > 40 ? "," : "", W);
		for (int I = 0; I < N; ++I) { std::printf("%s%d", I ? "," : "", P[I]); }
		std::printf("]]");
	}
	std::printf("],\n\"shop\": [");
	for (int D = 1; D <= 10; ++D)
	{
		int O[30]; for (int I = 0; I < 30; ++I) { O[I] = I; }
		ShuffleShop(DailyShopSeed(2026, 11, D), 30, O);
		std::printf("%s[%d,[", D > 1 ? "," : "", D);
		for (int I = 0; I < 30; ++I) { std::printf("%s%d", I ? "," : "", O[I]); }
		std::printf("]]");
	}
	std::printf("]\n}\n");
	return 0;
}
