#include "UI/BRTouchControlsWidget.h"

#include "Building/BRBuildComponent.h"
#include "Characters/BRCharacter.h"
#include "Characters/BRCharacterMovementComponent.h"
#include "Framework/Application/SlateApplication.h"
#include "Fonts/FontMeasure.h"
#include "GameModes/BRPlayerController.h"
#include "GameModes/BRPlayerState.h"
#include "Inventory/BRInventoryComponent.h"
#include "Rendering/DrawElements.h"
#include "Settings/BRGameUserSettings.h"
#include "Styling/CoreStyle.h"

#define LOCTEXT_NAMESPACE "BRTouch"

namespace
{
	void PaintCircle(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G, FVector2D C, float R, const FLinearColor& Col, float Thick)
	{
		TArray<FVector2D> Pts;
		for (int32 I = 0; I <= 32; ++I) { const float A = 2.f * PI * I / 32; Pts.Add(C + FVector2D(FMath::Cos(A), FMath::Sin(A)) * R); }
		FSlateDrawElement::MakeLines(Out, Layer, G.ToPaintGeometry(), Pts, ESlateDrawEffect::None, Col, true, Thick);
	}
	void PaintDisc(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G, FVector2D C, float R, const FLinearColor& Col)
	{
		// Concentric rings approximate a filled disc without a texture asset.
		for (float Rr = R; Rr > 2.f; Rr -= 4.f) { PaintCircle(Out, Layer, G, C, Rr, Col, 4.f); }
	}
	void PaintLabel(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G, FVector2D C, const FString& S, int32 Size, const FLinearColor& Col)
	{
		const FSlateFontInfo F = FCoreStyle::GetDefaultFontStyle("Bold", Size);
		const FVector2D M = FSlateApplication::IsInitialized() ? FVector2D(FSlateApplication::Get().GetRenderer()->GetFontMeasureService()->Measure(S, F)) : FVector2D(S.Len() * Size * 0.6f, Size);
		FSlateDrawElement::MakeText(Out, Layer, G.ToPaintGeometry(M, FSlateLayoutTransform(C - M * 0.5f)), S, F, ESlateDrawEffect::None, Col);
	}
}

void UBRTouchControlsWidget::NativeConstruct()
{
	Super::NativeConstruct();
	SetVisibility(ESlateVisibility::Visible);
	BuildDefaults();
	LoadLayout();
}

