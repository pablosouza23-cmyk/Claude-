#include "Multiplayer/BRBackendClient.h"

#include "Core/BRSettings.h"
#include "Dom/JsonObject.h"
#include "Engine/LocalPlayer.h"
#include "GameModes/BRModeRules.h"
#include "GenericPlatform/GenericPlatformHttp.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Interfaces/OnlineIdentityInterface.h"
#include "Misc/CommandLine.h"
#include "Misc/SecureHash.h"
#include "OnlineSubsystem.h"
#include "OnlineSubsystemUtils.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "UltimateBattleRoyale.h"

void UBRBackendClient::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	BaseUrl = UBRSettings::Get()->ProfileBackendUrl;
	BaseUrl.RemoveFromEnd(TEXT("/"));
	FString CmdUrl;
	if (FParse::Value(FCommandLine::Get(), TEXT("BRBackend="), CmdUrl)) { BaseUrl = CmdUrl; }
	// The server secret only exists on dedicated servers (environment / command line), never in client config.
	ServerSecret = FPlatformMisc::GetEnvironmentVariable(TEXT("BR_SERVER_SECRET"));
	FParse::Value(FCommandLine::Get(), TEXT("BRServerSecret="), ServerSecret);
	if (IsEnabled()) { UE_LOG(LogBR, Log, TEXT("Profile backend: %s (server mode: %s)"), *BaseUrl, CanActAsServer() ? TEXT("yes") : TEXT("no")); }
}

FString UBRBackendClient::SanitizePlayerId(const FString& Raw)
{
	FString Out;
	for (const TCHAR C : Raw.Left(96))
	{
		const bool bOk = FChar::IsAlnum(C) || C == TEXT('_') || C == TEXT('-') || C == TEXT(':') || C == TEXT('|') || C == TEXT('.');
		Out.AppendChar(bOk ? C : TEXT('_'));
	}
	return Out.IsEmpty() ? FString(TEXT("anon")) : Out;
}

FString UBRBackendClient::PlayerToken() const
{
	IOnlineSubsystem* OSS = Online::GetSubsystem(GetWorld());
	if (!UBRSettings::Get()->bBackendDevAuth && OSS && OSS->GetIdentityInterface())
	{
		return OSS->GetIdentityInterface()->GetAuthToken(0);
	}
	const ULocalPlayer* LP = GetGameInstance() ? GetGameInstance()->GetFirstGamePlayer() : nullptr;
	const FUniqueNetIdRepl Id = LP ? LP->GetPreferredUniqueNetId() : FUniqueNetIdRepl();
	return TEXT("dev:") + SanitizePlayerId(Id.IsValid() ? Id->ToString() : FString(TEXT("anon")));
}

FString UBRBackendClient::SignRequest(const FString& Secret, const FString& Verb, const FString& Path, const FString& Timestamp, const TArray<uint8>& Body)
{
	// Must match Backend/brbackend/auth.py::sign  (HMAC-SHA1 over "VERB\nPATH\nTIMESTAMP\nBODY").
	TArray<uint8> Msg;
	const FTCHARToUTF8 Head(*(Verb.ToUpper() + TEXT("\n") + Path + TEXT("\n") + Timestamp + TEXT("\n")));
	Msg.Append(reinterpret_cast<const uint8*>(Head.Get()), Head.Length());
	Msg.Append(Body);
	const FTCHARToUTF8 Key(*Secret);
	uint8 Hash[FSHA1::DigestSize];
	FSHA1::HMACBuffer(Key.Get(), Key.Length(), Msg.GetData(), Msg.Num(), Hash);
	return BytesToHex(Hash, FSHA1::DigestSize).ToLower();
}

