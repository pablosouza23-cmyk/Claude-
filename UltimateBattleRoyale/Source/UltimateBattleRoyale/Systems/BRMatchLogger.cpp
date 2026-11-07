#include "Systems/BRMatchLogger.h"

#include "Dom/JsonObject.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

void UBRMatchLogger::BeginMatch(const FString& InMatchId)
{
	if (GetWorld() && GetWorld()->GetNetMode() == NM_Client) { return; }
	MatchId = InMatchId;
	bActive = true;
	LogEvent(TEXT("match_begin"), { { TEXT("match"), MatchId } });
}

FString UBRMatchLogger::GetLogPath() const
{
	return FPaths::ProjectSavedDir() / TEXT("MatchLogs") / (MatchId + TEXT(".jsonl"));
}

void UBRMatchLogger::LogEvent(const FString& Type, const TMap<FString, FString>& Fields)
{
	if (!bActive) { return; }
	TSharedRef<FJsonObject> Obj = MakeShared<FJsonObject>();
	Obj->SetStringField(TEXT("type"), Type);
	Obj->SetStringField(TEXT("utc"), FDateTime::UtcNow().ToIso8601());
	Obj->SetNumberField(TEXT("t"), GetWorld() ? GetWorld()->GetTimeSeconds() : 0.0);
	for (const TPair<FString, FString>& F : Fields) { Obj->SetStringField(F.Key, F.Value); }
	FString Line;
	TSharedRef<TJsonWriter<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>> Writer = TJsonWriterFactory<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>::Create(&Line);
	FJsonSerializer::Serialize(Obj, Writer);
	Pending.Add(Line);
	if (Pending.Num() >= 32) { Flush(); }
}

void UBRMatchLogger::Flush()
{
	if (Pending.Num() == 0 || MatchId.IsEmpty()) { return; }
	FString Text = FString::Join(Pending, TEXT("\n")) + TEXT("\n");
	FFileHelper::SaveStringToFile(Text, *GetLogPath(), FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM, &IFileManager::Get(), FILEWRITE_Append);
	Pending.Reset();
}

void UBRMatchLogger::Deinitialize()
{
	Flush();
	Super::Deinitialize();
}
