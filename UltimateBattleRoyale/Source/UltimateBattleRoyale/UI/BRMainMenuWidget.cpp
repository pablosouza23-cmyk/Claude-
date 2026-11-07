#include "UI/BRMainMenuWidget.h"

#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/HorizontalBox.h"
#include "Components/ScrollBox.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "EngineUtils.h"
#include "GameModes/BRFrontEndGameMode.h"
#include "GameModes/BRModeRules.h"
#include "Matchmaking/BRSessionSubsystem.h"
#include "Multiplayer/BRGameInstance.h"
#include "Progression/BRProgressionSubsystem.h"

#define LOCTEXT_NAMESPACE "BRMainMenu"

namespace
{
	const FLinearColor Gold(1.f, 0.82f, 0.2f);
	const FLinearColor Dim(0.8f, 0.85f, 0.95f);
}

void UBRMainMenuWidget::BuildLayout()
{
	UCanvasPanel* Root = WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("Root"));
	WidgetTree->RootWidget = Root;

	// Header: title, level/XP, coins.
	UBorder* Header = MakePanel(FLinearColor(0.02f, 0.04f, 0.12f, 0.85f), 10.f);
	UHorizontalBox* HeaderRow = MakeRow();
	AddTo(HeaderRow, MakeText(LOCTEXT("Title", "ULTIMATE BATTLE ROYALE"), 26, Gold), 8.f, true);
	HeaderText = MakeText(FText::GetEmpty(), 18);
	AddTo(HeaderRow, HeaderText, 8.f);
	Header->SetContent(HeaderRow);
	if (UCanvasPanelSlot* S = Root->AddChildToCanvas(Header))
	{
		S->SetAnchors(FAnchors(0.f, 0.f, 1.f, 0.f));
		S->SetOffsets(FMargin(0.f, 0.f, 0.f, 64.f));
	}

	// Tab bar (left column).
	UVerticalBox* Tabs = MakeColumn();
	const FText Names[] = { LOCTEXT("Play", "JOGAR"), LOCTEXT("Modes", "MODOS"), LOCTEXT("Character", "PERSONAGEM"), LOCTEXT("Shop", "LOJA"),
		LOCTEXT("Pass", "PASSE DE TEMPORADA"), LOCTEXT("Inventory", "INVENTÁRIO"), LOCTEXT("Friends", "AMIGOS"), LOCTEXT("Settings", "CONFIGURAÇÕES") };
	TWeakObjectPtr<UBRMainMenuWidget> Self = this;
	for (int32 I = 0; I < 8; ++I)
	{
		AddTo(Tabs, MakeButton(Names[I], [Self, I]() { if (Self.IsValid()) { Self->ShowTab(I); } }, I == 0 ? FLinearColor(0.95f, 0.65f, 0.1f) : FLinearColor(0.1f, 0.25f, 0.6f), 20), 5.f);
	}
	if (UCanvasPanelSlot* S = Root->AddChildToCanvas(Tabs))
	{
		S->SetAnchors(FAnchors(0.f, 0.f));
		S->SetPosition(FVector2D(24.f, 90.f));
		S->SetSize(FVector2D(300.f, 560.f));
	}

	// Content panel (right side; the 3D lobby character stands in the middle).
	UBorder* Panel = MakePanel(FLinearColor(0.02f, 0.03f, 0.08f, 0.82f), 18.f);
	UScrollBox* Scroll = MakeScroll();
	Content = MakeColumn();
	Scroll->AddChild(Content);
	Panel->SetContent(Scroll);
	if (UCanvasPanelSlot* S = Root->AddChildToCanvas(Panel))
	{
		S->SetAnchors(FAnchors(1.f, 0.f, 1.f, 1.f));
		S->SetAlignment(FVector2D(1.f, 0.f));
		S->SetOffsets(FMargin(-24.f, 90.f, 620.f, 90.f));
	}

	StatusText = MakeText(FText::GetEmpty(), 16, Gold);
	if (UCanvasPanelSlot* S = Root->AddChildToCanvas(StatusText))
	{
		S->SetAnchors(FAnchors(0.f, 1.f));
		S->SetAlignment(FVector2D(0.f, 1.f));
		S->SetPosition(FVector2D(24.f, -24.f));
		S->SetAutoSize(true);
	}
}

