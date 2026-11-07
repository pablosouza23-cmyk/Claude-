#include "Characters/BRProceduralBodyComponent.h"

#include "Building/BRBuildComponent.h"
#include "Characters/BRCharacter.h"
#include "Characters/BRCharacterMovementComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Core/BRVisuals.h"
#include "Inventory/BRInventoryComponent.h"
#include "Progression/BRCosmetics.h"
#include "Weapons/BRWeapon.h"

UBRProceduralBodyComponent::UBRProceduralBodyComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickGroup = TG_PostPhysics;
	SetIsReplicatedByDefault(false);
}

void UBRProceduralBodyComponent::BeginPlay()
{
	Super::BeginPlay();
	if (!bBuilt && !bUseSkeletal) { Rebuild(); }
}

void UBRProceduralBodyComponent::ApplyLoadout(const FBRCosmeticLoadout& InLoadout)
{
	Loadout = UBRCosmeticCatalog::Sanitize(InLoadout);
	if (HasBegunPlay() && !bUseSkeletal) { Rebuild(); }
}

void UBRProceduralBodyComponent::SetUseSkeletalMesh(bool bUse)
{
	bUseSkeletal = bUse;
	if (bUse) { ClearParts(); }
	else if (HasBegunPlay()) { Rebuild(); }
}

void UBRProceduralBodyComponent::ClearParts()
{
	for (USceneComponent* C : Created)
	{
		if (C) { C->DestroyComponent(); }
	}
	Created.Reset();
	Eyes.Reset();
	bBuilt = false;
}

USceneComponent* UBRProceduralBodyComponent::MakePivot(USceneComponent* Parent, const FVector& Loc)
{
	USceneComponent* P = NewObject<USceneComponent>(GetOwner());
	P->SetupAttachment(Parent);
	P->SetRelativeLocation(Loc);
	P->RegisterComponent();
	Created.Add(P);
	return P;
}

UStaticMeshComponent* UBRProceduralBodyComponent::Part(USceneComponent* Parent, UStaticMesh* Mesh, const FVector& Loc, const FVector& Size, const FLinearColor& Color, const FRotator& Rot)
{
	UStaticMeshComponent* C = BRVisuals::AddPart(GetOwner(), Parent, Mesh, Loc, Size, Rot, Color, false, 30000.f);
	if (C)
	{
		C->bCastDynamicShadow = Size.GetMax() >= 30.f;
		C->SetCanEverAffectNavigation(false);
		Created.Add(C);
	}
	return C;
}

