# Ilha Toon — recriação jogável do jogo de referência

Battle royale 3D em estilo desenho (cel-shading), em terceira pessoa, feito para rodar no **Chrome Android** (e também no computador). Usa HTML, CSS, JavaScript e Three.js (r160, incluído na pasta). Não tem etapa de build nem dependências para instalar.

Uma partida segue a ordem dos vídeos de referência: avião sobre a ilha, salto de prancha, paraquedas, pouso, saque de armas e equipamentos, zona segura fechando e combate até sobrar um jogador.

## Como jogar no celular
O jogo precisa ser aberto por um endereço `http(s)://`. Abrir o `index.html` direto do armazenamento do Android não funciona bem no Chrome.

- **GitHub Pages (recomendado):** no repositório, vá em *Settings → Pages*, escolha a branch e a pasta raiz (`/`) e salve. O jogo fica em `https://<usuario>.github.io/<repositorio>/jogo/`.
- **No computador, para testar:** `cd jogo && python3 -m http.server 8000` e abra `http://localhost:8000`. Para abrir no celular na mesma rede Wi-Fi, use `http://<ip-do-computador>:8000`.

Jogue com o celular na horizontal. Ao tocar em JOGAR, o jogo tenta entrar em tela cheia.

### Controles
| Momento | Celular | Computador |
|---|---|---|
| Avião | **SALTAR** | Espaço |
| Prancha | joystick ↑ acelera, ↓ freia, ←/→ vira; **PARAQUEDAS**; **SOLTAR PRANCHA** | W/S/A/D; Espaço abre o paraquedas; T solta a prancha |
| Paraquedas | joystick ↑ desce mais rápido, ↓ freia, ←/→ vira | W/S/A/D |
| Andar e olhar | lado esquerdo = joystick; lado direito = câmera | WASD + mouse (clique para travar o cursor; ` solta) |
| Atirar / socar | ✹ (arrastar o botão também gira a câmera) | clique esquerdo |
| Mira / luneta | ◎ | botão direito |
| Pular / agachar | ⤒ / ⤓ | Espaço / C |
| Recarregar | ⟳ | R |
| Gel (parede de gelo) | ▰ | G |
| Granada | ● pega a granada, ✹ lança, ● guarda | Q pega e guarda; clique lança |
| Kit médico | ✚ | 5 |
| Trocar arma | tocar nos slots 1/2/3 do canto superior direito; tocar no slot ativo = soco | 1 / 2 / 3, 4 = soco |
| Pegar arma / abrir suprimento | botão **PEGAR …** / **ABRIR SUPRIMENTO** | E |
| Pausa | II | Esc |

## 1. O que veio de cada vídeo
Os três vídeos foram analisados quadro a quadro.

### Vídeo 1 ("1 prompt o jogo ficou melhor que El Hero")
- **Visual e personagem:** estilo toon com contorno, ilha com grama alta, flores, trilhas de areia, árvores de tronco laranja e mar. Personagem de capuz vermelho, jaqueta com listras brancas, calça azul-marinho larga e tênis brancos.
- **Parede de gelo:** curva; racha onde leva tiro, mostra os números de dano "32", solta cubinhos e se quebra em cubos grandes.
- **HUD e sistemas:**
  - zona segura com contador;
  - "SUPRIMENTO AÉREO CAINDO! (fumaça vermelha)" e "ENTRANDO EM RUÍNAS";
  - feed "X ABATE Y (arma)" e "Colete Nv. 2 Equipado";
  - vida de 200.

### Vídeo 2 ("El Gato ficou impressionado…")
- **HUD:**
  - barra **HP 116 / 200 amarela**: a cor muda com a vida, verde → amarelo → laranja;
  - espaços **Nv.3** (colete) e **CAPACETE** ao lado da vida;
  - caixa da arma **"1 · M4A1 (ícone vermelho) · 180"** com borda dourada.
- **Granada:** faixa **"GRANADA NA MÃO · CLIQUE ESQ. LANÇA · [Q] GUARDA"**, trajetória amarela e explosão em desenho, com bolas amarelas e laranja e fumaça escura.
- **Luneta:** moldura escura arredondada, arma vermelha em primeira pessoa e número de dano vermelho/rosa ("33") com marcador de acerto rosa.
- **Mochila caída:** fica no chão com as armas de quem morreu.
- **Feed de abates:** traz as armas MP40, Woodpecker, M4A1 e M1014 e nomes como Tapioca, Maracujá, Sabiá, Açaí, Guaraná, Curupira, Cuscuz e Paçoca.
- Uma cena desse vídeo (muro de pedra, personagem de cabelo em chamas, planador laranja) é de **outro jogo**, mostrado em comparação. Ela **não** foi recriada.

### Vídeo 3 ("El Hero 2.0, novo jogo do El Gato feito por IA")
- **Avião:** **"PREPARE-SE"**, com "25 jogadores · armas, colete, capacete, kit e granada no chão", contagem **4…3…1**, "O avião está chegando na ilha…", **"VAI!"** e **"ESPAÇO para saltar"**. O avião é branco e laranja, de dupla hélice e asa alta.
- **Status no topo:** "no avião 20 · no ar 5 · saltaram 5/25" e "A zona segura **irá diminuir em** 00:53".
- **Salto de prancha:** o personagem de braços abertos sobre uma prancha ciano e rosa, com riscos de velocidade e o painel **"215 m · desce 12 m/s · anda 29 m/s"**. Embaixo, as dicas "W acelera · S freia · A/D vira · T solta a prancha · ESPAÇO abre o paraquedas", e uma barra de altitude à direita.
- **Paraquedas:** quadriculado vermelho e branco, com a dica "W acelera (desce mais rápido)".
- **Zona e mapa:** "ZONA MARCADA NO MAPA", com o círculo rosa visto do alto.
- **BAIRRO TROPICAL:** casas brancas com telhado de cerâmica laranja, faixa laranja na base, janelas azuis com venezianas e chaminé. Dá para entrar: piso laranja, cama azul e móveis. Há lixeiras verdes e coqueiros.
- **Slots no alto à direita:** **1 / 2 / 3** ("vazio"), a direção da bússola (ex.: "SE") e a dica "pegue uma arma".
- **Linha de teclas:** "Espaço pular · C agachar · Z deitar · F pegar/dirigir · E pegar · G gel · 5 kit · Q granada · 1/2 armas · 3 pistola · 4 soco · R recarregar".

## 2. O que foi implementado
**Fiel aos vídeos:**
- **Abertura e salto:**
  - avião, contagem, VAI! e o salto do jogador e dos bots;
  - prancha com controles de aceleração, freio e curva, painel de altitude e velocidade, barra de altitude e riscos de velocidade;
  - paraquedas quadriculado, que abre sozinho a 65 m.
- **Mapa:** Bairro Tropical com 11 casas em que dá para entrar (portas, janelas com venezianas, móveis, colisão e tiro pelas janelas). Também ficaram as Ruínas, a Floresta, o Campo Aberto e a Praia.
- **Armas e itens:**
  - slots 1 e 2 para armas principais, 3 para pistola e 4 para soco;
  - M4A1 e Woodpecker com luneta em primeira pessoa;
  - UMP, MP40, M1014 (espingarda com vários projéteis) e pistola;
  - granada com trajetória, quique e explosão que dá dano e quebra parede de gelo;
  - gel (parede de gelo);
  - colete e capacete de nível 1 a 3 (o capacete reduz o dano na cabeça);
  - kit médico;
  - mochila e armas que caem quando alguém morre.
- **HUD:**
  - status do salto e da partida, zona segura, bússola e slots de arma;
  - barra de vida com cor por faixa, espaços de colete e capacete;
  - faixa da granada, luneta, números de dano e marcador de acerto;
  - feed de abates, banner de área e linha de teclas (no computador).
- **25 jogadores:** você e 24 bots com nomes dos vídeos. Os bots saltam, escolhem onde pousar, procuram armas, lutam entre si e com você, usam gel e granada e se curam.
- Zona segura em 5 fases e suprimento aéreo com fumaça vermelha.

**Criações próprias** (os vídeos não mostram, mas o jogo precisava ter):
- Controles de toque e o layout dos botões.
- Minimapa (com a rota do avião), menu, pausa, tela de fim, sons sintetizados e o indicador da direção de onde veio o dano.
- Detalhes de balanceamento: dano das armas, vida da parede de gelo, tempos da zona etc.

**Não implementado:** deitar (Z) e veículos ("F pegar/**dirigir**"). Os vídeos citam essas funções na linha de teclas, mas nenhum veículo nem a posição deitada aparecem na tela. Todos os modelos, texturas e sons são gerados por código, sem recursos de terceiros além do Three.js (licença MIT, em `js/THREE_LICENSE.txt`).

## 3. Testes realizados
Os testes rodaram no Chromium em modo de celular (toque, telas 915×412 e 412×860), com Playwright:
- **Abertura:** contagem PREPARE-SE e VAI!, botão SALTAR, prancha, botão PARAQUEDAS, pouso.
- **Personagem:** um erro que deixava o personagem invisível depois do pouso (valor NaN na animação) foi encontrado e corrigido.
- **No chão:**
  - Bairro Tropical (banner, entrar na casa, câmera dentro da casa);
  - slots de arma por toque, luneta em primeira pessoa;
  - granada: lançar com um toque, explosão e dano;
  - barra de vida verde, amarela e laranja, colete e capacete, pegar arma.
- **Partida inteira simulada** (lógica acelerada, cerca de 5 min de jogo): todos saltam e pousam, 21 dos 24 bots se armam, 17 abates entre jogadores, a zona fecha nas 5 fases e a partida termina em vitória, sem erros. A lógica leva cerca de 0,25 ms por quadro, com no máximo 6 ms.
- **Desempenho:** cerca de 150 chamadas de desenho com 10 personagens perto. Cada parte do corpo agora é uma única malha, e contornos e sombras ficam desligados nos personagens distantes. Os testes não rodaram em um celular de verdade. Se o jogo ficar lento, use **Qualidade: Baixa** no menu.

## Estrutura
| Arquivo | Conteúdo |
|---|---|
| `index.html` | Página, HUD, controles de toque e menus |
| `css/game.css` | Estilo do HUD (horizontal e retrato) |
| `js/three.min.js` | Three.js r160 (MIT) |
| `js/util.js` | Ruído, materiais toon, contornos, mescla de geometrias |
| `js/world.js` | Terreno, vegetação, Ruínas, Bairro Tropical (casas com interior), céu, mar, grama, colisões e raios |
| `js/character.js` | Personagem, armas, prancha, paraquedas e animações |
| `js/effects.js` | Traçantes, fumaça, explosões, estilhaços de gelo, números de dano, sons |
| `js/game.js` | Avião e salto, jogador, câmera e luneta, armas, granada, gel, bots, zona, suprimento, loot, HUD, controles e menus |