void UBRBackendClient::Send(const FString& Verb, const FString& Path, const TSharedPtr<FJsonObject>& Body, bool bAsServer, FBRBackendResponse Done)
{
	if (!IsEnabled() || (bAsServer && !CanActAsServer()))
	{
		Done.ExecuteIfBound(false, 0, nullptr);
		return;
	}
	FString BodyText;
	if (Body.IsValid())
	{
		TSharedRef<TJsonWriter<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>> W = TJsonWriterFactory<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>::Create(&BodyText);
		FJsonSerializer::Serialize(Body.ToSharedRef(), W);
	}
	const FTCHARToUTF8 Utf8(*BodyText);
	TArray<uint8> Bytes;
	Bytes.Append(reinterpret_cast<const uint8*>(Utf8.Get()), Utf8.Length());

	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req = FHttpModule::Get().CreateRequest();
	Req->SetURL(BaseUrl + Path);
	Req->SetVerb(Verb);
	Req->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Req->SetTimeout(10.f);
	if (bAsServer)
	{
		const FString Stamp = FString::Printf(TEXT("%lld"), FDateTime::UtcNow().ToUnixTimestamp());
		FString PathOnly = Path;
		int32 Q;
		if (PathOnly.FindChar(TEXT('?'), Q)) { PathOnly = PathOnly.Left(Q); }
		Req->SetHeader(TEXT("X-BR-Timestamp"), Stamp);
		Req->SetHeader(TEXT("X-BR-Signature"), SignRequest(ServerSecret, Verb, PathOnly, Stamp, Bytes));
	}
	else
	{
		Req->SetHeader(TEXT("Authorization"), TEXT("Bearer ") + PlayerToken());
	}
	if (Bytes.Num() > 0 || Verb != TEXT("GET")) { Req->SetContent(Bytes); }
	Req->OnProcessRequestComplete().BindWeakLambda(this, [Done](FHttpRequestPtr, FHttpResponsePtr Resp, bool bConnected)
	{
		TSharedPtr<FJsonObject> Json;
		const int32 Code = Resp.IsValid() ? Resp->GetResponseCode() : 0;
		if (Resp.IsValid())
		{
			TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Resp->GetContentAsString());
			FJsonSerializer::Deserialize(Reader, Json);
		}
		Done.ExecuteIfBound(bConnected && Code >= 200 && Code < 300, Code, Json);
	});
	Req->ProcessRequest();
}

// ------------------------------------------------------------------------------------- player
void UBRBackendClient::FetchProfile(FBRBackendResponse Done) { Send(TEXT("GET"), TEXT("/v1/profile"), nullptr, false, Done); }

void UBRBackendClient::Purchase(FName ItemId, FBRBackendResponse Done)
{
	TSharedPtr<FJsonObject> B = MakeShared<FJsonObject>();
	B->SetStringField(TEXT("itemId"), ItemId.ToString());
	Send(TEXT("POST"), TEXT("/v1/shop/purchase"), B, false, Done);
}

void UBRBackendClient::BuyPremiumPass(FBRBackendResponse Done) { Send(TEXT("POST"), TEXT("/v1/pass/buy"), MakeShared<FJsonObject>(), false, Done); }

void UBRBackendClient::ClaimTier(int32 Tier, bool bPremium, FBRBackendResponse Done)
{
	TSharedPtr<FJsonObject> B = MakeShared<FJsonObject>();
	B->SetNumberField(TEXT("tier"), Tier);
	B->SetBoolField(TEXT("premium"), bPremium);
	Send(TEXT("POST"), TEXT("/v1/pass/claim"), B, false, Done);
}

void UBRBackendClient::SaveLoadout(const FBRCosmeticLoadout& Loadout, FBRBackendResponse Done)
{
	Send(TEXT("PUT"), TEXT("/v1/loadout"), LoadoutToJson(Loadout), false, Done);
}