void UBRProceduralBodyComponent::Rebuild()
{
	ClearParts();
	bBuilt = true;

	const FBRCosmeticDef* Outfit = UBRCosmeticCatalog::Find(Loadout.Outfit);
	FLinearColor Primary(0.3f, 0.4f, 0.5f), Secondary(0.2f, 0.2f, 0.25f), Accent(0.1f, 0.1f, 0.1f);
	FLinearColor Skin(0.85f, 0.65f, 0.5f), HairColor(0.1f, 0.07f, 0.05f);
	uint8 HeadGear = Loadout.HeadGear;
	if (Outfit)
	{
		UBRCosmeticCatalog::GetOutfitColors(*Outfit, Loadout.ColorVariant, Primary, Secondary, Accent);
		Skin = Outfit->Skin;
		HairColor = Outfit->Hair;
		if (HeadGear == 0) { HeadGear = Outfit->DefaultHeadGear; }
	}

	const bool bFemale = Loadout.BodyType == 1;
	const float Width = Loadout.BodyStyle == 1 ? 0.85f : (Loadout.BodyStyle == 2 ? 1.2f : 1.f);
	const float Shoulder = (bFemale ? 19.f : 22.f) * Width;
	UStaticMesh* Cube = BRVisuals::Cube();
	UStaticMesh* Sphere = BRVisuals::Sphere();
	UStaticMesh* Cyl = BRVisuals::Cylinder();
	UStaticMesh* Cone = BRVisuals::Cone();

	// Skeleton of pivots.
	Hips = MakePivot(this, FVector(0, 0, 95));
	Spine = MakePivot(Hips, FVector(0, 0, 8));
	HeadPivot = MakePivot(Spine, FVector(0, 0, 58));
	ShoulderL = MakePivot(Spine, FVector(0, -Shoulder, 50));
	ShoulderR = MakePivot(Spine, FVector(0, Shoulder, 50));
	ElbowL = MakePivot(ShoulderL, FVector(0, 0, -30));
	ElbowR = MakePivot(ShoulderR, FVector(0, 0, -30));
	USceneComponent* HandL = MakePivot(ElbowL, FVector(0, 0, -29));
	HandR = MakePivot(ElbowR, FVector(0, 0, -29));
	HipL = MakePivot(Hips, FVector(0, -10 * Width, -6));
	HipR = MakePivot(Hips, FVector(0, 10 * Width, -6));
	KneeL = MakePivot(HipL, FVector(0, 0, -42));
	KneeR = MakePivot(HipR, FVector(0, 0, -42));
	WeaponMount = MakePivot(Spine, FVector(18, 14, 38));
	USceneComponent* BackMount = MakePivot(Spine, FVector(-17, 0, 30));
	GliderGroup = MakePivot(Spine, FVector(0, 0, 175));
	PickaxeGroup = MakePivot(HandR, FVector(0, 0, -4));

	// Torso / pelvis.
	Part(Hips, Cube, FVector(0, 0, 0), FVector(24, 34 * Width * (bFemale ? 1.05f : 1.f), 18), Secondary);
	Part(Hips, Cube, FVector(0, 0, 9), FVector(25, 35 * Width, 4), Accent); // belt
	Part(Spine, Cube, FVector(0, 0, 28), FVector(bFemale ? 21.f : 24.f, (bFemale ? 32.f : 40.f) * Width, 50), Primary);
	if (bFemale) { Part(Spine, Sphere, FVector(8, 0, 36), FVector(14, 28 * Width, 14), Primary); }
	Part(Spine, Cube, FVector(12.5f, 0, 32), FVector(2, 10, 24), Accent); // zipper / chest detail

	// Head.
	const float HeadScale = bFemale ? 0.94f : 1.f;
	Part(HeadPivot, Cyl, FVector(0, 0, -5), FVector(11, 11, 10), Skin);
	Part(HeadPivot, Sphere, FVector(0, 0, 12), FVector(26, 24, 28) * HeadScale, Skin);
	for (float Side : { -5.5f, 5.5f })
	{
		if (UStaticMeshComponent* Eye = Part(HeadPivot, Sphere, FVector(11, Side, 15), FVector(4, 4, 5), FLinearColor(0.02f, 0.02f, 0.03f)))
		{
			Eyes.Add(Eye);
		}
	}
	Part(HeadPivot, Cube, FVector(12, 0, 6), FVector(2, 7, 1.5f), FLinearColor(0.45f, 0.18f, 0.16f)); // mouth

	// Hair.
	switch (Loadout.HairStyle)
	{
	case 0: Part(HeadPivot, Sphere, FVector(-2, 0, 20), FVector(27, 25, 18), HairColor); break;
	case 1:
		Part(HeadPivot, Sphere, FVector(-2, 0, 20), FVector(27, 26, 19), HairColor);
		Part(HeadPivot, Cube, FVector(-9, 0, 2), FVector(10, 24, 30), HairColor);
		break;
	case 2:
		Part(HeadPivot, Sphere, FVector(-2, 0, 20), FVector(27, 25, 18), HairColor);
		Part(HeadPivot, Cyl, FVector(-16, 0, 8), FVector(8, 8, 26), HairColor, FRotator(-25, 0, 0));
		break;
	case 3:
		for (int32 I = 0; I < 5; ++I)
		{
			Part(HeadPivot, Cone, FVector(-4 + I * 2.f, -8 + I * 4.f, 28), FVector(8, 8, 12), HairColor, FRotator(-15 + I * 3.f, 0, -20 + I * 10.f));
		}
		break;
	default: break; // bald
	}

	// Head gear.
	switch (HeadGear)
	{
	case 1: Part(HeadPivot, Sphere, FVector(0, 0, 20), FVector(30, 28, 22), Accent); Part(HeadPivot, Cube, FVector(13, 0, 15), FVector(3, 22, 7), FLinearColor(0.1f, 0.6f, 0.9f)); break;
	case 2: Part(HeadPivot, Cube, FVector(10, 0, 8), FVector(8, 22, 12), Accent); break;
	case 3: Part(HeadPivot, Cyl, FVector(0, 0, 24), FVector(27, 27, 9), Primary); Part(HeadPivot, Cube, FVector(14, 0, 21), FVector(14, 20, 2), Primary); break;
	case 4: Part(HeadPivot, Sphere, FVector(-3, 0, 16), FVector(31, 29, 32), Secondary); break;
	default: break;
	}

	// Arms (sleeves = primary, forearms = skin, gloves = accent).
	for (USceneComponent* Sh : { ShoulderL.Get(), ShoulderR.Get() })
	{
		Part(Sh, Sphere, FVector(0, 0, 0), FVector(14, 14, 14) * Width, Primary);
		Part(Sh, Cyl, FVector(0, 0, -15), FVector(10, 10, 30) * FVector(Width, Width, 1), Primary);
	}
	for (USceneComponent* El : { ElbowL.Get(), ElbowR.Get() })
	{
		Part(El, Cyl, FVector(0, 0, -14), FVector(9, 9, 28), Skin);
	}
	Part(HandL, Sphere, FVector(0, 0, 0), FVector(10, 10, 11), Accent);
	Part(HandR, Sphere, FVector(0, 0, 0), FVector(10, 10, 11), Accent);

	// Legs (trousers = secondary, boots = accent).
	for (USceneComponent* H : { HipL.Get(), HipR.Get() })
	{
		Part(H, Cyl, FVector(0, 0, -21), FVector(14, 14, 42) * FVector(Width, Width, 1), Secondary);
	}
	for (USceneComponent* K : { KneeL.Get(), KneeR.Get() })
	{
		Part(K, Cyl, FVector(0, 0, -18), FVector(12, 12, 36), Secondary);
		Part(K, Cube, FVector(5, 0, -42), FVector(25, 12, 11), Accent);
	}

	// Backpack.
	if (const FBRCosmeticDef* Back = UBRCosmeticCatalog::Find(Loadout.Backpack))
	{
		switch (Back->Shape)
		{
		case 1: Part(BackMount, Sphere, FVector(-6, 0, 0), FVector(22, 30, 34), Back->Primary); Part(BackMount, Sphere, FVector(-12, 0, 6), FVector(10, 12, 12), Back->Secondary); break;
		case 2:
			Part(BackMount, Cyl, FVector(-6, -8, 0), FVector(14, 14, 40), Back->Primary);
			Part(BackMount, Cyl, FVector(-6, 8, 0), FVector(14, 14, 40), Back->Primary);
			Part(BackMount, Cube, FVector(-6, 0, 22), FVector(6, 22, 4), Back->Secondary);
			break;
		case 3:
			Part(BackMount, Cube, FVector(-6, 0, 0), FVector(12, 22, 30), Back->Primary);
			Part(BackMount, Cube, FVector(-10, -26, 8), FVector(3, 40, 14), Back->Secondary, FRotator(0, 0, 20));
			Part(BackMount, Cube, FVector(-10, 26, 8), FVector(3, 40, 14), Back->Secondary, FRotator(0, 0, -20));
			break;
		default: Part(BackMount, Cube, FVector(-6, 0, 0), FVector(14, 30, 36), Back->Primary); Part(BackMount, Cube, FVector(-13, 0, -6), FVector(4, 24, 14), Back->Secondary); break;
		}
	}

	// Pickaxe in the right hand.
	if (const FBRCosmeticDef* Pick = UBRCosmeticCatalog::Find(Loadout.Pickaxe))
	{
		Part(PickaxeGroup, Cyl, FVector(22, 0, 0), FVector(4, 4, 60), Pick->Secondary, FRotator(90, 0, 0));
		switch (Pick->Shape)
		{
		case 1: Part(PickaxeGroup, Cube, FVector(48, 0, 9), FVector(10, 3, 20), Pick->Primary); break;
		case 2: Part(PickaxeGroup, Cube, FVector(50, 0, 0), FVector(14, 14, 24), Pick->Primary); break;
		default:
			Part(PickaxeGroup, Cone, FVector(50, 0, 13), FVector(7, 5, 24), Pick->Primary);
			Part(PickaxeGroup, Cone, FVector(50, 0, -13), FVector(7, 5, 24), Pick->Primary, FRotator(0, 0, 180));
			break;
		}
	}

	// Glider (hidden unless parachuting).
	if (const FBRCosmeticDef* Glider = UBRCosmeticCatalog::Find(Loadout.Glider))
	{
		switch (Glider->Shape)
		{
		case 1:
			Part(GliderGroup, Cube, FVector(0, -90, 0), FVector(110, 180, 4), Glider->Primary, FRotator(0, 0, 8));
			Part(GliderGroup, Cube, FVector(0, 90, 0), FVector(110, 180, 4), Glider->Primary, FRotator(0, 0, -8));
			Part(GliderGroup, Cube, FVector(-20, 0, -60), FVector(6, 120, 6), Glider->Secondary);
			break;
		case 2:
			Part(GliderGroup, Cone, FVector(0, 0, 10), FVector(260, 260, 70), Glider->Primary);
			Part(GliderGroup, Cyl, FVector(0, 0, -60), FVector(5, 5, 140), Glider->Secondary);
			break;
		default:
			for (int32 I = 0; I < 5; ++I)
			{
				const float Y = -160.f + I * 80.f;
				Part(GliderGroup, Cube, FVector(0, Y, -FMath::Abs(Y) * 0.15f), FVector(120, 82, 10), I % 2 ? Glider->Secondary : Glider->Primary, FRotator(0, 0, Y * -0.08f));
			}
			break;
		}
		for (float Y : { -110.f, 110.f })
		{
			Part(GliderGroup, Cyl, FVector(0, Y * 0.5f, -85), FVector(1.5f, 1.5f, 170), FLinearColor(0.9f, 0.9f, 0.9f), FRotator(0, 0, -Y * 0.15f));
		}
		GliderGroup->SetVisibility(false, true);
	}

	if (HeldWeapon.IsValid()) { SetHeldWeapon(HeldWeapon.Get()); }
}

