"""Cosmetic catalogue, shop rotation and season pass (mirrors UBRCosmeticCatalog)."""
import datetime
import json
import os

from . import rules

_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog.json")


class Catalog:
    def __init__(self, path=_PATH):
        data = json.load(open(path, encoding="utf-8"))
        self.items = data["items"]
        self.templates = data["challengeTemplates"]
        self.by_id = {i["id"]: i for i in self.items}
        self.shop_pool = [i for i in self.items if i["shop"]]
        if len(self.templates) != rules.CHALLENGE_TEMPLATE_COUNT:
            raise ValueError("challenge templates out of sync with the rules")

    def default_owned(self):
        return [i["id"] for i in self.items if i["defaultOwned"]]

    def daily_shop(self, day: datetime.date, count=8):
        order = rules.shuffle_shop(rules.daily_shop_seed(day.year, day.month, day.day), len(self.shop_pool))
        return [self.shop_pool[i] for i in order[:count]]

    def season_rewards(self):
        rewards = []
        for tier in range(1, rules.SEASON_PASS_TIERS + 1):
            free = {"tier": tier, "premium": False, "cosmetic": None, "coins": 100 if tier % 5 == 0 else 0}
            prem = {"tier": tier, "premium": True, "cosmetic": None, "coins": 150 if tier % 2 == 0 else 50}
            for item in self.items:
                if item["passTier"] == tier:
                    target = prem if item["premium"] else free
                    target["cosmetic"] = item["id"]
                    target["coins"] = 0
            if free["cosmetic"] or free["coins"] > 0:
                rewards.append(free)
            rewards.append(prem)
        return rewards

    def reward(self, tier, premium):
        for r in self.season_rewards():
            if r["tier"] == tier and r["premium"] == premium:
                return r
        return None

    def challenges_for(self, day: datetime.date):
        """Active challenges (daily + weekly) for a UTC date, with stable keys per period."""
        out = []
        dkey = day.isoformat()
        for idx in rules.pick_challenges(rules.daily_challenge_seed(day.year, day.month, day.day), rules.DAILY_CHALLENGE_COUNT):
            t = self.templates[idx]
            out.append({"key": "%s:D_%s" % (dkey, t["id"]), "id": "D_" + t["id"], "stat": t["stat"], "target": t["daily"],
                        "xp": 3000, "weekly": False, "text": t["text"].replace("{0}", str(t["daily"]))})
        week = rules.week_of_year(day)
        wkey = "%d-W%d" % (day.year, week)
        for idx in rules.pick_challenges(rules.weekly_challenge_seed(day.year, week), rules.WEEKLY_CHALLENGE_COUNT):
            t = self.templates[idx]
            out.append({"key": "%s:W_%s" % (wkey, t["id"]), "id": "W_" + t["id"], "stat": t["stat"], "target": t["weekly"],
                        "xp": 12000, "weekly": True, "text": t["text"].replace("{0}", str(t["weekly"]))})
        return out

    def sanitize_loadout(self, loadout: dict, owned: set):
        """Server rule: only owned items of the right type; ranges clamped (mirrors UBRCosmeticCatalog::Sanitize)."""
        defaults = {"outfit": "Outfit_Recruta", "backpack": "Back_Basica", "pickaxe": "Pick_Padrao", "glider": "Glider_Padrao"}
        types = {"outfit": "Outfit", "backpack": "Backpack", "pickaxe": "Pickaxe", "glider": "Glider"}
        clean = {}
        for key, typ in types.items():
            value = loadout.get(key)
            item = self.by_id.get(value) if isinstance(value, str) else None
            clean[key] = value if (item and item["type"] == typ and value in owned) else defaults[key]
        emotes = []
        for e in (loadout.get("emotes") or [])[:6]:
            item = self.by_id.get(e) if isinstance(e, str) else None
            if item and item["type"] == "Emote" and e in owned and e not in emotes:
                emotes.append(e)
        clean["emotes"] = emotes or ["Emote_Aceno", "Emote_Danca"]
        for key, hi in (("bodyType", 1), ("bodyStyle", 2), ("hairStyle", 4), ("headGear", 4), ("colorVariant", 2)):
            try:
                clean[key] = min(max(int(loadout.get(key, 0)), 0), hi)
            except (TypeError, ValueError):
                clean[key] = 0
        return clean
