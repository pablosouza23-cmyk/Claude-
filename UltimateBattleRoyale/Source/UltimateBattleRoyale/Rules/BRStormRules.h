// Safe zone ("storm") rules.
#pragma once

#include "BRRulesMath.h"

namespace BRRules
{
	struct StormPhaseDef
	{
		double WaitSeconds;     // time before shrinking starts (next circle visible)
		double ShrinkSeconds;   // time to shrink to next circle
		double RadiusScale;     // next radius = previous * scale
		double DamagePerSecond; // damage to players outside during this phase
	};

	inline int DefaultStormPhaseCount() { return 9; }

	inline StormPhaseDef DefaultStormPhase(int Index)
	{
		static const StormPhaseDef Table[] = {
			{ 90.0, 60.0, 0.60, 1.0 },
			{ 75.0, 55.0, 0.55, 2.0 },
			{ 60.0, 50.0, 0.55, 3.0 },
			{ 55.0, 45.0, 0.50, 5.0 },
			{ 45.0, 40.0, 0.50, 7.0 },
			{ 40.0, 35.0, 0.50, 8.0 },
			{ 30.0, 30.0, 0.45, 10.0 },
			{ 25.0, 30.0, 0.35, 10.0 },
			{ 20.0, 40.0, 0.00, 15.0 },
		};
		const int N = DefaultStormPhaseCount();
		return Table[ClampI(Index, 0, N - 1)];
	}

	struct Circle
	{
		double X = 0.0, Y = 0.0, Radius = 0.0;
	};

	// Picks the next circle fully contained inside the previous one.
	inline Circle ChooseNextCircle(const Circle& Prev, double NewRadius, Rng& R)
	{
		NewRadius = Clamp(NewRadius, 0.0, Prev.Radius);
		const double Slack = Prev.Radius - NewRadius;
		const double Rad = Slack * std::sqrt(R.NextUnit());
		const double Ang = R.NextUnit() * 2.0 * kPi;
		Circle C;
		C.X = Prev.X + Rad * std::cos(Ang);
		C.Y = Prev.Y + Rad * std::sin(Ang);
		C.Radius = NewRadius;
		return C;
	}

	// Biases the next circle toward land: caller passes a validator; up to N tries.
	template <typename TIsValidFn>
	inline Circle ChooseNextCircleValidated(const Circle& Prev, double NewRadius, Rng& R, TIsValidFn IsValid, int Tries = 16)
	{
		Circle Best = ChooseNextCircle(Prev, NewRadius, R);
		for (int I = 0; I < Tries; ++I)
		{
			if (IsValid(Best.X, Best.Y)) { return Best; }
			Best = ChooseNextCircle(Prev, NewRadius, R);
		}
		return Best;
	}

	inline Circle InterpolateCircle(const Circle& From, const Circle& To, double Alpha)
	{
		Alpha = Clamp(Alpha, 0.0, 1.0);
		Circle C;
		C.X = Lerp(From.X, To.X, Alpha);
		C.Y = Lerp(From.Y, To.Y, Alpha);
		C.Radius = Lerp(From.Radius, To.Radius, Alpha);
		return C;
	}

	inline double DistanceOutside(const Circle& C, double X, double Y)
	{
		const double D = std::sqrt((X - C.X) * (X - C.X) + (Y - C.Y) * (Y - C.Y));
		return Max(0.0, D - C.Radius);
	}

	inline bool IsOutside(const Circle& C, double X, double Y) { return DistanceOutside(C, X, Y) > 0.0; }

	inline double PhaseAlpha(double Now, double Start, double Duration)
	{
		if (Duration <= 0.0) { return 1.0; }
		return Clamp((Now - Start) / Duration, 0.0, 1.0);
	}

	// Evaluates the full timeline: which phase we are in and whether it is shrinking.
	struct StormTimelineSample
	{
		int Phase = 0;
		bool bShrinking = false;
		double Alpha = 0.0;        // shrink progress when bShrinking
		double SecondsLeft = 0.0;  // in current wait/shrink segment
		bool bFinished = false;
	};

	inline StormTimelineSample EvaluateStormTimeline(double Elapsed, int PhaseCount = -1)
	{
		if (PhaseCount < 0) { PhaseCount = DefaultStormPhaseCount(); }
		StormTimelineSample S;
		double T = Max(0.0, Elapsed);
		for (int I = 0; I < PhaseCount; ++I)
		{
			const StormPhaseDef P = DefaultStormPhase(I);
			S.Phase = I;
			if (T < P.WaitSeconds) { S.bShrinking = false; S.SecondsLeft = P.WaitSeconds - T; return S; }
			T -= P.WaitSeconds;
			if (T < P.ShrinkSeconds) { S.bShrinking = true; S.Alpha = T / P.ShrinkSeconds; S.SecondsLeft = P.ShrinkSeconds - T; return S; }
			T -= P.ShrinkSeconds;
		}
		S.bFinished = true;
		S.Phase = PhaseCount - 1;
		S.bShrinking = false;
		S.Alpha = 1.0;
		return S;
	}
}
