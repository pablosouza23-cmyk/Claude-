#include "Progression/BRCosmetics.h"

#include "Core/BRVisuals.h"

#define LOCTEXT_NAMESPACE "BRCosmetics"

namespace
{
	FBRCosmeticDef MakeOutfit(const TCHAR* Id, const TCHAR* Name, EBRRarity R, int32 Price, uint32 P, uint32 S, uint32 A, uint32 Skin, uint32 Hair, uint8 HeadGear, bool bDefault = false)
	{
		FBRCosmeticDef D;
		D.Id = Id; D.Name = FText::FromString(Name); D.Type = EBRCosmeticType::Outfit; D.Rarity = R; D.Price = Price;
		D.Primary = BRVisuals::HexColor(P); D.Secondary = BRVisuals::HexColor(S); D.Accent = BRVisuals::HexColor(A);
		D.Skin = BRVisuals::HexColor(Skin); D.Hair = BRVisuals::HexColor(Hair); D.DefaultHeadGear = HeadGear;
		D.bDefaultOwned = bDefault; D.bShopItem = !bDefault;
		return D;
	}

	FBRCosmeticDef MakeItem(const TCHAR* Id, const TCHAR* Name, EBRCosmeticType T, EBRRarity R, int32 Price, uint32 P, uint32 S, uint8 Shape, bool bDefault = false)
	{
		FBRCosmeticDef D;
		D.Id = Id; D.Name = FText::FromString(Name); D.Type = T; D.Rarity = R; D.Price = Price;
		D.Primary = BRVisuals::HexColor(P); D.Secondary = BRVisuals::HexColor(S); D.Shape = Shape;
		D.bDefaultOwned = bDefault; D.bShopItem = !bDefault;
		return D;
	}

	FBRCosmeticDef MakeEmote(const TCHAR* Id, const TCHAR* Name, EBRRarity R, int32 Price, EBREmoteAnim Anim, float Seconds, bool bDefault = false)
	{
		FBRCosmeticDef D;
		D.Id = Id; D.Name = FText::FromString(Name); D.Type = EBRCosmeticType::Emote; D.Rarity = R; D.Price = Price;
		D.EmoteAnim = Anim; D.EmoteSeconds = Seconds; D.bDefaultOwned = bDefault; D.bShopItem = !bDefault;
		return D;
	}

