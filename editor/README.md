# Corte Livre — editor de vídeo grátis no navegador

Editor de vídeo **próprio, gratuito e de código aberto**, no estilo dos editores de celular (timeline, cortes, textos, filtros, música). HTML + CSS + JavaScript puro, sem build, sem dependências e sem servidor: **as mídias nunca saem do aparelho** e o vídeo exportado **não tem marca d'água**.

> Não contém código, efeitos, templates ou marcas de nenhum app comercial: tudo aqui foi escrito do zero.

## Como usar
Abra `editor/index.html` servindo a pasta (o navegador precisa de `http://` para gravar vídeo):
```bash
python3 -m http.server 8000   # http://localhost:8000/editor/
```
1. **+ Importar** (ou arraste arquivos): vídeos, fotos e músicas.
2. Toque no **+** de cada mídia para colocá-la na linha do tempo.
3. Edite: arraste as bordas para **cortar**, arraste o clipe para **reordenar**, **✂ Dividir** no cursor, selecione para mudar propriedades.
4. **Exportar** → baixa o vídeo (MP4 quando o navegador suporta, senão WebM).

## Recursos
| Área | O que faz |
|---|---|
| Vídeo/foto | cortar início/fim, dividir, duplicar, reordenar (arrastar ou ◀ ▶), velocidade 0,25x–4x, volume até 200% |
| Enquadramento | inteiro com fundo desfocado, barras pretas ou preencher a tela |
| Movimento | aproximar/afastar devagar e deslizar (efeito "Ken Burns" para fotos) |
| Cor | 8 filtros prontos + brilho, contraste e saturação |
| Transições | entre clipes: dissolver, passar pelo preto, deslizar, zoom, cortina (duração ajustável); fade in/out |
| Sobreposição | vídeo ou foto por cima (tela dentro da tela), tamanho, posição (arraste na prévia), opacidade, recorte redondo |
| Fundo verde | chroma key com cor e tolerância ajustáveis, com remoção do reflexo verde |
| Legendas automáticas | transcreve a fala no próprio aparelho (Whisper via transformers.js), em português, inglês, espanhol ou detecção automática; as legendas viram textos editáveis |
| Texto | títulos e legendas, 5 fontes, cor, contorno, fundo, posição (arraste na prévia) e animações (suave, pop, subir, digitando) |
| Áudio | trilhas de música posicionáveis, corte, volume, fade |
| Formatos | 16:9, 9:16 (Reels/TikTok/Shorts), 1:1, 4:5 |
| Geral | **salvamento automático** (o projeto reabre ao voltar), desfazer/refazer, atalhos, zoom da timeline, funciona no celular |

Atalhos: `Espaço` play/pausa · `S` dividir · `Delete` excluir · `Ctrl+D` duplicar · `Ctrl+Z` / `Ctrl+Shift+Z` · `←`/`→` quadro a quadro.

## Como funciona
| Arquivo | Conteúdo |
|---|---|
| `index.html` | Estrutura: barra, mídia, prévia, propriedades, linha do tempo, diálogo de exportação |
| `css/editor.css` | Tema escuro; grade no desktop, coluna no celular |
| `js/editor.js` | Estado do projeto, desenho da prévia no `<canvas>`, sincronia de `<video>`/`<audio>`, timeline, painel, exportação |

- **Prévia:** cada quadro é desenhado num `<canvas>` (mídia + filtros via `ctx.filter` + sobreposições + textos). Um relógio próprio dirige os `<video>`/`<audio>` e espera o vídeo carregar quando necessário. Cada item da linha do tempo tem seu próprio elemento de mídia, já posicionado antes de entrar em cena, o que permite transições entre dois trechos do mesmo arquivo.
- **Chroma key:** a sobreposição é processada pixel a pixel comparando a crominância (Cb/Cr) com a cor escolhida, com borda suave.
- **Salvamento:** projeto e arquivos ficam no IndexedDB do navegador (botão **Novo** apaga).
- **Legendas:** o áudio da linha do tempo é mixado em 16 kHz (`OfflineAudioContext`) e transcrito num Web Worker com o modelo Whisper. O modelo (40–250 MB) é baixado na primeira vez de `cdn.jsdelivr.net`/`huggingface.co` e fica em cache; o áudio nunca é enviado.
- **Áudio:** todo som passa pela Web Audio API (volume acima de 100% e mixagem para a exportação).
- **Exportação:** `canvas.captureStream()` + áudio mixado → `MediaRecorder`. É **em tempo real** (um vídeo de 1 minuto leva ~1 minuto); mantenha a aba visível.

## Limitações conhecidas
- Exportação em tempo real e no formato que o navegador oferece: Chrome/Edge geram MP4; Firefox gera WebM.
- Nas transições, o clipe anterior fica congelado no último quadro enquanto o próximo entra (não há sobreposição de tempo entre os dois).
- Uma sobreposição por vez não tem limite, mas muitas sobreposições com fundo verde ao mesmo tempo pesam em aparelhos fracos.
- Legendas automáticas precisam de internet só para baixar o modelo na primeira vez; vídeos longos levam alguns minutos para transcrever.
- O salvamento depende do espaço que o navegador libera; vídeos muito grandes podem não caber (o editor avisa).
