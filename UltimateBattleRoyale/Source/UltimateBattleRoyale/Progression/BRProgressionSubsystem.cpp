#include "Progression/BRProgressionSubsystem.h"

#include "Dom/JsonObject.h"
#include "Kismet/GameplayStatics.h"
#include "Multiplayer/BRBackendClient.h"
#include "TimerManager.h"

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
	Collection.InitializeDependency<UBRBackendClient>();
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
	RefreshFromBackend();
}

bool UBRProgressionSubsystem::IsBackendAuthoritative() const
{
	const UBRBackendClient* B = GetGameInstance()->GetSubsystem<UBRBackendClient>();
	return B && B->IsEnabled();
}

void UBRProgressionSubsystem::RefreshFromBackend()
{
	if (!IsBackendAuthoritative()) { return; }
	TWeakObjectPtr<UBRProgressionSubsystem> WeakThis = this;
	GetGameInstance()->GetSubsystem<UBRBackendClient>()->FetchProfile(FBRBackendResponse::CreateLambda([WeakThis](bool bOk, int32 Status, TSharedPtr<FJsonObject> Json)
	{
		if (WeakThis.IsValid()) { WeakThis->HandleBackendReply(bOk, Status, Json, FText::GetEmpty()); }
	}));
}

void UBRProgressionSubsystem::HandleBackendReply(bool bOk, int32 Status, const TSharedPtr<FJsonObject>& Json, const FText& SuccessText)
{
	if (bOk && Json.IsValid())
	{
		ApplyBackendProfile(Json);
		if (!SuccessText.IsEmpty()) { OnBackendMessage.Broadcast(SuccessText); }
		return;
	}
	FString Message;
	if (Json.IsValid() && Json->TryGetStringField(TEXT("message"), Message)) { OnBackendMessage.Broadcast(FText::FromString(Message)); }
	else { OnBackendMessage.Broadcast(FText::Format(NSLOCTEXT("BRProgression", "BackendDown", "Servidor de perfil indisponível ({0}). Usando dados salvos."), FText::AsNumber(Status))); }
}

void UBRProgressionSubsystem::ApplyBackendProfile(const TSharedPtr<FJsonObject>& J)
{
	// The backend's numbers replace the local cache entirely (server authority).
	Profile->TotalXp = int64(J->GetNumberField(TEXT("totalXp")));
	Profile->SeasonXp = int64(J->GetNumberField(TEXT("seasonXp")));
	Profile->Coins = J->GetIntegerField(TEXT("coins"));
	Profile->bPremiumPass = J->GetBoolField(TEXT("premiumPass"));
	auto ReadNames = [&J](const TCHAR* Field, TArray<FName>& Out)
	{
		Out.Reset();
		const TArray<TSharedPtr<FJsonValue>>* Arr = nullptr;
		if (J->TryGetArrayField(Field, Arr)) { for (const TSharedPtr<FJsonValue>& V : *Arr) { Out.Add(FName(*V->AsString())); } }
	};
	auto ReadInts = [&J](const TCHAR* Field, TArray<int32>& Out)
	{
		Out.Reset();
		const TArray<TSharedPtr<FJsonValue>>* Arr = nullptr;
		if (J->TryGetArrayField(Field, Arr)) { for (const TSharedPtr<FJsonValue>& V : *Arr) { Out.Add(int32(V->AsNumber())); } }
	};
	ReadNames(TEXT("owned"), Profile->OwnedCosmetics);
	ReadInts(TEXT("claimedFree"), Profile->ClaimedFreeTiers);
	ReadInts(TEXT("claimedPremium"), Profile->ClaimedPremiumTiers);
	const TSharedPtr<FJsonObject>* Loadout = nullptr;
	if (J->TryGetObjectField(TEXT("loadout"), Loadout)) { Profile->Loadout = UBRCosmeticCatalog::Sanitize(UBRBackendClient::LoadoutFromJson(*Loadout)); }
	const TSharedPtr<FJsonObject>* Stats = nullptr;
	if (J->TryGetObjectField(TEXT("stats"), Stats))
	{
		Profile->Stats.Reset();
		for (const TPair<FString, TSharedPtr<FJsonValue>>& P : (*Stats)->Values) { Profile->Stats.Add(FName(*P.Key), int64(P.Value->AsNumber())); }
	}
	const TArray<TSharedPtr<FJsonValue>>* Challenges = nullptr;
	if (J->TryGetArrayField(TEXT("challenges"), Challenges))
	{
		Profile->Challenges.Reset();
		for (const TSharedPtr<FJsonValue>& V : *Challenges)
		{
			const TSharedPtr<FJsonObject> O = V->AsObject();
			if (!O.IsValid()) { continue; }
			FBRChallenge C;
			C.Id = FName(*O->GetStringField(TEXT("id")));
			C.Stat = FName(*O->GetStringField(TEXT("stat")));
			C.Description = FText::FromString(O->GetStringField(TEXT("text")));
			C.Target = O->GetIntegerField(TEXT("target"));
			C.Progress = O->GetIntegerField(TEXT("progress"));
			C.XpReward = O->GetIntegerField(TEXT("xp"));
			C.bWeekly = O->GetBoolField(TEXT("weekly"));
			C.bCompleted = O->GetBoolField(TEXT("completed"));
			Profile->Challenges.Add(C);
		}
	}
	Save();
}

