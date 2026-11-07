#include "Vehicles/BRVehicle.h"

#include "Audio/BRProceduralAudio.h"
#include "Characters/BRCharacter.h"
#include "Components/AudioComponent.h"
#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Core/BRVisuals.h"
#include "Kismet/GameplayStatics.h"
#include "Net/UnrealNetwork.h"
#include "Weapons/BRDamageTypes.h"
#include "Weapons/BRProjectile.h"
#include "World/BRWorldSubsystem.h"

#define LOCTEXT_NAMESPACE "BRVehicle"

FBRVehicleConfig FBRVehicleConfig::For(EBRVehicleSpawnType Type)
{
	FBRVehicleConfig C;
	auto FourWheels = [&C](float X, float Y, float Z, bool bAllDrive)
	{
		C.Wheels = { FVector(X, -Y, Z), FVector(X, Y, Z), FVector(-X, -Y, Z), FVector(-X, Y, Z) };
		C.SteeredWheel = { true, true, false, false };
		C.DrivenWheel = { bAllDrive, bAllDrive, true, true };
	};
	switch (Type)
	{
	case EBRVehicleSpawnType::Pickup:
		C.Name = LOCTEXT("Pickup", "Caminhonete"); C.Mass = 2000.f; C.HalfExtent = FVector(260, 105, 65);
		FourWheels(170.f, 95.f, -45.f, true); C.WheelRadius = 45.f; C.EngineAccel = 800.f; C.TopSpeed = 2600.f; C.Grip = 4.5f;
		C.MaxHealth = 1200.f; C.FuelCapacity = 80.f; C.Seats = { FVector(20, -45, 30), FVector(20, 45, 30), FVector(-150, -45, 60), FVector(-150, 45, 60) };
		C.Color = FLinearColor(0.2f, 0.35f, 0.6f);
		break;
	case EBRVehicleSpawnType::Motorcycle:
		C.Name = LOCTEXT("Moto", "Motocicleta"); C.Mass = 250.f; C.HalfExtent = FVector(110, 30, 45);
		C.Wheels = { FVector(85, 0, -25), FVector(-85, 0, -25) }; C.SteeredWheel = { true, false }; C.DrivenWheel = { false, true };
		C.WheelRadius = 35.f; C.EngineAccel = 1300.f; C.TopSpeed = 3600.f; C.Grip = 6.f; C.MaxSteerDeg = 28.f; C.bBike = true;
		C.MaxHealth = 450.f; C.FuelCapacity = 25.f; C.Seats = { FVector(-10, 0, 40), FVector(-55, 0, 50) };
		C.Color = FLinearColor(0.1f, 0.1f, 0.12f);
		break;
	case EBRVehicleSpawnType::Utility:
		C.Name = LOCTEXT("Utility", "Utilitário"); C.Mass = 2600.f; C.HalfExtent = FVector(280, 110, 110);
		FourWheels(180.f, 100.f, -95.f, true); C.WheelRadius = 48.f; C.EngineAccel = 650.f; C.TopSpeed = 2300.f; C.Grip = 4.f;
		C.MaxHealth = 1600.f; C.FuelCapacity = 100.f; C.Seats = { FVector(150, -50, 0), FVector(150, 50, 0), FVector(-50, -50, 0), FVector(-50, 50, 0) };
		C.Color = FLinearColor(0.85f, 0.85f, 0.8f);
		break;
	case EBRVehicleSpawnType::Boat:
		C.Name = LOCTEXT("Boat", "Barco"); C.Mass = 900.f; C.HalfExtent = FVector(260, 100, 45); C.bBoat = true;
		C.EngineAccel = 900.f; C.TopSpeed = 2700.f; C.Grip = 1.6f; C.MaxSteerDeg = 40.f;
		C.MaxHealth = 900.f; C.FuelCapacity = 70.f; C.Seats = { FVector(-80, 0, 30), FVector(50, -40, 30), FVector(50, 40, 30), FVector(140, 0, 30) };
		C.Color = FLinearColor(0.95f, 0.95f, 0.95f);
		break;
	default:
		C.Name = LOCTEXT("Sports", "Carro Esportivo"); C.Mass = 1300.f; C.HalfExtent = FVector(220, 95, 45);
		FourWheels(145.f, 85.f, -35.f, false); C.WheelRadius = 36.f; C.EngineAccel = 1150.f; C.TopSpeed = 3700.f; C.Grip = 5.5f;
		C.MaxHealth = 800.f; C.FuelCapacity = 60.f; C.Seats = { FVector(-10, -40, 20), FVector(-10, 40, 20) };
		C.Color = FLinearColor(0.85f, 0.15f, 0.1f);
		break;
	}
	return C;
}

