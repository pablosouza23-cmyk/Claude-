// Ultimate Battle Royale - pure gameplay rules (no engine dependency).
// These headers are compiled both by Unreal (gameplay code) and by the standalone
// test-suite in Tests/RulesTests, so every rule that decides combat, economy or
// match flow is unit-tested outside the engine.
#pragma once

#include <cmath>
#include <cstdint>

namespace BRRules
{
	constexpr double kPi = 3.14159265358979323846;

	inline double Min(double A, double B) { return A < B ? A : B; }
	inline double Max(double A, double B) { return A > B ? A : B; }
	inline int MinI(int A, int B) { return A < B ? A : B; }
	inline int MaxI(int A, int B) { return A > B ? A : B; }
	inline double Clamp(double V, double Lo, double Hi) { return V < Lo ? Lo : (V > Hi ? Hi : V); }
	inline int ClampI(int V, int Lo, int Hi) { return V < Lo ? Lo : (V > Hi ? Hi : V); }
	inline double Lerp(double A, double B, double T) { return A + (B - A) * T; }
	inline double DegToRad(double D) { return D * kPi / 180.0; }
	inline double RadToDeg(double R) { return R * 180.0 / kPi; }

	struct Vec3
	{
		double X = 0.0, Y = 0.0, Z = 0.0;
		Vec3() = default;
		Vec3(double InX, double InY, double InZ) : X(InX), Y(InY), Z(InZ) {}
		Vec3 operator+(const Vec3& O) const { return Vec3(X + O.X, Y + O.Y, Z + O.Z); }
		Vec3 operator-(const Vec3& O) const { return Vec3(X - O.X, Y - O.Y, Z - O.Z); }
		Vec3 operator*(double S) const { return Vec3(X * S, Y * S, Z * S); }
		double Dot(const Vec3& O) const { return X * O.X + Y * O.Y + Z * O.Z; }
		double Size() const { return std::sqrt(X * X + Y * Y + Z * Z); }
		double Size2D() const { return std::sqrt(X * X + Y * Y); }
		Vec3 Normalized() const
		{
			const double S = Size();
			return S > 1e-9 ? Vec3(X / S, Y / S, Z / S) : Vec3();
		}
	};

	inline double Dist(const Vec3& A, const Vec3& B) { return (A - B).Size(); }
	inline double Dist2D(const Vec3& A, const Vec3& B) { return (A - B).Size2D(); }

	// Deterministic xorshift32 RNG. Same seed => same sequence on server, client and tests.
	struct Rng
	{
		uint32_t State;
		explicit Rng(uint32_t Seed) : State(Seed ? Seed : 0x9E3779B9u) {}
		uint32_t Next()
		{
			uint32_t S = State;
			S ^= S << 13;
			S ^= S >> 17;
			S ^= S << 5;
			State = S;
			return S;
		}
		// [0, 1)
		double NextUnit() { return double(Next() >> 8) * (1.0 / 16777216.0); }
		double Range(double Lo, double Hi) { return Lo + (Hi - Lo) * NextUnit(); }
		// Inclusive range.
		int RangeInt(int Lo, int Hi)
		{
			if (Hi <= Lo) { return Lo; }
			return Lo + int(Next() % uint32_t(Hi - Lo + 1));
		}
	};

	inline uint32_t HashCombine(uint32_t A, uint32_t B)
	{
		uint32_t H = A ^ (B + 0x9E3779B9u + (A << 6) + (A >> 2));
		H ^= H >> 16; H *= 0x7FEB352Du; H ^= H >> 15; H *= 0x846CA68Bu; H ^= H >> 16;
		return H;
	}

	inline uint32_t Hash2D(int X, int Y, uint32_t Seed)
	{
		return HashCombine(HashCombine(Seed, uint32_t(X) * 73856093u), uint32_t(Y) * 19349663u);
	}

	// Smooth value noise in [0,1], deterministic for a seed (used by the world generator).
	inline double ValueNoise2D(double X, double Y, uint32_t Seed)
	{
		const int X0 = int(std::floor(X)), Y0 = int(std::floor(Y));
		const double FX = X - X0, FY = Y - Y0;
		auto H = [Seed](int IX, int IY) { return double(Hash2D(IX, IY, Seed) & 0xFFFFFF) / double(0xFFFFFF); };
		const double SX = FX * FX * (3.0 - 2.0 * FX), SY = FY * FY * (3.0 - 2.0 * FY);
		const double A = Lerp(H(X0, Y0), H(X0 + 1, Y0), SX);
		const double B = Lerp(H(X0, Y0 + 1), H(X0 + 1, Y0 + 1), SX);
		return Lerp(A, B, SY);
	}

	inline double FractalNoise2D(double X, double Y, uint32_t Seed, int Octaves)
	{
		double Sum = 0.0, Amp = 1.0, Norm = 0.0, Freq = 1.0;
		for (int I = 0; I < Octaves; ++I)
		{
			Sum += ValueNoise2D(X * Freq, Y * Freq, Seed + uint32_t(I) * 1013u) * Amp;
			Norm += Amp;
			Amp *= 0.5;
			Freq *= 2.0;
		}
		return Norm > 0.0 ? Sum / Norm : 0.0;
	}
}
