// Unreal automation tests. Run in the editor (Session Frontend > Automation, filter "BR.") or headless:
//   UnrealEditor-Cmd UltimateBattleRoyale.uproject -ExecCmds="Automation RunTests BR.;Quit" -unattended -nullrhi
#include "Misc/AutomationTest.h"

#if WITH_DEV_AUTOMATION_TESTS

#include "Audio/BRProceduralAudio.h"
#include "Multiplayer/BRBackendClient.h"
#include "Building/BRBuildingPiece.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameModes/BRModeRules.h"
#include "Inventory/BRInventoryComponent.h"
#include "Items/BRItemRegistry.h"
#include "Progression/BRCosmetics.h"
#include "Rules/BRWorldRules.h"
#include "Tests/AutomationCommon.h"
#include "World/BRWorldGenerator.h"
#include "Systems/BRStormController.h"

#define BRTestFlags (EAutomationTestFlags::EditorContext | EAutomationTestFlags::ClientContext | EAutomationTestFlags::ProductFilter)

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FBRItemRegistryTest, "BR.Items.Registry", BRTestFlags)
bool FBRItemRegistryTest::RunTest(const FString& Parameters)
{
	const UBRItemRegistry* Reg = UBRItemRegistry::Get();
	TestNotNull(TEXT("Registry exists"), Reg);
	if (!Reg) { return false; }
	TSet<EBRWeaponCategory> Categories;
	for (const UBRItemDefinition* Def : Reg->GetAll())
	{
		TestFalse(TEXT("Item id set"), Def->ItemId.IsNone());
		TestFalse(TEXT("Item name set"), Def->DisplayName.IsEmpty());
		TestTrue(TEXT("Lookup round-trip"), Reg->Find(Def->ItemId) == Def);
		if (const UBRWeaponDefinition* W = Cast<UBRWeaponDefinition>(Def))
		{
			Categories.Add(W->Category);
			TestTrue(TEXT("Weapon damage positive"), W->Damage > 0.f || W->KnockbackImpulse > 0.f);
			TestTrue(TEXT("Weapon fire rate positive"), W->RoundsPerMinute > 0.f);
			if (!W->bThrowable && W->AmmoType != EBRAmmoType::None) { TestNotNull(TEXT("Ammo item exists"), Reg->Find(Reg->AmmoItemId(W->AmmoType))); }
		}
	}
	TestEqual(TEXT("All 9 weapon categories present"), Categories.Num(), 9);
	// Higher rarity => more damage for the same weapon.
	const UBRWeaponDefinition* Common = Reg->FindWeapon(TEXT("W_TalonAR_Common"));
	const UBRWeaponDefinition* Legendary = Reg->FindWeapon(TEXT("W_TalonAR_Legendary"));
	TestTrue(TEXT("Rarity scales damage"), Common && Legendary && Legendary->Damage > Common->Damage);
	for (EBRBuildMaterial M : { EBRBuildMaterial::Wood, EBRBuildMaterial::Stone, EBRBuildMaterial::Metal })
	{
		TestNotNull(TEXT("Material item"), Reg->Find(Reg->MaterialItemId(M)));
	}
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FBRInventoryTest, "BR.Inventory.Stacking", BRTestFlags)
bool FBRInventoryTest::RunTest(const FString& Parameters)
{
	// Standalone component (no owner => acts as the server) exercises the real inventory code.
	UBRInventoryComponent* Inv = NewObject<UBRInventoryComponent>();
	FBRItemStack Left;
	TestTrue(TEXT("Add bandages"), Inv->AddStack(FBRItemStack(TEXT("C_Bandage"), 20), Left));
	TestEqual(TEXT("First slot stacks to max"), Inv->GetSlot(0).Count, 15);
	TestEqual(TEXT("Overflow goes to second slot"), Inv->GetSlot(1).Count, 5);
	TestTrue(TEXT("Nothing left over"), Left.IsEmpty());

	Inv->AddStack(FBRItemStack(TEXT("A_Light"), 2000), Left);
	TestEqual(TEXT("Ammo capped"), Inv->GetAmmo(EBRAmmoType::Light), 999);
	TestEqual(TEXT("Ammo overflow returned"), Left.Count, 2000 - 999);

	Inv->AddStack(FBRItemStack(TEXT("M_Wood"), 1200), Left);
	TestEqual(TEXT("Materials capped at 999"), Inv->GetMaterial(EBRBuildMaterial::Wood), 999);
	TestTrue(TEXT("Consume material"), Inv->ConsumeMaterial(EBRBuildMaterial::Wood, 10));
	TestEqual(TEXT("Material decreased"), Inv->GetMaterial(EBRBuildMaterial::Wood), 989);
	TestFalse(TEXT("Cannot overspend"), Inv->ConsumeMaterial(EBRBuildMaterial::Stone, 10));

	for (int32 I = 0; I < 3; ++I) { Inv->AddStack(FBRItemStack(TEXT("W_TalonAR_Rare"), 1, 30), Left); }
	TestEqual(TEXT("Slots full"), Inv->FindFreeSlot(), INDEX_NONE);
	TestFalse(TEXT("No room for another weapon"), Inv->AddStack(FBRItemStack(TEXT("W_SparrowP9_Common"), 1), Left));
	TestFalse(TEXT("Unknown items rejected"), Inv->AddStack(FBRItemStack(TEXT("Hacked_Item"), 1), Left));

	Inv->SetInfinite(true);
	TestTrue(TEXT("Infinite resources never run out"), Inv->ConsumeAmmo(EBRAmmoType::Rockets, 500));
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FBRModeRulesTest, "BR.Modes.Rules", BRTestFlags)
bool FBRModeRulesTest::RunTest(const FString& Parameters)
{
	TestEqual(TEXT("Solo team size"), FBRModeRules::ForMode(EBRGameModeType::Solo).TeamSize, 1);
	TestEqual(TEXT("Duos team size"), FBRModeRules::ForMode(EBRGameModeType::Duos).TeamSize, 2);
	TestEqual(TEXT("Squads team size"), FBRModeRules::ForMode(EBRGameModeType::Squads).TeamSize, 4);
	TestFalse(TEXT("Zero build disables building"), FBRModeRules::ForMode(EBRGameModeType::ZeroBuild).bBuildingEnabled);
	TestTrue(TEXT("Only training adds bots"), FBRModeRules::ForMode(EBRGameModeType::Training).BotCount > 0 && FBRModeRules::ForMode(EBRGameModeType::Solo).BotCount == 0);
	TestFalse(TEXT("Training gives no full progression"), FBRModeRules::ForMode(EBRGameModeType::Training).bCountsForProgression);
	TestFalse(TEXT("Range has no storm"), FBRModeRules::ForMode(EBRGameModeType::ShootingRange).bStorm);
	TestTrue(TEXT("Creative has tools"), FBRModeRules::ForMode(EBRGameModeType::Creative).bCreativeTools);
	for (int32 M = 0; M <= int32(EBRGameModeType::Creative); ++M)
	{
		TestTrue(TEXT("Mode name round-trip"), FBRModeRules::ParseMode(FBRModeRules::ModeToString(EBRGameModeType(M))) == EBRGameModeType(M));
	}
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FBRCosmeticsTest, "BR.Progression.Cosmetics", BRTestFlags)
bool FBRCosmeticsTest::RunTest(const FString& Parameters)
{
	TSet<FName> Ids;
	for (const FBRCosmeticDef& D : UBRCosmeticCatalog::All())
	{
		TestFalse(TEXT("Unique id"), Ids.Contains(D.Id));
		Ids.Add(D.Id);
		TestTrue(TEXT("Shop items have prices"), !D.bShopItem || D.Price > 0);
	}
	const FBRCosmeticLoadout Def = UBRCosmeticCatalog::DefaultLoadout();
	FBRCosmeticLoadout Bad = Def;
	Bad.Outfit = TEXT("Back_Basica"); // wrong type
	Bad.HairStyle = 200;
	const FBRCosmeticLoadout Clean = UBRCosmeticCatalog::Sanitize(Bad);
	TestTrue(TEXT("Wrong-type outfit replaced"), Clean.Outfit == Def.Outfit);
	TestTrue(TEXT("Hair clamped"), Clean.HairStyle <= 4);
	TArray<const FBRCosmeticDef*> A, B;
	UBRCosmeticCatalog::GetDailyShop(FDateTime(2026, 11, 7), A);
	UBRCosmeticCatalog::GetDailyShop(FDateTime(2026, 11, 7), B);
	TestTrue(TEXT("Daily shop is deterministic"), A == B && A.Num() > 0);
	int32 PremiumTiers = 0;
	for (const FBRSeasonReward& R : UBRCosmeticCatalog::SeasonRewards()) { if (R.bPremium) { ++PremiumTiers; } }
	TestEqual(TEXT("Premium track covers every tier"), PremiumTiers, BRRules::SeasonPassTiers);
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FBRAudioTest, "BR.Audio.Synth", BRTestFlags)
bool FBRAudioTest::RunTest(const FString& Parameters)
{
	for (int32 S = 0; S < int32(EBRSfx::EngineLoop); ++S)
	{
		const TArray<int16>& PCM = UBRProceduralAudio::GetOneShotPCM(EBRSfx(S));
		TestTrue(FString::Printf(TEXT("Sfx %d has samples"), S), PCM.Num() > 100);
		int32 Peak = 0;
		for (int16 V : PCM) { Peak = FMath::Max(Peak, FMath::Abs(int32(V))); }
		TestTrue(FString::Printf(TEXT("Sfx %d audible and not clipped"), S), Peak > 1000 && Peak <= 32000);
	}
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FBRBuildGeometryTest, "BR.Building.Geometry", BRTestFlags)
bool FBRBuildGeometryTest::RunTest(const FString& Parameters)
{
	FBRGridKey East; East.X = 0; East.Y = 0; East.Z = 0; East.Type = EBRBuildPieceType::Wall; East.Dir = 0;
	FBRGridKey West; West.X = 1; West.Y = 0; West.Z = 0; West.Type = EBRBuildPieceType::Wall; West.Dir = 2;
	TestTrue(TEXT("Shared edge => same key"), East == West);
	TestTrue(TEXT("Same transform"), ABRBuildingPiece::ComputeTransform(East).Equals(ABRBuildingPiece::ComputeTransform(West)));
	TArray<FTransform> Tiles;
	ABRBuildingPiece::GetTileBoxes(EBRBuildPieceType::Wall, Tiles);
	TestEqual(TEXT("Wall has 3x3 tiles"), Tiles.Num(), 9);
	ABRBuildingPiece::GetTileBoxes(EBRBuildPieceType::Floor, Tiles);
	TestEqual(TEXT("Floor has 2x2 tiles"), Tiles.Num(), 4);
	return true;
}


