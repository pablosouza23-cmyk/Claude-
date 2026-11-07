// Inventory rules: stack math and caps.
#pragma once

#include "BRRulesMath.h"

namespace BRRules
{
	constexpr int InventorySlotCount = 5;
	constexpr int MaxBuildMaterial = 999;

	struct StackResult
	{
		int NewCount = 0;
		int Overflow = 0;
	};

	inline StackResult AddToStack(int Current, int Add, int MaxStack)
	{
		StackResult R;
		Current = MaxI(0, Current);
		Add = MaxI(0, Add);
		MaxStack = MaxI(1, MaxStack);
		const int Space = MaxI(0, MaxStack - Current);
		const int Taken = MinI(Space, Add);
		R.NewCount = Current + Taken;
		R.Overflow = Add - Taken;
		return R;
	}

	// Removes up to Amount; returns how many were actually removed.
	inline int RemoveFromStack(int& Current, int Amount)
	{
		const int Removed = MinI(MaxI(0, Current), MaxI(0, Amount));
		Current -= Removed;
		return Removed;
	}

	inline int MaxAmmoForType(int AmmoTypeIndex)
	{
		// None, Light, Medium, Heavy, Shells, Rockets, Energy
		static const int Caps[] = { 0, 999, 999, 999, 999, 30, 600 };
		return Caps[ClampI(AmmoTypeIndex, 0, 6)];
	}

	// Rounds that a reload can load into the magazine.
	inline int RoundsToReload(int InMag, int MagSize, int Reserve)
	{
		return MaxI(0, MinI(MagSize - InMag, Reserve));
	}
}
