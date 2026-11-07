#include "Audio/BRProceduralAudio.h"

#include "Components/AudioComponent.h"
#include "Core/BRSettings.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Settings/BRGameUserSettings.h"
#include "Sound/SoundAttenuation.h"
#include "Sound/SoundWaveProcedural.h"
#include "TimerManager.h"
#include "UObject/Package.h"

namespace
{
	constexpr float SR = float(UBRProceduralAudio::SampleRate);
	constexpr float TwoPi = 6.28318530718f;

	struct FNoise
	{
		uint32 S = 0x1234567u;
		float White() { S ^= S << 13; S ^= S >> 17; S ^= S << 5; return float(S & 0xFFFFFF) / float(0xFFFFFF) * 2.f - 1.f; }
	};

	struct FOnePole
	{
		float Z = 0.f;
		float Process(float X, float Coef) { Z += Coef * (X - Z); return Z; }
	};

	void ToPCM(const TArray<float>& In, TArray<int16>& Out)
	{
		float Peak = 0.001f;
		for (float V : In) { Peak = FMath::Max(Peak, FMath::Abs(V)); }
		const float Gain = FMath::Min(1.f, 0.9f / Peak);
		Out.SetNumUninitialized(In.Num());
		for (int32 I = 0; I < In.Num(); ++I) { Out[I] = int16(FMath::Clamp(In[I] * Gain, -1.f, 1.f) * 32000.f); }
	}

	// Percussive noise burst + low body: the basis of every gunshot.
	void Shot(TArray<float>& Out, float Seconds, float Decay, float Bright, float BodyHz, float BodyAmt, uint32 Seed)
	{
		FNoise N; N.S = Seed; FOnePole LP;
		const int32 Count = int32(Seconds * SR);
		Out.SetNumZeroed(Count);
		for (int32 I = 0; I < Count; ++I)
		{
			const float T = I / SR;
			const float Env = FMath::Exp(-T / Decay);
			const float Crack = LP.Process(N.White(), Bright) * Env;
			const float Body = FMath::Sin(TwoPi * BodyHz * T * (1.f - T * 0.5f)) * FMath::Exp(-T / (Decay * 1.5f)) * BodyAmt;
			Out[I] = Crack + Body;
		}
	}

	void Tone(TArray<float>& Out, float StartSec, float Hz, float Seconds, float Amp, float Decay, bool bSquare = false)
	{
		const int32 Start = int32(StartSec * SR), Count = int32(Seconds * SR);
		if (Out.Num() < Start + Count) { Out.SetNumZeroed(Start + Count); }
		for (int32 I = 0; I < Count; ++I)
		{
			const float T = I / SR;
			float W = FMath::Sin(TwoPi * Hz * T);
			if (bSquare) { W = W > 0.f ? 0.6f : -0.6f; }
			const float Attack = FMath::Min(1.f, T / 0.005f);
			Out[Start + I] += W * Amp * Attack * FMath::Exp(-T / Decay);
		}
	}

	void NoiseShaped(TArray<float>& Out, float Seconds, float Coef, TFunctionRef<float(float)> Env, uint32 Seed)
	{
		FNoise N; N.S = Seed; FOnePole LP;
		const int32 Count = int32(Seconds * SR);
		Out.SetNumZeroed(Count);
		for (int32 I = 0; I < Count; ++I) { Out[I] = LP.Process(N.White(), Coef) * Env(I / SR); }
	}

	void Sweep(TArray<float>& Out, float Seconds, float F0, float F1, float Amp)
	{
		const int32 Count = int32(Seconds * SR);
		Out.SetNumZeroed(Count);
		float Phase = 0.f;
		for (int32 I = 0; I < Count; ++I)
		{
			const float T = I / Seconds / SR;
			Phase += TwoPi * FMath::Lerp(F0, F1, T) / SR;
			Out[I] = FMath::Sin(Phase) * Amp * FMath::Sin(T * PI);
		}
	}

