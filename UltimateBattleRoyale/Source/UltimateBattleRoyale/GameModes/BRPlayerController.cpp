#include "GameModes/BRPlayerController.h"

#include "Characters/BRCharacter.h"
#include "Characters/BRInputConfig.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameModes/BRGameMode.h"
#include "GameModes/BRGameState.h"
#include "GameModes/BRPlayerState.h"
#include "Kismet/GameplayStatics.h"
#include "Progression/BRProgressionSubsystem.h"
#include "Settings/BRGameUserSettings.h"
#include "Systems/BRBattleBus.h"
#include "Systems/BRMatchLogger.h"
#include "UI/BRHUDWidget.h"
#include "UI/BRTouchControlsWidget.h"
#include "Audio/BRProceduralAudio.h"
#include "Multiplayer/BRGameInstance.h"
#include "Multiplayer/BRBackendClient.h"
#include "Progression/BRCosmetics.h"
#include "Dom/JsonObject.h"

#define LOCTEXT_NAMESPACE "BRPlayerController"

ABRPlayerController::ABRPlayerController()
{
	AntiCheat = CreateDefaultSubobject<UBRAntiCheatComponent>(TEXT("AntiCheat"));
	bShowMouseCursor = false;
}

void ABRPlayerController::BeginPlay()
{
	Super::BeginPlay();
	if (!IsLocalController()) { return; }

	if (UEnhancedInputLocalPlayerSubsystem* Sub = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer()))
	{
		Sub->AddMappingContext(UBRInputConfig::Get()->DefaultContext, 0);
	}
	SetInputMode(FInputModeGameOnly());
	CreateLocalUI();

	// Send the locally equipped cosmetics (validated against the catalogue on the server).
	if (UBRProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UBRProgressionSubsystem>())
	{
		ServerSetCosmetics(Prog->GetLoadout(), Prog->GetLevel());
	}
}

void ABRPlayerController::CreateLocalUI()
{
	HUDWidget = CreateWidget<UBRHUDWidget>(this, UBRHUDWidget::StaticClass());
	if (HUDWidget) { HUDWidget->AddToViewport(0); }
	if (ShouldUseTouchControls())
	{
		TouchControls = CreateWidget<UBRTouchControlsWidget>(this, UBRTouchControlsWidget::StaticClass());
		if (TouchControls) { TouchControls->AddToViewport(10); }
	}
}

bool ABRPlayerController::ShouldUseTouchControls() const
{
	const UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
#if PLATFORM_ANDROID || PLATFORM_IOS
	return true;
#else
	return S && S->bForceTouchControls;
#endif
}

void ABRPlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();
	UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(InputComponent);
	if (!EIC) { return; }
	const UBRInputConfig* In = UBRInputConfig::Get();
	EIC->BindAction(In->Jump, ETriggerEvent::Started, this, &ABRPlayerController::OnJumpAction);
	EIC->BindAction(In->Fire, ETriggerEvent::Started, this, &ABRPlayerController::OnFireAction);
	EIC->BindAction(In->Map, ETriggerEvent::Started, this, &ABRPlayerController::OnMapAction);
	EIC->BindAction(In->Ping, ETriggerEvent::Started, this, &ABRPlayerController::OnPingAction);
	EIC->BindAction(In->PushToTalk, ETriggerEvent::Started, this, &ABRPlayerController::OnPushToTalkPressed);
	EIC->BindAction(In->PushToTalk, ETriggerEvent::Completed, this, &ABRPlayerController::OnPushToTalkReleased);
	EIC->BindAction(In->Chat, ETriggerEvent::Started, this, &ABRPlayerController::OnChatAction);
	EIC->BindAction(In->Menu, ETriggerEvent::Started, this, &ABRPlayerController::OnMenuAction);
}

void ABRPlayerController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);
	NotifyServerTeleport();
	SpectatedPlayer.Reset();
}

void ABRPlayerController::OnUnPossess()
{
	Super::OnUnPossess();
	NotifyServerTeleport();
}

