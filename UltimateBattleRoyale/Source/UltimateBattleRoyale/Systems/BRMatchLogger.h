#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "BRMatchLogger.generated.h"

// Server-side match log (JSON lines in Saved/MatchLogs/<MatchId>.jsonl): joins, kills,
// damage summaries, anti-cheat flags, player reports, chat (for moderation), results.
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRMatchLogger : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual void Deinitialize() override;

	void BeginMatch(const FString& InMatchId);
	void LogEvent(const FString& Type, const TMap<FString, FString>& Fields);
	void Flush();
	const FString& GetMatchId() const { return MatchId; }
	FString GetLogPath() const;

private:
	FString MatchId;
	TArray<FString> Pending;
	bool bActive = false;
};
