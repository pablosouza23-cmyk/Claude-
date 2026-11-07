#include "GameModes/BRFrontEndGameMode.h"

#include "Audio/BRProceduralAudio.h"
#include "Camera/CameraComponent.h"
#include "Characters/BRProceduralBodyComponent.h"
#include "Components/AudioComponent.h"
#include "Core/BRVisuals.h"
#include "EngineUtils.h"
#include "Progression/BRProgressionSubsystem.h"
#include "Systems/BRSkyController.h"
#include "UI/BRMainMenuWidget.h"

ABRLobbyScene::ABRLobbyScene()
{
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
	Turntable = CreateDefaultSubobject<USceneComponent>(TEXT("Turntable"));
	Turntable->SetupAttachment(Root);
	Preview = CreateDefaultSubobject<UBRProceduralBodyComponent>(TEXT("Preview"));
	Preview->SetupAttachment(Turntable);
	Preview->SetRelativeRotation(FRotator(0.f, 180.f, 0.f)); // face the camera
	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(Root);
	Camera->SetRelativeLocationAndRotation(FVector(-420.f, 90.f, 120.f), FRotator(-5.f, 0.f, 0.f));
	Camera->SetFieldOfView(60.f);
}

void ABRLobbyScene::BeginPlay()
{
	Super::BeginPlay();
	// Stage: platform, backdrop and ground.
	BRVisuals::AddPart(this, Root, BRVisuals::Cylinder(), FVector(0, 0, -10), FVector(260, 260, 20), FRotator::ZeroRotator, FLinearColor(0.15f, 0.2f, 0.45f), true);
	BRVisuals::AddPart(this, Root, BRVisuals::Cylinder(), FVector(0, 0, 1), FVector(220, 220, 4), FRotator::ZeroRotator, FLinearColor(0.95f, 0.75f, 0.15f), false);
	BRVisuals::AddPart(this, Root, BRVisuals::Plane(), FVector(0, 0, -20), FVector(6000, 6000, 1), FRotator::ZeroRotator, FLinearColor(0.3f, 0.55f, 0.3f), true);
	for (int32 I = 0; I < 12; ++I)
	{
		const FVector P = FRotator(0.f, I * 30.f, 0.f).Vector() * 1800.f;
		BRVisuals::AddPart(this, Root, BRVisuals::Cylinder(), P + FVector(0, 0, 250), FVector(45, 45, 500), FRotator::ZeroRotator, FLinearColor(0.36f, 0.24f, 0.14f), false);
		BRVisuals::AddPart(this, Root, BRVisuals::Sphere(), P + FVector(0, 0, 620), FVector(420, 420, 380), FRotator::ZeroRotator, FLinearColor(0.2f, 0.48f, 0.16f), false);
	}
	RefreshLoadout();
	// Whichever begins play last (controller or scene), the camera ends up on the stage.
	if (APlayerController* PC = GetWorld()->GetFirstPlayerController()) { PC->SetViewTarget(this); }
	Music = UBRProceduralAudio::CreateLoop(this, EBRSfx::LobbyMusicLoop);
	if (Music) { Music->SetVolumeMultiplier(0.35f); }
}

void ABRLobbyScene::RefreshLoadout()
{
	if (const UBRProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UBRProgressionSubsystem>())
	{
		Preview->ApplyLoadout(Prog->GetLoadout());
	}
}

void ABRLobbyScene::PlayEmote(FName EmoteId)
{
	Preview->SetPreviewEmote(EmoteId);
}

void ABRLobbyScene::RotatePreview(float DeltaYaw)
{
	Turntable->AddRelativeRotation(FRotator(0.f, DeltaYaw, 0.f));
}

void ABRMenuPlayerController::BeginPlay()
{
	Super::BeginPlay();
	if (!IsLocalController()) { return; }
	for (TActorIterator<ABRLobbyScene> It(GetWorld()); It; ++It) { Lobby = *It; break; }
	if (Lobby.IsValid()) { SetViewTarget(Lobby.Get()); }
	Menu = CreateWidget<UBRMainMenuWidget>(this, UBRMainMenuWidget::StaticClass());
	if (Menu) { Menu->AddToViewport(); }
	bShowMouseCursor = true;
	FInputModeUIOnly Mode;
	SetInputMode(Mode);
}

ABRFrontEndGameMode::ABRFrontEndGameMode()
{
	DefaultPawnClass = nullptr;
	PlayerControllerClass = ABRMenuPlayerController::StaticClass();
}

void ABRFrontEndGameMode::BeginPlay()
{
	Super::BeginPlay();
	FActorSpawnParameters SP;
	SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	GetWorld()->SpawnActor<ABRLobbyScene>(ABRLobbyScene::StaticClass(), FTransform::Identity, SP);
	if (ABRSkyController* Sky = GetWorld()->SpawnActor<ABRSkyController>(ABRSkyController::StaticClass(), FTransform::Identity, SP))
	{
		Sky->bFrozen = true;
		Sky->SetTimeOfDay(16.5f);
	}
}
