#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GitGraph — Visualizador de commits estilo GitKraken (simplificado)

App desktop local: abre um servidor em 127.0.0.1 e a interface no navegador.
Permite abrir até 5 repositórios ao mesmo tempo, um por aba, com o seletor
de pastas nativo do Windows.

Uso:
    python gitgraph.py                # abre a interface
    python gitgraph.py C:\\repos\\x    # abre já com um repositório carregado

Para gerar o executável (.exe), use o build_exe.bat incluído.
Sem dependências externas — apenas Python 3.8+ (com tkinter) e git no PATH.
"""

import argparse
import hashlib
import html
import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FIELD_SEP = "\x1f"
RECORD_SEP = "\x1e"
MAX_COMMITS_DEFAULT = 500

# Paleta de cores das lanes (extraída do GitKraken — hue wheel de 10 cores)
PALETTE = [
    "#15A0BF", "#0669F7", "#8E00C2", "#C517B6", "#D90171",
    "#CD0101", "#F25D2E", "#F2CA33", "#7BD938", "#2ECE9D",
]


# ---------------------------------------------------------------------------
# Coleta de dados do git
# ---------------------------------------------------------------------------

def run_git(repo, *args):
    result = subprocess.run(
        ["git", "-C", repo, *args],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} falhou")
    return result.stdout


def resolve_repo_root(path):
    """Aceita o diretório do repo ou qualquer subpasta dele."""
    path = os.path.abspath(path)
    if not os.path.isdir(path):
        raise RuntimeError(f"'{path}' não é um diretório.")
    try:
        return run_git(path, "rev-parse", "--show-toplevel").strip().replace("/", os.sep)
    except RuntimeError:
        raise RuntimeError(f"'{path}' não parece ser um repositório git.")


def parse_refs(refs_raw):
    refs = []
    if not refs_raw:
        return refs
    for token in refs_raw.split(", "):
        token = token.strip()
        if not token or token.endswith("/HEAD"):
            continue
        if token.startswith("HEAD -> "):
            refs.append({"type": "head_branch", "name": token[len("HEAD -> "):]})
        elif token == "HEAD":
            refs.append({"type": "detached_head", "name": "HEAD"})
        elif token.startswith("tag: "):
            refs.append({"type": "tag", "name": token[len("tag: "):]})
        elif token.startswith(("origin/", "upstream/", "refs/remotes/")):
            refs.append({"type": "remote", "name": token})
        else:
            refs.append({"type": "branch", "name": token})
    return refs


def collect_repo_data(repo, max_commits):
    fmt = FIELD_SEP.join(["%H", "%h", "%P", "%an", "%ae", "%aI", "%D", "%s"]) + RECORD_SEP
    raw = run_git(
        repo, "log", "--all", "--topo-order",
        f"--max-count={max_commits}", f"--pretty=format:{fmt}",
    )

    commits = []
    for record in raw.split(RECORD_SEP):
        record = record.strip("\n\r ")
        if not record:
            continue
        parts = record.split(FIELD_SEP)
        if len(parts) < 8:
            continue
        full, short, parents, author, email, date, refs_raw, subject = parts[:8]
        commits.append({
            "hash": full, "short": short,
            "parents": parents.split() if parents else [],
            "author": author, "email": email, "date": date,
            "refs": parse_refs(refs_raw), "subject": subject,
        })

    try:
        current_branch = run_git(repo, "rev-parse", "--abbrev-ref", "HEAD").strip()
    except RuntimeError:
        current_branch = "HEAD"
    try:
        head_hash = run_git(repo, "rev-parse", "HEAD").strip()
    except RuntimeError:
        head_hash = None

    wip = {"modified": 0, "added": 0, "deleted": 0, "untracked": 0}
    try:
        for line in run_git(repo, "status", "--porcelain").splitlines():
            if not line:
                continue
            code = line[:2]
            if code.startswith("??"):
                wip["untracked"] += 1
            elif "D" in code:
                wip["deleted"] += 1
            elif "A" in code:
                wip["added"] += 1
            else:
                wip["modified"] += 1
    except RuntimeError:
        pass
    wip["total"] = wip["modified"] + wip["added"] + wip["deleted"] + wip["untracked"]

    return commits, current_branch, head_hash, wip, os.path.basename(repo)


def compute_layout(commits):
    """
    Atribui uma lane (coluna) a cada commit e gera as arestas, no mesmo
    princípio do GitKraken: cada lane "reserva" o hash que espera; a
    primeira lane a esperar um commit fica com ele e as demais convergem
    ali (merge visual).
    """
    index = {c["hash"]: i for i, c in enumerate(commits)}
    lanes = []
    color_counter = 0
    edges = []
    max_lanes = 0

    def next_color():
        nonlocal color_counter
        c = color_counter % len(PALETTE)
        color_counter += 1
        return c

    def alloc_lane(expected_hash):
        for i, l in enumerate(lanes):
            if l is None:
                lanes[i] = {"hash": expected_hash, "color": next_color()}
                return i
        lanes.append({"hash": expected_hash, "color": next_color()})
        return len(lanes) - 1

    for row, c in enumerate(commits):
        matches = [i for i, l in enumerate(lanes) if l and l["hash"] == c["hash"]]
        if matches:
            lane = matches[0]
        else:
            lane = alloc_lane(c["hash"])
            matches = [lane]

        c["row"], c["lane"], c["color"] = row, lane, lanes[lane]["color"]

        for i in matches[1:]:
            lanes[i] = None

        parents = c["parents"]
        if parents:
            first = parents[0]
            lanes[lane]["hash"] = first
            if first in index:
                edges.append({"childRow": row, "childLane": lane,
                              "parentHash": first, "routeLane": lane,
                              "color": lanes[lane]["color"]})
            for p in parents[1:]:
                if p not in index:
                    continue
                existing = next((i for i, l in enumerate(lanes) if l and l["hash"] == p), None)
                route = existing if existing is not None else alloc_lane(p)
                edges.append({"childRow": row, "childLane": lane,
                              "parentHash": p, "routeLane": route,
                              "color": lanes[route]["color"]})
        else:
            lanes[lane] = None

        max_lanes = max(max_lanes, len(lanes))

    resolved = []
    for e in edges:
        p = commits[index[e["parentHash"]]]
        resolved.append({"c": [e["childRow"], e["childLane"]],
                         "p": [p["row"], p["lane"]],
                         "r": e["routeLane"], "k": e["color"]})
    return resolved, max_lanes


def build_payload(repo_path, max_commits=MAX_COMMITS_DEFAULT):
    repo = resolve_repo_root(repo_path)
    commits, current_branch, head_hash, wip, repo_name = collect_repo_data(repo, max_commits)
    if not commits:
        raise RuntimeError("Este repositório ainda não tem commits.")
    edges, max_lanes = compute_layout(commits)

    slim = []
    for c in commits:
        initials = "".join(w[0] for w in c["author"].split()[:2]).upper() or "?"
        avatar_hue = int(hashlib.md5(c["email"].encode()).hexdigest(), 16) % 360
        slim.append({
            "h": c["hash"], "s": c["short"], "a": c["author"],
            "i": initials, "hu": avatar_hue, "d": c["date"],
            "m": c["subject"], "r": c["refs"], "l": c["lane"],
            "k": c["color"], "np": len(c["parents"]),
            "mg": 1 if len(c["parents"]) > 1 else 0,
        })

    return {
        "repoPath": repo, "repoName": repo_name,
        "currentBranch": current_branch, "headHash": head_hash,
        "wip": wip, "commits": slim, "edges": edges,
        "maxLanes": max_lanes, "palette": PALETTE,
    }


# ---------------------------------------------------------------------------
# Seletor de pastas nativo (Explorador de Arquivos)
# ---------------------------------------------------------------------------

_dialog_lock = threading.Lock()


def pick_folder():
    with _dialog_lock:
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes("-topmost", True)
            root.update()
            path = filedialog.askdirectory(
                title="Selecione a pasta do repositório git", parent=root)
            root.destroy()
            if not path:
                return {"cancelled": True}
            return {"path": path}
        except Exception as e:
            # tkinter indisponível — a interface pede o caminho manualmente
            return {"needManual": True, "error": str(e)}


# ---------------------------------------------------------------------------
# Servidor HTTP local
# ---------------------------------------------------------------------------

STATE = {"last_ping": None, "started": time.time(), "initial_path": None}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # silencioso

    def _json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _html(self, text):
        body = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)

        if parsed.path == "/":
            self._html(render_app_html())
        elif parsed.path == "/api/ping":
            STATE["last_ping"] = time.time()
            self._json({"ok": True})
        elif parsed.path == "/api/repo":
            path = (qs.get("path") or [""])[0]
            maxc = int((qs.get("max") or [MAX_COMMITS_DEFAULT])[0])
            try:
                self._json(build_payload(path, maxc))
            except (RuntimeError, ValueError, OSError) as e:
                self._json({"error": str(e)}, status=400)
        else:
            self._json({"error": "não encontrado"}, status=404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/pick":
            self._json(pick_folder())
        else:
            self._json({"error": "não encontrado"}, status=404)


def watchdog():
    """Encerra o processo quando a aba do navegador é fechada."""
    while True:
        time.sleep(5)
        now = time.time()
        if STATE["last_ping"] is None:
            if now - STATE["started"] > 120:  # ninguém abriu a página
                os._exit(0)
        elif now - STATE["last_ping"] > 30:
            os._exit(0)


# ---------------------------------------------------------------------------
# Interface (HTML/CSS/JS)
# ---------------------------------------------------------------------------

APP_TEMPLATE = r"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GitGraph</title>
<style>
  :root {
    --bg: #1a1f24;
    --panel: #22282e;
    --panel-2: #262d34;
    --row-hover: rgba(255,255,255,.045);
    --row-selected: rgba(79,143,247,.14);
    --border: #2e363e;
    --text: #d6dde6;
    --muted: #7c8794;
    --accent: #4f8ff7;
    --chip-bg: #262d34;
    --topbar-h: 44px;
    --tabbar-h: 36px;
    --colhead-h: 28px;
    --row-h: 30px;
    --status-h: 26px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    background: var(--bg); color: var(--text);
    font: 13px/1.45 "Open Sans", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
    overflow: hidden;
  }
  code, .mono { font-family: "Cascadia Code", "JetBrains Mono", Consolas, monospace; }
  button { font: inherit; color: inherit; }

  /* ---------- Barra superior ---------- */
  #topbar {
    height: var(--topbar-h);
    display: flex; align-items: center; gap: 12px;
    padding: 0 14px;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
  }
  #topbar .logo {
    width: 22px; height: 22px; border-radius: 6px; flex: none;
    background: conic-gradient(from 200deg, #00bcd4, #b158e0, #ec4899, #00bcd4);
  }
  #topbar .appname { font-weight: 700; font-size: 14px; letter-spacing: .01em; }
  .btn {
    display: inline-flex; align-items: center; gap: 7px;
    background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 6px; padding: 5px 12px;
    font-weight: 600; font-size: 12.5px; cursor: pointer;
    transition: border-color .12s, background .12s;
  }
  .btn:hover { border-color: var(--accent); }
  .btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .btn.primary { background: color-mix(in srgb, var(--accent) 18%, var(--panel-2)); border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }
  .btn:disabled { opacity: .45; cursor: default; }
  .btn:disabled:hover { border-color: var(--border); }
  #topbar .spacer { flex: 1; }
  #topbar .branchinfo {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 6px; padding: 4px 10px; font-weight: 600; font-size: 12.5px;
  }
  #topbar .branchinfo:empty { display: none; }

  /* ---------- Abas ---------- */
  #tabbar {
    height: var(--tabbar-h);
    display: flex; align-items: flex-end;
    padding: 0 8px; gap: 2px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    user-select: none;
  }
  .tab {
    display: inline-flex; align-items: center; gap: 8px;
    max-width: 200px; height: 30px;
    padding: 0 8px 0 12px;
    background: transparent;
    border: 1px solid transparent; border-bottom: none;
    border-radius: 7px 7px 0 0;
    color: var(--muted); font-size: 12.5px; font-weight: 600;
    cursor: pointer; position: relative; top: 1px;
  }
  .tab:hover { background: var(--row-hover); color: var(--text); }
  .tab.active {
    background: var(--panel); border-color: var(--border);
    color: var(--text);
  }
  .tab .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
  .tab .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tab .x {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 4px; flex: none;
    background: none; border: none; color: var(--muted);
    font-size: 12px; cursor: pointer; line-height: 1;
  }
  .tab .x:hover { background: rgba(255,255,255,.12); color: var(--text); }
  #tabbar .count { margin-left: auto; align-self: center; color: var(--muted); font-size: 11px; padding-right: 6px; }

  /* ---------- Área de trabalho ---------- */
  #workspace {
    position: absolute;
    top: calc(var(--topbar-h) + var(--tabbar-h));
    left: 0; right: 0; bottom: var(--status-h);
  }
  #colhead {
    display: grid;
    grid-template-columns: var(--labels-w, 200px) var(--graph-w, 160px) 1fr;
    height: var(--colhead-h);
    align-items: center;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    font-size: 10.5px; letter-spacing: .08em;
    color: var(--muted); text-transform: uppercase;
    user-select: none;
  }
  #colhead > div { padding: 0 12px; white-space: nowrap; overflow: hidden; }
  #colhead > div + div { border-left: 1px solid var(--border); height: 100%; display: flex; align-items: center; }

  #scroll {
    position: absolute; top: var(--colhead-h);
    left: 0; right: 0; bottom: 0;
    overflow: auto;
  }
  #canvas { position: relative; }
  #svg { position: absolute; top: 0; pointer-events: none; }

  .row {
    position: absolute; left: 0; right: 0;
    height: var(--row-h);
    display: grid;
    grid-template-columns: var(--labels-w, 200px) var(--graph-w, 160px) 1fr;
    align-items: center; cursor: pointer;
  }
  .row:hover { background: var(--row-hover); }
  .row.selected { background: var(--row-selected); }
  .row.selected::before {
    content: ""; position: absolute; left: 0; top: 0; bottom: 0;
    width: 2px; background: var(--accent);
  }
  .cell-labels { display: flex; align-items: center; gap: 5px; padding: 0 8px; overflow: hidden; white-space: nowrap; }
  .cell-graph { height: 100%; }
  .cell-msg { display: flex; align-items: center; gap: 10px; padding: 0 14px 0 10px; overflow: hidden; white-space: nowrap; }
  .cell-msg .subject { overflow: hidden; text-overflow: ellipsis; }
  .cell-msg .subject.merge { color: var(--muted); }
  .cell-msg .when { margin-left: auto; color: var(--muted); font-size: 11px; flex: none; opacity: 0; transition: opacity .12s; }
  .row:hover .when, .row.selected .when { opacity: 1; }

  .chip {
    display: inline-flex; align-items: center; gap: 5px; max-width: 100%;
    background: var(--chip-bg);
    border: 1px solid var(--chip-color, var(--border));
    border-left-width: 3px; border-radius: 4px;
    padding: 1.5px 7px; font-size: 11.5px; font-weight: 600;
    color: var(--text); overflow: hidden;
  }
  .chip .nm { overflow: hidden; text-overflow: ellipsis; }
  .chip svg { flex: none; opacity: .85; }
  .chip.current { background: color-mix(in srgb, var(--chip-color) 22%, var(--chip-bg)); }
  .chip.tag { border-color: var(--muted); border-left-width: 1px; color: var(--muted); }

  .row.wip .cell-msg { color: var(--muted); font-style: italic; }
  .wip-badge {
    display: inline-flex; align-items: center; gap: 6px;
    border: 1px dashed var(--muted); border-radius: 4px;
    padding: 1.5px 8px; font-size: 11.5px; color: var(--muted);
  }
  .wip-badge b { color: #e5c122; font-weight: 600; }

  /* ---------- Tela vazia ---------- */
  #welcome {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 14px;
    color: var(--muted); text-align: center; padding: 20px;
  }
  #welcome .biglogo {
    width: 54px; height: 54px; border-radius: 14px;
    background: conic-gradient(from 200deg, #00bcd4, #b158e0, #ec4899, #00bcd4);
    opacity: .9; margin-bottom: 4px;
  }
  #welcome h2 { color: var(--text); font-size: 17px; }
  #welcome p { max-width: 380px; font-size: 12.5px; }

  /* ---------- Painel de detalhes ---------- */
  #detail {
    position: fixed; right: 0;
    top: calc(var(--topbar-h) + var(--tabbar-h) + var(--colhead-h));
    bottom: var(--status-h); width: 300px;
    background: var(--panel); border-left: 1px solid var(--border);
    padding: 16px; transform: translateX(100%);
    transition: transform .16s ease; overflow-y: auto; z-index: 5;
  }
  #detail.open { transform: translateX(0); }
  #detail h3 { font-size: 13px; margin-bottom: 12px; word-break: break-word; padding-right: 18px; }
  #detail .field { margin-bottom: 10px; }
  #detail .field .k { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); margin-bottom: 2px; }
  #detail .field .v { font-size: 12.5px; word-break: break-all; }
  #detail .hashline { display: flex; align-items: center; gap: 8px; }
  #detail button.copy {
    background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer;
  }
  #detail button.copy:hover { border-color: var(--accent); }
  #detail .close {
    position: absolute; top: 10px; right: 10px;
    background: none; border: none; color: var(--muted);
    font-size: 15px; cursor: pointer; padding: 4px;
  }
  #detail .refchips { display: flex; flex-wrap: wrap; gap: 5px; }
  #detail .avatar-row { display: flex; align-items: center; gap: 8px; }
  .avatar {
    width: 20px; height: 20px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 700; color: #fff; flex: none;
    border: 1.5px solid rgba(255,255,255,.25);
  }

  /* ---------- Rodapé e toasts ---------- */
  #statusbar {
    position: fixed; left: 0; right: 0; bottom: 0; height: var(--status-h);
    display: flex; align-items: center; gap: 16px;
    padding: 0 14px; background: var(--panel);
    border-top: 1px solid var(--border);
    font-size: 11px; color: var(--muted);
  }
  #toast {
    position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%) translateY(8px);
    background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 16px;
    font-size: 12.5px; opacity: 0; pointer-events: none;
    transition: opacity .18s, transform .18s; z-index: 20;
    box-shadow: 0 6px 24px rgba(0,0,0,.4);
  }
  #toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

  #loading {
    position: fixed; top: calc(var(--topbar-h) + var(--tabbar-h)); left: 0; right: 0;
    height: 2px; overflow: hidden; z-index: 10; display: none;
  }
  #loading::after {
    content: ""; display: block; height: 100%; width: 35%;
    background: var(--accent); border-radius: 2px;
    animation: slide 1s ease-in-out infinite;
  }
  @keyframes slide { 0% { margin-left: -35%; } 100% { margin-left: 100%; } }
  #loading.on { display: block; }

  @media (prefers-reduced-motion: reduce) {
    #detail, .when, #toast { transition: none; }
    #loading::after { animation-duration: 2s; }
  }
</style>
</head>
<body>
<div id="topbar">
  <div class="logo"></div>
  <span class="appname">GitGraph</span>
  <button class="btn primary" id="btnOpen" title="Abrir um repositório (Ctrl+O)">
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
      <path d="M1.5 4.5v8h13v-6.5h-7l-1.5-2h-4.5z"/>
    </svg>
    Abrir repositório
  </button>
  <button class="btn" id="btnRefresh" title="Recarregar o repositório atual (F5)" disabled>
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.5v3h-3"/>
    </svg>
    Atualizar
  </button>
  <div class="spacer"></div>
  <span class="branchinfo" id="branchInfo"></span>
</div>

<div id="tabbar"></div>
<div id="loading"></div>

<div id="workspace">
  <div id="welcome">
    <div class="biglogo"></div>
    <h2>Nenhum repositório aberto</h2>
    <p>Clique em <b>Abrir repositório</b> e selecione a pasta de um projeto git.
       Você pode manter até 5 repositórios abertos, um por aba.</p>
    <button class="btn primary" onclick="openRepoDialog()">Abrir repositório</button>
  </div>
  <div id="colhead" hidden>
    <div>Branch / Tag</div>
    <div>Graph</div>
    <div>Commit Message</div>
  </div>
  <div id="scroll" hidden>
    <div id="canvas">
      <svg id="svg" xmlns="http://www.w3.org/2000/svg"></svg>
      <div id="rows"></div>
    </div>
  </div>
</div>

<aside id="detail">
  <button class="close" onclick="closeDetail()">✕</button>
  <div id="detailBody"></div>
</aside>

<div id="statusbar">
  <span id="sbCommits"></span>
  <span id="sbBranches"></span>
  <span id="sbWip"></span>
  <span style="margin-left:auto" id="sbPath"></span>
</div>

<div id="toast"></div>

<script>
"use strict";
const INITIAL_PATH = __INITIAL_PATH__;
const ROW_H = 30, LANE_W = 22, DOT_R = 5.5, GRAPH_PAD = 14;
const MAX_TABS = 5;

/* ---------- estado das abas ---------- */
const tabs = [];      // { payload, scrollTop, selectedIdx }
let active = -1;
let loadingCount = 0;

const $ = id => document.getElementById(id);

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove("show"), 2600);
}
function setLoading(on) {
  loadingCount += on ? 1 : -1;
  $("loading").classList.toggle("on", loadingCount > 0);
}

/* ---------- abrir repositórios ---------- */
async function openRepoDialog() {
  if (tabs.length >= MAX_TABS) { toast("Máximo de 5 repositórios abertos — feche uma aba primeiro."); return; }
  setLoading(true);
  let r;
  try { r = await fetch("/api/pick", { method: "POST" }).then(x => x.json()); }
  catch { setLoading(false); toast("Não foi possível abrir o seletor de pastas."); return; }
  setLoading(false);
  if (r.cancelled) return;
  if (r.needManual) {
    const p = prompt("Seletor nativo indisponível.\nDigite o caminho da pasta do repositório:");
    if (p) addRepo(p.trim());
    return;
  }
  if (r.path) addRepo(r.path);
}

async function addRepo(path) {
  if (tabs.length >= MAX_TABS) { toast("Máximo de 5 repositórios abertos — feche uma aba primeiro."); return; }
  setLoading(true);
  let payload;
  try {
    payload = await fetch("/api/repo?path=" + encodeURIComponent(path)).then(x => x.json());
  } catch {
    setLoading(false); toast("Erro de comunicação com o servidor local."); return;
  }
  setLoading(false);
  if (payload.error) { toast(payload.error); return; }
  const existing = tabs.findIndex(t => t.payload.repoPath === payload.repoPath);
  if (existing >= 0) {
    tabs[existing].payload = payload;
    activate(existing);
    toast("Este repositório já estava aberto — aba atualizada.");
    return;
  }
  tabs.push({ payload, scrollTop: 0, selectedIdx: -1 });
  activate(tabs.length - 1);
}

async function refreshActive() {
  if (active < 0) return;
  const tab = tabs[active];
  setLoading(true);
  let payload;
  try {
    payload = await fetch("/api/repo?path=" + encodeURIComponent(tab.payload.repoPath)).then(x => x.json());
  } catch { setLoading(false); toast("Erro ao atualizar."); return; }
  setLoading(false);
  if (payload.error) { toast(payload.error); return; }
  const keepScroll = $("scroll").scrollTop;
  tab.payload = payload;
  tab.selectedIdx = -1;
  renderRepo(tab);
  $("scroll").scrollTop = keepScroll;
  renderTabStrip();
  toast("Repositório atualizado.");
}

/* ---------- abas ---------- */
function activate(i) {
  if (active >= 0 && tabs[active]) tabs[active].scrollTop = $("scroll").scrollTop;
  active = i;
  closeDetail();
  renderTabStrip();
  if (active < 0) { showWelcome(); return; }
  renderRepo(tabs[active]);
  $("scroll").scrollTop = tabs[active].scrollTop || 0;
}

function closeTab(i, ev) {
  if (ev) ev.stopPropagation();
  tabs.splice(i, 1);
  if (tabs.length === 0) { active = -1; activate(-1); return; }
  if (i < active) active--;
  else if (i === active) active = Math.min(active, tabs.length - 1);
  const a = active; active = -2;   // força re-render
  activate(a);
}

function renderTabStrip() {
  const bar = $("tabbar");
  const frag = [];
  tabs.forEach((t, i) => {
    const p = t.payload;
    const color = p.palette[(p.commits[0] ? p.commits[0].k : 0) % p.palette.length];
    frag.push(`
      <div class="tab ${i === active ? "active" : ""}" data-tab="${i}" title="${esc(p.repoPath)}">
        <span class="dot" style="background:${color}"></span>
        <span class="nm">${esc(p.repoName)}</span>
        <button class="x" data-close="${i}" title="Fechar aba">✕</button>
      </div>`);
  });
  frag.push(`<span class="count">${tabs.length}/${MAX_TABS} repositórios</span>`);
  bar.innerHTML = frag.join("");
  $("btnRefresh").disabled = active < 0;
}

$("tabbar").addEventListener("click", ev => {
  const x = ev.target.closest("[data-close]");
  if (x) { closeTab(parseInt(x.dataset.close, 10), ev); return; }
  const tab = ev.target.closest("[data-tab]");
  if (tab) activate(parseInt(tab.dataset.tab, 10));
});

function showWelcome() {
  $("welcome").hidden = false;
  $("colhead").hidden = true;
  $("scroll").hidden = true;
  $("branchInfo").textContent = "";
  $("sbCommits").textContent = "";
  $("sbBranches").textContent = "";
  $("sbWip").textContent = "";
  $("sbPath").textContent = "";
  document.title = "GitGraph";
}

/* ---------- utilidades ---------- */
function esc(t) {
  return String(t).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function relTime(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  const u = [[31536000,"ano","anos"],[2592000,"mês","meses"],[604800,"semana","semanas"],
             [86400,"dia","dias"],[3600,"hora","horas"],[60,"minuto","minutos"]];
  for (const [sec, sg, pl] of u) {
    const v = Math.floor(s / sec);
    if (v >= 1) return `há ${v} ${v === 1 ? sg : pl}`;
  }
  return "agora";
}
const ICON = {
  computer: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="3" width="13" height="8.5" rx="1"/><path d="M5 14h6"/></svg>',
  cloud: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.5 12.5a3 3 0 0 1-.3-6A4 4 0 0 1 12 7.6a2.6 2.6 0 0 1-.6 4.9z"/></svg>',
  tag: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2h5l7 7-5 5-7-7z"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none"/></svg>',
  check: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 8.5 6.5 12 13 4.5"/></svg>',
  branch: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="4" cy="4" r="2"/><circle cx="4" cy="12" r="2"/><circle cx="12" cy="6" r="2"/><path d="M4 6v4M12 8c0 2-3 2-6 3"/></svg>',
};

/* ---------- renderização do grafo ---------- */
function laneX(l) { return GRAPH_PAD + l * LANE_W + LANE_W / 2; }
function rowY(r)  { return r * ROW_H + ROW_H / 2; }

function refChip(r, currentBranch) {
  let icon = ICON.computer, cls = "chip";
  if (r.type === "remote") icon = ICON.cloud;
  if (r.type === "tag") { icon = ICON.tag; cls += " tag"; }
  const isCurrent = r.type === "head_branch" || (r.type === "branch" && r.name === currentBranch);
  if (isCurrent) { cls += " current"; icon = ICON.check; }
  return `<span class="${cls}" title="${esc(r.name)}">${icon}<span class="nm">${esc(r.name)}</span></span>`;
}

function renderRepo(tab) {
  const D = tab.payload;
  const PAL = D.palette;
  const hasWip = D.wip && D.wip.total > 0;
  const off = hasWip ? 1 : 0;
  const totalRows = D.commits.length + off;
  const headIdx = D.commits.findIndex(c => c.h === D.headHash);
  const headCommit = headIdx >= 0 ? D.commits[headIdx] : null;

  $("welcome").hidden = true;
  $("colhead").hidden = false;
  $("scroll").hidden = false;

  // larguras das colunas
  const graphW = Math.max(3, D.maxLanes) * LANE_W + GRAPH_PAD * 2;
  let maxChars = 0;
  for (const c of D.commits)
    for (const r of c.r) maxChars = Math.max(maxChars, Math.min(r.name.length, 26));
  const labelsW = Math.min(260, Math.max(150, maxChars * 7.2 + 60));
  const ws = $("workspace");
  ws.style.setProperty("--graph-w", graphW + "px");
  ws.style.setProperty("--labels-w", labelsW + "px");

  // ----- SVG -----
  const svg = $("svg");
  svg.setAttribute("width", graphW);
  svg.setAttribute("height", totalRows * ROW_H);
  svg.style.left = labelsW + "px";
  const parts = [];
  const CURVE = ROW_H * 0.72;

  for (const e of D.edges) {
    const cR = e.c[0] + off, cL = e.c[1];
    const pR = e.p[0] + off, pL = e.p[1];
    const color = PAL[e.k % PAL.length];
    const x1 = laneX(cL), y1 = rowY(cR);
    const x2 = laneX(pL), y2 = rowY(pR);
    const xr = laneX(e.r);
    let d;
    if (pR - cR === 1) {
      d = (cL === pL) ? `M${x1} ${y1} L${x2} ${y2}`
        : `M${x1} ${y1} C${x1} ${y1 + CURVE} ${x2} ${y2 - CURVE} ${x2} ${y2}`;
    } else {
      d = `M${x1} ${y1}`;
      let curY = y1;
      if (e.r !== cL) {
        const ny = rowY(cR + 1);
        d += ` C${x1} ${y1 + CURVE} ${xr} ${ny - CURVE} ${xr} ${ny}`;
        curY = ny;
      }
      if (e.r !== pL) {
        const by = rowY(pR - 1);
        if (by > curY) d += ` L${xr} ${by}`;
        d += ` C${xr} ${by + CURVE} ${x2} ${y2 - CURVE} ${x2} ${y2}`;
      } else {
        d += ` L${x2} ${y2}`;
      }
    }
    parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`);
  }

  if (hasWip && headCommit) {
    const hl = headCommit.l, headRow = headIdx + off;
    const blocked = D.commits.some((c, i) => i < headIdx && c.l === hl);
    if (!blocked) {
      const x = laneX(hl), color = PAL[headCommit.k % PAL.length];
      parts.push(`<path d="M${x} ${rowY(0)} L${x} ${rowY(headRow)}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round" opacity=".8"/>`);
      parts.push(`<circle cx="${x}" cy="${rowY(0)}" r="${DOT_R + 1.5}" fill="var(--bg)" stroke="${color}" stroke-width="1.6" stroke-dasharray="3 3"/>`);
    }
  }

  for (let i = 0; i < D.commits.length; i++) {
    const c = D.commits[i];
    const x = laneX(c.l), y = rowY(i + off);
    const color = PAL[c.k % PAL.length];
    if (c.mg) {
      parts.push(`<circle cx="${x}" cy="${y}" r="${DOT_R - 1}" fill="${color}"/>`);
      parts.push(`<circle cx="${x}" cy="${y}" r="2" fill="var(--bg)"/>`);
    } else {
      parts.push(`<circle cx="${x}" cy="${y}" r="${DOT_R}" fill="hsl(${c.hu} 45% 55%)" stroke="${color}" stroke-width="2"/>`);
      parts.push(`<text x="${x}" y="${y + 2.6}" text-anchor="middle" font-size="6.5" font-weight="700" fill="#fff" font-family="'Open Sans Variable', 'Open Sans', system-ui">${esc(c.i)}</text>`);
    }
    if (c.h === D.headHash) {
      parts.push(`<circle cx="${x}" cy="${y}" r="${DOT_R + 3.5}" fill="none" stroke="${color}" stroke-width="1.4" opacity=".55"/>`);
    }
  }
  svg.innerHTML = parts.join("");

  // ----- linhas -----
  const frag = [];
  if (hasWip) {
    frag.push(`
      <div class="row wip" style="top:0">
        <div class="cell-labels"></div>
        <div class="cell-graph"></div>
        <div class="cell-msg">
          <span class="wip-badge">// WIP <b>✎ ${D.wip.total}</b></span>
          <span style="color:var(--muted);font-size:11.5px">alterações não commitadas em ${esc(D.currentBranch)}</span>
        </div>
      </div>`);
  }
  for (let i = 0; i < D.commits.length; i++) {
    const c = D.commits[i];
    const color = PAL[c.k % PAL.length];
    const chips = c.r.map(r => refChip(r, D.currentBranch)).join("");
    frag.push(`
      <div class="row ${tab.selectedIdx === i ? "selected" : ""}" data-i="${i}" style="top:${(i + off) * ROW_H}px;--chip-color:${color}">
        <div class="cell-labels">${chips}</div>
        <div class="cell-graph"></div>
        <div class="cell-msg">
          <span class="subject ${c.mg ? "merge" : ""}" title="${esc(c.m)}">${esc(c.m)}</span>
          <span class="when">${esc(c.a.split(" ")[0])} · ${relTime(c.d)}</span>
        </div>
      </div>`);
  }
  $("rows").innerHTML = frag.join("");
  $("canvas").style.height = totalRows * ROW_H + "px";

  // ----- barras -----
  $("branchInfo").innerHTML = `${ICON.branch} <span>${esc(D.currentBranch)}</span>`;
  document.title = `${D.repoName} — GitGraph`;
  const branchSet = new Set();
  for (const c of D.commits)
    for (const r of c.r)
      if (r.type === "branch" || r.type === "head_branch") branchSet.add(r.name);
  $("sbCommits").textContent = `${D.commits.length} commits`;
  $("sbBranches").textContent = `${branchSet.size} branches locais · ${D.maxLanes} lanes`;
  $("sbWip").textContent = hasWip ? `✎ ${D.wip.total} arquivo(s) alterado(s)` : "working tree limpo";
  $("sbPath").textContent = D.repoPath;
}

$("rows").addEventListener("click", ev => {
  const row = ev.target.closest(".row[data-i]");
  if (!row || active < 0) return;
  selectRow(parseInt(row.dataset.i, 10));
});

/* ---------- painel de detalhes ---------- */
function selectRow(i) {
  const tab = tabs[active];
  document.querySelectorAll(".row.selected").forEach(r => r.classList.remove("selected"));
  if (tab.selectedIdx === i) { tab.selectedIdx = -1; closeDetail(); return; }
  tab.selectedIdx = i;
  const row = document.querySelector(`.row[data-i="${i}"]`);
  if (row) row.classList.add("selected");
  const D = tab.payload, c = D.commits[i];
  const color = D.palette[c.k % D.palette.length];
  const dt = new Date(c.d);
  const refs = c.r.length
    ? `<div class="field"><div class="k">Refs</div><div class="refchips" style="--chip-color:${color}">${c.r.map(r => refChip(r, D.currentBranch)).join("")}</div></div>`
    : "";
  $("detailBody").innerHTML = `
    <h3>${esc(c.m)}</h3>
    <div class="field"><div class="k">Autor</div>
      <div class="v avatar-row"><span class="avatar" style="background:hsl(${c.hu} 45% 50%)">${esc(c.i)}</span>${esc(c.a)}</div>
    </div>
    <div class="field"><div class="k">Data</div><div class="v">${dt.toLocaleString("pt-BR")}</div></div>
    <div class="field"><div class="k">Commit</div>
      <div class="v hashline"><code>${esc(c.s)}</code>
        <button class="copy" onclick="copyHash('${c.h}', this)">copiar hash</button></div>
    </div>
    <div class="field"><div class="k">Pais</div><div class="v">${c.np === 0 ? "— (commit raiz)" : c.np === 1 ? "1 pai" : c.np + " pais (merge)"}</div></div>
    ${refs}`;
  $("detail").classList.add("open");
}
function closeDetail() {
  $("detail").classList.remove("open");
  document.querySelectorAll(".row.selected").forEach(r => r.classList.remove("selected"));
  if (active >= 0 && tabs[active]) tabs[active].selectedIdx = -1;
}
function copyHash(h, btn) {
  navigator.clipboard.writeText(h).then(() => {
    btn.textContent = "copiado!";
    setTimeout(() => (btn.textContent = "copiar hash"), 1200);
  });
}

/* ---------- atalhos e eventos globais ---------- */
$("btnOpen").addEventListener("click", openRepoDialog);
$("btnRefresh").addEventListener("click", refreshActive);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeDetail();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") { e.preventDefault(); openRepoDialog(); }
  if (e.key === "F5") { e.preventDefault(); refreshActive(); }
  if ((e.ctrlKey || e.metaKey) && e.key === "Tab" && tabs.length > 1) {
    e.preventDefault();
    activate((active + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length);
  }
});

/* ---------- heartbeat: encerra o servidor ao fechar a página ---------- */
setInterval(() => fetch("/api/ping").catch(() => {}), 5000);
fetch("/api/ping").catch(() => {});

/* ---------- inicialização ---------- */
renderTabStrip();
showWelcome();
if (INITIAL_PATH) addRepo(INITIAL_PATH);
</script>
</body>
</html>
"""


def render_app_html():
    initial = STATE.get("initial_path")
    return APP_TEMPLATE.replace(
        "__INITIAL_PATH__",
        json.dumps(initial, ensure_ascii=False).replace("</", "<\\/"),
    )


# ---------------------------------------------------------------------------
# Inicialização
# ---------------------------------------------------------------------------

def free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def main():
    ap = argparse.ArgumentParser(description="GitGraph — visualizador de commits estilo GitKraken")
    ap.add_argument("repo", nargs="?", default=None,
                    help="(opcional) repositório para abrir na inicialização")
    ap.add_argument("--port", type=int, default=None, help="porta fixa (padrão: automática)")
    ap.add_argument("--no-open", action="store_true", help="não abrir o navegador")
    args = ap.parse_args()

    if args.repo:
        try:
            STATE["initial_path"] = resolve_repo_root(args.repo)
        except RuntimeError as e:
            print(f"aviso: {e}", file=sys.stderr)

    port = args.port or free_port()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=watchdog, daemon=True).start()

    url = f"http://127.0.0.1:{port}/"
    print(f"GitGraph rodando em {url}  (feche a aba do navegador para encerrar)")
    if not args.no_open:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
