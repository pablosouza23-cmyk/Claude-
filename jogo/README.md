# Battle Island

Battle royale 3D para celular, que roda no navegador (Chrome Android) e pode ser instalado como app. Foi feito em HTML, CSS, JavaScript e Three.js (r160, incluído na pasta). Não tem etapa de build nem dependências para instalar.

**Partida:** 25 jogadores (você e seus amigos + bots) saltam de um avião sobre a ilha. Depois cada um pega armas e equipamentos, enquanto a zona segura fecha. Ganha quem ficar por último.

## Jogar com os amigos (multiplayer)
1. Toque em **JOGAR → CRIAR SALA**. Aparece um código de 5 letras (ex.: `K7Q2M`).
2. Mande o código, ou toque em **CONVIDAR** pra mandar o link pelo WhatsApp.
3. Os amigos tocam em **JOGAR → ENTRAR NA SALA** e digitam o código. Quem abre o link entra direto.
4. Cada um escolhe o personagem nas setas embaixo. Quem criou a sala toca em **COMEÇAR**. Dá pra completar com bots até 25 ou jogar só entre amigos (até 8 pessoas).

Como funciona: a conexão é direta entre os celulares (WebRTC, pela biblioteca PeerJS). O servidor gratuito da PeerJS só ajuda a se encontrarem, e não precisa pagar servidor. O celular de quem criou a sala roda os bots, a zona e o loot, então ele precisa ficar com o jogo aberto na tela até o fim. O multiplayer precisa de internet e do jogo aberto por um endereço `https://` (GitHub Pages serve).

## Como rodar
- **No computador:** `cd jogo && python3 -m http.server 8000` e abra `http://localhost:8000`. Para testar no celular na mesma rede Wi-Fi, use `http://<ip-do-computador>:8000`.
- **On-line:** publique a pasta `jogo/` em qualquer hospedagem HTTPS. O GitHub Pages serve: *Settings → Pages → branch → pasta raiz*, e o jogo fica em `https://<usuario>.github.io/<repositorio>/jogo/`.
- Jogue com o celular na horizontal.

## O que tem no jogo
- **Telas (como na referência):**
  - carregamento com barra;
  - login (conta ou convidado) e lobby com perfil, moedas, loja, recarga, mapa e o personagem em 3D num pódio (veja a v2.3);
  - lobby (jogadores, mapa, modo, contagem, PRONTO);
  - inventário (itens da partida) e arsenal (as 10 armas com raridade, descrição, munição e atributos);
  - mapa completo com legenda;
  - configurações:
    - Geral: nome e sensibilidades da câmera e da mira;
    - Gráficos: qualidade e FPS;
    - Controles: tamanho e opacidade dos botões;
    - Áudio: som, música, volume e vibração;
  - pausa (continuar, configurações, sair para o lobby, sair do jogo);
  - resultado: VITÓRIA ou DERROTA, com colocação, abates, dano e tempo;
  - notificações coloridas.
- **HUD em jogo:**
  - vida com coração, colete e capacete, vivos e abates;
  - bússola, minimapa redondo com o tempo da zona, botões de pausa e mapa;
  - barra de armas (3 slots, granada, kit, gel);
  - feed de abates, banner "ABATE" e números de dano.
- **Controles de toque:** joystick, atirar (grande, mais um menor à esquerda), mira, pular, agachar, recarregar e inventário rápido. O botão de atirar também gira a câmera quando arrastado. Os slots da barra de armas trocam de arma e usam granada, kit e gel.
- **10 armas, cada uma com modelo e mira próprios:**

  | Arma | Raridade | Munição | Mira |
  |---|---|---|---|
  | Fuzil de Assalto | comum | 30/120 | holográfica, ponto vermelho |
  | Submetralhadora | comum | 25/100 | círculo verde |
  | Rifle de Precisão | raro | 5/30 | luneta |
  | Escopeta | raro | 8/32 | alça de mira |
  | Pistola | comum | 12/48 | alça de mira |
  | Metralhadora Leve | épico | 100/200 | círculo ciano |
  | Fuzil Futurista | lendário | 30/120 | losango azul, partes brilhando |
  | Blaster Experimental | épico | 6/24 | círculo laranja, explosão de energia |
  | Revólver | raro | 6/24 | alça de mira |
  | Carabina Tática | lendário | 40/160 | colchetes vermelhos |

  Ao mirar, a visão passa para primeira pessoa pela mira da arma.
