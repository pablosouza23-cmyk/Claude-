'use strict';
// Contas de convidado com token de sessão. O token só é guardado como hash
// SHA-256; quem tem o arquivo de dados não consegue se passar pelo jogador.
// Login Google/Facebook não está implementado: exigiria registrar um app
// próprio nesses provedores (veja docs/ARQUITETURA.md).

const crypto = require('crypto');
const catalog = require('./catalog');

const DEMO_DIAMONDS = 10000; // saldo virtual inicial (sem valor monetário)
const NAME_RE = /^[\p{L}\p{N}_ .-]{3,16}$/u;

const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

class Accounts {
  constructor(store) {
    this.store = store;
    this.accounts = store.collection('accounts');
    this.tokens = store.collection('tokens');
  }

  createGuest(nickname) {
    const name = String(nickname || '').trim();
    if (!NAME_RE.test(name)) throw new Error('apelido inválido (3 a 16 caracteres)');
    const id = 'p_' + crypto.randomBytes(6).toString('hex');
    const token = crypto.randomBytes(24).toString('base64url');
    this.accounts[id] = {
      id,
      nickname: name,
      createdAt: Date.now(),
      diamonds: DEMO_DIAMONDS,
      owned: catalog.freeItems(),
      loadout: { character: 'chr_vento', weapon: 'wpn_lanca', outfit: 'fit_padrao' },
      rating: 1000,
      stats: { matches: 0, wins: 0, kills: 0, deaths: 0 },
    };
    this.tokens[hash(token)] = id;
    this.store.touch();
    return { account: this.accounts[id], token };
  }

  byToken(token) {
    if (typeof token !== 'string' || !token) return null;
    const id = this.tokens[hash(token)];
    return id ? this.accounts[id] : null;
  }

  get(id) {
    return this.accounts[id] || null;
  }

  equip(account, slot, itemId) {
    if (!['character', 'weapon', 'outfit'].includes(slot)) throw new Error('slot inválido');
    if (catalog.kindOf(itemId) !== slot) throw new Error('item não pertence ao slot');
    if (!account.owned.includes(itemId)) throw new Error('item não possuído');
    account.loadout[slot] = itemId;
    this.store.touch();
    return account.loadout;
  }

  // Versão pública (sem segredos) enviada ao cliente.
  static view(a) {
    return {
      id: a.id,
      nickname: a.nickname,
      diamonds: a.diamonds,
      owned: a.owned,
      loadout: a.loadout,
      rating: a.rating,
      stats: a.stats,
    };
  }
}

module.exports = { Accounts, DEMO_DIAMONDS };
