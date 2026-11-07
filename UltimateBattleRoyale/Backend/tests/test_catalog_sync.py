"""The JSON catalogue used by the backend must match the C++ catalogue shipped in the game."""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import extract_catalog  # noqa: E402
from brbackend.catalog import Catalog  # noqa: E402


class CatalogSync(unittest.TestCase):
    def test_json_matches_cpp(self):
        checked_in = json.load(open(os.path.join(HERE, "..", "brbackend", "catalog.json"), encoding="utf-8"))
        self.assertEqual(extract_catalog.parse(), checked_in,
                         "catalog.json is stale: run `python3 extract_catalog.py > brbackend/catalog.json`")

    def test_catalog_shape(self):
        cat = Catalog()
        self.assertEqual(len(cat.items), 36)
        self.assertEqual(len(cat.templates), 8)
        self.assertTrue({"Outfit_Recruta", "Back_Basica", "Pick_Padrao", "Glider_Padrao", "Emote_Aceno"} <= set(cat.default_owned()))
        rewards = cat.season_rewards()
        self.assertEqual(sum(1 for r in rewards if r["premium"]), 50)
        self.assertEqual(cat.reward(1, True)["cosmetic"], "Outfit_PassePiloto")
        self.assertEqual(cat.reward(25, False)["cosmetic"], "Glider_Passe")
        for item in cat.items:
            self.assertTrue(item["price"] > 0 or not item["shop"], item["id"])


if __name__ == "__main__":
    unittest.main()
