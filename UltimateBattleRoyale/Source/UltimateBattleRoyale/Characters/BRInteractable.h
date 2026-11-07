#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "BRInteractable.generated.h"

class ABRCharacter;

UINTERFACE(MinimalAPI, meta = (CannotImplementInterfaceInBlueprint))
class UBRInteractable : public UInterface
{
	GENERATED_BODY()
};

// Anything the player can use with the Interact button: pickups, chests, doors,
// vehicles, downed teammates, gas pumps. Validated and executed on the server.
class ULTIMATEBATTLEROYALE_API IBRInteractable
{
	GENERATED_BODY()

public:
	virtual bool CanInteract(const ABRCharacter* By) const = 0;
	virtual FText GetInteractPrompt(const ABRCharacter* By) const = 0;
	virtual FVector GetInteractLocation() const = 0;
	// Seconds the button must be held (0 = instant).
	virtual float GetInteractDuration(const ABRCharacter* By) const { return 0.f; }
	// Server only.
	virtual void ExecuteInteract(ABRCharacter* By) = 0;
	virtual float GetInteractRange() const { return 350.f; }
};
