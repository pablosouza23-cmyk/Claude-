#include "Inventory/BRInventoryComponent.h"

#include "Characters/BRCharacter.h"
#include "Characters/BRHealthComponent.h"
#include "GameModes/BRPlayerController.h"
#include "Items/BRItemRegistry.h"
#include "Items/BRLootSubsystem.h"
#include "Net/UnrealNetwork.h"
#include "Systems/BRLaunchPad.h"
#include "TimerManager.h"
#include "Weapons/BRWeapon.h"
#include "Audio/BRProceduralAudio.h"

UBRInventoryComponent::UBRInventoryComponent()
{
	SetIsReplicatedByDefault(true);
	Slots.SetNum(NumSlots);
	Ammo.Init(0, int32(EBRAmmoType::MAX));
	Materials.Init(0, int32(EBRBuildMaterial::MAX));
}

void UBRInventoryComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME_CONDITION(UBRInventoryComponent, Slots, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UBRInventoryComponent, Ammo, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UBRInventoryComponent, Materials, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UBRInventoryComponent, bBackpack, COND_OwnerOnly);
	DOREPLIFETIME(UBRInventoryComponent, ActiveSlot);
	DOREPLIFETIME(UBRInventoryComponent, UseStartTime);
	DOREPLIFETIME(UBRInventoryComponent, UseEndTime);
}

ABRCharacter* UBRInventoryComponent::GetCharacter() const { return Cast<ABRCharacter>(GetOwner()); }
bool UBRInventoryComponent::IsServer() const { return GetOwner() == nullptr || GetOwnerRole() == ROLE_Authority; }

const FBRItemStack& UBRInventoryComponent::GetSlot(int32 Index) const
{
	static const FBRItemStack Empty;
	return Slots.IsValidIndex(Index) ? Slots[Index] : Empty;
}

int32 UBRInventoryComponent::GetAmmo(EBRAmmoType Type) const
{
	const int32 I = int32(Type);
	return Ammo.IsValidIndex(I) ? Ammo[I] : 0;
}

int32 UBRInventoryComponent::GetMaterial(EBRBuildMaterial Mat) const
{
	if (bInfinite) { return BRRules::MaxBuildMaterial; }
	const int32 I = int32(Mat);
	return Materials.IsValidIndex(I) ? Materials[I] : 0;
}

int32 UBRInventoryComponent::GetAmmoCapacity(EBRAmmoType Type) const
{
	const int32 Base = BRRules::MaxAmmoForType(int32(Type));
	return bBackpack ? FMath::Min(999, Base + Base / 2) : Base;
}

bool UBRInventoryComponent::IsUsingConsumable() const
{
	const UWorld* W = GetWorld();
	return W && UseEndTime > 0.f && W->GetTimeSeconds() < UseEndTime + 0.05f && UseEndTime > UseStartTime;
}

float UBRInventoryComponent::GetUseProgress() const
{
	if (!IsUsingConsumable()) { return 0.f; }
	return FMath::Clamp((GetWorld()->GetTimeSeconds() - UseStartTime) / FMath::Max(0.01f, UseEndTime - UseStartTime), 0.f, 1.f);
}

int32 UBRInventoryComponent::FindFreeSlot() const
{
	for (int32 I = 0; I < Slots.Num(); ++I) { if (Slots[I].IsEmpty()) { return I; } }
	return INDEX_NONE;
}

void UBRInventoryComponent::Changed()
{
	OnInventoryChanged.Broadcast();
}

void UBRInventoryComponent::OnRep_Inventory() { Changed(); }
void UBRInventoryComponent::OnRep_ActiveSlot() { Changed(); }

bool UBRInventoryComponent::CheckRate() const
{
	const ABRCharacter* C = GetCharacter();
	ABRPlayerController* PC = C ? Cast<ABRPlayerController>(C->GetController()) : nullptr;
	return !PC || PC->ConsumeRpcToken(EBRRpcBucket::Inventory);
}