	TArray<int16> Generate(EBRSfx Sfx)
	{
		TArray<float> W;
		const float C4 = 261.63f, E4 = 329.63f, G4 = 392.f, C5 = 523.25f;
		switch (Sfx)
		{
		case EBRSfx::GunPistol: Shot(W, 0.35f, 0.045f, 0.5f, 140.f, 0.5f, 11); break;
		case EBRSfx::GunSMG: Shot(W, 0.22f, 0.03f, 0.6f, 180.f, 0.35f, 12); break;
		case EBRSfx::GunRifle: Shot(W, 0.45f, 0.06f, 0.45f, 110.f, 0.6f, 13); break;
		case EBRSfx::GunSniper: Shot(W, 1.2f, 0.18f, 0.35f, 70.f, 0.9f, 14); break;
		case EBRSfx::GunShotgun: Shot(W, 0.7f, 0.1f, 0.25f, 75.f, 1.f, 15); break;
		case EBRSfx::GunLMG: Shot(W, 0.4f, 0.055f, 0.4f, 95.f, 0.7f, 16); break;
		case EBRSfx::GunRocket: NoiseShaped(W, 0.9f, 0.15f, [](float T) { return FMath::Min(1.f, T / 0.03f) * FMath::Exp(-T / 0.35f); }, 17); break;
		case EBRSfx::GunEnergy: Sweep(W, 0.22f, 1800.f, 300.f, 0.8f); break;
		case EBRSfx::Throw: case EBRSfx::PickaxeSwing:
			NoiseShaped(W, 0.28f, 0.2f, [](float T) { return FMath::Sin(FMath::Clamp(T / 0.28f, 0.f, 1.f) * PI) * 0.7f; }, 18); break;
		case EBRSfx::Explosion:
		{
			Shot(W, 1.8f, 0.45f, 0.06f, 45.f, 1.2f, 19);
			break;
		}
		case EBRSfx::Reload: Tone(W, 0.f, 900.f, 0.04f, 0.6f, 0.01f, true); Tone(W, 0.35f, 700.f, 0.05f, 0.7f, 0.012f, true); Tone(W, 0.6f, 1100.f, 0.04f, 0.6f, 0.01f, true); break;
		case EBRSfx::Equip: Tone(W, 0.f, 1200.f, 0.03f, 0.5f, 0.008f, true); Tone(W, 0.08f, 800.f, 0.05f, 0.5f, 0.01f, true); break;
		case EBRSfx::HarvestWood: Shot(W, 0.2f, 0.03f, 0.3f, 190.f, 1.f, 20); break;
		case EBRSfx::HarvestStone: Shot(W, 0.2f, 0.02f, 0.8f, 420.f, 0.5f, 21); break;
		case EBRSfx::HarvestMetal: Tone(W, 0.f, 820.f, 0.6f, 0.5f, 0.18f); Tone(W, 0.f, 1230.f, 0.6f, 0.35f, 0.12f); Tone(W, 0.f, 2010.f, 0.4f, 0.2f, 0.08f); break;
		case EBRSfx::Footstep: Shot(W, 0.08f, 0.015f, 0.2f, 90.f, 0.4f, 22); break;
		case EBRSfx::Land: Shot(W, 0.25f, 0.04f, 0.15f, 60.f, 1.f, 23); break;
		case EBRSfx::Pickup: Tone(W, 0.f, C5, 0.06f, 0.5f, 0.05f); Tone(W, 0.05f, 659.25f, 0.06f, 0.5f, 0.05f); Tone(W, 0.1f, 783.99f, 0.1f, 0.5f, 0.06f); break;
		case EBRSfx::ChestOpen: Tone(W, 0.f, C5, 0.25f, 0.4f, 0.15f); Tone(W, 0.08f, 659.25f, 0.25f, 0.4f, 0.15f); Tone(W, 0.16f, 783.99f, 0.25f, 0.4f, 0.15f); Tone(W, 0.24f, 1046.5f, 0.45f, 0.4f, 0.25f); break;
		case EBRSfx::Build: Shot(W, 0.25f, 0.05f, 0.2f, 140.f, 0.9f, 24); break;
		case EBRSfx::BuildBreak: NoiseShaped(W, 0.5f, 0.35f, [](float T) { return FMath::Exp(-T / 0.12f) * (0.6f + 0.4f * FMath::Sin(T * 300.f)); }, 25); break;
		case EBRSfx::Door: Sweep(W, 0.45f, 140.f, 90.f, 0.6f); break;
		case EBRSfx::Heal: Sweep(W, 0.5f, 400.f, 900.f, 0.4f); break;
		case EBRSfx::LaunchPad: Sweep(W, 0.5f, 120.f, 900.f, 0.8f); break;
		case EBRSfx::Refuel: NoiseShaped(W, 1.5f, 0.05f, [](float T) { return 0.5f + 0.5f * FMath::Sin(T * 40.f); }, 26); break;
		case EBRSfx::Horn: Tone(W, 0.f, 392.f, 0.6f, 0.5f, 2.f, true); Tone(W, 0.f, 494.f, 0.6f, 0.5f, 2.f, true); break;
		case EBRSfx::Crash: NoiseShaped(W, 0.6f, 0.5f, [](float T) { return FMath::Exp(-T / 0.15f); }, 27); Tone(W, 0.f, 520.f, 0.5f, 0.3f, 0.2f); break;
		case EBRSfx::HitBody: Tone(W, 0.f, 1600.f, 0.05f, 0.6f, 0.015f, true); break;
		case EBRSfx::HitHead: Tone(W, 0.f, 2200.f, 0.15f, 0.6f, 0.06f); Tone(W, 0.f, 3300.f, 0.15f, 0.3f, 0.04f); break;
		case EBRSfx::Ping: Tone(W, 0.f, 880.f, 0.15f, 0.5f, 0.08f); Tone(W, 0.12f, 1320.f, 0.25f, 0.5f, 0.12f); break;
		case EBRSfx::UIClick: Tone(W, 0.f, 1000.f, 0.03f, 0.5f, 0.01f); break;
		case EBRSfx::UIConfirm: Tone(W, 0.f, 660.f, 0.08f, 0.5f, 0.05f); Tone(W, 0.07f, 990.f, 0.12f, 0.5f, 0.07f); break;
		case EBRSfx::VictoryMusic:
		{
			const float Notes[] = { C4, E4, G4, C5, G4, C5, 659.25f, 783.99f, 1046.5f };
			for (int32 I = 0; I < 9; ++I) { Tone(W, I * 0.14f, Notes[I], 0.35f, 0.35f, 0.25f, true); }
			Tone(W, 1.3f, C5, 1.6f, 0.3f, 0.9f); Tone(W, 1.3f, 659.25f, 1.6f, 0.3f, 0.9f); Tone(W, 1.3f, 783.99f, 1.6f, 0.3f, 0.9f);
			break;
		}
		default: Tone(W, 0.f, 440.f, 0.05f, 0.3f, 0.02f); break;
		}
		TArray<int16> Out;
		ToPCM(W, Out);
		return Out;
	}

