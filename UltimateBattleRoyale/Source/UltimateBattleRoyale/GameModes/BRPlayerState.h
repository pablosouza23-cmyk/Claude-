#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerState.h"
#include "Core/BRTypes.h"
#include "BRPlayerState.generated.h"

UCLASS()
class ULTIMATEBATTLEROYALE_API ABRPlayerState : public APlayerState
{
	GENERATED_BODY()

public:
	ABRPlayerState();
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void CopyProperties(APlayerState* PlayerState) override;

	int32 GetTeamId() const { return TeamId; }
	int32 GetKills() const { return Kills; }
	int32 GetPlacement() const { return Placement; }
	int32 GetRevives() const { return Revives; }
	int32 GetChestsOpened() const { return ChestsOpened; }
	int32 GetDamageDealt() const { return FMath::RoundToInt(DamageDealt); }
	bool IsEliminatedFromMatch() const { return bEliminated; }
	bool IsOnBus() const { return bOnBus; }
	int32 GetAccountLevel() const { return AccountLevel; }
	const FBRCosmeticLoadout& GetCosmetics() const { return Cosmetics; }
	const FString& GetPartyId() const { return PartyId; }
	float GetSurvivalSeconds(double Now) const { return float(Now - MatchStartTime); }

	// Server
	void SetTeamId(int32 In) { TeamId = In; }
	void SetPartyId(const FString& In) { PartyId = In; }
	void AddKill() { ++Kills; }
	void AddRevive() { ++Revives; }
	void AddChestOpened() { ++ChestsOpened; }
	void AddDamageDealt(float Amount) { DamageDealt += Amount; }
	void SetEliminated(int32 InPlacement) { bEliminated = true; Placement = InPlacement; }
	void SetPlacement(int32 InPlacement) { Placement = InPlacement; }
	void SetOnBus(bool bIn) { bOnBus = bIn; }
	void SetCosmetics(const FBRCosmeticLoadout& In);
	void SetAccountLevel(int32 Level) { AccountLevel = FMath::Clamp(Level, 1, BRRules::MaxAccountLevel); }
	void ResetForMatch(double Now);

protected:
	UFUNCTION() void OnRep_Cosmetics();

private:
	UPROPERTY(Replicated) int32 TeamId = INDEX_NONE;
	UPROPERTY(Replicated) int32 Kills = 0;
	UPROPERTY(Replicated) int32 Placement = 0;
	UPROPERTY(Replicated) int32 Revives = 0;
	UPROPERTY(Replicated) int32 ChestsOpened = 0;
	UPROPERTY(Replicated) float DamageDealt = 0.f;
	UPROPERTY(Replicated) bool bEliminated = false;
	UPROPERTY(Replicated) bool bOnBus = false;
	UPROPERTY(Replicated) int32 AccountLevel = 1;
	UPROPERTY(ReplicatedUsing = OnRep_Cosmetics) FBRCosmeticLoadout Cosmetics;
	FString PartyId;
	double MatchStartTime = 0.0;
};