	TArray<FBRCosmeticDef> BuildCatalog()
	{
		TArray<FBRCosmeticDef> C;
		// Outfits (all original designs).
		C.Add(MakeOutfit(TEXT("Outfit_Recruta"), TEXT("Recruta"), EBRRarity::Common, 0, 0x4F6D7A, 0x2E3B42, 0x1C1C1C, 0xE0B48C, 0x3B2A1E, 0, true));
		C.Add(MakeOutfit(TEXT("Outfit_Recruta2"), TEXT("Recruta Areia"), EBRRarity::Common, 0, 0xB49A6C, 0x5E4E36, 0x2A2A2A, 0x8D5A3B, 0x111111, 3, true));
		C.Add(MakeOutfit(TEXT("Outfit_RaioAzul"), TEXT("Raio Azul"), EBRRarity::Uncommon, 800, 0x1F6FEB, 0x0D2A5C, 0xF5D02E, 0xF1C9A5, 0xF5D02E, 0));
		C.Add(MakeOutfit(TEXT("Outfit_SentinelaAmbar"), TEXT("Sentinela Âmbar"), EBRRarity::Rare, 1200, 0xE38B12, 0x3A3A3A, 0x111111, 0xC68E62, 0x222222, 1));
		C.Add(MakeOutfit(TEXT("Outfit_CoralNoturna"), TEXT("Coral Noturna"), EBRRarity::Rare, 1200, 0xE0507A, 0x2B1B3D, 0x7FE3F0, 0x9C6644, 0xE0507A, 0));
		C.Add(MakeOutfit(TEXT("Outfit_VanguardaTitanio"), TEXT("Vanguarda Titânio"), EBRRarity::Epic, 1500, 0x8A96A3, 0x2F353B, 0x3FD0FF, 0xD9A882, 0x101010, 1));
		C.Add(MakeOutfit(TEXT("Outfit_RaposaDeserto"), TEXT("Raposa do Deserto"), EBRRarity::Epic, 1500, 0xC9733A, 0xEADBC8, 0x5A3218, 0xB27750, 0xC9733A, 4));
		C.Add(MakeOutfit(TEXT("Outfit_NeonPulse"), TEXT("Neon Pulse"), EBRRarity::Legendary, 2000, 0x111111, 0x1B1B2E, 0x39FF14, 0xF0C8A0, 0x39FF14, 2));
		C.Add(MakeOutfit(TEXT("Outfit_GuardiaoJade"), TEXT("Guardião Jade"), EBRRarity::Legendary, 2000, 0x1E8C5A, 0xE8D9A8, 0xC9A227, 0x7A4B2E, 0x0B0B0B, 1));
		C.Add(MakeOutfit(TEXT("Outfit_Eclipse"), TEXT("Eclipse"), EBRRarity::Mythic, 2500, 0x2A0F45, 0x0B0B12, 0xFF6A00, 0xE8C2A0, 0xFFFFFF, 2));
		C.Add(MakeOutfit(TEXT("Outfit_BrisaTropical"), TEXT("Brisa Tropical"), EBRRarity::Uncommon, 800, 0x2EC4B6, 0xFFBF69, 0xFF6B6B, 0xD7A37E, 0x5C3A21, 3));
		C.Add(MakeOutfit(TEXT("Outfit_Cacadora"), TEXT("Caçadora da Mata"), EBRRarity::Rare, 1200, 0x4B5D2A, 0x6B4E2E, 0xD4C28A, 0xA36E4A, 0x2B1A10, 4));

		// Backpacks (Shape: 0 square, 1 round, 2 tank, 3 wings).
		C.Add(MakeItem(TEXT("Back_Basica"), TEXT("Mochila Básica"), EBRCosmeticType::Backpack, EBRRarity::Common, 0, 0x5A4632, 0x2E241A, 0, true));
		C.Add(MakeItem(TEXT("Back_Bolha"), TEXT("Bolha Turbo"), EBRCosmeticType::Backpack, EBRRarity::Uncommon, 400, 0x3FA7D6, 0xF7F7F7, 1));
		C.Add(MakeItem(TEXT("Back_Tanque"), TEXT("Tanque de Oxigênio"), EBRCosmeticType::Backpack, EBRRarity::Rare, 600, 0xC0C0C0, 0xE53935, 2));
		C.Add(MakeItem(TEXT("Back_Asas"), TEXT("Asas de Aço"), EBRCosmeticType::Backpack, EBRRarity::Epic, 900, 0x9AA5B1, 0x3FD0FF, 3));

		// Pickaxes (Shape: 0 pick, 1 axe, 2 hammer).
		C.Add(MakeItem(TEXT("Pick_Padrao"), TEXT("Picareta Padrão"), EBRCosmeticType::Pickaxe, EBRRarity::Common, 0, 0x8C8C8C, 0x6B4E2E, 0, true));
		C.Add(MakeItem(TEXT("Pick_Machado"), TEXT("Machado Lenhador"), EBRCosmeticType::Pickaxe, EBRRarity::Uncommon, 500, 0xB0B0B0, 0xA0522D, 1));
		C.Add(MakeItem(TEXT("Pick_Martelo"), TEXT("Martelo Trovão"), EBRCosmeticType::Pickaxe, EBRRarity::Epic, 1200, 0x3FD0FF, 0x222222, 2));
		C.Add(MakeItem(TEXT("Pick_Cristal"), TEXT("Picareta de Cristal"), EBRCosmeticType::Pickaxe, EBRRarity::Legendary, 1500, 0xB46CFF, 0xEDE7F6, 0));

		// Gliders (Shape: 0 parafoil, 1 delta wing, 2 umbrella).
		C.Add(MakeItem(TEXT("Glider_Padrao"), TEXT("Planador Padrão"), EBRCosmeticType::Glider, EBRRarity::Common, 0, 0xE53935, 0xF5F5F5, 0, true));
		C.Add(MakeItem(TEXT("Glider_Asa"), TEXT("Asa Delta Solar"), EBRCosmeticType::Glider, EBRRarity::Rare, 800, 0xFFC107, 0xFF5722, 1));
		C.Add(MakeItem(TEXT("Glider_Guarda"), TEXT("Guarda-chuva Neon"), EBRCosmeticType::Glider, EBRRarity::Epic, 1200, 0x39FF14, 0x111111, 2));
		C.Add(MakeItem(TEXT("Glider_Aurora"), TEXT("Aurora Boreal"), EBRCosmeticType::Glider, EBRRarity::Legendary, 1500, 0x00E5FF, 0x7C4DFF, 0));

		// Emotes.
		C.Add(MakeEmote(TEXT("Emote_Aceno"), TEXT("Aceno"), EBRRarity::Common, 0, EBREmoteAnim::Wave, 3.f, true));
		C.Add(MakeEmote(TEXT("Emote_Danca"), TEXT("Dança do Lobby"), EBRRarity::Common, 0, EBREmoteAnim::Dance, 6.f, true));
		C.Add(MakeEmote(TEXT("Emote_Continencia"), TEXT("Continência"), EBRRarity::Uncommon, 200, EBREmoteAnim::Salute, 3.f));
		C.Add(MakeEmote(TEXT("Emote_Pirueta"), TEXT("Pirueta"), EBRRarity::Rare, 500, EBREmoteAnim::Spin, 3.f));
		C.Add(MakeEmote(TEXT("Emote_Forca"), TEXT("Mostrar Força"), EBRRarity::Rare, 500, EBREmoteAnim::Flex, 4.f));
		C.Add(MakeEmote(TEXT("Emote_Torcida"), TEXT("Torcida"), EBRRarity::Uncommon, 300, EBREmoteAnim::Cheer, 4.f));
		C.Add(MakeEmote(TEXT("Emote_Robo"), TEXT("Passo Robô"), EBRRarity::Epic, 800, EBREmoteAnim::Robot, 6.f));
		C.Add(MakeEmote(TEXT("Emote_Palmas"), TEXT("Palmas"), EBRRarity::Common, 200, EBREmoteAnim::Clap, 3.f));

		// Season pass exclusives (not in the shop).
		FBRCosmeticDef Pass1 = MakeOutfit(TEXT("Outfit_PassePiloto"), TEXT("Piloto Estelar"), EBRRarity::Epic, 0, 0xF2F2F2, 0x1A237E, 0xFF3D00, 0xE5B999, 0x222222, 1);
		Pass1.bShopItem = false; Pass1.PassTier = 1; Pass1.bPremiumPass = true; C.Add(Pass1);
		FBRCosmeticDef Pass2 = MakeOutfit(TEXT("Outfit_PasseLenda"), TEXT("Lenda da Temporada"), EBRRarity::Legendary, 0, 0xFFD54F, 0x4E342E, 0xFFFFFF, 0x8D5524, 0xFFD54F, 2);
		Pass2.bShopItem = false; Pass2.PassTier = 50; Pass2.bPremiumPass = true; C.Add(Pass2);
		FBRCosmeticDef PassGlider = MakeItem(TEXT("Glider_Passe"), TEXT("Cometa da Temporada"), EBRCosmeticType::Glider, EBRRarity::Epic, 0, 0x7C4DFF, 0xFFEB3B, 1);
		PassGlider.bShopItem = false; PassGlider.PassTier = 25; C.Add(PassGlider);
		FBRCosmeticDef PassEmote = MakeEmote(TEXT("Emote_Vitoria"), TEXT("Pose da Vitória"), EBRRarity::Rare, 0, EBREmoteAnim::Cheer, 4.f);
		PassEmote.bShopItem = false; PassEmote.PassTier = 10; C.Add(PassEmote);

		for (FBRCosmeticDef& D : C)
		{
			if (D.Description.IsEmpty())
			{
				D.Description = FText::Format(LOCTEXT("Desc", "{0} • Item cosmético original"), BRTypes::RarityName(D.Rarity));
			}
		}
		return C;
	}
}

