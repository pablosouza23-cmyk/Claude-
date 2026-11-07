#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Progression/BRProfileSaveGame.h"
#include "Progression/BRCosmetics.h"
#include "BRProgressionSubsystem.generated.h"

UENUM(BlueprintType)
enum class EBRPurchaseResult : uint8 { Success, AlreadyOwned, NotEnoughCoins, NotForSale, Unknown, Pending };

DECLARE_MULTICAST_DELEGATE(FBRProfileChanged);
DECLARE_MULTICAST_DELEGATE_OneParam(FBRChallengeCompleted, const FBRChallenge&);
DECLARE_MULTICAST_DELEGATE_OneParam(FBRBackendMessage, const FText&);

class FJsonObject;

// Player profile: XP/levels, soft currency ("Moedas", earned only by playing), locker
// (owned cosmetics + equipped loadout), item shop with daily rotation, season pass (free and
// premium tracks), daily/weekly challenges and lifetime statistics.
// Storage: when UBRSettings::ProfileBackendUrl is set, the backend (Backend/) is the authority and
// the local SaveGame is only a cache; purchases/claims are requests and XP comes from the game
// server. Without a backend the profile is local (offline play).
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRProgressionSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	// ---- Profile
	int32 GetLevel() const;
	int64 GetXpIntoLevel() const;
	int64 GetXpForNextLevel() const;
	int32 GetCoins() const { return Profile ? Profile->Coins : 0; }
	int64 GetStat(FName Stat) const;
	const FBRCosmeticLoadout& GetLoadout() const;
	bool Owns(FName CosmeticId) const;

	// ---- Locker
	bool Equip(FName CosmeticId, int32 EmoteSlot = 0);
	void SetCustomization(uint8 BodyType, uint8 BodyStyle, uint8 HairStyle, uint8 HeadGear, uint8 ColorVariant);

	// ---- Shop
	void GetShopItems(TArray<const FBRCosmeticDef*>& Out) const;
	EBRPurchaseResult Purchase(FName CosmeticId);

	// ---- Season pass
	int32 GetSeasonTier() const;
	float GetSeasonTierProgress() const;
	bool HasPremiumPass() const { return Profile && Profile->bPremiumPass; }
	bool BuyPremiumPass();
	bool IsTierClaimed(int32 Tier, bool bPremium) const;
	bool ClaimTier(int32 Tier, bool bPremium);
	static constexpr int32 PremiumPassPrice = 950;

	// ---- Challenges
	const TArray<FBRChallenge>& GetChallenges() const;
	void RecordStat(FName Stat, int32 Amount);

	// ---- Matches
	void ApplyMatchResult(const FBRMatchResult& Result);
	void SetLastServer(const FString& Address);

	void Save();
	bool IsBackendAuthoritative() const;
	void RefreshFromBackend();
	FBRProfileChanged OnProfileChanged;
	FBRBackendMessage OnBackendMessage;
	FBRChallengeCompleted OnChallengeCompleted;

private:
	void EnsureChallenges();
	void GrantXp(int64 Xp);
	void Grant(FName CosmeticId);
	void ApplyBackendProfile(const TSharedPtr<FJsonObject>& Json);
	void HandleBackendReply(bool bOk, int32 Status, const TSharedPtr<FJsonObject>& Json, const FText& SuccessText);
	void PushLoadoutToBackend();

	UPROPERTY(Transient) TObjectPtr<UBRProfileSaveGame> Profile;
	static const FString SlotName;
};
