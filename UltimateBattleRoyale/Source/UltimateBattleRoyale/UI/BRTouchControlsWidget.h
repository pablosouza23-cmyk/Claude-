#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "BRTouchControlsWidget.generated.h"

class ABRCharacter;
class ABRPlayerController;

// Full touchscreen controls with multi-touch: floating left joystick (auto-sprint at the edge),
// right-side camera drag with aim assist, context-sensitive buttons (combat / build / edit /
// vehicle / bus / spectate), and an in-game layout editor (drag to move, +/- to resize),
// persisted per device in GameUserSettings.
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRTouchControlsWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	void SetEditingLayout(bool bEditing);
	bool IsEditingLayout() const { return bEditingLayout; }

protected:
	virtual void NativeConstruct() override;
	virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;
	virtual int32 NativePaint(const FPaintArgs& Args, const FGeometry& AllottedGeometry, const FSlateRect& MyCullingRect,
		FSlateWindowElementList& OutDrawElements, int32 LayerId, const FWidgetStyle& InWidgetStyle, bool bParentEnabled) const override;
	virtual FReply NativeOnTouchStarted(const FGeometry& InGeometry, const FPointerEvent& InGestureEvent) override;
	virtual FReply NativeOnTouchMoved(const FGeometry& InGeometry, const FPointerEvent& InGestureEvent) override;
	virtual FReply NativeOnTouchEnded(const FGeometry& InGeometry, const FPointerEvent& InGestureEvent) override;
	virtual FReply NativeOnMouseButtonDown(const FGeometry& InGeometry, const FPointerEvent& InMouseEvent) override;
	virtual FReply NativeOnMouseMove(const FGeometry& InGeometry, const FPointerEvent& InMouseEvent) override;
	virtual FReply NativeOnMouseButtonUp(const FGeometry& InGeometry, const FPointerEvent& InMouseEvent) override;

private:
	struct FControl
	{
		FName Id;
		FText Label;
		FVector2D Center;   // normalised
		float Size;         // fraction of viewport height
		float Opacity = 0.55f;
		bool bHold = false; // press/release vs tap
	};
	enum class ERole : uint8 { None, Joystick, Look, Button, EditDrag };
	struct FTouch { ERole Role = ERole::None; FName Control; FVector2D Start; FVector2D Last; };

	void BuildDefaults();
	void LoadLayout();
	void SaveLayout();
	bool IsVisibleNow(const FControl& C) const;
	const FControl* HitTest(const FVector2D& Local, const FVector2D& ViewSize) const;
	FVector2D ControlCenter(const FControl& C, const FVector2D& ViewSize) const;
	float ControlRadius(const FControl& C, const FVector2D& ViewSize) const;
	void Press(FName Id);
	void Release(FName Id);
	void HandleDown(int32 Pointer, const FVector2D& Local);
	void HandleMove(int32 Pointer, const FVector2D& Local);
	void HandleUp(int32 Pointer, const FVector2D& Local);
	ABRCharacter* GetCharacter() const;
	ABRPlayerController* GetBRPC() const;

	TArray<FControl> Controls;
	TMap<int32, FTouch> Touches;
	FVector2D ViewSize = FVector2D(1920, 1080);
	FVector2D JoyOrigin = FVector2D::ZeroVector;
	FVector2D JoyAxis = FVector2D::ZeroVector;
	bool bJoyActive = false;
	bool bEditingLayout = false;
	FName SelectedControl;
};
