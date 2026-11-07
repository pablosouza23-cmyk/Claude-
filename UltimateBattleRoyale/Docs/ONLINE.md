# Online: EOS, servidores dedicados e backend

## Desenvolvimento (sem contas)
`DefaultPlatformService=Null`: partidas por LAN/IP, matchmaking por busca LAN. Funciona no editor
(PIE com vários clientes) e em rede local.

## Produção com Epic Online Services
1. Crie produto/sandbox/deployment e credenciais no Developer Portal da Epic.
2. Em `Config/DefaultEngine.ini`:
```
[OnlineSubsystem]
DefaultPlatformService=EOS
[OnlineSubsystemEOS]
bEnabled=true
[/Script/OnlineSubsystemEOS.EOSSettings]
+Artifacts=(ArtifactName="UltimateBR",ClientId="...",ClientSecret="...",ProductId="...",SandboxId="...",DeploymentId="...",EncryptionKey="...")
DefaultArtifactName=UltimateBR
bUseEAS=True
bUseEOSConnect=True
bUseEOSSessions=True
bMirrorPresenceToEAS=True
```
3. Recursos usados pelo código (`UBRSessionSubsystem`):
   - **Matchmaking**: `FindSessions` filtrando `BRMODE` e `BuildUniqueId`; escolhe menor ping com vagas.
   - **Servidor dedicado**: `RegisterDedicatedServer` cria sessão `bIsDedicated` anunciada.
   - **Partida privada**: sessão listen com presença.
   - **Grupos**: sessão `PartySession` (lobby EOS); o líder publica `BRCONNECT` e os membros seguem.
     O id do grupo vai na URL (`?Party=`) e o servidor mantém o grupo na mesma equipe.
   - **Amigos/convites**: interface de amigos + `SendSessionInviteToFriend`.
   - **Reconexão**: endereço do último servidor; o servidor guarda o personagem por
     `ReconnectWindowSeconds` (120 s) e devolve ao mesmo `UniqueNetId`.
   - **Voz**: `bHasVoiceEnabled=true` + EOS RTC/VoIP do OSS; *Apertar para falar* (tecla T) chama
     `StartTalking/StopTalking`. Precisa de permissão de microfone no Android/iOS.

## Backend de perfil (implementado em `Backend/`)
Com `ProfileBackendUrl` vazio o perfil é local (jogo offline). Configurando a URL, o **backend passa a ser a
única autoridade** sobre XP, moedas, itens, passe, desafios e estatísticas:

| Fluxo | Implementação |
|---|---|
| Resultado da partida | `ABRGameMode::SendMatchResult` → `UBRBackendClient::PostMatchResults` assinado com HMAC (segredo `BR_SERVER_SECRET`, só no servidor dedicado). O backend recalcula XP/moedas com as mesmas regras do C++ e ignora duplicatas. |
| Cosméticos na partida | `ABRPlayerController::ServerSetCosmetics` ignora o que o cliente envia e busca `GET /v1/server/loadout` (apenas itens possuídos). |
| Loja / passe / loadout | `UBRProgressionSubsystem` envia pedidos; o resultado chega do servidor e substitui o cache local. |
| Autenticação do jogador | Desenvolvimento: `bBackendDevAuth=true` → token `dev:<id>` (backend `BR_AUTH_MODE=dev`). Produção: `bBackendDevAuth=false` → token do subsistema online (EOS), validado no backend (`BR_AUTH_MODE=eos`, `BR_EOS_JWKS_URL`, `BR_EOS_CLIENT_ID`). ⚠️ O emissor/JWKS exatos do token EOS devem ser confirmados no portal da Epic. |
| Compras com dinheiro real | `POST /v1/iap/verify` responde **501** até haver credenciais do Google Play / App Store e validação de recibos. |

Subir localmente:
```
cd Backend && BR_AUTH_MODE=dev BR_SERVER_SECRET=troque-isto python3 -m brbackend.server --port 8080
# jogo:     -BRBackend=http://127.0.0.1:8080   (ou ProfileBackendUrl nas configurações do projeto)
# servidor: BR_SERVER_SECRET=troque-isto UltimateBattleRoyaleServer ... -BRBackend=http://127.0.0.1:8080
```
Pilha completa em contêineres: `BR_SERVER_SECRET=... docker compose -f Deploy/docker-compose.yml up --build`
(o servidor dedicado precisa estar empacotado em `Build/Server/LinuxServer`).