	// Streaming synth for loops (runs on the audio render thread).
	struct FLoopSynth
	{
		EBRSfx Type;
		uint64 Sample = 0;
		float Phase = 0.f, Phase2 = 0.f;
		FNoise N;
		FOnePole LP, LP2;

		float Next()
		{
			const float T = Sample++ / SR;
			switch (Type)
			{
			case EBRSfx::EngineLoop:
			case EBRSfx::BusEngineLoop:
			{
				const float Base = Type == EBRSfx::EngineLoop ? 55.f : 38.f;
				Phase = FMath::Fmod(Phase + Base / SR, 1.f);
				const float Saw = Phase * 2.f - 1.f;
				const float Rumble = LP.Process(N.White(), 0.08f);
				const float Prop = Type == EBRSfx::BusEngineLoop ? (0.5f + 0.5f * FMath::Sin(TwoPi * 9.f * T)) : 1.f;
				return (LP2.Process(Saw, 0.25f) * 0.7f + Rumble * 0.5f) * Prop;
			}
			case EBRSfx::StormLoop:
				return LP.Process(N.White(), 0.02f) * 3.f * (0.6f + 0.4f * FMath::Sin(TwoPi * 0.23f * T)) + FMath::Sin(TwoPi * 4.f * T) * 0.05f;
			case EBRSfx::RainLoop:
			{
				const float W = N.White();
				return (W - LP.Process(W, 0.3f)) * 0.6f;
			}
			case EBRSfx::WindLoop:
				return LP.Process(N.White(), 0.01f + 0.01f * (0.5f + 0.5f * FMath::Sin(TwoPi * 0.1f * T))) * 4.f;
			case EBRSfx::LobbyMusicLoop:
			{
				// I–V–vi–IV progression, 110 BPM, arpeggiated lead + bass (original composition).
				static const float Roots[4] = { 261.63f, 392.f, 220.f, 349.23f };
				static const float Thirds[4] = { 1.26f, 1.26f, 1.19f, 1.26f };
				const float Beat = T * 110.f / 60.f;
				const int32 Bar = int32(Beat / 4.f) % 4;
				const int32 Step = int32(Beat * 2.f) % 8;
				const float Ratio = (Step % 4 == 0) ? 1.f : (Step % 4 == 1 ? Thirds[Bar] : (Step % 4 == 2 ? 1.5f : 2.f));
				const float Lead = Roots[Bar] * Ratio;
				const float StepT = FMath::Frac(Beat * 2.f);
				Phase = FMath::Fmod(Phase + Lead / SR, 1.f);
				Phase2 = FMath::Fmod(Phase2 + Roots[Bar] * 0.5f / SR, 1.f);
				const float Sq = (Phase < 0.5f ? 0.25f : -0.25f) * FMath::Exp(-StepT * 3.f);
				const float Tri = (FMath::Abs(Phase2 * 4.f - 2.f) - 1.f) * 0.3f;
				const float Hat = (Step % 2 == 1) ? N.White() * 0.05f * FMath::Exp(-StepT * 30.f) : 0.f;
				return Sq + Tri + Hat;
			}
			default: return 0.f;
			}
		}
	};

