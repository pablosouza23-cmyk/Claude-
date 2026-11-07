"""Authentication.

* Players: `Authorization: Bearer <token>`.
  - dev mode (BR_AUTH_MODE=dev): token "dev:<playerId>" (never enable in production).
  - eos mode  (BR_AUTH_MODE=eos): EOS Connect ID token (JWT, RS256) verified against the JWKS
    configured in BR_EOS_JWKS_URL, audience BR_EOS_CLIENT_ID; player id = `sub`.
* Game servers: HMAC-SHA1 over "METHOD\\nPATH\\nTIMESTAMP\\nBODY" with the shared BR_SERVER_SECRET,
  headers X-BR-Timestamp / X-BR-Signature (hex). Requests older than 5 minutes are rejected.
"""
import base64
import hashlib
import hmac
import json
import re
import time
import urllib.request

PLAYER_ID = re.compile(r"^[A-Za-z0-9_\-:|.]{1,96}$")


class AuthError(Exception):
    pass


def sign(secret: str, method: str, path: str, timestamp: str, body: bytes) -> str:
    msg = method.upper().encode() + b"\n" + path.encode() + b"\n" + timestamp.encode() + b"\n" + body
    return hmac.new(secret.encode(), msg, hashlib.sha1).hexdigest()


def verify_server(secret: str, method: str, path: str, headers, body: bytes, now=None):
    if not secret:
        raise AuthError("server secret not configured")
    ts = headers.get("X-BR-Timestamp", "")
    sig = headers.get("X-BR-Signature", "")
    try:
        age = abs((now or time.time()) - int(ts))
    except ValueError:
        raise AuthError("bad timestamp")
    if age > 300:
        raise AuthError("stale request")
    if not hmac.compare_digest(sign(secret, method, path, ts, body), sig.lower()):
        raise AuthError("bad signature")


def _b64url(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


class DevVerifier:
    def player_id(self, token: str) -> str:
        if not token.startswith("dev:"):
            raise AuthError("dev token expected")
        pid = token[4:]
        if not PLAYER_ID.match(pid):
            raise AuthError("bad player id")
        return pid


class EosVerifier:
    """RS256 JWT verification (requires the `cryptography` package)."""

    def __init__(self, jwks_url: str, audience: str, issuer_prefix: str = "https://api.epicgames.dev", jwks=None):
        from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: F401  (fail fast if missing)
        self.jwks_url, self.audience, self.issuer_prefix = jwks_url, audience, issuer_prefix
        self._jwks, self._fetched = jwks, time.time() if jwks else 0.0

    def _keys(self):
        if self._jwks is None or time.time() - self._fetched > 3600:
            with urllib.request.urlopen(self.jwks_url, timeout=5) as r:
                self._jwks = json.load(r)
            self._fetched = time.time()
        return {k["kid"]: k for k in self._jwks.get("keys", [])}

    def player_id(self, token: str) -> str:
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding, rsa
        try:
            head_b64, body_b64, sig_b64 = token.split(".")
            header = json.loads(_b64url(head_b64))
            claims = json.loads(_b64url(body_b64))
        except ValueError:
            raise AuthError("malformed token")
        if header.get("alg") != "RS256":
            raise AuthError("unsupported alg")
        key = self._keys().get(header.get("kid"))
        if not key:
            raise AuthError("unknown key")
        pub = rsa.RSAPublicNumbers(int.from_bytes(_b64url(key["e"]), "big"), int.from_bytes(_b64url(key["n"]), "big")).public_key()
        try:
            pub.verify(_b64url(sig_b64), (head_b64 + "." + body_b64).encode(), padding.PKCS1v15(), hashes.SHA256())
        except Exception:
            raise AuthError("bad signature")
        now = time.time()
        if claims.get("exp", 0) < now - 30 or claims.get("nbf", 0) > now + 30:
            raise AuthError("expired")
        aud = claims.get("aud")
        if self.audience and self.audience not in (aud if isinstance(aud, list) else [aud]):
            raise AuthError("wrong audience")
        if not str(claims.get("iss", "")).startswith(self.issuer_prefix):
            raise AuthError("wrong issuer")
        pid = str(claims.get("sub", ""))
        if not PLAYER_ID.match(pid):
            raise AuthError("bad subject")
        return pid
