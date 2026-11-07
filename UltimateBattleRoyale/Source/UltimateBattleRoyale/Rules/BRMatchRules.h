// Match flow rules: start conditions, placement, bus path, team assignment.
#pragma once

#include "BRRulesMath.h"

namespace BRRules
{
	inline bool ShouldStartMatch(int Players, int MinPlayers, int MaxPlayers, double SecondsWaiting, double MaxWaitSeconds)
	{
		if (Players <= 0) { return false; }
		if (Players >= MaxPlayers) { return true; }
		return Players >= MinPlayers && SecondsWaiting >= MaxWaitSeconds;
	}

	// When a team is eliminated while N teams were alive, it finishes N-th.
	inline int PlacementForEliminatedTeam(int TeamsAliveBeforeElimination) { return MaxI(1, TeamsAliveBeforeElimination); }

	inline bool IsMatchWon(int TeamsAlive) { return TeamsAlive <= 1; }

	// Battle bus: random straight line crossing the map, passing near the centre.
	inline void ChooseBusPath(double MapHalfSize, double Altitude, Rng& R, Vec3& OutStart, Vec3& OutEnd)
	{
		const double Ang = R.NextUnit() * 2.0 * kPi;
		const double Offset = R.Range(-0.35, 0.35) * MapHalfSize;
		const double DX = std::cos(Ang), DY = std::sin(Ang);
		const double PX = -DY * Offset, PY = DX * Offset; // perpendicular shift
		const double L = MapHalfSize * 1.3;
		OutStart = Vec3(PX - DX * L, PY - DY * L, Altitude);
		OutEnd = Vec3(PX + DX * L, PY + DY * L, Altitude);
	}

	// Assigns team index for a player: party members stay together when possible.
	// PartyIndexOfPlayer = index of the player's party in join order; PartySize <= TeamSize keeps it whole.
	inline int TeamForSlot(int PlayerJoinIndex, int TeamSize)
	{
		return TeamSize <= 0 ? PlayerJoinIndex : PlayerJoinIndex / TeamSize;
	}

	inline int MaxTeams(int MaxPlayers, int TeamSize) { return TeamSize <= 0 ? MaxPlayers : (MaxPlayers + TeamSize - 1) / TeamSize; }
}
