'use strict';
// Classificação própria e recompensas em diamantes virtuais ao fim da partida.
// Só contas reais recebem pontos; bots não entram no ranking.

const WIN_POINTS = 25;
const LOSS_POINTS = -15;
const KILL_POINTS = 2;
const WIN_DIAMONDS = 50;
const KILL_DIAMONDS = 5;

function applyResult(result, accounts, economy) {
  const changes = {};
  for (const r of result.players) {
    if (r.isBot) continue;
    const a = accounts.get(r.id);
    if (!a) continue;
    const delta = (r.won ? WIN_POINTS : LOSS_POINTS) + r.kills * KILL_POINTS;
    a.rating = Math.max(0, a.rating + delta);
    a.stats.matches++;
    a.stats.kills += r.kills;
    a.stats.deaths += r.deaths;
    if (r.won) a.stats.wins++;
    const diamonds = (r.won ? WIN_DIAMONDS : 0) + r.kills * KILL_DIAMONDS;
    economy.reward(a, diamonds, `match:${result.mode}`);
    changes[a.id] = { rating: delta, diamonds };
  }
  accounts.store.touch();
  return changes;
}

function leaderboard(accounts, limit = 20) {
  return Object.values(accounts.accounts)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit)
    .map((a) => ({ nickname: a.nickname, rating: a.rating, wins: a.stats.wins, matches: a.stats.matches }));
}

module.exports = { applyResult, leaderboard };
