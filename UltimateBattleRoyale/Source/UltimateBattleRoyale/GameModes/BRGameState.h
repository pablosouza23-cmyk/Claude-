#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameStateBase.h"
#include "GameModes/BRModeRules.h"
#include "BRGameState.generated.h"

class ABRStormController;
class ABRBattleBus;
class ABRSkyController;
class ABRWorldGenerator;

USTRUCT(BlueprintType)
struct FBRKillFeedEntry
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly) FString Killer;
	UPROPERTY(BlueprintReadOnly) FString Victim;
	UPROPERTY(BlueprintReadOnly) FString Weapon;
	UPROPERTY(BlueprintReadOnly) bool bHeadshot = false;
	UPROPERTY(BlueprintReadOnly) bool bDowned = false;
	float LocalTime = 0.f;
};

USTRUCT(BlueprintType)
struct FBRPingMarker
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly) FVector_NetQuantize Location;
	UPROPERTY(BlueprintReadOnly) int32 TeamId = INDEX_NONE;
	UPROPERTY(BlueprintReadOnly) FString Owner;
	UPROPERTY(BlueprintReadOnly) uint8 Kind = 0; // 0 location, 1 enemy, 2 loot
	UPROPERTY() double ExpireTime = 0.0;
};

UCLASS()
class ULTIMATEBATTLEROYALE_API ABRGameState : public AGameStateBase
{
	GENERATED_BODY()

public:
	ABRGameState();
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	const FBRModeRules& GetModeRules() const { return ModeRules; }
	EBRMatchPhase GetMatchPhase() const { return MatchPhase; }
	float GetPhaseSecondsRemaining() const;
	int32 GetPlayersAlive() const { return PlayersAlive; }
	int32 GetTeamsAlive() const { return TeamsAlive; }
	int32 GetWinningTeam() const { return WinningTeam; }
	ABRStormController* GetStorm() const { return Storm; }
	ABRBattleBus* GetBus() const { return Bus; }
	ABRSkyController* GetSky() const { return Sky; }
	ABRWorldGenerator* GetWorldGenerator() const { return WorldGenerator; }
	const TArray<FBRPingMarker>& GetPings() const { return Pings; }
	const TArray<FBRKillFeedEntry>& GetKillFeed() const { return LocalKillFeed; }
	const FString& GetMatchId() const { return MatchId; }

	// Server setters (game mode only).
	void SetModeRules(const FBRModeRules& Rules) { ModeRules = Rules; }
	void SetMatchPhase(EBRMatchPhase Phase, float DurationSeconds);
	void SetAliveCounts(int32 Players, int32 Teams) { PlayersAlive = Players; TeamsAlive = Teams; }
	void SetWinningTeam(int32 Team) { WinningTeam = Team; }
	void SetWorldActors(ABRStormController* InStorm, ABRSkyController* InSky, ABRWorldGenerator* InGen) { Storm = InStorm; Sky = InSky; WorldGenerator = InGen; }
	void SetBus(ABRBattleBus* InBus) { Bus = InBus; }
	void SetMatchId(const FString& Id) { MatchId = Id; }
	void AddPing(const FBRPingMarker& Ping);
	void PrunePings();

	UFUNCTION(NetMulticast, Reliable) void MulticastKillFeed(const FBRKillFeedEntry& Entry);
	UFUNCTION(NetMulticast, Unreliable) void MulticastExplosionFX(FVector_NetQuantize Location, float Radius);
	UFUNCTION(NetMulticast, Reliable) void MulticastAnnouncement(const FText& Message);

	DECLARE_MULTICAST_DELEGATE_OneParam(FBRAnnouncement, const FText&);
	FBRAnnouncement OnAnnouncement;

protected:
	UFUNCTION() void OnRep_MatchPhase();

private:
	UPROPERTY(Replicated) FBRModeRules ModeRules;
	UPROPERTY(ReplicatedUsing = OnRep_MatchPhase) EBRMatchPhase MatchPhase = EBRMatchPhase::WaitingForPlayers;
	UPROPERTY(Replicated) double PhaseEndTime = 0.0;
	UPROPERTY(Replicated) int32 PlayersAlive = 0;
	UPROPERTY(Replicated) int32 TeamsAlive = 0;
	UPROPERTY(Replicated) int32 WinningTeam = INDEX_NONE;
	UPROPERTY(Replicated) TObjectPtr<ABRStormController> Storm;
	UPROPERTY(Replicated) TObjectPtr<ABRBattleBus> Bus;
	UPROPERTY(Replicated) TObjectPtr<ABRSkyController> Sky;
	UPROPERTY(Replicated) TObjectPtr<ABRWorldGenerator> WorldGenerator;
	UPROPERTY(Replicated) TArray<FBRPingMarker> Pings;
	UPROPERTY(Replicated) FString MatchId;

	TArray<FBRKillFeedEntry> LocalKillFeed;
};
