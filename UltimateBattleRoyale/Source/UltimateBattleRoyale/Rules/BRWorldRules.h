// World model: deterministic island terrain, named locations (POIs), river, lake, roads and biomes.
// Server and every client evaluate the same function from the replicated seed, so the 9 km² map
// never has to be sent over the network.
#pragma once

#include "BRRulesMath.h"

namespace BRRules
{
	enum class PoiKind : uint8_t { BigCity, City, Village, Farm, Military, Industrial, GasStation, Forest, Beach, Mountain, Lake, Secret, Tower };
	enum class Biome : uint8_t { Ocean, Beach, Grass, Forest, Farm, Mountain, Snow, Urban, Road, Riverbed, Count };

	struct Poi
	{
		const char* Name;
		PoiKind Kind;
		double U, V;       // normalised map coordinates in [-1, 1]
		double Radius;     // fraction of the half size
	};

	constexpr int WorldPoiCount = 19;

	inline const Poi& GetPoi(int Index)
	{
		static const Poi Pois[WorldPoiCount] = {
			{ "Porto Neon",        PoiKind::BigCity,    0.36, -0.42, 0.13 },
			{ "Cidade Solar",      PoiKind::City,      -0.42,  0.36, 0.10 },
			{ "Vila Serena",       PoiKind::Village,   -0.58, -0.38, 0.06 },
			{ "Recanto Verde",     PoiKind::Village,    0.42,  0.62, 0.06 },
			{ "Vila do Farol",     PoiKind::Village,    0.72,  0.30, 0.05 },
			{ "Fazenda Girassol",  PoiKind::Farm,      -0.18, -0.16, 0.08 },
			{ "Forte Granito",     PoiKind::Military,   0.64, -0.06, 0.08 },
			{ "Distrito Ferrugem", PoiKind::Industrial,-0.22, -0.62, 0.08 },
			{ "Posto Estrela",     PoiKind::GasStation, 0.08, -0.40, 0.025 },
			{ "Posto Horizonte",   PoiKind::GasStation,-0.30,  0.10, 0.025 },
			{ "Mata Sombria",      PoiKind::Forest,     0.30,  0.22, 0.14 },
			{ "Bosque Antigo",     PoiKind::Forest,    -0.70,  0.02, 0.11 },
			{ "Pico Gelado",       PoiKind::Mountain,  -0.02,  0.58, 0.16 },
			{ "Serra Azul",        PoiKind::Mountain,   0.74, -0.62, 0.10 },
			{ "Lago Espelho",      PoiKind::Lake,      -0.46, -0.04, 0.06 },
			{ "Praia Coral",       PoiKind::Beach,      0.10, -0.80, 0.10 },
			{ "Bunker Oculto",     PoiKind::Secret,     0.60, -0.50, 0.015 },
			{ "Torre Vigia",       PoiKind::Tower,      0.40,  0.00, 0.012 },
			{ "Torre do Norte",    PoiKind::Tower,     -0.62,  0.62, 0.012 },
		};
		return Pois[ClampI(Index, 0, WorldPoiCount - 1)];
	}

	inline bool IsSettlement(PoiKind K)
	{
		return K == PoiKind::BigCity || K == PoiKind::City || K == PoiKind::Village || K == PoiKind::Farm
			|| K == PoiKind::Military || K == PoiKind::Industrial || K == PoiKind::GasStation || K == PoiKind::Secret || K == PoiKind::Tower;
	}

	constexpr int WorldRoadCount = 13;
	inline void GetRoad(int Index, int& A, int& B)
	{
		static const int Roads[WorldRoadCount][2] = {
			{ 0, 8 }, { 8, 5 }, { 5, 9 }, { 9, 1 }, { 1, 3 }, { 5, 7 }, { 7, 2 },
			{ 2, 14 }, { 0, 6 }, { 6, 4 }, { 4, 3 }, { 0, 15 }, { 6, 17 },
		};
		const int I = ClampI(Index, 0, WorldRoadCount - 1);
		A = Roads[I][0]; B = Roads[I][1];
	}

	inline double SmoothStep(double E0, double E1, double X)
	{
		const double T = Clamp((X - E0) / (E1 - E0), 0.0, 1.0);
		return T * T * (3.0 - 2.0 * T);
	}

