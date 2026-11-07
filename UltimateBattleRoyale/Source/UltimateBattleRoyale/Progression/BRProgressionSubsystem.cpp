#include "Progression/BRProgressionSubsystem.h"

#include "Kismet/GameplayStatics.h"

#define LOCTEXT_NAMESPACE "BRProgression"

const FString UBRProgressionSubsystem::SlotName = TEXT("BRProfile");

namespace
{
	struct FChallengeTemplate { const TCHAR* Id; const TCHAR* Stat; int32 Daily, Weekly; const TCHAR* Text; };
	const FChallengeTemplate GTemplates[] = {
		{ TEXT("elim"), TEXT("Eliminations"), 3, 15, TEXT("Elimine {0} adversários") },
		{ TEXT("chest"), TEXT("ChestsOpened"), 5, 25, TEXT("Abra {0} baús") },
		{ TEXT("matches"), TEXT("Matches"), 3, 12, TEXT("Jogue {0} partidas") },
		{ TEXT("top10"), TEXT("Top10"), 1, 5, TEXT("Fique entre os 10 melhores {0} vezes") },
		{ TEXT("damage"), TEXT("DamageDealt"), 500, 3000, TEXT("Cause {0} de dano") },
		{ TEXT("survive"), TEXT("MinutesSurvived"), 30, 150, TEXT("Sobreviva {0} minutos") },
		{ TEXT("revive"), TEXT("Revives"), 2, 8, TEXT("Reanime {0} companheiros") },
		{ TEXT("win"), TEXT("Wins"), 1, 3, TEXT("Vença {0} partida(s)") },
	};
}

void UBRProgressionSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	Profile = Cast<UBRProfileSaveGame>(UGameplayStatics::LoadGameFromSlot(SlotName, 0));
	if (!Profile)
	{
		Profile = Cast<UBRProfileSaveGame>(UGameplayStatics::CreateSaveGameObject(UBRProfileSaveGame::StaticClass()));
		Profile->Loadout = UBRCosmeticCatalog::DefaultLoadout();
	}
	for (const FBRCosmeticDef& D : UBRCosmeticCatalog::All())
	{
		if (D.bDefaultOwned) { Profile->OwnedCosmetics.AddUnique(D.Id); }
	}
	Profile->Loadout = UBRCosmeticCatalog::Sanitize(Profile->Loadout);
	EnsureChallenges();
	Save();
}

void UBRProgressionSubsystem::Save()
{
	if (Profile) { UGameplayStatics::SaveGameToSlot(Profile, SlotName, 0); }
	OnProfileChanged.Broadcast();
}

int32 UBRProgressionSubsystem::GetLevel() const { return Profile ? BRRules::LevelFromTotalXp(Profile->TotalXp) : 1; }

int64 UBRProgressionSubsystem::GetXpIntoLevel() const
{
	long long Into = 0;
	if (Profile) { BRRules::LevelFromTotalXp(Profile->TotalXp, &Into); }
	return Into;
}

int64 UBRProgressionSubsystem::GetXpForNextLevel() const { return BRRules::XpForLevel(GetLevel()); }

int64 UBRProgressionSubsystem::GetStat(FName Stat) const
{
	const int64* V = Profile ? Profile->Stats.Find(Stat) : nullptr;
	return V ? *V : 0;
}

const FBRCosmeticLoadout& UBRProgressionSubsystem::GetLoadout() const
{
	static const FBRCosmeticLoadout Default = UBRCosmeticCatalog::DefaultLoadout();
	return Profile ? Profile->Loadout : Default;
}

bool UBRProgressionSubsystem::Owns(FName CosmeticId) const
{
	return Profile && Profile->OwnedCosmetics.Contains(CosmeticId);
}

bool UBRProgressionSubsystem::Equip(FName CosmeticId, int32 EmoteSlot)
{
	const FBRCosmeticDef* D = UBRCosmeticCatalog::Find(CosmeticId);
	if (!D || !Owns(CosmeticId)) { return false; }
	FBRCosmeticLoadout& L = Profile->Loadout;
	switch (D->Type)
	{
	case EBRCosmeticType::Outfit: L.Outfit = CosmeticId; L.HeadGear = 0; break;
	case EBRCosmeticType::Backpack: L.Backpack = CosmeticId; break;
	case EBRCosmeticType::Pickaxe: L.Pickaxe = CosmeticId; break;
	case EBRCosmeticType::Glider: L.Glider = CosmeticId; break;
	case EBRCosmeticType::Emote:
		EmoteSlot = FMath::Clamp(EmoteSlot, 0, 5);
		if (L.Emotes.Num() <= EmoteSlot) { L.Emotes.SetNum(EmoteSlot + 1); }
		L.Emotes[EmoteSlot] = CosmeticId;
		L.Emotes.RemoveAll([](const FName& N) { return N.IsNone(); });
		break;
	}
	Save();
	return true;
}