const TArray<FBRCosmeticDef>& UBRCosmeticCatalog::All()
{
	static const TArray<FBRCosmeticDef> Catalog = BuildCatalog();
	return Catalog;
}

const FBRCosmeticDef* UBRCosmeticCatalog::Find(FName Id)
{
	for (const FBRCosmeticDef& D : All()) { if (D.Id == Id) { return &D; } }
	return nullptr;
}

void UBRCosmeticCatalog::GetByType(EBRCosmeticType Type, TArray<const FBRCosmeticDef*>& Out)
{
	for (const FBRCosmeticDef& D : All()) { if (D.Type == Type) { Out.Add(&D); } }
}

void UBRCosmeticCatalog::GetDailyShop(const FDateTime& UtcNow, TArray<const FBRCosmeticDef*>& Out, int32 Count)
{
	TArray<const FBRCosmeticDef*> Pool;
	for (const FBRCosmeticDef& D : All()) { if (D.bShopItem) { Pool.Add(&D); } }
	TArray<int> Order;
	for (int32 I = 0; I < Pool.Num(); ++I) { Order.Add(I); }
	// Same algorithm as the backend (Backend/brbackend/rules.py) so offline and online shops agree.
	BRRules::ShuffleShop(BRRules::DailyShopSeed(UtcNow.GetYear(), UtcNow.GetMonth(), UtcNow.GetDay()), Order.Num(), Order.GetData());
	for (int32 I = 0; I < FMath::Min(Count, Order.Num()); ++I) { Out.Add(Pool[Order[I]]); }
}

