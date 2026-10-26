'use strict';
// Amigos: cada jogador logado fica "visível" na rede pelo próprio ID (PeerJS, o mesmo serviço das salas).
// Assim dá para mandar pedido de amizade, ver quem está on-line e convidar para a sala, sem servidor próprio.
// Limite: pedidos e convites só chegam se o amigo estiver com o jogo aberto.
const FR = { peer: null, open: false, online: {}, pend: {}, tab: 'amigos', myId: null };
FR.pid = (id) => NET.PREFIX + 'u' + id;
FR.info = () => ({ id: ACC.p.id, name: ACC.p.name, lvl: ACC.p.level, vf: !!ACC.p.verified, skin: ACC.p.skin });
FR.list = () => ACC.p.friends;
FR.isFriend = (id) => !!ACC.p && ACC.p.friends.some(f => f.id === id);

FR.start = function () {
  if (!ACC.p || typeof Peer === 'undefined' || !NET.available()) return;
  if (FR.peer && FR.myId === ACC.p.id && !FR.peer.destroyed) return;
  FR.stop();
  FR.myId = ACC.p.id;
  const peer = new Peer(FR.pid(ACC.p.id), NET.peerOpts());
  FR.peer = peer;
  peer.on('open', () => { FR.open = true; FR.render(); FR.refresh(); });
  peer.on('connection', (c) => c.on('data', (d) => FR.recv(c, d)));
  peer.on('error', (e) => {
    if (e.type === 'peer-unavailable') {
      // "Could not connect to peer <id>": quem não respondeu está off-line
      const m = /peer\s+(\S+)/i.exec(e.message || '');
      if (m && FR.pend[m[1]]) FR.pend[m[1]]();
    } else if (e.type === 'unavailable-id') FR.status = 'Sua conta já está aberta em outra aba ou aparelho.';
    else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') FR.status = 'Sem conexão com o serviço de amigos.';
    FR.render();
  });
  peer.on('disconnected', () => { FR.open = false; setTimeout(() => { try { if (FR.peer === peer && !peer.destroyed) peer.reconnect(); } catch (e) { /* tenta depois */ } }, 3000); });
  clearInterval(FR.iv);
  FR.iv = setInterval(() => { if (G.state !== 'play') FR.refresh(); }, 45000);
};
FR.stop = function () {
  clearInterval(FR.iv);
  if (FR.peer) try { FR.peer.destroy(); } catch (e) { /* ok */ }
  FR.peer = null; FR.open = false; FR.online = {}; FR.myId = null;
};

// abre conexão com o amigo, manda a mensagem e espera resposta curta (resolve true se ele estava on-line)
FR.send = function (id, msg) {
  return new Promise((res) => {
    if (!FR.open || !FR.peer) { res(false); return; }
    const target = FR.pid(id);
    let done = false, to = 0, c = null;
    const fin = (ok) => { if (done) return; done = true; clearTimeout(to); delete FR.pend[target]; res(ok); };
    FR.pend[target] = () => fin(false);
    to = setTimeout(() => { try { c.close(); } catch (e) { /* ok */ } fin(false); }, 8000);
    try { c = FR.peer.connect(target, { reliable: true }); } catch (e) { fin(false); return; }
    c.on('open', () => {
      c.on('data', (d) => FR.recv(c, d));
      c.send(Object.assign({ from: FR.info() }, msg));
      setTimeout(() => { try { c.close(); } catch (e) { /* ok */ } }, 5000);
      fin(true);
    });
    c.on('error', () => fin(false));
  });
};