void UBRProgressionSubsystem::SetCustomization(uint8 BodyType, uint8 BodyStyle, uint8 HairStyle, uint8 HeadGear, uint8 ColorVariant)
{
	FBRCosmeticLoadout& L = Profile->Loadout;
	L.BodyType = BodyType; L.BodyStyle = BodyStyle; L.HairStyle = HairStyle; L.HeadGear = HeadGear; L.ColorVariant = ColorVariant;
	L = UBRCosmeticCatalog::Sanitize(L);
	Save();
}

void UBRProgressionSubsystem::GetShopItems(TArray<const FBRCosmeticDef*>& Out) const
{
	UBRCosmeticCatalog::GetDailyShop(FDateTime::UtcNow(), Out, 8);
}

EBRPurchaseResult UBRProgressionSubsystem::Purchase(FName CosmeticId)
{
	const FBRCosmeticDef* D = UBRCosmeticCatalog::Find(CosmeticId);
	if (!D) { return EBRPurchaseResult::Unknown; }
	if (!D->bShopItem || D->Price <= 0) { return EBRPurchaseResult::NotForSale; }
	if (Owns(CosmeticId)) { return EBRPurchaseResult::AlreadyOwned; }
	if (Profile->Coins < D->Price) { return EBRPurchaseResult::NotEnoughCoins; }
	Profile->Coins -= D->Price;
	Grant(CosmeticId);
	Save();
	return EBRPurchaseResult::Success;
}

void UBRProgressionSubsystem::Grant(FName CosmeticId)
{
	if (UBRCosmeticCatalog::Find(CosmeticId)) { Profile->OwnedCosmetics.AddUnique(CosmeticId); }
}

int32 UBRProgressionSubsystem::GetSeasonTier() const { return Profile ? BRRules::SeasonTierFromXp(Profile->SeasonXp) : 0; }

float UBRProgressionSubsystem::GetSeasonTierProgress() const
{
	if (!Profile || GetSeasonTier() >= BRRules::SeasonPassTiers) { return 1.f; }
	return float(Profile->SeasonXp % BRRules::XpPerSeasonTier) / float(BRRules::XpPerSeasonTier);
}

bool UBRProgressionSubsystem::BuyPremiumPass()
{
	if (!Profile || Profile->bPremiumPass || Profile->Coins < PremiumPassPrice) { return false; }
	Profile->Coins -= PremiumPassPrice;
	Profile->bPremiumPass = true;
	Save();
	return true;
}

bool UBRProgressionSubsystem::IsTierClaimed(int32 Tier, bool bPremium) const
{
	return Profile && (bPremium ? Profile->ClaimedPremiumTiers : Profile->ClaimedFreeTiers).Contains(Tier);
}

bool UBRProgressionSubsystem::ClaimTier(int32 Tier, bool bPremium)
{
	if (!Profile || Tier > GetSeasonTier() || IsTierClaimed(Tier, bPremium) || (bPremium && !Profile->bPremiumPass)) { return false; }
	for (const FBRSeasonReward& R : UBRCosmeticCatalog::SeasonRewards())
	{
		if (R.Tier != Tier || R.bPremium != bPremium) { continue; }
		if (!R.CosmeticId.IsNone()) { Grant(R.CosmeticId); }
		Profile->Coins += R.Coins;
		(bPremium ? Profile->ClaimedPremiumTiers : Profile->ClaimedFreeTiers).Add(Tier);
		Save();
		return true;
	}
	return false;
}

