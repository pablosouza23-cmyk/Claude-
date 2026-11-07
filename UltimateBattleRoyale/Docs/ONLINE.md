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

## Backend de perfil (necessário antes de qualquer economia com valor real)
O perfil hoje é um `SaveGame` local (`UBRProgressionSubsystem`) — adequado para offline, **não seguro**
para itens pagos. Contrato recomendado (servidor autoritativo):

| Endpoint | Quem chama | Função |
|---|---|---|
| `POST /match/result` | **servidor dedicado** (chave de serviço) | grava XP/moedas/estatísticas calculados no servidor de jogo |
| `GET /profile` | cliente (token EOS) | nível, moedas, itens, passe |
| `POST /shop/purchase` | cliente | debita moedas e concede item **no backend** |
| `POST /iap/verify` | cliente | valida recibo Google Play / App Store antes de creditar |
| `GET /loadout/{player}` | servidor dedicado | cosméticos realmente possuídos (o servidor hoje só valida contra o catálogo) |

`UBRSettings::ProfileBackendUrl` está reservado para essa integração.