	inline double DistToSegment2D(double PX, double PY, double AX, double AY, double BX, double BY, double& OutT)
	{
		const double DX = BX - AX, DY = BY - AY;
		const double L2 = DX * DX + DY * DY;
		OutT = L2 > 0.0 ? Clamp(((PX - AX) * DX + (PY - AY) * DY) / L2, 0.0, 1.0) : 0.0;
		const double CX = AX + DX * OutT, CY = AY + DY * OutT;
		return std::sqrt((PX - CX) * (PX - CX) + (PY - CY) * (PY - CY));
	}

	class WorldModel
	{
	public:
		static constexpr double WaterLevel = 0.0;        // cm
		static constexpr double RoadHalfWidth = 650.0;   // cm
		static constexpr double RiverHalfWidth = 1400.0; // cm
		static constexpr double SnowLine = 9000.0;
		static constexpr double RockLine = 4500.0;

		WorldModel(double InHalfSize, uint32_t InSeed) : HalfSize(InHalfSize), Seed(InSeed)
		{
			for (int I = 0; I < WorldPoiCount; ++I)
			{
				const Poi& P = GetPoi(I);
				PadHeight[I] = Max(350.0, RawHeight(P.U * HalfSize, P.V * HalfSize));
			}
		}

		double GetHalfSize() const { return HalfSize; }
		uint32_t GetSeed() const { return Seed; }
		double PoiX(int I) const { return GetPoi(I).U * HalfSize; }
		double PoiY(int I) const { return GetPoi(I).V * HalfSize; }
		double PoiRadius(int I) const { return GetPoi(I).Radius * HalfSize; }
		double GetPadHeight(int I) const { return PadHeight[ClampI(I, 0, WorldPoiCount - 1)]; }

		// 1 inside the island, 0 in open sea.
		double IslandMask(double X, double Y) const
		{
			const double U = std::fabs(X / HalfSize), V = std::fabs(Y / HalfSize);
			const double Edge = Max(U, V) + (FractalNoise2D(X / 20000.0, Y / 20000.0, Seed + 7u, 2) - 0.5) * 0.08;
			return 1.0 - SmoothStep(0.80, 0.93, Edge);
		}

		// River: winds north to south across the island.
		double RiverCenterX(double Y) const
		{
			const double V = Y / HalfSize;
			return (0.06 + 0.17 * std::sin(V * 2.4 + 0.6)) * HalfSize;
		}

		double RiverDistance(double X, double Y) const
		{
			if (std::fabs(Y) > HalfSize * 0.95) { return 1e9; }
			return std::fabs(X - RiverCenterX(Y));
		}

		// Height before settlements/roads/water are carved (cm).
		double RawHeight(double X, double Y) const
		{
			double H = 400.0 + 1600.0 * FractalNoise2D(X / 30000.0, Y / 30000.0, Seed, 4);
			for (int I = 0; I < WorldPoiCount; ++I)
			{
				const Poi& P = GetPoi(I);
				if (P.Kind != PoiKind::Mountain) { continue; }
				const double D = std::sqrt((X - P.U * HalfSize) * (X - P.U * HalfSize) + (Y - P.V * HalfSize) * (Y - P.V * HalfSize));
				const double R = P.Radius * HalfSize;
				const double Peak = 13000.0 * std::exp(-(D * D) / (R * R * 0.45));
				H += Peak * (0.75 + 0.5 * FractalNoise2D(X / 6000.0, Y / 6000.0, Seed + 99u, 3));
			}
			const double Mask = IslandMask(X, Y);
			return Lerp(-900.0, H, Mask);
		}

		double RoadDistance(double X, double Y, double* OutRoadHeight = nullptr) const
		{
			double Best = 1e18;
			for (int R = 0; R < WorldRoadCount; ++R)
			{
				int A, B; GetRoad(R, A, B);
				double T;
				const double D = DistToSegment2D(X, Y, PoiX(A), PoiY(A), PoiX(B), PoiY(B), T);
				if (D < Best)
				{
					Best = D;
					if (OutRoadHeight) { *OutRoadHeight = Lerp(PadHeight[A], PadHeight[B], T); }
				}
			}
			return Best;
		}