void UBRTouchControlsWidget::BuildDefaults()
{
	auto Add = [this](const TCHAR* Id, const FText& Label, float X, float Y, float Size, bool bHold = false)
	{
		FControl C; C.Id = Id; C.Label = Label; C.Center = FVector2D(X, Y); C.Size = Size; C.bHold = bHold;
		Controls.Add(C);
	};
	Controls.Reset();
	Add(TEXT("Fire"), LOCTEXT("Fire", "ATIRAR"), 0.86f, 0.62f, 0.15f, true);
	Add(TEXT("FireLeft"), LOCTEXT("FireL", "ATIRAR"), 0.09f, 0.38f, 0.10f, true);
	Add(TEXT("Aim"), LOCTEXT("Aim", "MIRA"), 0.94f, 0.45f, 0.10f);
	Add(TEXT("Jump"), LOCTEXT("Jump", "PULAR"), 0.93f, 0.80f, 0.11f, true);
	Add(TEXT("Crouch"), LOCTEXT("Crouch", "AGACHAR"), 0.80f, 0.86f, 0.09f);
	Add(TEXT("Reload"), LOCTEXT("Reload", "RECARREGAR"), 0.75f, 0.70f, 0.08f);
	Add(TEXT("Build"), LOCTEXT("Build", "CONSTRUIR"), 0.94f, 0.27f, 0.09f);
	Add(TEXT("Edit"), LOCTEXT("Edit", "EDITAR"), 0.85f, 0.27f, 0.08f);
	Add(TEXT("Interact"), LOCTEXT("Interact", "USAR"), 0.62f, 0.55f, 0.10f, true);
	Add(TEXT("Map"), LOCTEXT("Map", "MAPA"), 0.79f, 0.05f, 0.07f);
	Add(TEXT("Menu"), LOCTEXT("Menu", "MENU"), 0.04f, 0.06f, 0.07f);
	Add(TEXT("Ping"), LOCTEXT("Ping", "MARCAR"), 0.70f, 0.40f, 0.07f);
	Add(TEXT("Emote"), LOCTEXT("Emote", "EMOTE"), 0.16f, 0.06f, 0.07f);
	Add(TEXT("Drop"), LOCTEXT("Drop", "LARGAR"), 0.27f, 0.06f, 0.07f);
	Add(TEXT("Slot0"), LOCTEXT("Pick", "PICARETA"), 0.33f, 0.92f, 0.08f);
	for (int32 I = 0; I < 5; ++I) { Add(*FString::Printf(TEXT("Slot%d"), I + 1), FText::AsNumber(I + 1), 0.40f + I * 0.065f, 0.92f, 0.08f); }
	Add(TEXT("Wall"), LOCTEXT("Wall", "PAREDE"), 0.62f, 0.84f, 0.08f);
	Add(TEXT("Floor"), LOCTEXT("Floor", "PISO"), 0.69f, 0.80f, 0.08f);
	Add(TEXT("Ramp"), LOCTEXT("Ramp", "RAMPA"), 0.55f, 0.80f, 0.08f);
	Add(TEXT("Roof"), LOCTEXT("Roof", "TETO"), 0.62f, 0.72f, 0.08f);
	Add(TEXT("Material"), LOCTEXT("Mat", "MATERIAL"), 0.70f, 0.66f, 0.07f);
	Add(TEXT("Rotate"), LOCTEXT("Rotate", "GIRAR"), 0.54f, 0.66f, 0.07f);
	Add(TEXT("EditDoor"), LOCTEXT("Door", "PORTA"), 0.55f, 0.30f, 0.07f);
	Add(TEXT("EditWindow"), LOCTEXT("Window", "JANELA"), 0.63f, 0.30f, 0.07f);
	Add(TEXT("EditArch"), LOCTEXT("Arch", "ARCO"), 0.71f, 0.30f, 0.07f);
	Add(TEXT("EditHalf"), LOCTEXT("Half", "MEIA"), 0.79f, 0.30f, 0.07f);
	Add(TEXT("EditReset"), LOCTEXT("Reset", "RESTAURAR"), 0.55f, 0.20f, 0.07f);
	Add(TEXT("LayoutDone"), LOCTEXT("Done", "SALVAR LAYOUT"), 0.5f, 0.12f, 0.09f);
	Add(TEXT("LayoutBigger"), FText::FromString(TEXT("+")), 0.42f, 0.24f, 0.07f);
	Add(TEXT("LayoutSmaller"), FText::FromString(TEXT("-")), 0.58f, 0.24f, 0.07f);
	Add(TEXT("LayoutEdit"), LOCTEXT("Layout", "LAYOUT"), 0.38f, 0.06f, 0.07f);
}

void UBRTouchControlsWidget::LoadLayout()
{
	const UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	if (!S) { return; }
	for (const FBRTouchControlLayout& L : S->TouchLayout)
	{
		for (FControl& C : Controls)
		{
			if (C.Id == L.Id) { C.Center = L.Center; C.Size = L.Size; C.Opacity = L.Opacity; }
		}
	}
}

void UBRTouchControlsWidget::SaveLayout()
{
	UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	if (!S) { return; }
	S->TouchLayout.Reset();
	for (const FControl& C : Controls)
	{
		FBRTouchControlLayout L; L.Id = C.Id; L.Center = C.Center; L.Size = C.Size; L.Opacity = C.Opacity;
		S->TouchLayout.Add(L);
	}
	S->SaveSettings();
}

void UBRTouchControlsWidget::SetEditingLayout(bool bEditing)
{
	bEditingLayout = bEditing;
	SelectedControl = NAME_None;
	if (!bEditing) { SaveLayout(); }
}

ABRCharacter* UBRTouchControlsWidget::GetCharacter() const { return GetOwningPlayer() ? Cast<ABRCharacter>(GetOwningPlayer()->GetPawn()) : nullptr; }
ABRPlayerController* UBRTouchControlsWidget::GetBRPC() const { return Cast<ABRPlayerController>(GetOwningPlayer()); }

