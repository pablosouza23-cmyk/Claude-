/* MKS Pizzaria — navegação, cardápio (filtro/busca/detalhe) e galeria. */
(function () {
  const M = window.MKS_MENU;
  const $ = (s, r = document) => r.querySelector(s);
  const brl = (n) => "R$ " + n.toFixed(2).replace(".", ",");

  // Garante que todo botão de pedido aponte para o cardápio oficial definido em data/menu.js
  if (M) document.querySelectorAll("[data-order]").forEach((a) => (a.href = M.orderUrl));
  $("#year").textContent = new Date().getFullYear();

  // ---- navegação ----
  const topbar = $("#topbar"), nav = $("#nav"), toggle = $("#menuToggle");
  const onScroll = () => topbar.classList.toggle("solid", window.scrollY > 30);
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  const setNav = (open) => {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open);
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  };
  toggle.addEventListener("click", () => setNav(!nav.classList.contains("open")));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setNav(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setNav(false); });

  if (!M || !Array.isArray(M.items)) {
    $("#menuGrid").innerHTML = '<p class="empty">Não foi possível carregar o cardápio. Use o botão "Ver cardápio completo e pedir".</p>';
    return;
  }

  // contagens da seção "sobre"
  const count = (f) => M.items.filter(f).length;
  document.querySelectorAll("[data-count]").forEach((n) => {
    const k = n.dataset.count;
    n.textContent = k === "pizzas" ? count((i) => /^(tradicionais|nobres|especiais)$/.test(i.category)) : count((i) => i.category === k);
  });

  // ---- cardápio ----
  const catLabel = Object.fromEntries(M.categories.map((c) => [c.id, c.label]));
  let current = "all", query = "";
  const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function cardHTML(i, idx) {
    const img = i.image
      ? `<div class="card-img"><img src="${i.image}" alt="${i.name}" width="245" height="180" loading="lazy"></div>`
      : `<div class="card-img ph" aria-hidden="true">${i.name.charAt(0)}</div>`;
    const price = typeof i.price === "number" ? `<span class="price">${brl(i.price)}</span>` : `<span class="no-price">Consulte o valor</span>`;
    return `<button class="card" type="button" data-id="${i.id}" aria-label="${i.name}, ver detalhes">${img}
      <span class="card-body"><h3>${i.name}</h3>${i.desc ? `<p>${i.desc}</p>` : ""}
      <span class="card-foot">${price}<span class="more">Detalhes →</span></span></span></button>`;
  }

  function renderMenu() {
    const q = norm(query);
    const list = M.items.filter((i) => (current === "all" || i.category === current) && (!q || norm(i.name + " " + (i.desc || "")).includes(q)));
    $("#menuGrid").innerHTML = list.map(cardHTML).join("");
    $("#empty").hidden = list.length > 0;
    const noPrice = list.some((i) => i.price == null);
    $("#menuNote").textContent = noPrice
      ? "Os valores das pizzas e seus tamanhos estão no cardápio oficial; use o botão de pedido para ver e escolher."
      : "";
  }

  const chips = $("#chips");
  chips.innerHTML = [{ id: "all", label: "Todos" }, ...M.categories]
    .map((c) => `<button class="chip" role="tab" type="button" data-cat="${c.id}" aria-selected="${c.id === "all"}">${c.label}</button>`).join("");
  chips.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    current = b.dataset.cat;
    chips.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-selected", x === b));
    renderMenu();
  });
  $("#search").addEventListener("input", (e) => { query = e.target.value; renderMenu(); });

  // ---- destaques (somente itens com foto e dado confirmado) ----
  const featured = ["calabresa", "portuguesa", "x-tudo", "batata-com-cheddar-e-bacon"];
  $("#featureGrid").innerHTML = featured.map((id) => M.items.find((i) => i.id === id)).filter(Boolean).map(cardHTML).join("");

  // ---- detalhe ----
  const modal = $("#modal");
  function openItem(id) {
    const i = M.items.find((x) => x.id === id); if (!i) return;
    $("#mTitle").textContent = i.name;
    $("#mCat").textContent = catLabel[i.category] || "";
    $("#mDesc").textContent = i.desc || "";
    $("#mPrice").textContent = typeof i.price === "number" ? brl(i.price) : "";
    const img = $("#mImg");
    if (i.image) { img.src = i.image; img.alt = i.name; img.hidden = false; } else img.hidden = true;
    $("#mFine").textContent = typeof i.price === "number"
      ? "Pedido e pagamento são feitos no cardápio oficial."
      : "Valor e tamanhos disponíveis no cardápio oficial. Pedido e pagamento são feitos lá.";
    if (typeof modal.showModal === "function") modal.showModal(); else modal.setAttribute("open", "");
  }
  const closeModal = () => (modal.close ? modal.close() : modal.removeAttribute("open"));
  document.addEventListener("click", (e) => { const c = e.target.closest(".card[data-id]"); if (c) openItem(c.dataset.id); });
  $("#modalClose").addEventListener("click", closeModal);
  $("#mBack").addEventListener("click", () => { closeModal(); $("#cardapio").scrollIntoView(); });
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  // ---- galeria ----
  $("#galleryGrid").innerHTML = M.gallery.map((g) => `<img src="${g.image}" alt="Pizza ${g.name} da MKS" width="245" height="180" loading="lazy">`).join("");

  renderMenu();
})();
