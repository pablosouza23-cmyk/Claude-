#include "Core/BRVisuals.h"

#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "GameFramework/Actor.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/Package.h"
#include "Engine/CollisionProfile.h"

namespace
{
	template <typename T>
	T* LoadCached(TWeakObjectPtr<T>& Cache, const TCHAR* Path)
	{
		if (!Cache.IsValid())
		{
			Cache = LoadObject<T>(nullptr, Path);
		}
		return Cache.Get();
	}

	TMap<uint32, TWeakObjectPtr<UMaterialInstanceDynamic>>& ColorCache()
	{
		static TMap<uint32, TWeakObjectPtr<UMaterialInstanceDynamic>> Cache;
		return Cache;
	}
}

namespace BRVisuals
{
	UStaticMesh* Cube() { static TWeakObjectPtr<UStaticMesh> C; return LoadCached(C, TEXT("/Engine/BasicShapes/Cube.Cube")); }
	UStaticMesh* Sphere() { static TWeakObjectPtr<UStaticMesh> C; return LoadCached(C, TEXT("/Engine/BasicShapes/Sphere.Sphere")); }
	UStaticMesh* Cylinder() { static TWeakObjectPtr<UStaticMesh> C; return LoadCached(C, TEXT("/Engine/BasicShapes/Cylinder.Cylinder")); }
	UStaticMesh* Cone() { static TWeakObjectPtr<UStaticMesh> C; return LoadCached(C, TEXT("/Engine/BasicShapes/Cone.Cone")); }
	UStaticMesh* Plane() { static TWeakObjectPtr<UStaticMesh> C; return LoadCached(C, TEXT("/Engine/BasicShapes/Plane.Plane")); }

	UMaterialInterface* BaseMaterial()
	{
		static TWeakObjectPtr<UMaterialInterface> C;
		return LoadCached(C, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	}

	UMaterialInterface* ColorMaterial(const FLinearColor& Color)
	{
		const FColor Q = Color.ToFColor(false);
		const uint32 Key = Q.DWColor();
		if (TWeakObjectPtr<UMaterialInstanceDynamic>* Found = ColorCache().Find(Key))
		{
			if (Found->IsValid()) { return Found->Get(); }
		}
		UMaterialInterface* Base = BaseMaterial();
		if (!Base) { return nullptr; }
		UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(Base, GetTransientPackage());
		MID->SetVectorParameterValue(TEXT("Color"), Color);
		MID->AddToRoot(); // shared for the whole session
		ColorCache().Add(Key, MID);
		return MID;
	}

	UMaterialInstanceDynamic* UniqueColorMaterial(UObject* Outer, const FLinearColor& Color)
	{
		UMaterialInterface* Base = BaseMaterial();
		if (!Base) { return nullptr; }
		UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(Base, Outer);
		MID->SetVectorParameterValue(TEXT("Color"), Color);
		return MID;
	}

	FTransform PartTransform(const FVector& Location, const FVector& SizeCm, const FRotator& Rotation)
	{
		return FTransform(Rotation, Location, SizeCm / 100.f);
	}

	UStaticMeshComponent* AddPart(AActor* Owner, USceneComponent* Parent, UStaticMesh* Mesh, const FVector& RelativeLocation,
		const FVector& SizeCm, const FRotator& Rotation, const FLinearColor& Color, bool bCollision, float MaxDrawDistance)
	{
		if (!Owner || !Mesh) { return nullptr; }
		UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(Owner);
		C->SetStaticMesh(Mesh);
		C->SetMaterial(0, ColorMaterial(Color));
		C->SetCollisionEnabled(bCollision ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
		C->SetCollisionProfileName(bCollision ? UCollisionProfile::BlockAll_ProfileName : UCollisionProfile::NoCollision_ProfileName);
		C->SetGenerateOverlapEvents(false);
		C->SetCanEverAffectNavigation(bCollision);
		C->bCastDynamicShadow = SizeCm.GetMax() > 30.f;
		if (MaxDrawDistance > 0.f) { C->SetCachedMaxDrawDistance(MaxDrawDistance); }
		if (Parent) { C->SetupAttachment(Parent); }
		C->SetRelativeTransform(PartTransform(RelativeLocation, SizeCm, Rotation));
		C->RegisterComponent();
		Owner->AddInstanceComponent(C);
		return C;
	}

	FLinearColor HexColor(uint32 RGB)
	{
		return FLinearColor(FColor(uint8(RGB >> 16), uint8(RGB >> 8), uint8(RGB)));
	}
}