bool UBRTouchControlsWidget::IsVisibleNow(const FControl& C) const
{
	const FString Id = C.Id.ToString();
	if (Id.StartsWith(TEXT("Layout")) && Id != TEXT("LayoutEdit")) { return bEditingLayout; }
	if (bEditingLayout) { return Id != TEXT("LayoutEdit"); }
	const ABRCharacter* Ch = GetCharacter();
	const ABRPlayerController* PC = GetBRPC();
	if (!Ch)
	{
		// On the bus or spectating: only jump/fire/menu/map.
		return Id == TEXT("Jump") || Id == TEXT("Fire") || Id == TEXT("Menu") || Id == TEXT("Map") || Id == TEXT("LayoutEdit");
	}
	const UBRBuildComponent* B = Ch->GetBuild();
	const bool bBuild = B->IsBuildMode(), bEdit = B->IsEditMode();
	if (Id == TEXT("Wall") || Id == TEXT("Floor") || Id == TEXT("Ramp") || Id == TEXT("Roof") || Id == TEXT("Material") || Id == TEXT("Rotate")) { return bBuild; }
	if (Id.StartsWith(TEXT("Edit")) && Id != TEXT("Edit")) { return bEdit; }
	if (Id == TEXT("Interact")) { return Ch->GetLocalInteractTarget() != nullptr || Ch->IsInVehicle(); }
	if (Id == TEXT("Reload") || Id == TEXT("Aim")) { return Ch->GetCurrentWeapon() != nullptr && !bBuild && !bEdit; }
	if (Id.StartsWith(TEXT("Slot"))) { return !bBuild && !bEdit; }
	(void)PC;
	return true;
}

FVector2D UBRTouchControlsWidget::ControlCenter(const FControl& C, const FVector2D& View) const { return C.Center * View; }

float UBRTouchControlsWidget::ControlRadius(const FControl& C, const FVector2D& View) const
{
	const UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	return C.Size * View.Y * 0.5f * (S ? S->TouchButtonScale : 1.f);
}

const UBRTouchControlsWidget::FControl* UBRTouchControlsWidget::HitTest(const FVector2D& Local, const FVector2D& View) const
{
	const FControl* Best = nullptr;
	float BestD = TNumericLimits<float>::Max();
	for (const FControl& C : Controls)
	{
		if (!IsVisibleNow(C)) { continue; }
		const float D = FVector2D::Distance(Local, ControlCenter(C, View));
		if (D <= ControlRadius(C, View) * 1.1f && D < BestD) { BestD = D; Best = &C; }
	}
	return Best;
}

