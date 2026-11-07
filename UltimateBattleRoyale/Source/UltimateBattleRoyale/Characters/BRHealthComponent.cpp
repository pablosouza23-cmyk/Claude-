#include "Characters/BRHealthComponent.h"

#include "Characters/BRCharacter.h"
#include "GameModes/BRGameMode.h"
#include "Net/UnrealNetwork.h"

UBRHealthComponent::UBRHealthComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.25f;
	SetIsReplicatedByDefault(true);
}

void UBRHealthComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(UBRHealthComponent, Health);
	DOREPLIFETIME(UBRHealthComponent, Shield);
	DOREPLIFETIME(UBRHealthComponent, DownedHealth);
	DOREPLIFETIME(UBRHealthComponent, LifeState);
	DOREPLIFETIME(UBRHealthComponent, bInvulnerable);
}

void UBRHealthComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	if (GetOwnerRole() != ROLE_Authority || LifeState != EBRLifeState::Downed) { return; }

	DownedHealth = float(BRRules::BleedOut(DownedHealth, DeltaTime, BleedOutPerSecond));
	if (DownedHealth <= 0.f)
	{
		SetLifeState(EBRLifeState::Eliminated, LastDamager.Get(), nullptr, false);
	}
}

float UBRHealthComponent::ApplyDamage(float Damage, AController* InstigatorController, AActor* Causer, bool bIgnoreShield, bool bHeadshot)
{
	if (GetOwnerRole() != ROLE_Authority || Damage <= 0.f || bInvulnerable || LifeState == EBRLifeState::Eliminated)
	{
		return 0.f;
	}

	if (InstigatorController && InstigatorController->GetPawn() != GetOwner())
	{
		LastDamager = InstigatorController;
		LastDamageTime = GetWorld()->GetTimeSeconds();
	}

	if (LifeState == EBRLifeState::Downed)
	{
		const float Before = DownedHealth;
		DownedHealth = FMath::Max(0.f, DownedHealth - Damage);
		if (DownedHealth <= 0.f)
		{
			SetLifeState(EBRLifeState::Eliminated, InstigatorController, Causer, bHeadshot);
		}
		return Before - DownedHealth;
	}

	const float OldHealth = Health, OldShield = Shield;
	const BRRules::DamageApplication R = BRRules::ApplyDamage(Health, Shield, Damage, bIgnoreShield);
	Health = float(R.NewHealth);
	Shield = float(R.NewShield);
	OnRep_Health(OldHealth);
	OnRep_Shield(OldShield);

	if (R.bHealthDepleted)
	{
		ABRGameMode* GM = GetWorld()->GetAuthGameMode<ABRGameMode>();
		ABRCharacter* Char = Cast<ABRCharacter>(GetOwner());
		const bool bCanBeDowned = GM && Char && GM->ShouldDownInsteadOfEliminate(Char);
		SetLifeState(bCanBeDowned ? EBRLifeState::Downed : EBRLifeState::Eliminated, InstigatorController, Causer, bHeadshot);
	}
	return float(R.AbsorbedByShield + R.AppliedToHealth);
}

void UBRHealthComponent::Heal(float Amount, float Cap)
{
	if (GetOwnerRole() != ROLE_Authority || LifeState != EBRLifeState::Alive) { return; }
	const float Old = Health;
	Health = float(BRRules::ApplyHeal(Health, Amount, FMath::Min(Cap, MaxHealth)));
	OnRep_Health(Old);
}

void UBRHealthComponent::AddShield(float Amount, float Cap)
{
	if (GetOwnerRole() != ROLE_Authority || LifeState != EBRLifeState::Alive) { return; }
	const float Old = Shield;
	Shield = float(BRRules::ApplyHeal(Shield, Amount, FMath::Min(Cap, MaxShield)));
	OnRep_Shield(Old);
}

void UBRHealthComponent::Revive(float HealthAfterRevive)
{
	if (GetOwnerRole() != ROLE_Authority || LifeState != EBRLifeState::Downed) { return; }
	const float Old = Health;
	Health = HealthAfterRevive;
	Shield = 0.f;
	DownedHealth = 0.f;
	OnRep_Health(Old);
	SetLifeState(EBRLifeState::Alive, nullptr, nullptr, false);
}

void UBRHealthComponent::ResetToFull()
{
	if (GetOwnerRole() != ROLE_Authority) { return; }
	const float OldH = Health, OldS = Shield;
	Health = MaxHealth;
	Shield = 0.f;
	DownedHealth = 0.f;
	LifeState = EBRLifeState::Alive;
	OnRep_Health(OldH);
	OnRep_Shield(OldS);
	OnRep_LifeState();
}

void UBRHealthComponent::Kill(AController* InstigatorController, AActor* Causer)
{
	if (GetOwnerRole() != ROLE_Authority || LifeState == EBRLifeState::Eliminated) { return; }
	const float Old = Health;
	Health = 0.f;
	OnRep_Health(Old);
	SetLifeState(EBRLifeState::Eliminated, InstigatorController, Causer, false);
}

void UBRHealthComponent::SetLifeState(EBRLifeState NewState, AController* InstigatorController, AActor* Causer, bool bHeadshot)
{
	if (LifeState == NewState) { return; }
	LifeState = NewState;
	if (NewState == EBRLifeState::Downed) { DownedHealth = MaxDownedHealth; Shield = 0.f; }
	OnRep_LifeState();

	if (ABRGameMode* GM = GetWorld()->GetAuthGameMode<ABRGameMode>())
	{
		if (ABRCharacter* Char = Cast<ABRCharacter>(GetOwner()))
		{
			// Storm/fall deaths credit the last player who damaged us within 15s.
			AController* Credit = InstigatorController;
			if ((!Credit || Credit->GetPawn() == Char) && LastDamager.IsValid() && GetWorld()->GetTimeSeconds() - LastDamageTime < 15.f)
			{
				Credit = LastDamager.Get();
			}
			if (NewState == EBRLifeState::Downed) { GM->OnCharacterDowned(Char, Credit, Causer); }
			else if (NewState == EBRLifeState::Eliminated) { GM->OnCharacterEliminated(Char, Credit, Causer, bHeadshot); }
		}
	}
}

void UBRHealthComponent::OnRep_Health(float OldHealth)
{
	OnHealthChanged.Broadcast(Health, Shield, Health - OldHealth);
}

void UBRHealthComponent::OnRep_Shield(float OldShield)
{
	OnHealthChanged.Broadcast(Health, Shield, Shield - OldShield);
}

void UBRHealthComponent::OnRep_LifeState()
{
	OnLifeStateChanged.Broadcast(LifeState);
	if (ABRCharacter* Char = Cast<ABRCharacter>(GetOwner()))
	{
		Char->OnLifeStateChanged(LifeState);
	}
}
