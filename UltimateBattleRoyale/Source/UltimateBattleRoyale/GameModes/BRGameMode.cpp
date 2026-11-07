#include "GameModes/BRGameMode.h"

#include "AI/BRAIController.h"
#include "Building/BRBuildComponent.h"
#include "Building/BRBuildingPiece.h"
#include "Characters/BRCharacter.h"
#include "Characters/BRHealthComponent.h"
#include "Core/BRSettings.h"
#include "Dom/JsonObject.h"
#include "EngineUtils.h"
#include "GameFramework/GameSession.h"
#include "GameModes/BRGameState.h"
#include "GameModes/BRPlayerController.h"
#include "GameModes/BRPlayerState.h"
#include "Inventory/BRInventoryComponent.h"
#include "Items/BRItemRegistry.h"
#include "Items/BRLootContainer.h"
#include "Items/BRLootSubsystem.h"
#include "Kismet/GameplayStatics.h"
#include "Matchmaking/BRSessionSubsystem.h"
#include "Multiplayer/BRBackendClient.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Systems/BRBattleBus.h"
#include "Systems/BRMatchLogger.h"
#include "Systems/BRSkyController.h"
#include "Systems/BRStormController.h"
#include "Systems/BRTargetDummy.h"
#include "TimerManager.h"
#include "UltimateBattleRoyale.h"
#include "Vehicles/BRVehicle.h"
#include "Weapons/BRWeapon.h"
#include "World/BRWorldGenerator.h"
#include "World/BRWorldSubsystem.h"

#define LOCTEXT_NAMESPACE "BRGameMode"

ABRGameMode::ABRGameMode()
{
	DefaultPawnClass = ABRCharacter::StaticClass();
	PlayerControllerClass = ABRPlayerController::StaticClass();
	PlayerStateClass = ABRPlayerState::StaticClass();
	GameStateClass = ABRGameState::StaticClass();
	bUseSeamlessTravel = false;
}

ABRGameState* ABRGameMode::GetBRGameState() const { return GetGameState<ABRGameState>(); }

void ABRGameMode::InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage)
{
	Super::InitGame(MapName, Options, ErrorMessage);
	Rules = FBRModeRules::ForMode(FBRModeRules::ParseMode(UGameplayStatics::ParseOption(Options, TEXT("Mode"))));
	if (UGameplayStatics::HasOption(Options, TEXT("Bots")))
	{
		// Bots are opt-in and always flagged as bots in the UI/scoreboard.
		Rules.BotCount = FMath::Clamp(UGameplayStatics::GetIntOption(Options, TEXT("Bots"), Rules.BotCount), 0, 99);
	}
	if (UGameplayStatics::HasOption(Options, TEXT("MaxPlayers")))
	{
		Rules.MaxPlayers = FMath::Clamp(UGameplayStatics::GetIntOption(Options, TEXT("MaxPlayers"), Rules.MaxPlayers), 1, 100);
	}
	if (UGameplayStatics::HasOption(Options, TEXT("MinPlayers")))
	{
		Rules.MinPlayersToStart = FMath::Clamp(UGameplayStatics::GetIntOption(Options, TEXT("MinPlayers"), Rules.MinPlayersToStart), 1, 100);
	}
	const int32 Fixed = UBRSettings::Get()->FixedWorldSeed;
	MatchSeed = UGameplayStatics::HasOption(Options, TEXT("Seed")) ? uint32(UGameplayStatics::GetIntOption(Options, TEXT("Seed"), 1))
		: (Fixed != 0 ? uint32(Fixed) : (uint32(FDateTime::UtcNow().GetTicks()) | 1u));
	MatchId = FString::Printf(TEXT("%s_%s_%u"), *FBRModeRules::ModeToString(Rules.Mode), *FDateTime::UtcNow().ToString(TEXT("%Y%m%d_%H%M%S")), MatchSeed);
	if (GameSession) { GameSession->MaxPlayers = Rules.MaxPlayers; }
	UE_LOG(LogBR, Log, TEXT("InitGame: mode=%s seed=%u bots=%d max=%d"), *FBRModeRules::ModeToString(Rules.Mode), MatchSeed, Rules.BotCount, Rules.MaxPlayers);
}

void ABRGameMode::InitGameState()
{
	Super::InitGameState();
	if (ABRGameState* GS = GetBRGameState())
	{
		GS->SetModeRules(Rules);
		GS->SetMatchId(MatchId);
		GS->SetMatchPhase(EBRMatchPhase::WaitingForPlayers, UBRSettings::Get()->LobbyWaitSeconds);
	}
}

void ABRGameMode::BeginPlay()
{
	Super::BeginPlay();
	if (UBRMatchLogger* Log = GetWorld()->GetSubsystem<UBRMatchLogger>()) { Log->BeginMatch(MatchId); }
	if (UBRLootSubsystem* Loot = GetWorld()->GetSubsystem<UBRLootSubsystem>()) { Loot->SetSeed(MatchSeed); }
	SetupWorld();
	WaitStartTime = GetWorld()->GetTimeSeconds();
	GetWorldTimerManager().SetTimer(TickTimer, this, &ABRGameMode::ServerTick, 1.f, true);

	// Dedicated servers advertise themselves for matchmaking.
	if (GetNetMode() == NM_DedicatedServer)
	{
		if (UBRSessionSubsystem* Sessions = GetGameInstance()->GetSubsystem<UBRSessionSubsystem>())
		{
			Sessions->RegisterDedicatedServer(Rules.Mode, Rules.MaxPlayers);
		}
	}
}

