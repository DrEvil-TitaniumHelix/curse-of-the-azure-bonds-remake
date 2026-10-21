"""make_public_repo.py: build the public release candidate LOCALLY (Curse port of Pool's tool; RemasterDOSGames RELEASE.md
steps a + b2, rulings PR-2 A / PR-3 / RL-2).

Usage: python -I tools/make_public_repo.py [--target DIR] [--replace] [--version TAG] [--no-gate]
  --target   default ../CurseAzureBondsRE-public (a NEW directory next to this repo)
  --replace  delete an existing target first, but only one this script made (marker file .git/cab-public-clone)
  --version  the tag proposed for the candidate (default v0.1.0-alpha); created LOCALLY only

Steps: (1) the files of this repo's HEAD commit (committed content only, never the shared work tree's uncommitted
files) pass an ALLOW-list (own work: engine, importer, Gold Box Plus, pseudocode, specs, tools, docs) and then a DENY
pass (original bytes and direct extracts: DAX/EXE/OVR/saves and every binary or render by extension, the decode
listings with raw code bytes, the ECL script listings with the game's texts, DOSBox reference captures, the lane files);
(2) the public README / CHANGELOG templates of tools/public/ replace the private ones; (3) a NEW git repo with fresh
history: one commit by the public identity (RELEASE.md rule 1), an annotated tag; (4) the gate tools/public_gate.py on
its tree and history. This repo is never modified; nothing is pushed and no remote is added (the Foreman publishes).
"""
import argparse, os, re, shutil, subprocess, sys

WS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_TARGET = os.path.join(os.path.dirname(WS), 'CurseAzureBondsRE-public')
MARKER = 'cab-public-clone'
IDENTITY = ('DrEvil', '58350129+DrEvil-TitaniumHelix@users.noreply.github.com')   # gh api user --jq .id (RELEASE.md rule 1)

# PR-2 A: engine + importer + Plus + our pseudocode / specs / names + docs + tools that read the originals only at run time.
ALLOW = [r'^game/', r'^docs/', r'^tools/(serve|gen_globals|mkmanifest|make_public_repo|public_gate)\.py$',
         r'^decode/(pseudo|names|tools|ghidra_scripts)/', r'^decode/ecl/(ECL_VM|ECL_DIFF|JOURNAL_REFS|QUESTS)\.md$', r'^decode/ecl/scripts/(INDEX|FLAGMAP)\.md$',
         r'^decode/data/[^/]+\.md$', r'^decode/(LAYOUT|CROSSREF|GLOBALS|ENGINE_DELTA)\.md$',
         r'^(DECODE_GATE|BUILD_PLAN|ACCEPTANCE)\.md$', r'^\.gitignore$', r'^\.gitattributes$',
         r'^acceptance/[^/]+\.(mjs|py|sh)$', r'^acceptance/reports/', r'^acceptance/integration/[^/]+\.md$',
         r'^acceptance/(byoc|plus|release)/[^/]+\.(md|mjs|py|sh|json)$']
# inside the kept folders: Pool's scenarios (not Curse), the test-only Pool run captures, binaries and renders by extension
DENY = [r'^game/scenarios/', r'(?i)\.(png|pdf|exe|dax|ovr|sav|itm|spc|swg|fx|guy|cha|hil|dat|bin|gif|jpg|bmp|zip)$',
        r'^decode/(listings|bin|rt)/', r'^decode/ecl/scripts/.*\.ecl\.txt$', r'^decode/data/png/', r'^acceptance/(ref|local)/', r'^herdr/']
# Scrub pass (RELEASE.md step b, rule 3): personal and machine details out of the candidate's text files only (this repo
# keeps them). The workspace paths become relative / $HOME (below); the owner's own names become "the owner" through a
# PRIVATE list outside every repo (env PUBLIC_SCRUB or ~/.config/remaster-dos-games/scrub.txt, `regex<TAB>replacement`,
# case-sensitive), so no personal pattern is written here. Game text that happens to match a personal-gate pattern
# ("Attack Ally") is listed in the candidate's .personal-gate-allow instead.
PRIVATE_SCRUB = os.environ.get('PUBLIC_SCRUB') or os.path.join(os.path.expanduser('~'), '.config', 'remaster-dos-games', 'scrub.txt')


def private_scrub():
    if not os.path.isfile(PRIVATE_SCRUB):
        sys.exit(f'private scrub list missing: {PRIVATE_SCRUB} (regex<TAB>replacement per line)')
    out = []
    for line in open(PRIVATE_SCRUB, encoding='utf-8'):
        if line.strip() and not line.startswith('#'):
            rx, new = line.rstrip('\n').split('\t', 1)
            out.append((re.compile(rx), new))
    return out


