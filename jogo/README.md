# Battle Island

Battle royale 3D para celular, que roda no navegador (Chrome Android) e pode ser instalado como app. Foi feito em HTML, CSS, JavaScript e Three.js (r160, incluído na pasta). Não tem etapa de build nem dependências para instalar.

**Partida:** 25 jogadores (você e seus amigos + bots) saltam de um avião sobre a ilha. Depois cada um pega armas e equipamentos, enquanto a zona segura fecha. Ganha quem ficar por último.

## Servidor das contas (hospedagem)
O jogo funciona sozinho em qualquer hospedagem de arquivos (HTML/JS). Nesse caso, as contas, o ouro, as gemas e as skins ficam **salvos no aparelho** de cada pessoa, e o multiplayer e os amigos continuam funcionando (são de celular para celular).

Alguns recursos precisam do **servidor das contas**, que responde em `/api/contas`:
- login no mesmo usuário em qualquer aparelho;
- painel do dono com todas as contas;
- ranking global;
- recarga por Pix;
- códigos de resgate e verificados (azul, dourado e supremo);
- entrar com Google.

A lógica desse servidor está pronta em `server/contas-core.mjs` e não depende de hospedagem: ela recebe o pedido (JSON) e um banco com `get`, `setJSON`, `delete` e `list`. Para ligar, é preciso uma hospedagem com servidor ou funções, que encaminhe `POST /api/contas` para `handle(corpo, banco, opções)`.

Por enquanto **não há hospedagem configurada**: sem o servidor, o jogo usa só as contas do aparelho e avisa quando um recurso precisa do servidor.

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

## Novidades da v4.3

- Amigos › PERFIL: ver o perfil do amigo (nível, selo, status e, se ele estiver on-line, partidas, vitórias, abates, top 5 e melhor colocação) e COPIAR ID.
- Chat do grupo no lobby: mensagens com os amigos que estão no seu grupo.
- Chat de voz do grupo: botão 🎤 no lobby e na partida (com amigos). Liga o microfone e o grupo te ouve.

## Novidades da v4.2

- Topo do lobby só com o PASSE (a recarga continua no + dos diamantes).
- Painel do dono › BANIR: ban por ID ou usuário, com tempo (1 min, 10 min, 1 h, 2 h, 1 dia, 2 dias, 7 dias, 30 dias ou para sempre), motivo e botão DESBANIR. O banido não entra em partidas, nem nas salas do dono.
- Grupo estilo FF no lobby principal: os amigos ficam em pé do seu lado com a skin deles, as vagas de convite (+) ficam em cima do INICIAR e o líder inicia a partida com todo mundo.

## Novidades da v4.1

- Botões de copiar (código de transferência, ID, código da sala, Pix) funcionam no celular e dentro do link do jogo.
- Conta do dono recebe automaticamente tudo o que entra na loja (ex.: AK-47 Fúria Glacial).
- Qualidade baixa mais nítida e mais leve: enxerga menos longe, bots longe animam menos vezes, menos grama e a resolução dinâmica não desce tanto.
- Lobby mais limpo: à esquerda só LOJA, ARSENAL, RANKING e AMIGOS; no topo PASSE e RECARGA. Resgatar código e verificado ficam no PERFIL. O Sargento (igual ao Soldado) saiu da vitrine.

## Novidades da v4.0

- Lobby novo no estilo FF: menu da esquerda em blocos com ícone, atalhos no topo direito (PASSE, RECARGA, CÓDIGO, SELOS) e botão INICIAR amarelo. Menos poluído.
- **Passe Battle (EM BREVE)**: tela com a prévia das recompensas de cada nível.
- A construção (estilo Fortnite) foi retirada.

## Novidades da v3.9

- Emote **Passinho do Jamal** (loja de emotes) com funk tocando junto enquanto dança. Batida original, feita no próprio jogo.
- **AK-47 Fúria Glacial** (diamante): cristais azuis com energia pulsando, clarão e impactos azuis e faíscas em volta da arma.

