"""Proves the Python rules compute exactly what the C++ rules compute (XP, rewards, challenges, shop)."""
import json
import os
import shutil
import subprocess
import tempfile
import unittest

from brbackend import rules

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CXX = os.environ.get("CXX") or shutil.which("g++") or shutil.which("clang++")


@unittest.skipUnless(CXX, "C++ compiler required for the cross-check")
class CrossCheck(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        out = os.path.join(tempfile.mkdtemp(), "crosscheck")
        subprocess.run([CXX, "-std=c++17", "-O1", "-I", os.path.join(ROOT, "Source", "UltimateBattleRoyale"),
                        os.path.join(ROOT, "Tests", "RulesTests", "CrossCheck.cpp"), "-o", out], check=True)
        cls.ref = json.loads(subprocess.run([out], check=True, capture_output=True, text=True).stdout)

    def test_xp_curve(self):
        self.assertEqual([rules.xp_for_level(l) for l in range(1, 61)], self.ref["xpForLevel"])
        for xp, level, into in self.ref["levelFromXp"]:
            self.assertEqual(rules.level_from_total_xp(xp), (level, into))

    def test_match_rewards(self):
        for placement, teams, elims, revives, chests, seconds, xp, coins in self.ref["matchRewards"]:
            self.assertEqual(rules.compute_match_xp(placement, teams, elims, revives, chests, seconds), xp)
            self.assertEqual(rules.compute_match_coins(placement, elims), coins)

    def test_season_tiers(self):
        for xp, tier in self.ref["seasonTier"]:
            self.assertEqual(rules.season_tier_from_xp(xp), tier)

    def test_challenges(self):
        for day, picks in self.ref["daily"]:
            self.assertEqual(rules.pick_challenges(rules.daily_challenge_seed(2026, 11, day), rules.DAILY_CHALLENGE_COUNT), picks)
        for week, picks in self.ref["weekly"]:
            self.assertEqual(rules.pick_challenges(rules.weekly_challenge_seed(2026, week), rules.WEEKLY_CHALLENGE_COUNT), picks)

    def test_shop_rotation(self):
        for day, order in self.ref["shop"]:
            self.assertEqual(rules.shuffle_shop(rules.daily_shop_seed(2026, 11, day), 30), order)


if __name__ == "__main__":
    unittest.main()
