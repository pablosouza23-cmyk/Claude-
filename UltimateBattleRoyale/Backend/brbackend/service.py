"""Business logic. The backend is the only authority for XP, coins, ownership and rewards."""
import datetime
import json
import time

from . import rules
from .catalog import Catalog
from .store import Store

MODES = {"Solo", "Duos", "Squads", "Build", "ZeroBuild", "Training", "Range", "Creative"}
STAT_KEYS = ("Matches", "Wins", "Top10", "Eliminations", "Revives", "ChestsOpened", "DamageDealt", "MinutesSurvived")


class ApiError(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


class RateLimiter:
    def __init__(self, capacity=10.0, refill=1.0):
        self.capacity, self.refill, self.buckets = capacity, refill, {}

    def consume(self, key, now=None):
        now = now if now is not None else time.monotonic()
        tokens, last = self.buckets.get(key, (self.capacity, now))
        tokens = min(self.capacity, tokens + (now - last) * self.refill)
        if tokens < 1.0:
            self.buckets[key] = (tokens, now)
            raise ApiError(429, "rate_limited", "Muitas requisições, tente novamente em instantes.")
        self.buckets[key] = (tokens - 1.0, now)


class Service:
    def __init__(self, store: Store, catalog: Catalog = None, clock=None):
        self.store = store
        self.catalog = catalog or Catalog()
        self.clock = clock or (lambda: datetime.datetime.now(datetime.timezone.utc).date())
        self.limiter = RateLimiter()

    # ------------------------------------------------------------------ reads
    def profile(self, pid):
        with self.store.transaction() as db:
            Store.ensure_player(db, pid, self.catalog.default_owned())
            return self._profile(db, pid)

    def _profile(self, db, pid):
        row = Store.player(db, pid)
        level, into = rules.level_from_total_xp(row["total_xp"])
        owned = Store.owned(db, pid)
        today = self.clock()
        challenges = []
        for c in self.catalog.challenges_for(today):
            prog = db.execute("SELECT progress, completed FROM challenges WHERE player_id=? AND key=?", (pid, c["key"])).fetchone()
            challenges.append(dict(c, progress=prog["progress"] if prog else 0, completed=bool(prog["completed"]) if prog else False))
        claimed = db.execute("SELECT tier, premium FROM claimed WHERE player_id=?", (pid,)).fetchall()
        return {
            "playerId": pid,
            "level": level, "xpIntoLevel": into, "xpForNextLevel": rules.xp_for_level(level), "totalXp": row["total_xp"],
            "seasonXp": row["season_xp"], "seasonTier": rules.season_tier_from_xp(row["season_xp"]),
            "coins": row["coins"], "premiumPass": bool(row["premium"]),
            "owned": sorted(owned),
            "loadout": self.catalog.sanitize_loadout(Store.loadout(row), owned),
            "claimedFree": sorted(r["tier"] for r in claimed if not r["premium"]),
            "claimedPremium": sorted(r["tier"] for r in claimed if r["premium"]),
            "stats": Store.stats(db, pid),
            "challenges": challenges,
        }

    def today_catalog(self):
        today = self.clock()
        return {"date": today.isoformat(), "shop": [i["id"] for i in self.catalog.daily_shop(today)],
                "seasonRewards": self.catalog.season_rewards(), "premiumPassPrice": rules.PREMIUM_PASS_PRICE}

    # ------------------------------------------------------------------ player mutations
    def purchase(self, pid, item_id):
        self.limiter.consume(pid)
        item = self.catalog.by_id.get(item_id)
        if not item:
            raise ApiError(404, "unknown_item", "Item inexistente.")
        if not item["shop"] or item["price"] <= 0:
            raise ApiError(403, "not_for_sale", "Item não está à venda.")
        if item_id not in {i["id"] for i in self.catalog.daily_shop(self.clock())}:
            raise ApiError(403, "not_in_rotation", "Item não está na loja de hoje.")
        with self.store.transaction() as db:
            Store.ensure_player(db, pid, self.catalog.default_owned())
            if item_id in Store.owned(db, pid):
                raise ApiError(409, "already_owned", "Você já possui este item.")
            if Store.player(db, pid)["coins"] < item["price"]:
                raise ApiError(402, "not_enough_coins", "Moedas insuficientes.")
            Store.add_coins(db, pid, -item["price"], "purchase:" + item_id)
            db.execute("INSERT INTO owned (player_id, item_id, source) VALUES (?,?,?)", (pid, item_id, "shop"))
            return self._profile(db, pid)

    def buy_pass(self, pid):
        self.limiter.consume(pid)
        with self.store.transaction() as db:
            Store.ensure_player(db, pid, self.catalog.default_owned())
            row = Store.player(db, pid)
            if row["premium"]:
                raise ApiError(409, "already_owned", "Passe premium já desbloqueado.")
            if row["coins"] < rules.PREMIUM_PASS_PRICE:
                raise ApiError(402, "not_enough_coins", "Moedas insuficientes.")
            Store.add_coins(db, pid, -rules.PREMIUM_PASS_PRICE, "premium_pass")
            db.execute("UPDATE players SET premium=1 WHERE id=?", (pid,))
            return self._profile(db, pid)

    def claim(self, pid, tier, premium):
        self.limiter.consume(pid)
        if not isinstance(tier, int) or not 1 <= tier <= rules.SEASON_PASS_TIERS:
            raise ApiError(400, "bad_tier", "Nível inválido.")
        reward = self.catalog.reward(tier, bool(premium))
        if not reward:
            raise ApiError(404, "no_reward", "Sem recompensa neste nível.")
        with self.store.transaction() as db:
            Store.ensure_player(db, pid, self.catalog.default_owned())
            row = Store.player(db, pid)
            if rules.season_tier_from_xp(row["season_xp"]) < tier:
                raise ApiError(403, "tier_locked", "Nível do passe ainda não alcançado.")
            if premium and not row["premium"]:
                raise ApiError(403, "premium_required", "Requer passe premium.")
            if db.execute("SELECT 1 FROM claimed WHERE player_id=? AND tier=? AND premium=?", (pid, tier, int(bool(premium)))).fetchone():
                raise ApiError(409, "already_claimed", "Recompensa já resgatada.")
            db.execute("INSERT INTO claimed (player_id, tier, premium) VALUES (?,?,?)", (pid, tier, int(bool(premium))))
            if reward["cosmetic"]:
                db.execute("INSERT OR IGNORE INTO owned (player_id, item_id, source) VALUES (?,?,?)", (pid, reward["cosmetic"], "pass"))
            if reward["coins"]:
                Store.add_coins(db, pid, reward["coins"], "pass:%d:%d" % (tier, int(bool(premium))))
            return self._profile(db, pid)

    def set_loadout(self, pid, loadout):
        self.limiter.consume(pid)
        if not isinstance(loadout, dict):
            raise ApiError(400, "bad_loadout", "Loadout inválido.")
        with self.store.transaction() as db:
            Store.ensure_player(db, pid, self.catalog.default_owned())
            clean = self.catalog.sanitize_loadout(loadout, Store.owned(db, pid))
            db.execute("UPDATE players SET loadout=? WHERE id=?", (json.dumps(clean), pid))
            return self._profile(db, pid)

    # ------------------------------------------------------------------ game-server calls
    def server_loadout(self, pid):
        with self.store.transaction() as db:
            Store.ensure_player(db, pid, self.catalog.default_owned())
            row = Store.player(db, pid)
            level, _ = rules.level_from_total_xp(row["total_xp"])
            return {"playerId": pid, "level": level, "loadout": self.catalog.sanitize_loadout(Store.loadout(row), Store.owned(db, pid))}

    def record_match(self, payload):
        match_id = str(payload.get("matchId", ""))[:128]
        mode = payload.get("mode")
        players = payload.get("players")
        if not match_id or mode not in MODES or not isinstance(players, list) or len(players) > 100:
            raise ApiError(400, "bad_match", "Resultado de partida inválido.")
        counts = bool(payload.get("countsForProgression", True)) and mode not in ("Training", "Range", "Creative")
        today = self.clock()
        active = self.catalog.challenges_for(today)
        results = []
        with self.store.transaction() as db:
            for p in players:
                try:
                    pid = str(p["playerId"])
                    placement, teams = int(p["placement"]), int(p["totalTeams"])
                    elims, revives = int(p.get("eliminations", 0)), int(p.get("revives", 0))
                    chests, damage = int(p.get("chestsOpened", 0)), int(p.get("damageDealt", 0))
                    seconds = float(p.get("secondsSurvived", 0))
                except (KeyError, TypeError, ValueError):
                    raise ApiError(400, "bad_player", "Jogador inválido no resultado.")
                if not (1 <= teams <= 100 and 1 <= placement <= teams and 0 <= elims <= 99 and 0 <= revives <= 99
                        and 0 <= chests <= 500 and 0 <= damage <= 100000 and 0 <= seconds <= 7200):
                    raise ApiError(400, "implausible", "Valores fora do plausível para %s." % pid)
                Store.ensure_player(db, pid, self.catalog.default_owned())
                if db.execute("SELECT 1 FROM match_results WHERE match_id=? AND player_id=?", (match_id, pid)).fetchone():
                    results.append({"playerId": pid, "duplicate": True})
                    continue
                xp = rules.compute_match_xp(placement, teams, elims, revives, chests, seconds)
                coins = rules.compute_match_coins(placement, elims)
                if not counts:
                    xp, coins = xp // 4, 0
                db.execute("INSERT INTO match_results (match_id, player_id, placement, xp, coins) VALUES (?,?,?,?,?)",
                           (match_id, pid, placement, xp, coins))
                gained = {"Matches": 1, "Wins": int(placement == 1), "Top10": int(placement <= 10), "Eliminations": elims,
                          "Revives": revives, "ChestsOpened": chests, "DamageDealt": damage, "MinutesSurvived": int(seconds // 60)}
                bonus = 0
                if counts:
                    for key, amount in gained.items():
                        if amount:
                            Store.add_stat(db, pid, key, amount)
                    for c in active:
                        amount = gained.get(c["stat"], 0)
                        if not amount:
                            continue
                        row = db.execute("SELECT progress, completed FROM challenges WHERE player_id=? AND key=?", (pid, c["key"])).fetchone()
                        if row and row["completed"]:
                            continue
                        progress = min(c["target"], (row["progress"] if row else 0) + amount)
                        done = progress >= c["target"]
                        db.execute("INSERT INTO challenges (player_id, key, progress, completed) VALUES (?,?,?,?) "
                                   "ON CONFLICT(player_id, key) DO UPDATE SET progress=excluded.progress, completed=excluded.completed",
                                   (pid, c["key"], progress, int(done)))
                        if done:
                            bonus += c["xp"]
                db.execute("UPDATE players SET total_xp = total_xp + ?, season_xp = season_xp + ? WHERE id=?", (xp + bonus, xp + bonus, pid))
                if coins:
                    Store.add_coins(db, pid, coins, "match:" + match_id)
                results.append({"playerId": pid, "xp": xp, "challengeXp": bonus, "coins": coins})
        return {"matchId": match_id, "results": results}
