#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "BRInputConfig.generated.h"

class UInputAction;
class UInputMappingContext;

// Enhanced Input actions and default mappings created in code, so the game is
// fully controllable without authored input assets. Designers can still swap in
// authored IMCs; players rebind through the settings menu (Enhanced Input user settings).
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRInputConfig : public UObject
{
	GENERATED_BODY()

public:
	static UBRInputConfig* Get();

	UPROPERTY() TObjectPtr<UInputMappingContext> DefaultContext;

	UPROPERTY() TObjectPtr<UInputAction> Move;
	UPROPERTY() TObjectPtr<UInputAction> LookMouse;
	UPROPERTY() TObjectPtr<UInputAction> LookStick;
	UPROPERTY() TObjectPtr<UInputAction> LookGyro;
	UPROPERTY() TObjectPtr<UInputAction> Jump;
	UPROPERTY() TObjectPtr<UInputAction> Crouch;
	UPROPERTY() TObjectPtr<UInputAction> Sprint;
	UPROPERTY() TObjectPtr<UInputAction> Fire;
	UPROPERTY() TObjectPtr<UInputAction> Aim;
	UPROPERTY() TObjectPtr<UInputAction> Reload;
	UPROPERTY() TObjectPtr<UInputAction> Interact;
	UPROPERTY() TObjectPtr<UInputAction> Pickaxe;
	UPROPERTY() TArray<TObjectPtr<UInputAction>> Slots;
	UPROPERTY() TObjectPtr<UInputAction> NextSlot;
	UPROPERTY() TObjectPtr<UInputAction> PrevSlot;
	UPROPERTY() TObjectPtr<UInputAction> BuildMode;
	UPROPERTY() TObjectPtr<UInputAction> EditMode;
	UPROPERTY() TObjectPtr<UInputAction> CycleMaterial;
	UPROPERTY() TObjectPtr<UInputAction> Emote;
	UPROPERTY() TObjectPtr<UInputAction> Drop;
	UPROPERTY() TObjectPtr<UInputAction> Ping;
	UPROPERTY() TObjectPtr<UInputAction> Map;
	UPROPERTY() TObjectPtr<UInputAction> PushToTalk;
	UPROPERTY() TObjectPtr<UInputAction> Chat;
	UPROPERTY() TObjectPtr<UInputAction> Menu;

private:
	void Build();
	UInputAction* MakeAction(const TCHAR* Name, uint8 ValueType);
};