IMPLEMENT_SIMPLE_AUTOMATION_TEST(FBRBackendSignatureTest, "BR.Backend.Signature", BRTestFlags)
bool FBRBackendSignatureTest::RunTest(const FString& Parameters)
{
	// Vector produced by Backend/brbackend/auth.py::sign — both sides must agree byte for byte.
	const FTCHARToUTF8 Body(TEXT("{\"matchId\":\"m1\"}"));
	TArray<uint8> Bytes;
	Bytes.Append(reinterpret_cast<const uint8*>(Body.Get()), Body.Length());
	TestEqual(TEXT("HMAC matches backend"), UBRBackendClient::SignRequest(TEXT("s3cret"), TEXT("POST"), TEXT("/v1/server/match-result"), TEXT("1767225600"), Bytes), FString(TEXT("fa0f3a208f411fee924cc9addc24d5aafbd1c3ed")));
	TestEqual(TEXT("Ids sanitised like the backend"), UBRBackendClient::SanitizePlayerId(TEXT("DESKTOP ABC/12#3")), FString(TEXT("DESKTOP_ABC_12_3")));
	FBRCosmeticLoadout L = UBRCosmeticCatalog::DefaultLoadout();
	L.HairStyle = 3;
	const FBRCosmeticLoadout Back = UBRBackendClient::LoadoutFromJson(UBRBackendClient::LoadoutToJson(L));
	TestTrue(TEXT("Loadout JSON round-trip"), Back.Outfit == L.Outfit && Back.HairStyle == 3 && Back.Emotes == L.Emotes);
	return true;
}