void UBRMainMenuWidget::NativeConstruct()
{
	Super::NativeConstruct();
	TWeakObjectPtr<UBRMainMenuWidget> Self = this;
	if (UBRProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UBRProgressionSubsystem>())
	{
		ProfileHandle = Prog->OnProfileChanged.AddWeakLambda(this, [Self]()
		{
			if (!Self.IsValid()) { return; }
			Self->RefreshHeader();
			// Server-confirmed changes (purchases, claims) refresh the tab that requested them.
			if (Self->CurrentTab >= 2 && Self->CurrentTab <= 5) { Self->ShowTab(Self->CurrentTab); }
		});
		BackendHandle = Prog->OnBackendMessage.AddWeakLambda(this, [Self](const FText& Message) { if (Self.IsValid()) { Self->SetStatus(Message); } });
	}
	if (UBRSessionSubsystem* Sessions = GetGameInstance()->GetSubsystem<UBRSessionSubsystem>())
	{
		StatusHandle = Sessions->OnStatusChanged.AddWeakLambda(this, [Self](EBRSessionStatus, const FText& Text) { if (Self.IsValid()) { Self->SetStatus(Text); } });
		FriendsHandle = Sessions->OnFriendsUpdated.AddWeakLambda(this, [Self]() { if (Self.IsValid() && Self->CurrentTab == 6) { Self->ShowTab(6); } });
	}
	if (UBRGameInstance* GI = GetGameInstance<UBRGameInstance>())
	{
		const FText Msg = GI->ConsumePendingMessage();
		if (!Msg.IsEmpty()) { SetStatus(Msg); }
	}
	RefreshHeader();
	ShowTab(0);
}

void UBRMainMenuWidget::NativeDestruct()
{
	if (UBRProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UBRProgressionSubsystem>())
	{
		Prog->OnProfileChanged.Remove(ProfileHandle);
		Prog->OnBackendMessage.Remove(BackendHandle);
	}
	if (UBRSessionSubsystem* Sessions = GetGameInstance()->GetSubsystem<UBRSessionSubsystem>())
	{
		Sessions->OnStatusChanged.Remove(StatusHandle);
		Sessions->OnFriendsUpdated.Remove(FriendsHandle);
	}
	Super::NativeDestruct();
}

ABRLobbyScene* UBRMainMenuWidget::GetLobby() const
{
	for (TActorIterator<ABRLobbyScene> It(GetWorld()); It; ++It) { return *It; }
	return nullptr;
}

void UBRMainMenuWidget::SetStatus(const FText& Text)
{
	if (StatusText) { StatusText->SetText(Text); }
}

void UBRMainMenuWidget::RefreshHeader()
{
	const UBRProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UBRProgressionSubsystem>();
	if (!Prog || !HeaderText) { return; }
	HeaderText->SetText(FText::Format(LOCTEXT("Header", "Nível {0}  ({1}/{2} XP)    Passe: nível {3}    Moedas: {4}"),
		FText::AsNumber(Prog->GetLevel()), FText::AsNumber(Prog->GetXpIntoLevel()), FText::AsNumber(Prog->GetXpForNextLevel()),
		FText::AsNumber(Prog->GetSeasonTier()), FText::AsNumber(Prog->GetCoins())));
	if (ABRLobbyScene* Lobby = GetLobby()) { Lobby->RefreshLoadout(); }
}

void UBRMainMenuWidget::ShowTab(int32 Tab)
{
	CurrentTab = Tab;
	Content->ClearChildren();
	switch (Tab)
	{
	case 1: BuildModes(); break;
	case 2: BuildCharacter(); break;
	case 3: BuildShop(); break;
	case 4: BuildPass(); break;
	case 5: BuildInventory(); break;
	case 6: BuildFriends(); break;
	case 7: BuildSettings(); break;
	default: BuildPlay(); break;
	}
}

