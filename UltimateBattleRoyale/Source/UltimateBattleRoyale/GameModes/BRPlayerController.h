#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "Core/BRTypes.h"
#include "Security/BRAntiCheatComponent.h"
#include "BRPlayerController.generated.h"

class UBRHUDWidget;
class UBRTouchControlsWidget;
class UBRAntiCheatComponent;
class ABRCharacter;

USTRUCT()
struct FBRChatLine
{
	GENERATED_BODY()
	FString Sender;
	FString Message;
	bool bTeam = false;
	float Time = 0.f;
};

UENUM()
enum class EBRReportReason : uint8 { Cheating, Toxicity, Teaming, Other };

UCLASS()
class ULTIMATEBATTLEROYALE_API ABRPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	ABRPlayerController();

	virtual void BeginPlay() override;
	virtual void SetupInputComponent() override;
	virtual void PlayerTick(float DeltaTime) override;
	virtual void OnPossess(APawn* InPawn) override;
	virtual void OnUnPossess() override;

	// ---- Anti-cheat helpers (server)
	bool ConsumeRpcToken(EBRRpcBucket Bucket);
	void ReportSuspicious(const FString& Reason, float Weight);
	void NotifyServerTeleport();

	// ---- Client feedback
	UFUNCTION(Client, Unreliable) void ClientConfirmHit(FVector_NetQuantize Location, float Damage, bool bHeadshot, bool bShield, bool bEliminated);
	UFUNCTION(Client, Reliable) void ClientReceiveChat(const FString& Sender, const FString& Message, bool bTeam);
	UFUNCTION(Client, Reliable) void ClientMatchResult(const FBRMatchResult& Result);
	UFUNCTION(Client, Reliable) void ClientStatEvent(FName Stat, int32 Amount);
	UFUNCTION(Client, Reliable) void ClientSpectating(APlayerState* Target);
	UFUNCTION(Client, Reliable) void ClientReturnToMenu(const FText& Reason);
	void OnLocalPawnDamaged(const FVector& FromLocation, float Damage);
	void OnPawnLifeStateChanged(ABRCharacter* Character, EBRLifeState NewState);

	// ---- Requests (UI / input)
	void RequestJumpFromBus();
	void SendChat(const FString& Message, bool bTeam);
	void PlacePingAtCrosshair();
	void ReportPlayer(APlayerState* Target, EBRReportReason Reason, const FString& Details);
	void SpectateNext();
	void CreativeCommand(const FString& Command, const FString& Arg);
	void SetMapOpen(bool bOpen);
	void ToggleMenu();

	UBRHUDWidget* GetHUDWidget() const { return HUDWidget; }
	UBRTouchControlsWidget* GetTouchControls() const { return TouchControls; }
	const TArray<FBRChatLine>& GetChatLines() const { return ChatLines; }
	APlayerState* GetSpectatedPlayer() const { return SpectatedPlayer.Get(); }
	bool IsMapOpen() const { return bMapOpen; }
	bool IsMenuOpen() const { return bMenuOpen; }
	bool HasMatchResult() const { return bHasResult; }
	const FBRMatchResult& GetMatchResult() const { return LastResult; }
	bool ShouldUseTouchControls() const;
	void Vibrate(float Intensity, float Duration);

protected:
	UFUNCTION(Server, Reliable) void ServerJumpFromBus();
	UFUNCTION(Server, Reliable) void ServerSetCosmetics(const FBRCosmeticLoadout& Loadout, int32 AccountLevel);
	UFUNCTION(Server, Reliable) void ServerSendChat(const FString& Message, bool bTeam);
	UFUNCTION(Server, Reliable) void ServerPlacePing(FVector_NetQuantize Location, uint8 Kind);
	UFUNCTION(Server, Reliable) void ServerReportPlayer(APlayerState* Target, EBRReportReason Reason, const FString& Details);
	UFUNCTION(Server, Reliable) void ServerSpectateNext();
	UFUNCTION(Server, Reliable) void ServerCreativeCommand(const FString& Command, const FString& Arg);

private:
	void CreateLocalUI();
	void OnJumpAction();
	void OnFireAction();
	void OnMapAction() { SetMapOpen(!bMapOpen); }
	void OnPingAction() { PlacePingAtCrosshair(); }
	void OnPushToTalkPressed();
	void OnPushToTalkReleased();
	void OnChatAction();
	void OnMenuAction() { ToggleMenu(); }

	UPROPERTY(VisibleAnywhere) TObjectPtr<UBRAntiCheatComponent> AntiCheat;
	UPROPERTY(Transient) TObjectPtr<UBRHUDWidget> HUDWidget;
	UPROPERTY(Transient) TObjectPtr<UBRTouchControlsWidget> TouchControls;

	TArray<FBRChatLine> ChatLines;
	TWeakObjectPtr<APlayerState> SpectatedPlayer;
	FBRMatchResult LastResult;
	bool bHasResult = false;
	bool bMapOpen = false;
	bool bMenuOpen = false;
};
