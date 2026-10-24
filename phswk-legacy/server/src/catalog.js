'use strict';
// Catálogo PRÓPRIO do PHSWK Legacy. Nenhum nome, arte ou estatística aqui foi
// copiado do Free Fire: são itens originais criados para este projeto.
// Atributos de armas são usados pela simulação da partida (match.js).

const CHARACTERS = [
  { id: 'chr_vento', name: 'Vento', price: 0, perk: { speed: 1.1 } },
  { id: 'chr_brasa', name: 'Brasa', price: 0, perk: { damage: 1.08 } },
  { id: 'chr_rocha', name: 'Rocha', price: 500, perk: { maxHp: 115 } },
  { id: 'chr_eco', name: 'Eco', price: 800, perk: { regen: 2 } },
];

const WEAPONS = [
  // dmg por tiro, cadência em ms, alcance em unidades do mapa, dispersão em rad
  { id: 'wpn_pulso', name: 'Pulso SMG', price: 0, dmg: 9, rateMs: 110, range: 260, spread: 0.12 },
  { id: 'wpn_lanca', name: 'Lança AR', price: 0, dmg: 16, rateMs: 180, range: 420, spread: 0.06 },
  { id: 'wpn_trovao', name: 'Trovão Shotgun', price: 600, dmg: 38, rateMs: 750, range: 150, spread: 0.2 },
  { id: 'wpn_agulha', name: 'Agulha Sniper', price: 900, dmg: 70, rateMs: 1400, range: 700, spread: 0.01 },
];

const OUTFITS = [
  { id: 'fit_padrao', name: 'Uniforme Padrão', price: 0, color: '#8a8f98' },
  { id: 'fit_aurora', name: 'Jaqueta Aurora', price: 300, color: '#36c5f0' },
  { id: 'fit_magma', name: 'Traje Magma', price: 450, color: '#ff5a1f' },
  { id: 'fit_noite', name: 'Capa Noturna', price: 700, color: '#6b4cff' },
];

const ALL = [...CHARACTERS, ...WEAPONS, ...OUTFITS];
const BY_ID = Object.fromEntries(ALL.map((i) => [i.id, i]));

const kindOf = (id) =>
  id.startsWith('chr_') ? 'character' : id.startsWith('wpn_') ? 'weapon' : id.startsWith('fit_') ? 'outfit' : null;

const freeItems = () => ALL.filter((i) => i.price === 0).map((i) => i.id);

module.exports = { CHARACTERS, WEAPONS, OUTFITS, BY_ID, kindOf, freeItems };
