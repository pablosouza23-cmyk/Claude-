"""End-to-end over real HTTP: auth, server signatures, purchases, match results."""
import base64
import json
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from brbackend.auth import DevVerifier, EosVerifier, sign
from brbackend.server import make_handler
from brbackend.service import Service
from brbackend.store import Store

SECRET = "test-secret"


class ApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(Service(Store(":memory:")), DevVerifier(), SECRET))
        cls.base = "http://127.0.0.1:%d" % cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def call(self, method, path, body=None, token=None, server=False, ts=None):
        data = json.dumps(body).encode() if body is not None else b""
        req = urllib.request.Request(self.base + path, data=data if method in ("POST", "PUT") else None, method=method)
        req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", "Bearer " + token)
        if server:
            stamp = str(ts if ts is not None else int(time.time()))
            req.add_header("X-BR-Timestamp", stamp)
            req.add_header("X-BR-Signature", sign(SECRET, method, path.split("?")[0], stamp, data))
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.load(r)
        except urllib.error.HTTPError as e:
            return e.code, json.load(e)

    def test_health_and_catalog(self):
        self.assertEqual(self.call("GET", "/v1/health"), (200, {"ok": True}))
        status, cat = self.call("GET", "/v1/catalog/today")
        self.assertEqual(status, 200)
        self.assertEqual(len(cat["shop"]), 8)

    def test_auth_required(self):
        self.assertEqual(self.call("GET", "/v1/profile")[0], 401)
        self.assertEqual(self.call("GET", "/v1/profile", token="nope")[0], 401)
        status, prof = self.call("GET", "/v1/profile", token="dev:player_1")
        self.assertEqual(status, 200)
        self.assertEqual(prof["playerId"], "player_1")

    def test_server_signature(self):
        body = {"matchId": "api-1", "mode": "Solo", "players": [{"playerId": "p_srv", "placement": 1, "totalTeams": 10}]}
        self.assertEqual(self.call("POST", "/v1/server/match-result", body)[0], 401)          # unsigned
        self.assertEqual(self.call("POST", "/v1/server/match-result", body, server=True, ts=int(time.time()) - 3600)[0], 401)  # stale
        status, res = self.call("POST", "/v1/server/match-result", body, server=True)
        self.assertEqual(status, 200)
        self.assertGreater(res["results"][0]["xp"], 0)
        # Clients cannot fake results with a player token.
        self.assertEqual(self.call("POST", "/v1/server/match-result", body, token="dev:p_srv")[0], 401)
        status, lo = self.call("GET", "/v1/server/loadout?player=p_srv", server=True)
        self.assertEqual(status, 200)
        self.assertEqual(lo["loadout"]["outfit"], "Outfit_Recruta")

    def test_signature_vector_shared_with_cpp(self):
        # Same vector as BR.Backend.Signature in Source/UltimateBattleRoyale/Tests/BRAutomationTests.cpp
        import re, os
        cpp = open(os.path.join(os.path.dirname(__file__), "..", "..", "Source", "UltimateBattleRoyale", "Tests", "BRAutomationTests.cpp")).read()
        expected = re.search(r'HMAC matches backend.*?FString\(TEXT\("([0-9a-f]{40})"\)\)', cpp).group(1)
        self.assertEqual(sign("s3cret", "POST", "/v1/server/match-result", "1767225600", b'{"matchId":"m1"}'), expected)

    def test_errors(self):
        self.assertEqual(self.call("POST", "/v1/shop/purchase", {"itemId": "Nope"}, token="dev:p2")[0], 404)
        self.assertEqual(self.call("POST", "/v1/iap/verify", {}, token="dev:p2")[0], 501)
        self.assertEqual(self.call("GET", "/v1/nothing")[0], 404)


class EosJwtTest(unittest.TestCase):
    """EOS token verification with a locally generated RSA key (no network)."""

    def setUp(self):
        try:
            from cryptography.hazmat.primitives.asymmetric import rsa
        except ImportError:
            self.skipTest("cryptography not installed")
        self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        nums = self.key.public_key().public_numbers()
        b64 = lambda i: base64.urlsafe_b64encode(i.to_bytes((i.bit_length() + 7) // 8, "big")).rstrip(b"=").decode()
        self.verifier = EosVerifier("unused", "client-123", jwks={"keys": [{"kid": "k1", "kty": "RSA", "n": b64(nums.n), "e": b64(nums.e)}]})

    def token(self, **claims):
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding
        enc = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()
        body = {"sub": "eos_abc", "aud": "client-123", "iss": "https://api.epicgames.dev/auth/v1/x", "exp": time.time() + 600}
        body.update(claims)
        signing = enc({"alg": "RS256", "kid": "k1"}) + "." + enc(body)
        sig = self.key.sign(signing.encode(), padding.PKCS1v15(), hashes.SHA256())
        return signing + "." + base64.urlsafe_b64encode(sig).rstrip(b"=").decode()

    def test_valid(self):
        self.assertEqual(self.verifier.player_id(self.token()), "eos_abc")

    def test_rejections(self):
        from brbackend.auth import AuthError
        for bad in (self.token(exp=time.time() - 600), self.token(aud="other"), self.token(iss="https://evil"),
                    self.token()[:-4] + "AAAA", "a.b"):
            with self.assertRaises(AuthError):
                self.verifier.player_id(bad)


if __name__ == "__main__":
    unittest.main()
