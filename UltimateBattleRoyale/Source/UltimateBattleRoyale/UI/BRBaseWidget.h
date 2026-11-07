#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "BRBaseWidget.generated.h"

class UTextBlock;
class UButton;
class UVerticalBox;
class UHorizontalBox;
class UBorder;
class UScrollBox;

// Routes a UMG button click to a C++ lambda (lets menus be built entirely in code).
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRButtonProxy : public UObject
{
	GENERATED_BODY()
public:
	TFunction<void()> Action;
	UFUNCTION() void Handle() { if (Action) { Action(); } }
};

// Base for code-built widgets: no Widget Blueprint required. Authored UMG skins can subclass
// these and override the layout while keeping the logic.
UCLASS(Abstract)
class ULTIMATEBATTLEROYALE_API UBRBaseWidget : public UUserWidget
{
	GENERATED_BODY()

protected:
	virtual TSharedRef<SWidget> RebuildWidget() override;
	virtual void BuildLayout() {}

	UTextBlock* MakeText(const FText& Text, int32 Size = 18, const FLinearColor& Color = FLinearColor::White, bool bBold = true);
	UButton* MakeButton(const FText& Label, TFunction<void()> OnClick, const FLinearColor& Bg = FLinearColor(0.12f, 0.35f, 0.85f), int32 FontSize = 18);
	UVerticalBox* MakeColumn();
	UHorizontalBox* MakeRow();
	UBorder* MakePanel(const FLinearColor& Bg, float Padding = 12.f);
	UScrollBox* MakeScroll();
	void AddTo(UVerticalBox* Box, UWidget* Child, float Pad = 4.f);
	void AddTo(UHorizontalBox* Box, UWidget* Child, float Pad = 4.f, bool bFill = false);
	// "Label  [-] value [+]" stepper used by the settings screens.
	UHorizontalBox* MakeStepper(const FText& Label, TFunction<FText()> GetValue, TFunction<void(int32)> OnStep);
	void ClearProxies() { Proxies.Reset(); }

	// Shared settings panel (main menu and in-match menu).
	void BuildSettingsPanel(UVerticalBox* Into, TFunction<void()> Refresh);

	static FSlateFontInfo Font(int32 Size, bool bBold = true);
	void PlayClick() const;

private:
	UPROPERTY(Transient) TArray<TObjectPtr<UBRButtonProxy>> Proxies;
};
