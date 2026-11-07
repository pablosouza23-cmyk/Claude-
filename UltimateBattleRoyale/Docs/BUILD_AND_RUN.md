# Compilar e executar

Requisitos: Unreal Engine **5.4** (Epic Launcher para cliente/editor; **build a partir do código-fonte**
para o alvo de servidor dedicado), Visual Studio 2022 (Windows) ou Xcode 15 (macOS/iOS),
Android Studio + NDK r25 para Android.

## Editor
1. Clique direito em `UltimateBattleRoyale.uproject` → *Generate Visual Studio project files*.
2. Abra a solução, alvo `UltimateBattleRoyaleEditor | Development Editor | Win64`, compile.
3. Abra o projeto. O mapa inicial é `/Engine/Maps/Entry` com o modo `FrontEnd` (menu + lobby 3D).
4. **Play** (Standalone) → menu → *Modos* → escolha → *Jogar*.

Teste de rede no editor: *Play → Number of Players = 2..4*, *Net Mode = Play As Client*, e defina
em *Advanced Settings → Server Map Name Override* = `/Engine/Maps/Entry?game=BR?Mode=Duos?MinPlayers=2`.

## Linhas de comando úteis
```
# Partida local (offline)
UnrealEditor.exe UltimateBattleRoyale.uproject /Engine/Maps/Entry?game=BR?Mode=Training -game -log
# Anfitrião (listen server) e cliente por IP (LAN / NULL subsystem)
UnrealEditor.exe UltimateBattleRoyale.uproject /Engine/Maps/Entry?game=BR?Mode=Solo?listen?MinPlayers=2 -game
UnrealEditor.exe UltimateBattleRoyale.uproject 192.168.0.10 -game
# Seed fixa (mapa reproduzível) e bots explícitos
... ?game=BR?Mode=Solo?Seed=12345?Bots=10
```

## Servidor dedicado (Linux recomendado)
```
RunUAT BuildCookRun -project=.../UltimateBattleRoyale.uproject -server -serverplatform=Linux \
  -noclient -cook -build -stage -pak -archive -archivedirectory=Build/Server
./UltimateBattleRoyaleServer /Engine/Maps/Entry?game=BR?Mode=Solo -log -port=7777
```
O servidor registra a sessão no OSS (EOS em produção) e encerra o processo ao fim da partida, para
que o orquestrador (Agones, GameLift, Edgegap, etc.) suba uma instância limpa.

## Android
```
RunUAT BuildCookRun -project=... -platform=Android -cookflavor=ASTC -clientconfig=Shipping \
  -build -cook -stage -package -pak -archive -archivedirectory=Build/Android
```
Pacote `com.ultimatebattleroyale.game`, API 26+, arm64, Vulkan + ES3.1, paisagem.

## iOS
Configure assinatura em *Project Settings → iOS*, depois:
```
RunUAT BuildCookRun -project=... -platform=IOS -clientconfig=Shipping -build -cook -stage -package -pak
```