void ABRPlayerController::PlayerTick(float DeltaTime)
{
	Super::PlayerTick(DeltaTime);
	// While on the bus, the bus camera is the view target.
	const ABRGameState* GS = GetWorld()->GetGameState<ABRGameState>();
	const ABRPlayerState* PS = GetPlayerState<ABRPlayerState>();
	if (IsLocalController() && GS && PS && PS->IsOnBus() && GS->GetBus() && GetViewTarget() != GS->GetBus() && !GetPawn())
	{
		SetViewTargetWithBlend(GS->GetBus(), 0.5f);
	}
	// Keep chat short.
	const float Now = GetWorld()->GetTimeSeconds();
	ChatLines.RemoveAll([Now](const FBRChatLine& L) { return Now - L.Time > 20.f; });
}

// --------------------------------------------------------------------------------- anti-cheat
bool ABRPlayerController::ConsumeRpcToken(EBRRpcBucket Bucket)
{
	return !AntiCheat || AntiCheat->ConsumeToken(Bucket);
}

void ABRPlayerController::ReportSuspicious(const FString& Reason, float Weight)
{
	if (AntiCheat) { AntiCheat->Flag(Reason, Weight); }
}

void ABRPlayerController::NotifyServerTeleport()
{
	if (AntiCheat && HasAuthority()) { AntiCheat->NotifyTeleport(); }
}

// --------------------------------------------------------------------------------- input
void ABRPlayerController::OnJumpAction()
{
	const ABRPlayerState* PS = GetPlayerState<ABRPlayerState>();
	if (PS && PS->IsOnBus() && !GetPawn()) { RequestJumpFromBus(); }
}

void ABRPlayerController::OnFireAction()
{
	if (!GetPawn() && SpectatedPlayer.IsValid()) { SpectateNext(); }
}

void ABRPlayerController::OnPushToTalkPressed()
{
	const UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	if (S && S->bVoiceChatEnabled) { StartTalking(); }
}

void ABRPlayerController::OnPushToTalkReleased()
{
	StopTalking();
}

void ABRPlayerController::OnChatAction()
{
	if (HUDWidget) { HUDWidget->OpenChatInput(); }
}

void ABRPlayerController::SetMapOpen(bool bOpen)
{
	bMapOpen = bOpen;
}

void ABRPlayerController::ToggleMenu()
{
	bMenuOpen = !bMenuOpen;
	if (HUDWidget) { HUDWidget->SetMenuOpen(bMenuOpen); }
	bShowMouseCursor = bMenuOpen && !ShouldUseTouchControls();
	if (bMenuOpen) { SetInputMode(FInputModeGameAndUI()); } else { SetInputMode(FInputModeGameOnly()); }
}

// --------------------------------------------------------------------------------- bus
void ABRPlayerController::RequestJumpFromBus()
{
	ServerJumpFromBus();
}

void ABRPlayerController::ServerJumpFromBus_Implementation()
{
	if (ABRGameMode* GM = GetWorld()->GetAuthGameMode<ABRGameMode>()) { GM->HandleJumpFromBus(this); }
}

void ABRPlayerController::ServerSetCosmetics_Implementation(const FBRCosmeticLoadout& Loadout, int32 AccountLevel)
{
	ABRPlayerState* PS = GetPlayerState<ABRPlayerState>();
	if (!PS) { return; }
	UBRBackendClient* Backend = GetGameInstance()->GetSubsystem<UBRBackendClient>();
	if (Backend && Backend->CanActAsServer() && PS->GetUniqueId().IsValid())
	{
		// Never trust the client: show only cosmetics the backend says this player owns.
		PS->SetCosmetics(UBRCosmeticCatalog::DefaultLoadout());
		TWeakObjectPtr<ABRPlayerState> WeakPS = PS;
		Backend->FetchVerifiedLoadout(PS->GetUniqueId()->ToString(), FBRBackendResponse::CreateLambda([WeakPS](bool bOk, int32, TSharedPtr<FJsonObject> Json)
		{
			if (!bOk || !Json.IsValid() || !WeakPS.IsValid()) { return; }
			const TSharedPtr<FJsonObject>* L = nullptr;
			if (Json->TryGetObjectField(TEXT("loadout"), L)) { WeakPS->SetCosmetics(UBRBackendClient::LoadoutFromJson(*L)); }
			WeakPS->SetAccountLevel(Json->GetIntegerField(TEXT("level")));
		}));
		return;
	}
	// Offline / LAN without a backend: ids are validated against the catalogue only.
	PS->SetCosmetics(Loadout);
	PS->SetAccountLevel(AccountLevel);
}

