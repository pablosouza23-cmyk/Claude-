#include "GameModes/BRModeRules.h"

FBRModeRules FBRModeRules::ForMode(EBRGameModeType Mode)
{
	FBRModeRules R;
	R.Mode = Mode;
	switch (Mode)
	{
	case EBRGameModeType::Duos:
		R.TeamSize = 2; R.bDownButNotOut = true; break;
	case EBRGameModeType::Squads:
		R.TeamSize = 4; R.bDownButNotOut = true; break;
	case EBRGameModeType::BuildBattle:
		// Building-focused: more materials from the start, smaller lobby.
		R.MaxPlayers = 50; R.StartingMaterials = 500; break;
	case EBRGameModeType::ZeroBuild:
		R.bBuildingEnabled = false; break;
	case EBRGameModeType::Training:
		// Offline practice against bots. Never presented as an online match.
		R.MaxPlayers = 30; R.MinPlayersToStart = 1; R.BotCount = 24; R.bCountsForProgression = false; break;
	case EBRGameModeType::ShootingRange:
		R.MaxPlayers = 16; R.MinPlayersToStart = 1; R.bStorm = false; R.bBus = false; R.bRespawn = true; R.RespawnDelay = 2.f;
		R.bInfiniteResources = true; R.bWorldLoot = false; R.bSupplyDrops = false; R.bCountsForProgression = false; R.bShootingRange = true; break;
	case EBRGameModeType::Creative:
		R.MaxPlayers = 16; R.MinPlayersToStart = 1; R.bStorm = false; R.bBus = false; R.bRespawn = true; R.RespawnDelay = 2.f;
		R.bInfiniteResources = true; R.bWorldLoot = false; R.bSupplyDrops = false; R.bCountsForProgression = false; R.bCreativeTools = true; R.bInvulnerable = true; break;
	default:
		break;
	}
	return R;
}

EBRGameModeType FBRModeRules::ParseMode(const FString& Name)
{
	if (Name.Equals(TEXT("Duos"), ESearchCase::IgnoreCase)) { return EBRGameModeType::Duos; }
	if (Name.Equals(TEXT("Squads"), ESearchCase::IgnoreCase)) { return EBRGameModeType::Squads; }
	if (Name.Equals(TEXT("Build"), ESearchCase::IgnoreCase) || Name.Equals(TEXT("BuildBattle"), ESearchCase::IgnoreCase)) { return EBRGameModeType::BuildBattle; }
	if (Name.Equals(TEXT("ZeroBuild"), ESearchCase::IgnoreCase)) { return EBRGameModeType::ZeroBuild; }
	if (Name.Equals(TEXT("Training"), ESearchCase::IgnoreCase)) { return EBRGameModeType::Training; }
	if (Name.Equals(TEXT("Range"), ESearchCase::IgnoreCase) || Name.Equals(TEXT("ShootingRange"), ESearchCase::IgnoreCase)) { return EBRGameModeType::ShootingRange; }
	if (Name.Equals(TEXT("Creative"), ESearchCase::IgnoreCase)) { return EBRGameModeType::Creative; }
	return EBRGameModeType::Solo;
}

FString FBRModeRules::ModeToString(EBRGameModeType Mode)
{
	switch (Mode)
	{
	case EBRGameModeType::Duos: return TEXT("Duos");
	case EBRGameModeType::Squads: return TEXT("Squads");
	case EBRGameModeType::BuildBattle: return TEXT("Build");
	case EBRGameModeType::ZeroBuild: return TEXT("ZeroBuild");
	case EBRGameModeType::Training: return TEXT("Training");
	case EBRGameModeType::ShootingRange: return TEXT("Range");
	case EBRGameModeType::Creative: return TEXT("Creative");
	default: return TEXT("Solo");
	}
}
