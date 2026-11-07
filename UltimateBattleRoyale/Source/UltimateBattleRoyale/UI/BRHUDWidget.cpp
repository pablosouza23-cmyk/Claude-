#include "UI/BRHUDWidget.h"

#include "Blueprint/WidgetLayoutLibrary.h"
#include "Blueprint/WidgetTree.h"
#include "Building/BRBuildComponent.h"
#include "Characters/BRCharacter.h"
#include "Characters/BRCharacterMovementComponent.h"
#include "Characters/BRHealthComponent.h"
#include "Characters/BRInteractable.h"
#include "Components/Border.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/EditableTextBox.h"
#include "Components/ScrollBox.h"
#include "Components/VerticalBox.h"
#include "Engine/Texture2D.h"
#include "Fonts/FontMeasure.h"
#include "Framework/Application/SlateApplication.h"
#include "GameModes/BRGameState.h"
#include "GameModes/BRPlayerController.h"
#include "GameModes/BRPlayerState.h"
#include "Inventory/BRInventoryComponent.h"
#include "Items/BRItemRegistry.h"
#include "Multiplayer/BRGameInstance.h"
#include "Rendering/DrawElements.h"
#include "Settings/BRGameUserSettings.h"
#include "Settings/BRPerformanceSubsystem.h"
#include "Styling/CoreStyle.h"
#include "Systems/BRBattleBus.h"
#include "Systems/BRStormController.h"
#include "Vehicles/BRVehicle.h"
#include "Weapons/BRWeapon.h"
#include "World/BRWorldGenerator.h"
#include "World/BRWorldSubsystem.h"

#define LOCTEXT_NAMESPACE "BRHUD"

namespace
{
	const FSlateBrush* White() { return FCoreStyle::Get().GetBrush("WhiteBrush"); }

	void Rect(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G, FVector2D Pos, FVector2D Size, const FLinearColor& C)
	{
		FSlateDrawElement::MakeBox(Out, Layer, G.ToPaintGeometry(Size, FSlateLayoutTransform(Pos)), White(), ESlateDrawEffect::None, C);
	}

	FVector2D Measure(const FString& S, const FSlateFontInfo& F)
	{
		return FSlateApplication::IsInitialized() ? FVector2D(FSlateApplication::Get().GetRenderer()->GetFontMeasureService()->Measure(S, F)) : FVector2D(S.Len() * F.Size * 0.6f, F.Size);
	}

	// Anchor: 0 = left, 1 = centre, 2 = right.
	void Text(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G, FVector2D Pos, const FString& S, int32 Size, const FLinearColor& C, int32 Anchor = 0)
	{
		const FSlateFontInfo F = FCoreStyle::GetDefaultFontStyle("Bold", Size);
		const FVector2D M = Measure(S, F);
		if (Anchor == 1) { Pos.X -= M.X * 0.5f; }
		else if (Anchor == 2) { Pos.X -= M.X; }
		FSlateDrawElement::MakeText(Out, Layer, G.ToPaintGeometry(M, FSlateLayoutTransform(Pos + FVector2D(1.5f, 1.5f))), S, F, ESlateDrawEffect::None, FLinearColor(0, 0, 0, C.A * 0.7f));
		FSlateDrawElement::MakeText(Out, Layer + 1, G.ToPaintGeometry(M, FSlateLayoutTransform(Pos)), S, F, ESlateDrawEffect::None, C);
	}

	void Lines(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G, const TArray<FVector2D>& Pts, const FLinearColor& C, float Thickness)
	{
		FSlateDrawElement::MakeLines(Out, Layer, G.ToPaintGeometry(), Pts, ESlateDrawEffect::None, C, true, Thickness);
	}

	void Circle(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G, FVector2D Center, float Radius, const FLinearColor& C, float Thickness, int32 Segments = 48)
	{
		TArray<FVector2D> Pts;
		for (int32 I = 0; I <= Segments; ++I)
		{
			const float A = 2.f * PI * I / Segments;
			Pts.Add(Center + FVector2D(FMath::Cos(A), FMath::Sin(A)) * Radius);
		}
		Lines(Out, Layer, G, Pts, C, Thickness);
	}

	FString TimeString(float Seconds)
	{
		const int32 S = FMath::Max(0, FMath::CeilToInt(Seconds));
		return FString::Printf(TEXT("%d:%02d"), S / 60, S % 60);
	}

	// Compass heading (0 = north = +Y world, clockwise).
	float HeadingFromYaw(float Yaw) { return FRotator::ClampAxis(90.f - Yaw); }
}

// ------------------------------------------------------------------------------------------------ layout
void UBRHUDWidget::BuildLayout()
{
	Root = WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("Root"));
	WidgetTree->RootWidget = Root;
	SetVisibility(ESlateVisibility::SelfHitTestInvisible);
	Root->SetVisibility(ESlateVisibility::SelfHitTestInvisible);

	ChatBox = WidgetTree->ConstructWidget<UEditableTextBox>(UEditableTextBox::StaticClass(), TEXT("Chat"));
	ChatBox->SetHintText(LOCTEXT("ChatHint", "Mensagem (/e = equipe)"));
	ChatBox->OnTextCommitted.AddDynamic(this, &UBRHUDWidget::OnChatCommitted);
	ChatBox->SetVisibility(ESlateVisibility::Collapsed);
	if (UCanvasPanelSlot* S = Root->AddChildToCanvas(ChatBox))
	{
		S->SetAnchors(FAnchors(0.f, 1.f));
		S->SetAlignment(FVector2D(0.f, 1.f));
		S->SetPosition(FVector2D(20.f, -230.f));
		S->SetSize(FVector2D(420.f, 36.f));
	}

	MenuPanel = MakePanel(FLinearColor(0.02f, 0.03f, 0.08f, 0.92f), 24.f);
	MenuPanel->SetVisibility(ESlateVisibility::Collapsed);
	UScrollBox* Scroll = MakeScroll();
	MenuContent = MakeColumn();
	Scroll->AddChild(MenuContent);
	MenuPanel->SetContent(Scroll);
	if (UCanvasPanelSlot* S = Root->AddChildToCanvas(MenuPanel))
	{
		S->SetAnchors(FAnchors(0.5f, 0.5f));
		S->SetAlignment(FVector2D(0.5f, 0.5f));
		S->SetSize(FVector2D(640.f, 620.f));
	}
}

void UBRHUDWidget::NativeConstruct()
{
	Super::NativeConstruct();
	MinimapBrush.DrawAs = ESlateBrushDrawType::Image;
}

void UBRHUDWidget::OnAnnouncement(const FText& Message)
{
	Announcement = Message;
	AnnouncementTime = Now;
}

void UBRHUDWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
	Super::NativeTick(MyGeometry, InDeltaTime);
	Now = GetWorld()->GetTimeSeconds();
	HitMarkers.RemoveAll([this](const FHitMarker& M) { return Now - M.Time > 1.f; });
	DamageIndicators.RemoveAll([this](const FDamageIndicator& D) { return Now - D.Time > 1.5f; });
	if (!bBoundGameState)
	{
		if (ABRGameState* GS = GetWorld()->GetGameState<ABRGameState>())
		{
			GS->OnAnnouncement.AddUObject(this, &UBRHUDWidget::OnAnnouncement);
			bBoundGameState = true;
		}
	}
}

void UBRHUDWidget::AddHitMarker(const FVector& WorldLocation, float Damage, bool bHeadshot, bool bShield, bool bEliminated)
{
	HitMarkers.Add({ WorldLocation + FVector(FMath::FRandRange(-20.f, 20.f), FMath::FRandRange(-20.f, 20.f), 0.f), Damage, bHeadshot, bShield, bEliminated, Now });
}

void UBRHUDWidget::AddDamageIndicator(const FVector& FromLocation, float Damage)
{
	DamageIndicators.Add({ FromLocation, Damage, Now });
}

void UBRHUDWidget::OpenChatInput()
{
	if (!ChatBox) { return; }
	ChatBox->SetVisibility(ESlateVisibility::Visible);
	ChatBox->SetText(FText::GetEmpty());
	ChatBox->SetKeyboardFocus();
	if (APlayerController* PC = GetOwningPlayer())
	{
		FInputModeGameAndUI Mode;
		Mode.SetWidgetToFocus(ChatBox->TakeWidget());
		PC->SetInputMode(Mode);
	}
}

void UBRHUDWidget::OnChatCommitted(const FText& Text, ETextCommit::Type Method)
{
	if (Method == ETextCommit::OnEnter)
	{
		FString Msg = Text.ToString();
		const bool bTeam = Msg.StartsWith(TEXT("/e "));
		if (bTeam) { Msg = Msg.RightChop(3); }
		if (ABRPlayerController* PC = Cast<ABRPlayerController>(GetOwningPlayer())) { PC->SendChat(Msg, bTeam); }
	}
	ChatBox->SetVisibility(ESlateVisibility::Collapsed);
	if (APlayerController* PC = GetOwningPlayer()) { PC->SetInputMode(FInputModeGameOnly()); }
}