// ------------------------------------------------------------------------------------------- tabs
void UBRMainMenuWidget::BuildPlay()
{
	UBRSessionSubsystem* Sessions = GetGameInstance()->GetSubsystem<UBRSessionSubsystem>();
	UBRGameInstance* GI = GetGameInstance<UBRGameInstance>();
	const EBRGameModeType Mode = SelectedMode;
	TWeakObjectPtr<UBRMainMenuWidget> Self = this;

	AddTo(Content, MakeText(LOCTEXT("PlayTitle", "Jogar"), 30, Gold));
	AddTo(Content, MakeText(FText::Format(LOCTEXT("Selected", "Modo selecionado: {0}"), BRTypes::ModeName(Mode)), 18));
	const bool bLocalOnly = Mode == EBRGameModeType::Training || Mode == EBRGameModeType::ShootingRange || Mode == EBRGameModeType::Creative;
	if (!bLocalOnly)
	{
		AddTo(Content, MakeButton(LOCTEXT("FindMatch", "PROCURAR PARTIDA ONLINE"), [Sessions, Mode]() { if (Sessions) { Sessions->FindMatch(Mode); } }, FLinearColor(0.95f, 0.65f, 0.1f), 24));
		AddTo(Content, MakeText(FText::Format(LOCTEXT("OnlineInfo", "Servidores dedicados via {0}. Partidas online só com jogadores reais (bots apenas no Treinamento)."),
			FText::FromString(Sessions ? Sessions->GetSubsystemName() : TEXT("-"))), 13, Dim, false));
		AddTo(Content, MakeButton(LOCTEXT("Cancel", "Cancelar busca"), [Sessions]() { if (Sessions) { Sessions->CancelSearch(); } }, FLinearColor(0.35f, 0.3f, 0.3f), 16));
	}
	AddTo(Content, MakeButton(LOCTEXT("Host", "Criar partida privada (anfitrião)"), [Sessions, Mode]() { if (Sessions) { Sessions->HostPrivateMatch(Mode, FBRModeRules::ForMode(Mode).MaxPlayers); } }, FLinearColor(0.2f, 0.45f, 0.75f), 18));
	AddTo(Content, MakeButton(LOCTEXT("Offline", "Treinamento offline com bots"), [GI]() { if (GI) { GI->StartLocalMatch(EBRGameModeType::Training); } }, FLinearColor(0.2f, 0.5f, 0.3f), 18));
	if (bLocalOnly)
	{
		AddTo(Content, MakeButton(FText::Format(LOCTEXT("StartLocal", "Iniciar {0}"), BRTypes::ModeName(Mode)), [GI, Mode]() { if (GI) { GI->StartLocalMatch(Mode); } }, FLinearColor(0.95f, 0.65f, 0.1f), 22));
	}
	if (Sessions && Sessions->CanReconnect())
	{
		AddTo(Content, MakeButton(LOCTEXT("Reconnect", "Reconectar à última partida"), [Sessions]() { Sessions->Reconnect(); }, FLinearColor(0.6f, 0.3f, 0.1f), 18));
	}
	AddTo(Content, MakeText(LOCTEXT("PartyTitle", "Grupo"), 22, Gold));
	if (Sessions && Sessions->IsInParty())
	{
		AddTo(Content, MakeText(Sessions->IsPartyLeader() ? LOCTEXT("Leader", "Você é o líder do grupo. Ao procurar partida, o grupo vai junto.") : LOCTEXT("Member", "Você está em um grupo. Aguarde o líder iniciar."), 14, Dim, false));
		AddTo(Content, MakeButton(LOCTEXT("LeaveParty", "Sair do grupo"), [Sessions, Self]() { Sessions->LeaveParty(); if (Self.IsValid()) { Self->ShowTab(0); } }, FLinearColor(0.5f, 0.2f, 0.15f), 16));
	}
	else
	{
		AddTo(Content, MakeButton(LOCTEXT("CreateParty", "Criar grupo e convidar amigos"), [Sessions, Self]() { if (Sessions) { Sessions->CreateParty(); } if (Self.IsValid()) { Self->ShowTab(6); } }, FLinearColor(0.2f, 0.35f, 0.55f), 16));
	}
	if (ABRLobbyScene* Lobby = GetLobby())
	{
		TWeakObjectPtr<ABRLobbyScene> WeakLobby = Lobby;
		UHorizontalBox* Rot = MakeRow();
		AddTo(Rot, MakeButton(FText::FromString(TEXT("<")), [WeakLobby]() { if (WeakLobby.IsValid()) { WeakLobby->RotatePreview(-30.f); } }, FLinearColor(0.2f, 0.2f, 0.25f), 18));
		AddTo(Rot, MakeText(LOCTEXT("Rotate", "Girar personagem"), 14, Dim, false));
		AddTo(Rot, MakeButton(FText::FromString(TEXT(">")), [WeakLobby]() { if (WeakLobby.IsValid()) { WeakLobby->RotatePreview(30.f); } }, FLinearColor(0.2f, 0.2f, 0.25f), 18));
		AddTo(Content, Rot);
	}
}

