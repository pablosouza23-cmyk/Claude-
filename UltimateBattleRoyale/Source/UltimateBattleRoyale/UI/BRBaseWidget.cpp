#include "UI/BRBaseWidget.h"

#include "Audio/BRProceduralAudio.h"
#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/ScrollBox.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Settings/BRGameUserSettings.h"
#include "Settings/BRPerformanceSubsystem.h"
#include "Styling/CoreStyle.h"

#define LOCTEXT_NAMESPACE "BRUI"

TSharedRef<SWidget> UBRBaseWidget::RebuildWidget()
{
	if (WidgetTree && !WidgetTree->RootWidget) { BuildLayout(); }
	return Super::RebuildWidget();
}

FSlateFontInfo UBRBaseWidget::Font(int32 Size, bool bBold)
{
	return FCoreStyle::GetDefaultFontStyle(bBold ? "Bold" : "Regular", Size);
}

void UBRBaseWidget::PlayClick() const
{
	UBRProceduralAudio::PlaySfx(this, EBRSfx::UIClick, FVector::ZeroVector, 0.6f, true);
}

UTextBlock* UBRBaseWidget::MakeText(const FText& Text, int32 Size, const FLinearColor& Color, bool bBold)
{
	UTextBlock* T = WidgetTree->ConstructWidget<UTextBlock>(UTextBlock::StaticClass());
	T->SetText(Text);
	T->SetFont(Font(Size, bBold));
	T->SetColorAndOpacity(FSlateColor(Color));
	T->SetShadowOffset(FVector2D(1.f, 1.f));
	T->SetShadowColorAndOpacity(FLinearColor(0.f, 0.f, 0.f, 0.6f));
	return T;
}

UButton* UBRBaseWidget::MakeButton(const FText& Label, TFunction<void()> OnClick, const FLinearColor& Bg, int32 FontSize)
{
	UButton* B = WidgetTree->ConstructWidget<UButton>(UButton::StaticClass());
	B->SetBackgroundColor(Bg);
	UTextBlock* T = MakeText(Label, FontSize);
	T->SetJustification(ETextJustify::Center);
	B->AddChild(T);
	UBRButtonProxy* Proxy = NewObject<UBRButtonProxy>(this);
	TWeakObjectPtr<UBRBaseWidget> WeakThis = this;
	Proxy->Action = [WeakThis, OnClick]()
	{
		if (WeakThis.IsValid()) { WeakThis->PlayClick(); }
		if (OnClick) { OnClick(); }
	};
	B->OnClicked.AddDynamic(Proxy, &UBRButtonProxy::Handle);
	Proxies.Add(Proxy);
	return B;
}

UVerticalBox* UBRBaseWidget::MakeColumn() { return WidgetTree->ConstructWidget<UVerticalBox>(UVerticalBox::StaticClass()); }
UHorizontalBox* UBRBaseWidget::MakeRow() { return WidgetTree->ConstructWidget<UHorizontalBox>(UHorizontalBox::StaticClass()); }
UScrollBox* UBRBaseWidget::MakeScroll() { return WidgetTree->ConstructWidget<UScrollBox>(UScrollBox::StaticClass()); }

UBorder* UBRBaseWidget::MakePanel(const FLinearColor& Bg, float Padding)
{
	UBorder* B = WidgetTree->ConstructWidget<UBorder>(UBorder::StaticClass());
	B->SetBrushColor(Bg);
	B->SetPadding(FMargin(Padding));
	return B;
}

void UBRBaseWidget::AddTo(UVerticalBox* Box, UWidget* Child, float Pad)
{
	if (UVerticalBoxSlot* S = Box->AddChildToVerticalBox(Child)) { S->SetPadding(FMargin(Pad)); }
}

void UBRBaseWidget::AddTo(UHorizontalBox* Box, UWidget* Child, float Pad, bool bFill)
{
	if (UHorizontalBoxSlot* S = Box->AddChildToHorizontalBox(Child))
	{
		S->SetPadding(FMargin(Pad));
		S->SetVerticalAlignment(VAlign_Center);
		if (bFill) { S->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); }
	}
}

