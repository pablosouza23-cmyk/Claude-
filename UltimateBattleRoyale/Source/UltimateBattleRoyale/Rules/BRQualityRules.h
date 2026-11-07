// Device quality tiers, dynamic resolution and AI/actor significance.
#pragma once

#include "BRRulesMath.h"

namespace BRRules
{
	enum class QualityTier : uint8_t { Low = 0, Medium = 1, High = 2 };

	struct DeviceInfo
	{
		double RamGB = 4.0;
		int CpuCores = 4;
		double GpuScore = 100.0;   // synthetic benchmark score (UE: 100 = reference GPU)
		double CpuScore = 100.0;
		bool bMobile = true;
	};

	inline QualityTier ClassifyDevice(const DeviceInfo& D)
	{
		if (D.bMobile)
		{
			if (D.RamGB < 4.5 || D.CpuCores < 6 || D.GpuScore < 60.0) { return QualityTier::Low; }
			if (D.RamGB >= 7.5 && D.CpuCores >= 8 && D.GpuScore >= 150.0) { return QualityTier::High; }
			return QualityTier::Medium;
		}
		if (D.RamGB < 8.0 || D.GpuScore < 150.0) { return QualityTier::Low; }
		if (D.RamGB >= 16.0 && D.GpuScore >= 400.0) { return QualityTier::High; }
		return QualityTier::Medium;
	}

	inline int TargetFps(QualityTier T, bool bMobile)
	{
		if (!bMobile) { return T == QualityTier::Low ? 60 : (T == QualityTier::Medium ? 90 : 120); }
		return T == QualityTier::Low ? 30 : (T == QualityTier::Medium ? 45 : 60);
	}

	// Proportional controller with hysteresis; returns new screen percentage.
	inline double NextResolutionScale(double Current, double AvgFrameMs, double TargetFrameMs, double MinScale, double MaxScale)
	{
		if (TargetFrameMs <= 0.0 || AvgFrameMs <= 0.0) { return Clamp(Current, MinScale, MaxScale); }
		const double Ratio = AvgFrameMs / TargetFrameMs;
		double Next = Current;
		if (Ratio > 1.05)       { Next = Current - Min(10.0, (Ratio - 1.0) * 40.0); }  // over budget: drop fast
		else if (Ratio < 0.85)  { Next = Current + 2.0; }                               // headroom: recover slowly
		return Clamp(Next, MinScale, MaxScale);
	}

	// Far bots think less often: the main CPU saver on mobile servers/clients.
	inline double AiThinkInterval(double DistanceToNearestHuman)
	{
		if (DistanceToNearestHuman < 5000.0) { return 0.1; }
		if (DistanceToNearestHuman < 15000.0) { return 0.35; }
		if (DistanceToNearestHuman < 40000.0) { return 1.0; }
		return 2.5;
	}

	inline double CullDistanceForTier(QualityTier T, double HighDistance)
	{
		const double Scale = T == QualityTier::Low ? 0.45 : (T == QualityTier::Medium ? 0.7 : 1.0);
		return HighDistance * Scale;
	}
}