	TMap<EBRSfx, TArray<int16>>& Cache() { static TMap<EBRSfx, TArray<int16>> C; return C; }
}

const TArray<int16>& UBRProceduralAudio::GetOneShotPCM(EBRSfx Sfx)
{
	if (TArray<int16>* Found = Cache().Find(Sfx)) { return *Found; }
	return Cache().Add(Sfx, Generate(Sfx));
}

EBRSfx UBRProceduralAudio::GunshotFor(EBRWeaponCategory Category)
{
	switch (Category)
	{
	case EBRWeaponCategory::Pistol: return EBRSfx::GunPistol;
	case EBRWeaponCategory::SMG: return EBRSfx::GunSMG;
	case EBRWeaponCategory::SniperRifle: return EBRSfx::GunSniper;
	case EBRWeaponCategory::Shotgun: return EBRSfx::GunShotgun;
	case EBRWeaponCategory::LMG: return EBRSfx::GunLMG;
	case EBRWeaponCategory::Explosive: return EBRSfx::GunRocket;
	case EBRWeaponCategory::Special: return EBRSfx::GunEnergy;
	case EBRWeaponCategory::Throwable: return EBRSfx::Throw;
	default: return EBRSfx::GunRifle;
	}
}

float UBRProceduralAudio::MasterVolume(EBRSfx Sfx)
{
	const UBRGameUserSettings* S = UBRGameUserSettings::GetBR();
	if (!S) { return 1.f; }
	const bool bMusic = Sfx == EBRSfx::LobbyMusicLoop || Sfx == EBRSfx::VictoryMusic;
	return S->MasterVolume * (bMusic ? S->MusicVolume : S->SfxVolume);
}

USoundAttenuation* UBRProceduralAudio::AttenuationFor(EBRSfx Sfx)
{
	// Distance classes: gunfire/explosions carry far, footsteps/UI-like sounds stay close.
	static TWeakObjectPtr<USoundAttenuation> Far, Mid, Near;
	auto Make = [](TWeakObjectPtr<USoundAttenuation>& Slot, float Inner, float Falloff)
	{
		if (!Slot.IsValid())
		{
			USoundAttenuation* A = NewObject<USoundAttenuation>(GetTransientPackage());
			A->Attenuation.bAttenuate = true;
			A->Attenuation.bSpatialize = true;
			A->Attenuation.AttenuationShape = EAttenuationShape::Sphere;
			A->Attenuation.AttenuationShapeExtents = FVector(Inner, 0.f, 0.f);
			A->Attenuation.FalloffDistance = Falloff;
			A->Attenuation.DistanceAlgorithm = EAttenuationDistanceModel::NaturalSound;
			A->AddToRoot();
			Slot = A;
		}
		return Slot.Get();
	};
	switch (Sfx)
	{
	case EBRSfx::GunPistol: case EBRSfx::GunSMG: case EBRSfx::GunRifle: case EBRSfx::GunSniper: case EBRSfx::GunShotgun:
	case EBRSfx::GunLMG: case EBRSfx::GunRocket: case EBRSfx::GunEnergy: case EBRSfx::Explosion: case EBRSfx::Horn:
	case EBRSfx::StormLoop: case EBRSfx::BusEngineLoop:
		return Make(Far, 800.f, 18000.f);
	case EBRSfx::EngineLoop: case EBRSfx::Crash: case EBRSfx::BuildBreak: case EBRSfx::LaunchPad: case EBRSfx::HarvestWood:
	case EBRSfx::HarvestStone: case EBRSfx::HarvestMetal: case EBRSfx::Build: case EBRSfx::ChestOpen: case EBRSfx::Door:
		return Make(Mid, 400.f, 6000.f);
	default:
		return Make(Near, 200.f, 2500.f);
	}
}