## Novidades da v3.8

- Imagens dos selos trocadas: a coroa com louros agora é o SUPREMO e as asas viraram o DOURADO.
- Editor de HUD: o minimapa e a barra de vida agora dá para arrastar e redimensionar.
- Celular deitado: loja, menu do lobby e cards menores para caber na tela.
- Trocar a qualidade gráfica não reinicia mais o jogo (resolução e sombras mudam na hora).
- Novo código do verificado AZUL (influenciador), resgatado em CÓDIGO no lobby.

## Novidades da v3.7 (códigos sem servidor)
- **Dono:** liberar o painel do dono com o código do dono dá na hora o **verificado dourado** (antes dava o azul).
- **Códigos funcionando direto no jogo, sem hospedagem** (botões **VERIFICADO** e **CÓDIGO** do menu):
  - código do verificado dourado: só funciona na conta do dono;
  - código do verificado supremo: funciona em qualquer conta que tenha o código;
  - código da skin Craque 10: funciona em qualquer conta que tenha o código.
- Os códigos ficam só com o dono. No programa vai apenas o "hash" de cada um, por isso eles não aparecem aqui.
- Cada conta resgata cada código uma vez, e o selo fica salvo na conta, no aparelho.
- Sem servidor, o jogo não tem como contar quantas pessoas no mundo usaram um código, então o limite de 15 do Craque 10 não vale. Quando houver servidor das contas, o limite volta a valer, junto com os cargos e a auditoria.

## Novidades da v3.6
- **Selo de verificado dentro da partida**, para azul, dourado e supremo:
  - no **feed de abates** (quem matou e quem morreu);
  - no aviso de **abate** que aparece para quem matou;
  - no **painel do squad** e no **nome em cima dos colegas** de time (também no Contra Squad).
- No multiplayer, o selo de cada jogador vai junto na mensagem de início da partida. Assim todos veem o selo dos outros.

## Novidades da v3.5
### Verificado em 3 níveis (resgate por código, conferido no servidor)
- **Níveis:**
  - **Azul:** o verificado de sempre, para influenciadores parceiros. Libera as skins dos lançamentos (hoje, o Carrasco).
  - **Dourado:** selo do proprietário oficial, com coroa e brilho dourado animado.
  - **Supremo:** administradores autorizados, com coroa, asas e pulso preto e dourado.
- **Tela "Resgatar verificado":**
  - Abre pelo menu (**VERIFICADO**) ou pelo perfil (**RESGATAR VERIFICADO**).
  - Tem o campo do código, o botão **RESGATAR**, o "Conferindo no servidor…" e as mensagens de sucesso ou erro.
- **Onde o selo aparece:** perfil, topo do lobby, ranking, lista da sala, nomes do grupo no palco, convites, lista de amigos e painel do dono. O jogo não tem chat; se um dia tiver, ele usa a mesma função `LOB.vf`.
- **Como funciona por dentro** (`server/contas-core.mjs`, o servidor das contas):
  - **Códigos:** no programa fica só o hash SHA-256 do código, nunca o código. O servidor confere o código e grava o resgate na conta logada (token de sessão).
  - **Regras de cada código:** tem validade (`exp`) e limite de pessoas (`max`), e a mesma conta não resgata duas vezes.
  - **Auditoria:** cada tentativa fica registrada, com acerto ou erro, em `audit:redeem` (as últimas 1000).
  - **Cargos:**
    - O **dourado** só é aceito para contas com cargo de **dono** e o **supremo** só para contas com cargo de **administrador**.
    - Só quem tem o código do dono (painel) dá os cargos. Saber o código de verificado não basta.
    - Tirar o cargo tira o selo.
  - **O selo é do servidor:**
    - Fica gravado na conta e continua ao sair e entrar de novo.
    - Se o celular tentar se dar selo (dourado, supremo ou azul) ao salvar, o servidor desfaz.
    - O azul continua vindo do painel do dono (VERIFICADO), do presente pelo correio ou de um código azul.
  - **Multiplayer e amigos:** o selo que aparece para os outros na sala e na lista de amigos é o que o celular da pessoa manda (as salas são de celular para celular). O que é conferido pelo servidor é o selo no perfil, no ranking e no painel do dono.
