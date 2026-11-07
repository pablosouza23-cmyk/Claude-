// Anti-cheat rules: movement plausibility, suspicion scoring and RPC rate limiting.
#pragma once

#include "BRRulesMath.h"

namespace BRRules
{
	enum class MoveVerdict : uint8_t { Ok = 0, SpeedViolation, Teleport };

	struct MoveLimits
	{
		double MaxHorizontalSpeed = 1000.0; // cm/s (on foot, incl. sprint + slide)
		double MaxUpSpeed = 1500.0;         // launch pads / jumps
		double MaxFallSpeed = 8000.0;       // skydiving
		double Tolerance = 1.25;            // multiplier on limits
		double TeleportDistance = 5000.0;   // single-sample jump that is never legit
	};

	inline MoveLimits LimitsOnFoot() { return MoveLimits{}; }
	inline MoveLimits LimitsSkydiving() { MoveLimits L; L.MaxHorizontalSpeed = 2600.0; L.MaxFallSpeed = 8000.0; return L; }
	inline MoveLimits LimitsVehicle() { MoveLimits L; L.MaxHorizontalSpeed = 4500.0; L.MaxUpSpeed = 3000.0; L.TeleportDistance = 9000.0; return L; }

	inline MoveVerdict ValidateMove(const Vec3& Prev, const Vec3& Cur, double Dt, const MoveLimits& L)
	{
		const Vec3 D = Cur - Prev;
		if (D.Size() > L.TeleportDistance) { return MoveVerdict::Teleport; }
		if (Dt <= 1e-4) { return MoveVerdict::Ok; }
		const double H = D.Size2D() / Dt;
		const double V = D.Z / Dt;
		if (H > L.MaxHorizontalSpeed * L.Tolerance) { return MoveVerdict::SpeedViolation; }
		if (V > L.MaxUpSpeed * L.Tolerance) { return MoveVerdict::SpeedViolation; }
		if (-V > L.MaxFallSpeed * L.Tolerance) { return MoveVerdict::SpeedViolation; }
		return MoveVerdict::Ok;
	}

	// Suspicion rises on violations and decays over time. Action thresholds below.
	inline double UpdateSuspicion(double Score, MoveVerdict V, double Dt, double DecayPerSecond = 2.0)
	{
		double S = Max(0.0, Score - DecayPerSecond * Dt);
		if (V == MoveVerdict::SpeedViolation) { S += 10.0; }
		else if (V == MoveVerdict::Teleport) { S += 50.0; }
		return S;
	}

	constexpr double SuspicionCorrectThreshold = 25.0; // snap back to last valid position
	constexpr double SuspicionKickThreshold = 150.0;    // remove from match + log

	// Token bucket used to rate-limit server RPCs (fire, build, pickup, chat, report).
	struct TokenBucket
	{
		double Capacity = 10.0;
		double RefillPerSecond = 10.0;
		double Tokens = 10.0;
		double LastTime = -1.0;

		TokenBucket() = default;
		TokenBucket(double InCapacity, double InRefill) : Capacity(InCapacity), RefillPerSecond(InRefill), Tokens(InCapacity) {}

		bool Consume(double Now, double Cost = 1.0)
		{
			if (LastTime >= 0.0) { Tokens = Min(Capacity, Tokens + (Now - LastTime) * RefillPerSecond); }
			LastTime = Now;
			if (Tokens + 1e-9 < Cost) { return false; }
			Tokens -= Cost;
			return true;
		}
	};

	// Inventory sanity: counts must be within [0, Max].
	inline bool IsCountValid(int Count, int MaxCount) { return Count >= 0 && Count <= MaxCount; }

	// Interaction distance check (pickups, chests, doors, revive).
	inline bool IsWithinInteractRange(const Vec3& Pawn, const Vec3& Target, double Range = 350.0)
	{
		return Dist(Pawn, Target) <= Range;
	}
}