ABRVehicle::ABRVehicle()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_PrePhysics;
	bReplicates = true;
	SetReplicatingMovement(true);
	NetUpdateFrequency = 30.f;
	NetCullDistanceSquared = FMath::Square(40000.f);

	Body = CreateDefaultSubobject<UBoxComponent>(TEXT("Body"));
	Body->SetCollisionProfileName(TEXT("Vehicle"));
	Body->SetSimulatePhysics(true);
	Body->SetLinearDamping(0.05f);
	Body->SetAngularDamping(1.5f);
	Body->SetNotifyRigidBodyCollision(true);
	RootComponent = Body;
}

void ABRVehicle::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ABRVehicle, Type);
	DOREPLIFETIME(ABRVehicle, Seats);
	DOREPLIFETIME(ABRVehicle, Fuel);
	DOREPLIFETIME(ABRVehicle, Health);
	DOREPLIFETIME(ABRVehicle, ReplicatedSteer);
	DOREPLIFETIME(ABRVehicle, bWrecked);
}

void ABRVehicle::InitVehicle(EBRVehicleSpawnType InType)
{
	Type = InType;
	Config = FBRVehicleConfig::For(Type);
	Fuel = Config.FuelCapacity * FMath::FRandRange(0.4f, 1.f);
	Health = Config.MaxHealth;
}

void ABRVehicle::BeginPlay()
{
	Super::BeginPlay();
	Config = FBRVehicleConfig::For(Type);
	Body->SetBoxExtent(Config.HalfExtent);
	Body->SetMassOverrideInKg(NAME_None, Config.Mass, true);
	Body->BodyInstance.COMNudge = FVector(0.f, 0.f, -Config.HalfExtent.Z * 0.8f);
	Body->BodyInstance.UpdateMassProperties();
	Body->OnComponentHit.AddDynamic(this, &ABRVehicle::OnBodyHit);
	if (Seats.Num() != Config.Seats.Num()) { Seats.SetNum(Config.Seats.Num()); }
	PrevCompression.Init(0.f, Config.Wheels.Num());
	BuildVisual();
	EngineAudio = UBRProceduralAudio::CreateLoop(this, EBRSfx::EngineLoop);
	if (EngineAudio) { EngineAudio->SetVolumeMultiplier(0.001f); }
}

void ABRVehicle::OnRep_Type()
{
	Config = FBRVehicleConfig::For(Type);
	Body->SetBoxExtent(Config.HalfExtent);
	BuildVisual();
}