void UBRProceduralAudio::PlaySfx(const UObject* WorldContext, EBRSfx Sfx, const FVector& Location, float Volume, bool b2D)
{
	UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	if (!World || World->GetNetMode() == NM_DedicatedServer || World->bIsTearingDown) { return; }
	const float Vol = Volume * MasterVolume(Sfx);
	if (Vol <= 0.001f) { return; }

	if (const TSoftObjectPtr<USoundBase>* Override = UBRSettings::Get()->SoundOverrides.Find(Sfx))
	{
		if (USoundBase* Sound = Override->LoadSynchronous())
		{
			if (b2D) { UGameplayStatics::PlaySound2D(World, Sound, Vol); }
			else { UGameplayStatics::PlaySoundAtLocation(World, Sound, Location, Vol, 1.f, 0.f, AttenuationFor(Sfx)); }
			return;
		}
	}

	const TArray<int16>& PCM = GetOneShotPCM(Sfx);
	if (PCM.Num() == 0) { return; }
	USoundWaveProcedural* Wave = NewObject<USoundWaveProcedural>(GetTransientPackage());
	Wave->SetSampleRate(SampleRate);
	Wave->NumChannels = 1;
	Wave->Duration = float(PCM.Num()) / SampleRate;
	Wave->SoundGroup = SOUNDGROUP_Default;
	Wave->bLooping = false;
	Wave->QueueAudio(reinterpret_cast<const uint8*>(PCM.GetData()), PCM.Num() * sizeof(int16));

	const float Pitch = FMath::FRandRange(0.94f, 1.06f);
	UAudioComponent* AC = b2D
		? UGameplayStatics::SpawnSound2D(World, Wave, Vol, Pitch)
		: UGameplayStatics::SpawnSoundAtLocation(World, Wave, Location, FRotator::ZeroRotator, Vol, Pitch, 0.f, AttenuationFor(Sfx));
	if (AC)
	{
		// Procedural waves do not end by themselves: stop once the buffer has played.
		TWeakObjectPtr<UAudioComponent> Weak = AC;
		FTimerHandle H;
		World->GetTimerManager().SetTimer(H, FTimerDelegate::CreateLambda([Weak]() { if (Weak.IsValid()) { Weak->Stop(); } }), Wave->Duration / Pitch + 0.05f, false);
	}
}

UAudioComponent* UBRProceduralAudio::CreateLoop(AActor* Owner, EBRSfx Loop)
{
	if (!Owner || Owner->GetNetMode() == NM_DedicatedServer || !Owner->GetRootComponent()) { return nullptr; }
	USoundBase* Sound = nullptr;
	if (const TSoftObjectPtr<USoundBase>* Override = UBRSettings::Get()->SoundOverrides.Find(Loop)) { Sound = Override->LoadSynchronous(); }
	if (!Sound)
	{
		USoundWaveProcedural* Wave = NewObject<USoundWaveProcedural>(Owner);
		Wave->SetSampleRate(SampleRate);
		Wave->NumChannels = 1;
		Wave->Duration = INDEFINITELY_LOOPING_DURATION;
		Wave->SoundGroup = SOUNDGROUP_Default;
		Wave->bLooping = true;
		TSharedPtr<FLoopSynth> Synth = MakeShared<FLoopSynth>();
		Synth->Type = Loop;
		Synth->N.S = uint32(Owner->GetUniqueID()) | 1u;
		Wave->OnSoundWaveProceduralUnderflow.BindLambda([Synth](USoundWaveProcedural* InWave, int32 SamplesRequired)
		{
			TArray<int16> Buffer;
			Buffer.SetNumUninitialized(SamplesRequired);
			for (int32 I = 0; I < SamplesRequired; ++I) { Buffer[I] = int16(FMath::Clamp(Synth->Next() * 0.5f, -1.f, 1.f) * 30000.f); }
			InWave->QueueAudio(reinterpret_cast<const uint8*>(Buffer.GetData()), Buffer.Num() * sizeof(int16));
		});
		Sound = Wave;
	}
	UAudioComponent* AC = NewObject<UAudioComponent>(Owner);
	AC->SetSound(Sound);
	AC->bAutoActivate = false;
	AC->bAllowSpatialization = Loop != EBRSfx::LobbyMusicLoop;
	AC->AttenuationSettings = AttenuationFor(Loop);
	AC->SetupAttachment(Owner->GetRootComponent());
	AC->RegisterComponent();
	AC->SetVolumeMultiplier(MasterVolume(Loop));
	AC->Play();
	return AC;
}
