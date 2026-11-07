#pragma once

#include "CoreMinimal.h"
#include "UI/BRBaseWidget.h"
#include "BRHUDWidget.generated.h"

class UCanvasPanel;
class UEditableTextBox;
class UBorder;
class UVerticalBox;
class ABRCharacter;
class ABRGameState;

// In-match HUD. Gameplay readouts are painted directly (one widget, very cheap on mobile);
// interactive parts (chat input, pause/settings/report/creative menu) are UMG widgets.
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRHUDWidget : public UBRBaseWidget
{
	GENERATED_BODY()

public:
	void AddHitMarker(const FVector& WorldLocation, float Damage, bool bHeadshot, bool bShield, bool bEliminated);
	void AddDamageIndicator(const FVector& FromLocation, float Damage);
	void OpenChatInput();
	void SetMenuOpen(bool bOpen);

protected:
	virtual void BuildLayout() override;
	virtual void NativeConstruct() override;
	virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;
	virtual int32 NativePaint(const FPaintArgs& Args, const FGeometry& AllottedGeometry, const FSlateRect& MyCullingRect,
		FSlateWindowElementList& OutDrawElements, int32 LayerId, const FWidgetStyle& InWidgetStyle, bool bParentEnabled) const override;

	UFUNCTION() void OnChatCommitted(const FText& Text, ETextCommit::Type Method);

private:
	struct FHitMarker { FVector World; float Damage; bool bHead; bool bShield; bool bElim; float Time; };
	struct FDamageIndicator { FVector From; float Damage; float Time; };

	void RebuildMenu();
	void OnAnnouncement(const FText& Message);

	// Painting helpers.
	void PaintBars(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G, const ABRCharacter* C) const;
	void PaintSlots(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G, const ABRCharacter* C) const;
	void PaintCrosshair(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G, const ABRCharacter* C) const;
	void PaintMap(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G, const FVector2D& Pos, float Size, bool bBig) const;
	void PaintCompass(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G) const;
	void PaintWorldMarkers(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G) const;
	void PaintInfo(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G, const ABRCharacter* C) const;
	void PaintResult(FSlateWindowElementList& Out, int32 Layer, const FGeometry& G) const;
	bool WorldToLocal(const FVector& World, FVector2D& OutLocal) const;

	UPROPERTY(Transient) TObjectPtr<UCanvasPanel> Root;
	UPROPERTY(Transient) TObjectPtr<UEditableTextBox> ChatBox;
	UPROPERTY(Transient) TObjectPtr<UBorder> MenuPanel;
	UPROPERTY(Transient) TObjectPtr<UVerticalBox> MenuContent;

	TArray<FHitMarker> HitMarkers;
	TArray<FDamageIndicator> DamageIndicators;
	FText Announcement;
	float AnnouncementTime = -100.f;
	float Now = 0.f;
	int32 MenuPage = 0;
	bool bChatTeam = false;
	mutable FSlateBrush MinimapBrush;
	bool bBoundGameState = false;
};