void ABRVehicle::BuildVisual()
{
	for (USceneComponent* C : SeatComps) { if (C) { C->DestroyComponent(); } }
	for (USceneComponent* C : WheelVisuals) { if (C) { C->DestroyComponent(); } }
	for (UStaticMeshComponent* C : PaintParts) { if (C) { C->DestroyComponent(); } }
	SeatComps.Reset(); WheelVisuals.Reset(); PaintParts.Reset();

	for (const FVector& S : Config.Seats)
	{
		USceneComponent* Seat = NewObject<USceneComponent>(this);
		Seat->SetupAttachment(Body);
		Seat->SetRelativeLocation(S + FVector(0, 0, 50.f));
		Seat->RegisterComponent();
		SeatComps.Add(Seat);
	}
	if (GetNetMode() == NM_DedicatedServer) { return; }

	const FLinearColor Paint = bWrecked ? FLinearColor(0.08f, 0.07f, 0.07f) : Config.Color;
	const FLinearColor Dark(0.06f, 0.06f, 0.07f), Glass(0.55f, 0.75f, 0.9f);
	const FVector E = Config.HalfExtent;
	auto P = [this](UStaticMesh* M, FVector L, FVector S, FLinearColor C, FRotator R = FRotator::ZeroRotator)
	{
		if (UStaticMeshComponent* Part = BRVisuals::AddPart(this, Body, M, L, S, R, C, false, 30000.f)) { PaintParts.Add(Part); }
	};
	switch (Type)
	{
	case EBRVehicleSpawnType::Boat:
		P(BRVisuals::Cube(), FVector(-30, 0, 0), FVector(E.X * 1.6f, E.Y * 2.f, E.Z * 2.f), Paint);
		P(BRVisuals::Cone(), FVector(E.X * 0.85f, 0, 0), FVector(E.Y * 2.f, E.Z * 2.f, 120.f), Paint, FRotator(-90, 0, 0));
		P(BRVisuals::Cube(), FVector(-30, 0, E.Z), FVector(E.X * 1.5f, E.Y * 1.8f, 8.f), FLinearColor(0.55f, 0.4f, 0.25f));
		P(BRVisuals::Cube(), FVector(40, 0, E.Z + 50.f), FVector(40, 140, 80), Glass, FRotator(-20, 0, 0));
		P(BRVisuals::Cube(), FVector(-E.X, 0, 10), FVector(40, 50, 90), Dark);
		break;
	case EBRVehicleSpawnType::Motorcycle:
		P(BRVisuals::Cube(), FVector(0, 0, 10), FVector(170, 30, 40), Paint);
		P(BRVisuals::Cube(), FVector(-40, 0, 40), FVector(80, 26, 15), Dark);
		P(BRVisuals::Cylinder(), FVector(85, 0, 45), FVector(6, 70, 6), Dark, FRotator(0, 0, 90));
		break;
	default:
	{
		const float CabinLen = Type == EBRVehicleSpawnType::Pickup ? E.X * 0.9f : (Type == EBRVehicleSpawnType::Utility ? E.X * 1.9f : E.X * 1.1f);
		const float CabinX = Type == EBRVehicleSpawnType::Pickup ? E.X * 0.3f : (Type == EBRVehicleSpawnType::Utility ? 0.f : -E.X * 0.1f);
		const float CabinH = Type == EBRVehicleSpawnType::Utility ? E.Z * 1.4f : E.Z * 1.3f;
		P(BRVisuals::Cube(), FVector(0, 0, -E.Z * 0.2f), FVector(E.X * 2.f, E.Y * 2.f, E.Z * 1.2f), Paint);
		P(BRVisuals::Cube(), FVector(CabinX, 0, E.Z * 0.4f + CabinH * 0.5f), FVector(CabinLen, E.Y * 1.85f, CabinH), Paint);
		P(BRVisuals::Cube(), FVector(CabinX + CabinLen * 0.5f, 0, E.Z * 0.4f + CabinH * 0.5f), FVector(6, E.Y * 1.7f, CabinH * 0.8f), Glass, FRotator(-25, 0, 0));
		P(BRVisuals::Cube(), FVector(E.X, 0, -E.Z * 0.3f), FVector(8, E.Y * 1.9f, 25), Dark);
		for (int32 S : { -1, 1 }) { P(BRVisuals::Cube(), FVector(E.X + 2.f, S * E.Y * 0.7f, -E.Z * 0.05f), FVector(4, 30, 14), FLinearColor(1.f, 0.95f, 0.7f)); }
		if (Type == EBRVehicleSpawnType::Pickup) { P(BRVisuals::Cube(), FVector(-E.X * 0.55f, 0, E.Z * 0.45f), FVector(E.X * 0.85f, E.Y * 1.9f, 12), Dark); }
		break;
	}
	}
	for (int32 I = 0; I < Config.Wheels.Num(); ++I)
	{
		USceneComponent* Pivot = NewObject<USceneComponent>(this);
		Pivot->SetupAttachment(Body);
		Pivot->SetRelativeLocation(Config.Wheels[I] - FVector(0, 0, Config.SuspensionLength * 0.5f));
		Pivot->RegisterComponent();
		BRVisuals::AddPart(this, Pivot, BRVisuals::Cylinder(), FVector::ZeroVector, FVector(Config.WheelRadius * 2.f, Config.WheelRadius * 2.f, Config.bBike ? 14.f : 28.f), FRotator(0, 0, 90), Dark, false, 20000.f);
		BRVisuals::AddPart(this, Pivot, BRVisuals::Cube(), FVector::ZeroVector, FVector(Config.WheelRadius * 0.9f, Config.bBike ? 16.f : 30.f, 10.f), FRotator::ZeroRotator, FLinearColor(0.6f, 0.6f, 0.62f), false, 8000.f);
		WheelVisuals.Add(Pivot);
	}
}

