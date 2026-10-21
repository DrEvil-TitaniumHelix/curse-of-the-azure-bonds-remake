"""serve.py: static HTTP server for game/ (ES modules and fetch() do not work from file:// in Chrome).

Usage: python -I tools/serve.py [port] [--dev] [--player]   (default 8189) -> http://localhost:8189/index.html
(Curse fork of Pool's serve.py at 85fb6d6, game/FORK.md: port 8189 so it can run next to Pool's 8188; data folder below.)

BYOC (docs/BYOC.md §6): the game reads the player's own copy from IndexedDB (game/engine/byoc.js).
  --dev     also serves /devdata/ (the original folder below; GET /devdata/?list = JSON list of its files incl. SAVE/), from
            which the page auto-imports through the byoc.js pipeline when nothing is imported yet (lanes, headless runs,
            the owner's launchers).
  --player  serves game/ only (the release setting: no original files on the server).
Without --player the legacy /data/ route stays as a fallback until the import screens are in (docs/BYOC.md §9 step 4).

/data/<NAME> and /devdata/<NAME> map read-only (GET/HEAD only, flat file names, case-insensitive) to the original Curse
folder, default re-targets/goldbox/cotab/curazure next to this repo, overridable with env CAB_DEV_DATA or
CAB_DATA. Sub-paths (SAVE/<NAME>) are allowed for the shipped save directory. Nothing is ever written there.
"""
import functools, http.server, json, os, sys, urllib.parse

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'game')
DATA = os.environ.get('CAB_DEV_DATA') or os.environ.get('CAB_DATA', os.path.join(
    os.path.dirname(os.path.dirname(ROOT)), 're-targets', 'goldbox', 'cotab', 'curazure'))
DEV = '--dev' in sys.argv
PLAYER = '--player' in sys.argv
# cab: --saves DIR (dev/acceptance only): /devsaves/<NAME> serves the files of DIR read-only (e.g. DOSBox-made saves in the
# gitignored acceptance/local/saves/<run>/), /devsaves/?list lists them; the page imports them with ?loadsaves=1
SAVES = sys.argv[sys.argv.index('--saves') + 1] if '--saves' in sys.argv else None


def find_ci(folder, name):
    """case-insensitive lookup of one path component; None if absent."""
    try:
        for f in os.listdir(folder):
            if f.upper() == name.upper():
                return os.path.join(folder, f)
    except OSError:
        pass
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript',
                      '.mjs': 'text/javascript', '.json': 'application/json'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def route(self):
        """'/data/' or '/devdata/' when that route is enabled and the request is for it, else None."""
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if path.startswith('/data/') and not PLAYER:
            return '/data/'
        if path.startswith('/devdata/') and DEV and not PLAYER:
            return '/devdata/'
        return None

    def data_path(self, prefix):
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        parts = [p for p in path[len(prefix):].split('/') if p]
        if not parts or len(parts) > 2 or any(p in ('.', '..') or '\\' in p or ':' in p for p in parts):
            return ''
        cur = DATA
        for p in parts:
            cur = find_ci(cur, p)
            if cur is None:
                return ''
        return cur if os.path.isfile(cur) else ''

    def send_body(self, body, ctype, head):
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def serve_list(self, head):
        names = []
        for f in sorted(os.listdir(DATA)):
            full = os.path.join(DATA, f)
            if os.path.isfile(full):
                names.append(f.upper())
            elif f.upper() == 'SAVE':
                names += ['SAVE/' + g.upper() for g in sorted(os.listdir(full)) if os.path.isfile(os.path.join(full, g))]
        self.send_body(json.dumps(names).encode(), 'application/json', head)

    def serve_data(self, prefix, head):
        if prefix == '/devdata/' and urllib.parse.urlsplit(self.path).query == 'list':
            return self.serve_list(head)
        p = self.data_path(prefix)
        if not p:
            self.send_error(404)
            return
        with open(p, 'rb') as f:
            self.send_body(f.read(), 'application/octet-stream', head)

    def serve_saves(self, head):
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)[len('/devsaves/'):]
        if urllib.parse.urlsplit(self.path).query == 'list':
            names = sorted(f.upper() for f in os.listdir(SAVES) if os.path.isfile(os.path.join(SAVES, f)))
            return self.send_body(json.dumps(names).encode(), 'application/json', head)
        p = find_ci(SAVES, path) if path and '/' not in path and chr(92) not in path and '..' not in path else None
        if not p or not os.path.isfile(p):
            return self.send_error(404)
        with open(p, 'rb') as f:
            self.send_body(f.read(), 'application/octet-stream', head)

    def do_GET(self):
        if SAVES and not PLAYER and self.path.startswith('/devsaves/'):
            return self.serve_saves(False)
        prefix = self.route()
        if prefix:
            return self.serve_data(prefix, False)
        if self.path.startswith(('/data/', '/devdata/')):
            return self.send_error(404)
        return super().do_GET()

    def do_HEAD(self):
        prefix = self.route()
        if prefix:
            return self.serve_data(prefix, True)
        if self.path.startswith(('/data/', '/devdata/')):
            return self.send_error(404)
        return super().do_HEAD()

    def _readonly(self):
        self.send_error(405, 'read-only server')

    do_POST = do_PUT = do_DELETE = do_PATCH = _readonly

    def log_message(self, fmt, *args):
        pass


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--') and a != SAVES]
    port = int(args[0]) if args else 8189
    http.server.ThreadingHTTPServer.allow_reuse_address = False   # Windows: never share a port with another server
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Handler, directory=ROOT))
    mode = 'player: game/ only' if PLAYER else ('dev: /devdata/ + /data/ from ' + DATA if DEV else 'legacy /data/ from ' + DATA)
    print(f'serving {ROOT} at http://localhost:{port}/  ({mode})')
    srv.serve_forever()