void UBRProceduralBodyComponent::SetHeldWeapon(AActor* Weapon)
{
	HeldWeapon = Weapon;
	if (!Weapon) { return; }
	if (bUseSkeletal)
	{
		if (ACharacter* C = Cast<ACharacter>(GetOwner()))
		{
			Weapon->AttachToComponent(C->GetMesh(), FAttachmentTransformRules::SnapToTargetNotIncludingScale, TEXT("hand_r"));
		}
		return;
	}
	if (WeaponMount)
	{
		Weapon->AttachToComponent(WeaponMount, FAttachmentTransformRules::SnapToTargetNotIncludingScale);
	}
}

// --------------------------------------------------------------------------------------------- animation
UBRProceduralBodyComponent::FPose UBRProceduralBodyComponent::Blend(const FPose& A, const FPose& B, float Alpha)
{
	auto R = [Alpha](const FRotator& X, const FRotator& Y) { return FRotator(FMath::Lerp(X.Pitch, Y.Pitch, Alpha), FMath::Lerp(X.Yaw, Y.Yaw, Alpha), FMath::Lerp(X.Roll, Y.Roll, Alpha)); };
	FPose O;
	O.HipsZ = FMath::Lerp(A.HipsZ, B.HipsZ, Alpha);
	O.Hips = R(A.Hips, B.Hips); O.Spine = R(A.Spine, B.Spine); O.Head = R(A.Head, B.Head);
	O.ShoulderL = R(A.ShoulderL, B.ShoulderL); O.ShoulderR = R(A.ShoulderR, B.ShoulderR);
	O.ElbowL = FMath::Lerp(A.ElbowL, B.ElbowL, Alpha); O.ElbowR = FMath::Lerp(A.ElbowR, B.ElbowR, Alpha);
	O.HipL = R(A.HipL, B.HipL); O.HipR = R(A.HipR, B.HipR);
	O.KneeL = FMath::Lerp(A.KneeL, B.KneeL, Alpha); O.KneeR = FMath::Lerp(A.KneeR, B.KneeR, Alpha);
	return O;
}