void UBRMainMenuWidget::BuildModes()
{
	AddTo(Content, MakeText(LOCTEXT("ModesTitle", "Modos de jogo"), 30, Gold));
	struct FModeInfo { EBRGameModeType Mode; FText Desc; };
	const FModeInfo Modes[] = {
		{ EBRGameModeType::Solo, LOCTEXT("SoloD", "Até 100 jogadores, cada um por si.") },
		{ EBRGameModeType::Duos, LOCTEXT("DuosD", "Equipes de 2. Derrubar e reanimar.") },
		{ EBRGameModeType::Squads, LOCTEXT("SquadsD", "Equipes de 4. Derrubar e reanimar.") },
		{ EBRGameModeType::BuildBattle, LOCTEXT("BuildD", "50 jogadores, começa com 500 de cada material.") },
		{ EBRGameModeType::ZeroBuild, LOCTEXT("ZeroD", "Sem construção: só tiro, cobertura e movimento.") },
		{ EBRGameModeType::Training, LOCTEXT("TrainD", "Offline contra bots identificados. Progresso reduzido.") },
		{ EBRGameModeType::ShootingRange, LOCTEXT("RangeD", "Alvos fixos e móveis, todas as armas, munição infinita.") },
		{ EBRGameModeType::Creative, LOCTEXT("CreativeD", "Construa sem limites e salve/carregue suas ilhas.") },
	};
	TWeakObjectPtr<UBRMainMenuWidget> Self = this;
	for (const FModeInfo& M : Modes)
	{
		const EBRGameModeType Mode = M.Mode;
		UHorizontalBox* Row = MakeRow();
		AddTo(Row, MakeButton(BRTypes::ModeName(Mode), [Self, Mode]() { if (Self.IsValid()) { Self->SelectedMode = Mode; Self->ShowTab(0); } },
			Mode == SelectedMode ? FLinearColor(0.95f, 0.65f, 0.1f) : FLinearColor(0.12f, 0.3f, 0.65f), 17));
		AddTo(Row, MakeText(M.Desc, 13, Dim, false), 6.f, true);
		AddTo(Content, Row);
	}
}