// ----------------------------------------------------------------------------------------- actions
void UBRTouchControlsWidget::Press(FName Id)
{
	ABRCharacter* C = GetCharacter();
	ABRPlayerController* PC = GetBRPC();
	const FString S = Id.ToString();
	if (S == TEXT("LayoutEdit")) { SetEditingLayout(true); return; }
	if (S == TEXT("LayoutDone")) { SetEditingLayout(false); return; }
	if (S == TEXT("LayoutBigger") || S == TEXT("LayoutSmaller"))
	{
		for (FControl& Ctl : Controls) { if (Ctl.Id == SelectedControl) { Ctl.Size = FMath::Clamp(Ctl.Size * (S == TEXT("LayoutBigger") ? 1.1f : 0.9f), 0.04f, 0.3f); } }
		return;
	}
	if (S == TEXT("Menu")) { if (PC) { PC->ToggleMenu(); } return; }
	if (S == TEXT("Map")) { if (PC) { PC->SetMapOpen(!PC->IsMapOpen()); } return; }
	if (!C)
	{
		if (!PC) { return; }
		const ABRPlayerState* PS = PC->GetPlayerState<ABRPlayerState>();
		if (S == TEXT("Jump") && PS && PS->IsOnBus()) { PC->RequestJumpFromBus(); }
		if (S == TEXT("Fire")) { PC->SpectateNext(); }
		return;
	}
	if (S == TEXT("Fire") || S == TEXT("FireLeft")) { C->StartFire(); }
	else if (S == TEXT("Aim")) { C->SetAiming(!C->IsAiming()); }
	else if (S == TEXT("Jump")) { C->JumpPressed(); }
	else if (S == TEXT("Crouch")) { C->ToggleCrouch(); }
	else if (S == TEXT("Reload") || S == TEXT("Rotate")) { C->ReloadWeapon(); }
	else if (S == TEXT("Build")) { C->ToggleBuildMode(); }
	else if (S == TEXT("Edit")) { C->ToggleEditMode(); }
	else if (S == TEXT("Interact")) { C->InteractPressed(); }
	else if (S == TEXT("Ping")) { if (PC) { PC->PlacePingAtCrosshair(); } }
	else if (S == TEXT("Emote")) { C->PlayEmote(0); }
	else if (S == TEXT("Drop")) { C->DropActiveItem(); }
	else if (S == TEXT("Material")) { C->CycleBuildMaterial(); }
	else if (S == TEXT("Wall")) { C->GetBuild()->SelectPiece(EBRBuildPieceType::Wall); }
	else if (S == TEXT("Floor")) { C->GetBuild()->SelectPiece(EBRBuildPieceType::Floor); }
	else if (S == TEXT("Ramp")) { C->GetBuild()->SelectPiece(EBRBuildPieceType::Ramp); }
	else if (S == TEXT("Roof")) { C->GetBuild()->SelectPiece(EBRBuildPieceType::Roof); }
	else if (S == TEXT("EditDoor")) { C->GetBuild()->ApplyEditPreset(uint8(BRRules::EditPreset::Door)); }
	else if (S == TEXT("EditWindow")) { C->GetBuild()->ApplyEditPreset(uint8(BRRules::EditPreset::Window)); }
	else if (S == TEXT("EditArch")) { C->GetBuild()->ApplyEditPreset(uint8(BRRules::EditPreset::Arch)); }
	else if (S == TEXT("EditHalf")) { C->GetBuild()->ApplyEditPreset(uint8(BRRules::EditPreset::HalfWall)); }
	else if (S == TEXT("EditReset")) { C->GetBuild()->ResetEdit(); }
	else if (S.StartsWith(TEXT("Slot"))) { C->SelectSlot(FCString::Atoi(*S.RightChop(4)) - 1); }
}

void UBRTouchControlsWidget::Release(FName Id)
{
	ABRCharacter* C = GetCharacter();
	if (!C) { return; }
	const FString S = Id.ToString();
	if (S == TEXT("Fire") || S == TEXT("FireLeft")) { C->StopFire(); }
	else if (S == TEXT("Jump")) { C->JumpReleased(); }
	else if (S == TEXT("Interact")) { C->InteractReleased(); }
}

// ----------------------------------------------------------------------------------------- input
void UBRTouchControlsWidget::HandleDown(int32 Pointer, const FVector2D& Local)
{
	FTouch T; T.Start = T.Last = Local;
	if (const FControl* C = HitTest(Local, ViewSize))
	{
		const bool bLayoutButton = C->Id.ToString().StartsWith(TEXT("Layout"));
		if (bEditingLayout && !bLayoutButton)
		{
			T.Role = ERole::EditDrag; T.Control = C->Id; SelectedControl = C->Id;
		}
		else
		{
			T.Role = ERole::Button; T.Control = C->Id;
			Press(C->Id);
		}
	}
	else if (!bEditingLayout && Local.X < ViewSize.X * 0.4f && !bJoyActive)
	{
		T.Role = ERole::Joystick;
		JoyOrigin = Local; JoyAxis = FVector2D::ZeroVector; bJoyActive = true;
	}
	else if (!bEditingLayout)
	{
		T.Role = ERole::Look;
	}
	Touches.Add(Pointer, T);
}

