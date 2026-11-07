#pragma once

#include "CoreMinimal.h"
#include "Components/SceneComponent.h"
#include "Core/BRTypes.h"
#include "BRProceduralBodyComponent.generated.h"

class UStaticMeshComponent;
class ABRCharacter;

// Stylised, fully original "toy figure" body assembled from primitive shapes and animated
// procedurally (walk cycle driven by distance travelled => feet never slide). Used whenever
// no authored skeletal mesh is configured, and as the low-cost LOD for distant players.
UCLASS(ClassGroup = (BR))
class ULTIMATEBATTLEROYALE_API UBRProceduralBodyComponent : public USceneComponent
{
	GENERATED_BODY()

public:
	UBRProceduralBodyComponent();

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	void ApplyLoadout(const FBRCosmeticLoadout& Loadout);
	void SetUseSkeletalMesh(bool bUse);
	void SetHeldWeapon(AActor* Weapon);
	// Lobby/preview: forces an emote pose without a character owner state.
	void SetPreviewEmote(FName EmoteId) { PreviewEmote = EmoteId; PreviewEmoteStart = 0.f; }

private:
	struct FPose
	{
		float HipsZ = 0.f; FRotator Hips = FRotator::ZeroRotator; FRotator Spine = FRotator::ZeroRotator; FRotator Head = FRotator::ZeroRotator;
		FRotator ShoulderL = FRotator::ZeroRotator, ShoulderR = FRotator::ZeroRotator;
		float ElbowL = 10.f, ElbowR = 10.f;
		FRotator HipL = FRotator::ZeroRotator, HipR = FRotator::ZeroRotator;
		float KneeL = 0.f, KneeR = 0.f;
	};

	void Rebuild();
	void ClearParts();
	USceneComponent* MakePivot(USceneComponent* Parent, const FVector& Loc);
	UStaticMeshComponent* Part(USceneComponent* Parent, class UStaticMesh* Mesh, const FVector& Loc, const FVector& Size, const FLinearColor& Color, const FRotator& Rot = FRotator::ZeroRotator);
	void ComputePose(float DeltaTime, FPose& Out);
	void ApplyEmotePose(FName EmoteId, float T, FPose& P) const;
	void ApplyPose(const FPose& P);
	static FPose Blend(const FPose& A, const FPose& B, float Alpha);

	FBRCosmeticLoadout Loadout;
	bool bUseSkeletal = false;
	bool bBuilt = false;

	UPROPERTY(Transient) TArray<TObjectPtr<USceneComponent>> Created;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> Hips;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> Spine;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> HeadPivot;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> ShoulderL;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> ShoulderR;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> ElbowL;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> ElbowR;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> HandR;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> HipL;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> HipR;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> KneeL;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> KneeR;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> WeaponMount;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> PickaxeGroup;
	UPROPERTY(Transient) TObjectPtr<USceneComponent> GliderGroup;
	UPROPERTY(Transient) TArray<TObjectPtr<UStaticMeshComponent>> Eyes;

	TWeakObjectPtr<AActor> HeldWeapon;
	FPose Current;
	float WalkPhase = 0.f;
	int32 LastStepIndex = 0;
	float BlinkTimer = 3.f;
	float ElimTime = -1.f;
	FName PreviewEmote;
	float PreviewEmoteStart = 0.f;
};