SCRUB = [(re.compile(r'(?i)C:[\\/]+Users[\\/]+[^\\/\s,]+[\\/]+IdeaProjects[\\/]+'), '../'),
         (re.compile(r'(?i)/mnt/c/Users/[^/\s]+/IdeaProjects/'), '$HOME/IdeaProjects/'),
         (re.compile(r'(?i)C:[\\/]+Users[\\/]+[A-Za-z0-9_.-]+'), 'the home folder')]
TEXT_EXT = ('.md', '.js', '.mjs', '.py', '.sh', '.json', '.css', '.html', '.txt', '.tsv', '.java', '')


def scrub(path, body):
    if not path.lower().endswith(TEXT_EXT):
        return body, 0
    try:
        text = body.decode('utf-8')
    except UnicodeDecodeError:
        return body, 0
    n = 0
    for rx, new in SCRUB:
        text, k = rx.subn(new, text); n += k
    return text.encode('utf-8'), n


# the private README / CHANGELOG are replaced by the public templates
TEMPLATES = {'README.md': 'tools/public/README.md', 'CHANGELOG.md': 'tools/public/CHANGELOG.md',
             '.personal-gate-allow': 'tools/public/personal-gate-allow.txt'}


def git(*a, cwd=WS, data=None, env=None):
    return subprocess.run(['git', '-C', cwd] + list(a), input=data, capture_output=True, check=True, env=env).stdout


def select(paths):
    keep = [p for p in paths if any(re.search(r, p) for r in ALLOW) and not any(re.search(r, p) for r in DENY)]
    return sorted(keep)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--target', default=DEFAULT_TARGET)
    ap.add_argument('--replace', action='store_true')
    ap.add_argument('--version', default='v0.1.0-alpha')
    ap.add_argument('--no-gate', action='store_true')
    a = ap.parse_args()
    target = os.path.abspath(a.target)
    if os.path.normcase(target).startswith(os.path.normcase(WS + os.sep)) or os.path.normcase(target) == os.path.normcase(WS):
        sys.exit('refusing: the target must be outside this repo')
    if os.path.exists(target):
        if not (a.replace and os.path.exists(os.path.join(target, '.git', MARKER))):
            sys.exit(f'{target} exists (use --replace; only a candidate made by this script, marker .git/{MARKER}, is replaced)')
        shutil.rmtree(target, onerror=lambda f, p, e: (os.chmod(p, 0o700), f(p)))
    head = git('rev-parse', '--short', 'HEAD').decode().strip()
    tracked = [p for p in git('ls-tree', '-r', '--name-only', '-z', 'HEAD').decode('utf-8').split('\0') if p]
    keep = select(tracked)
    SCRUB.extend(private_scrub())
    os.makedirs(target)
    scrubbed = {}
    for p in keep:
        dst = os.path.join(target, *p.split('/'))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        body, n = scrub(p, git('cat-file', 'blob', f'HEAD:{p}'))
        if n:
            scrubbed[p] = n
        with open(dst, 'wb') as f:
            f.write(body)
    for dst, src in TEMPLATES.items():
        try:
            body = git('cat-file', 'blob', f'HEAD:{src}')
        except subprocess.CalledProcessError:
            sys.exit(f'template {src} is not committed at HEAD')
        with open(os.path.join(target, dst), 'wb') as f:
            f.write(body)
    git('init', '--quiet', '--initial-branch=main', cwd=target)
    git('config', 'user.name', IDENTITY[0], cwd=target); git('config', 'user.email', IDENTITY[1], cwd=target)
    git('config', 'core.autocrlf', 'false', cwd=target)
    git('add', '--all', cwd=target)
    msg = (f'Curse of the Azure Bonds remake {a.version}\n\nBrowser rebuild of Curse of the Azure Bonds (SSI, 1989) on the Gold Box engine, '
           f'with Gold Box Plus. Bring your own copy (v1.0); no original game files.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n')
    git('commit', '--quiet', '-F', '-', cwd=target, data=msg.encode())
    git('tag', '-a', a.version, '-m', f'Curse of the Azure Bonds remake {a.version}', cwd=target)
    with open(os.path.join(target, '.git', MARKER), 'w', encoding='utf-8') as f:
        f.write(f'public candidate from {WS} at {head}; never push without the owner\'s approval\n')
    files = len([p for p in git('ls-files', cwd=target).decode().split('\n') if p])
    print(f'candidate ready: {target} (source {head}, {len(keep)} files kept of {len(tracked)} + {len(TEMPLATES)} templates = {files} files, '
          f'1 commit, tag {a.version}, no remote; scrub: {sum(scrubbed.values())} replacements in {len(scrubbed)} files)')
    if not a.no_gate:
        sys.exit(subprocess.run([sys.executable, '-I', os.path.join(WS, 'tools', 'public_gate.py'), target,
                                 '--json', os.path.join(target, '.git', 'public_gate.json')]).returncode)


if __name__ == '__main__':
    main()
