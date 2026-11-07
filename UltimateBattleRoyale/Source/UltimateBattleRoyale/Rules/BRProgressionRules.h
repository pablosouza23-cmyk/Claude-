// Progression rules: XP curve, levels, match rewards, season pass tiers.
#pragma once

#include "BRRulesMath.h"

namespace BRRules
{
	constexpr int MaxAccountLevel = 200;
	constexpr int SeasonPassTiers = 50;
	constexpr long long XpPerSeasonTier = 8000;

	// XP to go from Level to Level+1.
	inline long long XpForLevel(int Level)
	{
		Level = MaxI(1, Level);
		return 1000LL + 250LL * (long long)MinI(Level - 1, 40);
	}

	inline int LevelFromTotalXp(long long TotalXp, long long* OutXpIntoLevel = nullptr)
	{
		int Level = 1;
		long long Remaining = TotalXp < 0 ? 0 : TotalXp;
		while (Level < MaxAccountLevel && Remaining >= XpForLevel(Level))
		{
			Remaining -= XpForLevel(Level);
			++Level;
		}
		if (OutXpIntoLevel) { *OutXpIntoLevel = Remaining; }
		return Level;
	}

	struct MatchXpInput
	{
		int Placement = 100;
		int TotalTeams = 100;
		int Eliminations = 0;
		int Assists = 0;
		int Revives = 0;
		int ChestsOpened = 0;
		double SecondsSurvived = 0.0;
	};

	inline int ComputeMatchXp(const MatchXpInput& In)
	{
		const int Teams = MaxI(1, In.TotalTeams);
		const int Placement = ClampI(In.Placement, 1, Teams);
		const double PlacementFactor = 1.0 - double(Placement - 1) / double(Teams);
		double Xp = 150.0;                                  // participation
		Xp += 1500.0 * PlacementFactor * PlacementFactor;   // placement curve
		Xp += 250.0 * In.Eliminations;
		Xp += 100.0 * In.Assists;
		Xp += 200.0 * In.Revives;
		Xp += 50.0 * In.ChestsOpened;
		Xp += 2.0 * Min(In.SecondsSurvived, 1800.0);
		if (Placement == 1) { Xp += 2000.0; }
		return int(std::round(Xp));
	}

	// Soft currency (earned only by playing; never purchasable in this build).
	inline int ComputeMatchCoins(const MatchXpInput& In)
	{
		int Coins = 10 + 5 * In.Eliminations;
		if (In.Placement == 1) { Coins += 100; }
		else if (In.Placement <= 10) { Coins += 25; }
		return Coins;
	}

	inline int SeasonTierFromXp(long long SeasonXp)
	{
		if (SeasonXp <= 0) { return 0; }
		return int(Min(double(SeasonPassTiers), double(SeasonXp / XpPerSeasonTier)));
	}

	// ---- Challenges: deterministic per day / week, shared by the game (offline) and the backend.
	constexpr int ChallengeTemplateCount = 8;
	constexpr int DailyChallengeCount = 3;
	constexpr int WeeklyChallengeCount = 5;

	inline uint32_t DailyChallengeSeed(int Year, int Month, int Day) { return HashCombine(uint32_t(Year * 10000 + Month * 100 + Day), 0xDA11u); }
	inline uint32_t WeeklyChallengeSeed(int Year, int WeekOfYear) { return HashCombine(uint32_t(Year * 100 + WeekOfYear), 0x3EE7u); }
	inline uint32_t DailyShopSeed(int Year, int Month, int Day) { return HashCombine(uint32_t(Year * 10000 + Month * 100 + Day), 0xC0FFEEu); }

	// Picks Count distinct template indices (order matters) into Out; returns how many were written.
	inline int PickChallenges(uint32_t Seed, int Count, int* Out)
	{
		int Pool[ChallengeTemplateCount];
		int PoolSize = ChallengeTemplateCount;
		for (int I = 0; I < PoolSize; ++I) { Pool[I] = I; }
		Rng R(Seed);
		int Written = 0;
		for (int N = 0; N < Count && PoolSize > 0; ++N)
		{
			const int Idx = R.RangeInt(0, PoolSize - 1);
			Out[Written++] = Pool[Idx];
			for (int J = Idx; J < PoolSize - 1; ++J) { Pool[J] = Pool[J + 1]; }
			--PoolSize;
		}
		return Written;
	}

	// Daily shop: Fisher-Yates over the shop pool (catalogue order), first Count entries are on sale.
	inline void ShuffleShop(uint32_t Seed, int PoolSize, int* InOutIndices)
	{
		Rng R(Seed);
		for (int I = PoolSize - 1; I > 0; --I)
		{
			const int J = R.RangeInt(0, I);
			const int T = InOutIndices[I]; InOutIndices[I] = InOutIndices[J]; InOutIndices[J] = T;
		}
	}
}