// --------------------------------------------------------------------------------- chat / ping / report
void ABRPlayerController::SendChat(const FString& Message, bool bTeam)
{
	const FString Clean = Message.TrimStartAndEnd().Left(120);
	if (!Clean.IsEmpty()) { ServerSendChat(Clean, bTeam); }
}

void ABRPlayerController::ServerSendChat_Implementation(const FString& Message, bool bTeam)
{
	if (!ConsumeRpcToken(EBRRpcBucket::Chat)) { return; }
	if (ABRGameMode* GM = GetWorld()->GetAuthGameMode<ABRGameMode>()) { GM->BroadcastChat(this, Message.Left(120), bTeam); }
}

void ABRPlayerController::ClientReceiveChat_Implementation(const FString& Sender, const FString& Message, bool bTeam)
{
	FBRChatLine L; L.Sender = Sender; L.Message = Message; L.bTeam = bTeam; L.Time = GetWorld()->GetTimeSeconds();
	ChatLines.Add(L);
	if (ChatLines.Num() > 8) { ChatLines.RemoveAt(0); }
}

void ABRPlayerController::PlacePingAtCrosshair()
{
	FVector Loc;
	uint8 Kind = 0;
	if (const ABRCharacter* C = Cast<ABRCharacter>(GetPawn()))
	{
		FHitResult Hit;
		Loc = C->GetAimPoint(30000.f, &Hit);
		if (Hit.GetActor() && Hit.GetActor()->IsA<ABRCharacter>()) { Kind = 1; }
		else if (Hit.GetActor() && Hit.GetActor()->Implements<UBRInteractable>()) { Kind = 2; }
	}
	else { return; }
	ServerPlacePing(Loc, Kind);
	UBRProceduralAudio::PlaySfx(this, EBRSfx::Ping, Loc, 0.6f);
}

void ABRPlayerController::ServerPlacePing_Implementation(FVector_NetQuantize Location, uint8 Kind)
{
	if (!ConsumeRpcToken(EBRRpcBucket::Ping)) { return; }
	ABRGameState* GS = GetWorld()->GetGameState<ABRGameState>();
	const ABRPlayerState* PS = GetPlayerState<ABRPlayerState>();
	if (!GS || !PS) { return; }
	FBRPingMarker P;
	P.Location = Location; P.TeamId = PS->GetTeamId(); P.Owner = PS->GetPlayerName(); P.Kind = FMath::Min<uint8>(Kind, 2);
	P.ExpireTime = GS->GetServerWorldTimeSeconds() + 12.0;
	GS->AddPing(P);
}

void ABRPlayerController::ReportPlayer(APlayerState* Target, EBRReportReason Reason, const FString& Details)
{
	ServerReportPlayer(Target, Reason, Details.Left(200));
}

void ABRPlayerController::ServerReportPlayer_Implementation(APlayerState* Target, EBRReportReason Reason, const FString& Details)
{
	if (!Target || Target == PlayerState || !ConsumeRpcToken(EBRRpcBucket::Report)) { return; }
	if (UBRMatchLogger* Log = GetWorld()->GetSubsystem<UBRMatchLogger>())
	{
		Log->LogEvent(TEXT("player_report"), {
			{ TEXT("reporter"), PlayerState ? PlayerState->GetPlayerName() : TEXT("?") },
			{ TEXT("target"), Target->GetPlayerName() },
			{ TEXT("reason"), FString::FromInt(int32(Reason)) },
			{ TEXT("details"), Details.Left(200) } });
		Log->Flush();
	}
	ClientReceiveChat(TEXT("Sistema"), LOCTEXT("Reported", "Denúncia registrada. Obrigado!").ToString(), false);
}

