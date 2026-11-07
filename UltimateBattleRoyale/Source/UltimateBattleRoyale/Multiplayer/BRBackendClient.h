#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Core/BRTypes.h"
#include "BRBackendClient.generated.h"

class FJsonObject;

DECLARE_DELEGATE_ThreeParams(FBRBackendResponse, bool /*bOk*/, int32 /*HttpStatus*/, TSharedPtr<FJsonObject> /*Json*/);

USTRUCT()
struct FBRBackendMatchEntry
{
	GENERATED_BODY()
	FString PlayerId;
	FBRMatchResult Result;
};

// HTTP client for the authoritative profile backend (Backend/brbackend).
//  * Players: profile, shop purchases, season pass, loadout — authenticated with the online
//    subsystem token (EOS) or "dev:<id>" during development.
//  * Dedicated servers: post match results and fetch owned-only loadouts, signed with HMAC-SHA1
//    using BR_SERVER_SECRET (environment variable or -BRServerSecret=...). Clients never hold it.
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRBackendClient : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	bool IsEnabled() const { return !BaseUrl.IsEmpty(); }
	bool CanActAsServer() const { return IsEnabled() && !ServerSecret.IsEmpty(); }

	// Player API
	void FetchProfile(FBRBackendResponse Done);
	void Purchase(FName ItemId, FBRBackendResponse Done);
	void BuyPremiumPass(FBRBackendResponse Done);
	void ClaimTier(int32 Tier, bool bPremium, FBRBackendResponse Done);
	void SaveLoadout(const FBRCosmeticLoadout& Loadout, FBRBackendResponse Done);

	// Game-server API
	void PostMatchResults(const FString& MatchId, EBRGameModeType Mode, bool bCountsForProgression, const TArray<FBRBackendMatchEntry>& Entries);
	void FetchVerifiedLoadout(const FString& PlayerId, FBRBackendResponse Done);

	// Same sanitisation on client and server so ids always match the backend's rules.
	static FString SanitizePlayerId(const FString& Raw);
	static FBRCosmeticLoadout LoadoutFromJson(const TSharedPtr<FJsonObject>& Json);
	static TSharedRef<FJsonObject> LoadoutToJson(const FBRCosmeticLoadout& L);
	static FString SignRequest(const FString& Secret, const FString& Verb, const FString& Path, const FString& Timestamp, const TArray<uint8>& Body);

private:
	void Send(const FString& Verb, const FString& Path, const TSharedPtr<FJsonObject>& Body, bool bAsServer, FBRBackendResponse Done);
	FString PlayerToken() const;

	FString BaseUrl;
	FString ServerSecret;
};