const TArray<FBRSeasonReward>& UBRCosmeticCatalog::SeasonRewards()
{
	static TArray<FBRSeasonReward> Rewards = []()
	{
		TArray<FBRSeasonReward> R;
		for (int32 Tier = 1; Tier <= BRRules::SeasonPassTiers; ++Tier)
		{
			FBRSeasonReward Free; Free.Tier = Tier; Free.bPremium = false; Free.Coins = (Tier % 5 == 0) ? 100 : 0;
			FBRSeasonReward Premium; Premium.Tier = Tier; Premium.bPremium = true; Premium.Coins = (Tier % 2 == 0) ? 150 : 50;
			for (const FBRCosmeticDef& D : All())
			{
				if (D.PassTier == Tier)
				{
					if (D.bPremiumPass) { Premium.CosmeticId = D.Id; Premium.Coins = 0; }
					else { Free.CosmeticId = D.Id; Free.Coins = 0; }
				}
			}
			if (!Free.CosmeticId.IsNone() || Free.Coins > 0) { R.Add(Free); }
			R.Add(Premium);
		}
		return R;
	}();
	return Rewards;
}

void UBRCosmeticCatalog::GetOutfitColors(const FBRCosmeticDef& Outfit, uint8 Variant, FLinearColor& OutPrimary, FLinearColor& OutSecondary, FLinearColor& OutAccent)
{
	auto Shift = [Variant](const FLinearColor& C)
	{
		if (Variant == 0) { return C; }
		FLinearColor HSV = C.LinearRGBToHSV();
		HSV.R = FMath::Fmod(HSV.R + 120.f * Variant, 360.f);
		return HSV.HSVToLinearRGB();
	};
	OutPrimary = Shift(Outfit.Primary);
	OutSecondary = Shift(Outfit.Secondary);
	OutAccent = Outfit.Accent;
}

FBRCosmeticLoadout UBRCosmeticCatalog::DefaultLoadout()
{
	FBRCosmeticLoadout L;
	L.Emotes = { TEXT("Emote_Aceno"), TEXT("Emote_Danca") };
	return L;
}

FBRCosmeticLoadout UBRCosmeticCatalog::Sanitize(const FBRCosmeticLoadout& In)
{
	FBRCosmeticLoadout Out = In;
	const FBRCosmeticLoadout Def = DefaultLoadout();
	auto Check = [](FName Id, EBRCosmeticType T, FName Fallback)
	{
		const FBRCosmeticDef* D = Find(Id);
		return (D && D->Type == T) ? Id : Fallback;
	};
	Out.Outfit = Check(In.Outfit, EBRCosmeticType::Outfit, Def.Outfit);
	Out.Backpack = Check(In.Backpack, EBRCosmeticType::Backpack, Def.Backpack);
	Out.Pickaxe = Check(In.Pickaxe, EBRCosmeticType::Pickaxe, Def.Pickaxe);
	Out.Glider = Check(In.Glider, EBRCosmeticType::Glider, Def.Glider);
	Out.Emotes.Reset();
	for (int32 I = 0; I < FMath::Min(6, In.Emotes.Num()); ++I)
	{
		if (const FBRCosmeticDef* D = Find(In.Emotes[I])) { if (D->Type == EBRCosmeticType::Emote) { Out.Emotes.Add(In.Emotes[I]); } }
	}
	if (Out.Emotes.Num() == 0) { Out.Emotes = Def.Emotes; }
	Out.BodyType = FMath::Min<uint8>(In.BodyType, 1);
	Out.BodyStyle = FMath::Min<uint8>(In.BodyStyle, 2);
	Out.HairStyle = FMath::Min<uint8>(In.HairStyle, 4);
	Out.HeadGear = FMath::Min<uint8>(In.HeadGear, 4);
	Out.ColorVariant = FMath::Min<uint8>(In.ColorVariant, 2);
	return Out;
}

#undef LOCTEXT_NAMESPACE
