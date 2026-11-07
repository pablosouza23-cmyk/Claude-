// Combat rules: damage, falloff, shields, spread/bloom, recoil, fire-rate and server hit validation.
#pragma once

#include "BRRulesMath.h"

namespace BRRules
{
	enum class HitZone : uint8_t { Body = 0, Head = 1, Limb = 2 };

	struct FalloffParams
	{
		double FullDamageRange = 2500.0;   // cm: full damage up to here
		double MinDamageRange = 8000.0;    // cm: minimum multiplier reached here
		double MinMultiplier = 0.6;        // damage multiplier at/after MinDamageRange
	};

	inline double FalloffMultiplier(double Distance, const FalloffParams& P)
	{
		if (Distance <= P.FullDamageRange) { return 1.0; }
		if (Distance >= P.MinDamageRange || P.MinDamageRange <= P.FullDamageRange) { return P.MinMultiplier; }
		const double T = (Distance - P.FullDamageRange) / (P.MinDamageRange - P.FullDamageRange);
		return Lerp(1.0, P.MinMultiplier, T);
	}

	inline double ComputeHitDamage(double BaseDamage, double Distance, const FalloffParams& Falloff,
		HitZone Zone, double HeadshotMultiplier, double LimbMultiplier)
	{
		double Zm = 1.0;
		if (Zone == HitZone::Head) { Zm = HeadshotMultiplier; }
		else if (Zone == HitZone::Limb) { Zm = LimbMultiplier; }
		return Max(0.0, BaseDamage * FalloffMultiplier(Distance, Falloff) * Zm);
	}

	struct DamageApplication
	{
		double NewHealth = 0.0;
		double NewShield = 0.0;
		double AbsorbedByShield = 0.0;
		double AppliedToHealth = 0.0;
		bool bHealthDepleted = false;
		bool bShieldBroken = false;
	};

	// Shield absorbs damage first; overflow goes to health. Storm/fall damage ignores shield.
	inline DamageApplication ApplyDamage(double Health, double Shield, double Damage, bool bIgnoreShield)
	{
		DamageApplication R;
		Damage = Max(0.0, Damage);
		double Remaining = Damage;
		R.NewShield = Shield;
		if (!bIgnoreShield && Shield > 0.0)
		{
			R.AbsorbedByShield = Min(Shield, Remaining);
			R.NewShield = Shield - R.AbsorbedByShield;
			Remaining -= R.AbsorbedByShield;
			R.bShieldBroken = R.NewShield <= 0.0;
		}
		R.AppliedToHealth = Min(Health, Remaining);
		R.NewHealth = Health - R.AppliedToHealth;
		R.bHealthDepleted = R.NewHealth <= 0.0;
		return R;
	}

	// Heals never push above Cap and never reduce an already-higher value (e.g. bandage cap 75).
	inline double ApplyHeal(double Current, double Amount, double Cap)
	{
		if (Current >= Cap) { return Current; }
		return Min(Cap, Current + Max(0.0, Amount));
	}

	struct SpreadParams
	{
		double HipSpreadDeg = 3.0;
		double AimMultiplier = 0.35;
		double CrouchMultiplier = 0.75;
		double MovingAddDeg = 1.5;      // at full run speed
		double AirborneAddDeg = 4.0;
		double BloomPerShotDeg = 0.6;
		double MaxBloomDeg = 4.0;
		double BloomRecoveryDegPerSec = 6.0;
	};

	inline double ComputeSpreadDeg(const SpreadParams& P, double Bloom, bool bAiming, bool bCrouching,
		double SpeedRatio01, bool bAirborne)
	{
		double S = P.HipSpreadDeg + P.MovingAddDeg * Clamp(SpeedRatio01, 0.0, 1.0) + Clamp(Bloom, 0.0, P.MaxBloomDeg);
		if (bAirborne) { S += P.AirborneAddDeg; }
		if (bCrouching) { S *= P.CrouchMultiplier; }
		if (bAiming) { S *= P.AimMultiplier; }
		return Max(0.0, S);
	}

	inline double AddBloom(double Bloom, const SpreadParams& P) { return Min(P.MaxBloomDeg, Bloom + P.BloomPerShotDeg); }
	inline double RecoverBloom(double Bloom, const SpreadParams& P, double Dt) { return Max(0.0, Bloom - P.BloomRecoveryDegPerSec * Dt); }