void UBRTouchControlsWidget::HandleMove(int32 Pointer, const FVector2D& Local)
{
	FTouch* T = Touches.Find(Pointer);
	if (!T) { return; }
	const FVector2D Delta = Local - T->Last;
	T->Last = Local;
	switch (T->Role)
	{
	case ERole::Joystick:
	{
		const float Radius = ViewSize.Y * 0.11f;
		FVector2D Off = Local - JoyOrigin;
		if (Off.Size() > Radius * 1.6f) { JoyOrigin = Local - Off.GetSafeNormal() * Radius * 1.6f; Off = Local - JoyOrigin; } // floating base follows the thumb
		JoyAxis = FVector2D(Off.X, -Off.Y) / Radius;
		if (JoyAxis.Size() > 1.f) { JoyAxis.Normalize(); }
		break;
	}
	case ERole::Look:
	case ERole::Button:
	{
		// Fire button also steers the camera (drag while shooting).
		if (T->Role == ERole::Button && T->Control != TEXT("Fire")) { break; }
		if (ABRCharacter* C = GetCharacter())
		{
			const UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
			const float Sens = 0.12f * (S ? S->TouchSensitivity : 1.f) * (C->IsAiming() && S ? S->AimSensitivityMultiplier : 1.f) * (1080.f / FMath::Max(1.f, ViewSize.Y));
			C->LookInput(FVector2D(Delta.X, -Delta.Y * ((S && S->bInvertY) ? -1.f : 1.f)) * Sens, true);
		}
		else if (APlayerController* PC = GetOwningPlayer())
		{
			// Bus / spectator: rotate the view.
			FRotator R = PC->GetControlRotation();
			R.Yaw += Delta.X * 0.15f; R.Pitch = FMath::ClampAngle(R.Pitch - Delta.Y * 0.15f, -80.f, 60.f);
			PC->SetControlRotation(R);
		}
		break;
	}
	case ERole::EditDrag:
		for (FControl& C : Controls)
		{
			if (C.Id == T->Control) { C.Center = FVector2D(FMath::Clamp(Local.X / ViewSize.X, 0.03f, 0.97f), FMath::Clamp(Local.Y / ViewSize.Y, 0.03f, 0.97f)); }
		}
		break;
	default: break;
	}
}

void UBRTouchControlsWidget::HandleUp(int32 Pointer, const FVector2D& Local)
{
	FTouch T;
	if (!Touches.RemoveAndCopyValue(Pointer, T)) { return; }
	if (T.Role == ERole::Joystick) { bJoyActive = false; JoyAxis = FVector2D::ZeroVector; }
	if (T.Role == ERole::Button) { Release(T.Control); }
}

FReply UBRTouchControlsWidget::NativeOnTouchStarted(const FGeometry& G, const FPointerEvent& E)
{
	HandleDown(E.GetPointerIndex(), G.AbsoluteToLocal(E.GetScreenSpacePosition()));
	return FReply::Handled();
}

FReply UBRTouchControlsWidget::NativeOnTouchMoved(const FGeometry& G, const FPointerEvent& E)
{
	HandleMove(E.GetPointerIndex(), G.AbsoluteToLocal(E.GetScreenSpacePosition()));
	return FReply::Handled();
}

FReply UBRTouchControlsWidget::NativeOnTouchEnded(const FGeometry& G, const FPointerEvent& E)
{
	HandleUp(E.GetPointerIndex(), G.AbsoluteToLocal(E.GetScreenSpacePosition()));
	return FReply::Handled();
}

// Mouse emulates one finger so the layout can be tested on PC.
FReply UBRTouchControlsWidget::NativeOnMouseButtonDown(const FGeometry& G, const FPointerEvent& E)
{
	HandleDown(100, G.AbsoluteToLocal(E.GetScreenSpacePosition()));
	return FReply::Handled().CaptureMouse(TakeWidget());
}

FReply UBRTouchControlsWidget::NativeOnMouseMove(const FGeometry& G, const FPointerEvent& E)
{
	HandleMove(100, G.AbsoluteToLocal(E.GetScreenSpacePosition()));
	return Touches.Contains(100) ? FReply::Handled() : FReply::Unhandled();
}

FReply UBRTouchControlsWidget::NativeOnMouseButtonUp(const FGeometry& G, const FPointerEvent& E)
{
	HandleUp(100, G.AbsoluteToLocal(E.GetScreenSpacePosition()));
	return FReply::Handled().ReleaseMouseCapture();
}

void UBRTouchControlsWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
	Super::NativeTick(MyGeometry, InDeltaTime);
	ViewSize = MyGeometry.GetLocalSize();
	// While the pause/settings menu is open the controls let touches through to it.
	const ABRPlayerController* PC = GetBRPC();
	const bool bMenu = PC && PC->IsMenuOpen();
	SetVisibility(bMenu ? ESlateVisibility::HitTestInvisible : ESlateVisibility::Visible);
	if (bMenu) { Touches.Reset(); bJoyActive = false; JoyAxis = FVector2D::ZeroVector; }
	if (ABRCharacter* C = GetCharacter())
	{
		C->MoveInput(JoyAxis);
		// Auto-sprint when the stick is pushed to the edge.
		C->SetSprinting(bJoyActive && JoyAxis.Size() > 0.95f && JoyAxis.Y > 0.5f);
	}
}

int32 UBRTouchControlsWidget::NativePaint(const FPaintArgs& Args, const FGeometry& G, const FSlateRect& MyCullingRect,
	FSlateWindowElementList& Out, int32 LayerId, const FWidgetStyle& InWidgetStyle, bool bParentEnabled) const
{
	int32 L = Super::NativePaint(Args, G, MyCullingRect, Out, LayerId, InWidgetStyle, bParentEnabled) + 1;
	const FVector2D View = G.GetLocalSize();
	if (const ABRPlayerController* PC = GetBRPC(); PC && PC->IsMenuOpen()) { return L; }

	// Joystick.
	const float JR = View.Y * 0.11f;
	const FVector2D Base = bJoyActive ? JoyOrigin : FVector2D(View.X * 0.14f, View.Y * 0.72f);
	PaintCircle(Out, L, G, Base, JR, FLinearColor(1, 1, 1, 0.35f), 3.f);
	PaintDisc(Out, L + 1, G, Base + FVector2D(JoyAxis.X, -JoyAxis.Y) * JR, JR * 0.4f, FLinearColor(1, 1, 1, bJoyActive ? 0.55f : 0.3f));

	const ABRCharacter* Ch = GetCharacter();
	for (const FControl& C : Controls)
	{
		if (!IsVisibleNow(C)) { continue; }
		const FVector2D P = ControlCenter(C, View);
		const float R = ControlRadius(C, View);
		bool bPressed = false;
		for (const TPair<int32, FTouch>& T : Touches) { if (T.Value.Control == C.Id) { bPressed = true; } }
		FLinearColor Fill(0.f, 0.f, 0.f, C.Opacity * 0.5f);
		if (C.Id == TEXT("Fire") || C.Id == TEXT("FireLeft")) { Fill = FLinearColor(0.85f, 0.15f, 0.1f, C.Opacity * 0.6f); }
		if (bPressed) { Fill.A = FMath::Min(1.f, Fill.A + 0.3f); }
		if (bEditingLayout && C.Id == SelectedControl) { Fill = FLinearColor(1.f, 0.85f, 0.2f, 0.6f); }
		PaintDisc(Out, L, G, P, R, Fill);
		PaintCircle(Out, L + 1, G, P, R, FLinearColor(1, 1, 1, C.Opacity), 2.f);
		FString Label = C.Label.ToString();
		if (C.Id == TEXT("Jump") && !Ch) { Label = TEXT("SALTAR"); }
		if (C.Id == TEXT("Interact") && Ch && Ch->IsInVehicle()) { Label = TEXT("SAIR"); }
		if (C.Id == TEXT("Aim") && Ch && Ch->IsAiming()) { Label = TEXT("SOLTAR"); }
		if (C.Id.ToString().StartsWith(TEXT("Slot")) && Ch)
		{
			const int32 SlotIndex = FCString::Atoi(*C.Id.ToString().RightChop(4)) - 1;
			if (Ch->GetInventory()->GetActiveSlot() == SlotIndex) { PaintCircle(Out, L + 1, G, P, R + 3.f, FLinearColor(1.f, 0.85f, 0.2f), 3.f); }
		}
		PaintLabel(Out, L + 2, G, P, Label, FMath::Clamp(int32(R * 0.32f), 9, 18), FLinearColor::White);
	}
	if (bEditingLayout)
	{
		PaintLabel(Out, L + 2, G, FVector2D(View.X * 0.5f, View.Y * 0.04f), TEXT("Arraste os botões. Selecione um e use + / - para o tamanho."), 16, FLinearColor(1.f, 0.85f, 0.2f));
	}
	return L + 3;
}

#undef LOCTEXT_NAMESPACE
