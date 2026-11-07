#pragma once

#include "CoreMinimal.h"

class UStaticMesh;
class UMaterialInterface;
class UMaterialInstanceDynamic;
class UStaticMeshComponent;
class UInstancedStaticMeshComponent;
class USceneComponent;
class AActor;

// Runtime visuals built from engine basic shapes so every system renders without
// authored art. Authored meshes/materials can replace any of these via UBRSettings.
namespace BRVisuals
{
	ULTIMATEBATTLEROYALE_API UStaticMesh* Cube();
	ULTIMATEBATTLEROYALE_API UStaticMesh* Sphere();
	ULTIMATEBATTLEROYALE_API UStaticMesh* Cylinder();
	ULTIMATEBATTLEROYALE_API UStaticMesh* Cone();
	ULTIMATEBATTLEROYALE_API UStaticMesh* Plane();
	ULTIMATEBATTLEROYALE_API UMaterialInterface* BaseMaterial();

	// Shared (cached) colour material: identical colours share one MID so the renderer can batch.
	ULTIMATEBATTLEROYALE_API UMaterialInterface* ColorMaterial(const FLinearColor& Color);

	// Unique MID (for flashing / tinting a single actor).
	ULTIMATEBATTLEROYALE_API UMaterialInstanceDynamic* UniqueColorMaterial(UObject* Outer, const FLinearColor& Color);

	// Adds a static mesh part. Size is in centimetres (basic shapes are 100 cm).
	ULTIMATEBATTLEROYALE_API UStaticMeshComponent* AddPart(AActor* Owner, USceneComponent* Parent, UStaticMesh* Mesh,
		const FVector& RelativeLocation, const FVector& SizeCm, const FRotator& Rotation, const FLinearColor& Color,
		bool bCollision, float MaxDrawDistance = 0.f);

	ULTIMATEBATTLEROYALE_API FTransform PartTransform(const FVector& Location, const FVector& SizeCm, const FRotator& Rotation = FRotator::ZeroRotator);

	ULTIMATEBATTLEROYALE_API FLinearColor HexColor(uint32 RGB);
}
