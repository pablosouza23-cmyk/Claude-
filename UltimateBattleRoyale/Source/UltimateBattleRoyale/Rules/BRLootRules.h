// Loot rules: rarity tables, weighted rolls and rarity scaling.
#pragma once

#include "BRRulesMath.h"

namespace BRRules
{
	enum class Rarity : uint8_t { Common = 0, Uncommon, Rare, Epic, Legendary, Mythic, Count };
	enum class ContainerKind : uint8_t { Floor = 0, Chest, AmmoBox, SupplyDrop, Llama };

	constexpr int RarityCount = int(Rarity::Count);

	struct RarityWeights { double W[RarityCount]; };

	inline RarityWeights DefaultRarityWeights(ContainerKind K)
	{
		switch (K)
		{
		case ContainerKind::Chest:      return RarityWeights{ { 30.0, 32.0, 22.0, 11.0, 4.5, 0.5 } };
		case ContainerKind::SupplyDrop: return RarityWeights{ { 0.0, 0.0, 30.0, 45.0, 22.0, 3.0 } };
		case ContainerKind::Llama:      return RarityWeights{ { 0.0, 10.0, 40.0, 35.0, 15.0, 0.0 } };
		case ContainerKind::AmmoBox:    return RarityWeights{ { 100.0, 0.0, 0.0, 0.0, 0.0, 0.0 } };
		case ContainerKind::Floor:
		default:                        return RarityWeights{ { 45.0, 30.0, 17.0, 6.5, 1.5, 0.0 } };
		}
	}

	// Returns -1 if all weights are zero or N <= 0.
	inline int WeightedIndex(const double* Weights, int N, Rng& R)
	{
		double Total = 0.0;
		for (int I = 0; I < N; ++I) { Total += Max(0.0, Weights[I]); }
		if (Total <= 0.0) { return -1; }
		double Pick = R.NextUnit() * Total;
		for (int I = 0; I < N; ++I)
		{
			const double W = Max(0.0, Weights[I]);
			if (Pick < W) { return I; }
			Pick -= W;
		}
		for (int I = N - 1; I >= 0; --I) { if (Weights[I] > 0.0) { return I; } }
		return -1;
	}

	inline Rarity RollRarity(ContainerKind K, Rng& R)
	{
		const RarityWeights W = DefaultRarityWeights(K);
		const int I = WeightedIndex(W.W, RarityCount, R);
		return I < 0 ? Rarity::Common : Rarity(I);
	}

	inline double RarityDamageMultiplier(Rarity Ra)
	{
		static const double M[RarityCount] = { 1.00, 1.05, 1.10, 1.16, 1.22, 1.30 };
		return M[ClampI(int(Ra), 0, RarityCount - 1)];
	}

	inline double RarityReloadMultiplier(Rarity Ra)
	{
		static const double M[RarityCount] = { 1.00, 0.95, 0.90, 0.85, 0.80, 0.75 };
		return M[ClampI(int(Ra), 0, RarityCount - 1)];
	}

	// 0xRRGGBBAA rarity colors used by UI, pickups and beams.
	inline uint32_t RarityColorRGBA(Rarity Ra)
	{
		static const uint32_t C[RarityCount] = { 0xB4B4B4FFu, 0x3FC24AFFu, 0x2E8BF0FFu, 0xA84CF0FFu, 0xF5A623FFu, 0xF2D94AFFu };
		return C[ClampI(int(Ra), 0, RarityCount - 1)];
	}

	inline double FloorSpawnChance() { return 0.7; }

	// How many items a container drops.
	inline int ContainerDropCount(ContainerKind K)
	{
		switch (K)
		{
		case ContainerKind::Chest: return 4;      // weapon + ammo + consumable + materials
		case ContainerKind::SupplyDrop: return 5;
		case ContainerKind::Llama: return 8;
		case ContainerKind::AmmoBox: return 2;
		default: return 1;
		}
	}
}
