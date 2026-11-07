#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GameModes/BRModeRules.h"
#include "BRGameMode.generated.h"

class ABRCharacter;
class ABRPlayerController;
class ABRPlayerState;
class ABRGameState;
class ABRWorldGenerator;
class ABRStormController;
class ABRBattleBus;
class ABRSkyController;
class ABRAIController;

// Server-authoritative match flow for every mode:
//   WaitingForPlayers (warm-up island, respawns) -> BusFlight (choose drop) -> Playing (storm,
//   supply drops, eliminations, down-but-not-out, spectating) -> EndGame (results, XP) -> PostMatch.
// Respawn modes (shooting range, creative) skip the bus/storm. Supports reconnection.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ABRGameMode();

	virtual void InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage) override;
	virtual void InitGameState() override;
	virtual void BeginPlay() override;
	virtual FString InitNewPlayer(APlayerController* NewPlayerController, const FUniqueNetIdRepl& UniqueId, const FString& Options, const FString& Portal) override;
	virtual void PostLogin(APlayerController* NewPlayer) override;
	virtual void Logout(AController* Exiting) override;
	virtual void HandleStartingNewPlayer_Implementation(APlayerController* NewPlayer) override;
	virtual bool PlayerCanRestart_Implementation(APlayerController* Player) override { return false; }

	// ---- Called by gameplay systems
	bool ShouldDownInsteadOfEliminate(ABRCharacter* Character) const;
	void OnCharacterDowned(ABRCharacter* Victim, AController* Instigator, AActor* Causer);
	void OnCharacterEliminated(ABRCharacter* Victim, AController* Killer, AActor* Causer, bool bHeadshot);
	void OnCharacterRevived(ABRCharacter* Revived, ABRCharacter* By);
	void HandleJumpFromBus(AController* Controller);
	void BroadcastChat(ABRPlayerController* From, const FString& Message, bool bTeam);
	void SpectateNext(ABRPlayerController* PC);
	void HandleCreativeCommand(ABRPlayerController* PC, const FString& Command, const FString& Arg);

	const FBRModeRules& GetRules() const { return Rules; }
	ABRCharacter* SpawnCharacterFor(AController* Controller, const FVector& Location, bool bSkydive);

private:
	ABRGameState* GetBRGameState() const;
	void SetupWorld();
	void OnWorldReady();
	void SpawnWorldLoot();
	void ServerTick();
	void StartBusPhase();
	void StartPlayingPhase();
	void EndMatch(int32 WinningTeam);
	void FinishPostMatch();
	void UpdateAliveCounts();
	bool IsTeamOut(int32 TeamId) const;
	void EliminateTeamIfOut(int32 TeamId);
	int32 AssignTeam(ABRPlayerState* PS);
	void SpawnBots(int32 Count);
	void GiveStartingLoadout(ABRCharacter* Character);
	void SendMatchResult(ABRPlayerState* PS);
	void StartSpectating(ABRPlayerController* PC, AController* Preferred);
	void ScheduleRespawn(AController* Controller);
	FVector GetWarmupSpawnPoint();
	void SpawnShootingRange();
	void SaveCreativeIsland(const FString& Name) const;
	void LoadCreativeIsland(const FString& Name);

	FBRModeRules Rules;
	uint32 MatchSeed = 1;
	FString MatchId;
	bool bWorldReady = false;
	bool bLootSpawned = false;
	double WaitStartTime = 0.0;
	bool bCountdownStarted = false;
	int32 TeamsAtStart = 0;
	int32 NextBotIndex = 1;
	float NextSupplyDropTime = 0.f;
	FTimerHandle TickTimer;
	FTimerHandle PostMatchTimer;

	UPROPERTY(Transient) TObjectPtr<ABRWorldGenerator> Generator;
	UPROPERTY(Transient) TObjectPtr<ABRStormController> Storm;
	UPROPERTY(Transient) TObjectPtr<ABRBattleBus> Bus;
	UPROPERTY(Transient) TObjectPtr<ABRSkyController> Sky;

	// Bots' chosen drop moments (fraction of bus flight).
	TMap<TWeakObjectPtr<AController>, float> BotDropProgress;

	// Reconnection: characters kept alive for disconnected players (keyed by unique net id).
	struct FDisconnected { TWeakObjectPtr<ABRCharacter> Pawn; int32 Team = INDEX_NONE; int32 Kills = 0; double Time = 0.0; };
	TMap<FString, FDisconnected> Disconnected;
};
