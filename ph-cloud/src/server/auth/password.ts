import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/*
 * Senhas com scrypt (nativo do Node, sem dependências). Formato armazenado:
 * scrypt$N$r$p$salt(base64url)$hash(base64url)
 */

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 32;

function scryptAsync(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

const maxmem = (n: number, r: number) => 128 * n * r * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN, { N, r: R, p: P, maxmem: maxmem(N, R) });
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, "base64url");
  const nNum = Number(n);
  const rNum = Number(r);
  const pNum = Number(p);
  if (!Number.isInteger(nNum) || !Number.isInteger(rNum) || !Number.isInteger(pNum) || expected.length === 0) return false;
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64url"), expected.length, {
    N: nNum,
    r: rNum,
    p: pNum,
    maxmem: maxmem(nNum, rNum),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Hash fixo para comparar quando o e-mail não existe (evita revelar contas pelo tempo de resposta). */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(12).toString("hex"));
  return dummyHash;
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