void UBRProceduralBodyComponent::ApplyEmotePose(FName EmoteId, float T, FPose& P) const
{
	const FBRCosmeticDef* Def = UBRCosmeticCatalog::Find(EmoteId);
	const EBREmoteAnim Anim = Def ? Def->EmoteAnim : EBREmoteAnim::Wave;
	const float S = FMath::Sin(T * 6.f);
	switch (Anim)
	{
	case EBREmoteAnim::Wave: P.ShoulderR = FRotator(0, 0, 150); P.ElbowR = 30.f + 25.f * S; break;
	case EBREmoteAnim::Dance:
		P.Hips = FRotator(0, 20.f * S, 8.f * S); P.HipsZ = -6.f * FMath::Abs(S);
		P.ShoulderL = FRotator(60.f + 60.f * S, 0, -30); P.ShoulderR = FRotator(60.f - 60.f * S, 0, 30);
		P.ElbowL = P.ElbowR = 80.f; P.HipL = FRotator(25.f * FMath::Max(0.f, S), 0, 0); P.HipR = FRotator(25.f * FMath::Max(0.f, -S), 0, 0);
		P.KneeL = -50.f * FMath::Max(0.f, S); P.KneeR = -50.f * FMath::Max(0.f, -S);
		break;
	case EBREmoteAnim::Salute: P.ShoulderR = FRotator(100, 30, 60); P.ElbowR = 140.f; P.Spine = FRotator(-3, 0, 0); break;
	case EBREmoteAnim::Spin: P.Hips = FRotator(0, FMath::Fmod(T * 360.f, 360.f), 0); P.ShoulderL = FRotator(0, 0, -80); P.ShoulderR = FRotator(0, 0, 80); break;
	case EBREmoteAnim::Flex: P.ShoulderL = FRotator(0, 0, -85); P.ShoulderR = FRotator(0, 0, 85); P.ElbowL = P.ElbowR = 120.f + 10.f * S; P.HipsZ = -3.f; break;
	case EBREmoteAnim::Cheer: P.ShoulderL = FRotator(170, 0, -15); P.ShoulderR = FRotator(170, 0, 15); P.HipsZ = 8.f * FMath::Abs(S); P.ElbowL = P.ElbowR = 10.f; break;
	case EBREmoteAnim::Robot:
	{
		const float Step = FMath::Fmod(FMath::FloorToFloat(T * 2.f), 2.f);
		P.ShoulderL = FRotator(Step > 0 ? 90.f : 0.f, 0, 0); P.ShoulderR = FRotator(Step > 0 ? 0.f : 90.f, 0, 0);
		P.ElbowL = P.ElbowR = 90.f; P.Head = FRotator(0, Step > 0 ? 30.f : -30.f, 0);
		break;
	}
	case EBREmoteAnim::Clap: P.ShoulderL = FRotator(80, 25.f + 10.f * S, 0); P.ShoulderR = FRotator(80, -25.f - 10.f * S, 0); P.ElbowL = P.ElbowR = 40.f; break;
	}
}

