#include "Matchmaking/BRSessionSubsystem.h"

#include "Core/BRSettings.h"
#include "Engine/LocalPlayer.h"
#include "GameFramework/PlayerController.h"
#include "GameModes/BRModeRules.h"
#include "Interfaces/OnlineFriendsInterface.h"
#include "Kismet/GameplayStatics.h"
#include "Online/OnlineSessionNames.h"
#include "OnlineSubsystem.h"
#include "OnlineSubsystemUtils.h"
#include "UltimateBattleRoyale.h"

#define LOCTEXT_NAMESPACE "BRSessions"

static const FName BRModeKey(TEXT("BRMODE"));
static const FName BRConnectKey(TEXT("BRCONNECT"));
static const FName BRPartyKey(TEXT("BRPARTY"));

void UBRSessionSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	if (IOnlineSessionPtr S = GetSessions())
	{
		CreateHandle = S->AddOnCreateSessionCompleteDelegate_Handle(FOnCreateSessionCompleteDelegate::CreateUObject(this, &UBRSessionSubsystem::OnCreateComplete));
		FindHandle = S->AddOnFindSessionsCompleteDelegate_Handle(FOnFindSessionsCompleteDelegate::CreateUObject(this, &UBRSessionSubsystem::OnFindComplete));
		JoinHandle = S->AddOnJoinSessionCompleteDelegate_Handle(FOnJoinSessionCompleteDelegate::CreateUObject(this, &UBRSessionSubsystem::OnJoinComplete));
		InviteHandle = S->AddOnSessionUserInviteAcceptedDelegate_Handle(FOnSessionUserInviteAcceptedDelegate::CreateUObject(this, &UBRSessionSubsystem::OnInviteAccepted));
		SettingsHandle = S->AddOnSessionSettingsUpdatedDelegate_Handle(FOnSessionSettingsUpdatedDelegate::CreateUObject(this, &UBRSessionSubsystem::OnSettingsUpdated));
	}
}

void UBRSessionSubsystem::Deinitialize()
{
	if (IOnlineSessionPtr S = GetSessions())
	{
		S->ClearOnCreateSessionCompleteDelegate_Handle(CreateHandle);
		S->ClearOnFindSessionsCompleteDelegate_Handle(FindHandle);
		S->ClearOnJoinSessionCompleteDelegate_Handle(JoinHandle);
		S->ClearOnSessionUserInviteAcceptedDelegate_Handle(InviteHandle);
		S->ClearOnSessionSettingsUpdatedDelegate_Handle(SettingsHandle);
	}
	Super::Deinitialize();
}

IOnlineSessionPtr UBRSessionSubsystem::GetSessions() const
{
	IOnlineSubsystem* OSS = Online::GetSubsystem(GetWorld());
	return OSS ? OSS->GetSessionInterface() : nullptr;
}

FString UBRSessionSubsystem::GetSubsystemName() const
{
	IOnlineSubsystem* OSS = Online::GetSubsystem(GetWorld());
	return OSS ? OSS->GetSubsystemName().ToString() : TEXT("None");
}

bool UBRSessionSubsystem::IsOnlineAvailable() const
{
	return GetSessions().IsValid();
}

FUniqueNetIdPtr UBRSessionSubsystem::GetLocalUserId() const
{
	const ULocalPlayer* LP = GetGameInstance() ? GetGameInstance()->GetFirstGamePlayer() : nullptr;
	return LP ? LP->GetPreferredUniqueNetId().GetUniqueNetId() : nullptr;
}

void UBRSessionSubsystem::SetStatus(EBRSessionStatus NewStatus, const FText& Text)
{
	Status = NewStatus;
	StatusText = Text;
	OnStatusChanged.Broadcast(Status, StatusText);
}

FOnlineSessionSettings UBRSessionSubsystem::MakeSettings(EBRGameModeType Mode, int32 MaxPlayers, bool bDedicated, bool bParty) const
{
	FOnlineSessionSettings S;
	const bool bLan = GetSubsystemName() == TEXT("NULL");
	S.NumPublicConnections = MaxPlayers;
	S.NumPrivateConnections = 0;
	S.bShouldAdvertise = true;
	S.bIsLANMatch = bLan;
	S.bIsDedicated = bDedicated;
	S.bUsesPresence = !bDedicated;
	S.bUseLobbiesIfAvailable = !bDedicated;
	S.bAllowJoinInProgress = bParty;
	S.bAllowInvites = true;
	S.bAllowJoinViaPresence = !bDedicated;
	S.BuildUniqueId = UBRSettings::Get()->BuildCompatibilityId;
	S.Set(BRModeKey, FBRModeRules::ModeToString(Mode), EOnlineDataAdvertisementType::ViaOnlineServiceAndPing);
	if (bParty) { S.Set(BRPartyKey, FString(TEXT("1")), EOnlineDataAdvertisementType::ViaOnlineService); }
	return S;
}

