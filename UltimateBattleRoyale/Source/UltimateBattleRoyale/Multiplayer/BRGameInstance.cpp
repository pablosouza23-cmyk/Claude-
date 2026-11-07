#include "Multiplayer/BRGameInstance.h"

#include "Engine/Engine.h"
#include "GameModes/BRModeRules.h"
#include "Items/BRItemRegistry.h"
#include "Kismet/GameplayStatics.h"
#include "Matchmaking/BRSessionSubsystem.h"
#include "UltimateBattleRoyale.h"

#define LOCTEXT_NAMESPACE "BRGameInstance"

void UBRGameInstance::Init()
{
	Super::Init();
	if (UBRItemRegistry* Reg = UBRItemRegistry::Get()) { Reg->LoadAuthoredItems(); }
	if (GEngine)
	{
		NetFailHandle = GEngine->OnNetworkFailure().AddUObject(this, &UBRGameInstance::HandleNetworkFailure);
		TravelFailHandle = GEngine->OnTravelFailure().AddUObject(this, &UBRGameInstance::HandleTravelFailure);
	}
}

void UBRGameInstance::Shutdown()
{
	if (GEngine)
	{
		GEngine->OnNetworkFailure().Remove(NetFailHandle);
		GEngine->OnTravelFailure().Remove(TravelFailHandle);
	}
	Super::Shutdown();
}

void UBRGameInstance::StartLocalMatch(EBRGameModeType Mode)
{
	UGameplayStatics::OpenLevel(this, TEXT("/Engine/Maps/Entry"), true, FString::Printf(TEXT("game=BR?Mode=%s"), *FBRModeRules::ModeToString(Mode)));
}

void UBRGameInstance::ReturnToMainMenu(const FText& Reason)
{
	PendingMessage = Reason;
	if (UBRSessionSubsystem* S = GetSubsystem<UBRSessionSubsystem>()) { S->LeaveGameSession(); }
	UGameplayStatics::OpenLevel(this, TEXT("/Engine/Maps/Entry"), true, TEXT("game=FrontEnd"));
}

FText UBRGameInstance::ConsumePendingMessage()
{
	FText M = PendingMessage;
	PendingMessage = FText::GetEmpty();
	return M;
}

void UBRGameInstance::HandleNetworkFailure(UWorld* World, UNetDriver* NetDriver, ENetworkFailure::Type FailureType, const FString& Error)
{
	UE_LOG(LogBR, Warning, TEXT("Network failure: %s"), *Error);
	// The session subsystem keeps the server address so the menu can offer "Reconectar".
	PendingMessage = LOCTEXT("Disconnected", "Conexão perdida. Use 'Reconectar' para voltar à partida.");
}

void UBRGameInstance::HandleTravelFailure(UWorld* World, ETravelFailure::Type FailureType, const FString& Error)
{
	UE_LOG(LogBR, Warning, TEXT("Travel failure: %s"), *Error);
	ReturnToMainMenu(LOCTEXT("TravelFailed", "Não foi possível conectar ao servidor."));
}

#undef LOCTEXT_NAMESPACE