void UBRProgressionSubsystem::EnsureChallenges()
{
	const FDateTime Now = FDateTime::UtcNow();
	const FString Daily = Now.ToString(TEXT("%Y-%m-%d"));
	const int32 Week = (Now.GetDayOfYear() - 1) / 7;
	const FString Weekly = FString::Printf(TEXT("%d-W%d"), Now.GetYear(), Week);
	if (Profile->DailyKey != Daily)
	{
		Profile->Challenges.RemoveAll([](const FBRChallenge& C) { return !C.bWeekly; });
		BRRules::Rng R(GetTypeHash(Daily));
		TArray<int32> Pool; for (int32 I = 0; I < UE_ARRAY_COUNT(GTemplates); ++I) { Pool.Add(I); }
		for (int32 N = 0; N < 3 && Pool.Num() > 0; ++N)
		{
			const int32 Pick = Pool[R.RangeInt(0, Pool.Num() - 1)];
			Pool.Remove(Pick);
			const FChallengeTemplate& T = GTemplates[Pick];
			FBRChallenge C;
			C.Id = FName(*FString::Printf(TEXT("D_%s"), T.Id)); C.Stat = T.Stat; C.Target = T.Daily; C.XpReward = 3000; C.bWeekly = false;
			C.Description = FText::Format(FText::FromString(T.Text), FText::AsNumber(T.Daily));
			Profile->Challenges.Add(C);
		}
		Profile->DailyKey = Daily;
	}
	if (Profile->WeeklyKey != Weekly)
	{
		Profile->Challenges.RemoveAll([](const FBRChallenge& C) { return C.bWeekly; });
		BRRules::Rng R(GetTypeHash(Weekly) | 1u);
		TArray<int32> Pool; for (int32 I = 0; I < UE_ARRAY_COUNT(GTemplates); ++I) { Pool.Add(I); }
		for (int32 N = 0; N < 5 && Pool.Num() > 0; ++N)
		{
			const int32 Pick = Pool[R.RangeInt(0, Pool.Num() - 1)];
			Pool.Remove(Pick);
			const FChallengeTemplate& T = GTemplates[Pick];
			FBRChallenge C;
			C.Id = FName(*FString::Printf(TEXT("W_%s"), T.Id)); C.Stat = T.Stat; C.Target = T.Weekly; C.XpReward = 12000; C.bWeekly = true;
			C.Description = FText::Format(FText::FromString(T.Text), FText::AsNumber(T.Weekly));
			Profile->Challenges.Add(C);
		}
		Profile->WeeklyKey = Weekly;
	}
}

const TArray<FBRChallenge>& UBRProgressionSubsystem::GetChallenges() const
{
	static const TArray<FBRChallenge> Empty;
	return Profile ? Profile->Challenges : Empty;
}

void UBRProgressionSubsystem::GrantXp(int64 Xp)
{
	Profile->TotalXp += Xp;
	Profile->SeasonXp += Xp;
}

void UBRProgressionSubsystem::RecordStat(FName Stat, int32 Amount)
{
	if (!Profile || Amount <= 0) { return; }
	EnsureChallenges();
	Profile->Stats.FindOrAdd(Stat) += Amount;
	for (FBRChallenge& C : Profile->Challenges)
	{
		if (C.bCompleted || C.Stat != Stat) { continue; }
		C.Progress = FMath::Min(C.Target, C.Progress + Amount);
		if (C.Progress >= C.Target)
		{
			C.bCompleted = true;
			GrantXp(C.XpReward);
			OnChallengeCompleted.Broadcast(C);
		}
	}
	Save();
}

void UBRProgressionSubsystem::ApplyMatchResult(const FBRMatchResult& Result)
{
	if (!Profile) { return; }
	GrantXp(Result.XpEarned);
	Profile->Coins += Result.CoinsEarned;
	if (Result.bCountsForProgression)
	{
		// Eliminations/revives were already counted live through ClientStatEvent.
		RecordStat(TEXT("Matches"), 1);
		if (Result.Placement <= 10) { RecordStat(TEXT("Top10"), 1); }
		if (Result.Placement == 1) { RecordStat(TEXT("Wins"), 1); }
		RecordStat(TEXT("ChestsOpened"), Result.ChestsOpened);
		RecordStat(TEXT("DamageDealt"), Result.DamageDealt);
		RecordStat(TEXT("MinutesSurvived"), FMath::FloorToInt(Result.SecondsSurvived / 60.f));
	}
	Save();
}

void UBRProgressionSubsystem::SetLastServer(const FString& Address)
{
	if (Profile) { Profile->LastServer = Address; Save(); }
}

#undef LOCTEXT_NAMESPACE