- **Códigos iniciais** (já cadastrados, válidos até 31/12/2027; os códigos ficam só com o dono):
  - verificado **dourado**: 1 uso, só para a conta do **dono**;
  - verificado **supremo**: até 10 contas, só para **administradores**.
- **Como cadastrar e testar** (precisa do servidor ligado, ou seja, do site publicado pelo GitHub):
  1. Entre no jogo com a **sua conta** (usuário e senha).
  2. Abra o **Painel do dono** (perfil, 5 toques no ID e o código do dono) e vá na aba **CÓDIGOS**.
  3. Em **CARGOS AUTORIZADOS**, escreva o seu usuário, escolha **Dono (dourado)** e toque em **AUTORIZAR**. Faça o mesmo com os administradores, em **Administrador (supremo)**.
     - Também dá para usar as opções `ownerUsers` / `adminUsers` do servidor (variáveis de ambiente da hospedagem), com usuários separados por vírgula.
  4. Teste o **dourado**: em **VERIFICADO**, digite o código do dourado e toque em RESGATAR. Ele aparece no lobby, no perfil e no ranking. Saia e entre de novo: o selo continua.
  5. Teste o **supremo**: entre numa conta autorizada como administrador e resgate o código do supremo.
  6. Teste a **segurança**: numa conta sem cargo, os dois códigos dão "Sua conta não tem permissão". Repetir o código dá "Você já resgatou".
  7. Teste o **azul**: na aba CÓDIGOS, crie um código com prêmio "Verificado azul", limite de pessoas e validade em dias, e resgate numa conta qualquer.
  8. Veja a **AUDITORIA DOS RESGATES** na mesma aba, com data, conta, código e resultado.
- **Para trocar os códigos iniciais:** gere o hash com `node -e "console.log(require('crypto').createHash('sha256').update('battle-code:' + 'NOVO-CODIGO').digest('hex'))"` e troque a chave em `DEFAULT_CODES`.

### Craque 10 (skin exclusiva, raridade DIAMANTE)
- Personagem original: camisa amarela, punhos verdes, calça azul e "CRAQUE 10" nas costas.
- Não aparece à venda: só por código de resgate, para **15 pessoas**, contadas pelo servidor. O servidor tira a skin de quem tentar colocá-la na conta sem resgatar.
- O código fica só com o dono (no programa vai apenas o hash).

### Outros
- Botão **CÓDIGO** no menu, para resgatar códigos de skin, gemas e ouro criados no painel do dono (aba CÓDIGOS, com limite e validade).
- **Trailer do jogo:** `marketing/trailer.mp4` (16 s, 1280x720), para a Play Store e as redes sociais.

## Novidades da v3.4
- **Mochila: largar o que não quer.**
  - Botão **LARGAR** em cada arma e **LARGAR MUNIÇÃO** para jogar fora as balas guardadas daquela arma.
  - **LARGAR** também no kit médico, na granada e no gel.
  - A munição guardada tem limite (2 vezes a reserva da arma), assim como os kits (5), as granadas (4) e o gel (8). Com a mochila cheia aparece o aviso para largar algo.
  - O que você larga só volta para a mochila se você sair de perto e voltar. Os bots não pegam, mas os amigos sim, então dá para passar itens para o time. No multiplayer, o item aparece para todo mundo.
- **Marcação no mapa:** abra o mapa e toque num ponto. Aparece um alfinete amarelo no mapa, no minimapa e na tela, com a distância. Toque de novo em cima para tirar. Os amigos do time veem a sua marcação, com o número dele.
- **HUD como no Free Fire:** minimapa no canto esquerdo, **vivos** e **abates** em caixas no canto direito, painel do time embaixo deles e barra de vida em cima das armas.
- **Gel como botão do HUD:** saiu da barra de armas. **Segure** o botão: aparece a parede transparente. **Arraste** para os lados para girar e para cima/baixo para afastar ou aproximar, depois **solte** para o gel sair. No computador: segure G, mire com o mouse e solte.

