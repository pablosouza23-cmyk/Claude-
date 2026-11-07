#include "GameModes/BRPlayerState.h"

#include "Characters/BRCharacter.h"
#include "Net/UnrealNetwork.h"
#include "Progression/BRCosmetics.h"

ABRPlayerState::ABRPlayerState()
{
	NetUpdateFrequency = 4.f;
	Cosmetics = UBRCosmeticCatalog::DefaultLoadout();
}

void ABRPlayerState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRPlayerState, TeamId);
	DOREPLIFETIME(ABRPlayerState, Kills);
	DOREPLIFETIME(ABRPlayerState, Placement);
	DOREPLIFETIME(ABRPlayerState, Revives);
	DOREPLIFETIME_CONDITION(ABRPlayerState, ChestsOpened, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(ABRPlayerState, DamageDealt, COND_OwnerOnly);
	DOREPLIFETIME(ABRPlayerState, bEliminated);
	DOREPLIFETIME(ABRPlayerState, bOnBus);
	DOREPLIFETIME(ABRPlayerState, AccountLevel);
	DOREPLIFETIME(ABRPlayerState, Cosmetics);
}

void ABRPlayerState::CopyProperties(APlayerState* PlayerState)
{
	Super::CopyProperties(PlayerState);
	if (ABRPlayerState* Other = Cast<ABRPlayerState>(PlayerState))
	{
		Other->Cosmetics = Cosmetics;
		Other->PartyId = PartyId;
		Other->AccountLevel = AccountLevel;
	}
}

void ABRPlayerState::SetCosmetics(const FBRCosmeticLoadout& In)
{
	Cosmetics = UBRCosmeticCatalog::Sanitize(In);
	OnRep_Cosmetics();
}

void ABRPlayerState::OnRep_Cosmetics()
{
	if (ABRCharacter* C = GetPawn<ABRCharacter>()) { C->ApplyCosmetics(); }
}

void ABRPlayerState::ResetForMatch(double Now)
{
	Kills = Placement = Revives = ChestsOpened = 0;
	DamageDealt = 0.f;
	bEliminated = false;
	MatchStartTime = Now;
}