void UBRProceduralBodyComponent::ComputePose(float DeltaTime, FPose& P)
{
	const ABRCharacter* C = Cast<ABRCharacter>(GetOwner());
	const float Now = GetWorld()->GetTimeSeconds();
	if (!C)
	{
		// Preview (lobby): idle breathing + optional emote.
		P.HipsZ = FMath::Sin(Now * 2.f) * 1.f;
		P.ShoulderL = FRotator(0, 0, -8); P.ShoulderR = FRotator(0, 0, 8);
		if (!PreviewEmote.IsNone()) { ApplyEmotePose(PreviewEmote, Now - PreviewEmoteStart, P); }
		return;
	}

	const UBRCharacterMovementComponent* Move = C->GetBRMovement();
	const float Speed = C->GetVelocity().Size2D();
	const float SpeedN = FMath::Clamp(Speed / 650.f, 0.f, 1.f);

	if (C->IsEliminated())
	{
		if (ElimTime < 0.f) { ElimTime = Now; }
		const float T = FMath::Clamp((Now - ElimTime) / 0.6f, 0.f, 1.f);
		P.Hips = FRotator(-90.f * T, 0, 0); P.HipsZ = -80.f * T;
		P.ShoulderL = FRotator(0, 0, -60.f * T); P.ShoulderR = FRotator(0, 0, 60.f * T);
		return;
	}
	ElimTime = -1.f;

	if (C->IsInVehicle())
	{
		P.HipsZ = -12.f; P.HipL = P.HipR = FRotator(90, 0, 0); P.KneeL = P.KneeR = -90.f;
		P.ShoulderL = P.ShoulderR = FRotator(60, 0, 0); P.ElbowL = P.ElbowR = 30.f;
		return;
	}
	if (Move->IsSkydiving())
	{
		const float Flutter = FMath::Sin(Now * 14.f) * 4.f;
		P.Hips = FRotator(-80, 0, 0); P.Head = FRotator(40, 0, 0);
		P.ShoulderL = FRotator(10, 0, -75.f + Flutter); P.ShoulderR = FRotator(10, 0, 75.f - Flutter);
		P.ElbowL = P.ElbowR = 35.f; P.HipL = FRotator(0, 0, -18); P.HipR = FRotator(0, 0, 18); P.KneeL = P.KneeR = -35.f;
		return;
	}
	if (Move->IsParachuting())
	{
		P.ShoulderL = FRotator(160, 0, -12); P.ShoulderR = FRotator(160, 0, 12); P.ElbowL = P.ElbowR = 15.f;
		P.HipL = FRotator(18, 0, 0); P.HipR = FRotator(8, 0, 0); P.KneeL = P.KneeR = -25.f;
		return;
	}
	if (Move->IsSwimming())
	{
		WalkPhase += DeltaTime * 4.f;
		P.Hips = FRotator(-70, 0, 0); P.Head = FRotator(45, 0, 0); P.HipsZ = 10.f;
		P.ShoulderL = FRotator(180.f * FMath::Frac(WalkPhase / (2 * PI)), 0, -20); P.ShoulderR = FRotator(180.f * FMath::Frac(WalkPhase / (2 * PI) + 0.5f), 0, 20);
		P.HipL = FRotator(15.f * FMath::Sin(WalkPhase * 2.f), 0, 0); P.HipR = FRotator(-15.f * FMath::Sin(WalkPhase * 2.f), 0, 0);
		return;
	}
	if (C->IsDowned())
	{
		WalkPhase += Speed * DeltaTime / 80.f;
		P.Hips = FRotator(-75, 0, 0); P.HipsZ = -62.f; P.Head = FRotator(50, 0, 0);
		P.ShoulderL = FRotator(110.f + 30.f * FMath::Sin(WalkPhase), 0, -10); P.ShoulderR = FRotator(110.f - 30.f * FMath::Sin(WalkPhase), 0, 10);
		P.HipL = FRotator(-10.f + 15.f * FMath::Sin(WalkPhase), 0, 0); P.HipR = FRotator(-10.f - 15.f * FMath::Sin(WalkPhase), 0, 0);
		P.KneeL = P.KneeR = -40.f;
		return;
	}

	// Locomotion: phase advances with distance travelled (stride 150 cm per cycle) => no foot sliding.
	const bool bGround = Move->IsMovingOnGround();
	if (bGround) { WalkPhase += Speed * DeltaTime / 150.f * 2.f * PI; }
	const float Sprint = Move->IsSprinting() ? 1.25f : 1.f;
	const float Amp = SpeedN * 34.f * Sprint;
	const float SinP = FMath::Sin(WalkPhase), CosP = FMath::Cos(WalkPhase);
	P.HipL = FRotator(SinP * Amp, 0, 0);
	P.HipR = FRotator(-SinP * Amp, 0, 0);
	P.KneeL = -FMath::Max(0.f, -CosP) * Amp * 1.4f - 4.f;
	P.KneeR = -FMath::Max(0.f, CosP) * Amp * 1.4f - 4.f;
	P.ShoulderL = FRotator(-SinP * Amp * 0.8f, 0, -6); P.ShoulderR = FRotator(SinP * Amp * 0.8f, 0, 6);
	P.ElbowL = P.ElbowR = 15.f + 25.f * SpeedN;
	P.HipsZ = -FMath::Abs(CosP) * 3.f * SpeedN;
	P.Spine = FRotator(-6.f * SpeedN * Sprint, 0, 0);
	P.Head = FRotator(6.f * SpeedN, 0, 0);

	if (!bGround)
	{
		P.HipL = FRotator(30, 0, 0); P.HipR = FRotator(-5, 0, 0); P.KneeL = -50.f; P.KneeR = -30.f;
		P.ShoulderL = FRotator(25, 0, -35); P.ShoulderR = FRotator(25, 0, 35);
	}
	if (Move->IsSliding())
	{
		P.HipsZ = -48.f; P.Hips = FRotator(28, 0, 0); P.HipL = P.HipR = FRotator(65, 0, 0); P.KneeL = -20.f; P.KneeR = -45.f;
	}
	else if (Move->IsCrouching())
	{
		P.HipsZ = -32.f; P.Spine = FRotator(-14, 0, 0);
		P.HipL.Pitch += 55.f; P.HipR.Pitch += 55.f; P.KneeL -= 85.f; P.KneeR -= 85.f;
	}

	// Upper body: weapon, pickaxe, building, emote.
	const float AimPitch = FRotator::NormalizeAxis(C->GetBaseAimRotation().Pitch);
	if (WeaponMount) { WeaponMount->SetRelativeRotation(FRotator(AimPitch, 0, 0)); }
	const ABRWeapon* W = C->GetCurrentWeapon();
	const bool bBuilding = C->GetBuild() && (C->GetBuild()->IsBuildMode() || C->GetBuild()->IsEditMode());
	if (PickaxeGroup) { PickaxeGroup->SetVisibility(!W && !bBuilding, true); }

	if (W)
	{
		const float AimArm = 85.f + AimPitch * 0.9f;
		P.ShoulderR = FRotator(AimArm, -10, 10); P.ElbowR = 35.f;
		P.ShoulderL = FRotator(AimArm - 5.f, 35, -5); P.ElbowL = 40.f;
		if (W->IsReloading())
		{
			P.ShoulderL = FRotator(40.f + 20.f * FMath::Sin(Now * 10.f), 20, -10); P.ElbowL = 95.f;
		}
		P.Spine.Pitch -= AimPitch * 0.25f;
	}
	else if (bBuilding)
	{
		P.ShoulderR = FRotator(70.f + 20.f * FMath::Sin(Now * 8.f), 0, 10); P.ElbowR = 60.f;
	}
	if (C->IsHarvesting())
	{
		const float T = FMath::Clamp((Now - C->GetLastHarvestSwingTime()) / 0.45f, 0.f, 1.f);
		const float Ease = T < 0.35f ? T / 0.35f : 1.f - (T - 0.35f) / 0.65f * 0.2f;
		P.ShoulderR = FRotator(FMath::Lerp(170.f, 35.f, Ease), 0, 10); P.ElbowR = 15.f;
		P.Spine.Pitch -= 10.f * Ease;
	}
	if (!C->GetActiveEmote().IsNone())
	{
		ApplyEmotePose(C->GetActiveEmote(), Now - C->GetEmoteStartTime(), P);
	}
}

