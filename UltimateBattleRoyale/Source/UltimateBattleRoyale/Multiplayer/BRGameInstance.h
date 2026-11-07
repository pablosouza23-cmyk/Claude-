#pragma once

#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "Core/BRTypes.h"
#include "BRGameInstance.generated.h"

UCLASS()
class ULTIMATEBATTLEROYALE_API UBRGameInstance : public UGameInstance
{
	GENERATED_BODY()

public:
	virtual void Init() override;
	virtual void Shutdown() override;

	// Offline/local modes (training with bots, shooting range, creative). Clearly labelled as offline.
	void StartLocalMatch(EBRGameModeType Mode);
	void ReturnToMainMenu(const FText& Reason);

	FText ConsumePendingMessage();

private:
	void HandleNetworkFailure(UWorld* World, UNetDriver* NetDriver, ENetworkFailure::Type FailureType, const FString& Error);
	void HandleTravelFailure(UWorld* World, ETravelFailure::Type FailureType, const FString& Error);

	FText PendingMessage;
	FDelegateHandle NetFailHandle, TravelFailHandle;
};
