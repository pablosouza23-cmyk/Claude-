#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Core/BRTypes.h"
#include "BRInventoryComponent.generated.h"

class ABRCharacter;
class ABRWeapon;
class UBRItemDefinition;

DECLARE_MULTICAST_DELEGATE(FBRInventoryChanged);

// Five equipment slots (weapons, heals, utilities) + ammo pools + building materials.
// Every mutation happens on the server; clients only send requests. Item ids (not
// object pointers) are replicated so the state is cheap and cannot reference spoofed objects.
UCLASS(ClassGroup = (BR), meta = (BlueprintSpawnableComponent))
class ULTIMATEBATTLEROYALE_API UBRInventoryComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	static constexpr int32 NumSlots = BRRules::InventorySlotCount;

	UBRInventoryComponent();
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	// ---- Queries
	int32 GetActiveSlot() const { return ActiveSlot; }
	const FBRItemStack& GetSlot(int32 Index) const;
	const TArray<FBRItemStack>& GetSlots() const { return Slots; }
	int32 GetAmmo(EBRAmmoType Type) const;
	int32 GetMaterial(EBRBuildMaterial Mat) const;
	int32 GetAmmoCapacity(EBRAmmoType Type) const;
	bool IsUsingConsumable() const;
	float GetUseProgress() const;
	bool IsInfinite() const { return bInfinite; }
	bool HasBackpack() const { return bBackpack; }
	int32 FindFreeSlot() const;

	// ---- Client requests (forwarded to the server)
	void RequestEquip(int32 SlotIndex);
	void RequestDropActive();
	void RequestDropSlot(int32 SlotIndex);
	void RequestSwap(int32 A, int32 B);
	void RequestUseActive();
	void RequestDropMaterial(EBRBuildMaterial Mat, int32 Amount);

	// ---- Server API
	// Adds as much as possible; OutLeftover holds what did not fit. bSwapIfFull drops the active item for a new weapon/item.
	bool AddStack(const FBRItemStack& In, FBRItemStack& OutLeftover, bool bSwapIfFull = false);
	bool ConsumeAmmo(EBRAmmoType Type, int32 Count);
	bool ConsumeMaterial(EBRBuildMaterial Mat, int32 Count);
	void AddMaterial(EBRBuildMaterial Mat, int32 Count);
	void ConsumeActiveThrowable();
	void EquipSlotServer(int32 SlotIndex);
	void DropSlotServer(int32 SlotIndex, int32 Count = -1);
	void DropEverything();
	void ClearAll();
	void SetInfinite(bool bInInfinite) { bInfinite = bInInfinite; }
	void CancelUse();

	FBRInventoryChanged OnInventoryChanged;

protected:
	UFUNCTION(Server, Reliable) void ServerEquip(int32 SlotIndex);
	UFUNCTION(Server, Reliable) void ServerDropSlot(int32 SlotIndex);
	UFUNCTION(Server, Reliable) void ServerSwap(int32 A, int32 B);
	UFUNCTION(Server, Reliable) void ServerUseActive();
	UFUNCTION(Server, Reliable) void ServerDropMaterial(EBRBuildMaterial Mat, int32 Amount);

	UFUNCTION() void OnRep_Inventory();
	UFUNCTION() void OnRep_ActiveSlot();

private:
	ABRCharacter* GetCharacter() const;
	bool IsServer() const;
	bool CheckRate() const;
	void SyncActiveWeaponAmmo();
	void DestroyActiveWeapon();
	void SpawnWeaponForSlot(int32 SlotIndex);
	void CompleteUse();
	void DropStack(const FBRItemStack& Stack, int32 Index = 0);
	void Changed();

	UPROPERTY(ReplicatedUsing = OnRep_Inventory) TArray<FBRItemStack> Slots;
	UPROPERTY(ReplicatedUsing = OnRep_Inventory) TArray<int32> Ammo;
	UPROPERTY(ReplicatedUsing = OnRep_Inventory) TArray<int32> Materials;
	UPROPERTY(ReplicatedUsing = OnRep_ActiveSlot) int32 ActiveSlot = -1;
	UPROPERTY(Replicated) float UseStartTime = 0.f;
	UPROPERTY(Replicated) float UseEndTime = 0.f;
	UPROPERTY(ReplicatedUsing = OnRep_Inventory) bool bBackpack = false;

	bool bInfinite = false;
	int32 UsingSlot = INDEX_NONE;
	FTimerHandle UseTimer;
};
