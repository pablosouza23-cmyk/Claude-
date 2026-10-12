> **Este repositório também contém o PH Cloud**, portal de jogos na nuvem, na pasta [`ph-cloud/`](ph-cloud/README.md). O site da pizzaria abaixo continua na raiz, sem alterações.

# MKS Pizzaria — site

Site estático (HTML + CSS + JavaScript puro, sem build e sem dependências) com cardápio digital, animação da pizza sendo montada na rolagem, galeria e acesso ao pedido oficial.

## Como ver / rodar
Abra `index.html` no navegador, ou sirva a pasta:
```bash
python3 -m http.server 8000   # http://localhost:8000
```

## Como publicar
Qualquer hospedagem estática serve (GitHub Pages, Netlify, Vercel, Cloudflare Pages): publique a pasta inteira. **O site ainda não está publicado.**

## Estrutura
| Caminho | Conteúdo |
|---|---|
| `index.html` | Página única (SEO básico, dados estruturados, acessibilidade) |
| `css/styles.css` | Estilos, responsivo, `prefers-reduced-motion` |
| `js/main.js` | Navegação, filtros, busca, detalhe do produto, galeria |
| `js/pizza.js` | Pizza montada na rolagem (SVG animado por progresso de scroll) |
| `data/menu.js` | **Dados do cardápio** (editar aqui) |
| `images/menu`, `images/hero` | Fotos recortadas das montagens enviadas (WebP) |
| `tools/prepare_images.py` | Script que gera as fotos individuais a partir de `tools/src_*.png` |

## O que foi extraído dos materiais enviados
- **Pizzas** (Tradicionais 15, Nobres 7, Especiais 28): nomes e ingredientes das capturas do cardápio.
- **Hambúrgueres (7) e Porções (5):** nomes, descrições e preços.
- **Fotos:** 30 pizzas, 7 hambúrgueres e 5 porções, recortadas das duas montagens de fotos.
- "Fazemos delivery" (consta no cardápio de hambúrgueres).

## O que NÃO foi possível confirmar (pendências)
1. **Preços e tamanhos das pizzas**: as capturas das pizzas enviadas não mostram valores (as miniaturas "Sabores Tradicionais/Doces/Especiais" com preços ficaram pequenas demais para ler). O site mostra "Consulte o valor". Para preencher: ponha `price` (e, se quiser, `sizes`) em `data/menu.js`.
2. **Bordas e adicionais**: não aparecem nos materiais, então não há seleção de borda/adicional (seria inventar).
3. **Cardápio oficial online** (`pedir.delivery`) e **Instagram**: não consegui acessá-los deste ambiente; usei só os links.
4. **Logotipo**: nenhum arquivo foi enviado; o site usa uma marca tipográfica "MKS Pizzaria" nas cores do cardápio. Envie o logo para substituir.
5. **Endereço, telefone/WhatsApp e horários**: não informados, portanto não aparecem.
6. **Pizzas doces** (Brigadeiro, Chocolate, Banana, Romeu e Julieta) e sabores fotografados sem texto no cardápio (Camarão, Costela, Carne Seca, Pepperoni, Vegetariana, Zé do Pipo etc.) aparecem só na **galeria**, sem ingredientes ou preço.
7. **Fotos ↔ itens**: só associei fotos a itens de mesmo nome (Americana, Atum, Bacon, Calabresa, 4 Queijos, Marguerita, Milho, Napolitana, Palmito, Portuguesa, Toscana; "Strogonoff" → Strogonoff de Carne). Os demais mostram um selo com a inicial.
8. As fotos originais são de baixa resolução (≈245 px por pizza); em telas grandes ficam suaves. Enviar os arquivos originais individuais melhora a qualidade.

## Inconsistências / observações
- X Salada, X Bacon e X Frango: a descrição no cardápio é igual à do X Burguer, mas as fotos mostram alface/tomate (X Salada) e bacon/frango. Mantive o texto do cardápio.
- Batata frita aparece como "19,50" sem "R$" na imagem; interpretado como R$ 19,50.
- Grafia "cheedar" nas capturas foi padronizada para "cheddar". Na pizza 4 Queijos a descrição não lista mussarela; mantido como está.
- Nas fotos, "Frango", "Moda da Casa" e "Especial da Casa" não têm correspondente exato no texto do cardápio.

## Verificação
A transcrição do cardápio foi conferida de forma independente contra as imagens enviadas: 50 pizzas, 7 hambúrgueres e 5 porções com nomes, ingredientes e preços batendo (divergências só de pontuação/grafia normalizadas). O código foi testado no Chromium (390 px e 1280 px, teclado, busca, modal, movimento reduzido); os problemas encontrados (modal exibindo foto do item anterior, menu mobile focável quando fechado, alvos de toque, busca com espaços, enquadramento de fotos etc.) foram corrigidos.

## Pedidos
Todos os botões "Fazer pedido / Pedir agora / Ver cardápio completo" abrem `https://pedir.delivery/app/mkspizzaria/menu` (definido em `data/menu.js` → `orderUrl`). **Não há carrinho, pagamento nem envio de pedido no site**; isso acontece somente na plataforma oficial. Não investiguei integração oficial por não ter acesso à plataforma.

## Animação da pizza
Montagem **ilustrativa** em SVG (massa → molho → mussarela → ingredientes → orégano) sincronizada com a rolagem; no fim a pizza "deita" em perspectiva e dá lugar à foto real da calabresa da MKS. Não foi possível montar com fotos reais por camadas (só há fotos da pizza pronta). Com "movimento reduzido" ativado, a seção vira uma lista estática com a foto final.