void ABRGameMode::SetupWorld()
{
	UWorld* World = GetWorld();
	FActorSpawnParameters SP;
	SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	// Use an authored generator placed in the level if present, otherwise create one.
	for (TActorIterator<ABRWorldGenerator> It(World); It; ++It) { Generator = *It; break; }
	if (!Generator)
	{
		Generator = World->SpawnActorDeferred<ABRWorldGenerator>(ABRWorldGenerator::StaticClass(), FTransform::Identity, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
		Generator->InitSeed(MatchSeed);
		Generator->OnWorldGenerated.AddUObject(this, &ABRGameMode::OnWorldReady);
		Generator->FinishSpawning(FTransform::Identity);
	}
	else
	{
		Generator->OnWorldGenerated.AddUObject(this, &ABRGameMode::OnWorldReady);
		if (Generator->IsGenerated()) { OnWorldReady(); }
	}
	Storm = World->SpawnActor<ABRStormController>(ABRStormController::StaticClass(), FTransform::Identity, SP);
	Sky = World->SpawnActor<ABRSkyController>(ABRSkyController::StaticClass(), FTransform::Identity, SP);
	if (Sky)
	{
		BRRules::Rng R(MatchSeed);
		Sky->SetTimeOfDay(float(R.Range(7.0, 19.0)));
		Sky->bFrozen = Rules.bShootingRange || Rules.bCreativeTools;
	}
	if (ABRGameState* GS = GetBRGameState()) { GS->SetWorldActors(Storm, Sky, Generator); }
	if (Storm)
	{
		Storm->OnPhaseChanged.AddWeakLambda(this, [this](const FBRStormState& State)
		{
			// One supply drop at the start of each shrink, inside the next circle.
			if (State.bShrinking && Rules.bSupplyDrops)
			{
				if (UBRLootSubsystem* Loot = GetWorld()->GetSubsystem<UBRLootSubsystem>())
				{
					BRRules::Rng R(BRRules::HashCombine(MatchSeed, uint32(State.Phase) + 1000u));
					const float Ang = float(R.Range(0.0, 2.0 * PI));
					const float Dist = float(R.Range(0.0, 0.7)) * State.ToRadius;
					const FVector2D P = State.ToCenter + FVector2D(FMath::Cos(Ang), FMath::Sin(Ang)) * Dist;
					const UBRWorldSubsystem* WS = GetWorld()->GetSubsystem<UBRWorldSubsystem>();
					if (WS && WS->IsLand(P.X, P.Y))
					{
						Loot->SpawnSupplyDrop(FVector(P.X, P.Y, WS->GetTerrainHeight(P.X, P.Y)));
						if (ABRGameState* GS = GetBRGameState()) { GS->MulticastAnnouncement(LOCTEXT("SupplyDrop", "Suprimentos a caminho!")); }
					}
				}
			}
			if (State.Phase >= 0 && !State.bShrinking)
			{
				if (ABRGameState* GS = GetBRGameState()) { GS->MulticastAnnouncement(FText::Format(LOCTEXT("StormPhase", "Fase {0} da tempestade: a zona vai diminuir!"), FText::AsNumber(State.Phase + 1))); }
			}
		});
	}
}

void ABRGameMode::OnWorldReady()
{
	if (bWorldReady) { return; }
	bWorldReady = true;
	SpawnWorldLoot();
	if (Rules.bShootingRange) { SpawnShootingRange(); }
	// Players that joined before the world finished get their warm-up pawn now.
	for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
	{
		APlayerController* PC = It->Get();
		if (PC && !PC->GetPawn()) { SpawnCharacterFor(PC, GetWarmupSpawnPoint(), false); }
	}
	if (Rules.BotCount > 0 && Rules.bBus) { /* bots board the bus at departure */ }
	else if (Rules.BotCount > 0) { SpawnBots(Rules.BotCount); }
}

void ABRGameMode::SpawnWorldLoot()
{
	if (bLootSpawned || !Generator) { return; }
	bLootSpawned = true;
	UBRLootSubsystem* Loot = GetWorld()->GetSubsystem<UBRLootSubsystem>();
	if (!Loot) { return; }
	if (Rules.bWorldLoot)
	{
		for (const FVector& P : Generator->GetFloorLootSpots()) { Loot->SpawnFloorLoot(P); }
		for (const FTransform& T : Generator->GetChestSpots()) { Loot->SpawnContainer(EBRContainerKind::Chest, T); }
		for (const FTransform& T : Generator->GetAmmoBoxSpots()) { Loot->SpawnContainer(EBRContainerKind::AmmoBox, T); }
		for (const FTransform& T : Generator->GetSpecialChestSpots()) { Loot->SpawnContainer(EBRContainerKind::Llama, T); }
	}
	for (const FBRVehicleSpawn& V : Generator->GetVehicleSpawns())
	{
		if (ABRVehicle* Vehicle = GetWorld()->SpawnActorDeferred<ABRVehicle>(ABRVehicle::StaticClass(), V.Transform, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn))
		{
			Vehicle->InitVehicle(V.Type);
			Vehicle->FinishSpawning(V.Transform);
		}
	}
	UE_LOG(LogBR, Log, TEXT("Loot spawned: %d pickups."), Loot->GetSpawnedPickupCount());
}

FVector ABRGameMode::GetWarmupSpawnPoint()
{
	const UBRWorldSubsystem* WS = GetWorld()->GetSubsystem<UBRWorldSubsystem>();
	static BRRules::Rng R(4242u);
	if (Rules.bShootingRange || Rules.bCreativeTools)
	{
		// Range / creative happen on the airfield pad of Forte Granito.
		if (WS && WS->HasWorld())
		{
			const FBRNamedLocation& L = WS->GetNamedLocations()[6];
			return L.Location + FVector(float(R.Range(-800.0, 800.0)), float(R.Range(-800.0, 800.0)), 200.f);
		}
	}
	const FVector P = WS ? WS->FindRandomLandPoint(R) : FVector::ZeroVector;
	return P + FVector(0, 0, 200.f);
}

// --------------------------------------------------------------------------------- players
FString ABRGameMode::InitNewPlayer(APlayerController* NewPlayerController, const FUniqueNetIdRepl& UniqueId, const FString& Options, const FString& Portal)
{
	const FString Result = Super::InitNewPlayer(NewPlayerController, UniqueId, Options, Portal);
	if (ABRPlayerState* PS = NewPlayerController->GetPlayerState<ABRPlayerState>())
	{
		PS->SetPartyId(UGameplayStatics::ParseOption(Options, TEXT("Party")));
	}
	return Result;
}

int32 ABRGameMode::AssignTeam(ABRPlayerState* PS)
{
	ABRGameState* GS = GetBRGameState();
	if (!GS || !PS) { return INDEX_NONE; }
	TMap<int32, int32> TeamCounts;
	TMap<FString, int32> PartyTeams;
	for (APlayerState* Other : GS->PlayerArray)
	{
		const ABRPlayerState* O = Cast<ABRPlayerState>(Other);
		if (!O || O == PS || O->GetTeamId() == INDEX_NONE) { continue; }
		TeamCounts.FindOrAdd(O->GetTeamId())++;
		if (!O->GetPartyId().IsEmpty()) { PartyTeams.Add(O->GetPartyId(), O->GetTeamId()); }
	}
	// Party members share a team when there is room.
	if (const int32* PartyTeam = PartyTeams.Find(PS->GetPartyId()))
	{
		if (TeamCounts.FindRef(*PartyTeam) < Rules.TeamSize) { return *PartyTeam; }
	}
	// Otherwise fill the first team with space, then open a new one.
	for (int32 T = 0; T < BRRules::MaxTeams(Rules.MaxPlayers, Rules.TeamSize); ++T)
	{
		const int32 Count = TeamCounts.FindRef(T);
		const bool bPartyOwned = PartyTeams.FindKey(T) != nullptr && !PS->GetPartyId().IsEmpty();
		if (Count < Rules.TeamSize && !bPartyOwned) { return T; }
	}
	return TeamCounts.Num();
}

void ABRGameMode::PostLogin(APlayerController* NewPlayer)
{
	Super::PostLogin(NewPlayer);
	ABRPlayerState* PS = NewPlayer->GetPlayerState<ABRPlayerState>();
	if (!PS) { return; }

	// Reconnection: hand the surviving character back to the returning player.
	const FString Key = PS->GetUniqueId().IsValid() ? PS->GetUniqueId()->ToString() : FString();
	if (FDisconnected* D = Disconnected.Find(Key); D && D->Pawn.IsValid() && D->Pawn->IsAliveAndWell())
	{
		PS->SetTeamId(D->Team);
		for (int32 I = 0; I < D->Kills; ++I) { PS->AddKill(); }
		NewPlayer->Possess(D->Pawn.Get());
		Disconnected.Remove(Key);
		if (UBRMatchLogger* Log = GetWorld()->GetSubsystem<UBRMatchLogger>()) { Log->LogEvent(TEXT("player_reconnected"), { { TEXT("player"), PS->GetPlayerName() } }); }
		return;
	}

	PS->SetTeamId(AssignTeam(PS));
	PS->ResetForMatch(GetWorld()->GetTimeSeconds());
	if (UBRMatchLogger* Log = GetWorld()->GetSubsystem<UBRMatchLogger>())
	{
		Log->LogEvent(TEXT("player_join"), { { TEXT("player"), PS->GetPlayerName() }, { TEXT("team"), FString::FromInt(PS->GetTeamId()) } });
	}
	UpdateAliveCounts();
}

void ABRGameMode::HandleStartingNewPlayer_Implementation(APlayerController* NewPlayer)
{
	// No RestartPlayer/PlayerStart: spawning depends on the match phase.
	if (NewPlayer->GetPawn()) { return; }
	const ABRGameState* GS = GetBRGameState();
	if (!GS || !bWorldReady) { return; }
	switch (GS->GetMatchPhase())
	{
	case EBRMatchPhase::WaitingForPlayers:
		SpawnCharacterFor(NewPlayer, GetWarmupSpawnPoint(), false);
		break;
	case EBRMatchPhase::BusFlight:
		if (ABRPlayerState* PS = NewPlayer->GetPlayerState<ABRPlayerState>()) { PS->SetOnBus(true); }
		break;
	default:
		if (Rules.bRespawn) { SpawnCharacterFor(NewPlayer, GetWarmupSpawnPoint(), false); }
		else if (ABRPlayerController* PC = Cast<ABRPlayerController>(NewPlayer)) { StartSpectating(PC, nullptr); } // late joiners spectate
		break;
	}
}

void ABRGameMode::Logout(AController* Exiting)
{
	ABRPlayerState* PS = Exiting ? Exiting->GetPlayerState<ABRPlayerState>() : nullptr;
	ABRCharacter* Char = Exiting ? Cast<ABRCharacter>(Exiting->GetPawn()) : nullptr;
	const ABRGameState* GS = GetBRGameState();
	if (PS && Char && GS && GS->GetMatchPhase() == EBRMatchPhase::Playing && Char->IsAliveAndWell() && PS->GetUniqueId().IsValid())
	{
		// Keep the character in the world for the reconnect window (it can still be eliminated).
		FDisconnected D;
		D.Pawn = Char; D.Team = PS->GetTeamId(); D.Kills = PS->GetKills(); D.Time = GetWorld()->GetTimeSeconds();
		Disconnected.Add(PS->GetUniqueId()->ToString(), D);
		Exiting->UnPossess();
	}
	if (UBRMatchLogger* Log = GetWorld()->GetSubsystem<UBRMatchLogger>())
	{
		Log->LogEvent(TEXT("player_leave"), { { TEXT("player"), PS ? PS->GetPlayerName() : TEXT("?") } });
	}
	Super::Logout(Exiting);
	UpdateAliveCounts();
}

ABRCharacter* ABRGameMode::SpawnCharacterFor(AController* Controller, const FVector& Location, bool bSkydive)
{
	if (!Controller) { return nullptr; }
	if (APawn* Old = Controller->GetPawn())
	{
		Controller->UnPossess();
		Old->Destroy();
	}
	FActorSpawnParameters SP;
	SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
	ABRCharacter* C = GetWorld()->SpawnActor<ABRCharacter>(ABRCharacter::StaticClass(), Location, FRotator::ZeroRotator, SP);
	if (!C) { return nullptr; }
	Controller->Possess(C);
	Controller->ClientSetRotation(FRotator(-10.f, FMath::FRandRange(0.f, 360.f), 0.f));
	const ABRGameState* GS = GetBRGameState();
	const bool bWarmup = GS && GS->GetMatchPhase() == EBRMatchPhase::WaitingForPlayers;
	C->GetHealth()->bInvulnerable = bWarmup || Rules.bInvulnerable;
	C->GetInventory()->SetInfinite(Rules.bInfiniteResources || bWarmup);
	GiveStartingLoadout(C);
	if (bSkydive) { C->BeginSkydive(); }
	return C;
}

void ABRGameMode::GiveStartingLoadout(ABRCharacter* Character)
{
	UBRInventoryComponent* Inv = Character->GetInventory();
	const UBRItemRegistry* Reg = UBRItemRegistry::Get();
	if (Rules.StartingMaterials > 0)
	{
		for (EBRBuildMaterial M : { EBRBuildMaterial::Wood, EBRBuildMaterial::Stone, EBRBuildMaterial::Metal }) { Inv->AddMaterial(M, Rules.StartingMaterials); }
	}
	const ABRGameState* GS = GetBRGameState();
	const bool bWarmup = GS && GS->GetMatchPhase() == EBRMatchPhase::WaitingForPlayers;
	if (Rules.bShootingRange || Rules.bCreativeTools || bWarmup)
	{
		// Practice loadout so the range/warm-up is immediately playable.
		FBRItemStack Left;
		Inv->AddStack(FBRItemStack(TEXT("W_TalonAR_Epic"), 1), Left);
		Inv->AddStack(FBRItemStack(TEXT("W_BreakerPump_Rare"), 1), Left);
		Inv->AddStack(FBRItemStack(TEXT("W_HornetSMG_Rare"), 1), Left);
		Inv->AddStack(FBRItemStack(Rules.bWorldLoot ? FName(TEXT("C_Bandage")) : FName(TEXT("W_LongshotSR_Epic")), Rules.bWorldLoot ? 5 : 1), Left);
		Inv->AddStack(FBRItemStack(TEXT("G_Frag"), 6), Left);
		for (EBRAmmoType A : { EBRAmmoType::Light, EBRAmmoType::Medium, EBRAmmoType::Heavy, EBRAmmoType::Shells })
		{
			Inv->AddStack(FBRItemStack(Reg->AmmoItemId(A), 200), Left);
		}
	}
}

// --------------------------------------------------------------------------------- match flow
void ABRGameMode::ServerTick()
{
	ABRGameState* GS = GetBRGameState();
	if (!GS || !bWorldReady) { return; }
	GS->PrunePings();
	const double Now = GetWorld()->GetTimeSeconds();

	// Reconnect window expiry.
	for (auto It = Disconnected.CreateIterator(); It; ++It)
	{
		if (Now - It->Value.Time > UBRSettings::Get()->ReconnectWindowSeconds || !It->Value.Pawn.IsValid())
		{
			if (ABRCharacter* C = It->Value.Pawn.Get()) { C->GetHealth()->Kill(nullptr, nullptr); }
			It.RemoveCurrent();
		}
	}

	switch (GS->GetMatchPhase())
	{
	case EBRMatchPhase::WaitingForPlayers:
	{
		if (!Rules.bBus)
		{
			// Respawn modes start immediately.
			GS->SetMatchPhase(EBRMatchPhase::Playing, 0.f);
			StartPlayingPhase();
			break;
		}
		const int32 Humans = GetNumPlayers();
		const int32 Total = Humans + Rules.BotCount;
		// Offline/local sessions don't wait for a lobby to fill.
		const float WaitSeconds = GetNetMode() == NM_Standalone ? 10.f : UBRSettings::Get()->LobbyWaitSeconds;
		const bool bReady = BRRules::ShouldStartMatch(Total, Rules.MinPlayersToStart, Rules.MaxPlayers, Now - WaitStartTime, WaitSeconds);
		if (bReady && !bCountdownStarted)
		{
			bCountdownStarted = true;
			GS->SetMatchPhase(EBRMatchPhase::WaitingForPlayers, 10.f);
			GS->MulticastAnnouncement(LOCTEXT("Countdown", "A partida começa em 10 segundos!"));
		}
		if (bCountdownStarted && GS->GetPhaseSecondsRemaining() <= 0.f) { StartBusPhase(); }
		break;
	}
	case EBRMatchPhase::BusFlight:
	{
		if (!Bus) { break; }
		const float Progress = Bus->GetProgress();
		for (FConstControllerIterator It = GetWorld()->GetControllerIterator(); It; ++It)
		{
			AController* C = It->Get();
			ABRPlayerState* PS = C ? C->GetPlayerState<ABRPlayerState>() : nullptr;
			if (!PS || !PS->IsOnBus()) { continue; }
			const float* BotDrop = BotDropProgress.Find(C);
			if ((BotDrop && Progress >= *BotDrop) || Progress >= 0.98f) { HandleJumpFromBus(C); }
		}
		if (Bus->IsFinished())
		{
			GS->SetMatchPhase(EBRMatchPhase::Playing, 0.f);
			StartPlayingPhase();
		}
		break;
	}
	case EBRMatchPhase::Playing:
		UpdateAliveCounts();
		if (Rules.bBus && GS->GetTeamsAlive() <= 1 && TeamsAtStart > 1)
		{
			int32 Winner = INDEX_NONE;
			for (APlayerState* P : GS->PlayerArray)
			{
				const ABRPlayerState* BP = Cast<ABRPlayerState>(P);
				if (BP && !BP->IsEliminatedFromMatch()) { Winner = BP->GetTeamId(); break; }
			}
			EndMatch(Winner);
		}
		break;
	default:
		break;
	}
}

void ABRGameMode::StartBusPhase()
{
	ABRGameState* GS = GetBRGameState();
	const UBRSettings* S = UBRSettings::Get();
	// Clear warm-up: pawns, dropped items and warm-up builds.
	for (FConstControllerIterator It = GetWorld()->GetControllerIterator(); It; ++It)
	{
		if (AController* C = It->Get())
		{
			if (APawn* P = C->GetPawn()) { C->UnPossess(); P->Destroy(); }
			if (ABRPlayerState* PS = C->GetPlayerState<ABRPlayerState>()) { PS->SetOnBus(true); PS->ResetForMatch(GetWorld()->GetTimeSeconds()); }
		}
	}
	for (TActorIterator<ABRBuildingPiece> It(GetWorld()); It; ++It) { It->Destroy(); }
	SpawnBots(Rules.BotCount);

	BRRules::Rng R(MatchSeed ^ 0xB05u);
	BRRules::Vec3 Start, End;
	BRRules::ChooseBusPath(S->MapHalfSizeCm, S->BusAltitudeCm, R, Start, End);
	FActorSpawnParameters SP;
	SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	Bus = GetWorld()->SpawnActorDeferred<ABRBattleBus>(ABRBattleBus::StaticClass(), FTransform(BRTypes::ToFVector(Start)), nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
	Bus->InitFlight(BRTypes::ToFVector(Start), BRTypes::ToFVector(End), GS->GetServerWorldTimeSeconds(), S->BusFlightSeconds);
	Bus->FinishSpawning(FTransform(BRTypes::ToFVector(Start)));
	GS->SetBus(Bus);
	GS->SetMatchPhase(EBRMatchPhase::BusFlight, S->BusFlightSeconds);
	GS->MulticastAnnouncement(LOCTEXT("Bus", "Pressione PULAR para saltar do ônibus!"));

	// Count teams for placement and victory.
	TSet<int32> Teams;
	for (APlayerState* P : GS->PlayerArray) { if (const ABRPlayerState* BP = Cast<ABRPlayerState>(P)) { Teams.Add(BP->GetTeamId()); } }
	TeamsAtStart = Teams.Num();
	UpdateAliveCounts();
	if (UBRMatchLogger* Log = GetWorld()->GetSubsystem<UBRMatchLogger>())
	{
		Log->LogEvent(TEXT("bus_departed"), { { TEXT("players"), FString::FromInt(GS->PlayerArray.Num()) }, { TEXT("teams"), FString::FromInt(TeamsAtStart) } });
	}
}

void ABRGameMode::HandleJumpFromBus(AController* Controller)
{
	ABRPlayerState* PS = Controller ? Controller->GetPlayerState<ABRPlayerState>() : nullptr;
	if (!PS || !PS->IsOnBus() || !Bus || (!Bus->CanDrop() && !Bus->IsFinished())) { return; }
	PS->SetOnBus(false);
	BotDropProgress.Remove(Controller);
	const FVector Drop = Bus->GetActorLocation() - FVector(0, 0, 500.f) + FMath::VRand() * FVector(150.f, 150.f, 0.f);
	if (ABRCharacter* C = SpawnCharacterFor(Controller, Drop, true))
	{
		C->GetInventory()->SetInfinite(Rules.bInfiniteResources);
		C->GetHealth()->bInvulnerable = Rules.bInvulnerable;
	}
	if (APlayerController* PC = Cast<APlayerController>(Controller)) { PC->SetViewTargetWithBlend(PC->GetPawn(), 0.3f); }
}

void ABRGameMode::StartPlayingPhase()
{
	if (Rules.bStorm && Storm)
	{
		const float Half = UBRSettings::Get()->MapHalfSizeCm;
		Storm->StartStorm(FVector2D::ZeroVector, Half * 1.15f, MatchSeed);
	}
	if (!Rules.bBus)
	{
		for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
		{
			if (APlayerController* PC = It->Get()) { if (!PC->GetPawn()) { SpawnCharacterFor(PC, GetWarmupSpawnPoint(), false); } }
		}
	}
	if (UBRMatchLogger* Log = GetWorld()->GetSubsystem<UBRMatchLogger>()) { Log->LogEvent(TEXT("storm_started"), {}); }
}

void ABRGameMode::SpawnBots(int32 Count)
{
	ABRGameState* GS = GetBRGameState();
	for (int32 I = 0; I < Count && GS && GS->PlayerArray.Num() < Rules.MaxPlayers; ++I)
	{
		FActorSpawnParameters SP;
		SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		ABRAIController* AI = GetWorld()->SpawnActor<ABRAIController>(ABRAIController::StaticClass(), FTransform::Identity, SP);
		if (!AI) { continue; }
		ABRPlayerState* PS = AI->GetPlayerState<ABRPlayerState>();
		if (!PS) { continue; }
		PS->SetIsABot(true);
		PS->SetPlayerName(FString::Printf(TEXT("Bot %02d [BOT]"), NextBotIndex++));
		PS->SetTeamId(AssignTeam(PS));
		PS->ResetForMatch(GetWorld()->GetTimeSeconds());
		BRRules::Rng R(BRRules::HashCombine(MatchSeed, uint32(NextBotIndex)));
		if (Rules.bBus)
		{
			PS->SetOnBus(true);
			BotDropProgress.Add(AI, float(R.Range(0.12, 0.9)));
		}
		else
		{
			SpawnCharacterFor(AI, GetWarmupSpawnPoint(), false);
		}
	}
}

// --------------------------------------------------------------------------------- eliminations
bool ABRGameMode::ShouldDownInsteadOfEliminate(ABRCharacter* Character) const
{
	if (!Rules.bDownButNotOut || !Character) { return false; }
	const int32 Team = Character->GetTeamId();
	// Downed only while at least one teammate is still standing.
	for (TActorIterator<ABRCharacter> It(GetWorld()); It; ++It)
	{
		if (*It != Character && It->GetTeamId() == Team && It->IsAliveAndWell()) { return true; }
	}
	return false;
}

void ABRGameMode::OnCharacterDowned(ABRCharacter* Victim, AController* Instigator, AActor* Causer)
{
	ABRGameState* GS = GetBRGameState();
	FBRKillFeedEntry E;
	E.Victim = Victim->GetPlayerState() ? Victim->GetPlayerState()->GetPlayerName() : TEXT("?");
	E.Killer = Instigator && Instigator->PlayerState ? Instigator->PlayerState->GetPlayerName() : TEXT("");
	E.bDowned = true;
	if (GS) { GS->MulticastKillFeed(E); }
	EliminateTeamIfOut(Victim->GetTeamId());
}

void ABRGameMode::OnCharacterRevived(ABRCharacter* Revived, ABRCharacter* By)
{
	if (ABRPlayerController* PC = By ? Cast<ABRPlayerController>(By->GetController()) : nullptr)
	{
		PC->ClientStatEvent(TEXT("Revives"), 1);
	}
}

bool ABRGameMode::IsTeamOut(int32 TeamId) const
{
	for (TActorIterator<ABRCharacter> It(GetWorld()); It; ++It)
	{
		if (It->GetTeamId() == TeamId && It->IsAliveAndWell()) { return false; }
	}
	const ABRGameState* GS = GetBRGameState();
	for (APlayerState* P : GS->PlayerArray)
	{
		const ABRPlayerState* BP = Cast<ABRPlayerState>(P);
		if (BP && BP->GetTeamId() == TeamId && BP->IsOnBus()) { return false; }
	}
	return true;
}

void ABRGameMode::EliminateTeamIfOut(int32 TeamId)
{
	if (!IsTeamOut(TeamId)) { return; }
	// Whole team down/out: downed members bleed out immediately.
	for (TActorIterator<ABRCharacter> It(GetWorld()); It; ++It)
	{
		if (It->GetTeamId() == TeamId && It->IsDowned()) { It->GetHealth()->Kill(It->GetHealth()->LastDamager.Get(), nullptr); }
	}
}

void ABRGameMode::OnCharacterEliminated(ABRCharacter* Victim, AController* Killer, AActor* Causer, bool bHeadshot)
{
	ABRGameState* GS = GetBRGameState();
	ABRPlayerState* VictimPS = Victim->GetBRPlayerState();
	ABRPlayerState* KillerPS = Killer ? Killer->GetPlayerState<ABRPlayerState>() : nullptr;
	if (KillerPS && KillerPS != VictimPS && KillerPS->GetTeamId() != (VictimPS ? VictimPS->GetTeamId() : -2))
	{
		KillerPS->AddKill();
		if (ABRPlayerController* KPC = Cast<ABRPlayerController>(Killer)) { KPC->ClientStatEvent(TEXT("Eliminations"), 1); }
	}

	FBRKillFeedEntry E;
	E.Victim = VictimPS ? VictimPS->GetPlayerName() : TEXT("?");
	E.Killer = KillerPS ? KillerPS->GetPlayerName() : TEXT("");
	E.bHeadshot = bHeadshot;
	if (const ABRWeapon* W = Cast<ABRWeapon>(Causer)) { if (W->GetDefinition()) { E.Weapon = W->GetDefinition()->DisplayName.ToString(); } }
	else if (Cast<ABRStormController>(Causer)) { E.Weapon = TEXT("Tempestade"); }
	if (GS) { GS->MulticastKillFeed(E); }

	if (UBRMatchLogger* Log = GetWorld()->GetSubsystem<UBRMatchLogger>())
	{
		Log->LogEvent(TEXT("elimination"), { { TEXT("victim"), E.Victim }, { TEXT("killer"), E.Killer }, { TEXT("weapon"), E.Weapon }, { TEXT("headshot"), bHeadshot ? TEXT("1") : TEXT("0") } });
	}

	AController* VictimController = Victim->GetController();
	if (Rules.bRespawn || (GS && GS->GetMatchPhase() == EBRMatchPhase::WaitingForPlayers))
	{
		ScheduleRespawn(VictimController);
		return;
	}

	// Placement: when the victim's team is out, it finishes at (teams alive before) place.
	if (VictimPS && !VictimPS->IsEliminatedFromMatch())
	{
		UpdateAliveCounts();
		const int32 TeamsBefore = GS ? GS->GetTeamsAlive() : 1;
		const bool bTeamOut = IsTeamOut(VictimPS->GetTeamId());
		VictimPS->SetEliminated(bTeamOut ? BRRules::PlacementForEliminatedTeam(TeamsBefore) : 0);
		if (bTeamOut && GS)
		{
			for (APlayerState* P : GS->PlayerArray)
			{
				ABRPlayerState* BP = Cast<ABRPlayerState>(P);
				if (BP && BP->GetTeamId() == VictimPS->GetTeamId())
				{
					BP->SetEliminated(BRRules::PlacementForEliminatedTeam(TeamsBefore));
					SendMatchResult(BP);
				}
			}
		}
	}
	EliminateTeamIfOut(Victim->GetTeamId());
	if (VictimController)
	{
		// The body stays in the world (loot already dropped); the player becomes a spectator.
		VictimController->UnPossess();
		if (ABRPlayerController* PC = Cast<ABRPlayerController>(VictimController)) { StartSpectating(PC, Killer); }
	}
	UpdateAliveCounts();
}

void ABRGameMode::ScheduleRespawn(AController* Controller)
{
	if (!Controller) { return; }
	TWeakObjectPtr<AController> Weak = Controller;
	FTimerHandle H;
	GetWorldTimerManager().SetTimer(H, FTimerDelegate::CreateWeakLambda(this, [this, Weak]()
	{
		if (AController* C = Weak.Get()) { SpawnCharacterFor(C, GetWarmupSpawnPoint(), false); }
	}), FMath::Max(1.f, Rules.RespawnDelay), false);
}

void ABRGameMode::UpdateAliveCounts()
{
	ABRGameState* GS = GetBRGameState();
	if (!GS) { return; }
	int32 Players = 0;
	TSet<int32> Teams;
	for (APlayerState* P : GS->PlayerArray)
	{
		const ABRPlayerState* BP = Cast<ABRPlayerState>(P);
		if (!BP || BP->IsEliminatedFromMatch() || BP->IsOnlyASpectator()) { continue; }
		++Players;
		Teams.Add(BP->GetTeamId());
	}
	GS->SetAliveCounts(Players, Teams.Num());
}

void ABRGameMode::StartSpectating(ABRPlayerController* PC, AController* Preferred)
{
	if (!PC) { return; }
	const ABRPlayerState* MyPS = PC->GetPlayerState<ABRPlayerState>();
	APawn* Target = nullptr;
	// Teammates first, then the killer, then anyone alive.
	for (TActorIterator<ABRCharacter> It(GetWorld()); It; ++It)
	{
		if (It->IsAliveAndWell() && MyPS && It->GetTeamId() == MyPS->GetTeamId()) { Target = *It; break; }
	}
	if (!Target && Preferred && Preferred->GetPawn()) { Target = Preferred->GetPawn(); }
	if (!Target) { for (TActorIterator<ABRCharacter> It(GetWorld()); It; ++It) { if (It->IsAliveAndWell()) { Target = *It; break; } } }
	if (Target)
	{
		PC->SetViewTargetWithBlend(Target, 0.5f);
		PC->ClientSpectating(Target->GetPlayerState());
	}
}

void ABRGameMode::SpectateNext(ABRPlayerController* PC)
{
	if (!PC || PC->GetPawn()) { return; }
	TArray<ABRCharacter*> Alive;
	for (TActorIterator<ABRCharacter> It(GetWorld()); It; ++It) { if (It->IsAliveAndWell()) { Alive.Add(*It); } }
	if (Alive.Num() == 0) { return; }
	const int32 Current = Alive.IndexOfByKey(Cast<ABRCharacter>(PC->GetViewTarget()));
	ABRCharacter* Next = Alive[(Current + 1) % Alive.Num()];
	PC->SetViewTargetWithBlend(Next, 0.3f);
	PC->ClientSpectating(Next->GetPlayerState());
}

// --------------------------------------------------------------------------------- end of match
void ABRGameMode::SendMatchResult(ABRPlayerState* PS)
{
	ABRGameState* GS = GetBRGameState();
	if (!PS || !GS) { return; }
	FBRMatchResult R;
	R.Placement = FMath::Max(1, PS->GetPlacement());
	R.TotalTeams = FMath::Max(1, TeamsAtStart);
	R.Eliminations = PS->GetKills();
	R.Revives = PS->GetRevives();
	R.ChestsOpened = PS->GetChestsOpened();
	R.DamageDealt = PS->GetDamageDealt();
	R.SecondsSurvived = PS->GetSurvivalSeconds(GetWorld()->GetTimeSeconds());
	R.Mode = Rules.Mode;
	R.bCountsForProgression = Rules.bCountsForProgression;
	BRRules::MatchXpInput In;
	In.Placement = R.Placement; In.TotalTeams = R.TotalTeams; In.Eliminations = R.Eliminations;
	In.Revives = R.Revives; In.ChestsOpened = R.ChestsOpened; In.SecondsSurvived = R.SecondsSurvived;
	R.XpEarned = Rules.bCountsForProgression ? BRRules::ComputeMatchXp(In) : BRRules::ComputeMatchXp(In) / 4;
	R.CoinsEarned = Rules.bCountsForProgression ? BRRules::ComputeMatchCoins(In) : 0;
	if (ABRPlayerController* PC = Cast<ABRPlayerController>(PS->GetOwner())) { PC->ClientMatchResult(R); }
	// Authoritative persistence: the dedicated server (holder of BR_SERVER_SECRET) reports to the backend.
	UBRBackendClient* Backend = GetGameInstance()->GetSubsystem<UBRBackendClient>();
	if (Backend && Backend->CanActAsServer() && !PS->IsABot() && PS->GetUniqueId().IsValid())
	{
		FBRBackendMatchEntry Entry;
		Entry.PlayerId = PS->GetUniqueId()->ToString();
		Entry.Result = R;
		Backend->PostMatchResults(MatchId, Rules.Mode, Rules.bCountsForProgression, { Entry });
	}
	if (UBRMatchLogger* Log = GetWorld()->GetSubsystem<UBRMatchLogger>())
	{
		Log->LogEvent(TEXT("result"), { { TEXT("player"), PS->GetPlayerName() }, { TEXT("placement"), FString::FromInt(R.Placement) },
			{ TEXT("kills"), FString::FromInt(R.Eliminations) }, { TEXT("xp"), FString::FromInt(R.XpEarned) } });
	}
}

void ABRGameMode::EndMatch(int32 WinningTeam)
{
	ABRGameState* GS = GetBRGameState();
	if (!GS || GS->GetMatchPhase() == EBRMatchPhase::EndGame) { return; }
	GS->SetWinningTeam(WinningTeam);
	GS->SetMatchPhase(EBRMatchPhase::EndGame, 15.f);
	if (Storm) { Storm->StopStorm(); }
	for (APlayerState* P : GS->PlayerArray)
	{
		ABRPlayerState* BP = Cast<ABRPlayerState>(P);
		if (BP && BP->GetTeamId() == WinningTeam) { BP->SetPlacement(1); SendMatchResult(BP); }
	}
	GS->MulticastAnnouncement(LOCTEXT("Victory", "Vitória Real! Fim de partida."));
	if (UBRMatchLogger* Log = GetWorld()->GetSubsystem<UBRMatchLogger>())
	{
		Log->LogEvent(TEXT("match_end"), { { TEXT("winner_team"), FString::FromInt(WinningTeam) } });
		Log->Flush();
	}
	GetWorldTimerManager().SetTimer(PostMatchTimer, this, &ABRGameMode::FinishPostMatch, 15.f, false);
}

void ABRGameMode::FinishPostMatch()
{
	if (ABRGameState* GS = GetBRGameState()) { GS->SetMatchPhase(EBRMatchPhase::PostMatch, 0.f); }
	for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
	{
		if (ABRPlayerController* PC = Cast<ABRPlayerController>(It->Get())) { PC->ClientReturnToMenu(LOCTEXT("MatchOver", "Partida encerrada.")); }
	}
	if (GetNetMode() == NM_DedicatedServer)
	{
		// Recycle: the orchestrator restarts the process for the next match (clean memory on servers).
		FTimerHandle H;
		GetWorldTimerManager().SetTimer(H, FTimerDelegate::CreateLambda([]() { FPlatformMisc::RequestExit(false); }), 5.f, false);
	}
}

// --------------------------------------------------------------------------------- chat
void ABRGameMode::BroadcastChat(ABRPlayerController* From, const FString& Message, bool bTeam)
{
	const ABRPlayerState* FromPS = From ? From->GetPlayerState<ABRPlayerState>() : nullptr;
	if (!FromPS) { return; }
	for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
	{
		ABRPlayerController* PC = Cast<ABRPlayerController>(It->Get());
		const ABRPlayerState* PS = PC ? PC->GetPlayerState<ABRPlayerState>() : nullptr;
		if (!PC || !PS) { continue; }
		if (bTeam && PS->GetTeamId() != FromPS->GetTeamId()) { continue; }
		PC->ClientReceiveChat(FromPS->GetPlayerName(), Message, bTeam);
	}
	if (UBRMatchLogger* Log = GetWorld()->GetSubsystem<UBRMatchLogger>())
	{
		Log->LogEvent(TEXT("chat"), { { TEXT("player"), FromPS->GetPlayerName() }, { TEXT("team"), bTeam ? TEXT("1") : TEXT("0") }, { TEXT("text"), Message } });
	}
}

// --------------------------------------------------------------------------------- shooting range & creative
void ABRGameMode::SpawnShootingRange()
{
	const UBRWorldSubsystem* WS = GetWorld()->GetSubsystem<UBRWorldSubsystem>();
	if (!WS || !WS->HasWorld()) { return; }
	const FVector Base = WS->GetNamedLocations()[6].Location;
	for (int32 Row = 0; Row < 4; ++Row)
	{
		for (int32 I = -3; I <= 3; ++I)
		{
			const FVector L = Base + FVector(1500.f + Row * 1500.f, I * 400.f, 0.f);
			const float Z = WS->GetTerrainHeight(L.X, L.Y);
			ABRTargetDummy* D = GetWorld()->SpawnActor<ABRTargetDummy>(ABRTargetDummy::StaticClass(), FVector(L.X, L.Y, Z), FRotator(0, 180, 0));
			if (D && Row == 3) { D->StrafeAmplitude = 300.f; }
		}
	}
	// Weapon rack: one of every weapon definition at its highest rarity.
	UBRLootSubsystem* Loot = GetWorld()->GetSubsystem<UBRLootSubsystem>();
	int32 N = 0;
	for (const UBRItemDefinition* Def : UBRItemRegistry::Get()->GetAll())
	{
		if (const UBRWeaponDefinition* W = Cast<UBRWeaponDefinition>(Def))
		{
			if (W->Rarity == EBRRarity::Epic || W->bThrowable)
			{
				Loot->SpawnPickup(FBRItemStack(W->ItemId, W->bThrowable ? 6 : 1), Base + FVector(-600.f, -1200.f + N * 250.f, 100.f));
				++N;
			}
		}
	}
}

void ABRGameMode::HandleCreativeCommand(ABRPlayerController* PC, const FString& Command, const FString& Arg)
{
	if (!Rules.bCreativeTools || !PC) { return; }
	ABRCharacter* C = Cast<ABRCharacter>(PC->GetPawn());
	const FString SafeName = FPaths::MakeValidFileName(Arg.IsEmpty() ? TEXT("ilha") : Arg).Left(32);
	if (Command == TEXT("save")) { SaveCreativeIsland(SafeName); PC->ClientReceiveChat(TEXT("Criativo"), FString::Printf(TEXT("Ilha '%s' salva."), *SafeName), false); return; }
	if (Command == TEXT("load")) { LoadCreativeIsland(SafeName); PC->ClientReceiveChat(TEXT("Criativo"), FString::Printf(TEXT("Ilha '%s' carregada."), *SafeName), false); return; }
	if (Command == TEXT("clear")) { for (TActorIterator<ABRBuildingPiece> It(GetWorld()); It; ++It) { It->Destroy(); } return; }
	if (!C) { return; }
	const FVector Front = C->GetActorLocation() + C->GetActorForwardVector() * 500.f;
	if (Command == TEXT("vehicle"))
	{
		const int32 Type = FMath::Clamp(FCString::Atoi(*Arg), 0, 4);
		if (ABRVehicle* V = GetWorld()->SpawnActorDeferred<ABRVehicle>(ABRVehicle::StaticClass(), FTransform(Front + FVector(0, 0, 150.f)), nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn))
		{
			V->InitVehicle(EBRVehicleSpawnType(Type));
			V->FinishSpawning(FTransform(Front + FVector(0, 0, 150.f)));
		}
	}
	else if (Command == TEXT("chest")) { GetWorld()->GetSubsystem<UBRLootSubsystem>()->SpawnContainer(EBRContainerKind::Chest, FTransform(Front)); }
	else if (Command == TEXT("dummy")) { GetWorld()->SpawnActor<ABRTargetDummy>(ABRTargetDummy::StaticClass(), Front, FRotator(0, C->GetActorRotation().Yaw + 180.f, 0)); }
	else if (Command == TEXT("time")) { if (Sky) { Sky->SetTimeOfDay(FCString::Atof(*Arg)); } }
}

void ABRGameMode::SaveCreativeIsland(const FString& Name) const
{
	TArray<TSharedPtr<FJsonValue>> Pieces;
	for (TActorIterator<ABRBuildingPiece> It(GetWorld()); It; ++It)
	{
		TSharedRef<FJsonObject> P = MakeShared<FJsonObject>();
		const FBRGridKey& K = It->GetKey();
		P->SetNumberField(TEXT("x"), K.X); P->SetNumberField(TEXT("y"), K.Y); P->SetNumberField(TEXT("z"), K.Z);
		P->SetNumberField(TEXT("t"), int32(K.Type)); P->SetNumberField(TEXT("d"), K.Dir);
		P->SetNumberField(TEXT("m"), int32(It->GetMaterial())); P->SetNumberField(TEXT("e"), It->GetEditMask());
		Pieces.Add(MakeShared<FJsonValueObject>(P));
	}
	TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
	Root->SetNumberField(TEXT("version"), 1);
	Root->SetNumberField(TEXT("seed"), double(MatchSeed));
	Root->SetArrayField(TEXT("pieces"), Pieces);
	FString Out;
	TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Out);
	FJsonSerializer::Serialize(Root, W);
	FFileHelper::SaveStringToFile(Out, *(FPaths::ProjectSavedDir() / TEXT("CreativeIslands") / (Name + TEXT(".json"))));
}

void ABRGameMode::LoadCreativeIsland(const FString& Name)
{
	FString In;
	if (!FFileHelper::LoadFileToString(In, *(FPaths::ProjectSavedDir() / TEXT("CreativeIslands") / (Name + TEXT(".json"))))) { return; }
	TSharedPtr<FJsonObject> Root;
	TSharedRef<TJsonReader<>> R = TJsonReaderFactory<>::Create(In);
	if (!FJsonSerializer::Deserialize(R, Root) || !Root.IsValid()) { return; }
	for (TActorIterator<ABRBuildingPiece> It(GetWorld()); It; ++It) { It->Destroy(); }
	const TArray<TSharedPtr<FJsonValue>>* Pieces = nullptr;
	if (!Root->TryGetArrayField(TEXT("pieces"), Pieces)) { return; }
	int32 Count = 0;
	for (const TSharedPtr<FJsonValue>& V : *Pieces)
	{
		const TSharedPtr<FJsonObject> P = V->AsObject();
		if (!P.IsValid() || ++Count > 5000) { continue; }
		FBRGridKey K;
		K.X = P->GetIntegerField(TEXT("x")); K.Y = P->GetIntegerField(TEXT("y")); K.Z = P->GetIntegerField(TEXT("z"));
		K.Type = EBRBuildPieceType(FMath::Clamp(P->GetIntegerField(TEXT("t")), 0, 3)); K.Dir = uint8(P->GetIntegerField(TEXT("d")) & 3);
		const EBRBuildMaterial M = EBRBuildMaterial(FMath::Clamp(P->GetIntegerField(TEXT("m")), 0, 2));
		UBRBuildComponent::SpawnPieceServer(GetWorld(), K, M, INDEX_NONE, true, uint16(P->GetIntegerField(TEXT("e"))));
	}
}

#undef LOCTEXT_NAMESPACE