// ------------------------------------------------------------------------------------------- interaction
int32 ABRVehicle::FindFreeSeat(bool bPreferDriver) const
{
	for (int32 I = 0; I < Seats.Num(); ++I) { if (!Seats[I]) { return I; } }
	return INDEX_NONE;
}

bool ABRVehicle::CanInteract(const ABRCharacter* By) const
{
	return !bWrecked && By && By->IsAliveAndWell() && !By->IsInVehicle() && FindFreeSeat(true) != INDEX_NONE;
}

FText ABRVehicle::GetInteractPrompt(const ABRCharacter* By) const
{
	return FindFreeSeat(true) == 0 ? FText::Format(LOCTEXT("Drive", "Dirigir {0}"), Config.Name) : FText::Format(LOCTEXT("Ride", "Entrar ({0})"), Config.Name);
}

void ABRVehicle::ExecuteInteract(ABRCharacter* By)
{
	const int32 Seat = FindFreeSeat(true);
	if (!HasAuthority() || !CanInteract(By) || Seat == INDEX_NONE) { return; }
	Seats[Seat] = By;
	By->EnterVehicle(this, Seat);
	UBRProceduralAudio::PlaySfx(this, EBRSfx::Door, GetActorLocation());
}

USceneComponent* ABRVehicle::GetSeatComponent(int32 Seat) const
{
	return SeatComps.IsValidIndex(Seat) ? SeatComps[Seat].Get() : nullptr;
}

FVector ABRVehicle::GetExitLocation(int32 Seat) const
{
	const float Side = (Config.Seats.IsValidIndex(Seat) && Config.Seats[Seat].Y > 0.f) ? 1.f : -1.f;
	const FVector Candidate = GetActorLocation() + GetActorRightVector() * Side * (Config.HalfExtent.Y + 120.f) + FVector(0, 0, 120.f);
	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(BRVehicleExit), false, this);
	if (!GetWorld()->SweepSingleByChannel(Hit, Candidate, Candidate, FQuat::Identity, ECC_Pawn, FCollisionShape::MakeCapsule(40.f, 90.f), Params))
	{
		return Candidate;
	}
	return GetActorLocation() + FVector(0, 0, Config.HalfExtent.Z + 200.f);
}

void ABRVehicle::OnOccupantExited(ABRCharacter* Character)
{
	for (int32 I = 0; I < Seats.Num(); ++I)
	{
		if (Seats[I] == Character)
		{
			Seats[I] = nullptr;
			if (I == 0) { Throttle = Steer = 0.f; bHandbrake = true; }
		}
	}
}

AController* ABRVehicle::GetDriverController() const
{
	return (Seats.Num() > 0 && Seats[0]) ? Seats[0]->GetController() : nullptr;
}

void ABRVehicle::SetDriverInput(float InThrottle, float InSteer, bool bInHandbrake)
{
	Throttle = InThrottle;
	Steer = InSteer;
	bHandbrake = bInHandbrake;
	ReplicatedSteer = InSteer;
	LastInputTime = GetWorld()->GetTimeSeconds();
}

