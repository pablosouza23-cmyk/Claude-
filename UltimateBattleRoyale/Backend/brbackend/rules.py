"""Python mirror of Source/UltimateBattleRoyale/Rules/BRRulesMath.h + BRProgressionRules.h.

Every function here must produce exactly the same values as the C++ rules; this is enforced by
tests/test_crosscheck.py, which compiles Tests/RulesTests/CrossCheck.cpp and compares outputs.
"""
import math

MASK32 = 0xFFFFFFFF
MAX_ACCOUNT_LEVEL = 200
SEASON_PASS_TIERS = 50
XP_PER_SEASON_TIER = 8000
CHALLENGE_TEMPLATE_COUNT = 8
DAILY_CHALLENGE_COUNT = 3
WEEKLY_CHALLENGE_COUNT = 5
PREMIUM_PASS_PRICE = 950


def hash_combine(a: int, b: int) -> int:
    a &= MASK32
    b &= MASK32
    h = a ^ ((b + 0x9E3779B9 + ((a << 6) & MASK32) + (a >> 2)) & MASK32)
    h &= MASK32
    h ^= h >> 16
    h = (h * 0x7FEB352D) & MASK32
    h ^= h >> 15
    h = (h * 0x846CA68B) & MASK32
    h ^= h >> 16
    return h


class Rng:
    """xorshift32, identical to BRRules::Rng."""

    def __init__(self, seed: int):
        self.state = (seed & MASK32) or 0x9E3779B9

    def next(self) -> int:
        s = self.state
        s ^= (s << 13) & MASK32
        s ^= s >> 17
        s ^= (s << 5) & MASK32
        self.state = s & MASK32
        return self.state

    def range_int(self, lo: int, hi: int) -> int:
        if hi <= lo:
            return lo
        return lo + self.next() % (hi - lo + 1)


def xp_for_level(level: int) -> int:
    level = max(1, level)
    return 1000 + 250 * min(level - 1, 40)


def level_from_total_xp(total_xp: int):
    """Returns (level, xp_into_level)."""
    level = 1
    remaining = max(0, total_xp)
    while level < MAX_ACCOUNT_LEVEL and remaining >= xp_for_level(level):
        remaining -= xp_for_level(level)
        level += 1
    return level, remaining


def _round_half_away(x: float) -> int:
    return int(math.floor(x + 0.5)) if x >= 0 else -int(math.floor(-x + 0.5))


def compute_match_xp(placement, total_teams, eliminations, revives, chests_opened, seconds_survived, assists=0) -> int:
    teams = max(1, total_teams)
    placement = min(max(placement, 1), teams)
    factor = 1.0 - float(placement - 1) / float(teams)
    xp = 150.0
    xp += 1500.0 * factor * factor
    xp += 250.0 * eliminations
    xp += 100.0 * assists
    xp += 200.0 * revives
    xp += 50.0 * chests_opened
    xp += 2.0 * min(float(seconds_survived), 1800.0)
    if placement == 1:
        xp += 2000.0
    return _round_half_away(xp)


def compute_match_coins(placement, eliminations) -> int:
    coins = 10 + 5 * eliminations
    if placement == 1:
        coins += 100
    elif placement <= 10:
        coins += 25
    return coins


def season_tier_from_xp(season_xp: int) -> int:
    if season_xp <= 0:
        return 0
    return int(min(SEASON_PASS_TIERS, season_xp // XP_PER_SEASON_TIER))


def daily_challenge_seed(year, month, day):
    return hash_combine(year * 10000 + month * 100 + day, 0xDA11)


def weekly_challenge_seed(year, week_of_year):
    return hash_combine(year * 100 + week_of_year, 0x3EE7)


def daily_shop_seed(year, month, day):
    return hash_combine(year * 10000 + month * 100 + day, 0xC0FFEE)


def pick_challenges(seed: int, count: int):
    pool = list(range(CHALLENGE_TEMPLATE_COUNT))
    rng = Rng(seed)
    out = []
    for _ in range(count):
        if not pool:
            break
        out.append(pool.pop(rng.range_int(0, len(pool) - 1)))
    return out


def shuffle_shop(seed: int, pool_size: int):
    order = list(range(pool_size))
    rng = Rng(seed)
    for i in range(pool_size - 1, 0, -1):
        j = rng.range_int(0, i)
        order[i], order[j] = order[j], order[i]
    return order


def week_of_year(date) -> int:
    """Matches the game: (DayOfYear - 1) / 7."""
    return (date.timetuple().tm_yday - 1) // 7