// ------------------------------------------------------------------------------------- requests
void UBRInventoryComponent::RequestEquip(int32 SlotIndex) { if (IsServer()) { EquipSlotServer(SlotIndex); } else { ServerEquip(SlotIndex); } }
void UBRInventoryComponent::RequestDropActive() { if (ActiveSlot >= 0) { RequestDropSlot(ActiveSlot); } }
void UBRInventoryComponent::RequestDropSlot(int32 SlotIndex) { if (IsServer()) { DropSlotServer(SlotIndex); } else { ServerDropSlot(SlotIndex); } }
void UBRInventoryComponent::RequestSwap(int32 A, int32 B) { if (IsServer()) { ServerSwap_Implementation(A, B); } else { ServerSwap(A, B); } }
void UBRInventoryComponent::RequestUseActive() { if (IsServer()) { ServerUseActive_Implementation(); } else { ServerUseActive(); } }
void UBRInventoryComponent::RequestDropMaterial(EBRBuildMaterial Mat, int32 Amount) { if (IsServer()) { ServerDropMaterial_Implementation(Mat, Amount); } else { ServerDropMaterial(Mat, Amount); } }

void UBRInventoryComponent::ServerEquip_Implementation(int32 SlotIndex) { if (CheckRate()) { EquipSlotServer(SlotIndex); } }
void UBRInventoryComponent::ServerDropSlot_Implementation(int32 SlotIndex) { if (CheckRate()) { DropSlotServer(SlotIndex); } }

void UBRInventoryComponent::ServerSwap_Implementation(int32 A, int32 B)
{
	if (!CheckRate() || !Slots.IsValidIndex(A) || !Slots.IsValidIndex(B) || A == B) { return; }
	SyncActiveWeaponAmmo();
	Slots.Swap(A, B);
	if (ActiveSlot == A || ActiveSlot == B)
	{
		const int32 Keep = ActiveSlot;
		DestroyActiveWeapon();
		ActiveSlot = -1;
		EquipSlotServer(Keep);
	}
	Changed();
}

void UBRInventoryComponent::ServerDropMaterial_Implementation(EBRBuildMaterial Mat, int32 Amount)
{
	if (!CheckRate() || bInfinite) { return; }
	const int32 I = int32(Mat);
	if (!Materials.IsValidIndex(I)) { return; }
	const int32 Taken = BRRules::RemoveFromStack(Materials[I], FMath::Clamp(Amount, 1, BRRules::MaxBuildMaterial));
	if (Taken > 0)
	{
		const UBRItemRegistry* Reg = UBRItemRegistry::Get();
		DropStack(FBRItemStack(Reg->MaterialItemId(Mat), Taken));
		Changed();
	}
}

// ------------------------------------------------------------------------------------- server logic
bool UBRInventoryComponent::AddStack(const FBRItemStack& In, FBRItemStack& OutLeftover, bool bSwapIfFull)
{
	OutLeftover = In;
	if (!IsServer() || In.IsEmpty()) { return false; }
	const UBRItemRegistry* Reg = UBRItemRegistry::Get();
	const UBRItemDefinition* Def = Reg ? Reg->Find(In.ItemId) : nullptr;
	if (!Def) { return false; }

	int32 Remaining = In.Count;
	switch (Def->ItemType)
	{
	case EBRItemType::Ammo:
	{
		const int32 I = int32(Def->AmmoType);
		if (!Ammo.IsValidIndex(I)) { return false; }
		const BRRules::StackResult R = BRRules::AddToStack(Ammo[I], Remaining, GetAmmoCapacity(Def->AmmoType));
		Ammo[I] = R.NewCount; Remaining = R.Overflow;
		break;
	}
	case EBRItemType::Material:
	{
		const int32 I = int32(Def->Material);
		if (!Materials.IsValidIndex(I)) { return false; }
		const BRRules::StackResult R = BRRules::AddToStack(Materials[I], Remaining, BRRules::MaxBuildMaterial);
		Materials[I] = R.NewCount; Remaining = R.Overflow;
		break;
	}
	case EBRItemType::Backpack:
		if (bBackpack) { return false; }
		bBackpack = true;
		Remaining = 0;
		break;
	default:
	{
		// Stack onto existing slots of the same item first (heals, grenades).
		if (Def->MaxStack > 1)
		{
			for (FBRItemStack& S : Slots)
			{
				if (Remaining <= 0) { break; }
				if (S.ItemId == In.ItemId)
				{
					const BRRules::StackResult R = BRRules::AddToStack(S.Count, Remaining, Def->MaxStack);
					S.Count = R.NewCount; Remaining = R.Overflow;
				}
			}
		}
		while (Remaining > 0)
		{
			int32 Free = FindFreeSlot();
			if (Free == INDEX_NONE && bSwapIfFull && ActiveSlot >= 0 && Remaining == In.Count)
			{
				// Swap: drop the item in hand and take the new one in its place.
				SyncActiveWeaponAmmo();
				const int32 Target = ActiveSlot;
				DestroyActiveWeapon();
				DropStack(Slots[Target]);
				Slots[Target].Clear();
				ActiveSlot = -1;
				Free = Target;
			}
			if (Free == INDEX_NONE) { break; }
			const int32 Take = FMath::Min(Remaining, FMath::Max(1, Def->MaxStack));
			Slots[Free] = FBRItemStack(In.ItemId, Take, In.AmmoInMag);
			Remaining -= Take;
			if (ActiveSlot < 0 && Def->ItemType == EBRItemType::Weapon) { EquipSlotServer(Free); }
		}
		break;
	}
	}

	OutLeftover.Count = Remaining;
	if (Remaining <= 0) { OutLeftover.Clear(); }
	const bool bTookAny = Remaining < In.Count;
	if (bTookAny) { Changed(); }
	return bTookAny;
}