// ------------------------------------------------------------------------------------- server
void UBRBackendClient::PostMatchResults(const FString& MatchId, EBRGameModeType Mode, bool bCountsForProgression, const TArray<FBRBackendMatchEntry>& Entries)
{
	if (!CanActAsServer() || Entries.Num() == 0) { return; }
	TSharedPtr<FJsonObject> B = MakeShared<FJsonObject>();
	B->SetStringField(TEXT("matchId"), MatchId);
	B->SetStringField(TEXT("mode"), FBRModeRules::ModeToString(Mode));
	B->SetBoolField(TEXT("countsForProgression"), bCountsForProgression);
	TArray<TSharedPtr<FJsonValue>> Players;
	for (const FBRBackendMatchEntry& E : Entries)
	{
		TSharedPtr<FJsonObject> P = MakeShared<FJsonObject>();
		P->SetStringField(TEXT("playerId"), SanitizePlayerId(E.PlayerId));
		P->SetNumberField(TEXT("placement"), E.Result.Placement);
		P->SetNumberField(TEXT("totalTeams"), E.Result.TotalTeams);
		P->SetNumberField(TEXT("eliminations"), E.Result.Eliminations);
		P->SetNumberField(TEXT("revives"), E.Result.Revives);
		P->SetNumberField(TEXT("chestsOpened"), E.Result.ChestsOpened);
		P->SetNumberField(TEXT("damageDealt"), E.Result.DamageDealt);
		P->SetNumberField(TEXT("secondsSurvived"), E.Result.SecondsSurvived);
		Players.Add(MakeShared<FJsonValueObject>(P));
	}
	B->SetArrayField(TEXT("players"), Players);
	// Results are idempotent per (match, player) on the backend, so a retry is always safe.
	TWeakObjectPtr<UBRBackendClient> WeakThis = this;
	Send(TEXT("POST"), TEXT("/v1/server/match-result"), B, true, FBRBackendResponse::CreateLambda([WeakThis, B](bool bOk, int32 Code, TSharedPtr<FJsonObject>)
	{
		if (bOk || !WeakThis.IsValid()) { return; }
		UE_LOG(LogBR, Warning, TEXT("Match result post failed (%d), retrying once."), Code);
		WeakThis->Send(TEXT("POST"), TEXT("/v1/server/match-result"), B, true, FBRBackendResponse());
	}));
}

void UBRBackendClient::FetchVerifiedLoadout(const FString& PlayerId, FBRBackendResponse Done)
{
	Send(TEXT("GET"), TEXT("/v1/server/loadout?player=") + FGenericPlatformHttp::UrlEncode(SanitizePlayerId(PlayerId)), nullptr, true, Done);
}

// ------------------------------------------------------------------------------------- json helpers
FBRCosmeticLoadout UBRBackendClient::LoadoutFromJson(const TSharedPtr<FJsonObject>& J)
{
	FBRCosmeticLoadout L;
	if (!J.IsValid()) { return L; }
	L.Outfit = FName(*J->GetStringField(TEXT("outfit")));
	L.Backpack = FName(*J->GetStringField(TEXT("backpack")));
	L.Pickaxe = FName(*J->GetStringField(TEXT("pickaxe")));
	L.Glider = FName(*J->GetStringField(TEXT("glider")));
	L.Emotes.Reset();
	const TArray<TSharedPtr<FJsonValue>>* Emotes = nullptr;
	if (J->TryGetArrayField(TEXT("emotes"), Emotes))
	{
		for (const TSharedPtr<FJsonValue>& E : *Emotes) { L.Emotes.Add(FName(*E->AsString())); }
	}
	L.BodyType = uint8(J->GetIntegerField(TEXT("bodyType")));
	L.BodyStyle = uint8(J->GetIntegerField(TEXT("bodyStyle")));
	L.HairStyle = uint8(J->GetIntegerField(TEXT("hairStyle")));
	L.HeadGear = uint8(J->GetIntegerField(TEXT("headGear")));
	L.ColorVariant = uint8(J->GetIntegerField(TEXT("colorVariant")));
	return L;
}

TSharedRef<FJsonObject> UBRBackendClient::LoadoutToJson(const FBRCosmeticLoadout& L)
{
	TSharedRef<FJsonObject> J = MakeShared<FJsonObject>();
	J->SetStringField(TEXT("outfit"), L.Outfit.ToString());
	J->SetStringField(TEXT("backpack"), L.Backpack.ToString());
	J->SetStringField(TEXT("pickaxe"), L.Pickaxe.ToString());
	J->SetStringField(TEXT("glider"), L.Glider.ToString());
	TArray<TSharedPtr<FJsonValue>> Emotes;
	for (const FName& E : L.Emotes) { Emotes.Add(MakeShared<FJsonValueString>(E.ToString())); }
	J->SetArrayField(TEXT("emotes"), Emotes);
	J->SetNumberField(TEXT("bodyType"), L.BodyType);
	J->SetNumberField(TEXT("bodyStyle"), L.BodyStyle);
	J->SetNumberField(TEXT("hairStyle"), L.HairStyle);
	J->SetNumberField(TEXT("headGear"), L.HeadGear);
	J->SetNumberField(TEXT("colorVariant"), L.ColorVariant);
	return J;
}