// --------------------------------------------------------------------------------- matchmaking
void UBRSessionSubsystem::FindMatch(EBRGameModeType Mode)
{
	IOnlineSessionPtr S = GetSessions();
	FUniqueNetIdPtr User = GetLocalUserId();
	if (!S || !User.IsValid())
	{
		SetStatus(EBRSessionStatus::Error, LOCTEXT("NoOnline", "Serviço online indisponível. Faça login (EOS) ou jogue o Treinamento offline."));
		return;
	}
	PendingMode = Mode;
	Search = MakeShared<FOnlineSessionSearch>();
	Search->MaxSearchResults = 100;
	Search->bIsLanQuery = GetSubsystemName() == TEXT("NULL");
	Search->QuerySettings.Set(BRModeKey, FBRModeRules::ModeToString(Mode), EOnlineComparisonOp::Equals);
	SetStatus(EBRSessionStatus::Searching, LOCTEXT("Searching", "Procurando partida..."));
	if (!S->FindSessions(*User, Search.ToSharedRef()))
	{
		SetStatus(EBRSessionStatus::Error, LOCTEXT("SearchFailed", "Falha ao iniciar a busca."));
	}
}

void UBRSessionSubsystem::CancelSearch()
{
	if (IOnlineSessionPtr S = GetSessions()) { S->CancelFindSessions(); }
	SetStatus(EBRSessionStatus::Idle, FText::GetEmpty());
}

void UBRSessionSubsystem::OnFindComplete(bool bOk)
{
	if (Status != EBRSessionStatus::Searching) { return; }
	if (!bOk || !Search.IsValid())
	{
		SetStatus(EBRSessionStatus::Error, LOCTEXT("SearchError", "Erro na busca de partidas."));
		return;
	}
	// Best server: compatible build, free slots, lowest ping, fullest (faster start).
	const FOnlineSessionSearchResult* Best = nullptr;
	for (const FOnlineSessionSearchResult& R : Search->SearchResults)
	{
		if (!R.IsValid() || R.Session.NumOpenPublicConnections <= 0) { continue; }
		if (R.Session.SessionSettings.BuildUniqueId != UBRSettings::Get()->BuildCompatibilityId) { continue; }
		FString Party;
		if (R.Session.SessionSettings.Get(BRPartyKey, Party)) { continue; }
		if (!Best || R.PingInMs < Best->PingInMs - 20 || (FMath::Abs(R.PingInMs - Best->PingInMs) <= 20 && R.Session.NumOpenPublicConnections < Best->Session.NumOpenPublicConnections))
		{
			Best = &R;
		}
	}
	if (!Best)
	{
		SetStatus(EBRSessionStatus::Error, LOCTEXT("NoServers", "Nenhum servidor disponível para este modo agora. Tente novamente ou crie uma partida privada."));
		return;
	}
	SetStatus(EBRSessionStatus::Joining, FText::Format(LOCTEXT("Joining", "Entrando na partida ({0} ms)..."), FText::AsNumber(Best->PingInMs)));
	if (IOnlineSessionPtr S = GetSessions())
	{
		if (FUniqueNetIdPtr User = GetLocalUserId()) { S->JoinSession(*User, NAME_GameSession, *Best); }
	}
}

void UBRSessionSubsystem::OnJoinComplete(FName SessionName, EOnJoinSessionCompleteResult::Type Result)
{
	if (Result != EOnJoinSessionCompleteResult::Success)
	{
		SetStatus(EBRSessionStatus::Error, LOCTEXT("JoinFailed", "Não foi possível entrar (partida cheia ou encerrada)."));
		return;
	}
	if (SessionName == NAME_PartySession)
	{
		bInParty = true; bPartyLeader = false;
		SetStatus(EBRSessionStatus::InParty, LOCTEXT("JoinedParty", "Você entrou no grupo."));
		return;
	}
	TravelToSession(SessionName);
}

