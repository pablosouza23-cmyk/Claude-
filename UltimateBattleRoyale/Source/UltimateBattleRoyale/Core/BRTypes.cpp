#include "Core/BRTypes.h"

#define LOCTEXT_NAMESPACE "BRTypes"

namespace BRTypes
{
	FLinearColor RarityColor(EBRRarity R)
	{
		const uint32 C = BRRules::RarityColorRGBA(ToRules(R));
		return FLinearColor(FColor(uint8(C >> 24), uint8(C >> 16), uint8(C >> 8), uint8(C)));
	}

	FText RarityName(EBRRarity R)
	{
		switch (R)
		{
		case EBRRarity::Uncommon: return LOCTEXT("Uncommon", "Incomum");
		case EBRRarity::Rare: return LOCTEXT("Rare", "Raro");
		case EBRRarity::Epic: return LOCTEXT("Epic", "Épico");
		case EBRRarity::Legendary: return LOCTEXT("Legendary", "Lendário");
		case EBRRarity::Mythic: return LOCTEXT("Mythic", "Mítico");
		default: return LOCTEXT("Common", "Comum");
		}
	}

	FText MaterialName(EBRBuildMaterial M)
	{
		switch (M)
		{
		case EBRBuildMaterial::Stone: return LOCTEXT("Stone", "Pedra");
		case EBRBuildMaterial::Metal: return LOCTEXT("Metal", "Metal");
		default: return LOCTEXT("Wood", "Madeira");
		}
	}

	FText AmmoName(EBRAmmoType A)
	{
		switch (A)
		{
		case EBRAmmoType::Light: return LOCTEXT("AmmoLight", "Munição leve");
		case EBRAmmoType::Medium: return LOCTEXT("AmmoMedium", "Munição média");
		case EBRAmmoType::Heavy: return LOCTEXT("AmmoHeavy", "Munição pesada");
		case EBRAmmoType::Shells: return LOCTEXT("AmmoShells", "Cartuchos");
		case EBRAmmoType::Rockets: return LOCTEXT("AmmoRockets", "Foguetes");
		case EBRAmmoType::Energy: return LOCTEXT("AmmoEnergy", "Células de energia");
		default: return FText::GetEmpty();
		}
	}

	FText ModeName(EBRGameModeType M)
	{
		switch (M)
		{
		case EBRGameModeType::Duos: return LOCTEXT("Duos", "Battle Royale Duplas");
		case EBRGameModeType::Squads: return LOCTEXT("Squads", "Battle Royale Esquadrões");
		case EBRGameModeType::BuildBattle: return LOCTEXT("Build", "Modo Construção");
		case EBRGameModeType::ZeroBuild: return LOCTEXT("ZeroBuild", "Modo Sem Construção");
		case EBRGameModeType::Training: return LOCTEXT("Training", "Treinamento (bots)");
		case EBRGameModeType::ShootingRange: return LOCTEXT("Range", "Campo de Tiro");
		case EBRGameModeType::Creative: return LOCTEXT("Creative", "Modo Criativo");
		default: return LOCTEXT("Solo", "Battle Royale Solo");
		}
	}

	FLinearColor BuildMaterialColor(EBRBuildMaterial M)
	{
		switch (M)
		{
		case EBRBuildMaterial::Stone: return FLinearColor(0.42f, 0.42f, 0.45f);
		case EBRBuildMaterial::Metal: return FLinearColor(0.28f, 0.36f, 0.48f);
		default: return FLinearColor(0.55f, 0.33f, 0.16f);
		}
	}
}

#undef LOCTEXT_NAMESPACE