// ---- Smoke test with a real world: boots a shooting-range match on the empty Entry map and checks
// that the procedural world, storm controller and loot actually spawn.
DEFINE_LATENT_AUTOMATION_COMMAND_ONE_PARAMETER(FBRCheckMatchWorld, FAutomationTestBase*, Test);
bool FBRCheckMatchWorld::Update()
{
	UWorld* World = nullptr;
	for (const FWorldContext& Ctx : GEngine->GetWorldContexts())
	{
		if (Ctx.WorldType == EWorldType::PIE || Ctx.WorldType == EWorldType::Game) { World = Ctx.World(); }
	}
	if (!World) { Test->AddError(TEXT("No game world")); return true; }
	int32 Generators = 0, Storms = 0;
	for (TActorIterator<ABRWorldGenerator> It(World); It; ++It) { ++Generators; Test->TestTrue(TEXT("World generated"), It->IsGenerated()); }
	for (TActorIterator<ABRStormController> It(World); It; ++It) { ++Storms; }
	Test->TestEqual(TEXT("One world generator"), Generators, 1);
	Test->TestEqual(TEXT("One storm controller"), Storms, 1);
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FBRMatchSmokeTest, "BR.Functional.MatchBoots", EAutomationTestFlags::EditorContext | EAutomationTestFlags::ClientContext | EAutomationTestFlags::EngineFilter)
bool FBRMatchSmokeTest::RunTest(const FString& Parameters)
{
	AutomationOpenMap(TEXT("/Engine/Maps/Entry?game=BR?Mode=Range"));
	ADD_LATENT_AUTOMATION_COMMAND(FWaitLatentCommand(8.f));
	ADD_LATENT_AUTOMATION_COMMAND(FBRCheckMatchWorld(this));
	return true;
}

#endif
