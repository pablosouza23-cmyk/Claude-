import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { CLOUD_GAMES } from "@/modules/catalog/cloud-games";
import { ORIGINALS } from "@/modules/catalog/originals";
import { buildCategoryRows, filterGames, normalize } from "@/modules/catalog/query";
import { isLaunchable, type PublicGame } from "@/modules/catalog/types";
import { validateStreamUrl } from "@/modules/cloud-streaming/services";

const games: PublicGame[] = [...CLOUD_GAMES, ...ORIGINALS].filter((g) => g.enabled).map((g, i) => ({ ...g, popularity: 10 - i }));

test("normalize remove acentos e espaços extras", () => {
  assert.equal(normalize("  Ação   Rápida "), "acao rapida");
});

test("busca encontra por título sem acento e por desenvolvedor", () => {
  assert.equal(filterGames(games, { q: "fortnite" })[0]?.id, "fortnite");
  assert.ok(filterGames(games, { q: "rockstar" }).some((g) => g.id === "gta-v"));
  assert.ok(filterGames(games, { q: "acao" }).length > 0);
  assert.equal(filterGames(games, { q: "jogo-que-nao-existe" }).length, 0);
});

test("filtro por serviço de nuvem", () => {
  const xbox = filterGames(games, { service: "xbox" });
  assert.ok(xbox.length > 0);
  assert.ok(xbox.every((g) => g.streams?.some((s) => s.service === "xbox")));
  const gfn = filterGames(games, { service: "geforcenow" });
  assert.ok(gfn.every((g) => g.streams?.some((s) => s.service === "geforcenow")));
});

test("fileiras da página inicial não se repetem e não ficam vazias", () => {
  const { rows } = buildCategoryRows(games);
  const keys = rows.map((r) => r.games.map((g) => g.id).sort().join(","));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(rows.every((r) => r.games.length > 0));
  assert.ok(rows.some((r) => r.id === "destaque"));
});

test("jogos de nuvem: ids únicos, links oficiais válidos, capas existentes", () => {
  const ids = new Set<string>();
  for (const g of CLOUD_GAMES) {
    assert.ok(!ids.has(g.id), `id repetido: ${g.id}`);
    ids.add(g.id);
    assert.equal(g.launch.type, "official_streaming");
    assert.ok(g.streams && g.streams.length > 0, `${g.id} sem serviço`);
    for (const s of g.streams!) {
      const check = validateStreamUrl(s.service, s.url);
      assert.ok(check.ok, `${g.id}/${s.service}: ${!check.ok ? check.error : ""}`);
    }
    assert.ok(existsSync(path.join(process.cwd(), "public", g.coverUrl)), `capa ausente: ${g.coverUrl}`);
    assert.ok(isLaunchable(g));
  }
});

test("jogo de demonstração do SDK vem desativado", () => {
  assert.ok(ORIGINALS.every((g) => !g.enabled));
});
