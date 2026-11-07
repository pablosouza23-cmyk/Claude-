"""Parses the C++ cosmetic catalogue and challenge templates (single source of truth) into JSON.

Usage: python3 extract_catalog.py > brbackend/catalog.json
tests/test_catalog_sync.py fails if the checked-in JSON drifts from the C++ code.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
COSMETICS = os.path.join(ROOT, "..", "Source", "UltimateBattleRoyale", "Progression", "BRCosmetics.cpp")
PROGRESSION = os.path.join(ROOT, "..", "Source", "UltimateBattleRoyale", "Progression", "BRProgressionSubsystem.cpp")


def parse():
    src = open(COSMETICS, encoding="utf-8").read()
    body = src[src.index("TArray<FBRCosmeticDef> BuildCatalog()"):src.index("const TArray<FBRCosmeticDef>& UBRCosmeticCatalog::All()")]
    items, by_var = [], {}
    call = re.compile(
        r'(?:(?P<var>\w+)\s*=\s*)?(?:C\.Add\()?(?P<fn>MakeOutfit|MakeItem|MakeEmote)\(TEXT\("(?P<id>\w+)"\),\s*TEXT\("(?P<name>[^"]*)"\),\s*(?P<args>[^;]*?)\)\)?;')
    for m in call.finditer(body):
        args = [a.strip() for a in m.group("args").split(",")]
        fn = m.group("fn")
        item = {"id": m.group("id"), "name": m.group("name"), "passTier": 0, "premium": False}
        if fn == "MakeOutfit":
            item["type"] = "Outfit"
            item["rarity"] = args[0].split("::")[1]
            item["price"] = int(args[1])
            default = len(args) > 8 and args[8] == "true"
        elif fn == "MakeItem":
            item["type"] = args[0].split("::")[1]
            item["rarity"] = args[1].split("::")[1]
            item["price"] = int(args[2])
            default = len(args) > 6 and args[6] == "true"
        else:
            item["type"] = "Emote"
            item["rarity"] = args[0].split("::")[1]
            item["price"] = int(args[1])
            default = len(args) > 4 and args[4] == "true"
        item["defaultOwned"] = default
        item["shop"] = not default
        items.append(item)
        if m.group("var"):
            by_var[m.group("var")] = item
    for var, item in by_var.items():
        if re.search(r"\b%s\.bShopItem\s*=\s*false" % var, body):
            item["shop"] = False
        tier = re.search(r"\b%s\.PassTier\s*=\s*(\d+)" % var, body)
        if tier:
            item["passTier"] = int(tier.group(1))
        if re.search(r"\b%s\.bPremiumPass\s*=\s*true" % var, body):
            item["premium"] = True

    prog = open(PROGRESSION, encoding="utf-8").read()
    templates = []
    for m in re.finditer(r'\{\s*TEXT\("(\w+)"\),\s*TEXT\("(\w+)"\),\s*(\d+),\s*(\d+),\s*TEXT\("([^"]*)"\)\s*\}', prog):
        templates.append({"id": m.group(1), "stat": m.group(2), "daily": int(m.group(3)), "weekly": int(m.group(4)), "text": m.group(5)})
    return {"items": items, "challengeTemplates": templates}


if __name__ == "__main__":
    json.dump(parse(), sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")
