# Pesquisa de provedores (outubro de 2026)

Objetivo: encontrar APIs, SDKs ou programas de parceiros que permitam ter jogos como GTA V, Fortnite e EA SPORTS FC no PH Cloud, de forma autorizada.

## Resumo

- **Nenhum serviço de cloud gaming oferece API pública para incorporar o player de jogos AAA em outro site.**
- O que existe de oficial e foi integrado: **links oficiais** para a página de cada jogo (Xbox Cloud Gaming) e **deep links** documentados (GeForce NOW).
- Para jogos rodando dentro do próprio site, o caminho é **B2B com contrato** (Blacknut) ou servidores próprios com licença.

## Serviços de cloud gaming

| Serviço | API pública / incorporação | No Brasil | Como está no PH Cloud |
|---|---|---|---|
| Xbox Cloud Gaming | Não. Só parcerias fechadas (GeForce NOW, Boosteroid, TVs). | Sim | Links oficiais `xbox.com/pt-BR/play/games/…` |
| GeForce NOW (NVIDIA; ABYA no Brasil) | Deep links oficiais para sites e agregadores (GeForceNOW-SDK). Sem incorporação. | Sim (ABYA) | Deep links `play.geforcenow.com/games?game-id=…&utm_source=phcloud&utm_campaign=catalogo` |
| Boosteroid | Não encontrada | Servidores no Brasil desde 2025 | Link oficial cadastrável no painel |
| Amazon Luna | Não | Sem disponibilidade oficial | Não integrado |
| Blacknut (B2B) | White-label, SDK e API para operadoras e mídia, **por contrato** (parceira no Brasil: Telecall) | Via parceiros | Não integrado (exige contrato). Catálogo: Ubisoft, Square Enix, títulos da Activision; GTA V e Fortnite não constam |
| Ubitus GameCloud (B2B) | Por contrato corporativo | — | Não integrado |
| Xsolla Cloud Gaming | Botão/iframe "Play Now" só para o publisher do próprio jogo | — | Não se aplica |
| Clientes não oficiais do Xbox (Greenlight, xbox-xcloud-player) | Usam API privada da Microsoft | — | **Não usados** (termos de serviço, risco às contas, instabilidade) |

## Jogos cadastrados e o que foi conferido (12/10/2026)

| Jogo | Serviço | Acesso | Observação |
|---|---|---|---|
| Fortnite | Xbox Cloud Gaming | Grátis, sem Game Pass | Página oficial da Epic confirma |
| Fortnite | GeForce NOW | Grátis | NVIDIA: disponível a todos os membros |
| GTA V | Xbox Cloud Gaming | Game Pass Ultimate | Entra e sai do Game Pass; fora do GeForce NOW desde 2019 |
| EA SPORTS FC 26 | Xbox Cloud Gaming | Game Pass Ultimate (EA Play) ou compra | No EA Play desde 18/06/2026 (Xbox Wire) |
| Forza Horizon 5 | Xbox Cloud Gaming | Game Pass ou compra | Página "Jogar" oficial |
| Marvel Rivals | GeForce NOW | Grátis | Versão Steam |
| Rocket League | GeForce NOW | Grátis | Versão Epic |
| Counter-Strike 2 | GeForce NOW | Grátis | Conta Steam |
| Genshin Impact | GeForce NOW | Grátis | — |

Os catálogos mudam. Revise pelo painel **Admin › Jogos**.

## Portais de jogos HTML5

| Provedor | Situação |
|---|---|
| itch.io | Incorporação oficial por jogo (`embed-upload`), gerada pelo criador. Adaptador pronto, desativado (`PROVIDER_ITCHIO_ENABLED`). Exige permissão do desenvolvedor. |
| GameDistribution | Formato oficial de iframe publicado no GitHub do provedor. Adaptador pronto, desativado. Exige conta de publisher; jogos com anúncios. |
| Google GameSnacks | API para parceiros aprovados. Não integrado. |
| Playgama, GamePix, GameMonetize | Documentação primária inacessível na pesquisa; não integrados para não inventar endpoints. |
| CrazyGames, Poki | Sem programa público de incorporação para terceiros. |

## Fontes

- NVIDIA GeForceNOW-SDK — Deep Linking: https://github.com/NVIDIAGameWorks/GeForceNOW-SDK/blob/master/doc/GfnSdk-Deep-Linking.md
- Epic Games — Fortnite no Xbox Cloud Gaming: https://www.fortnite.com/mobile/xbox-cloud-gaming
- Xbox — Fortnite (pt-BR): https://www.xbox.com/pt-br/play/games/fortnite/bt5p2x999vh2
- Xbox — GTA V (pt-BR): https://www.xbox.com/pt-BR/play/games/grand-theft-auto-v-xbox-series-x%7Cs/9NXMBTB02ZSF
- Xbox — EA SPORTS FC 26 (pt-BR): https://www.xbox.com/pt-br/play/games/ea-sports-fc-26-para-xbox-series-x|s/9p9ftxpkq35p
- Xbox Wire — EA SPORTS FC 26 no EA Play: https://news.xbox.com/pt-br/2026/06/18/ea-sports-fc-26-ja-esta-disponivel-no-ea-play/
- Xbox — Forza Horizon 5 (pt-BR): https://www.xbox.com/pt-br/play/games/forza-horizon-5/9nnx1vvr3knq
- NVIDIA — Marvel Rivals nos planos do GeForce NOW: https://nvidia.custhelp.com/app/answers/detail/a_id/5610/
- GTA V fora do GeForce NOW: https://cloudplay.now/guides/gta-5-geforce-now
- Boosteroid no Brasil: https://boosteroid.com/blog/?p=8403
- ABYA (GeForce NOW na América Latina): https://abya.com/pt/news/post/geforce-now-powered-abya-launches-premium-cloud-gaming-service-latin-america
- Blacknut e parceiros B2B: https://clouddosage.com/blacknut-cloud-gaming-tv-platforms-operators/
- Xbox Cloud Gaming gratuito com anúncios (teste): https://insider-gaming.com/xbox-cloud-gaming-ad-supported-tier-reportedly-releasing-in-2026/
- GameDistribution — embed: https://github.com/GameDistribution/gd-embed-game
- itch.io — API: https://itch.io/docs/api/overview
- Poki — acordos: https://sdk.poki.com/deals
- Xsolla — Play Now button: https://developers.xsolla.com/distribute-game/cloud-gaming/features/play-now-button/