UHorizontalBox* UBRBaseWidget::MakeStepper(const FText& Label, TFunction<FText()> GetValue, TFunction<void(int32)> OnStep)
{
	UHorizontalBox* Row = MakeRow();
	AddTo(Row, MakeText(Label, 16, FLinearColor::White, false), 4.f, true);
	UTextBlock* Value = MakeText(GetValue(), 16);
	TWeakObjectPtr<UTextBlock> WeakValue = Value;
	AddTo(Row, MakeButton(FText::FromString(TEXT(" - ")), [OnStep, GetValue, WeakValue]() { OnStep(-1); if (WeakValue.IsValid()) { WeakValue->SetText(GetValue()); } }, FLinearColor(0.25f, 0.25f, 0.3f), 16));
	AddTo(Row, Value, 8.f);
	AddTo(Row, MakeButton(FText::FromString(TEXT(" + ")), [OnStep, GetValue, WeakValue]() { OnStep(1); if (WeakValue.IsValid()) { WeakValue->SetText(GetValue()); } }, FLinearColor(0.25f, 0.25f, 0.3f), 16));
	return Row;
}

void UBRBaseWidget::BuildSettingsPanel(UVerticalBox* Into, TFunction<void()> Refresh)
{
	UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	UBRPerformanceSubsystem* Perf = GetGameInstance() ? GetGameInstance()->GetSubsystem<UBRPerformanceSubsystem>() : nullptr;
	if (!S) { return; }
	auto Pct = [](float V) { return FText::FromString(FString::Printf(TEXT("%d%%"), FMath::RoundToInt(V * 100.f))); };
	auto OnOff = [](bool b) { return b ? LOCTEXT("On", "Ligado") : LOCTEXT("Off", "Desligado"); };
	auto Persist = [S]() { S->SaveSettings(); };

	AddTo(Into, MakeText(LOCTEXT("Graphics", "Gráficos"), 22, FLinearColor(1.f, 0.85f, 0.2f)));
	UHorizontalBox* Quality = MakeRow();
	auto TierName = [Perf, S]()
	{
		const TCHAR* Names[] = { TEXT("Baixa"), TEXT("Média"), TEXT("Alta") };
		const FString Current = Perf ? Names[int32(Perf->GetQualityTier())] : TEXT("?");
		return FText::FromString(FString::Printf(TEXT("Qualidade: %s%s"), *Current, S->QualityTierOverride < 0 ? TEXT(" (automática)") : TEXT("")));
	};
	UTextBlock* QualityLabel = MakeText(TierName(), 16);
	TWeakObjectPtr<UTextBlock> WeakQ = QualityLabel;
	AddTo(Into, QualityLabel);
	AddTo(Quality, MakeButton(LOCTEXT("Auto", "Automática"), [Perf, WeakQ, TierName]() { if (Perf) { Perf->UseAutomaticQuality(); } if (WeakQ.IsValid()) { WeakQ->SetText(TierName()); } }, FLinearColor(0.2f, 0.45f, 0.3f), 15));
	const FText TierLabels[] = { LOCTEXT("Low", "Baixa"), LOCTEXT("Med", "Média"), LOCTEXT("High", "Alta") };
	for (int32 T = 0; T < 3; ++T)
	{
		AddTo(Quality, MakeButton(TierLabels[T], [Perf, T, WeakQ, TierName]() { if (Perf) { Perf->SetQualityTier(EBRQualityTier(T), true); } if (WeakQ.IsValid()) { WeakQ->SetText(TierName()); } }, FLinearColor(0.2f, 0.25f, 0.4f), 15));
	}
	AddTo(Into, Quality);
	AddTo(Into, MakeStepper(LOCTEXT("DynRes", "Resolução dinâmica"), [S, OnOff]() { return OnOff(S->bDynamicResolution); }, [S, Persist](int32) { S->bDynamicResolution = !S->bDynamicResolution; Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("ShowFPS", "Mostrar FPS"), [S, OnOff]() { return OnOff(S->bShowFPS); }, [S, Persist](int32) { S->bShowFPS = !S->bShowFPS; Persist(); }));

	AddTo(Into, MakeText(LOCTEXT("Controls", "Controles"), 22, FLinearColor(1.f, 0.85f, 0.2f)));
	AddTo(Into, MakeStepper(LOCTEXT("Look", "Sensibilidade (mouse)"), [S, Pct]() { return Pct(S->LookSensitivity); }, [S, Persist](int32 D) { S->LookSensitivity = FMath::Clamp(S->LookSensitivity + D * 0.1f, 0.1f, 5.f); Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("Touch", "Sensibilidade (toque)"), [S, Pct]() { return Pct(S->TouchSensitivity); }, [S, Persist](int32 D) { S->TouchSensitivity = FMath::Clamp(S->TouchSensitivity + D * 0.1f, 0.1f, 5.f); Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("Stick", "Sensibilidade (controle)"), [S, Pct]() { return Pct(S->StickSensitivity); }, [S, Persist](int32 D) { S->StickSensitivity = FMath::Clamp(S->StickSensitivity + D * 0.1f, 0.1f, 5.f); Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("AimSens", "Sensibilidade na mira"), [S, Pct]() { return Pct(S->AimSensitivityMultiplier); }, [S, Persist](int32 D) { S->AimSensitivityMultiplier = FMath::Clamp(S->AimSensitivityMultiplier + D * 0.05f, 0.1f, 2.f); Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("AimAssist", "Assistência de mira"), [S, Pct]() { return Pct(S->AimAssistStrength); }, [S, Persist](int32 D) { S->AimAssistStrength = FMath::Clamp(S->AimAssistStrength + D * 0.1f, 0.f, 1.f); Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("InvertY", "Inverter eixo Y"), [S, OnOff]() { return OnOff(S->bInvertY); }, [S, Persist](int32) { S->bInvertY = !S->bInvertY; Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("Gyro", "Giroscópio"), [S, OnOff]() { return OnOff(S->bGyroEnabled); }, [S, Persist](int32) { S->bGyroEnabled = !S->bGyroEnabled; Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("GyroAim", "Giroscópio só mirando"), [S, OnOff]() { return OnOff(S->bGyroOnlyWhenAiming); }, [S, Persist](int32) { S->bGyroOnlyWhenAiming = !S->bGyroOnlyWhenAiming; Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("GyroSens", "Sensibilidade do giroscópio"), [S, Pct]() { return Pct(S->GyroSensitivity); }, [S, Persist](int32 D) { S->GyroSensitivity = FMath::Clamp(S->GyroSensitivity + D * 0.1f, 0.1f, 4.f); Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("Vibration", "Vibração"), [S, OnOff]() { return OnOff(S->bVibrationEnabled); }, [S, Persist](int32) { S->bVibrationEnabled = !S->bVibrationEnabled; Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("TouchForce", "Controles de toque no PC"), [S, OnOff]() { return OnOff(S->bForceTouchControls); }, [S, Persist](int32) { S->bForceTouchControls = !S->bForceTouchControls; Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("ButtonScale", "Tamanho dos botões"), [S, Pct]() { return Pct(S->TouchButtonScale); }, [S, Persist](int32 D) { S->TouchButtonScale = FMath::Clamp(S->TouchButtonScale + D * 0.1f, 0.6f, 1.8f); Persist(); }));
	AddTo(Into, MakeButton(LOCTEXT("ResetLayout", "Restaurar layout de toque"), [S, Persist]() { S->TouchLayout.Reset(); Persist(); }, FLinearColor(0.4f, 0.25f, 0.2f), 15));

	AddTo(Into, MakeText(LOCTEXT("Audio", "Áudio e voz"), 22, FLinearColor(1.f, 0.85f, 0.2f)));
	AddTo(Into, MakeStepper(LOCTEXT("Master", "Volume geral"), [S, Pct]() { return Pct(S->MasterVolume); }, [S, Persist](int32 D) { S->MasterVolume = FMath::Clamp(S->MasterVolume + D * 0.1f, 0.f, 1.f); Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("Music", "Música"), [S, Pct]() { return Pct(S->MusicVolume); }, [S, Persist](int32 D) { S->MusicVolume = FMath::Clamp(S->MusicVolume + D * 0.1f, 0.f, 1.f); Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("Sfx", "Efeitos"), [S, Pct]() { return Pct(S->SfxVolume); }, [S, Persist](int32 D) { S->SfxVolume = FMath::Clamp(S->SfxVolume + D * 0.1f, 0.f, 1.f); Persist(); }));
	AddTo(Into, MakeStepper(LOCTEXT("Voice", "Chat de voz"), [S, OnOff]() { return OnOff(S->bVoiceChatEnabled); }, [S, Persist](int32) { S->bVoiceChatEnabled = !S->bVoiceChatEnabled; Persist(); }));
}

#undef LOCTEXT_NAMESPACE
