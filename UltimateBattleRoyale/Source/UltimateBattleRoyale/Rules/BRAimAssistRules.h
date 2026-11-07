// Aim assist for touch and gamepad (never applied to mouse input).
#pragma once

#include "BRRulesMath.h"

namespace BRRules
{
	struct AimAssistParams
	{
		double Strength01 = 0.5;        // user setting
		double InnerConeDeg = 2.5;      // full slowdown inside
		double OuterConeDeg = 7.0;      // no effect outside
		double MaxDistance = 6000.0;    // cm
		double MaxSlowdown = 0.55;      // look speed multiplier floor at full strength
		double PullDegPerSec = 10.0;    // magnetism while moving the stick
	};

	inline double AimAssistWeight(double AngleDeg, double Distance, const AimAssistParams& P)
	{
		if (Distance > P.MaxDistance || AngleDeg >= P.OuterConeDeg) { return 0.0; }
		const double AngW = AngleDeg <= P.InnerConeDeg ? 1.0 : 1.0 - (AngleDeg - P.InnerConeDeg) / (P.OuterConeDeg - P.InnerConeDeg);
		const double DistW = 1.0 - Clamp(Distance / P.MaxDistance, 0.0, 1.0) * 0.5;
		return Clamp(AngW * DistW * Clamp(P.Strength01, 0.0, 1.0), 0.0, 1.0);
	}

	inline double AimSlowdownMultiplier(double Weight, const AimAssistParams& P)
	{
		return Lerp(1.0, P.MaxSlowdown, Clamp(Weight, 0.0, 1.0));
	}

	// Degrees to rotate toward the target this frame (only while the player is actively aiming/moving the stick).
	inline double AimPullStep(double Weight, double AngleDeg, double Dt, const AimAssistParams& P)
	{
		return Min(AngleDeg, P.PullDegPerSec * Clamp(Weight, 0.0, 1.0) * Dt);
	}
}
