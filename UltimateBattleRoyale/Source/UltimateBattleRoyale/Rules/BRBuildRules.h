// Building rules: grid, piece placement, material stats, edit masks and support adjacency.
#pragma once

#include "BRRulesMath.h"

namespace BRRules
{
	constexpr double BuildCellSize = 500.0;   // cm (X/Y)
	constexpr double BuildCellHeight = 400.0; // cm (Z)
	constexpr double MaxBuildDistance = 1300.0;

	enum class PieceType : uint8_t { Wall = 0, Floor = 1, Ramp = 2, Roof = 3 };
	enum class BuildMat : uint8_t { Wood = 0, Stone = 1, Metal = 2 };

	struct GridCoord
	{
		int X = 0, Y = 0, Z = 0;
		bool operator==(const GridCoord& O) const { return X == O.X && Y == O.Y && Z == O.Z; }
	};

	// Dir: 0=+X, 1=+Y, 2=-X, 3=-Y. Walls are normalized to 0/1; floors/roofs always 0.
	struct PieceKey
	{
		GridCoord Cell;
		PieceType Type = PieceType::Wall;
		uint8_t Dir = 0;
		bool operator==(const PieceKey& O) const { return Cell == O.Cell && Type == O.Type && Dir == O.Dir; }
	};

	inline int FloorDiv(double V, double Size) { return int(std::floor(V / Size)); }

	inline GridCoord WorldToCell(const Vec3& P)
	{
		return GridCoord{ FloorDiv(P.X, BuildCellSize), FloorDiv(P.Y, BuildCellSize), FloorDiv(P.Z, BuildCellHeight) };
	}

	inline Vec3 CellMin(const GridCoord& C)
	{
		return Vec3(C.X * BuildCellSize, C.Y * BuildCellSize, C.Z * BuildCellHeight);
	}

	inline uint8_t QuantizeYawToDir(double YawDeg)
	{
		double Y = std::fmod(YawDeg, 360.0);
		if (Y < 0.0) { Y += 360.0; }
		return uint8_t(int(std::floor((Y + 45.0) / 90.0)) % 4);
	}

	inline uint8_t OppositeDir(uint8_t D) { return uint8_t((D + 2) % 4); }

	inline PieceKey NormalizeKey(PieceKey K)
	{
		if (K.Type == PieceType::Wall)
		{
			if (K.Dir == 2) { K.Cell.X -= 1; K.Dir = 0; }
			else if (K.Dir == 3) { K.Cell.Y -= 1; K.Dir = 1; }
		}
		else if (K.Type == PieceType::Floor || K.Type == PieceType::Roof)
		{
			K.Dir = 0;
		}
		else
		{
			K.Dir = uint8_t(K.Dir % 4);
		}
		return K;
	}

	inline Vec3 PieceWorldCenter(const PieceKey& K)
	{
		const Vec3 Min = CellMin(K.Cell);
		const double H = BuildCellSize * 0.5;
		switch (K.Type)
		{
		case PieceType::Floor: return Vec3(Min.X + H, Min.Y + H, Min.Z);
		case PieceType::Roof:  return Vec3(Min.X + H, Min.Y + H, Min.Z + BuildCellHeight);
		case PieceType::Ramp:  return Vec3(Min.X + H, Min.Y + H, Min.Z + BuildCellHeight * 0.5);
		case PieceType::Wall:
		default:
			if (K.Dir == 0) { return Vec3(Min.X + BuildCellSize, Min.Y + H, Min.Z + BuildCellHeight * 0.5); }
			return Vec3(Min.X + H, Min.Y + BuildCellSize, Min.Z + BuildCellHeight * 0.5);
		}
	}

	inline double PieceYawDeg(const PieceKey& K) { return double(K.Dir) * 90.0; }

	inline double RampPitchDeg() { return RadToDeg(std::atan2(BuildCellHeight, BuildCellSize)); }