void UBRMainMenuWidget::BuildCharacter()
{
	UBRProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UBRProgressionSubsystem>();
	if (!Prog) { return; }
	TWeakObjectPtr<UBRMainMenuWidget> Self = this;
	AddTo(Content, MakeText(LOCTEXT("CharTitle", "Personagem"), 30, Gold));

	// Customisation (works with every outfit).
	const FBRCosmeticLoadout& L = Prog->GetLoadout();
	const TCHAR* BodyTypes[] = { TEXT("Masculino"), TEXT("Feminino") };
	const TCHAR* Styles[] = { TEXT("Padrão"), TEXT("Esbelto"), TEXT("Forte") };
	const TCHAR* Hair[] = { TEXT("Curto"), TEXT("Longo"), TEXT("Rabo de cavalo"), TEXT("Espetado"), TEXT("Careca") };
	const TCHAR* Gear[] = { TEXT("Do traje"), TEXT("Capacete"), TEXT("Máscara"), TEXT("Boné"), TEXT("Capuz") };
	const TCHAR* Colors[] = { TEXT("Original"), TEXT("Variante 2"), TEXT("Variante 3") };
	auto Step = [Prog, Self](int32 Field, int32 Delta, int32 Count)
	{
		FBRCosmeticLoadout C = Prog->GetLoadout();
		uint8* Values[] = { &C.BodyType, &C.BodyStyle, &C.HairStyle, &C.HeadGear, &C.ColorVariant };
		*Values[Field] = uint8((int32(*Values[Field]) + Delta + Count) % Count);
		Prog->SetCustomization(C.BodyType, C.BodyStyle, C.HairStyle, C.HeadGear, C.ColorVariant);
	};
	AddTo(Content, MakeStepper(LOCTEXT("Body", "Corpo"), [Prog, BodyTypes]() { return FText::FromString(BodyTypes[Prog->GetLoadout().BodyType % 2]); }, [Step](int32 D) { Step(0, D, 2); }));
	AddTo(Content, MakeStepper(LOCTEXT("Style", "Estilo corporal"), [Prog, Styles]() { return FText::FromString(Styles[Prog->GetLoadout().BodyStyle % 3]); }, [Step](int32 D) { Step(1, D, 3); }));
	AddTo(Content, MakeStepper(LOCTEXT("Hair", "Cabelo"), [Prog, Hair]() { return FText::FromString(Hair[Prog->GetLoadout().HairStyle % 5]); }, [Step](int32 D) { Step(2, D, 5); }));
	AddTo(Content, MakeStepper(LOCTEXT("Gear", "Capacete / máscara"), [Prog, Gear]() { return FText::FromString(Gear[Prog->GetLoadout().HeadGear % 5]); }, [Step](int32 D) { Step(3, D, 5); }));
	AddTo(Content, MakeStepper(LOCTEXT("Colors", "Cores do traje"), [Prog, Colors]() { return FText::FromString(Colors[Prog->GetLoadout().ColorVariant % 3]); }, [Step](int32 D) { Step(4, D, 3); }));
	(void)L;

	// Equip owned items per category.
	const EBRCosmeticType Types[] = { EBRCosmeticType::Outfit, EBRCosmeticType::Backpack, EBRCosmeticType::Pickaxe, EBRCosmeticType::Glider, EBRCosmeticType::Emote };
	const FText TypeNames[] = { LOCTEXT("Outfits", "Trajes"), LOCTEXT("Backpacks", "Mochilas"), LOCTEXT("Pickaxes", "Picaretas"), LOCTEXT("Gliders", "Planadores"), LOCTEXT("Emotes", "Gestos") };
	for (int32 T = 0; T < 5; ++T)
	{
		AddTo(Content, MakeText(TypeNames[T], 20, Gold));
		TArray<const FBRCosmeticDef*> Items;
		UBRCosmeticCatalog::GetByType(Types[T], Items);
		for (const FBRCosmeticDef* D : Items)
		{
			if (!Prog->Owns(D->Id)) { continue; }
			const FName Id = D->Id;
			const bool bEquipped = Prog->GetLoadout().Outfit == Id || Prog->GetLoadout().Backpack == Id || Prog->GetLoadout().Pickaxe == Id
				|| Prog->GetLoadout().Glider == Id || Prog->GetLoadout().Emotes.Contains(Id);
			UHorizontalBox* Row = MakeRow();
			AddTo(Row, MakeText(D->Name, 16, BRTypes::RarityColor(D->Rarity)), 4.f, true);
			if (Types[T] == EBRCosmeticType::Emote)
			{
				AddTo(Row, MakeButton(LOCTEXT("Preview", "Ver"), [Self, Id]() { if (Self.IsValid()) { if (ABRLobbyScene* Lobby = Self->GetLobby()) { Lobby->PlayEmote(Id); } } }, FLinearColor(0.25f, 0.25f, 0.35f), 14));
				for (int32 EmoteSlot = 0; EmoteSlot < 3; ++EmoteSlot)
				{
					AddTo(Row, MakeButton(FText::Format(LOCTEXT("EmoteSlot", "Slot {0}"), FText::AsNumber(EmoteSlot + 1)), [Prog, Id, EmoteSlot, Self]() { Prog->Equip(Id, EmoteSlot); if (Self.IsValid()) { Self->ShowTab(2); } }, FLinearColor(0.15f, 0.35f, 0.55f), 13));
				}
			}
			else
			{
				AddTo(Row, MakeButton(bEquipped ? LOCTEXT("Equipped", "Equipado") : LOCTEXT("Equip", "Equipar"), [Prog, Id, Self]() { Prog->Equip(Id); if (Self.IsValid()) { Self->ShowTab(2); } },
					bEquipped ? FLinearColor(0.2f, 0.5f, 0.25f) : FLinearColor(0.15f, 0.35f, 0.55f), 14));
			}
			AddTo(Content, Row);
		}
	}
}

