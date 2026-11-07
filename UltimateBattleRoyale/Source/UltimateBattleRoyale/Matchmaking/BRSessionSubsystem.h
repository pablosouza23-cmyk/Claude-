#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Core/BRTypes.h"
#include "Interfaces/OnlineSessionInterface.h"
#include "OnlineSessionSettings.h"
#include "BRSessionSubsystem.generated.h"

UENUM(BlueprintType)
enum class EBRSessionStatus : uint8 { Idle, Searching, Joining, Hosting, InParty, Error };

USTRUCT(BlueprintType)
struct FBRFriendInfo
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly) FString DisplayName;
	UPROPERTY(BlueprintReadOnly) FString Id;
	UPROPERTY(BlueprintReadOnly) bool bOnline = false;
	UPROPERTY(BlueprintReadOnly) bool bPlayingThisGame = false;
};

DECLARE_MULTICAST_DELEGATE_TwoParams(FBRSessionStatusChanged, EBRSessionStatus, const FText&);
DECLARE_MULTICAST_DELEGATE(FBRFriendsUpdated);

// Online sessions through the Online Subsystem (EOS in production, NULL/LAN for development):
// matchmaking against dedicated servers, private hosting, parties (lobby session), friends,
// invitations and reconnect. Real network play only — bots are never disguised as players.
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRSessionSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	// Clients
	void FindMatch(EBRGameModeType Mode);
	void CancelSearch();
	void HostPrivateMatch(EBRGameModeType Mode, int32 MaxPlayers);
	void CreateParty();
	void LeaveParty();
	void InviteFriend(const FString& FriendId);
	void RefreshFriends();
	void Reconnect();
	bool CanReconnect() const { return !LastConnectString.IsEmpty(); }
	void LeaveGameSession();

	// Dedicated server
	void RegisterDedicatedServer(EBRGameModeType Mode, int32 MaxPlayers);

	EBRSessionStatus GetStatus() const { return Status; }
	FText GetStatusText() const { return StatusText; }
	const TArray<FBRFriendInfo>& GetFriends() const { return Friends; }
	bool IsInParty() const { return bInParty; }
	bool IsPartyLeader() const { return bPartyLeader; }
	FString GetSubsystemName() const;
	bool IsOnlineAvailable() const;

	FBRSessionStatusChanged OnStatusChanged;
	FBRFriendsUpdated OnFriendsUpdated;

private:
	IOnlineSessionPtr GetSessions() const;
	FUniqueNetIdPtr GetLocalUserId() const;
	void SetStatus(EBRSessionStatus NewStatus, const FText& Text);
	FOnlineSessionSettings MakeSettings(EBRGameModeType Mode, int32 MaxPlayers, bool bDedicated, bool bParty) const;
	void TravelToSession(FName SessionName);

	void OnCreateComplete(FName SessionName, bool bOk);
	void OnFindComplete(bool bOk);
	void OnJoinComplete(FName SessionName, EOnJoinSessionCompleteResult::Type Result);
	void OnInviteAccepted(bool bOk, int32 ControllerId, FUniqueNetIdPtr UserId, const FOnlineSessionSearchResult& Invite);
	void OnSettingsUpdated(FName SessionName, const FOnlineSessionSettings& Settings);

	TSharedPtr<FOnlineSessionSearch> Search;
	EBRGameModeType PendingMode = EBRGameModeType::Solo;
	bool bHostAfterCreate = false;
	EBRSessionStatus Status = EBRSessionStatus::Idle;
	FText StatusText;
	TArray<FBRFriendInfo> Friends;
	bool bInParty = false;
	bool bPartyLeader = false;
	FString PartyId;
	FString LastConnectString;

	FDelegateHandle CreateHandle, FindHandle, JoinHandle, InviteHandle, SettingsHandle;
};