- **Personagens realistas** (Microsoft Rocketbox): cacheado de barba e jaqueta (o padrão), SWAT, soldados, soldada e civis. Dá pra escolher o seu na sala.
  - Animações de captura de movimento: parado, andar, trotar, correr e agachar.
  - O quadril gira para andar de lado e de costas sem deslizar.
  - As mãos seguram a arma por IK (cinemática inversa) e os dedos fecham no cabo.
  - Poses próprias para pulo, prancha, paraquedas, soco e queda.
- **Armas em 3D** (Ultimate Gun Pack da Quaternius, convertido no Blender com bordas chanfradas). Por cima de cada modelo vão a mira holográfica, as faixas de energia e o bipé.
- **Mapa:**
  - Vila Central (praça, chafariz, caixa d'água);
  - Bairro Tropical (casas com interior);
  - Vila Pesqueira (píer e barcos);
  - Porto (contêineres e guindaste);
  - Fazenda (celeiro, silos, plantação);
  - Farol, Ruínas, Floresta, Lagoa e Campo;
  - mar animado com espuma na praia.
- **Efeitos:** clarão no cano, cápsulas ejetadas, faíscas, marcas de tiro, poeira dos passos, explosão com onda de choque e sons sintetizados.

## Desempenho (para não travar)
- **Qualidade automática:** na primeira vez, o jogo olha a placa de vídeo e a memória do celular e escolhe Baixa, Média ou Alta. Dá pra trocar em Configurações → Gráficos.
- **Resolução automática:** se o FPS cair abaixo de 40, a imagem fica um pouco menor até estabilizar e volta quando sobra fôlego. Pode desligar em Gráficos.
- **Limite de 60 FPS,** pra celulares de tela 90/120 Hz não esquentarem nem gastarem bateria à toa.
- **Desenho agrupado:** partículas, nuvens, tiros, marcas de bala, loot e árvores saem em poucos desenhos instanciados. Cada personagem usa um atlas de textura. Medido na vila cheia: de 421 para cerca de 100 chamadas de desenho, e de 1,4 milhão para cerca de 660 mil triângulos.
- **Nível de detalhe:** quem está longe ou fora da tela anima com menos frequência e sem IK. As armas no chão e nas mãos dos outros usam um modelo leve (decimado no Blender), e só as árvores perto de você fazem sombra.
- **Sem engasgos:** os shaders e modelos são preparados antes do salto. As partículas usam arrays fixos, sem criar objetos a cada tiro.

## Jogabilidade
- **Assistência de mira (toque):** perto de um inimigo, a mira fica mais pesada e, enquanto você atira, puxa de leve para o peito dele. Pode desligar em Configurações → Controles.
- **Recarga com animação:** a mão de apoio vai até o carregador.

## Novidades da v2.7
- **Servidor das contas na Netlify** (`netlify/functions/contas.mjs` + `server/contas-core.mjs`):
  - as contas ficam no **Netlify Blobs**, o armazenamento que já vem com o site, de graça e sem outra conta;
  - qualquer pessoa que criar conta no site aparece no **painel do dono**, em "CRIADAS HOJE" e "TODAS";
  - login com a mesma senha em qualquer celular ou computador;
  - a senha fica só como hash scrypt, e cada login recebe um token de sessão;
  - o correio do dono, o ID novo e o verificado chegam no outro celular em até 30 segundos;
  - no painel, o botão **SENHA** troca a senha de quem esqueceu;
  - contas antigas, criadas só no aparelho, sobem para o servidor no primeiro login com a senha.
- **Como publicar com o servidor** (o "arrastar a pasta" da Netlify **não** cria funções, então precisa ser pelo GitHub):
  1. Na Netlify, abra o site → **Site configuration** → **Build & deploy** → **Link repository** e escolha o repositório no GitHub.
  2. Em **Branch to deploy**, escolha o branch do jogo. Em **Base directory**, escreva `jogo`. Deixe **Build command** vazio e **Publish directory** como `jogo`.
  3. Clique em **Deploy**. A Netlify instala o `@netlify/blobs` sozinha (está no `package.json`) e cria o endereço `/api/contas`.
  4. Para conferir, abra `https://SEU-SITE.netlify.app/api/contas`. Tem que aparecer `{"ok":true,"app":"battle-island"...}`.
  5. Opcional: em **Environment variables**, crie `OWNER_HASH` com o hash do seu código de dono novo para trocar o código sem mexer no programa.
- **Ranking global** (botão **RANKING** no lobby): o top 100 de abates e o top 20 por arma, de todas as contas do servidor. Os abates por arma contam a partir desta versão.
- **Fuzil Dourado** na loja (aba **ARMAS**): custa 120 gemas **ou** 6.000 de ouro. O dano é o mesmo e o visual é de ouro polido, na mão, nas costas e na câmera de 1ª pessoa. Dá para ligar e desligar.
- **Roda do mouse** troca de arma na partida.

## Sobre receber o dinheiro das vendas
O CPF e a conta do banco **não ficam no jogo** (o código é público). Eles vão no **Google Play Console**: **Configurações → Perfil de pagamentos**. O Google paga as compras de gemas nessa conta. Não coloque CPF nem dados do banco em nenhum arquivo do jogo.

## Novidades da v2.6
### Banco de dados das contas no link do claude.ai
- Aberto pelo **link do claude.ai**, o jogo usa um banco de dados on-line:
  - cada conta fica salva no documento `accounts/<usuário>`, com nível, moedas, itens, correio e amigos. A senha fica só como hash;
  - você entra com usuário e senha em qualquer aparelho em que estiver logado no claude.ai, e o jogo lembra qual conta você usou por último;
  - o correio e as mudanças feitas em outro aparelho chegam na hora;
  - o painel do dono enxerga todas as contas salvas no banco.
- **Quem salva on-line:** o dono do link e as pessoas com quem ele compartilhar como **Colaborador** ou **Editor**. Quem tem só acesso de leitura joga com a conta salva no próprio aparelho.
- **Fora do claude.ai** (arquivo HTML, GitHub Pages ou app da Play Store), o banco on-line não existe e a conta fica no aparelho. Para a versão da loja, o próximo passo é um banco próprio, como o Firebase.

## Novidades da v2.5
- **Modo Contra Squad** (JOGAR → aba **CONTRA SQUAD**, ou o cartão do mapa → **Arena**):
  - times de **1x1 até 10x10**; os bots completam as vagas;
  - mapa novo **Arena**: ilha pequena com Base Azul e Base Vermelha, prédio de 2 andares no centro, contêineres, Mercado ao norte e Galpão ao sul;
  - no começo de cada rodada, 8 segundos parados na base para escolher a arma (Fuzil, SMG, Escopeta, Precisão, Metralhadora ou Carabina). Todos ganham pistola, colete e capacete Nv. 2, 1 granada, 1 kit e 2 Gel;
  - a rodada dura até um time ser eliminado ou acabar o tempo de 1:40. No fim do tempo, ganha quem tem mais gente viva; se empatar, quem tem mais vida;
  - vence quem fizer **4 rodadas**;
  - não tem fogo amigo, e os colegas aparecem com o nome em azul;
  - placar no topo com rodada, tempo e quem está vivo em cada time;
  - no multiplayer, o anfitrião escolhe na sala **BATTLE ROYALE** ou **CONTRA SQUAD** e o tamanho (− / +). Os jogadores são divididos nos dois times pela ordem de entrada.
- **Amigos** (botão **AMIGOS** no lobby, e também na sala):
  - **ADICIONAR**: digite o ID do amigo e mande o pedido;
  - **PEDIDOS**: aceite ou recuse (a bolinha vermelha mostra quantos chegaram);
  - **AMIGOS**: mostra quem está on-line, em partida ou numa sala. **CONVIDAR** cria a sala, se for preciso, e o amigo recebe o convite na tela com o botão **ENTRAR NA SALA**;
  - funciona pelo mesmo serviço gratuito das salas (PeerJS), sem servidor próprio. O limite é que o pedido e o convite só chegam se o amigo estiver com o jogo aberto;
  - num jogo grande, o ideal é ter um servidor de amigos (Firebase), que guarda os pedidos mesmo com o amigo off-line.
- **Selo de verificado novo** (estrela azul com brilho), no arquivo `assets/verified.png`. Para trocar o desenho, substitua o arquivo, de preferência um PNG quadrado com fundo transparente.

## Novidades da v2.4
- **Renascimento:** no Battle Royale, a primeira vez que você morre não acaba a partida. Aparece "RENASCENDO EM 5…" e você volta caindo de paraquedas num ponto dentro da zona, com 200 de vida e uma pistola. A segunda morte é eliminação. Os bots não renascem. No multiplayer cada amigo também tem um renascimento.
- **Login corrigido:**
  - a senha aceita espaço sobrando e a primeira letra maiúscula que o teclado do celular coloca sozinho;
  - o botão de olho mostra a senha;
  - **ESQUECI A SENHA** pede usuário e apelido;
  - quando o usuário não existe, o erro mostra as contas salvas no aparelho;
  - aparece um aviso quando o navegador não está salvando dados.
- **ID do jogador:** cada conta ganha um ID de 10 números, que aparece no lobby, embaixo do nome, e no Perfil. Tocar no ID copia.
- **Selo de verificado** (o ✔ azul) ao lado do nome no lobby, no perfil e na lista da sala multiplayer. Quem dá o selo é o dono, pelo painel ou mandando pelo correio.
- **Correio** (o envelope no topo do lobby):
  - o número vermelho mostra quantas mensagens novas há;
  - as mensagens podem trazer presentes (ouro, gemas, todos os personagens, todos os emotes, selo de verificado), e cada uma tem um botão **COLETAR**;
  - também há **COLETAR TUDO** e **APAGAR**;
  - toda conta nova recebe uma carta de boas-vindas com 300 de ouro e 10 gemas.
- **Painel do dono:**
  - para abrir: Perfil → toque **5 vezes seguidas no ID** → digite o código do dono. O código vem como **`DONO-ILHA-2026`**; **troque antes de publicar** (veja abaixo);
  - ao liberar, a conta ganha o selo, a marca de DONO e uma carta com **todos os personagens e emotes**;
  - aba **CRIADAS HOJE**: lista as contas criadas hoje, com nome, usuário, ID, nível e hora. Tem um botão para ligar ou desligar o verificado;
  - aba **TODAS**: lista todas as contas;
  - aba **ENVIAR CORREIO**: manda uma mensagem para um ID ou para `todos`, com todos os personagens, todos os emotes, selo, ouro e gemas.
- **Mudar ID** (painel do dono, botão **ID** em cada conta): troca o ID por outro de 1 a 10 números, por exemplo `0`. Para fixar um ID em qualquer aparelho, existe a lista `ACC.ID_REMAP` em `js/account.js`. Hoje ela já transforma o ID `3423471011` em `0`.
- **Trocar o código do dono:**
  1. Abra o jogo no Chrome do computador e aperte F12 (Console).
  2. Rode `SHA.hex('battle-dono:' + 'SEU-CODIGO-NOVO')`, com o código em letras maiúsculas.
  3. Cole o resultado em `ACC.OWNER_HASH`, no arquivo `js/account.js`.
- **Limite importante:** sem servidor, o painel só enxerga as contas **deste aparelho**, e o correio só chega a elas. Para ver as contas criadas hoje no celular de todos os jogadores e mandar correio para qualquer ID, as contas precisam ir para a nuvem (por exemplo Firebase Authentication + Firestore; o correio vira uma coleção `mail/{id}`). Pelo mesmo motivo, quem entende de programação consegue mexer nos dados guardados no próprio celular.

## Novidades da v2.3
- **Mapa novo: Ilha Triângulo** (inspirado nos mapas clássicos de battle royale de celular, com nomes e construções próprios). Tem:
  - cidade da **Torre do Relógio** com prédios de 2 e 3 andares, escadas e terraço;
  - **Pico** com observatório e antenas;
  - **Fábrica** com chaminés, tanques e canos;
  - **Hangar** com pista de pouso, avião e torre de controle;
  - **Usina** com torres de resfriamento e linha de energia;
  - **Estaleiro** com navio e pórtico;
  - **Vila do Moinho** (as pás giram), **Arrozais** com palafitas e **Povoado**.

  Escolha o mapa no lobby (cartão **MAPA**). Na sala multiplayer quem escolhe é o anfitrião, e o mapa vai junto para os amigos.
- **Contas:**
  - criar conta com usuário e senha, ou jogar como convidado;
  - o progresso fica salvo: nível, XP, ouro, gemas, itens e estatísticas;
  - a senha é guardada com hash (SHA-256 com sal), nunca em texto;
  - o **código de transferência** (Perfil) leva a conta para outro celular.
- **Moedas:**
  - **Ouro** se ganha jogando (abates, colocação, tempo vivo), subindo de nível e no prêmio diário;
  - **Gemas** vêm da **Recarga**, com 6 pacotes:

    | Preço | Gemas |
    |---|---|
    | R$ 2 | 20 |
    | R$ 5 | 50 + 5 |
    | R$ 10 | 100 + 15 |
    | R$ 20 | 200 + 40 |
    | R$ 50 | 500 + 120 |
    | R$ 100 | 1.000 + 300 |

    Dá para trocar 10 gemas por 800 de ouro.
- **Loja:** os 8 personagens e os 10 emotes têm preço em ouro ou gemas e raridade (comum, raro, épico, lendário). Ao tocar num item, o personagem do pódio veste ou dança na hora. Só os itens comprados aparecem na partida e na sala.
- **Lobby novo:**
  - o personagem fica num pódio iluminado sobre uma plataforma no mar, com a ilha ao fundo, e dá para arrastar para girar;
  - em cima: perfil, nível e moedas com o botão **+** de recarga;
  - à esquerda: Loja, Personagem, Emotes, Recarga, Arsenal e Perfil;
  - à direita: banner de novidades, mapa e o botão JOGAR.
- **Carregamento novo:** ilha ao pôr do sol com avião e paraquedas animados, logo dourado, porcentagem e dicas.
- **Fim de partida:** mostra o ouro e o XP ganhos e avisa quando você sobe de nível.

### Sobre as contas e os pagamentos (leia antes de publicar)
- **Onde a conta fica:** neste aparelho (armazenamento do navegador/app). Isso não é uma conta na nuvem. Se o app for desinstalado sem gerar o código de transferência, o progresso se perde.
- **Conta na nuvem:** para entrar de qualquer celular é preciso um servidor, por exemplo Firebase Authentication + Firestore (tem plano grátis). O código já separa isso no módulo `ACC` (`js/account.js`), então a troca é localizada.
- **Pagamento de verdade:** a recarga usa o **Google Play Billing** quando o jogo roda como app da Play Store (TWA com a Digital Goods API). Fora disso entra o **modo de teste**: aparece um aviso amarelo, nenhuma cobrança é feita e as gemas são só para testar a loja.
- Passos para ativar a cobrança real:
  1. No Play Console, crie produtos **consumíveis** com estes IDs: `gemas_20`, `gemas_55`, `gemas_115`, `gemas_240`, `gemas_620` e `gemas_1300`.
  2. Gere o app com o Bubblewrap (ou PWABuilder) com o recurso **Play Billing** ligado.
  3. Em `js/account.js`, troque `PAY.TEST_MODE = true` por `false`.
  4. **Importante:** antes de creditar as gemas, confirme o `purchaseToken` num servidor seu pela Google Play Developer API. Sem isso alguém pode forjar compras, e também dá para editar ouro e gemas no próprio aparelho.
- A Play Store exige a política de privacidade atualizada dizendo que há compras no app e conta com apelido.

## Novidades da v2.2
- **Modo Bodycam** (Configurações → Gráficos → Estilo da imagem: Bodycam). A imagem passa por um filtro de câmera corporal: lente olho-de-peixe, aberração de cor nas bordas, brilho estourado, cor fria, vinheta, granulado e o letreiro REC com data e hora.
- **Câmera de peito** (Configurações → Controles → Câmera: 1ª pessoa). Você vê os próprios braços segurando a arma no canto da tela, e a câmera balança com o corpo. Combina com o filtro Bodycam.
- **Editar HUD** (Configurações → Controles → EDITAR HUD). Arraste cada botão, o joystick, a barra de armas, o minimapa e a vida, e ajuste o tamanho de 50% a 180%. O botão PADRÃO volta ao original.
- **Sensibilidade por mira** (aba Sensibilidade): geral, mira 1x, mira 2x e luneta 4x, de 10% a 300%.
- **Emotes:** 10 animações de captura de movimento (danças, acenar, aplaudir, rir, comemorar, vitória). Na partida, use o botão de carinha ou a tecla B; na sala, os botões embaixo. O personagem acena ao entrar no lobby, os bots comemoram depois de abater alguém e no multiplayer os amigos veem o seu emote.
- **Armas com textura de verdade:** metal escovado com arranhões que brilham, madeira com veios e polímero fosco, com relevo nos arranhões.
- **Itens novos modelados no Blender:** granada, mochila, kit médico, caixa de munição, colete, capacete, gel e a caixa do suprimento, com tecido, metal e plástico de verdade.
- **Efeitos:**
  - feixe de luz da raridade nas armas do chão;
  - brilho ao pegar um item;
  - a arma sobe da cintura ao sacar ou trocar;
  - rastro de fumaça da granada;
  - explosão com bola de fogo, fumaça grossa, fagulhas e marca queimada.
- **Mais fluido:** o personagem arranca, freia e vira mais rápido, e as animações trocam mais depressa.

## Publicar na Play Store
O jogo já vem com o que o Android pede de um app web instalável: `manifest.webmanifest`, `sw.js` (funciona sem internet depois do primeiro acesso) e ícones em `icons/`. O caminho mais simples é empacotar como **TWA (Trusted Web Activity)**:

1. Publique a pasta `jogo/` em HTTPS (por exemplo, no GitHub Pages) e confirme que ela abre no Chrome do celular.
2. Acesse **pwabuilder.com**, cole o endereço do jogo e gere o pacote **Android**. Ele entrega o arquivo `.aab` e um `assetlinks.json`.
3. Coloque o `assetlinks.json` em `https://<seu-domínio>/.well-known/assetlinks.json`. Sem isso, o app abre com a barra do navegador.
4. Crie a conta de desenvolvedor no **Google Play Console** (taxa única de US$ 25) e envie o `.aab`.
5. Preencha o que a loja pede:
   - política de privacidade (uma página simples dizendo que o jogo não coleta dados pessoais);
   - classificação de conteúdo: o questionário vai marcar violência de desenho/fantasia;
   - público-alvo, capturas de tela e descrição.

   Contas pessoais novas precisam fazer um **teste fechado com testadores** (atualmente 12 pessoas por 14 dias) antes de liberar para o público.

### Ganhar dinheiro com o jogo
- **Compras no app:** a loja e a recarga de gemas (R$ 2 a R$ 100) já estão prontas e ligadas ao Google Play Billing. Siga os passos de "Sobre as contas e os pagamentos" acima. O Google fica com 15% da receita até US$ 1 milhão por ano.
- **Anúncios (opcional):** em TWA não dá para usar o AdMob direto. A opção é empacotar com **Capacitor** e usar um plugin do AdMob.

### Créditos e licenças (todas permitem uso comercial)
| O quê | Autor | Licença |
|---|---|---|
| Personagens e animações (`assets/chars/`) | [Microsoft Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox) | MIT |
| Modelos das armas (`assets/guns.bin`) | [Ultimate Gun Pack](https://quaternius.com/packs/ultimategun.html), da Quaternius | CC0 (domínio público) |
| Motor 3D (`js/three.min.js`) | three.js | MIT |
| Multiplayer (`js/peerjs.min.js`) | PeerJS | MIT |

A licença MIT pede que o aviso de copyright vá junto com o jogo. Deixe esta tabela no README e coloque uma linha de créditos na página da loja ou numa tela "Sobre". Os textos das licenças estão em `js/THREE_LICENSE.txt` e `js/PEERJS_LICENSE.txt`; o da Rocketbox está no repositório dela.

### Antes de publicar
- **Personagem:** os personagens são da biblioteca Rocketbox. Nenhum é cópia da pessoa das fotos de referência.
- **Nome:** o nome "Battle Island" é genérico. Confira se não há outro app com o mesmo nome na loja antes de registrar.
- **Celular de verdade:** os testes rodaram num Chromium simulando celular. Teste em aparelhos reais antes de publicar. Se travar, use **Qualidade: Baixa**.

## Estrutura
| Arquivo | Conteúdo |
|---|---|
| `index.html` | HUD, controles e todas as telas |
| `css/game.css` | Estilo da interface (horizontal e retrato) |
| `manifest.webmanifest`, `sw.js`, `icons/` | App instalável (PWA) e modo sem internet |
| `js/three.min.js` | Three.js r160 (MIT, licença em `js/THREE_LICENSE.txt`) |
| `js/util.js` | Ruído, materiais toon, contornos, mescla de geometrias, UV projetada |
| `js/textures.js` | Texturas desenhadas por código (chão, reboco, telha, madeira, pedra, metal, folhas, tecido, desgaste de arma) |
| `js/world.js` | Relevo, construções da Ilha Tropical, vegetação, mar, céu, colisões e raios |
| `js/weapons.js` | As 10 armas: atributos, raridade, mira e modelos |
| `js/character.js` | Carrega os personagens, mistura as animações e faz o IK de braços e pernas |
| `js/effects.js` | Efeitos visuais e sons |
| `js/game.js` | Regras: jogador, armas, granada, gel, loot, zona, suprimento, avião, bots |
| `js/net.js` | Multiplayer: salas, sincronização de bonecos, tiros, dano, loot e zona |
| `js/post.js` | Filtro Bodycam (pós-processamento) |
| `js/maps.js` | Mapas (Ilha Tropical e Ilha Triângulo): áreas, estradas, prédios, hangar, usina, estaleiro, moinho |
| `js/account.js` | Contas (login, senha com hash, código de transferência), ouro, gemas, catálogo da loja e pagamento (Play Billing) |
| `js/cs.js` | Modo Contra Squad: times, rodadas, escolha de arma, placar e sincronização |
| `js/friends.js` | Amigos: pedidos, on-line, convite para a sala (PeerJS) |
| `js/lobby.js` | Lobby, loja, recarga, perfil, escolha de mapa, palco 3D, diálogos e tela de carregamento |
| `assets/props.bin` | Granada, mochila, kit, munição, colete, capacete, gel e caixa (modelados no Blender) |
| `assets/chars/` | Personagens (malha + texturas) e animações, em formato binário compacto |
| `assets/guns.bin` | Os 10 modelos de arma e o bipé |
| `js/ui.js` | Câmera, HUD, telas, controles, carregamento e laço principal |
