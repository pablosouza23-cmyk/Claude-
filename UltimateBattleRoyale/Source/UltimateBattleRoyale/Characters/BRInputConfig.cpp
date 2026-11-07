#include "Characters/BRInputConfig.h"

#include "InputAction.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "InputCoreTypes.h"
#include "UObject/Package.h"

UBRInputConfig* UBRInputConfig::Get()
{
	static TWeakObjectPtr<UBRInputConfig> Instance;
	if (!Instance.IsValid())
	{
		UBRInputConfig* Config = NewObject<UBRInputConfig>(GetTransientPackage(), TEXT("BRInputConfig"));
		Config->AddToRoot();
		Config->Build();
		Instance = Config;
	}
	return Instance.Get();
}

UInputAction* UBRInputConfig::MakeAction(const TCHAR* Name, uint8 ValueType)
{
	UInputAction* A = NewObject<UInputAction>(this, Name);
	A->ValueType = EInputActionValueType(ValueType);
	return A;
}

void UBRInputConfig::Build()
{
	const uint8 Bool = uint8(EInputActionValueType::Boolean);
	const uint8 Axis1 = uint8(EInputActionValueType::Axis1D);
	const uint8 Axis2 = uint8(EInputActionValueType::Axis2D);
	const uint8 Axis3 = uint8(EInputActionValueType::Axis3D);

	Move = MakeAction(TEXT("IA_Move"), Axis2);
	LookMouse = MakeAction(TEXT("IA_LookMouse"), Axis2);
	LookStick = MakeAction(TEXT("IA_LookStick"), Axis2);
	LookGyro = MakeAction(TEXT("IA_LookGyro"), Axis3);
	Jump = MakeAction(TEXT("IA_Jump"), Bool);
	Crouch = MakeAction(TEXT("IA_Crouch"), Bool);
	Sprint = MakeAction(TEXT("IA_Sprint"), Bool);
	Fire = MakeAction(TEXT("IA_Fire"), Bool);
	Aim = MakeAction(TEXT("IA_Aim"), Bool);
	Reload = MakeAction(TEXT("IA_Reload"), Bool);
	Interact = MakeAction(TEXT("IA_Interact"), Bool);
	Pickaxe = MakeAction(TEXT("IA_Pickaxe"), Bool);
	for (int32 I = 0; I < 5; ++I) { Slots.Add(MakeAction(*FString::Printf(TEXT("IA_Slot%d"), I + 1), Bool)); }
	NextSlot = MakeAction(TEXT("IA_NextSlot"), Bool);
	PrevSlot = MakeAction(TEXT("IA_PrevSlot"), Bool);
	BuildMode = MakeAction(TEXT("IA_BuildMode"), Bool);
	EditMode = MakeAction(TEXT("IA_EditMode"), Bool);
	CycleMaterial = MakeAction(TEXT("IA_CycleMaterial"), Bool);
	Emote = MakeAction(TEXT("IA_Emote"), Bool);
	Drop = MakeAction(TEXT("IA_Drop"), Bool);
	Ping = MakeAction(TEXT("IA_Ping"), Bool);
	Map = MakeAction(TEXT("IA_Map"), Bool);
	PushToTalk = MakeAction(TEXT("IA_PushToTalk"), Bool);
	Chat = MakeAction(TEXT("IA_Chat"), Bool);
	Menu = MakeAction(TEXT("IA_Menu"), Bool);
	(void)Axis1;

	DefaultContext = NewObject<UInputMappingContext>(this, TEXT("IMC_Default"));
	UInputMappingContext* C = DefaultContext;

	// WASD -> 2D move (X = right, Y = forward).
	{
		FEnhancedActionKeyMapping& W = C->MapKey(Move, EKeys::W);
		UInputModifierSwizzleAxis* SwW = NewObject<UInputModifierSwizzleAxis>(C);
		SwW->Order = EInputAxisSwizzle::YXZ;
		W.Modifiers.Add(SwW);

		FEnhancedActionKeyMapping& S = C->MapKey(Move, EKeys::S);
		UInputModifierSwizzleAxis* SwS = NewObject<UInputModifierSwizzleAxis>(C);
		SwS->Order = EInputAxisSwizzle::YXZ;
		S.Modifiers.Add(SwS);
		S.Modifiers.Add(NewObject<UInputModifierNegate>(C));

		FEnhancedActionKeyMapping& A = C->MapKey(Move, EKeys::A);
		A.Modifiers.Add(NewObject<UInputModifierNegate>(C));
		C->MapKey(Move, EKeys::D);

		FEnhancedActionKeyMapping& Stick = C->MapKey(Move, EKeys::Gamepad_Left2D);
		Stick.Modifiers.Add(NewObject<UInputModifierDeadZone>(C));
	}

	C->MapKey(LookMouse, EKeys::Mouse2D);
	{
		FEnhancedActionKeyMapping& RS = C->MapKey(LookStick, EKeys::Gamepad_Right2D);
		RS.Modifiers.Add(NewObject<UInputModifierDeadZone>(C));
	}
	C->MapKey(LookGyro, EKeys::RotationRate);

	C->MapKey(Jump, EKeys::SpaceBar);
	C->MapKey(Jump, EKeys::Gamepad_FaceButton_Bottom);
	C->MapKey(Crouch, EKeys::LeftControl);
	C->MapKey(Crouch, EKeys::C);
	C->MapKey(Crouch, EKeys::Gamepad_FaceButton_Right);
	C->MapKey(Sprint, EKeys::LeftShift);
	C->MapKey(Sprint, EKeys::Gamepad_LeftThumbstick);
	C->MapKey(Fire, EKeys::LeftMouseButton);
	C->MapKey(Fire, EKeys::Gamepad_RightTrigger);
	C->MapKey(Aim, EKeys::RightMouseButton);
	C->MapKey(Aim, EKeys::Gamepad_LeftTrigger);
	C->MapKey(Reload, EKeys::R);
	C->MapKey(Reload, EKeys::Gamepad_FaceButton_Left);
	C->MapKey(Interact, EKeys::E);
	C->MapKey(Interact, EKeys::Gamepad_DPad_Up);
	C->MapKey(Pickaxe, EKeys::F);
	const FKey SlotKeys[5] = { EKeys::One, EKeys::Two, EKeys::Three, EKeys::Four, EKeys::Five };
	for (int32 I = 0; I < 5; ++I) { C->MapKey(Slots[I], SlotKeys[I]); }
	C->MapKey(NextSlot, EKeys::MouseScrollDown);
	C->MapKey(NextSlot, EKeys::Gamepad_RightShoulder);
	C->MapKey(PrevSlot, EKeys::MouseScrollUp);
	C->MapKey(PrevSlot, EKeys::Gamepad_LeftShoulder);
	C->MapKey(BuildMode, EKeys::Q);
	C->MapKey(BuildMode, EKeys::Gamepad_FaceButton_Top);
	C->MapKey(EditMode, EKeys::G);
	C->MapKey(EditMode, EKeys::Gamepad_RightThumbstick);
	C->MapKey(CycleMaterial, EKeys::X);
	C->MapKey(CycleMaterial, EKeys::Gamepad_DPad_Right);
	C->MapKey(Emote, EKeys::B);
	C->MapKey(Emote, EKeys::Gamepad_DPad_Down);
	C->MapKey(Drop, EKeys::V);
	C->MapKey(Ping, EKeys::MiddleMouseButton);
	C->MapKey(Ping, EKeys::Gamepad_DPad_Left);
	C->MapKey(Map, EKeys::M);
	C->MapKey(Map, EKeys::Gamepad_Special_Left);
	C->MapKey(PushToTalk, EKeys::T);
	C->MapKey(Chat, EKeys::Enter);
	C->MapKey(Menu, EKeys::Escape);
	C->MapKey(Menu, EKeys::Gamepad_Special_Right);
}