	// Chooses the grid slot for a piece from the player's position, facing and aim point.
	inline PieceKey ChoosePieceFromAim(PieceType Type, const Vec3& PlayerFeet, double FacingYawDeg,
		const Vec3& AimPoint, int RotationSteps)
	{
		const GridCoord PlayerCell = WorldToCell(Vec3(PlayerFeet.X, PlayerFeet.Y, PlayerFeet.Z + 10.0));
		GridCoord AimCell = WorldToCell(AimPoint);
		AimCell.Z = ClampI(AimCell.Z, PlayerCell.Z - 1, PlayerCell.Z + 1);
		const uint8_t Facing = QuantizeYawToDir(FacingYawDeg);

		// Never build further than one cell away horizontally from the player.
		auto ClampToNeighbour = [&PlayerCell](GridCoord C)
		{
			C.X = ClampI(C.X, PlayerCell.X - 1, PlayerCell.X + 1);
			C.Y = ClampI(C.Y, PlayerCell.Y - 1, PlayerCell.Y + 1);
			return C;
		};
		AimCell = ClampToNeighbour(AimCell);

		PieceKey K;
		K.Type = Type;
		switch (Type)
		{
		case PieceType::Wall:
			if (AimCell.X == PlayerCell.X && AimCell.Y == PlayerCell.Y)
			{
				K.Cell = AimCell; K.Dir = Facing;
			}
			else
			{
				K.Cell = AimCell; K.Dir = OppositeDir(Facing);
			}
			break;
		case PieceType::Floor:
			K.Cell = AimCell;
			K.Cell.Z = ClampI(int(std::floor(AimPoint.Z / BuildCellHeight + 0.5)), PlayerCell.Z - 1, PlayerCell.Z + 2);
			break;
		case PieceType::Ramp:
			K.Cell = (AimCell.X == PlayerCell.X && AimCell.Y == PlayerCell.Y) ? PlayerCell : AimCell;
			K.Cell.Z = PlayerCell.Z;
			K.Dir = uint8_t((Facing + uint8_t(((RotationSteps % 4) + 4) % 4)) % 4);
			break;
		case PieceType::Roof:
			K.Cell = AimCell;
			K.Cell.Z = PlayerCell.Z;
			break;
		}
		return NormalizeKey(K);
	}

	struct MatStats
	{
		double MaxHealth;
		double BuildSeconds;
		double InitialHealthFraction;
		int Cost;
	};

	inline MatStats GetMatStats(BuildMat M)
	{
		switch (M)
		{
		case BuildMat::Stone: return MatStats{ 300.0, 9.0, 0.2, 10 };
		case BuildMat::Metal: return MatStats{ 450.0, 15.0, 0.2, 10 };
		case BuildMat::Wood:
		default:              return MatStats{ 150.0, 4.0, 0.2, 10 };
		}
	}

	// Max health grows linearly from the initial fraction while the piece is "building".
	inline double MaxHealthDuringBuild(const MatStats& S, double Elapsed)
	{
		const double T = S.BuildSeconds > 0.0 ? Clamp(Elapsed / S.BuildSeconds, 0.0, 1.0) : 1.0;
		return S.MaxHealth * Lerp(S.InitialHealthFraction, 1.0, T);
	}

	inline bool CanAffordPiece(int Owned, BuildMat M) { return Owned >= GetMatStats(M).Cost; }

	inline bool IsWithinBuildDistance(const Vec3& PlayerEyes, const PieceKey& K)
	{
		return Dist(PlayerEyes, PieceWorldCenter(K)) <= MaxBuildDistance;
	}

	// ---- Editing: walls are a 3x3 tile grid (row-major, top-left = 0); others are 2x2.
	enum class EditPreset : uint8_t { None, Door, Window, Arch, HalfWall, HalfFloor, Corner };

