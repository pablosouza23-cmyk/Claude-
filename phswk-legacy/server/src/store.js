'use strict';
// Persistência em arquivo JSON com escrita atômica (grava em .tmp e renomeia).
// Suficiente para um servidor pequeno rodando no Termux ou numa VPS barata;
// a interface (get/set/all/flush) permite trocar por SQLite/Postgres depois.

const fs = require('fs');
const path = require('path');

class Store {
  constructor(file) {
    this.file = file || null;
    this.data = { accounts: {}, tokens: {}, ledger: [] };
    this._timer = null;
    if (this.file && fs.existsSync(this.file)) {
      this.data = { ...this.data, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
    }
  }

  collection(name) {
    if (!this.data[name]) this.data[name] = {};
    return this.data[name];
  }

  // Agenda gravação para agrupar várias alterações seguidas.
  touch() {
    if (!this.file || this._timer) return;
    this._timer = setTimeout(() => this.flush(), 200);
    this._timer.unref?.();
  }

  flush() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store };
