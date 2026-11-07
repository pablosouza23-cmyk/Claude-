#pragma once

#include "CoreMinimal.h"
#include "GameFramework/DamageType.h"
#include "BRDamageTypes.generated.h"

UCLASS(Abstract)
class ULTIMATEBATTLEROYALE_API UBRDamageType : public UDamageType
{
	GENERATED_BODY()
public:
	UPROPERTY(EditDefaultsOnly) bool bIgnoresShield = false;
	UPROPERTY(EditDefaultsOnly) bool bHeadshot = false;
	UPROPERTY(EditDefaultsOnly) bool bFriendlyFireAlways = false; // storm/fall hurt everyone
	UPROPERTY(EditDefaultsOnly) FText KillFeedVerb;
};

UCLASS() class ULTIMATEBATTLEROYALE_API UBRDamageType_Weapon : public UBRDamageType { GENERATED_BODY() };
UCLASS() class ULTIMATEBATTLEROYALE_API UBRDamageType_Headshot : public UBRDamageType { GENERATED_BODY() public: UBRDamageType_Headshot() { bHeadshot = true; } };
UCLASS() class ULTIMATEBATTLEROYALE_API UBRDamageType_Explosion : public UBRDamageType { GENERATED_BODY() };
UCLASS() class ULTIMATEBATTLEROYALE_API UBRDamageType_Pickaxe : public UBRDamageType { GENERATED_BODY() };
UCLASS() class ULTIMATEBATTLEROYALE_API UBRDamageType_Vehicle : public UBRDamageType { GENERATED_BODY() };
UCLASS() class ULTIMATEBATTLEROYALE_API UBRDamageType_Storm : public UBRDamageType { GENERATED_BODY() public: UBRDamageType_Storm() { bIgnoresShield = true; bFriendlyFireAlways = true; } };
UCLASS() class ULTIMATEBATTLEROYALE_API UBRDamageType_Fall : public UBRDamageType { GENERATED_BODY() public: UBRDamageType_Fall() { bIgnoresShield = true; bFriendlyFireAlways = true; } };