	// Uniform sample inside a cone of HalfAngleDeg, returned as yaw/pitch offsets in degrees.
	inline void SampleConeOffset(Rng& R, double HalfAngleDeg, double& OutYawDeg, double& OutPitchDeg)
	{
		const double Radius = HalfAngleDeg * std::sqrt(R.NextUnit());
		const double Theta = R.NextUnit() * 2.0 * kPi;
		OutYawDeg = Radius * std::cos(Theta);
		OutPitchDeg = Radius * std::sin(Theta);
	}

	// Learnable recoil: mostly vertical, with a seeded horizontal sway; first shots kick harder.
	inline void RecoilForShot(int ShotIndex, double VerticalKickDeg, double HorizontalKickDeg, uint32_t Seed,
		double& OutPitchDeg, double& OutYawDeg)
	{
		Rng R(HashCombine(Seed, uint32_t(ShotIndex) + 1u));
		const double Ramp = ShotIndex < 4 ? 1.0 + 0.15 * (4 - ShotIndex) : 1.0;
		OutPitchDeg = VerticalKickDeg * Ramp * R.Range(0.85, 1.15);
		OutYawDeg = HorizontalKickDeg * R.Range(-1.0, 1.0);
	}

	inline double ShotInterval(double RoundsPerMinute) { return RoundsPerMinute > 0.0 ? 60.0 / RoundsPerMinute : 1.0; }

	// Server check: rejects shots faster than the weapon can fire (tolerance absorbs jitter).
	inline bool IsFireRateValid(double LastShotTime, double Now, double RoundsPerMinute, double Tolerance = 0.8)
	{
		if (LastShotTime < 0.0) { return true; }
		return (Now - LastShotTime) >= ShotInterval(RoundsPerMinute) * Tolerance;
	}

	inline bool IsShotOriginPlausible(const Vec3& ClaimedOrigin, const Vec3& ServerEyes, double MaxError)
	{
		return Dist(ClaimedOrigin, ServerEyes) <= MaxError;
	}

	inline bool IsHitWithinRange(const Vec3& Origin, const Vec3& Hit, double MaxRange)
	{
		return Dist(Origin, Hit) <= MaxRange;
	}

	// Angle between the aim direction and the vector to the claimed hit.
	inline double AngleToPointDeg(const Vec3& Origin, const Vec3& DirUnit, const Vec3& Point)
	{
		const Vec3 ToHit = (Point - Origin).Normalized();
		const double C = Clamp(ToHit.Dot(DirUnit.Normalized()), -1.0, 1.0);
		return RadToDeg(std::acos(C));
	}

	inline bool IsHitAlignedWithAim(const Vec3& Origin, const Vec3& DirUnit, const Vec3& Point, double MaxDeg)
	{
		return AngleToPointDeg(Origin, DirUnit, Point) <= MaxDeg;
	}

	// Lag compensation check against a rewound vertical capsule.
	inline bool IsPointNearCapsule(const Vec3& P, const Vec3& Center, double Radius, double HalfHeight, double Tolerance)
	{
		const double DZ = Clamp(P.Z, Center.Z - (HalfHeight - Radius), Center.Z + (HalfHeight - Radius));
		const Vec3 Closest(Center.X, Center.Y, DZ);
		return Dist(P, Closest) <= Radius + Tolerance;
	}

	// Head zone = top 22% of the capsule.
	inline HitZone ClassifyHitZone(double HitZ, double CapsuleCenterZ, double HalfHeight)
	{
		const double Rel = (HitZ - (CapsuleCenterZ - HalfHeight)) / (2.0 * HalfHeight);
		if (Rel >= 0.78) { return HitZone::Head; }
		if (Rel <= 0.30) { return HitZone::Limb; }
		return HitZone::Body;
	}

	inline double RadialDamage(double BaseDamage, double MinDamage, double InnerRadius, double OuterRadius, double Distance)
	{
		if (Distance >= OuterRadius) { return 0.0; }
		if (Distance <= InnerRadius) { return BaseDamage; }
		const double T = (Distance - InnerRadius) / Max(1e-6, OuterRadius - InnerRadius);
		return Lerp(BaseDamage, MinDamage, T);
	}

	inline double FallDamage(double ImpactSpeed, double SafeSpeed = 1100.0, double LethalSpeed = 2600.0, double MaxDamage = 100.0)
	{
		if (ImpactSpeed <= SafeSpeed) { return 0.0; }
		const double T = Clamp((ImpactSpeed - SafeSpeed) / (LethalSpeed - SafeSpeed), 0.0, 1.0);
		return T * MaxDamage;
	}

	// Down-but-not-out bleed-out.
	inline double BleedOut(double DownedHealth, double Dt, double PerSecond = 10.0)
	{
		return Max(0.0, DownedHealth - PerSecond * Dt);
	}
}
