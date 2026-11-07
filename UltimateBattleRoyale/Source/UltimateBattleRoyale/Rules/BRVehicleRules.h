// Vehicle rules: raycast suspension, engine, fuel and collision damage.
#pragma once

#include "BRRulesMath.h"

namespace BRRules
{
	// Spring-damper suspension force (N along the suspension axis).
	inline double SuspensionForce(double Compression01, double CompressionVelocity, double Stiffness, double Damping)
	{
		if (Compression01 <= 0.0) { return 0.0; }
		return Max(0.0, Compression01 * Stiffness + CompressionVelocity * Damping);
	}

	// Simple engine: force falls off as speed approaches top speed.
	inline double EngineForce(double Throttle, double Speed, double MaxForce, double TopSpeed)
	{
		Throttle = Clamp(Throttle, -1.0, 1.0);
		if (TopSpeed <= 0.0) { return 0.0; }
		const double SpeedRatio = Clamp(std::fabs(Speed) / TopSpeed, 0.0, 1.0);
		const bool bSameDir = (Throttle >= 0.0) == (Speed >= 0.0) || std::fabs(Speed) < 1.0;
		const double Curve = bSameDir ? (1.0 - SpeedRatio * SpeedRatio) : 1.0;
		return Throttle * MaxForce * Curve;
	}

	inline double ConsumeFuel(double Fuel, double Throttle, double Dt, double LitersPerSecondAtFull = 0.12, double IdlePerSecond = 0.01)
	{
		const double Use = (IdlePerSecond + std::fabs(Clamp(Throttle, -1.0, 1.0)) * LitersPerSecondAtFull) * Dt;
		return Max(0.0, Fuel - Use);
	}

	// Damage taken by the vehicle (and a fraction by occupants) from an impact.
	inline double CollisionDamage(double ImpactSpeedCmPerSec, double Threshold = 900.0, double DamagePerMps = 6.0)
	{
		if (ImpactSpeedCmPerSec <= Threshold) { return 0.0; }
		return (ImpactSpeedCmPerSec - Threshold) / 100.0 * DamagePerMps;
	}

	// Damage dealt to a pedestrian run over by a vehicle.
	inline double RunOverDamage(double SpeedCmPerSec) { return SpeedCmPerSec < 700.0 ? 0.0 : Min(120.0, SpeedCmPerSec / 40.0); }

	inline double SpeedKmh(double CmPerSec) { return CmPerSec * 0.036; }
}
