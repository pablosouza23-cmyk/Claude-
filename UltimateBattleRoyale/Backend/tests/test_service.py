import datetime
import unittest

from brbackend import rules
from brbackend.service import ApiError, Service
from brbackend.store import Store

DAY = datetime.date(2026, 11, 7)


def make():
    return Service(Store(":memory:"), clock=lambda: DAY)


def match(mid, pid, placement=1, teams=50, elims=3, mode="Solo", **kw):
    p = {"playerId": pid, "placement": placement, "totalTeams": teams, "eliminations": elims, "revives": 0,
         "chestsOpened": 2, "damageDealt": 800, "secondsSurvived": 1300}
    p.update(kw)
    return {"matchId": mid, "mode": mode, "countsForProgression": True, "players": [p]}


class ServiceTest(unittest.TestCase):
    def test_new_profile_defaults(self):
        s = make()
        p = s.profile("alice")
        self.assertEqual(p["coins"], 500)
        self.assertEqual(p["level"], 1)
        self.assertIn("Outfit_Recruta", p["owned"])
        self.assertEqual(len(p["challenges"]), rules.DAILY_CHALLENGE_COUNT + rules.WEEKLY_CHALLENGE_COUNT)

    def test_purchase_rules(self):
        s = make()
        shop = s.today_catalog()["shop"]
        cheap = min((s.catalog.by_id[i] for i in shop), key=lambda i: i["price"])
        with self.assertRaises(ApiError) as e:
            s.purchase("bob", "Outfit_PassePiloto")
        self.assertEqual(e.exception.code, "not_for_sale")
        off = next(i["id"] for i in s.catalog.shop_pool if i["id"] not in shop)
        with self.assertRaises(ApiError) as e:
            s.purchase("bob", off)
        self.assertEqual(e.exception.code, "not_in_rotation")
        if cheap["price"] <= 500:
            p = s.purchase("bob", cheap["id"])
            self.assertIn(cheap["id"], p["owned"])
            self.assertEqual(p["coins"], 500 - cheap["price"])
            with self.assertRaises(ApiError) as e:
                s.purchase("bob", cheap["id"])
            self.assertEqual(e.exception.code, "already_owned")
        expensive = max((s.catalog.by_id[i] for i in shop), key=lambda i: i["price"])
        if expensive["price"] > 500 and expensive["id"] != cheap["id"]:
            with self.assertRaises(ApiError) as e:
                s.purchase("carol", expensive["id"])
            self.assertEqual(e.exception.code, "not_enough_coins")

    def test_match_rewards_are_computed_server_side_and_idempotent(self):
        s = make()
        r = s.record_match(match("m1", "dave"))
        expected = rules.compute_match_xp(1, 50, 3, 0, 2, 1300)
        self.assertEqual(r["results"][0]["xp"], expected)
        again = s.record_match(match("m1", "dave"))
        self.assertTrue(again["results"][0]["duplicate"])
        p = s.profile("dave")
        self.assertEqual(p["stats"]["Wins"], 1)
        self.assertEqual(p["coins"], 500 + rules.compute_match_coins(1, 3))
        self.assertGreaterEqual(p["totalXp"], expected)

    def test_training_gives_reduced_xp_and_no_coins(self):
        s = make()
        r = s.record_match(match("t1", "erin", mode="Training"))
        self.assertEqual(r["results"][0]["coins"], 0)
        self.assertEqual(r["results"][0]["xp"], rules.compute_match_xp(1, 50, 3, 0, 2, 1300) // 4)
        self.assertEqual(s.profile("erin")["stats"], {})

    def test_implausible_results_rejected(self):
        s = make()
        with self.assertRaises(ApiError):
            s.record_match(match("bad", "frank", elims=500))
        with self.assertRaises(ApiError):
            s.record_match(match("bad", "frank", placement=60, teams=50))
        with self.assertRaises(ApiError):
            s.record_match({"matchId": "x", "mode": "Hacked", "players": []})

    def test_challenges_complete_and_grant_xp(self):
        s = make()
        target = next(c for c in s.catalog.challenges_for(DAY) if c["stat"] == "Matches" or c["stat"] == "Wins") \
            if any(c["stat"] in ("Matches", "Wins") for c in s.catalog.challenges_for(DAY)) else None
        for i in range(20):
            s.record_match(match("c%d" % i, "gina"))
        p = s.profile("gina")
        if target:
            done = next(c for c in p["challenges"] if c["key"] == target["key"])
            self.assertTrue(done["completed"])
        self.assertGreater(p["totalXp"], 20 * rules.compute_match_xp(1, 50, 3, 0, 2, 1300) - 1)

    def test_season_pass_claims(self):
        s = make()
        with self.assertRaises(ApiError) as e:
            s.claim("hank", 1, False)
        self.assertEqual(e.exception.code, "no_reward")  # tier 1 free track has no reward
        with self.assertRaises(ApiError) as e:
            s.claim("hank", 5, False)
        self.assertEqual(e.exception.code, "tier_locked")
        for i in range(10):
            s.record_match(match("p%d" % i, "hank"))
        p = s.profile("hank")
        self.assertGreaterEqual(p["seasonTier"], 5)
        coins = p["coins"]
        p = s.claim("hank", 5, False)
        self.assertEqual(p["coins"], coins + 100)
        with self.assertRaises(ApiError) as e:
            s.claim("hank", 5, False)
        self.assertEqual(e.exception.code, "already_claimed")
        with self.assertRaises(ApiError) as e:
            s.claim("hank", 1, True)
        self.assertEqual(e.exception.code, "premium_required")
        p = s.buy_pass("hank")
        self.assertTrue(p["premiumPass"])
        p = s.claim("hank", 1, True)
        self.assertIn("Outfit_PassePiloto", p["owned"])

    def test_loadout_only_owned_items(self):
        s = make()
        p = s.set_loadout("ivy", {"outfit": "Outfit_Eclipse", "glider": "Glider_Padrao", "emotes": ["Emote_Robo", "Emote_Danca"], "hairStyle": 99})
        self.assertEqual(p["loadout"]["outfit"], "Outfit_Recruta")  # Eclipse not owned
        self.assertEqual(p["loadout"]["emotes"], ["Emote_Danca"])
        self.assertEqual(p["loadout"]["hairStyle"], 4)
        self.assertEqual(s.server_loadout("ivy")["loadout"]["outfit"], "Outfit_Recruta")

    def test_rate_limit(self):
        s = make()
        with self.assertRaises(ApiError) as e:
            for _ in range(30):
                s.set_loadout("jay", {})
        self.assertEqual(e.exception.status, 429)


if __name__ == "__main__":
    unittest.main()