void ABRVehicle::Refuel(float Fraction)
{
	if (HasAuthority()) { Fuel = FMath::Min(Config.FuelCapacity, Fuel + Config.FuelCapacity * Fraction); }
}

float ABRVehicle::GetSpeedKmh() const
{
	return float(BRRules::SpeedKmh(GetVelocity().Size()));
}

// ------------------------------------------------------------------------------------------- simulation
void ABRVehicle::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	const float Dt = FMath::Min(DeltaSeconds, 1.f / 20.f);

	if (HasAuthority() && !bWrecked)
	{
		// Driver input times out (disconnect / packet loss) => coast to a stop.
		if (GetWorld()->GetTimeSeconds() - LastInputTime > 0.5f || !Seats.IsValidIndex(0) || !Seats[0]) { Throttle = 0.f; Steer = 0.f; }
		if (Fuel <= 0.f) { Throttle = 0.f; }
		Fuel = float(BRRules::ConsumeFuel(Fuel, Throttle, Dt));
		if (Config.bBoat) { SimulateBoat(Dt); } else { SimulateCar(Dt); }
		LastVelocity = GetVelocity();
	}

	if (GetNetMode() != NM_DedicatedServer)
	{
		const float Speed = FVector::DotProduct(GetVelocity(), GetActorForwardVector());
		WheelSpin += Speed * Dt / FMath::Max(1.f, Config.WheelRadius) * 57.3f;
		const float SteerVis = (Seats.IsValidIndex(0) && Seats[0] && Seats[0]->IsLocallyControlled()) ? VisualSteer : ReplicatedSteer;
		for (int32 I = 0; I < WheelVisuals.Num(); ++I)
		{
			const bool bSteer = Config.SteeredWheel.IsValidIndex(I) && Config.SteeredWheel[I];
			WheelVisuals[I]->SetRelativeRotation(FRotator(-WheelSpin, bSteer ? SteerVis * Config.MaxSteerDeg : 0.f, 0.f));
		}
		if (EngineAudio)
		{
			const bool bOccupied = Seats.IsValidIndex(0) && Seats[0] != nullptr;
			const float Ratio = FMath::Clamp(FMath::Abs(Speed) / Config.TopSpeed, 0.f, 1.f);
			EngineAudio->SetVolumeMultiplier(bOccupied && !bWrecked ? 0.35f + 0.4f * Ratio : 0.001f);
			EngineAudio->SetPitchMultiplier(0.6f + 1.2f * Ratio);
		}
	}
}

