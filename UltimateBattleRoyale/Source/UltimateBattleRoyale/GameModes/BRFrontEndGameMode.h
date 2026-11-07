#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/PlayerController.h"
#include "BRFrontEndGameMode.generated.h"

class UCameraComponent;
class UBRProceduralBodyComponent;
class UBRMainMenuWidget;
class UAudioComponent;

// 3D lobby: the player's character on a platform with idle/emote animation and menu music.
UCLASS()
class ULTIMATEBATTLEROYALE_API ABRLobbyScene : public AActor
{
	GENERATED_BODY()

public:
	ABRLobbyScene();
	virtual void BeginPlay() override;

	void RefreshLoadout();
	void PlayEmote(FName EmoteId);
	void RotatePreview(float DeltaYaw);
	UCameraComponent* GetCamera() const { return Camera; }

private:
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Turntable;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UBRProceduralBodyComponent> Preview;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> Camera;
	UPROPERTY(Transient) TObjectPtr<UAudioComponent> Music;
};

UCLASS()
class ULTIMATEBATTLEROYALE_API ABRMenuPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	virtual void BeginPlay() override;
	ABRLobbyScene* GetLobby() const { return Lobby.Get(); }

private:
	UPROPERTY(Transient) TObjectPtr<UBRMainMenuWidget> Menu;
	TWeakObjectPtr<ABRLobbyScene> Lobby;
};

UCLASS()
class ULTIMATEBATTLEROYALE_API ABRFrontEndGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ABRFrontEndGameMode();
	virtual void BeginPlay() override;
};