## Novidades da v3.3
- **Pular a janela:** chegando perto de uma janela e de frente para ela, aparece o botão **PULAR JANELA** (no computador, Espaço). O personagem apoia no peitoril, passa por cima com o corpo inclinado e cai do outro lado.
- **Correr:** botão **CORRER** (no computador, Shift). Fica 38% mais rápido. Com o botão ligado, o personagem continua correndo para a frente mesmo soltando o controle. Mirar, agachar, atirar ou andar para trás desliga.
- **Sons:** por padrão só os **tiros** (e as explosões) fazem barulho. Cliques, passos, acertos, recarga e o resto podem voltar em Configurações › Áudio › Efeitos sonoros › Todos.
- **Novo personagem: Carrasco do Pântano** (lendário, 199 gemas): máscara 3D costurada com olhos em fenda e tira de couro, jaqueta encardida e pele pálida. É um personagem original do jogo, inspirado em filmes de terror (sem usar personagem de filme com dono).
- **Correções:**
  - **Mira da escopeta (12):** mirando, o corpo da arma tapava o meio da tela. Agora o olho fica rente ao topo da arma, como numa mira de ferro de verdade. Vale também para a pistola e o revólver.
  - **Mira aparecendo no lobby:** quem saía da partida mirando continuava com a mira da arma na tela do lobby. Agora ela some ao sair.

## Correções da v3.2
- **Luneta da sniper:** o preto em volta da lente agora fica **embaixo** dos botões de toque. Atirar, mirar, pular e o resto continuam visíveis e funcionando com a luneta aberta.
- **Painel do dono:**
  - Mostra se o **servidor das contas está LIGADO ou DESLIGADO** e, quando está desligado, o motivo e o passo a passo para ligar.
  - Nova coluna **VISTO**: quando cada pessoa entrou no jogo pela última vez.
  - Botão de **presente** (correio com ouro, gemas, personagens, emotes, skins e verificado) e botão para **adicionar como amigo** em cada conta.

## Correções da v3.1
- **Salto, prancha e paraquedas sem ir e voltar:**
  - No multiplayer, os outros jogadores e os bots agora descem suaves. Antes, a velocidade de quem estava no ar ia como zero e o boneco andava aos trancos e descia em degraus.
  - Os bots do time não ficam mais em zigue-zague em volta do líder: perto dele, eles copiam o rumo.
  - Girando a câmera no ar, o personagem vira para onde você olha, em vez de a câmera e o corpo ficarem brigando.
- **Inspecionar a arma:** o giro ficou menor e mais perto do peito. As duas mãos ficam no cabo e na telha durante todo o movimento.
- **Celeiro e galpões:** as empenas (os triângulos das pontas) eram montadas tortas, com duas "orelhas" vermelhas saindo do telhado e um buraco embaixo. Agora são um triângulo exato que fecha com o telhado, em todos os mapas.

## Novidades da v3.0
- **Equipes no Battle Royale:** escolha **SOLO, DUPLA, TRIO, SQUAD (4)** ou **SQUAD 6** em JOGAR ou na sala.
  - Os amigos da sala ficam no mesmo time, e os bots completam o seu time e formam os times adversários.
  - Não existe fogo amigo, nem de tiro nem de granada.
  - Ganha o último time vivo. Se você cair e o time continuar vivo, a câmera acompanha um colega, e a vitória do time conta para você.
  - **Painel do time** no canto da tela, com número, nome e vida de cada um. Os colegas têm o nome em amarelo em cima da cabeça e aparecem no minimapa.
  - **Bots do seu time:**
    - pulam do avião logo depois de você e abrem o paraquedas junto;
    - andam perto de você e atiram em quem estiver atirando em você.