	inline int TileGridSide(PieceType T) { return T == PieceType::Wall ? 3 : 2; }
	inline int TileCount(PieceType T) { const int S = TileGridSide(T); return S * S; }
	inline uint16_t FullMask(PieceType T) { return uint16_t((1u << TileCount(T)) - 1u); }
	inline bool IsTilePresent(uint16_t Mask, int Index) { return (Mask >> Index) & 1u; }

	inline int PopCount(uint16_t M) { int C = 0; while (M) { C += M & 1u; M >>= 1; } return C; }

	// Valid when at least one tile remains, no out-of-range bits, and remaining tiles are 4-connected.
	inline bool IsValidEditMask(PieceType T, uint16_t Mask)
	{
		const uint16_t Full = FullMask(T);
		if ((Mask & ~Full) != 0 || Mask == 0) { return false; }
		const int Side = TileGridSide(T);
		int Start = -1;
		for (int I = 0; I < TileCount(T); ++I) { if (IsTilePresent(Mask, I)) { Start = I; break; } }
		uint16_t Visited = uint16_t(1u << Start);
		int Stack[9]; int Top = 0; Stack[Top++] = Start;
		while (Top > 0)
		{
			const int Cur = Stack[--Top];
			const int R = Cur / Side, C = Cur % Side;
			const int N[4][2] = { { R - 1, C }, { R + 1, C }, { R, C - 1 }, { R, C + 1 } };
			for (const auto& NB : N)
			{
				if (NB[0] < 0 || NB[0] >= Side || NB[1] < 0 || NB[1] >= Side) { continue; }
				const int Idx = NB[0] * Side + NB[1];
				if (IsTilePresent(Mask, Idx) && !IsTilePresent(Visited, Idx))
				{
					Visited |= uint16_t(1u << Idx);
					Stack[Top++] = Idx;
				}
			}
		}
		return Visited == Mask;
	}

	inline uint16_t PresetMask(PieceType T, EditPreset P)
	{
		const uint16_t Full = FullMask(T);
		if (T == PieceType::Wall)
		{
			switch (P)
			{
			case EditPreset::Door:     return uint16_t(Full & ~((1u << 4) | (1u << 7)));
			case EditPreset::Window:   return uint16_t(Full & ~(1u << 4));
			case EditPreset::Arch:     return uint16_t((1u << 0) | (1u << 1) | (1u << 2) | (1u << 3) | (1u << 5) | (1u << 6) | (1u << 8));
			case EditPreset::HalfWall: return uint16_t((1u << 6) | (1u << 7) | (1u << 8));
			default: return Full;
			}
		}
		switch (P)
		{
		case EditPreset::HalfFloor: return uint16_t((1u << 2) | (1u << 3));
		case EditPreset::Corner:    return uint16_t(1u << 3);
		default: return Full;
		}
	}

	// Two pieces may support each other when their cells touch (including diagonals).
	inline bool AreCellsAdjacent(const GridCoord& A, const GridCoord& B)
	{
		return std::abs(A.X - B.X) <= 1 && std::abs(A.Y - B.Y) <= 1 && std::abs(A.Z - B.Z) <= 1;
	}

	// Stable 64-bit key for hash maps.
	inline uint64_t PackKey(const PieceKey& K)
	{
		const uint64_t X = uint64_t(uint32_t(K.Cell.X + (1 << 19))) & 0xFFFFFu;
		const uint64_t Y = uint64_t(uint32_t(K.Cell.Y + (1 << 19))) & 0xFFFFFu;
		const uint64_t Z = uint64_t(uint32_t(K.Cell.Z + (1 << 15))) & 0xFFFFu;
		return (X << 44) | (Y << 24) | (Z << 8) | (uint64_t(K.Type) << 2) | uint64_t(K.Dir & 3u);
	}

	// Harvesting: materials granted per pickaxe hit.
	inline int HarvestAmount(bool bWeakPoint, double ToolMultiplier = 1.0)
	{
		return int(std::round((bWeakPoint ? 10.0 : 5.0) * ToolMultiplier));
	}
}
