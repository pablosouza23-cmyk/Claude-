# Ilha Toon — recriação jogável do jogo de referência

Jogo de batalha em 3D, estilo desenho (cel-shading), em terceira pessoa, feito para rodar no **Chrome Android** (e também no computador). Usa HTML, CSS, JavaScript e Three.js (r160, incluído na pasta). Não tem etapa de build nem dependências para instalar.

## Como jogar no celular
O jogo precisa ser aberto por um endereço `http(s)://`. Abrir o `index.html` direto do armazenamento do Android não funciona bem no Chrome.

- **GitHub Pages (recomendado):** no repositório, vá em *Settings → Pages*, escolha a branch e a pasta raiz (`/`) e salve. O jogo fica em `https://<usuario>.github.io/<repositorio>/jogo/`.
- **No computador, para testar:** `cd jogo && python3 -m http.server 8000` e abra `http://localhost:8000`. Para abrir no celular na mesma rede Wi-Fi, use `http://<ip-do-computador>:8000`.

Dica: jogue com o celular na horizontal. Ao tocar em JOGAR, o jogo tenta entrar em tela cheia.

### Controles
| Celular | Computador | Ação |
|---|---|---|
| Arrastar no lado esquerdo (joystick) | WASD / setas | Andar |
| Arrastar no lado direito | Mouse (clique na tela para travar o cursor) | Girar a câmera |
| ✹ (segurar; arrastar o próprio botão também gira a câmera) | Clique esquerdo | Atirar |
| ◎ | Botão direito / F | Mirar (aproxima a câmera) |
| ⤒ | Espaço | Pular |
| ⟳ | R | Recarregar |
| ▰ (ou o espaço ▰ ao lado da vida) | Q | Parede de gelo |
| ✚ ao lado da vida | H | Kit médico (+75 HP) |
| ABRIR (aparece perto do suprimento) | E | Abrir suprimento aéreo |
| II | Esc | Pausar |

## 1. Análise do vídeo de referência
O vídeo tem 26 s, é vertical (720×1280), e a imagem do jogo ocupa a metade de baixo (em cima aparece a webcam do apresentador). Os quadros foram examinados segundo a segundo.

### O que dá para confirmar vendo o vídeo
- **Estilo visual:** 3D toon/cel-shading com contorno preto nos objetos. Céu azul com nuvens grandes e fofas (com sombra rosada). Grama alta e densa, flores brancas e rosas, trilhas e manchas de areia, mar no horizonte, coqueiros ao longe.
- **Vegetação:** árvores de copa larga, verde-clara, em tufos, com tronco laranja-amarronzado e galhos; arbustos redondos.
- **Construções:** blocos baixos de pedra bege e um pilar claro na área chamada **RUÍNAS**.
- **Câmera:** terceira pessoa, atrás do personagem e um pouco acima do ombro. O personagem fica à esquerda do centro e a mira no centro.
- **Personagem:** capuz vermelho, jaqueta vermelha com listras brancas nas mangas, calça larga azul-marinho com costura branca, tênis brancos, mochila, uma arma amarela presa nas costas na diagonal e uma arma amarela/laranja nas mãos. Animações de corrida e de mira.
- **Parede de gelo:** parede curva, branca/azul-clara, com contorno. Os tiros abrem **rachaduras escuras e ramificadas** no ponto do impacto, soltam **cubinhos de gelo**, mostram **números de dano "32"** empilhados e, no fim, a parede **se quebra em cubos grandes** que caem no chão.
- **HUD:**
  - bússola no topo, com pontos cardeais (N, NE, L…) e o número do rumo;
  - faixa "⌛ A zona segura está diminuindo 00:31" com contagem regressiva;
  - aviso "SUPRIMENTO AÉREO CAINDO! (fumaça vermelha)";
  - faixa "ENTRANDO EM / RUÍNAS";
  - caixa da arma no canto superior direito ("1", "UMP", ícone laranja, "60");
  - barra "HP 46 / 200" laranja embaixo, com dois espaços de item à direita;
  - feed de abates no centro ("Coxinha ABATE Pastel (AK)", "Quindim ABATE Jabuti (MP5)", "BotoRosa ABATE TatuBola (Granada)");
  - mensagem "Colete Nv. 2 Equipado";
  - mira em círculo laranja tracejado ao mirar.
- **Sistemas que aparecem:** zona segura que diminui, suprimento aéreo marcado por fumaça vermelha, coletes por nível, vida máxima de 200, outros jogadores com nomes de comidas e animais brasileiros abatendo uns aos outros, e áreas do mapa com nome.

### O que o vídeo não mostra (não dá para confirmar)
- **Controles:** não aparece joystick nem botões de toque. Pela caixa da arma cortada na borda, o vídeo parece ser um recorte de uma tela horizontal. Os controles de toque daqui são uma criação própria.
- **Inimigos:** nenhum aparece na tela, só no feed de abates. Não dá para saber a aparência deles, a IA ou o tamanho da partida.
- **Menus, tela inicial, fim de partida, minimapa, som, mapa completo, outras áreas além de Ruínas** e quantos tiros a parede aguenta.
- **O "60" da caixa da arma:** não dá para saber se é o pente ou o total de munição. Aqui o pente da UMP tem 30 balas e a reserva aparece ao lado.