// --------------------------------------------------------------------------------- spectate
void ABRPlayerController::SpectateNext()
{
	ServerSpectateNext();
}

void ABRPlayerController::ServerSpectateNext_Implementation()
{
	if (ABRGameMode* GM = GetWorld()->GetAuthGameMode<ABRGameMode>()) { GM->SpectateNext(this); }
}

void ABRPlayerController::ClientSpectating_Implementation(APlayerState* Target)
{
	SpectatedPlayer = Target;
}

// --------------------------------------------------------------------------------- creative
void ABRPlayerController::CreativeCommand(const FString& Command, const FString& Arg)
{
	ServerCreativeCommand(Command.Left(32), Arg.Left(64));
}

void ABRPlayerController::ServerCreativeCommand_Implementation(const FString& Command, const FString& Arg)
{
	if (!ConsumeRpcToken(EBRRpcBucket::Inventory)) { return; }
	if (ABRGameMode* GM = GetWorld()->GetAuthGameMode<ABRGameMode>()) { GM->HandleCreativeCommand(this, Command, Arg); }
}

// --------------------------------------------------------------------------------- feedback
void ABRPlayerController::ClientConfirmHit_Implementation(FVector_NetQuantize Location, float Damage, bool bHeadshot, bool bShield, bool bEliminated)
{
	if (HUDWidget) { HUDWidget->AddHitMarker(Location, Damage, bHeadshot, bShield, bEliminated); }
	UBRProceduralAudio::PlaySfx(this, bHeadshot ? EBRSfx::HitHead : EBRSfx::HitBody, FVector::ZeroVector, 0.5f, true);
	if (bEliminated) { Vibrate(0.6f, 0.15f); }
}

void ABRPlayerController::OnLocalPawnDamaged(const FVector& FromLocation, float Damage)
{
	if (HUDWidget) { HUDWidget->AddDamageIndicator(FromLocation, Damage); }
	Vibrate(FMath::Clamp(Damage / 60.f, 0.2f, 1.f), 0.12f);
}

void ABRPlayerController::Vibrate(float Intensity, float Duration)
{
	const UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	if (S && S->bVibrationEnabled)
	{
		PlayDynamicForceFeedback(Intensity, Duration, true, true, true, true);
	}
}

void ABRPlayerController::OnPawnLifeStateChanged(ABRCharacter* Character, EBRLifeState NewState)
{
	if (IsLocalController() && NewState == EBRLifeState::Eliminated) { Vibrate(1.f, 0.4f); }
}

void ABRPlayerController::ClientStatEvent_Implementation(FName Stat, int32 Amount)
{
	if (UBRProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UBRProgressionSubsystem>())
	{
		Prog->RecordStat(Stat, Amount);
	}
}

void ABRPlayerController::ClientMatchResult_Implementation(const FBRMatchResult& Result)
{
	LastResult = Result;
	bHasResult = true;
	if (UBRProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UBRProgressionSubsystem>())
	{
		Prog->ApplyMatchResult(Result);
	}
	UBRProceduralAudio::PlaySfx(this, Result.Placement == 1 ? EBRSfx::VictoryMusic : EBRSfx::UIConfirm, FVector::ZeroVector, 0.8f, true);
}

void ABRPlayerController::ClientReturnToMenu_Implementation(const FText& Reason)
{
	if (UBRGameInstance* GI = GetGameInstance<UBRGameInstance>()) { GI->ReturnToMainMenu(Reason); }
}

#undef LOCTEXT_NAMESPACE
