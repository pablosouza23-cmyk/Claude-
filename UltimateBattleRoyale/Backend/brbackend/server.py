"""HTTP API (stdlib only).  Run:  python -m brbackend.server --port 8080 --db profiles.db

Environment: BR_AUTH_MODE=dev|eos, BR_SERVER_SECRET=<shared with dedicated servers>,
BR_EOS_JWKS_URL, BR_EOS_CLIENT_ID (eos mode).
"""
import argparse
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .auth import AuthError, DevVerifier, EosVerifier, verify_server
from .service import ApiError, Service
from .store import Store

MAX_BODY = 64 * 1024


def make_handler(service: Service, verifier, server_secret: str):
    class Handler(BaseHTTPRequestHandler):
        server_version = "BRBackend/1.0"

        def log_message(self, fmt, *args):  # quieter, structured
            sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

        def _send(self, status, payload):
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def _body(self):
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                raise ApiError(413, "too_large", "Corpo grande demais.")
            return self.rfile.read(length) if length else b""

        def _json(self, raw):
            try:
                return json.loads(raw.decode("utf-8") or "{}")
            except (ValueError, UnicodeDecodeError):
                raise ApiError(400, "bad_json", "JSON inválido.")

        def _player(self):
            auth = self.headers.get("Authorization", "")
            if not auth.startswith("Bearer "):
                raise ApiError(401, "unauthorized", "Token ausente.")
            try:
                return verifier.player_id(auth[7:].strip())
            except AuthError as e:
                raise ApiError(401, "unauthorized", str(e))

        def _server(self, raw):
            try:
                verify_server(server_secret, self.command, urlparse(self.path).path, self.headers, raw)
            except AuthError as e:
                raise ApiError(401, "unauthorized", str(e))

        def _dispatch(self):
            url = urlparse(self.path)
            raw = self._body() if self.command in ("POST", "PUT") else b""
            route = (self.command, url.path)
            if route == ("GET", "/v1/health"):
                return 200, {"ok": True}
            if route == ("GET", "/v1/catalog/today"):
                return 200, service.today_catalog()
            if route == ("GET", "/v1/profile"):
                return 200, service.profile(self._player())
            if route == ("POST", "/v1/shop/purchase"):
                pid = self._player()
                return 200, service.purchase(pid, self._json(raw).get("itemId"))
            if route == ("POST", "/v1/pass/buy"):
                return 200, service.buy_pass(self._player())
            if route == ("POST", "/v1/pass/claim"):
                pid = self._player()
                body = self._json(raw)
                return 200, service.claim(pid, body.get("tier"), bool(body.get("premium")))
            if route == ("PUT", "/v1/loadout"):
                pid = self._player()
                return 200, service.set_loadout(pid, self._json(raw))
            if route == ("POST", "/v1/iap/verify"):
                self._player()
                raise ApiError(501, "iap_not_configured",
                               "Compras reais exigem credenciais do Google Play / App Store (ver Docs/ONLINE.md).")
            if route == ("GET", "/v1/server/loadout"):
                self._server(raw)
                pid = (parse_qs(url.query).get("player") or [""])[0]
                if not pid:
                    raise ApiError(400, "bad_player", "Parâmetro player ausente.")
                return 200, service.server_loadout(pid)
            if route == ("POST", "/v1/server/match-result"):
                self._server(raw)
                return 200, service.record_match(self._json(raw))
            raise ApiError(404, "not_found", "Rota inexistente.")

        def _handle(self):
            try:
                status, payload = self._dispatch()
            except ApiError as e:
                status, payload = e.status, {"error": e.code, "message": e.message}
            except Exception as e:  # never leak internals
                self.log_message("internal error: %r", e)
                status, payload = 500, {"error": "internal", "message": "Erro interno."}
            self._send(status, payload)

        do_GET = do_POST = do_PUT = _handle

    return Handler


def build_verifier():
    mode = os.environ.get("BR_AUTH_MODE", "dev")
    if mode == "eos":
        return EosVerifier(os.environ["BR_EOS_JWKS_URL"], os.environ.get("BR_EOS_CLIENT_ID", ""))
    if mode != "dev":
        raise SystemExit("BR_AUTH_MODE must be dev or eos")
    sys.stderr.write("WARNING: dev auth enabled (tokens 'dev:<id>'). Never use in production.\n")
    return DevVerifier()


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--db", default="profiles.db")
    args = ap.parse_args(argv)
    service = Service(Store(args.db))
    httpd = ThreadingHTTPServer((args.host, args.port), make_handler(service, build_verifier(), os.environ.get("BR_SERVER_SECRET", "")))
    sys.stderr.write("BR backend listening on %s:%d\n" % (args.host, args.port))
    httpd.serve_forever()


if __name__ == "__main__":
    main()