void UBRMainMenuWidget::BuildShop()
{
	UBRProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UBRProgressionSubsystem>();
	if (!Prog) { return; }
	TWeakObjectPtr<UBRMainMenuWidget> Self = this;
	AddTo(Content, MakeText(LOCTEXT("ShopTitle", "Loja do dia"), 30, Gold));
	AddTo(Content, MakeText(LOCTEXT("ShopInfo", "Itens cosméticos originais. Moedas são ganhas jogando (sem compras com dinheiro real nesta versão). A seleção muda todo dia."), 13, Dim, false));
	TArray<const FBRCosmeticDef*> Items;
	Prog->GetShopItems(Items);
	for (const FBRCosmeticDef* D : Items)
	{
		const FName Id = D->Id;
		UHorizontalBox* Row = MakeRow();
		UVerticalBox* Info = MakeColumn();
		AddTo(Info, MakeText(D->Name, 18, BRTypes::RarityColor(D->Rarity)), 1.f);
		AddTo(Info, MakeText(D->Description, 12, Dim, false), 1.f);
		AddTo(Row, Info, 4.f, true);
		const bool bOwned = Prog->Owns(Id);
		AddTo(Row, MakeButton(bOwned ? LOCTEXT("Owned", "Adquirido") : FText::Format(LOCTEXT("Buy", "{0} moedas"), FText::AsNumber(D->Price)), [Prog, Id, Self]()
		{
			const EBRPurchaseResult R = Prog->Purchase(Id);
			if (!Self.IsValid()) { return; }
			switch (R)
			{
			case EBRPurchaseResult::Success: Self->SetStatus(LOCTEXT("Bought", "Compra concluída! Equipe em Personagem.")); break;
			case EBRPurchaseResult::Pending: Self->SetStatus(LOCTEXT("Pending", "Processando compra no servidor...")); return;
			case EBRPurchaseResult::NotEnoughCoins: Self->SetStatus(LOCTEXT("NoCoins", "Moedas insuficientes. Jogue partidas para ganhar mais.")); break;
			case EBRPurchaseResult::AlreadyOwned: Self->SetStatus(LOCTEXT("AlreadyOwned", "Você já possui este item.")); break;
			default: Self->SetStatus(LOCTEXT("NotForSale", "Item indisponível.")); break;
			}
			Self->ShowTab(3);
		}, bOwned ? FLinearColor(0.2f, 0.4f, 0.25f) : FLinearColor(0.95f, 0.6f, 0.1f), 16));
		AddTo(Content, Row);
	}
}

