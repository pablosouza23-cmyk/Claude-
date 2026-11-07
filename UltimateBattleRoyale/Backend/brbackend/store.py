"""SQLite persistence. All economy mutations happen inside a single transaction."""
import json
import sqlite3
import threading

SCHEMA = """
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY, total_xp INTEGER NOT NULL DEFAULT 0, season_xp INTEGER NOT NULL DEFAULT 0,
    coins INTEGER NOT NULL DEFAULT 500, premium INTEGER NOT NULL DEFAULT 0, loadout TEXT NOT NULL DEFAULT '{}',
    created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS owned (player_id TEXT NOT NULL, item_id TEXT NOT NULL, source TEXT NOT NULL,
    acquired TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (player_id, item_id));
CREATE TABLE IF NOT EXISTS claimed (player_id TEXT NOT NULL, tier INTEGER NOT NULL, premium INTEGER NOT NULL,
    PRIMARY KEY (player_id, tier, premium));
CREATE TABLE IF NOT EXISTS stats (player_id TEXT NOT NULL, key TEXT NOT NULL, value INTEGER NOT NULL,
    PRIMARY KEY (player_id, key));
CREATE TABLE IF NOT EXISTS challenges (player_id TEXT NOT NULL, key TEXT NOT NULL, progress INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (player_id, key));
CREATE TABLE IF NOT EXISTS match_results (match_id TEXT NOT NULL, player_id TEXT NOT NULL, placement INTEGER,
    xp INTEGER, coins INTEGER, recorded TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (match_id, player_id));
CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, player_id TEXT NOT NULL, delta INTEGER NOT NULL,
    reason TEXT NOT NULL, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
"""


class Store:
    def __init__(self, path=":memory:"):
        self.db = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL" if path != ":memory:" else "PRAGMA journal_mode=MEMORY")
        self.db.executescript(SCHEMA)
        self.lock = threading.RLock()

    def transaction(self):
        store = self

        class _Tx:
            def __enter__(self_inner):
                store.lock.acquire()
                store.db.execute("BEGIN IMMEDIATE")
                return store.db

            def __exit__(self_inner, exc_type, exc, tb):
                try:
                    store.db.execute("ROLLBACK" if exc_type else "COMMIT")
                finally:
                    store.lock.release()
                return False
        return _Tx()

    @staticmethod
    def ensure_player(db, player_id, default_owned):
        if db.execute("SELECT 1 FROM players WHERE id=?", (player_id,)).fetchone():
            return
        db.execute("INSERT INTO players (id) VALUES (?)", (player_id,))
        for item in default_owned:
            db.execute("INSERT OR IGNORE INTO owned (player_id, item_id, source) VALUES (?,?,?)", (player_id, item, "default"))

    @staticmethod
    def player(db, player_id):
        return db.execute("SELECT * FROM players WHERE id=?", (player_id,)).fetchone()

    @staticmethod
    def owned(db, player_id):
        return {r["item_id"] for r in db.execute("SELECT item_id FROM owned WHERE player_id=?", (player_id,))}

    @staticmethod
    def add_coins(db, player_id, delta, reason):
        db.execute("UPDATE players SET coins = coins + ? WHERE id=?", (delta, player_id))
        db.execute("INSERT INTO ledger (player_id, delta, reason) VALUES (?,?,?)", (player_id, delta, reason))

    @staticmethod
    def add_stat(db, player_id, key, amount):
        db.execute("INSERT INTO stats (player_id, key, value) VALUES (?,?,?) ON CONFLICT(player_id, key) DO UPDATE SET value = value + excluded.value",
                   (player_id, key, amount))

    @staticmethod
    def stats(db, player_id):
        return {r["key"]: r["value"] for r in db.execute("SELECT key, value FROM stats WHERE player_id=?", (player_id,))}

    @staticmethod
    def loadout(row):
        try:
            return json.loads(row["loadout"] or "{}")
        except ValueError:
            return {}
