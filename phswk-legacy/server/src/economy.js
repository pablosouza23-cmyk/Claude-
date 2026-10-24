'use strict';
// Loja com diamantes VIRTUAIS do servidor independente. Não existe compra com
// dinheiro real; cada movimentação fica registrada no ledger para auditoria.

const catalog = require('./catalog');

class Economy {
  constructor(store) {
    this.store = store;
  }

  buy(account, itemId) {
    const item = catalog.BY_ID[itemId];
    if (!item) throw new Error('item inexistente');
    if (account.owned.includes(itemId)) throw new Error('item já possuído');
    if (account.diamonds < item.price) throw new Error('diamantes insuficientes');
    account.diamonds -= item.price;
    account.owned.push(itemId);
    this.store.data.ledger.push({ t: Date.now(), player: account.id, item: itemId, delta: -item.price });
    this.store.touch();
    return { diamonds: account.diamonds, owned: account.owned };
  }

  reward(account, amount, reason) {
    if (!Number.isInteger(amount) || amount <= 0) return;
    account.diamonds += amount;
    this.store.data.ledger.push({ t: Date.now(), player: account.id, reason, delta: amount });
    this.store.touch();
  }
}

module.exports = { Economy };