void UBRMainMenuWidget::BuildPass()
{
	UBRProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UBRProgressionSubsystem>();
	if (!Prog) { return; }
	TWeakObjectPtr<UBRMainMenuWidget> Self = this;
	AddTo(Content, MakeText(LOCTEXT("PassTitle", "Passe de Temporada"), 30, Gold));
	AddTo(Content, MakeText(FText::Format(LOCTEXT("PassProgress", "Nível {0} de {1}  —  {2}% para o próximo"), FText::AsNumber(Prog->GetSeasonTier()),
		FText::AsNumber(BRRules::SeasonPassTiers), FText::AsNumber(FMath::RoundToInt(Prog->GetSeasonTierProgress() * 100.f))), 18));
	if (!Prog->HasPremiumPass())
	{
		AddTo(Content, MakeButton(FText::Format(LOCTEXT("BuyPass", "Desbloquear trilha premium ({0} moedas)"), FText::AsNumber(UBRProgressionSubsystem::PremiumPassPrice)), [Prog, Self]()
		{
			const bool bOk = Prog->BuyPremiumPass();
			if (Self.IsValid() && !Prog->IsBackendAuthoritative()) { Self->SetStatus(bOk ? LOCTEXT("PassOk", "Passe premium desbloqueado!") : LOCTEXT("PassNo", "Moedas insuficientes.")); Self->ShowTab(4); }
		}, FLinearColor(0.75f, 0.45f, 0.95f), 18));
	}
	for (const FBRSeasonReward& R : UBRCosmeticCatalog::SeasonRewards())
	{
		const int32 Tier = R.Tier; const bool bPremium = R.bPremium;
		FText RewardText = R.CosmeticId.IsNone() ? FText::Format(LOCTEXT("Coins", "{0} moedas"), FText::AsNumber(R.Coins))
			: (UBRCosmeticCatalog::Find(R.CosmeticId) ? UBRCosmeticCatalog::Find(R.CosmeticId)->Name : FText::FromName(R.CosmeticId));
		UHorizontalBox* Row = MakeRow();
		AddTo(Row, MakeText(FText::Format(LOCTEXT("TierRow", "Nível {0} {1}: {2}"), FText::AsNumber(Tier), bPremium ? LOCTEXT("Prem", "[Premium]") : LOCTEXT("Free", "[Grátis]"), RewardText), 14,
			bPremium ? FLinearColor(0.85f, 0.65f, 1.f) : FLinearColor::White, false), 4.f, true);
		const bool bClaimed = Prog->IsTierClaimed(Tier, bPremium);
		const bool bCan = Tier <= Prog->GetSeasonTier() && (!bPremium || Prog->HasPremiumPass());
		AddTo(Row, MakeButton(bClaimed ? LOCTEXT("Claimed", "Resgatado") : (bCan ? LOCTEXT("Claim", "Resgatar") : LOCTEXT("Locked", "Bloqueado")), [Prog, Tier, bPremium, Self]()
		{
			if (Prog->ClaimTier(Tier, bPremium) && Self.IsValid() && !Prog->IsBackendAuthoritative()) { Self->SetStatus(LOCTEXT("ClaimOk", "Recompensa resgatada!")); Self->ShowTab(4); }
		}, bClaimed ? FLinearColor(0.2f, 0.35f, 0.2f) : (bCan ? FLinearColor(0.95f, 0.6f, 0.1f) : FLinearColor(0.25f, 0.25f, 0.28f)), 13));
		AddTo(Content, Row, 2.f);
	}
}