// atualiza o cartão do amigo com o que ele mandou (nome, nível, selo, personagem)
FR.touch = function (info) {
  const f = ACC.p && ACC.p.friends.find(x => x.id === info.id);
  if (!f) return;
  f.name = String(info.name || f.name).slice(0, 14); f.lvl = info.lvl | 0; f.vf = !!info.vf; f.skin = info.skin || f.skin;
};
FR.recv = function (c, d) {
  if (!ACC.p || !d || !d.from || !d.from.id) return;
  const from = d.from, p = ACC.p;
  switch (d.t) {
    case 'ping':
      c.send({ t: 'pong', from: FR.info(), room: NET.on() && NET.isHost() && !NET.live ? NET.code : null, busy: G.state === 'play' });
      if (FR.isFriend(from.id)) { FR.online[from.id] = { t: Date.now() }; FR.touch(from); }
      break;
    case 'pong':
      FR.online[from.id] = { t: Date.now(), room: d.room, busy: d.busy };
      FR.touch(from); ACC.save();
      break;
    case 'req':
      if (FR.isFriend(from.id)) { c.send({ t: 'acc', from: FR.info() }); break; }
      if (p.fsent.indexOf(from.id) >= 0) { FR.addFriend(from); c.send({ t: 'acc', from: FR.info() }); notify('ok', from.name + ' agora é seu amigo!'); break; }
      if (!p.freq.some(r => r.id === from.id)) { p.freq.unshift(Object.assign({ t: Date.now() }, from)); ACC.emit(); notify('info', from.name + ' quer ser seu amigo'); }
      break;
    case 'acc':
      if (p.fsent.indexOf(from.id) >= 0 || p.freq.some(r => r.id === from.id)) { FR.addFriend(from); notify('ok', from.name + ' aceitou seu pedido de amizade!'); }
      break;
    case 'dec':
      p.fsent = p.fsent.filter(x => x !== from.id); ACC.emit();
      break;
    case 'rm':
      p.friends = p.friends.filter(f => f.id !== from.id); ACC.emit();
      break;
    case 'inv':
      if (!FR.isFriend(from.id) || !d.code) break;
      FR.invited(from, d);
      break;
  }
  FR.render();
};
FR.addFriend = function (info) {
  const p = ACC.p;
  p.fsent = p.fsent.filter(x => x !== info.id);
  p.freq = p.freq.filter(r => r.id !== info.id);
  if (!p.friends.some(f => f.id === info.id)) p.friends.push({ id: info.id, name: String(info.name || 'Amigo').slice(0, 14), lvl: info.lvl | 0, vf: !!info.vf, skin: info.skin || 'heroi', since: Date.now() });
  FR.online[info.id] = { t: Date.now() };
  ACC.emit();
};

// ---------- ações ----------
FR.request = async function (id) {
  id = String(id || '').trim();
  if (!/^\d{1,10}$/.test(id)) return 'Digite o ID do jogador (só números).';
  if (id === ACC.p.id) return 'Esse é o seu ID.';
  if (FR.isFriend(id)) return 'Vocês já são amigos.';
  if (!FR.open) return 'Sem conexão com o serviço de amigos. Verifique a internet.';
  const ok = await FR.send(id, { t: 'req' });
  if (!ok) return 'Jogador off-line ou ID não existe. O amigo precisa estar com o jogo aberto para receber o pedido.';
  if (ACC.p.fsent.indexOf(id) < 0) ACC.p.fsent.push(id);
  ACC.emit();
  return null;
};
FR.accept = function (id) {
  const r = ACC.p.freq.find(x => x.id === id);
  if (!r) return;
  FR.addFriend(r);
  FR.send(id, { t: 'acc' });
  notify('ok', r.name + ' agora é seu amigo!');
};
FR.decline = function (id) {
  ACC.p.freq = ACC.p.freq.filter(x => x.id !== id); ACC.emit();
  FR.send(id, { t: 'dec' });
};
FR.remove = function (id) {
  ACC.p.friends = ACC.p.friends.filter(f => f.id !== id); delete FR.online[id]; ACC.emit();
  FR.send(id, { t: 'rm' });
};
FR.refresh = function () {
  if (!FR.open || !ACC.p) return;
  for (const f of ACC.p.friends) {
    FR.online[f.id] = Object.assign({}, FR.online[f.id] || {}, { checking: true });
    FR.send(f.id, { t: 'ping' }).then((ok) => {
      const o = FR.online[f.id] || {};
      o.checking = false;
      if (!ok) { o.t = 0; o.room = null; }
      FR.online[f.id] = o;
      FR.render();
    });
  }
  FR.render();
};
FR.isOnline = (id) => { const o = FR.online[id]; return !!(o && o.t && Date.now() - o.t < 120000); };
// convidar: cria a sala se ainda não houver e manda o código para o amigo
FR.invite = function (id) {
  const f = ACC.p.friends.find(x => x.id === id);
  const go = () => FR.send(id, { t: 'inv', code: NET.code, gm: NET.gm, gs: NET.gs, bt: NET.bt }).then(ok => notify(ok ? 'ok' : 'info', ok ? 'Convite enviado para ' + f.name : f.name + ' está off-line'));
  if (NET.on() && NET.code && NET.isHost()) { go(); return; }
  if (NET.isClient()) { notify('info', 'Só o anfitrião da sala pode convidar'); return; }
  NET.createRoom(); openRoom();
  let n = 0;
  const wait = setInterval(() => {
    if (NET.code && NET.peer && NET.peer.open) { clearInterval(wait); go(); }
    else if (++n > 40) { clearInterval(wait); notify('info', 'Não deu para criar a sala agora'); }
  }, 250);
};
FR.invited = function (from, d) {
  const mode = d.gm === 'cs' ? 'Contra Squad ' + (d.gs || 4) + 'x' + (d.gs || 4) : 'Battle Royale · ' + TEAM.label(TEAM.size(d.bt || 1));
  if (G.state === 'play') { notify('info', from.name + ' te convidou para a sala ' + d.code); return; }
  SND.play('pick');
  LOB.dialog('CONVITE', '<b>' + escapeHTML(from.name) + '</b>' + (from.vf ? VERIFIED_SVG : '') + ' te chamou para jogar<br><small>' + mode + ' · sala ' + escapeHTML(d.code) + '</small>',
    [['ENTRAR NA SALA', () => { if (NET.on()) NET.leave(); LOB.joinLink(d.code); }, true], ['AGORA NÃO']]);
};

