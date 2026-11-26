// Teste de protocolo (sem navegador): amigos, convites, sala privada, reconexão e loja.
// Uso: servidor rodando; PV_WS=ws://localhost:8787/ws node tests/e2e/social.mjs
import WebSocket from 'ws';
const URL = process.env.PV_WS ?? 'ws://localhost:8787/ws';
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘', m); if (!c) failures++; };

function bot(name, token) {
  const ws = new WebSocket(URL);
  const b = { ws, msgs: [], name, token: null, profile: null, room: undefined, friends: null };
  ws.on('message', (raw) => {
    const m = JSON.parse(String(raw));
    b.msgs.push(m);
    if (m.t === 'welcome') { b.token = m.token; b.profile = m.profile; }
    if (m.t === 'profile') b.profile = m.profile;
    if (m.t === 'room') b.room = m.room;
    if (m.t === 'friends') b.friends = m;
  });
  b.send = (m) => ws.send(JSON.stringify(m));
  b.open = new Promise((r) => ws.on('open', () => { b.send({ t: 'hello', v: 1, name, token }); r(); }));
  b.wait = (pred, ms = 5000) => new Promise((res, rej) => {
    const t0 = Date.now();
    const i = setInterval(() => { const m = b.msgs.find(pred); if (m) { clearInterval(i); res(m); } else if (Date.now() - t0 > ms) { clearInterval(i); rej(new Error(`timeout ${name}`)); } }, 20);
  });
  return b;
}

const A = bot('Alice'), B = bot('Bruno');
await A.open; await B.open;
await A.wait((m) => m.t === 'welcome'); await B.wait((m) => m.t === 'welcome');
console.log('Amigos');
A.send({ t: 'friendAdd', code: B.profile.friendCode });
await B.wait((m) => m.t === 'friends' && m.incoming.some((f) => f.name === 'Alice'));
ok(true, 'Bruno recebeu o pedido de amizade');
B.send({ t: 'friendRespond', userId: A.profile.userId, accept: true });
await A.wait((m) => m.t === 'friends' && m.friends.some((f) => f.name === 'Bruno' && f.online));
ok(true, 'Alice vê Bruno como amigo online');
await A.wait((m) => m.t === 'ev' && m.e === 'achievement' && m.d.id === 'social');
ok(true, 'conquista "Turma Formada" concedida');

console.log('Sala privada + convite');
A.send({ t: 'roomCreate', visibility: 'private', game: 'mudanca', difficulty: 'medio' });
await A.wait((m) => m.t === 'room' && m.room);
A.send({ t: 'roomList' });
const list = await A.wait((m) => m.t === 'roomList');
ok(!list.rooms.some((r) => r.code === A.room.code), 'sala privada não aparece na lista pública');
A.send({ t: 'invite', userId: B.profile.userId });
const inv = await B.wait((m) => m.t === 'invite');
ok(inv.code === A.room.code && inv.fromName === 'Alice', 'Bruno recebeu o convite com o código');
B.send({ t: 'inviteRespond', code: inv.code, accept: true });
await A.wait((m) => m.t === 'room' && m.room && m.room.members.length === 2);
ok(true, 'Bruno entrou pela aceitação do convite');
B.send({ t: 'roomVote', game: 'mudanca' });
B.send({ t: 'roomReady', ready: true });
await A.wait((m) => m.t === 'room' && m.room && m.room.members.every((x) => x.ready));
ok(true, 'votação e pronto sincronizados');

console.log('Reconexão');
const code = A.room.code;
const tokenB = B.token;
B.ws.terminate();
await A.wait((m) => m.t === 'room' && m.room && m.room.members.some((x) => x.name === 'Bruno' && !x.connected));
ok(true, 'sala mostra Bruno desconectado (vaga mantida)');
const B2 = bot('Bruno', tokenB);
await B2.open;
const w = await B2.wait((m) => m.t === 'welcome');
ok(w.profile.userId === B.profile.userId, 'mesma conta após reconectar (token)');
const rv = await B2.wait((m) => m.t === 'room' && m.room);
ok(rv.room.code === code, 'voltou automaticamente para a mesma sala');
await A.wait((m) => m.t === 'room' && m.room && m.room.members.every((x) => x.connected));
ok(true, 'sala mostra Bruno conectado de novo');

console.log('Loja (somente cosméticos)');
const coins0 = B2.profile.coins;
B2.send({ t: 'buy', item: 'hat-beanie' });
await B2.wait((m) => m.t === 'profile' && m.profile.owned.includes('hat-beanie'));
ok(B2.profile.coins === coins0 - 90 + 40, `compra debitou 90 e deu a conquista "Estiloso" (+40): ${coins0} -> ${B2.profile.coins}`);
B2.send({ t: 'buy', item: 'hat-crown' });
await B2.wait((m) => m.t === 'toast' && /nível/i.test(m.msg));
ok(true, 'item com nível mínimo bloqueado');
B2.send({ t: 'setOutfit', outfit: { ...B2.profile.outfit, hat: 'hat-crown' } });
await new Promise((r) => setTimeout(r, 300));
ok(B2.profile.outfit.hat !== 'hat-crown', 'servidor recusa equipar item não comprado');

A.ws.close(); B2.ws.close();
console.log(failures ? `\n${failures} FALHA(S)` : '\nTudo certo.');
process.exit(failures ? 1 : 0);