void ABRVehicle::SimulateCar(float Dt)
{
	const FTransform T = GetActorTransform();
	const FVector Up = T.GetUnitAxis(EAxis::Z);
	const int32 N = Config.Wheels.Num();
	const float MassPerWheel = Config.Mass / FMath::Max(1, N);
	const float Forward = FVector::DotProduct(GetVelocity(), T.GetUnitAxis(EAxis::X));
	int32 Grounded = 0, Driven = 0;
	for (int32 I = 0; I < N; ++I) { if (Config.DrivenWheel[I]) { ++Driven; } }

	FCollisionQueryParams Params(SCENE_QUERY_STAT(BRWheel), false, this);
	for (ABRCharacter* Occ : Seats) { if (Occ) { Params.AddIgnoredActor(Occ); } }

	for (int32 I = 0; I < N; ++I)
	{
		const FVector Attach = T.TransformPosition(Config.Wheels[I]);
		const FVector End = Attach - Up * (Config.SuspensionLength + Config.WheelRadius);
		FHitResult Hit;
		if (!GetWorld()->LineTraceSingleByChannel(Hit, Attach, End, ECC_Visibility, Params))
		{
			PrevCompression[I] = 0.f;
			continue;
		}
		++Grounded;
		const float Compression = FMath::Clamp(1.f - (Hit.Distance - Config.WheelRadius) / Config.SuspensionLength, 0.f, 1.f);
		const float CompVel = (Compression - PrevCompression[I]) / Dt;
		PrevCompression[I] = Compression;
		const float Spring = float(BRRules::SuspensionForce(Compression, CompVel, Config.SpringAccel, Config.DampingAccel)) * MassPerWheel;
		Body->AddForceAtLocation(Up * Spring, Attach);

		// Tyre: steering rotates the wheel's frame; lateral grip cancels sideways slip.
		const bool bSteered = Config.SteeredWheel[I];
		const FRotator SteerRot(0.f, bSteered ? Steer * Config.MaxSteerDeg * FMath::Lerp(1.f, 0.45f, FMath::Clamp(FMath::Abs(Forward) / Config.TopSpeed, 0.f, 1.f)) : 0.f, 0.f);
		const FVector WheelFwd = T.TransformVectorNoScale(SteerRot.RotateVector(FVector::ForwardVector));
		const FVector WheelRight = T.TransformVectorNoScale(SteerRot.RotateVector(FVector::RightVector));
		const FVector PointVel = Body->GetPhysicsLinearVelocityAtPoint(Hit.ImpactPoint);
		const float Lateral = FVector::DotProduct(PointVel, WheelRight);
		const float GripScale = (bHandbrake && !bSteered) ? 0.25f : 1.f;
		Body->AddForceAtLocation(-WheelRight * Lateral * Config.Grip * GripScale * MassPerWheel, Hit.ImpactPoint);

		if (Config.DrivenWheel[I] && Driven > 0)
		{
			const float Accel = float(BRRules::EngineForce(Throttle, Forward, Config.EngineAccel, Config.TopSpeed));
			Body->AddForceAtLocation(WheelFwd * Accel * Config.Mass / Driven, Hit.ImpactPoint + Up * Config.WheelRadius * 0.5f);
		}
		if (bHandbrake || FMath::IsNearlyZero(Throttle))
		{
			// Rolling resistance + handbrake.
			const float Long = FVector::DotProduct(PointVel, WheelFwd);
			Body->AddForceAtLocation(-WheelFwd * Long * (bHandbrake ? 1.5f : 0.25f) * MassPerWheel, Hit.ImpactPoint);
		}
	}

	// Stability: keep upright when airborne/flipped; bikes lean into turns.
	const FVector Desired = Config.bBike ? (FVector::UpVector + T.GetUnitAxis(EAxis::Y) * Steer * 0.25f).GetSafeNormal() : FVector::UpVector;
	const FVector Correction = FVector::CrossProduct(Up, Desired);
	const float Strength = Config.bBike ? 60.f : (Grounded == 0 || Up.Z < 0.5f ? 25.f : 0.f);
	if (Strength > 0.f)
	{
		Body->AddTorqueInRadians(Correction * Strength * Config.Mass * 100.f - Body->GetPhysicsAngularVelocityInRadians() * Config.Mass * 30.f * (Config.bBike ? 1.f : 0.f));
	}
	// Air drag.
	Body->AddForce(-GetVelocity() * GetVelocity().Size() * 0.00003f * Config.Mass);
}

void ABRVehicle::SimulateBoat(float Dt)
{
	const UBRWorldSubsystem* WS = GetWorld()->GetSubsystem<UBRWorldSubsystem>();
	const FTransform T = GetActorTransform();
	const FVector E = Config.HalfExtent;
	const FVector Points[4] = { FVector(E.X, -E.Y, -E.Z), FVector(E.X, E.Y, -E.Z), FVector(-E.X, -E.Y, -E.Z), FVector(-E.X, E.Y, -E.Z) };
	int32 InWater = 0;
	for (const FVector& LP : Points)
	{
		const FVector P = T.TransformPosition(LP);
		float WaterZ = 0.f;
		if (!WS || !WS->GetWaterSurfaceZ(P, WaterZ)) { continue; }
		const float Depth = WaterZ - P.Z;
		if (Depth <= 0.f) { continue; }
		++InWater;
		const FVector V = Body->GetPhysicsLinearVelocityAtPoint(P);
		const float Lift = (980.f * 1.4f + FMath::Min(Depth, 100.f) * 25.f) * Config.Mass * 0.25f - V.Z * Config.Mass * 0.25f * 2.f;
		Body->AddForceAtLocation(FVector(0, 0, FMath::Max(0.f, Lift)), P);
	}
	if (InWater == 0) { return; }
	const FVector Fwd = T.GetUnitAxis(EAxis::X), Right = T.GetUnitAxis(EAxis::Y);
	const float Forward = FVector::DotProduct(GetVelocity(), Fwd);
	const float Accel = float(BRRules::EngineForce(Throttle, Forward, Config.EngineAccel, Config.TopSpeed));
	Body->AddForce(Fwd * Accel * Config.Mass);
	Body->AddForce(-Right * FVector::DotProduct(GetVelocity(), Right) * Config.Grip * Config.Mass);
	Body->AddForce(-Fwd * Forward * 0.3f * Config.Mass);
	Body->AddTorqueInRadians(FVector(0, 0, Steer * FMath::Clamp(Forward / 800.f, -1.f, 1.f)) * Config.Mass * 2500.f);
}

