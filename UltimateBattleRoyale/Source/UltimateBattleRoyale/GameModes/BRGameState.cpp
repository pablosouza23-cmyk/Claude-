#include "GameModes/BRGameState.h"

#include "Audio/BRProceduralAudio.h"
#include "Net/UnrealNetwork.h"
#include "Weapons/BRProjectile.h"

ABRGameState::ABRGameState()
{
	NetUpdateFrequency = 10.f;
}

void ABRGameState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRGameState, ModeRules);
	DOREPLIFETIME(ABRGameState, MatchPhase);
	DOREPLIFETIME(ABRGameState, PhaseEndTime);
	DOREPLIFETIME(ABRGameState, PlayersAlive);
	DOREPLIFETIME(ABRGameState, TeamsAlive);
	DOREPLIFETIME(ABRGameState, WinningTeam);
	DOREPLIFETIME(ABRGameState, Storm);
	DOREPLIFETIME(ABRGameState, Bus);
	DOREPLIFETIME(ABRGameState, Sky);
	DOREPLIFETIME(ABRGameState, WorldGenerator);
	DOREPLIFETIME(ABRGameState, Pings);
	DOREPLIFETIME(ABRGameState, MatchId);
}

void ABRGameState::SetMatchPhase(EBRMatchPhase Phase, float DurationSeconds)
{
	MatchPhase = Phase;
	PhaseEndTime = GetServerWorldTimeSeconds() + DurationSeconds;
	OnRep_MatchPhase();
}

float ABRGameState::GetPhaseSecondsRemaining() const
{
	return FMath::Max(0.f, float(PhaseEndTime - GetServerWorldTimeSeconds()));
}

void ABRGameState::OnRep_MatchPhase()
{
	if (GetNetMode() == NM_DedicatedServer) { return; }
	if (MatchPhase == EBRMatchPhase::BusFlight) { UBRProceduralAudio::PlaySfx(this, EBRSfx::Horn, FVector::ZeroVector, 0.6f); }
}

void ABRGameState::AddPing(const FBRPingMarker& Ping)
{
	// Max 3 active pings per player.
	int32 Count = 0;
	for (int32 I = Pings.Num() - 1; I >= 0; --I)
	{
		if (Pings[I].Owner == Ping.Owner && ++Count >= 3) { Pings.RemoveAt(I); }
	}
	Pings.Add(Ping);
}

void ABRGameState::PrunePings()
{
	const double Now = GetServerWorldTimeSeconds();
	Pings.RemoveAll([Now](const FBRPingMarker& P) { return P.ExpireTime < Now; });
}

void ABRGameState::MulticastKillFeed_Implementation(const FBRKillFeedEntry& Entry)
{
	FBRKillFeedEntry E = Entry;
	E.LocalTime = GetWorld()->GetTimeSeconds();
	LocalKillFeed.Insert(E, 0);
	if (LocalKillFeed.Num() > 6) { LocalKillFeed.SetNum(6); }
}

void ABRGameState::MulticastExplosionFX_Implementation(FVector_NetQuantize Location, float Radius)
{
	ABRProjectile::PlayExplosionFX(this, Location, Radius);
}

void ABRGameState::MulticastAnnouncement_Implementation(const FText& Message)
{
	OnAnnouncement.Broadcast(Message);
}