void UBRProgressionSubsystem::PushLoadoutToBackend()
{
	if (!IsBackendAuthoritative()) { return; }
	TWeakObjectPtr<UBRProgressionSubsystem> WeakThis = this;
	GetGameInstance()->GetSubsystem<UBRBackendClient>()->SaveLoadout(Profile->Loadout, FBRBackendResponse::CreateLambda([WeakThis](bool bOk, int32 Status, TSharedPtr<FJsonObject> Json)
	{
		if (WeakThis.IsValid()) { WeakThis->HandleBackendReply(bOk, Status, Json, FText::GetEmpty()); }
	}));
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
	PushLoadoutToBackend();
	return true;
}

void UBRProgressionSubsystem::SetCustomization(uint8 BodyType, uint8 BodyStyle, uint8 HairStyle, uint8 HeadGear, uint8 ColorVariant)
{
	FBRCosmeticLoadout& L = Profile->Loadout;
	L.BodyType = BodyType; L.BodyStyle = BodyStyle; L.HairStyle = HairStyle; L.HeadGear = HeadGear; L.ColorVariant = ColorVariant;
	L = UBRCosmeticCatalog::Sanitize(L);
	Save();
	PushLoadoutToBackend();
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
	if (IsBackendAuthoritative())
	{
		TWeakObjectPtr<UBRProgressionSubsystem> WeakThis = this;
		const FText Done = FText::Format(NSLOCTEXT("BRProgression", "Bought", "{0} adquirido!"), D->Name);
		GetGameInstance()->GetSubsystem<UBRBackendClient>()->Purchase(CosmeticId, FBRBackendResponse::CreateLambda([WeakThis, Done](bool bOk, int32 Status, TSharedPtr<FJsonObject> Json)
		{
			if (WeakThis.IsValid()) { WeakThis->HandleBackendReply(bOk, Status, Json, Done); }
		}));
		return EBRPurchaseResult::Pending;
	}
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
	if (!Profile || Profile->bPremiumPass) { return false; }
	if (IsBackendAuthoritative())
	{
		TWeakObjectPtr<UBRProgressionSubsystem> WeakThis = this;
		GetGameInstance()->GetSubsystem<UBRBackendClient>()->BuyPremiumPass(FBRBackendResponse::CreateLambda([WeakThis](bool bOk, int32 Status, TSharedPtr<FJsonObject> Json)
		{
			if (WeakThis.IsValid()) { WeakThis->HandleBackendReply(bOk, Status, Json, NSLOCTEXT("BRProgression", "PassOk", "Passe premium desbloqueado!")); }
		}));
		return true; // request sent; the result arrives through OnBackendMessage / OnProfileChanged
	}
	if (Profile->Coins < PremiumPassPrice) { return false; }
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
	if (IsBackendAuthoritative())
	{
		TWeakObjectPtr<UBRProgressionSubsystem> WeakThis = this;
		GetGameInstance()->GetSubsystem<UBRBackendClient>()->ClaimTier(Tier, bPremium, FBRBackendResponse::CreateLambda([WeakThis](bool bOk, int32 Status, TSharedPtr<FJsonObject> Json)
		{
			if (WeakThis.IsValid()) { WeakThis->HandleBackendReply(bOk, Status, Json, NSLOCTEXT("BRProgression", "Claimed", "Recompensa resgatada!")); }
		}));
		return true;
	}
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
	static_assert(UE_ARRAY_COUNT(GTemplates) == BRRules::ChallengeTemplateCount, "Challenge templates must match the rules (and the backend).");
	const FDateTime Now = FDateTime::UtcNow();
	const int32 Week = (Now.GetDayOfYear() - 1) / 7;
	const FString Daily = Now.ToString(TEXT("%Y-%m-%d"));
	const FString Weekly = FString::Printf(TEXT("%d-W%d"), Now.GetYear(), Week);
	auto Fill = [this](uint32 Seed, int32 Count, bool bWeekly)
	{
		int Picks[BRRules::ChallengeTemplateCount];
		const int N = BRRules::PickChallenges(Seed, Count, Picks);
		for (int32 I = 0; I < N; ++I)
		{
			const FChallengeTemplate& T = GTemplates[Picks[I]];
			FBRChallenge C;
			C.Id = FName(*FString::Printf(TEXT("%s_%s"), bWeekly ? TEXT("W") : TEXT("D"), T.Id));
			C.Stat = T.Stat;
			C.Target = bWeekly ? T.Weekly : T.Daily;
			C.XpReward = bWeekly ? 12000 : 3000;
			C.bWeekly = bWeekly;
			C.Description = FText::Format(FText::FromString(T.Text), FText::AsNumber(C.Target));
			Profile->Challenges.Add(C);
		}
	};
	if (Profile->DailyKey != Daily)
	{
		Profile->Challenges.RemoveAll([](const FBRChallenge& C) { return !C.bWeekly; });
		Fill(BRRules::DailyChallengeSeed(Now.GetYear(), Now.GetMonth(), Now.GetDay()), BRRules::DailyChallengeCount, false);
		Profile->DailyKey = Daily;
	}
	if (Profile->WeeklyKey != Weekly)
	{
		Profile->Challenges.RemoveAll([](const FBRChallenge& C) { return C.bWeekly; });
		Fill(BRRules::WeeklyChallengeSeed(Now.GetYear(), Week), BRRules::WeeklyChallengeCount, true);
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
	// With a backend, stats and challenges are only counted from server-signed match results.
	if (!Profile || Amount <= 0 || IsBackendAuthoritative()) { return; }
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
	if (IsBackendAuthoritative())
	{
		// The dedicated server already posted this result to the backend: just refresh.
		FTimerHandle H;
		GetGameInstance()->GetTimerManager().SetTimer(H, FTimerDelegate::CreateUObject(this, &UBRProgressionSubsystem::RefreshFromBackend), 3.f, false);
		return;
	}
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