void UBRSessionSubsystem::TravelToSession(FName SessionName)
{
	IOnlineSessionPtr S = GetSessions();
	FString Url;
	if (!S || !S->GetResolvedConnectString(SessionName, Url))
	{
		SetStatus(EBRSessionStatus::Error, LOCTEXT("ResolveFailed", "Endereço do servidor inválido."));
		return;
	}
	LastConnectString = Url;
	// Party leader shares the server with the group through the party session.
	if (bInParty && bPartyLeader)
	{
		if (FNamedOnlineSession* Party = S->GetNamedSession(NAME_PartySession))
		{
			FOnlineSessionSettings Updated = Party->SessionSettings;
			Updated.Set(BRConnectKey, Url, EOnlineDataAdvertisementType::ViaOnlineService);
			S->UpdateSession(NAME_PartySession, Updated, true);
		}
	}
	if (!PartyId.IsEmpty()) { Url += TEXT("?Party=") + PartyId; }
	if (APlayerController* PC = GetGameInstance()->GetFirstLocalPlayerController())
	{
		PC->ClientTravel(Url, TRAVEL_Absolute);
	}
}

void UBRSessionSubsystem::Reconnect()
{
	if (LastConnectString.IsEmpty()) { return; }
	if (APlayerController* PC = GetGameInstance()->GetFirstLocalPlayerController())
	{
		PC->ClientTravel(LastConnectString, TRAVEL_Absolute);
	}
}

// --------------------------------------------------------------------------------- hosting
void UBRSessionSubsystem::HostPrivateMatch(EBRGameModeType Mode, int32 MaxPlayers)
{
	IOnlineSessionPtr S = GetSessions();
	FUniqueNetIdPtr User = GetLocalUserId();
	PendingMode = Mode;
	bHostAfterCreate = true;
	if (!S || !User.IsValid())
	{
		// Offline: still allow a local listen server (LAN).
		UGameplayStatics::OpenLevel(this, TEXT("/Engine/Maps/Entry"), true, FString::Printf(TEXT("game=BR?Mode=%s?listen"), *FBRModeRules::ModeToString(Mode)));
		return;
	}
	SetStatus(EBRSessionStatus::Hosting, LOCTEXT("Hosting", "Criando partida privada..."));
	S->CreateSession(*User, NAME_GameSession, MakeSettings(Mode, MaxPlayers, false, false));
}

void UBRSessionSubsystem::RegisterDedicatedServer(EBRGameModeType Mode, int32 MaxPlayers)
{
	IOnlineSessionPtr S = GetSessions();
	if (!S) { UE_LOG(LogBR, Warning, TEXT("Dedicated server: no online subsystem, not advertising.")); return; }
	bHostAfterCreate = false;
	S->CreateSession(0, NAME_GameSession, MakeSettings(Mode, MaxPlayers, true, false));
}

void UBRSessionSubsystem::OnCreateComplete(FName SessionName, bool bOk)
{
	if (!bOk)
	{
		SetStatus(EBRSessionStatus::Error, LOCTEXT("CreateFailed", "Falha ao criar sessão."));
		return;
	}
	if (SessionName == NAME_PartySession)
	{
		bInParty = true; bPartyLeader = true;
		const FUniqueNetIdPtr User = GetLocalUserId();
		PartyId = User.IsValid() ? User->ToString() : FGuid::NewGuid().ToString();
		SetStatus(EBRSessionStatus::InParty, LOCTEXT("PartyCreated", "Grupo criado. Convide seus amigos!"));
		return;
	}
	if (bHostAfterCreate)
	{
		bHostAfterCreate = false;
		UGameplayStatics::OpenLevel(this, TEXT("/Engine/Maps/Entry"), true, FString::Printf(TEXT("game=BR?Mode=%s?listen"), *FBRModeRules::ModeToString(PendingMode)));
	}
	else
	{
		UE_LOG(LogBR, Log, TEXT("Dedicated server session registered."));
	}
}

void UBRSessionSubsystem::LeaveGameSession()
{
	if (IOnlineSessionPtr S = GetSessions())
	{
		if (S->GetNamedSession(NAME_GameSession)) { S->DestroySession(NAME_GameSession); }
	}
}