// ---------- tela ----------
FR.openScr = function (tab) {
  FR.tab = tab || (ACC.p.freq.length ? 'pedidos' : 'amigos');
  FR.from = UI.screen;
  showScreen('friendsScr');
  FR.start();
  FR.refresh();
  FR.render();
};
FR.close = function () { if (FR.from === 'roomScr' && NET.on()) openRoom(); else goMenu(); };
FR.render = function () {
  if (UI.screen === 'menuScr' && typeof LOB !== 'undefined') LOB.renderFriendBadge();
  if (UI.screen !== 'friendsScr' || !ACC.p) return;
  const p = ACC.p, tab = FR.tab;
  document.querySelectorAll('#frTabs button').forEach(b => {
    b.classList.toggle('on', b.dataset.t === tab);
    if (b.dataset.t === 'pedidos') b.innerHTML = 'PEDIDOS' + (p.freq.length ? ' <em class="badgeN inline">' + p.freq.length + '</em>' : '');
    if (b.dataset.t === 'amigos') b.textContent = 'AMIGOS (' + p.friends.length + ')';
  });
  $('frStatus').className = 'frStatus ' + (FR.open ? 'on' : 'off');
  $('frStatus').textContent = FR.open ? 'On-line · seu ID ' + p.id : (FR.status || 'Conectando…');
  const body = $('frBody');
  const avatar = (f) => '<i class="frAv" style="background-image:url(' + (LOB.thumbs[f.skin] || '') + ')"></i>';
  if (tab === 'amigos') {
    const list = p.friends.slice().sort((a, b) => (FR.isOnline(b.id) ? 1 : 0) - (FR.isOnline(a.id) ? 1 : 0));
    body.innerHTML = list.length ? list.map(f => {
      const o = FR.online[f.id] || {}, on = FR.isOnline(f.id);
      const st = o.checking && !on ? 'verificando…' : on ? (o.busy ? 'em partida' : o.room ? 'na sala ' + o.room : 'on-line') : 'off-line';
      return '<div class="frRow">' + avatar(f) + '<div class="frId"><b>' + escapeHTML(f.name) + (f.vf ? VERIFIED_SVG : '') + '</b><small>NV ' + (f.lvl || 1) + ' · ID ' + f.id + '</small></div>' +
        '<span class="frSt ' + (on ? 'on' : '') + '"><i></i>' + st + '</span>' +
        (on && o.room && !NET.on() ? '<button class="chip" data-join="' + o.room + '">ENTRAR</button>' : '') +
        '<button class="chip hot" data-inv="' + f.id + '"' + (on ? '' : ' disabled') + '>' + icon('users') + 'CONVIDAR</button>' +
        '<button class="chip" data-rm="' + f.id + '" aria-label="Remover amigo">' + icon('trash') + '</button></div>';
    }).join('') : '<p class="hint frEmpty">Você ainda não tem amigos aqui. Toque em ADICIONAR e digite o ID de um amigo.</p>';
  } else if (tab === 'pedidos') {
    body.innerHTML = (p.freq.length ? p.freq.map(r => '<div class="frRow">' + avatar(r) + '<div class="frId"><b>' + escapeHTML(r.name) + (r.vf ? VERIFIED_SVG : '') + '</b><small>NV ' + (r.lvl || 1) + ' · ID ' + r.id + '</small></div>' +
      '<button class="chip hot" data-acc="' + r.id + '">ACEITAR</button><button class="chip" data-dec="' + r.id + '">RECUSAR</button></div>').join('') : '<p class="hint frEmpty">Nenhum pedido de amizade.</p>') +
      (p.fsent.length ? '<p class="hint">Pedidos enviados, esperando resposta: ' + p.fsent.join(', ') + '</p>' : '');
  } else {
    body.innerHTML = '<div class="frAdd"><div class="frMe">Seu ID: <b>' + p.id + '</b><button class="chip" id="frCopy">' + icon('copy') + 'COPIAR</button><button class="chip" id="frShare">' + icon('share') + 'MANDAR</button></div>' +
      '<label class="fld"><span>ID do amigo</span><input id="frIn" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="ex.: 1234567890"></label>' +
      '<button class="mBtn primary" id="frSend">' + icon('users') + 'ENVIAR PEDIDO</button><p id="frMsg" class="hint"></p>' +
      '<p class="hint">O pedido chega na hora se o amigo estiver com o jogo aberto. Depois de aceito, vocês veem quem está on-line e podem se convidar para a sala.</p></div>';
    $('frIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('frSend').click(); });
    $('frSend').addEventListener('click', async () => {
      SND.play('ui');
      $('frSend').disabled = true; $('frMsg').textContent = 'Enviando…';
      const err = await FR.request($('frIn').value);
      $('frSend').disabled = false;
      $('frMsg').textContent = err || 'Pedido enviado! Quando aceitar, aparece na sua lista.';
      if (!err) $('frIn').value = '';
    });
    $('frCopy').addEventListener('click', () => { try { navigator.clipboard.writeText(p.id).then(() => notify('ok', 'ID copiado'), () => notify('info', 'Seu ID: ' + p.id)); } catch (e) { notify('info', 'Seu ID: ' + p.id); } });
    $('frShare').addEventListener('click', () => { const t = 'Me adiciona no Battle Island! Meu ID: ' + p.id; if (navigator.share) navigator.share({ title: 'Battle Island', text: t }).catch(() => {}); else { try { navigator.clipboard.writeText(t); notify('ok', 'Mensagem copiada'); } catch (e) { notify('info', t); } } });
    return;
  }
  const on = (sel, fn) => body.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => { SND.play('ui'); fn(b); }));
  on('[data-inv]', b => FR.invite(b.dataset.inv));
  on('[data-join]', b => LOB.joinLink(b.dataset.join));
  on('[data-acc]', b => FR.accept(b.dataset.acc));
  on('[data-dec]', b => FR.decline(b.dataset.dec));
  on('[data-rm]', b => { const f = ACC.p.friends.find(x => x.id === b.dataset.rm); LOB.dialog('REMOVER AMIGO', 'Remover <b>' + escapeHTML(f.name) + '</b> da sua lista?', [['REMOVER', () => FR.remove(f.id), 'danger'], ['CANCELAR']]); });
};