		double Height(double X, double Y) const
		{
			double H = RawHeight(X, Y);
			// Flat pads for settlements.
			for (int I = 0; I < WorldPoiCount; ++I)
			{
				const Poi& P = GetPoi(I);
				if (!IsSettlement(P.Kind)) { continue; }
				const double R = P.Radius * HalfSize;
				const double D = std::sqrt((X - P.U * HalfSize) * (X - P.U * HalfSize) + (Y - P.V * HalfSize) * (Y - P.V * HalfSize));
				const double W = SmoothStep(R, R * 1.5 + 2000.0, D);
				H = Lerp(PadHeight[I], H, W);
			}
			// Roads cut through hills (tunnels are placed where the cut is deep).
			double RoadH = 0.0;
			const double RD = RoadDistance(X, Y, &RoadH);
			if (RD < RoadHalfWidth * 3.0)
			{
				H = Lerp(RoadH, H, SmoothStep(RoadHalfWidth, RoadHalfWidth * 3.0, RD));
			}
			// River and lake carve below the water level.
			const double RvD = RiverDistance(X, Y);
			if (RvD < RiverHalfWidth * 2.5)
			{
				H = Lerp(-380.0, H, SmoothStep(RiverHalfWidth * 0.6, RiverHalfWidth * 2.5, RvD));
			}
			for (int I = 0; I < WorldPoiCount; ++I)
			{
				const Poi& P = GetPoi(I);
				if (P.Kind != PoiKind::Lake) { continue; }
				const double R = P.Radius * HalfSize;
				const double D = std::sqrt((X - P.U * HalfSize) * (X - P.U * HalfSize) + (Y - P.V * HalfSize) * (Y - P.V * HalfSize));
				H = Lerp(-600.0, H, SmoothStep(R * 0.7, R * 1.25, D));
			}
			return H;
		}

		bool IsUnderWater(double X, double Y) const { return Height(X, Y) < WaterLevel - 20.0; }

		int PoiAt(double X, double Y) const
		{
			int Best = -1; double BestRel = 1.0;
			for (int I = 0; I < WorldPoiCount; ++I)
			{
				const double D = std::sqrt((X - PoiX(I)) * (X - PoiX(I)) + (Y - PoiY(I)) * (Y - PoiY(I)));
				const double Rel = D / PoiRadius(I);
				if (Rel < BestRel) { BestRel = Rel; Best = I; }
			}
			return Best;
		}

		Biome BiomeAt(double X, double Y, double H) const
		{
			if (H < WaterLevel - 20.0)
			{
				return IslandMask(X, Y) < 0.5 ? Biome::Ocean : Biome::Riverbed;
			}
			if (H < 250.0 && IslandMask(X, Y) < 0.98) { return Biome::Beach; }
			if (RoadDistance(X, Y) < RoadHalfWidth) { return Biome::Road; }
			const int P = PoiAt(X, Y);
			if (P >= 0)
			{
				switch (GetPoi(P).Kind)
				{
				case PoiKind::BigCity: case PoiKind::City: case PoiKind::Military: case PoiKind::Industrial: case PoiKind::GasStation: case PoiKind::Secret:
					return Biome::Urban;
				case PoiKind::Farm: return Biome::Farm;
				case PoiKind::Beach: return Biome::Beach;
				case PoiKind::Forest: return Biome::Forest;
				default: break;
				}
			}
			if (H > SnowLine) { return Biome::Snow; }
			if (H > RockLine) { return Biome::Mountain; }
			return FractalNoise2D(X / 12000.0, Y / 12000.0, Seed + 31u, 3) > 0.58 ? Biome::Forest : Biome::Grass;
		}

		// Tree density (0..1) used by the foliage scatter.
		double TreeDensity(Biome B) const
		{
			switch (B)
			{
			case Biome::Forest: return 0.75;
			case Biome::Grass: return 0.07;
			case Biome::Mountain: return 0.12;
			case Biome::Snow: return 0.05;
			case Biome::Beach: return 0.04;
			case Biome::Farm: return 0.01;
			default: return 0.0;
			}
		}

	private:
		double HalfSize;
		uint32_t Seed;
		double PadHeight[WorldPoiCount] = {};
	};
}