bool UBRInventoryComponent::ConsumeAmmo(EBRAmmoType Type, int32 Count)
{
	if (!IsServer()) { return false; }
	if (bInfinite) { return true; }
	const int32 I = int32(Type);
	if (!Ammo.IsValidIndex(I) || Ammo[I] < Count) { return false; }
	Ammo[I] -= Count;
	Changed();
	return true;
}

bool UBRInventoryComponent::ConsumeMaterial(EBRBuildMaterial Mat, int32 Count)
{
	if (!IsServer()) { return false; }
	if (bInfinite) { return true; }
	const int32 I = int32(Mat);
	if (!Materials.IsValidIndex(I) || Materials[I] < Count) { return false; }
	Materials[I] -= Count;
	Changed();
	return true;
}

void UBRInventoryComponent::AddMaterial(EBRBuildMaterial Mat, int32 Count)
{
	if (!IsServer()) { return; }
	const int32 I = int32(Mat);
	if (!Materials.IsValidIndex(I)) { return; }
	Materials[I] = BRRules::AddToStack(Materials[I], Count, BRRules::MaxBuildMaterial).NewCount;
	Changed();
}

void UBRInventoryComponent::ConsumeActiveThrowable()
{
	if (!IsServer() || !Slots.IsValidIndex(ActiveSlot) || bInfinite) { return; }
	FBRItemStack& S = Slots[ActiveSlot];
	if (--S.Count <= 0)
	{
		S.Clear();
		DestroyActiveWeapon();
		ActiveSlot = -1;
	}
	Changed();
}

void UBRInventoryComponent::SyncActiveWeaponAmmo()
{
	ABRCharacter* C = GetCharacter();
	ABRWeapon* W = C ? C->GetCurrentWeapon() : nullptr;
	if (W && Slots.IsValidIndex(ActiveSlot) && Slots[ActiveSlot].ItemId == W->GetItemId())
	{
		const UBRWeaponDefinition* Def = W->GetDefinition();
		if (!Def || !Def->bThrowable) { Slots[ActiveSlot].AmmoInMag = W->GetAmmoInMag(); }
	}
}

void UBRInventoryComponent::DestroyActiveWeapon()
{
	ABRCharacter* C = GetCharacter();
	if (ABRWeapon* W = C ? C->GetCurrentWeapon() : nullptr)
	{
		C->SetCurrentWeapon(nullptr);
		W->Destroy();
	}
}