void UBRMainMenuWidget::BuildInventory()
{
	UBRProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UBRProgressionSubsystem>();
	if (!Prog) { return; }
	AddTo(Content, MakeText(LOCTEXT("InvTitle", "Inventário e estatísticas"), 30, Gold));
	AddTo(Content, MakeText(LOCTEXT("Challenges", "Desafios"), 22, Gold));
	for (const FBRChallenge& C : Prog->GetChallenges())
	{
		AddTo(Content, MakeText(FText::Format(LOCTEXT("ChallengeRow", "{0} {1}: {2}/{3}  (+{4} XP){5}"), C.bWeekly ? LOCTEXT("Weekly", "[Semanal]") : LOCTEXT("Daily", "[Diário]"),
			C.Description, FText::AsNumber(C.Progress), FText::AsNumber(C.Target), FText::AsNumber(C.XpReward), C.bCompleted ? LOCTEXT("Done", "  — concluído") : FText::GetEmpty()), 14,
			C.bCompleted ? FLinearColor(0.5f, 1.f, 0.6f) : FLinearColor::White, false), 2.f);
	}
	AddTo(Content, MakeText(LOCTEXT("Stats", "Estatísticas"), 22, Gold));
	const TCHAR* StatKeys[] = { TEXT("Matches"), TEXT("Wins"), TEXT("Top10"), TEXT("Eliminations"), TEXT("Revives"), TEXT("ChestsOpened"), TEXT("DamageDealt"), TEXT("MinutesSurvived") };
	const TCHAR* StatNames[] = { TEXT("Partidas"), TEXT("Vitórias"), TEXT("Top 10"), TEXT("Eliminações"), TEXT("Reanimações"), TEXT("Baús abertos"), TEXT("Dano causado"), TEXT("Minutos sobrevividos") };
	for (int32 I = 0; I < 8; ++I)
	{
		AddTo(Content, MakeText(FText::FromString(FString::Printf(TEXT("%s: %lld"), StatNames[I], Prog->GetStat(StatKeys[I]))), 15, FLinearColor::White, false), 2.f);
	}
	AddTo(Content, MakeText(LOCTEXT("Owned", "Itens cosméticos"), 22, Gold));
	int32 Count = 0;
	for (const FBRCosmeticDef& D : UBRCosmeticCatalog::All())
	{
		if (Prog->Owns(D.Id)) { AddTo(Content, MakeText(FText::Format(LOCTEXT("OwnedRow", "{0} — {1}"), D.Name, BRTypes::RarityName(D.Rarity)), 14, BRTypes::RarityColor(D.Rarity), false), 1.f); ++Count; }
	}
	AddTo(Content, MakeText(FText::Format(LOCTEXT("OwnedCount", "{0} de {1} itens"), FText::AsNumber(Count), FText::AsNumber(UBRCosmeticCatalog::All().Num())), 13, Dim, false));
}

void UBRMainMenuWidget::BuildFriends()
{
	UBRSessionSubsystem* Sessions = GetGameInstance()->GetSubsystem<UBRSessionSubsystem>();
	AddTo(Content, MakeText(LOCTEXT("FriendsTitle", "Amigos"), 30, Gold));
	if (!Sessions || !Sessions->IsOnlineAvailable())
	{
		AddTo(Content, MakeText(LOCTEXT("NoFriends", "Lista de amigos requer login online (Epic Online Services). Configure o EOS conforme Docs/ONLINE.md."), 14, Dim, false));
		return;
	}
	AddTo(Content, MakeButton(LOCTEXT("Refresh", "Atualizar lista"), [Sessions]() { Sessions->RefreshFriends(); }, FLinearColor(0.2f, 0.35f, 0.55f), 16));
	if (Sessions->GetFriends().Num() == 0)
	{
		AddTo(Content, MakeText(LOCTEXT("Empty", "Nenhum amigo carregado ainda."), 14, Dim, false));
	}
	for (const FBRFriendInfo& F : Sessions->GetFriends())
	{
		const FString Id = F.Id;
		UHorizontalBox* Row = MakeRow();
		AddTo(Row, MakeText(FText::FromString(F.DisplayName), 16, F.bOnline ? FLinearColor(0.5f, 1.f, 0.6f) : Dim), 4.f, true);
		AddTo(Row, MakeText(F.bPlayingThisGame ? LOCTEXT("InGame", "jogando") : (F.bOnline ? LOCTEXT("Online", "online") : LOCTEXT("Offline", "offline")), 13, Dim, false));
		AddTo(Row, MakeButton(LOCTEXT("Invite", "Convidar"), [Sessions, Id]() { Sessions->InviteFriend(Id); }, FLinearColor(0.95f, 0.6f, 0.1f), 14));
		AddTo(Content, Row);
	}
}

void UBRMainMenuWidget::BuildSettings()
{
	AddTo(Content, MakeText(LOCTEXT("SettingsTitle", "Configurações"), 30, Gold));
	TWeakObjectPtr<UBRMainMenuWidget> Self = this;
	BuildSettingsPanel(Content, [Self]() { if (Self.IsValid()) { Self->ShowTab(7); } });
}

#undef LOCTEXT_NAMESPACE
