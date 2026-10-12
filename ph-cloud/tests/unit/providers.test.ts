import { test } from "node:test";
import assert from "node:assert/strict";
import { gameDistributionAdapter, itchioAdapter } from "@/modules/providers/adapters";
import { geforceNowDeepLink, validateStreamUrl } from "@/modules/cloud-streaming/services";

test("Xbox: aceita só páginas de jogo em www.xbox.com", () => {
  assert.ok(validateStreamUrl("xbox", "https://www.xbox.com/pt-BR/play/games/fortnite/bt5p2x999vh2").ok);
  assert.ok(!validateStreamUrl("xbox", "https://xbox.com.golpe.example/play/games/x").ok);
  assert.ok(!validateStreamUrl("xbox", "http://www.xbox.com/pt-BR/play/games/x").ok);
  assert.ok(!validateStreamUrl("xbox", "https://www.xbox.com/pt-BR/games/store/fortnite/x").ok);
  const r = validateStreamUrl("xbox", "https://www.xbox.com/pt-BR/play/games/fortnite/bt5p2x999vh2?ref=abc");
  assert.ok(r.ok && !r.url.includes("ref="), "remove parâmetros de rastreamento");
});

test("GeForce NOW: aceita game-id ou URL e gera o deep link oficial", () => {
  const id = "46bfab06-d864-465d-9e56-2d9e45cdee0a";
  const a = validateStreamUrl("geforcenow", id);
  const b = validateStreamUrl("geforcenow", `https://play.geforcenow.com/games?game-id=${id}&asset-id=x`);
  assert.ok(a.ok && b.ok);
  assert.equal(a.ok && a.url, geforceNowDeepLink(id));
  const u = new URL(geforceNowDeepLink(id));
  assert.equal(u.hostname, "play.geforcenow.com");
  assert.equal(u.searchParams.get("game-id"), id);
  assert.ok(u.searchParams.get("utm_source") && u.searchParams.get("utm_campaign"), "utm_source e utm_campaign são obrigatórios na doc da NVIDIA");
  assert.ok(!validateStreamUrl("geforcenow", "nao-e-um-id").ok);
  assert.ok(!validateStreamUrl("geforcenow", `https://evil.example/games?game-id=${id}`).ok);
});

test("itch.io: incorporação só por embed-upload; widget de compra é recusado", () => {
  const ok = itchioAdapter.validateLaunchUrl('<iframe src="https://itch.io/embed-upload/1234567?color=333333" width="960"></iframe>', "authorized_embed");
  assert.ok(ok.ok && ok.url === "https://itch.io/embed-upload/1234567?color=333333");
  assert.ok(!itchioAdapter.validateLaunchUrl("https://itch.io/embed/1234567", "authorized_embed").ok);
  assert.ok(!itchioAdapter.validateLaunchUrl("https://criador.itch.io/jogo", "authorized_embed").ok);
  assert.ok(itchioAdapter.validateLaunchUrl("https://criador.itch.io/jogo", "external_provider").ok);
});

test("GameDistribution: exige a URL do jogo com id de 32 caracteres", () => {
  const id = "405c00612981466cbc5d9dcef4214811";
  assert.ok(gameDistributionAdapter.validateLaunchUrl(`https://html5.gamedistribution.com/${id}/`, "authorized_embed").ok);
  assert.ok(gameDistributionAdapter.validateLaunchUrl(`https://embed.gamedistribution.com/?url=https://html5.gamedistribution.com/${id}/&width=1`, "authorized_embed").ok);
  assert.ok(!gameDistributionAdapter.validateLaunchUrl("https://html5.gamedistribution.com/123/", "authorized_embed").ok);
});