## 2. O que foi implementado
**Fiel ao vídeo:**
- Cenário toon com árvores, coqueiros, arbustos, grama animada pelo vento, flores, trilhas de areia, mar, céu em degradê e nuvens.
- Área RUÍNAS com blocos baixos (dá para subir neles) e pilares.
- Personagem com o mesmo visual descrito acima, animado por código (corrida, mira, pulo e queda).
- Câmera sobre o ombro, que não atravessa obstáculos.
- UMP com 32 de dano, tiro contínuo, recuo, traçante, clarão no cano e recarga.
- Parede de gelo curva: sobe do chão, bloqueia tiros e movimento, racha onde o tiro acerta, solta lascas, mostra números de dano e se quebra em cubos com física (gravidade e quique).
- HUD com bússola, faixa da zona, aviso de suprimento, banner "ENTRANDO EM", caixa da arma, barra de HP x/200, dois espaços de item, feed "X ABATE Y (arma)" e mensagem "Colete Nv. N Equipado".
- Zona segura que diminui em 5 fases, com dano fora dela.
- Suprimento aéreo que cai de paraquedas e solta fumaça vermelha.
- Coletes Nv. 1, 2 e 3 que reduzem o dano.
- 11 adversários com os nomes do vídeo (Coxinha, Pastel, Quindim, Jabuti, BotoRosa, TatuBola) e outros no mesmo tema.

**Criações próprias** (o vídeo não mostra, mas o jogo precisava ter):
- Controles de toque e de teclado/mouse.
- IA dos adversários: andam pela zona, pegam loot, trocam tiros entre si e com você, usam parede de gelo quando estão com pouca vida e se curam.
- Itens no chão (kit médico, munição, parede de gelo) com coleta automática.
- Minimapa, contador de vivos e abates, indicador da direção de onde veio o dano.
- Menu (nome, qualidade gráfica, sensibilidade, som, FPS), pausa e tela de fim (VITÓRIA! ou VOCÊ FOI ABATIDO, com colocação, abates, dano e tempo).
- Áreas extras: VILA DO CAJU (casas), FLORESTA, CAMPO ABERTO e PRAIA. Sons sintetizados simples.
- O feed do vídeo mostra um abate com "Granada". Granadas **não** foram implementadas, por isso esse tipo de abate não aparece aqui.

Todos os modelos, texturas e sons são gerados por código neste projeto, sem recursos de terceiros além do Three.js (licença MIT, em `js/THREE_LICENSE.txt`).

## 3. Testes realizados
Os testes rodaram no Chromium em modo de celular (toque, telas 915×412 e 412×860), com Playwright:
- **Abertura e menu:** a tela inicial aparece e o JOGAR inicia a partida sem erros no console.
- **Cenário:** terreno, vegetação, ruínas, vila, mar, céu e grama carregam.
- **Toque:** o joystick move o personagem, arrastar na direita gira a câmera, e os botões de tiro, mira, pular, recarregar, parede de gelo, kit, abrir, pausa e continuar funcionam. Foi corrigido um bug em que a camada de toque bloqueava o botão de pausa e os espaços de item.
- **Movimento e colisões:** árvores, blocos, casas, paredes de gelo e o limite da ilha bloqueiam o personagem. Dá para subir em blocos baixos.
- **Tiro e parede de gelo:** a parede racha, mostra os números 32 e quebra em cubos após cerca de 15 tiros.
- **Sistemas:** o banner "ENTRANDO EM RUÍNAS", a queda do suprimento com fumaça e a abertura dele (Colete Nv. 3, kits, paredes, munição), o combate com bot (o bot detecta e atira), a morte, a tela de fim e o "jogar novamente".
- **Partida inteira simulada** (lógica acelerada, cerca de 5 min de jogo): a zona fecha nas 5 fases, os bots se abatem e morrem na zona, e a partida termina em vitória, sem erros. A lógica leva cerca de 0,3 ms por quadro.
- **Desempenho:** cerca de 320 chamadas de desenho por quadro. Estão ativos a grama instanciada, a vegetação instanciada, os contornos e sombras desligados nos bots distantes, e o ajuste de qualidade (Baixa / Média / Alta). Os testes não rodaram em um celular de verdade. Se o jogo ficar lento, use **Qualidade: Baixa** no menu.

## Estrutura
| Arquivo | Conteúdo |
|---|---|
| `index.html` | Página, HUD, controles de toque e menus |
| `css/game.css` | Estilo do HUD e das telas (horizontal e retrato) |
| `js/three.min.js` | Three.js r160 (MIT) |
| `js/util.js` | Ruído, materiais toon, contornos, mescla de geometrias |
| `js/world.js` | Terreno, vegetação, ruínas, vila, céu, mar, grama, colisões e raios |
| `js/character.js` | Modelo e animação do personagem |
| `js/effects.js` | Traçantes, fumaça, estilhaços de gelo, números de dano, sons |
| `js/game.js` | Jogador, câmera, tiro, parede de gelo, bots, zona, suprimento, loot, HUD, entrada e menus |
