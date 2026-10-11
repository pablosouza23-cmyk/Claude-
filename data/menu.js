/*
 * Dados do cardápio da MKS Pizzaria.
 * Fonte: capturas de tela do cardápio enviadas pelo cliente (pizzas: tradicionais/nobres/especiais;
 * hambúrgueres e porções com preços) + fotografias fornecidas.
 *
 * REGRAS: só existe aqui o que estava legível nos materiais. `price: null` = preço NÃO confirmado
 * (as capturas das pizzas enviadas não mostram preços). Para completar, edite este arquivo —
 * o site passa a exibir preço e tamanhos automaticamente quando `price` / `sizes` forem preenchidos.
 *
 * Campos: id, name, category, desc, price (número em R$ ou null), sizes (opcional: [{label, price}]),
 *         image (caminho ou null), note (opcional: observação interna exibida no README, não no site).
 */
(function () {
  const IMG = (n) => `images/menu/${n}.webp`;

  // Pizzas: todas as descrições começam com "molho da casa" nas capturas; "oregano" fecha a lista.
  const P = (id, name, category, desc, image) => ({ id, name, category, desc, price: null, image: image ? IMG(image) : null });

  window.MKS_MENU = {
    orderUrl: "https://pedir.delivery/app/mkspizzaria/menu",
    instagramUrl: "https://www.instagram.com/mks_pizzaria/",
    categories: [
      { id: "tradicionais", label: "Pizzas Tradicionais" },
      { id: "nobres", label: "Pizzas Nobres" },
      { id: "especiais", label: "Pizzas Especiais" },
      { id: "hamburgueres", label: "Hambúrgueres" },
      { id: "porcoes", label: "Porções" }
    ],
    items: [
      // ---- TRADICIONAIS ----
      P("americana", "Americana", "tradicionais", "Molho da casa, mussarela, gorgonzola, champignon, palmito e orégano", "pizza-americana"),
      P("atum", "Atum", "tradicionais", "Molho da casa, mussarela, atum e orégano", "pizza-atum"),
      P("bacon", "Bacon", "tradicionais", "Molho da casa, mussarela, bacon e orégano", "pizza-bacon"),
      P("calabresa", "Calabresa", "tradicionais", "Molho da casa, mussarela, calabresa e orégano", "pizza-calabresa"),
      P("cheddar", "Cheddar", "tradicionais", "Molho da casa, mussarela, cheddar e orégano"),
      P("champignon", "Champignon", "tradicionais", "Molho da casa, mussarela, champignon e orégano"),
      P("catupiry", "Catupiry", "tradicionais", "Molho da casa, mussarela, catupiry e orégano"),
      P("4-queijos", "4 Queijos", "tradicionais", "Molho da casa, gorgonzola, provolone, catupiry e orégano", "pizza-4-queijos"),
      P("frango-com-catupiry", "Frango com Catupiry", "tradicionais", "Molho da casa, mussarela, frango, catupiry e orégano"),
      P("marguerita", "Marguerita", "tradicionais", "Molho da casa, mussarela, tomate e orégano", "pizza-marguerita"),
      P("milho", "Milho", "tradicionais", "Molho da casa, mussarela, milho e orégano", "pizza-milho"),
      P("mussarela", "Mussarela", "tradicionais", "Molho da casa, mussarela, tomate e orégano"),
      P("napolitana", "Napolitana", "tradicionais", "Molho da casa, mussarela, tomate, parmesão ralado e orégano", "pizza-napolitana"),
      P("palmito", "Palmito", "tradicionais", "Molho da casa, mussarela, palmito e orégano", "pizza-palmito"),
      P("portuguesa", "Portuguesa", "tradicionais", "Molho da casa, mussarela, presunto, ovo, cebola e orégano", "pizza-portuguesa"),

      // ---- NOBRES ----
      P("imperial", "Imperial", "nobres", "Molho da casa, mussarela, frango, champignon, palmito, catupiry e orégano"),
      P("romanesca", "Romanesca", "nobres", "Molho da casa, mussarela, champignon, bacon, catupiry e orégano"),
      P("tomate-seco-do-chef", "Tomate Seco do Chef", "nobres", "Molho da casa, mussarela, tomate seco, escarola, bacon, cheddar, batata palha e orégano"),
      P("peruana", "Peruana", "nobres", "Molho da casa, mussarela, atum, ovo, cebola e orégano"),
      P("nachos", "Nachos", "nobres", "Molho da casa, mussarela, carne moída, pimentão, cheddar, nachos e orégano"),
      P("strogonoff-de-carne", "Strogonoff de Carne", "nobres", "Molho da casa, mussarela, carne, batata palha e orégano", "pizza-strogonoff"),
      P("strogonoff-invertido", "Strogonoff Invertido", "nobres", "Molho da casa, mussarela, carne, queijo por cima e orégano"),

      // ---- ESPECIAIS ----
      P("bacon-especial", "Bacon Especial", "especiais", "Molho da casa, mussarela, bacon, cheddar, catupiry e orégano"),
      P("bolonhesa", "Bolonhesa", "especiais", "Molho da casa, mussarela, carne moída, catupiry e orégano"),
      P("calabresa-caipira", "Calabresa Caipira", "especiais", "Molho da casa, mussarela, calabresa, bacon, ovo e orégano"),
      P("calabresa-do-chef", "Calabresa do Chef", "especiais", "Molho da casa, mussarela, calabresa, milho, ovo e orégano"),
      P("caliente", "Caliente", "especiais", "Molho da casa, mussarela, molho de pimenta e orégano"),
      P("cinco-queijos", "Cinco Queijos", "especiais", "Molho da casa, mussarela, gorgonzola, parmesão, provolone, catupiry e orégano"),
      P("portuguesa-especial", "Portuguesa Especial", "especiais", "Molho da casa, mussarela, presunto, ovo, bacon, tomate, cebola, azeitona e orégano"),
      P("canadense", "Canadense", "especiais", "Molho da casa, mussarela, lombinho, champignon, catupiry e orégano"),
      P("frango-com-cheddar", "Frango com Cheddar", "especiais", "Molho da casa, mussarela, frango, cheddar e orégano"),
      P("4-queijos-com-bacon", "4 Queijos com Bacon", "especiais", "Molho da casa, mussarela, gorgonzola, provolone, catupiry, bacon e orégano"),
      P("baiana", "Baiana", "especiais", "Molho da casa, mussarela, calabresa, cebola, molho de pimenta e orégano"),
      P("bolonhesa-com-cheddar", "Bolonhesa com Cheddar", "especiais", "Molho da casa, mussarela, carne moída, cheddar e orégano"),
      P("calabresa-especial", "Calabresa Especial", "especiais", "Molho da casa, mussarela, calabresa, palmito, milho, bacon e orégano"),
      P("calabresa-da-casa", "Calabresa da Casa", "especiais", "Molho da casa, mussarela, calabresa, palmito, cebola e orégano"),
      P("frango-palha", "Frango Palha", "especiais", "Molho da casa, mussarela, frango, batata palha e orégano"),
      P("jardineira", "Jardineira", "especiais", "Molho da casa, mussarela, frango, bacon, milho e orégano"),
      P("toscana", "Toscana", "especiais", "Molho da casa, mussarela, calabresa, salame italiano, catupiry e orégano", "pizza-toscana"),
      P("especial", "Especial", "especiais", "Molho da casa, mussarela, presunto, milho, ovo, bacon, azeitona e orégano"),
      P("mexicana", "Mexicana", "especiais", "Molho da casa, mussarela, calabresa, pimentão, molho de pimenta e orégano"),
      P("escarola", "Escarola", "especiais", "Molho da casa, mussarela, escarola, bacon, catupiry e orégano"),
      P("frango-com-bacon", "Frango com Bacon", "especiais", "Molho da casa, mussarela, frango, bacon e orégano"),
      P("frango-com-palmito", "Frango com Palmito", "especiais", "Molho da casa, mussarela, frango, palmito e orégano"),
      P("italiana-4-queijos", "Italiana 4 Queijos", "especiais", "Molho da casa, mussarela, gorgonzola, provolone, salame italiano, catupiry e orégano"),
      P("lombinho-com-catupiry", "Lombinho com Catupiry", "especiais", "Molho da casa, mussarela, lombinho, catupiry e orégano"),
      P("da-casa", "Da Casa", "especiais", "Molho da casa, mussarela, presunto, calabresa, milho, bacon, ovo, azeitona e orégano"),
      P("siciliana", "Siciliana", "especiais", "Molho da casa, mussarela, lombinho, tomate, cheddar, catupiry e orégano"),
      P("crocante", "Crocante", "especiais", "Molho da casa, mussarela, bacon, batata palha e orégano"),
      P("pizzaiolo", "Pizzaiolo", "especiais", "Molho da casa, mussarela, atum, palmito, calabresa, milho e orégano"),

      // ---- HAMBÚRGUERES (preços do cardápio fornecido) ----
      { id: "x-burguer", name: "X Burguer", category: "hamburgueres", desc: "Maionese, presunto, queijo, hambúrguer", price: 12, image: IMG("x-burguer") },
      { id: "x-salada", name: "X Salada", category: "hamburgueres", desc: "Maionese, presunto, queijo, hambúrguer", price: 12, image: IMG("x-salada") },
      { id: "x-bacon", name: "X Bacon", category: "hamburgueres", desc: "Maionese, presunto, queijo, hambúrguer", price: 15, image: IMG("x-bacon") },
      { id: "x-frango", name: "X Frango", category: "hamburgueres", desc: "Maionese, presunto, queijo, hambúrguer", price: 15, image: IMG("x-frango") },
      { id: "x-egg", name: "X Egg", category: "hamburgueres", desc: "Maionese, presunto, queijo, hambúrguer, alface, tomate e ovo", price: 15, image: IMG("x-egg") },
      { id: "x-tudo", name: "X Tudo", category: "hamburgueres", desc: "Maionese, presunto, queijo, hambúrguer, alface, tomate, calabresa, frango, bacon e ovo", price: 19, image: IMG("x-tudo") },
      { id: "x-calabresa", name: "X Calabresa", category: "hamburgueres", desc: "Maionese, presunto, queijo, hambúrguer, alface, tomate, calabresa", price: 15, image: IMG("x-calabresa") },

      // ---- PORÇÕES ----
      { id: "batata-frita", name: "Batata frita", category: "porcoes", desc: null, price: 19.5, image: IMG("batata-frita") },
      { id: "batata-com-bacon", name: "Batata c/ bacon", category: "porcoes", desc: null, price: 22, image: IMG("batata-com-bacon") },
      { id: "batata-com-cheddar-e-bacon", name: "Batata c/ cheddar e bacon", category: "porcoes", desc: null, price: 24, image: IMG("batata-com-cheddar-e-bacon") },
      { id: "batata-com-queijo", name: "Batata com queijo", category: "porcoes", desc: null, price: 22, image: IMG("batata-com-queijo") },
      { id: "batata-cheddar", name: "Batata cheddar", category: "porcoes", desc: null, price: 22, image: IMG("batata-cheddar") }
    ],

    // Fotos da galeria: todas as pizzas fotografadas (inclusive as que não aparecem nas capturas de texto do cardápio).
    gallery: [
      ["americana", "Americana"], ["atum", "Atum"], ["bacon", "Bacon"], ["calabresa", "Calabresa"], ["frango", "Frango"],
      ["4-queijos", "4 Queijos"], ["presunto", "Presunto"], ["portuguesa", "Portuguesa"], ["marguerita", "Marguerita"], ["milho", "Milho"],
      ["moda-da-casa", "Moda da Casa"], ["vegetariana", "Vegetariana"], ["pepperoni", "Pepperoni"], ["napolitana", "Napolitana"], ["strogonoff", "Strogonoff"],
      ["palmito", "Palmito"], ["brigadeiro", "Brigadeiro"], ["romeu-e-julieta", "Romeu e Julieta"], ["chocolate", "Chocolate"], ["banana", "Banana"],
      ["caipira", "Caipira"], ["camarao", "Camarão"], ["carne-seca", "Carne Seca"], ["alho-e-oleo", "Alho e Óleo"], ["toscana", "Toscana"],
      ["ze-do-pipo", "Zé do Pipo"], ["costela", "Costela"], ["lombo", "Lombo"], ["especial-da-casa", "Especial da Casa"], ["quatro-estacoes", "Quatro Estações"]
    ].map(([slug, name]) => ({ name, image: IMG("pizza-" + slug) }))
  };
})();