// ------------------------------------------------------------------------------------------- damage
void ABRVehicle::OnBodyHit(UPrimitiveComponent* HitComp, AActor* OtherActor, UPrimitiveComponent* OtherComp, FVector NormalImpulse, const FHitResult& Hit)
{
	if (!HasAuthority() || bWrecked) { return; }
	const float Now = GetWorld()->GetTimeSeconds();
	const float ImpactSpeed = FMath::Abs(FVector::DotProduct(LastVelocity, Hit.ImpactNormal));
	if (ABRCharacter* Victim = Cast<ABRCharacter>(OtherActor))
	{
		if (!Seats.Contains(Victim))
		{
			const float Dmg = float(BRRules::RunOverDamage(LastVelocity.Size()));
			if (Dmg > 0.f) { UGameplayStatics::ApplyDamage(Victim, Dmg, GetDriverController(), this, UBRDamageType_Vehicle::StaticClass()); }
		}
		return;
	}
	if (Now - LastCollisionDamageTime < 0.3f) { return; }
	const float Dmg = float(BRRules::CollisionDamage(ImpactSpeed));
	if (Dmg > 0.f)
	{
		LastCollisionDamageTime = Now;
		UGameplayStatics::ApplyDamage(this, Dmg, nullptr, this, UBRDamageType_Vehicle::StaticClass());
		for (ABRCharacter* Occ : Seats)
		{
			if (Occ) { UGameplayStatics::ApplyDamage(Occ, Dmg * 0.15f, nullptr, this, UBRDamageType_Vehicle::StaticClass()); }
		}
		UBRProceduralAudio::PlaySfx(this, EBRSfx::Crash, Hit.ImpactPoint, FMath::Clamp(Dmg / 80.f, 0.3f, 1.f));
	}
}

float ABRVehicle::TakeDamage(float Damage, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	if (!HasAuthority() || bWrecked || Damage <= 0.f) { return 0.f; }
	Health -= Damage;
	if (Health <= 0.f) { Wreck(EventInstigator); }
	return Damage;
}

void ABRVehicle::Wreck(AController* Instigator)
{
	bWrecked = true;
	Health = 0.f;
	TArray<ABRCharacter*> Occupants;
	for (ABRCharacter* Occ : Seats) { if (Occ) { Occupants.Add(Occ); } }
	for (ABRCharacter* Occ : Occupants) { Occ->ExitVehicle(); }
	ABRProjectile::Explode(this, GetActorLocation(), 90.f, 600.f, 0.f, 1.f, Instigator, this);
	OnRep_Wrecked();
	SetLifeSpan(45.f);
}

void ABRVehicle::OnRep_Wrecked()
{
	if (bWrecked)
	{
		UMaterialInterface* Burnt = BRVisuals::ColorMaterial(FLinearColor(0.08f, 0.07f, 0.07f));
		for (UStaticMeshComponent* P : PaintParts) { if (P) { P->SetMaterial(0, Burnt); } }
		if (EngineAudio) { EngineAudio->Stop(); }
	}
}

#undef LOCTEXT_NAMESPACE