// --------------------------------------------------------------------------------- parties, friends, invites
void UBRSessionSubsystem::CreateParty()
{
	IOnlineSessionPtr S = GetSessions();
	FUniqueNetIdPtr User = GetLocalUserId();
	if (!S || !User.IsValid())
	{
		SetStatus(EBRSessionStatus::Error, LOCTEXT("PartyNoOnline", "Grupos exigem login online."));
		return;
	}
	S->CreateSession(*User, NAME_PartySession, MakeSettings(PendingMode, 4, false, true));
}

void UBRSessionSubsystem::LeaveParty()
{
	if (IOnlineSessionPtr S = GetSessions()) { S->DestroySession(NAME_PartySession); }
	bInParty = bPartyLeader = false;
	PartyId.Reset();
	SetStatus(EBRSessionStatus::Idle, LOCTEXT("LeftParty", "Você saiu do grupo."));
}

void UBRSessionSubsystem::InviteFriend(const FString& FriendId)
{
	IOnlineSubsystem* OSS = Online::GetSubsystem(GetWorld());
	IOnlineSessionPtr S = GetSessions();
	if (!OSS || !S || !OSS->GetIdentityInterface()) { return; }
	FUniqueNetIdPtr Friend = OSS->GetIdentityInterface()->CreateUniquePlayerId(FriendId);
	FUniqueNetIdPtr User = GetLocalUserId();
	if (!Friend.IsValid() || !User.IsValid()) { return; }
	if (!bInParty) { CreateParty(); }
	S->SendSessionInviteToFriend(*User, NAME_PartySession, *Friend);
}

void UBRSessionSubsystem::OnInviteAccepted(bool bOk, int32 ControllerId, FUniqueNetIdPtr UserId, const FOnlineSessionSearchResult& Invite)
{
	if (!bOk || !Invite.IsValid() || !UserId.IsValid()) { return; }
	if (IOnlineSessionPtr S = GetSessions())
	{
		FString Party;
		const FName Target = Invite.Session.SessionSettings.Get(BRPartyKey, Party) ? NAME_PartySession : NAME_GameSession;
		PartyId = Invite.Session.OwningUserId.IsValid() ? Invite.Session.OwningUserId->ToString() : FString();
		S->JoinSession(*UserId, Target, Invite);
	}
}

void UBRSessionSubsystem::OnSettingsUpdated(FName SessionName, const FOnlineSessionSettings& Settings)
{
	// Party members follow the leader to the match server.
	FString Connect;
	if (SessionName == NAME_PartySession && !bPartyLeader && Settings.Get(BRConnectKey, Connect) && !Connect.IsEmpty() && Connect != LastConnectString)
	{
		LastConnectString = Connect;
		if (APlayerController* PC = GetGameInstance()->GetFirstLocalPlayerController())
		{
			PC->ClientTravel(Connect + TEXT("?Party=") + PartyId, TRAVEL_Absolute);
		}
	}
}

void UBRSessionSubsystem::RefreshFriends()
{
	IOnlineSubsystem* OSS = Online::GetSubsystem(GetWorld());
	IOnlineFriendsPtr FriendsIf = OSS ? OSS->GetFriendsInterface() : nullptr;
	if (!FriendsIf)
	{
		Friends.Reset();
		OnFriendsUpdated.Broadcast();
		return;
	}
	const FString ListName = EFriendsLists::ToString(EFriendsLists::Default);
	FriendsIf->ReadFriendsList(0, ListName, FOnReadFriendsListComplete::CreateWeakLambda(this, [this, ListName](int32 LocalUserNum, bool bOk, const FString&, const FString&)
	{
		Friends.Reset();
		IOnlineSubsystem* Sub = Online::GetSubsystem(GetWorld());
		IOnlineFriendsPtr FI = Sub ? Sub->GetFriendsInterface() : nullptr;
		TArray<TSharedRef<FOnlineFriend>> List;
		if (bOk && FI && FI->GetFriendsList(LocalUserNum, ListName, List))
		{
			for (const TSharedRef<FOnlineFriend>& F : List)
			{
				FBRFriendInfo Info;
				Info.DisplayName = F->GetDisplayName();
				Info.Id = F->GetUserId()->ToString();
				Info.bOnline = F->GetPresence().bIsOnline;
				Info.bPlayingThisGame = F->GetPresence().bIsPlayingThisGame;
				Friends.Add(Info);
			}
		}
		OnFriendsUpdated.Broadcast();
	}));
}

#undef LOCTEXT_NAMESPACE
