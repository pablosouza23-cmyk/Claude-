import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { RateLimiter } from "@/server/auth/rate-limit";
import { createGameToken, verifyGameToken } from "@/server/games/token";
import { resolveGameFile } from "@/server/games/files";
import { buildAppCsp, buildGameCsp } from "@/server/security/csp";

test("senha: hash não guarda o texto e verifica corretamente", async () => {
  const h = await hashPassword("senha-forte-123");
  assert.ok(h.startsWith("scrypt$") && !h.includes("senha-forte-123"));
  assert.equal(await verifyPassword("senha-forte-123", h), true);
  assert.equal(await verifyPassword("senha-errada", h), false);
  assert.equal(await verifyPassword("x", "formato-invalido"), false);
});

test("limite de tentativas bloqueia e libera após a janela", () => {
  let now = 0;
  const rl = new RateLimiter(2, 1000, () => now);
  assert.ok(rl.hit("k").allowed);
  assert.ok(rl.hit("k").allowed);
  assert.ok(!rl.hit("k").allowed);
  now = 1001;
  assert.ok(rl.hit("k").allowed);
});

test("token de jogo: válido, adulterado, vencido e com outro segredo", () => {
  const secret = "s".repeat(40);
  const t = createGameToken("neon-drift", null, secret, 1_000_000);
  assert.equal(verifyGameToken(t, secret, 1_000_000)?.g, "neon-drift");
  assert.equal(verifyGameToken(t + "x", secret, 1_000_000), null);
  assert.equal(verifyGameToken(t, "o".repeat(40), 1_000_000), null);
  assert.equal(verifyGameToken(t, secret, 1_000_000 + 5 * 3600 * 1000), null);
});

test("arquivos de jogo: bloqueia saída da pasta e outros jogos", () => {
  assert.ok(resolveGameFile(["neon-drift", "index.html"], "neon-drift"));
  assert.ok(resolveGameFile(["_sdk", "phc-sdk.js"], "neon-drift"));
  assert.equal(resolveGameFile(["..", "package.json"], "neon-drift"), null);
  assert.equal(resolveGameFile(["neon-drift", "..", "..", "package.json"], "neon-drift"), null);
  assert.equal(resolveGameFile(["outro-jogo", "index.html"], "neon-drift"), null);
  assert.equal(resolveGameFile(["neon-drift", ".env"], "neon-drift"), null);
  assert.equal(resolveGameFile(["neon-drift", "server.ts"], "neon-drift"), null);
});

test("CSP: nonce, frame-ancestors e frames só dos provedores ativos", () => {
  const csp = buildAppCsp({ nonce: "abc", dev: false, frameOrigins: ["https://itch.io"], imageOrigins: [], connectOrigins: [] });
  assert.match(csp, /script-src 'self' 'nonce-abc' 'strict-dynamic'/);
  assert.match(csp, /frame-src 'self' https:\/\/itch.io/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  const game = buildGameCsp("https://phcloud.example", ["https://phcloud.example"]);
  assert.match(game, /connect-src 'none'/);
});