// ------------------------------------------------------------------------------------------------ menu
void UBRHUDWidget::SetMenuOpen(bool bOpen)
{
	if (!MenuPanel) { return; }
	MenuPage = 0;
	MenuPanel->SetVisibility(bOpen ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
	if (bOpen) { RebuildMenu(); }
}

void UBRHUDWidget::RebuildMenu()
{
	MenuContent->ClearChildren();
	ABRPlayerController* PC = Cast<ABRPlayerController>(GetOwningPlayer());
	const ABRGameState* GS = GetWorld()->GetGameState<ABRGameState>();
	if (!PC) { return; }
	TWeakObjectPtr<UBRHUDWidget> Self = this;
	auto Page = [Self](int32 P) { if (Self.IsValid()) { Self->MenuPage = P; Self->RebuildMenu(); } };

	AddTo(MenuContent, MakeText(LOCTEXT("Paused", "Menu"), 30, FLinearColor(1.f, 0.85f, 0.2f)));
	if (MenuPage == 0)
	{
		AddTo(MenuContent, MakeButton(LOCTEXT("Resume", "Continuar"), [PC]() { PC->ToggleMenu(); }));
		AddTo(MenuContent, MakeButton(LOCTEXT("Settings", "Configurações"), [Page]() { Page(1); }));
		AddTo(MenuContent, MakeButton(LOCTEXT("Report", "Denunciar jogador"), [Page]() { Page(2); }));
		if (GS && GS->GetModeRules().bCreativeTools) { AddTo(MenuContent, MakeButton(LOCTEXT("Creative", "Ferramentas do Criativo"), [Page]() { Page(3); })); }
		AddTo(MenuContent, MakeButton(LOCTEXT("TeamChat", "Chat (Enter) — /e para equipe"), [PC]() { PC->ToggleMenu(); if (PC->GetHUDWidget()) { PC->GetHUDWidget()->OpenChatInput(); } }, FLinearColor(0.2f, 0.3f, 0.35f)));
		AddTo(MenuContent, MakeButton(LOCTEXT("Leave", "Sair da partida"), [PC]()
		{
			if (UBRGameInstance* GI = PC->GetGameInstance<UBRGameInstance>()) { GI->ReturnToMainMenu(LOCTEXT("Left", "Você saiu da partida.")); }
		}, FLinearColor(0.6f, 0.15f, 0.12f)));
	}
	else if (MenuPage == 1)
	{
		AddTo(MenuContent, MakeButton(LOCTEXT("Back", "Voltar"), [Page]() { Page(0); }, FLinearColor(0.3f, 0.3f, 0.35f)));
		BuildSettingsPanel(MenuContent, [Page]() { Page(1); });
	}
	else if (MenuPage == 2)
	{
		AddTo(MenuContent, MakeButton(LOCTEXT("Back2", "Voltar"), [Page]() { Page(0); }, FLinearColor(0.3f, 0.3f, 0.35f)));
		AddTo(MenuContent, MakeText(LOCTEXT("ReportHelp", "Escolha o jogador e o motivo. As denúncias ficam registradas no log da partida para moderação."), 14, FLinearColor::White, false));
		if (GS)
		{
			for (APlayerState* P : GS->PlayerArray)
			{
				if (!P || P == PC->PlayerState || P->IsABot()) { continue; }
				TWeakObjectPtr<APlayerState> WeakP = P;
				UHorizontalBox* Row = MakeRow();
				AddTo(Row, MakeText(FText::FromString(P->GetPlayerName()), 16), 4.f, true);
				AddTo(Row, MakeButton(LOCTEXT("Cheat", "Trapaça"), [PC, WeakP]() { if (WeakP.IsValid()) { PC->ReportPlayer(WeakP.Get(), EBRReportReason::Cheating, TEXT("")); } }, FLinearColor(0.5f, 0.2f, 0.2f), 14));
				AddTo(Row, MakeButton(LOCTEXT("Toxic", "Ofensas"), [PC, WeakP]() { if (WeakP.IsValid()) { PC->ReportPlayer(WeakP.Get(), EBRReportReason::Toxicity, TEXT("")); } }, FLinearColor(0.5f, 0.35f, 0.2f), 14));
				AddTo(Row, MakeButton(LOCTEXT("Teaming", "Times"), [PC, WeakP]() { if (WeakP.IsValid()) { PC->ReportPlayer(WeakP.Get(), EBRReportReason::Teaming, TEXT("")); } }, FLinearColor(0.35f, 0.25f, 0.5f), 14));
				AddTo(MenuContent, Row);
			}
		}
	}
	else if (MenuPage == 3)
	{
		AddTo(MenuContent, MakeButton(LOCTEXT("Back3", "Voltar"), [Page]() { Page(0); }, FLinearColor(0.3f, 0.3f, 0.35f)));
		AddTo(MenuContent, MakeText(LOCTEXT("CreativeHelp", "Construa livremente (materiais infinitos) e salve sua ilha."), 14, FLinearColor::White, false));
		for (int32 Slot = 1; Slot <= 3; ++Slot)
		{
			const FString Name = FString::Printf(TEXT("ilha%d"), Slot);
			UHorizontalBox* Row = MakeRow();
			AddTo(Row, MakeText(FText::FromString(FString::Printf(TEXT("Ilha %d"), Slot)), 16), 4.f, true);
			AddTo(Row, MakeButton(LOCTEXT("Save", "Salvar"), [PC, Name]() { PC->CreativeCommand(TEXT("save"), Name); }, FLinearColor(0.2f, 0.45f, 0.3f), 14));
			AddTo(Row, MakeButton(LOCTEXT("Load", "Carregar"), [PC, Name]() { PC->CreativeCommand(TEXT("load"), Name); }, FLinearColor(0.2f, 0.3f, 0.5f), 14));
			AddTo(MenuContent, Row);
		}
		AddTo(MenuContent, MakeButton(LOCTEXT("Clear", "Limpar construções"), [PC]() { PC->CreativeCommand(TEXT("clear"), TEXT("")); }, FLinearColor(0.5f, 0.2f, 0.15f)));
		const FText Vehicles[] = { LOCTEXT("V0", "Carro esportivo"), LOCTEXT("V1", "Caminhonete"), LOCTEXT("V2", "Moto"), LOCTEXT("V3", "Utilitário"), LOCTEXT("V4", "Barco") };
		for (int32 V = 0; V < 5; ++V)
		{
			AddTo(MenuContent, MakeButton(FText::Format(LOCTEXT("SpawnV", "Criar: {0}"), Vehicles[V]), [PC, V]() { PC->CreativeCommand(TEXT("vehicle"), FString::FromInt(V)); }, FLinearColor(0.25f, 0.3f, 0.4f), 15));
		}
		AddTo(MenuContent, MakeButton(LOCTEXT("Chest", "Criar baú"), [PC]() { PC->CreativeCommand(TEXT("chest"), TEXT("")); }, FLinearColor(0.45f, 0.35f, 0.1f), 15));
		AddTo(MenuContent, MakeButton(LOCTEXT("Dummy", "Criar alvo de treino"), [PC]() { PC->CreativeCommand(TEXT("dummy"), TEXT("")); }, FLinearColor(0.45f, 0.2f, 0.2f), 15));
		AddTo(MenuContent, MakeButton(LOCTEXT("Night", "Noite"), [PC]() { PC->CreativeCommand(TEXT("time"), TEXT("22")); }, FLinearColor(0.15f, 0.15f, 0.3f), 15));
		AddTo(MenuContent, MakeButton(LOCTEXT("Day", "Dia"), [PC]() { PC->CreativeCommand(TEXT("time"), TEXT("12")); }, FLinearColor(0.45f, 0.4f, 0.15f), 15));
	}
}

// ------------------------------------------------------------------------------------------------ painting
bool UBRHUDWidget::WorldToLocal(const FVector& World, FVector2D& OutLocal) const
{
	APlayerController* PC = GetOwningPlayer();
	FVector2D Screen;
	if (!PC || !PC->ProjectWorldLocationToScreen(World, Screen, true)) { return false; }
	const float Scale = UWidgetLayoutLibrary::GetViewportScale(this);
	OutLocal = Screen / FMath::Max(0.01f, Scale);
	return true;
}

int32 UBRHUDWidget::NativePaint(const FPaintArgs& Args, const FGeometry& G, const FSlateRect& MyCullingRect,
	FSlateWindowElementList& Out, int32 LayerId, const FWidgetStyle& InWidgetStyle, bool bParentEnabled) const
{
	int32 L = Super::NativePaint(Args, G, MyCullingRect, Out, LayerId, InWidgetStyle, bParentEnabled);
	const ABRPlayerController* PC = Cast<ABRPlayerController>(GetOwningPlayer());
	if (!PC) { return L; }
	const ABRCharacter* C = Cast<ABRCharacter>(PC->GetPawn());
	const FVector2D Size = G.GetLocalSize();
	L += 1;

	PaintWorldMarkers(Out, L, G);
	PaintCompass(Out, L, G);
	PaintMap(Out, L, G, FVector2D(Size.X - 250.f, 20.f), 230.f, false);
	if (PC->IsMapOpen())
	{
		const float Big = Size.Y * 0.8f;
		Rect(Out, L, G, FVector2D::ZeroVector, Size, FLinearColor(0, 0, 0, 0.5f));
		PaintMap(Out, L + 3, G, FVector2D((Size.X - Big) * 0.5f, (Size.Y - Big) * 0.5f), Big, true);
	}
	PaintInfo(Out, L, G, C);
	if (C)
	{
		PaintBars(Out, L, G, C);
		PaintSlots(Out, L, G, C);
		PaintCrosshair(Out, L, G, C);
	}
	PaintResult(Out, L + 5, G);
	return L + 8;
}

void UBRHUDWidget::PaintBars(FSlateWindowElementList& Out, int32 L, const FGeometry& G, const ABRCharacter* C) const
{
	const FVector2D Size = G.GetLocalSize();
	const UBRHealthComponent* H = C->GetHealth();
	const float W = 340.f;
	const FVector2D Base(Size.X * 0.5f - W * 0.5f, Size.Y - 120.f);
	if (H->IsDowned())
	{
		Rect(Out, L, G, Base, FVector2D(W, 18.f), FLinearColor(0, 0, 0, 0.5f));
		Rect(Out, L + 1, G, Base, FVector2D(W * H->GetDownedHealth() / H->MaxDownedHealth, 18.f), FLinearColor(0.85f, 0.15f, 0.1f));
		Text(Out, L + 2, G, Base + FVector2D(W * 0.5f, -32.f), LOCTEXT("Downed", "Derrubado! Aguarde um companheiro reanimar").ToString(), 16, FLinearColor(1.f, 0.4f, 0.3f), 1);
		return;
	}
	// Shield above health.
	Rect(Out, L, G, Base - FVector2D(0, 20.f), FVector2D(W, 14.f), FLinearColor(0, 0, 0, 0.5f));
	Rect(Out, L + 1, G, Base - FVector2D(0, 20.f), FVector2D(W * H->GetShield() / H->GetMaxShield(), 14.f), FLinearColor(0.2f, 0.55f, 1.f));
	Rect(Out, L, G, Base, FVector2D(W, 18.f), FLinearColor(0, 0, 0, 0.5f));
	Rect(Out, L + 1, G, Base, FVector2D(W * H->GetHealth() / H->GetMaxHealth(), 18.f), FLinearColor(0.25f, 0.85f, 0.3f));
	Text(Out, L + 2, G, Base + FVector2D(-10.f, -22.f), FString::Printf(TEXT("%d"), FMath::RoundToInt(H->GetShield())), 14, FLinearColor(0.6f, 0.8f, 1.f), 2);
	Text(Out, L + 2, G, Base + FVector2D(-10.f, -1.f), FString::Printf(TEXT("%d"), FMath::RoundToInt(H->GetHealth())), 16, FLinearColor::White, 2);

	// Using a consumable / interacting progress.
	float Progress = C->GetInventory()->GetUseProgress();
	if (Progress <= 0.f) { Progress = C->GetInteractProgress(); }
	if (Progress > 0.f)
	{
		const FVector2D P(Size.X * 0.5f - 100.f, Size.Y * 0.62f);
		Rect(Out, L, G, P, FVector2D(200.f, 10.f), FLinearColor(0, 0, 0, 0.5f));
		Rect(Out, L + 1, G, P, FVector2D(200.f * Progress, 10.f), FLinearColor(1.f, 0.85f, 0.2f));
	}

	if (const ABRVehicle* V = C->GetVehicle())
	{
		const FVector2D P(Size.X * 0.5f - 140.f, Size.Y - 190.f);
		Text(Out, L + 2, G, P, FString::Printf(TEXT("%d km/h"), FMath::RoundToInt(V->GetSpeedKmh())), 22, FLinearColor::White);
		Text(Out, L + 2, G, P + FVector2D(150.f, 4.f), LOCTEXT("Fuel", "Combustível").ToString(), 12, FLinearColor(0.9f, 0.9f, 0.6f));
		Rect(Out, L, G, P + FVector2D(150.f, 24.f), FVector2D(130.f, 8.f), FLinearColor(0, 0, 0, 0.5f));
		Rect(Out, L + 1, G, P + FVector2D(150.f, 24.f), FVector2D(130.f * V->GetFuelFraction(), 8.f), FLinearColor(1.f, 0.7f, 0.1f));
		Rect(Out, L, G, P + FVector2D(150.f, 36.f), FVector2D(130.f, 8.f), FLinearColor(0, 0, 0, 0.5f));
		Rect(Out, L + 1, G, P + FVector2D(150.f, 36.f), FVector2D(130.f * V->GetHealthFraction(), 8.f), FLinearColor(0.9f, 0.3f, 0.2f));
	}
}

void UBRHUDWidget::PaintSlots(FSlateWindowElementList& Out, int32 L, const FGeometry& G, const ABRCharacter* C) const
{
	const FVector2D Size = G.GetLocalSize();
	const UBRInventoryComponent* Inv = C->GetInventory();
	const UBRItemRegistry* Reg = UBRItemRegistry::Get();
	const UBRBuildComponent* B = C->GetBuild();
	const float Slot = 66.f, Gap = 6.f;
	const FVector2D Base(Size.X - (Slot + Gap) * 6.f - 20.f, Size.Y - Slot - 24.f);

	for (int32 I = -1; I < UBRInventoryComponent::NumSlots; ++I)
	{
		const FVector2D P = Base + FVector2D((I + 1) * (Slot + Gap), 0.f);
		const bool bActive = Inv->GetActiveSlot() == I && !B->IsBuildMode();
		Rect(Out, L, G, P - FVector2D(2.f), FVector2D(Slot + 4.f), bActive ? FLinearColor(1.f, 1.f, 1.f, 0.9f) : FLinearColor(0, 0, 0, 0.35f));
		if (I < 0)
		{
			Rect(Out, L + 1, G, P, FVector2D(Slot), FLinearColor(0.15f, 0.15f, 0.18f, 0.85f));
			Text(Out, L + 2, G, P + FVector2D(Slot * 0.5f, 22.f), TEXT("Picareta"), 11, FLinearColor::White, 1);
			continue;
		}
		const FBRItemStack& S = Inv->GetSlot(I);
		const UBRItemDefinition* Def = Reg->Find(S.ItemId);
		const FLinearColor Bg = Def ? BRTypes::RarityColor(Def->Rarity) * 0.55f : FLinearColor(0.1f, 0.1f, 0.12f);
		Rect(Out, L + 1, G, P, FVector2D(Slot), FLinearColor(Bg.R, Bg.G, Bg.B, 0.85f));
		Text(Out, L + 2, G, P + FVector2D(4.f, 2.f), FString::FromInt(I + 1), 11, FLinearColor(1, 1, 1, 0.7f));
		if (Def)
		{
			FString Short = Def->DisplayName.ToString();
			int32 Space; if (Short.FindLastChar(TEXT(' '), Space)) { Short = Short.RightChop(Space + 1); }
			Text(Out, L + 2, G, P + FVector2D(Slot * 0.5f, 24.f), Short.Left(9), 11, FLinearColor::White, 1);
			const UBRWeaponDefinition* W = Cast<UBRWeaponDefinition>(Def);
			const FString Count = (W && !W->bThrowable) ? FString::FromInt(bActive && C->GetCurrentWeapon() ? C->GetCurrentWeapon()->GetAmmoInMag() : FMath::Max(0, S.AmmoInMag)) : FString::Printf(TEXT("x%d"), S.Count);
			Text(Out, L + 2, G, P + FVector2D(Slot - 4.f, Slot - 18.f), Count, 12, FLinearColor::White, 2);
		}
	}

	// Ammo readout for the equipped weapon.
	if (const ABRWeapon* W = C->GetCurrentWeapon())
	{
		if (const UBRWeaponDefinition* D = W->GetDefinition())
		{
			const FString Ammo = D->bThrowable ? FString() : FString::Printf(TEXT("%d / %d"), W->GetAmmoInMag(), Inv->IsInfinite() ? 999 : Inv->GetAmmo(D->AmmoType));
			Text(Out, L + 2, G, FVector2D(Size.X - 30.f, Base.Y - 64.f), Ammo, 26, FLinearColor::White, 2);
			Text(Out, L + 2, G, FVector2D(Size.X - 30.f, Base.Y - 32.f), D->DisplayName.ToString(), 14, BRTypes::RarityColor(D->Rarity), 2);
			if (W->IsReloading())
			{
				Text(Out, L + 2, G, FVector2D(Size.X * 0.5f, Size.Y * 0.58f), LOCTEXT("Reloading", "Recarregando...").ToString(), 16, FLinearColor(1.f, 0.85f, 0.3f), 1);
			}
		}
	}

	// Building materials (selected one highlighted in build mode).
	const TCHAR* MatNames[] = { TEXT("Madeira"), TEXT("Pedra"), TEXT("Metal") };
	for (int32 M = 0; M < 3; ++M)
	{
		const FVector2D P(Size.X - 110.f, Base.Y - 180.f + M * 28.f);
		const bool bSel = B->IsBuildMode() && int32(B->GetSelectedMaterial()) == M;
		Rect(Out, L, G, P, FVector2D(90.f, 24.f), bSel ? FLinearColor(1.f, 0.85f, 0.2f, 0.8f) : FLinearColor(0, 0, 0, 0.4f));
		Rect(Out, L + 1, G, P + FVector2D(4.f, 4.f), FVector2D(16.f, 16.f), BRTypes::BuildMaterialColor(EBRBuildMaterial(M)));
		Text(Out, L + 2, G, P + FVector2D(26.f, 2.f), FString::FromInt(Inv->GetMaterial(EBRBuildMaterial(M))), 14, FLinearColor::White);
		if (bSel) { Text(Out, L + 2, G, P + FVector2D(-8.f, 2.f), MatNames[M], 12, FLinearColor::White, 2); }
	}
	if (B->IsBuildMode() || B->IsEditMode())
	{
		const TCHAR* Pieces[] = { TEXT("Parede"), TEXT("Piso"), TEXT("Rampa"), TEXT("Telhado") };
		const FString Mode = B->IsEditMode() ? FString(TEXT("EDIÇÃO — toque nos blocos, G confirma, R restaura"))
			: FString::Printf(TEXT("CONSTRUÇÃO — %s (%s)  1-4 peça, R gira, X material"), Pieces[uint8(B->GetSelectedPiece())], MatNames[uint8(B->GetSelectedMaterial())]);
		Text(Out, L + 2, G, FVector2D(Size.X * 0.5f, Size.Y - 170.f), Mode, 14, FLinearColor(0.6f, 0.85f, 1.f), 1);
	}
}

void UBRHUDWidget::PaintCrosshair(FSlateWindowElementList& Out, int32 L, const FGeometry& G, const ABRCharacter* C) const
{
	const FVector2D Center = G.GetLocalSize() * 0.5f;
	const ABRWeapon* W = C->GetCurrentWeapon();
	const APlayerController* PC = GetOwningPlayer();
	const float FOV = PC && PC->PlayerCameraManager ? PC->PlayerCameraManager->GetFOVAngle() : 90.f;
	const float Spread = W ? W->GetCurrentSpreadDeg() : 0.f;
	const float Gap = 4.f + G.GetLocalSize().X * 0.5f * FMath::Tan(FMath::DegreesToRadians(Spread)) / FMath::Tan(FMath::DegreesToRadians(FOV * 0.5f));
	const FLinearColor Cross(1.f, 1.f, 1.f, 0.9f);
	if (C->GetBuild()->IsBuildMode())
	{
		Circle(Out, L, G, Center, 6.f, FLinearColor(0.4f, 0.8f, 1.f), 2.f, 16);
	}
	else if (W && !(W->GetDefinition() && W->GetDefinition()->bHasScope && C->IsAiming()))
	{
		for (const FVector2D& D : { FVector2D(1, 0), FVector2D(-1, 0), FVector2D(0, 1), FVector2D(0, -1) })
		{
			Lines(Out, L, G, { Center + D * Gap, Center + D * (Gap + 9.f) }, Cross, 2.f);
		}
	}
	else if (W)
	{
		// Scope overlay.
		const FVector2D S = G.GetLocalSize();
		Circle(Out, L, G, Center, S.Y * 0.42f, FLinearColor(0, 0, 0, 0.9f), 6.f, 64);
		Lines(Out, L, G, { FVector2D(Center.X - S.Y * 0.42f, Center.Y), FVector2D(Center.X + S.Y * 0.42f, Center.Y) }, FLinearColor(0, 0, 0, 0.8f), 1.5f);
		Lines(Out, L, G, { FVector2D(Center.X, Center.Y - S.Y * 0.42f), FVector2D(Center.X, Center.Y + S.Y * 0.42f) }, FLinearColor(0, 0, 0, 0.8f), 1.5f);
	}
	else
	{
		Rect(Out, L, G, Center - FVector2D(2.f), FVector2D(4.f), Cross);
	}

	// Hit markers at the crosshair + floating damage numbers at the hit location.
	for (const FHitMarker& M : HitMarkers)
	{
		const float Age = Now - M.Time;
		const float A = FMath::Clamp(1.f - Age / 0.35f, 0.f, 1.f);
		const FLinearColor Col = M.bElim ? FLinearColor(1.f, 0.2f, 0.2f, A) : (M.bHead ? FLinearColor(1.f, 0.85f, 0.2f, A) : FLinearColor(1.f, 1.f, 1.f, A));
		if (A > 0.f)
		{
			for (const FVector2D& D : { FVector2D(1, 1), FVector2D(-1, 1), FVector2D(1, -1), FVector2D(-1, -1) })
			{
				Lines(Out, L + 1, G, { Center + D * 6.f, Center + D * 13.f }, Col, 2.5f);
			}
		}
		FVector2D P;
		if (WorldToLocal(M.World, P))
		{
			const FLinearColor NumCol = M.bHead ? FLinearColor(1.f, 0.85f, 0.2f) : (M.bShield ? FLinearColor(0.5f, 0.75f, 1.f) : FLinearColor::White);
			Text(Out, L + 2, G, P - FVector2D(0, Age * 60.f), FString::FromInt(FMath::RoundToInt(M.Damage)), M.bHead ? 22 : 18, NumCol * FLinearColor(1, 1, 1, 1.f - Age), 1);
		}
	}

	// Damage direction indicators around the crosshair.
	if (PC)
	{
		const float ViewYaw = PC->GetControlRotation().Yaw;
		for (const FDamageIndicator& D : DamageIndicators)
		{
			const FVector To = D.From - C->GetActorLocation();
			const float Rel = FMath::DegreesToRadians(FRotator::NormalizeAxis(To.Rotation().Yaw - ViewYaw));
			const FVector2D Dir(FMath::Sin(Rel), -FMath::Cos(Rel));
			const float A = FMath::Clamp(1.f - (Now - D.Time) / 1.5f, 0.f, 1.f);
			const FVector2D Tip = Center + Dir * 120.f;
			const FVector2D Side(-Dir.Y, Dir.X);
			Lines(Out, L + 1, G, { Tip - Side * 26.f - Dir * 10.f, Tip, Tip + Side * 26.f - Dir * 10.f }, FLinearColor(1.f, 0.15f, 0.1f, A), 5.f);
		}
	}
}

void UBRHUDWidget::PaintCompass(FSlateWindowElementList& Out, int32 L, const FGeometry& G) const
{
	const APlayerController* PC = GetOwningPlayer();
	if (!PC) { return; }
	const FVector2D Size = G.GetLocalSize();
	const float W = 460.f, Y = 18.f;
	const float Heading = HeadingFromYaw(PC->GetControlRotation().Yaw);
	Rect(Out, L, G, FVector2D(Size.X * 0.5f - W * 0.5f, Y), FVector2D(W, 30.f), FLinearColor(0, 0, 0, 0.35f));
	const TCHAR* Names[] = { TEXT("N"), TEXT("NE"), TEXT("L"), TEXT("SE"), TEXT("S"), TEXT("SO"), TEXT("O"), TEXT("NO") };
	for (int32 Deg = 0; Deg < 360; Deg += 15)
	{
		const float Rel = FRotator::NormalizeAxis(Deg - Heading);
		if (FMath::Abs(Rel) > 90.f) { continue; }
		const float X = Size.X * 0.5f + Rel / 90.f * W * 0.5f;
		if (Deg % 45 == 0) { Text(Out, L + 1, G, FVector2D(X, Y + 5.f), Names[Deg / 45], 15, Deg == 0 ? FLinearColor(1.f, 0.4f, 0.3f) : FLinearColor::White, 1); }
		else { Rect(Out, L + 1, G, FVector2D(X - 1.f, Y + 20.f), FVector2D(2.f, 8.f), FLinearColor(1, 1, 1, 0.6f)); }
	}
	Rect(Out, L + 2, G, FVector2D(Size.X * 0.5f - 1.f, Y + 26.f), FVector2D(2.f, 10.f), FLinearColor(1.f, 0.85f, 0.2f));
	Text(Out, L + 1, G, FVector2D(Size.X * 0.5f, Y + 36.f), FString::FromInt(FMath::RoundToInt(Heading) % 360), 12, FLinearColor(1, 1, 1, 0.8f), 1);

	// Team pings on the compass.
	const ABRGameState* GS = GetWorld()->GetGameState<ABRGameState>();
	const ABRPlayerState* PS = PC->GetPlayerState<ABRPlayerState>();
	const APawn* Pawn = PC->GetPawn();
	if (GS && PS && Pawn)
	{
		for (const FBRPingMarker& P : GS->GetPings())
		{
			if (P.TeamId != PS->GetTeamId()) { continue; }
			const FVector To = FVector(P.Location) - Pawn->GetActorLocation();
			const float Rel = FRotator::NormalizeAxis(HeadingFromYaw(To.Rotation().Yaw) - Heading);
			if (FMath::Abs(Rel) <= 90.f)
			{
				Rect(Out, L + 2, G, FVector2D(Size.X * 0.5f + Rel / 90.f * W * 0.5f - 4.f, Y - 6.f), FVector2D(8.f, 8.f), FLinearColor(1.f, 0.85f, 0.2f));
			}
		}
	}
}

void UBRHUDWidget::PaintMap(FSlateWindowElementList& Out, int32 L, const FGeometry& G, const FVector2D& Pos, float Size, bool bBig) const
{
	const UBRWorldSubsystem* WS = GetWorld()->GetSubsystem<UBRWorldSubsystem>();
	const ABRGameState* GS = GetWorld()->GetGameState<ABRGameState>();
	const APlayerController* PC = GetOwningPlayer();
	if (!WS || !WS->HasWorld() || !PC) { return; }
	const float H = WS->GetHalfSize();
	auto ToMap = [&](float X, float Y) { return Pos + FVector2D((X + H) / (2.f * H), (H - Y) / (2.f * H)) * Size; };

	Rect(Out, L, G, Pos - FVector2D(3.f), FVector2D(Size + 6.f), FLinearColor(0, 0, 0, 0.6f));
	if (const ABRWorldGenerator* Gen = WS->GetGenerator())
	{
		if (UTexture2D* Tex = Gen->GetMinimapTexture())
		{
			MinimapBrush.SetResourceObject(Tex);
			MinimapBrush.ImageSize = FVector2D(Size);
			FSlateDrawElement::MakeBox(Out, L + 1, G.ToPaintGeometry(FVector2D(Size), FSlateLayoutTransform(Pos)), &MinimapBrush, ESlateDrawEffect::None, FLinearColor::White);
		}
	}

	if (bBig)
	{
		for (const FBRNamedLocation& N : WS->GetNamedLocations())
		{
			Text(Out, L + 3, G, ToMap(N.Location.X, N.Location.Y), N.Name.ToString(), 13, FLinearColor::White, 1);
		}
	}

	// Storm: current (purple) and next (white) circles.
	if (GS && GS->GetStorm() && GS->GetStorm()->GetState().bActive)
	{
		FVector2D C; float R;
		GS->GetStorm()->GetCurrentCircle(C, R);
		Circle(Out, L + 2, G, ToMap(C.X, C.Y), R / (2.f * H) * Size, FLinearColor(0.75f, 0.3f, 1.f), 2.f);
		GS->GetStorm()->GetNextCircle(C, R);
		Circle(Out, L + 2, G, ToMap(C.X, C.Y), R / (2.f * H) * Size, FLinearColor(1.f, 1.f, 1.f, 0.9f), 1.5f);
	}
	// Bus path.
	if (GS && GS->GetBus() && GS->GetMatchPhase() == EBRMatchPhase::BusFlight)
	{
		const FVector B = GS->GetBus()->GetActorLocation();
		Rect(Out, L + 3, G, ToMap(B.X, B.Y) - FVector2D(5.f), FVector2D(10.f), FLinearColor(0.2f, 0.6f, 1.f));
	}
	// Teammates and pings.
	const ABRPlayerState* MyPS = PC->GetPlayerState<ABRPlayerState>();
	if (GS && MyPS)
	{
		for (APlayerState* P : GS->PlayerArray)
		{
			const ABRPlayerState* BP = Cast<ABRPlayerState>(P);
			const APawn* Mate = BP ? BP->GetPawn() : nullptr;
			if (!Mate || BP == MyPS || BP->GetTeamId() != MyPS->GetTeamId()) { continue; }
			Rect(Out, L + 3, G, ToMap(Mate->GetActorLocation().X, Mate->GetActorLocation().Y) - FVector2D(4.f), FVector2D(8.f), FLinearColor(0.2f, 1.f, 0.4f));
		}
		for (const FBRPingMarker& P : GS->GetPings())
		{
			if (P.TeamId == MyPS->GetTeamId()) { Rect(Out, L + 3, G, ToMap(P.Location.X, P.Location.Y) - FVector2D(4.f), FVector2D(8.f), FLinearColor(1.f, 0.85f, 0.2f)); }
		}
	}
	// Player arrow.
	const AActor* ViewTarget = PC->GetViewTarget();
	if (ViewTarget)
	{
		const FVector2D P = ToMap(ViewTarget->GetActorLocation().X, ViewTarget->GetActorLocation().Y);
		const float Head = FMath::DegreesToRadians(HeadingFromYaw(PC->GetControlRotation().Yaw));
		const FVector2D Fwd(FMath::Sin(Head), -FMath::Cos(Head)), Side(-Fwd.Y, Fwd.X);
		Lines(Out, L + 4, G, { P + Fwd * 9.f, P - Fwd * 5.f + Side * 6.f, P - Fwd * 5.f - Side * 6.f, P + Fwd * 9.f }, FLinearColor(1.f, 0.95f, 0.3f), 2.5f);
		if (!bBig)
		{
			Text(Out, L + 3, G, Pos + FVector2D(Size * 0.5f, Size + 6.f), WS->GetLocationName(ViewTarget->GetActorLocation()).ToString(), 13, FLinearColor::White, 1);
		}
	}
}

void UBRHUDWidget::PaintWorldMarkers(FSlateWindowElementList& Out, int32 L, const FGeometry& G) const
{
	const APlayerController* PC = GetOwningPlayer();
	const ABRGameState* GS = GetWorld()->GetGameState<ABRGameState>();
	const ABRPlayerState* MyPS = PC ? PC->GetPlayerState<ABRPlayerState>() : nullptr;
	const AActor* View = PC ? PC->GetViewTarget() : nullptr;
	if (!GS || !MyPS || !View) { return; }
	for (const FBRPingMarker& P : GS->GetPings())
	{
		if (P.TeamId != MyPS->GetTeamId()) { continue; }
		FVector2D S;
		if (!WorldToLocal(P.Location, S)) { continue; }
		const FLinearColor Col = P.Kind == 1 ? FLinearColor(1.f, 0.25f, 0.2f) : (P.Kind == 2 ? FLinearColor(0.3f, 1.f, 0.4f) : FLinearColor(1.f, 0.85f, 0.2f));
		Lines(Out, L, G, { S + FVector2D(0, -10), S + FVector2D(10, 0), S + FVector2D(0, 10), S + FVector2D(-10, 0), S + FVector2D(0, -10) }, Col, 3.f);
		Text(Out, L + 1, G, S + FVector2D(0, 12.f), FString::Printf(TEXT("%s %dm"), *P.Owner, FMath::RoundToInt(FVector::Dist(P.Location, View->GetActorLocation()) / 100.f)), 12, Col, 1);
	}
	// Teammate name tags.
	for (APlayerState* P : GS->PlayerArray)
	{
		const ABRPlayerState* BP = Cast<ABRPlayerState>(P);
		const ABRCharacter* Mate = BP ? BP->GetPawn<ABRCharacter>() : nullptr;
		if (!Mate || BP == MyPS || BP->GetTeamId() != MyPS->GetTeamId()) { continue; }
		FVector2D S;
		if (WorldToLocal(Mate->GetActorLocation() + FVector(0, 0, 120.f), S))
		{
			Text(Out, L + 1, G, S, BP->GetPlayerName(), 13, Mate->IsDowned() ? FLinearColor(1.f, 0.3f, 0.2f) : FLinearColor(0.3f, 1.f, 0.5f), 1);
		}
	}
}

void UBRHUDWidget::PaintInfo(FSlateWindowElementList& Out, int32 L, const FGeometry& G, const ABRCharacter* C) const
{
	const ABRPlayerController* PC = Cast<ABRPlayerController>(GetOwningPlayer());
	const ABRGameState* GS = GetWorld()->GetGameState<ABRGameState>();
	const ABRPlayerState* PS = PC ? PC->GetPlayerState<ABRPlayerState>() : nullptr;
	const FVector2D Size = G.GetLocalSize();
	if (!GS || !PS) { return; }

	// Top-left: match info.
	FVector2D P(20.f, 20.f);
	Text(Out, L, G, P, FString::Printf(TEXT("Vivos: %d   Equipes: %d   Eliminações: %d"), GS->GetPlayersAlive(), GS->GetTeamsAlive(), PS->GetKills()), 16, FLinearColor::White);
	P.Y += 24.f;
	switch (GS->GetMatchPhase())
	{
	case EBRMatchPhase::WaitingForPlayers:
		Text(Out, L, G, P, FString::Printf(TEXT("Aquecimento — aguardando jogadores (%d)  %s"), GS->PlayerArray.Num(), *TimeString(GS->GetPhaseSecondsRemaining())), 15, FLinearColor(1.f, 0.85f, 0.3f));
		break;
	case EBRMatchPhase::BusFlight:
		Text(Out, L, G, P, FString::Printf(TEXT("Ônibus — salte quando quiser  %s"), *TimeString(GS->GetPhaseSecondsRemaining())), 15, FLinearColor(0.4f, 0.8f, 1.f));
		break;
	default:
		if (const ABRStormController* Storm = GS->GetStorm())
		{
			if (Storm->GetState().bActive)
			{
				const FString Msg = Storm->GetState().bShrinking ? FString::Printf(TEXT("A zona está encolhendo  %s"), *TimeString(Storm->GetSecondsRemaining()))
					: FString::Printf(TEXT("Tempestade se fecha em %s"), *TimeString(Storm->GetSecondsRemaining()));
				Text(Out, L, G, P, FString::Printf(TEXT("Fase %d — %s"), Storm->GetState().Phase + 1, *Msg), 15, FLinearColor(0.85f, 0.55f, 1.f));
				if (C && Storm->IsOutside(C->GetActorLocation()))
				{
					Text(Out, L, G, FVector2D(Size.X * 0.5f, Size.Y * 0.25f), LOCTEXT("InStorm", "VOCÊ ESTÁ NA TEMPESTADE! Vá para a zona segura.").ToString(), 20, FLinearColor(0.85f, 0.4f, 1.f), 1);
				}
			}
		}
		break;
	}
	P.Y += 22.f;
	FString Net = FString::Printf(TEXT("Ping: %d ms"), FMath::RoundToInt(PS->GetPingInMilliseconds()));
	const UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	if (S && S->bShowFPS)
	{
		if (const UBRPerformanceSubsystem* Perf = GetGameInstance()->GetSubsystem<UBRPerformanceSubsystem>())
		{
			Net += FString::Printf(TEXT("   FPS: %d  (res %d%%)"), FMath::RoundToInt(Perf->GetAverageFps()), FMath::RoundToInt(Perf->GetResolutionScale()));
		}
	}
	Text(Out, L, G, P, Net, 13, FLinearColor(1, 1, 1, 0.7f));

	// Kill feed under the minimap.
	FVector2D K(Size.X - 20.f, 290.f);
	for (const FBRKillFeedEntry& E : GS->GetKillFeed())
	{
		if (Now - E.LocalTime > 8.f) { continue; }
		FString Line = E.Killer.IsEmpty() ? FString::Printf(TEXT("%s foi eliminado"), *E.Victim)
			: FString::Printf(TEXT("%s %s %s%s"), *E.Killer, E.bDowned ? TEXT("derrubou") : TEXT("eliminou"), *E.Victim, E.bHeadshot ? TEXT(" (na cabeça)") : TEXT(""));
		if (!E.Weapon.IsEmpty()) { Line += FString::Printf(TEXT(" [%s]"), *E.Weapon); }
		Text(Out, L, G, K, Line, 13, E.Victim == PS->GetPlayerName() ? FLinearColor(1.f, 0.4f, 0.3f) : FLinearColor::White, 2);
		K.Y += 20.f;
	}

	// Chat.
	if (PC)
	{
		FVector2D Ch(20.f, Size.Y - 260.f - PC->GetChatLines().Num() * 20.f);
		for (const FBRChatLine& Line : PC->GetChatLines())
		{
			Text(Out, L, G, Ch, FString::Printf(TEXT("%s%s: %s"), Line.bTeam ? TEXT("[Equipe] ") : TEXT(""), *Line.Sender, *Line.Message), 13, Line.bTeam ? FLinearColor(0.5f, 1.f, 0.6f) : FLinearColor::White);
			Ch.Y += 20.f;
		}
	}

	// Announcements.
	if (Now - AnnouncementTime < 4.f)
	{
		Text(Out, L, G, FVector2D(Size.X * 0.5f, Size.Y * 0.18f), Announcement.ToString(), 22, FLinearColor(1.f, 0.9f, 0.4f, FMath::Clamp(4.f - (Now - AnnouncementTime), 0.f, 1.f)), 1);
	}

	// Interaction prompt.
	if (C)
	{
		if (const IBRInteractable* I = Cast<IBRInteractable>(C->GetLocalInteractTarget()))
		{
			Text(Out, L, G, FVector2D(Size.X * 0.5f, Size.Y * 0.66f), FString::Printf(TEXT("[E] %s"), *I->GetInteractPrompt(C).ToString()), 18, FLinearColor::White, 1);
		}
		if (C->IsInVehicle()) { Text(Out, L, G, FVector2D(Size.X * 0.5f, Size.Y * 0.66f), LOCTEXT("Exit", "[E] Sair do veículo").ToString(), 16, FLinearColor::White, 1); }
		const UBRCharacterMovementComponent* M = C->GetBRMovement();
		if (M->IsSkydiving()) { Text(Out, L, G, FVector2D(Size.X * 0.5f, Size.Y * 0.72f), LOCTEXT("Glide", "[Pular] Abrir planador").ToString(), 16, FLinearColor(0.6f, 0.85f, 1.f), 1); }
		if (M->IsInAirborneCustomMode())
		{
			const float Alt = C->GetActorLocation().Z - GetWorld()->GetSubsystem<UBRWorldSubsystem>()->GetTerrainHeight(C->GetActorLocation().X, C->GetActorLocation().Y);
			Text(Out, L, G, FVector2D(Size.X * 0.5f + 160.f, Size.Y * 0.5f), FString::Printf(TEXT("%d m"), FMath::RoundToInt(Alt / 100.f)), 18, FLinearColor::White);
		}
	}
	else if (PS->IsOnBus())
	{
		Text(Out, L, G, FVector2D(Size.X * 0.5f, Size.Y * 0.7f), LOCTEXT("Jump", "Pressione PULAR para saltar do ônibus").ToString(), 22, FLinearColor::White, 1);
	}
	else if (const APlayerState* Spec = PC ? PC->GetSpectatedPlayer() : nullptr)
	{
		Text(Out, L, G, FVector2D(Size.X * 0.5f, Size.Y - 80.f), FString::Printf(TEXT("Assistindo: %s  (Atirar = próximo)"), *Spec->GetPlayerName()), 18, FLinearColor::White, 1);
	}
}

void UBRHUDWidget::PaintResult(FSlateWindowElementList& Out, int32 L, const FGeometry& G) const
{
	const ABRPlayerController* PC = Cast<ABRPlayerController>(GetOwningPlayer());
	if (!PC || !PC->HasMatchResult()) { return; }
	const FBRMatchResult& R = PC->GetMatchResult();
	const FVector2D Size = G.GetLocalSize();
	const FVector2D Panel(520.f, 260.f);
	const FVector2D Pos = (Size - Panel) * 0.5f - FVector2D(0, 80.f);
	Rect(Out, L, G, Pos, Panel, FLinearColor(0.02f, 0.03f, 0.1f, 0.85f));
	const bool bWin = R.Placement == 1;
	Text(Out, L + 1, G, Pos + FVector2D(Panel.X * 0.5f, 20.f), bWin ? TEXT("VITÓRIA REAL!") : FString::Printf(TEXT("Você ficou em #%d"), R.Placement), 34, bWin ? FLinearColor(1.f, 0.85f, 0.2f) : FLinearColor::White, 1);
	Text(Out, L + 1, G, Pos + FVector2D(Panel.X * 0.5f, 80.f), FString::Printf(TEXT("Eliminações: %d   Dano: %d   Reanimações: %d"), R.Eliminations, R.DamageDealt, R.Revives), 16, FLinearColor::White, 1);
	Text(Out, L + 1, G, Pos + FVector2D(Panel.X * 0.5f, 110.f), FString::Printf(TEXT("Tempo vivo: %s   Baús: %d"), *TimeString(R.SecondsSurvived), R.ChestsOpened), 16, FLinearColor::White, 1);
	Text(Out, L + 1, G, Pos + FVector2D(Panel.X * 0.5f, 150.f), FString::Printf(TEXT("+%d XP   +%d Moedas"), R.XpEarned, R.CoinsEarned), 22, FLinearColor(0.5f, 1.f, 0.6f), 1);
	if (!R.bCountsForProgression) { Text(Out, L + 1, G, Pos + FVector2D(Panel.X * 0.5f, 190.f), TEXT("Modo de treino: progresso reduzido"), 13, FLinearColor(1, 1, 1, 0.7f), 1); }
	Text(Out, L + 1, G, Pos + FVector2D(Panel.X * 0.5f, 220.f), TEXT("Menu > Sair da partida para voltar ao lobby"), 13, FLinearColor(1, 1, 1, 0.7f), 1);
}

#undef LOCTEXT_NAMESPACE