void UBRInventoryComponent::SpawnWeaponForSlot(int32 SlotIndex)
{
	ABRCharacter* C = GetCharacter();
	const UBRItemRegistry* Reg = UBRItemRegistry::Get();
	if (!C || !Reg || !Slots.IsValidIndex(SlotIndex)) { return; }
	const UBRWeaponDefinition* Def = Reg->FindWeapon(Slots[SlotIndex].ItemId);
	if (!Def) { return; }
	ABRWeapon* W = GetWorld()->SpawnActorDeferred<ABRWeapon>(ABRWeapon::StaticClass(), C->GetActorTransform(), C, C, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
	if (!W) { return; }
	W->InitWeapon(Slots[SlotIndex].ItemId, Slots[SlotIndex].AmmoInMag);
	W->FinishSpawning(C->GetActorTransform());
	C->SetCurrentWeapon(W);
}

void UBRInventoryComponent::EquipSlotServer(int32 SlotIndex)
{
	if (!IsServer()) { return; }
	ABRCharacter* C = GetCharacter();
	if (C && !C->IsAliveAndWell()) { return; }
	SlotIndex = FMath::Clamp(SlotIndex, -1, NumSlots - 1);
	if (SlotIndex >= 0 && Slots[SlotIndex].IsEmpty()) { return; }
	if (SlotIndex == ActiveSlot && (SlotIndex < 0 || (C && C->GetCurrentWeapon()) || !UBRItemRegistry::Get()->FindWeapon(Slots[SlotIndex].ItemId)))
	{
		return;
	}
	CancelUse();
	SyncActiveWeaponAmmo();
	DestroyActiveWeapon();
	ActiveSlot = SlotIndex;
	if (SlotIndex >= 0) { SpawnWeaponForSlot(SlotIndex); }
	Changed();
}

void UBRInventoryComponent::ServerUseActive_Implementation()
{
	if (!CheckRate() || !Slots.IsValidIndex(ActiveSlot) || IsUsingConsumable()) { return; }
	ABRCharacter* C = GetCharacter();
	if (!C || !C->IsAliveAndWell()) { return; }
	const UBRItemRegistry* Reg = UBRItemRegistry::Get();
	const FBRItemStack& S = Slots[ActiveSlot];
	const UBRItemDefinition* Def = Reg ? Reg->Find(S.ItemId) : nullptr;
	if (!Def) { return; }

	if (const UBRConsumableDefinition* Cons = Cast<UBRConsumableDefinition>(Def))
	{
		const UBRHealthComponent* H = C->GetHealth();
		const bool bNeedsHealth = Cons->HealthRestore > 0.f && H->GetHealth() < FMath::Min(Cons->HealthCap, H->GetMaxHealth());
		const bool bNeedsShield = Cons->ShieldRestore > 0.f && H->GetShield() < FMath::Min(Cons->ShieldCap, H->GetMaxShield());
		if (!bNeedsHealth && !bNeedsShield) { return; }
		UsingSlot = ActiveSlot;
		UseStartTime = GetWorld()->GetTimeSeconds();
		UseEndTime = UseStartTime + Cons->UseSeconds;
		GetWorld()->GetTimerManager().SetTimer(UseTimer, this, &UBRInventoryComponent::CompleteUse, Cons->UseSeconds, false);
		UBRProceduralAudio::PlaySfx(C, EBRSfx::Heal, C->GetActorLocation());
		return;
	}

	if (Def->Special == EBRSpecialItem::LaunchPad)
	{
		FHitResult Hit;
		const FVector Start = C->GetActorLocation() + C->GetActorForwardVector() * 200.f;
		FCollisionQueryParams Params(SCENE_QUERY_STAT(BRPadPlace), false, C);
		if (GetWorld()->LineTraceSingleByChannel(Hit, Start + FVector(0, 0, 100), Start - FVector(0, 0, 400), ECC_Visibility, Params))
		{
			FActorSpawnParameters SP;
			SP.Owner = C;
			GetWorld()->SpawnActor<ABRLaunchPad>(ABRLaunchPad::StaticClass(), Hit.ImpactPoint, FRotator::ZeroRotator, SP);
			if (!bInfinite) { Slots[ActiveSlot].Clear(); ActiveSlot = -1; }
			Changed();
		}
	}
}

void UBRInventoryComponent::CompleteUse()
{
	ABRCharacter* C = GetCharacter();
	const UBRItemRegistry* Reg = UBRItemRegistry::Get();
	if (!C || !Reg || !Slots.IsValidIndex(UsingSlot) || UsingSlot != ActiveSlot) { CancelUse(); return; }
	const UBRConsumableDefinition* Cons = Reg->FindConsumable(Slots[UsingSlot].ItemId);
	if (Cons && C->IsAliveAndWell())
	{
		UBRHealthComponent* H = C->GetHealth();
		if (Cons->HealthRestore > 0.f) { H->Heal(Cons->HealthRestore, Cons->HealthCap); }
		if (Cons->ShieldRestore > 0.f) { H->AddShield(Cons->ShieldRestore, Cons->ShieldCap); }
		if (!bInfinite && --Slots[UsingSlot].Count <= 0) { Slots[UsingSlot].Clear(); ActiveSlot = -1; }
	}
	UsingSlot = INDEX_NONE;
	UseStartTime = UseEndTime = 0.f;
	Changed();
}

void UBRInventoryComponent::CancelUse()
{
	if (UsingSlot == INDEX_NONE && UseEndTime == 0.f) { return; }
	if (UWorld* W = GetWorld()) { W->GetTimerManager().ClearTimer(UseTimer); }
	UsingSlot = INDEX_NONE;
	UseStartTime = UseEndTime = 0.f;
}

void UBRInventoryComponent::DropStack(const FBRItemStack& Stack, int32 Index)
{
	ABRCharacter* C = GetCharacter();
	UBRLootSubsystem* Loot = GetWorld() ? GetWorld()->GetSubsystem<UBRLootSubsystem>() : nullptr;
	if (!C || !Loot || Stack.IsEmpty()) { return; }
	const float Angle = Index * 47.f;
	const FVector Offset = FRotator(0.f, C->GetActorRotation().Yaw + Angle, 0.f).Vector() * (120.f + 25.f * (Index % 4));
	Loot->SpawnPickup(Stack, C->GetActorLocation() + Offset);
}

void UBRInventoryComponent::DropSlotServer(int32 SlotIndex, int32 Count)
{
	if (!IsServer() || !Slots.IsValidIndex(SlotIndex) || Slots[SlotIndex].IsEmpty() || bInfinite) { return; }
	if (SlotIndex == ActiveSlot)
	{
		SyncActiveWeaponAmmo();
		DestroyActiveWeapon();
		CancelUse();
		ActiveSlot = -1;
	}
	FBRItemStack Drop = Slots[SlotIndex];
	if (Count > 0 && Count < Drop.Count)
	{
		Drop.Count = Count;
		Slots[SlotIndex].Count -= Count;
	}
	else
	{
		Slots[SlotIndex].Clear();
	}
	DropStack(Drop);
	Changed();
}

void UBRInventoryComponent::DropEverything()
{
	if (!IsServer()) { return; }
	SyncActiveWeaponAmmo();
	DestroyActiveWeapon();
	CancelUse();
	const UBRItemRegistry* Reg = UBRItemRegistry::Get();
	int32 N = 0;
	if (!bInfinite)
	{
		for (FBRItemStack& S : Slots) { if (!S.IsEmpty()) { DropStack(S, N++); S.Clear(); } }
		for (int32 I = 1; I < Ammo.Num(); ++I) { if (Ammo[I] > 0) { DropStack(FBRItemStack(Reg->AmmoItemId(EBRAmmoType(I)), Ammo[I]), N++); Ammo[I] = 0; } }
		for (int32 I = 0; I < Materials.Num(); ++I) { if (Materials[I] > 0) { DropStack(FBRItemStack(Reg->MaterialItemId(EBRBuildMaterial(I)), Materials[I]), N++); Materials[I] = 0; } }
	}
	ActiveSlot = -1;
	Changed();
}

void UBRInventoryComponent::ClearAll()
{
	DestroyActiveWeapon();
	CancelUse();
	for (FBRItemStack& S : Slots) { S.Clear(); }
	for (int32& A : Ammo) { A = 0; }
	for (int32& M : Materials) { M = 0; }
	bBackpack = false;
	ActiveSlot = -1;
	Changed();
}