- **Grupo no lobby (como no Free Fire):**
  - O menu tem a barra **SEU GRUPO**: o **+** abre os amigos, e **CONVIDAR** chama o amigo para a sua sala.
  - Os amigos que entram aparecem **em pé ao seu lado no palco**, com o personagem e as skins deles e o nome em cima.
  - O anfitrião escolhe o tamanho do time, e todos começam a partida juntos.
- **Recarga de verdade por Pix** (no site com o servidor):
  - As gemas só entram depois que o **Mercado Pago confirma o pagamento**. O dinheiro cai na sua conta do Mercado Pago, e de lá você transfere por Pix para o seu banco.
  - O **modo de teste**, que dava gemas sem cobrar, foi **desligado**.
  - O servidor **recusa gemas que não foram pagas**: gemas editadas no celular voltam para o valor certo. Gemas só sobem com Pix confirmado, presente do dono pelo correio ou o prêmio de nível (+10 a cada 5 níveis).
  - **Como ligar:**
    1. Crie (ou use) sua conta no [Mercado Pago](https://www.mercadopago.com.br) com o **seu CPF**. É para essa conta que o dinheiro vai.
    2. Em **Seu negócio › Configurações › Credenciais** (ou em mercadopago.com.br/developers › Suas integrações › Criar aplicação), copie o **Access Token de produção** (começa com `APP_USR-`).
    3. Na hospedagem do servidor das contas, passe esse valor como `mpToken` (por exemplo, numa variável de ambiente `MP_ACCESS_TOKEN`).
    4. Pronto: na recarga aparece "Pagamento por Pix", com o QR Code e o copia-e-cola.
  - O CPF e a chave Pix **não vão no código** (o repositório é público). O que liga o jogo à sua conta é o Access Token, guardado só na hospedagem do servidor.
  - No app da Play Store, o Google exige o pagamento pelo **Google Play** para itens digitais. Antes de vender por lá, falta validar a compra no servidor.
- **Mais leve no celular:**
  - armas com material mais simples no celular e na qualidade Baixa/Média;
  - texturas de arma menores e um pouco menos de grama;
  - sombras redesenhadas a cada 2 quadros e resolução um pouco menor no celular;
  - se mesmo na menor resolução o jogo continuar travando, ele passa sozinho para a qualidade **Baixa**.

## Novidades da v2.9
- **Skins de arma** (loja › aba **ARMAS**). O dano é o mesmo; muda só o visual, na mão, nas costas e na câmera de 1ª pessoa. Paga com gemas **ou** com ouro, e toca de novo para voltar ao visual padrão.

  | Skin | Gemas | Ouro |
  |---|---|---|
  | **AK-47 Dourada** (ouro polido com arabescos gravados) | 150 | 8.000 |
  | AK-47 Dragão de Fogo (escamas que pulsam como brasa) | 180 | 9.500 |
  | AK-47 Gelo Ártico (cristal com brilho azul) | 130 | 7.000 |
  | Carabina Neon | 90 | 5.000 |
  | SMG Gelo Ártico | 80 | 4.500 |
  | Pistola Dourada | 60 | 3.500 |
  | Escopeta Carbono | 50 | 3.000 |
  | Precisão Camuflada | 40 | 2.500 |

  - O Fuzil de Assalto agora se chama **AK-47**. Quem já tinha o Fuzil Dourado ganhou a AK-47 Dourada.
  - Os amigos na sala veem as suas skins, e alguns bots também aparecem com skins.
- **Skins da parede de gel** (loja › aba **GEL**): Gelo Cristal, Ouro Real, Neon, Lava e Arco-Íris. As rachaduras dos tiros continuam aparecendo.
- **Vitrine na loja:** a arma ou a parede aparece grande no palco, girando. Arraste para girar e inspecionar.
- **Inspecionar a arma na partida:** tecla **I** ou o botão do olho na barra de armas. O personagem levanta a arma e mostra os dois lados, a câmera chega perto e aparece o nome da skin. Atirar, mirar, recarregar ou correr cancela.
- **Arma mais realista:** metal com microrrelevo (normal map), verniz e reflexo de estúdio. O metal brilha nas bordas em vez de ficar preto chapado.
- **Mira nova:**
  - a mira de cintura abre ao andar, pular e atirar, fecha agachado e fica **vermelha** em cima de um inimigo;
  - em Configurações › Controles dá para escolher o formato (cruz, ponto ou círculo) e a cor;
  - as retículas das miras foram redesenhadas;
  - a luneta tem retículo de precisão com marcas de distância, reflexo na lente e respiração (mais firme agachado).
- **Entrar com Google** (só com o servidor das contas ligado):
  1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie um projeto e configure a **Tela de consentimento OAuth** (tipo Externo, nome Battle Island).
  2. Em **Credenciais › Criar credenciais › ID do cliente OAuth**, escolha **Aplicativo da Web** e, em **Origens JavaScript autorizadas**, coloque o endereço do site do jogo (ex.: `https://SEU-SITE.com`).
  3. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`).
  4. Na hospedagem do servidor das contas, passe esse valor como `googleClientId` (por exemplo, numa variável de ambiente `GOOGLE_CLIENT_ID`).
  5. O botão **Continuar com o Google** aparece na tela de login. No perfil, quem já tem conta pode **ligar a conta Google** para entrar sem senha.
  - O servidor confere o login no próprio Google antes de aceitar.
- **Progresso que não se perde entre aparelhos:**
  - O **código de transferência**, gerado no site com servidor, também leva a sessão. O outro aparelho entra direto na conta do servidor.
  - Se o aparelho tem uma cópia com mais progresso (nível, XP, partidas), ela é juntada com a do servidor e nada volta para o nível 1. Itens comprados e cartas do correio das duas cópias ficam todos.
  - Ao reabrir o jogo, a conta importada continua aberta, mesmo sem a sessão do servidor.
  - O progresso é salvo na hora quando o app é fechado ou minimizado.
  - Use **sempre o mesmo link** (o site do jogo, com o servidor das contas) em todos os aparelhos. O arquivo HTML baixado e o link do claude.ai guardam as contas em lugares diferentes.

## Novidades da v2.8
- **Sala de espera (como no Free Fire):** antes do avião, todo mundo aparece numa área do mapa com uma arma aleatória e pistola, durante 20 segundos. Os tiros ali não machucam e os itens do chão ficam para depois do salto. Quando o tempo acaba, as armas somem e todos vão para o avião.
- **Avião novo:** cargueiro com fuselagem arredondada, cabine com janelas, asa alta afinada, 4 motores turbo-hélice com hélices girando, cauda em T, rampa de carga e pintura branca com faixas.
- **Paraquedas novo:** asa de células com espessura de verdade (perfil de asa e células infladas), painéis laterais, faixas coloridas, tecido com trama e 48 linhas até os tirantes. Ele vira junto com o personagem e balança.
- **Chão atravessando o piso:**
  - o terreno não pisca mais junto com pisos e praças na mesma altura;
  - dentro de construções feitas em morro, o terreno é rebaixado e o piso vale como chão.
- **Texturas mais nítidas:** filtro anisotrópico 8x no Média e no Alta, e texturas de chão e de construções com o dobro da resolução no Alta.
- A contagem do lobby antes da partida caiu de 15 para 5 segundos, porque agora existe a sala de espera.

## Novidades da v2.7
- **Servidor das contas** (`server/contas-core.mjs`):
  - qualquer pessoa que criar conta no site aparece no **painel do dono**, em "CRIADAS HOJE" e "TODAS";
  - login com a mesma senha em qualquer celular ou computador;
  - a senha fica só como hash scrypt, e cada login recebe um token de sessão;
  - o correio do dono, o ID novo e o verificado chegam no outro celular em até 30 segundos;
  - no painel, o botão **SENHA** troca a senha de quem esqueceu;
  - contas antigas, criadas só no aparelho, sobem para o servidor no primeiro login com a senha.
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
| `js/ui.js` | Câmera, HUD, telas, controles, carregamento e laço principal |## Novidades da v5.7

- Três mapas no estilo do Fúria Tropical (jogo do mesmo dono), com as peças dele (casas, hangar, farol, coqueiros, árvores, pedras, contêineres, cercas, guarda-sóis):
  - ILHA TROPICAL (padrão): praias com coqueiros e guarda-sóis, vilas coloridas, porto com hangar e contêineres, farol, lagoa e morro.
  - SAVANA SECA: terra vermelha, acácias e arbustos secos, povoados, fazenda, armazém e planalto; céu e luz quentes.
  - ARQUIPÉLAGO PÔR DO SOL: ilhas separadas por canais com pontes de madeira, muitas vilas, cais e farol; céu rosado e luz dourada.
- Sons do Fúria Tropical: tiro de cada arma, acerto, tiro na cabeça, abate, recarga, passos, explosão, itens, cura, vitória, derrota, zona e música do lobby (assets/sfx).

## Novidades da v5.6

- Megacidade corrigida: prédios menores que a quadra (com passagem entre eles, sem ficar um grudado no outro), postes finos no lugar dos postes gigantes, fonte nova com água no lugar da fonte enorme, e sem árvores nascendo dentro da cidade e da zona industrial.

## Novidades da v5.5

- Mapa novo MEGACIDADE (padrão), criado do zero no Godot (`godot_mapas/ferramentas/gerar_megacidade.gd` gera a cena `cenas/Megacidade.tscn`; `exportar_mapa.gd` grava `assets/mapa_megacidade.json`):
  - Centro: grade de ruas e quarteirões com prédios, praças e uma torre do relógio nova no meio.
  - Bairro residencial com casas e quintais, zona industrial (galpões de entrar, contêineres, silos e chaminé), porto (píer, guindaste e navio atracado) e base militar (muralha com portão, torres de vigia, bunkers, alojamentos e heliponto).
  - Avenidas ligando tudo, floresta, lago, morro e campo.
- O exportador do Godot agora leva caixas e cilindros (com cor e colisão), prédios de entrar e pontos de loot.
- Sem grama brotando no asfalto das cidades.

## Novidades da v5.4

- Metrópole com uma cidade grande e contínua em volta da Torre do Relógio, montada no editor Godot (pasta `godot_mapas/`, veja o LEIA-ME de lá): 286 peças entre ruas, cruzamentos, postes, prédios, garagens, praças, fontes e 18 prédios para entrar. O jogo lê `assets/mapa_cidade.json`, exportado pelo Godot.

## Novidades da v5.3

- Distritos da Metrópole refeitos com o kit de cidade da Kenney (modelos CC0, baixados de github.com/KenneyNL/Starter-Kit-City-Builder): ruas de asfalto com faixas, cruzamentos e postes, prédios e garagens coloridos, praças com fonte e árvores, e um prédio por quarteirão para entrar e pegar loot.

## Novidades da v5.2

- Mapa novo METRÓPOLE (padrão): ilha gigante com a Torre do Relógio no centro e quatro distritos de prédios de 2 a 5 andares (com escada até o terraço, praças e postes), mais pico, fábrica, hangar, usina, estaleiro, vilas, arrozais, lago e matas.

## Novidades da v5.1

- Miras das armas refeitas: red dot de tubo redondo (com anéis, lente e botões de ajuste) e holográfica com capô curvo, no lugar dos blocos quadrados.

## Novidades da v5.0

- Carro novo: esportivo com carroceria arredondada, vidros, rodas com aro cromado e pintura com verniz.
- Mapa padrão agora é a Ilha Triângulo (torre do relógio, pico, fábrica, hangar, usina, estaleiro, moinho e arrozais).

## Novidades da v4.9

- Carros na ilha (10 por partida): E/F perto do carro para dirigir, W/S acelera e freia, A/D vira, E ou Espaço sai. Atropelar machuca os inimigos.