void UBRProceduralBodyComponent::ApplyPose(const FPose& P)
{
	if (!Hips) { return; }
	Hips->SetRelativeLocationAndRotation(FVector(0, 0, 95.f + P.HipsZ), P.Hips);
	Spine->SetRelativeRotation(P.Spine);
	HeadPivot->SetRelativeRotation(P.Head);
	ShoulderL->SetRelativeRotation(P.ShoulderL);
	ShoulderR->SetRelativeRotation(P.ShoulderR);
	ElbowL->SetRelativeRotation(FRotator(P.ElbowL, 0, 0));
	ElbowR->SetRelativeRotation(FRotator(P.ElbowR, 0, 0));
	HipL->SetRelativeRotation(P.HipL);
	HipR->SetRelativeRotation(P.HipR);
	KneeL->SetRelativeRotation(FRotator(P.KneeL, 0, 0));
	KneeR->SetRelativeRotation(FRotator(P.KneeR, 0, 0));
}

void UBRProceduralBodyComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	if (bUseSkeletal || !bBuilt) { return; }

	AActor* Owner = GetOwner();
	// Animation LOD: off-screen bodies don't animate; distant ones animate at 10 Hz.
	if (Owner && !Owner->WasRecentlyRendered(0.25f)) { return; }
	if (const APlayerController* PC = GetWorld()->GetFirstPlayerController())
	{
		if (PC->PlayerCameraManager && Owner)
		{
			const float Dist = FVector::Dist(PC->PlayerCameraManager->GetCameraLocation(), Owner->GetActorLocation());
			SetComponentTickInterval(Dist > 5000.f ? 0.1f : 0.f);
		}
	}

	FPose Target;
	ComputePose(DeltaTime, Target);
	Current = Blend(Current, Target, FMath::Clamp(DeltaTime * 14.f, 0.f, 1.f));
	ApplyPose(Current);

	if (const ABRCharacter* C = Cast<ABRCharacter>(Owner))
	{
		const bool bGlide = C->GetBRMovement()->IsParachuting();
		if (GliderGroup && GliderGroup->IsVisible() != bGlide) { GliderGroup->SetVisibility(bGlide, true); }
	}

	// Facial animation: blinking.
	BlinkTimer -= DeltaTime;
	const bool bClosed = BlinkTimer < 0.f;
	if (BlinkTimer < -0.12f) { BlinkTimer = FMath::FRandRange(2.5f, 5.f); }
	for (UStaticMeshComponent* Eye : Eyes)
	{
		if (Eye) { Eye->SetRelativeScale3D(FVector(0.04f, 0.04f, bClosed ? 0.008f : 0.05f)); }
	}
}
