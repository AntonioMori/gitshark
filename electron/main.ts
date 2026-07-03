import { app, BrowserWindow, dialog, ipcMain, net } from 'electron';
import path from 'path';
import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Git Engine
// ---------------------------------------------------------------------------

const FIELD_SEP = '\x1f';
const RECORD_SEP = '\x1e';
const MAX_COMMITS = 500;

const PALETTE = [
  '#15A0BF', '#0669F7', '#8E00C2', '#C517B6', '#D90171',
  '#CD0101', '#F25D2E', '#F2CA33', '#7BD938', '#2ECE9D',
];

function runGit(repo: string, ...args: string[]): string {
  try {
    return execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf-8',
      windowsHide: true,
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (err: any) {
    throw new Error(err.stderr?.trim() || `git ${args.join(' ')} falhou`);
  }
}

function resolveRepoRoot(p: string): string {
  p = path.resolve(p);
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
    throw new Error(`'${p}' não é um diretório.`);
  }
  try {
    return runGit(p, 'rev-parse', '--show-toplevel').trim().replace(/\//g, path.sep);
  } catch {
    throw new Error(`'${p}' não parece ser um repositório git.`);
  }
}

interface Ref {
  type: string;
  name: string;
}

function parseRefs(raw: string): Ref[] {
  const refs: Ref[] = [];
  if (!raw) return refs;
  for (let token of raw.split(', ')) {
    token = token.trim();
    if (!token || token.endsWith('/HEAD')) continue;
    if (token.startsWith('HEAD -> '))
      refs.push({ type: 'head_branch', name: token.slice(8) });
    else if (token === 'HEAD')
      refs.push({ type: 'detached_head', name: 'HEAD' });
    else if (token.startsWith('tag: '))
      refs.push({ type: 'tag', name: token.slice(5) });
    else if (/^(origin|upstream|refs\/remotes)\//.test(token))
      refs.push({ type: 'remote', name: token });
    else refs.push({ type: 'branch', name: token });
  }
  return refs;
}

function collectRepoData(repo: string, maxCommits: number) {
  const fmt =
    ['%H', '%h', '%P', '%an', '%ae', '%aI', '%D', '%s'].join(FIELD_SEP) +
    RECORD_SEP;

  const raw = runGit(
    repo, 'log', '--all', '--topo-order',
    `--max-count=${maxCommits}`, `--pretty=format:${fmt}`,
  );

  const commits: any[] = [];
  for (let record of raw.split(RECORD_SEP)) {
    record = record.replace(/^[\n\r ]+|[\n\r ]+$/g, '');
    if (!record) continue;
    const parts = record.split(FIELD_SEP);
    if (parts.length < 8) continue;
    const [full, short, parents, author, email, date, refsRaw, subject] = parts;
    commits.push({
      hash: full, short, parents: parents ? parents.split(' ') : [],
      author, email, date, refs: parseRefs(refsRaw), subject,
    });
  }

  let currentBranch = 'HEAD';
  try { currentBranch = runGit(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim(); } catch {}

  let headHash: string | null = null;
  try { headHash = runGit(repo, 'rev-parse', 'HEAD').trim(); } catch {}

  const wip: any = { modified: 0, added: 0, deleted: 0, untracked: 0 };
  try {
    for (const line of runGit(repo, 'status', '--porcelain').split('\n')) {
      if (!line) continue;
      const code = line.slice(0, 2);
      if (code.startsWith('??')) wip.untracked++;
      else if (code.includes('D')) wip.deleted++;
      else if (code.includes('A')) wip.added++;
      else wip.modified++;
    }
  } catch {}
  wip.total = wip.modified + wip.added + wip.deleted + wip.untracked;

  return { commits, currentBranch, headHash, wip, repoName: path.basename(repo) };
}

function computeLayout(commits: any[]) {
  const index: Record<string, number> = {};
  commits.forEach((c, i) => { index[c.hash] = i; });

  const lanes: any[] = [];
  const edges: any[] = [];
  let maxLanes = 0;

  function allocLane(expectedHash: string) {
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] === null) {
        lanes[i] = { hash: expectedHash, color: i % PALETTE.length };
        return i;
      }
    }
    const i = lanes.length;
    lanes.push({ hash: expectedHash, color: i % PALETTE.length });
    return i;
  }

  for (let row = 0; row < commits.length; row++) {
    const c = commits[row];
    let matches = lanes
      .map((l: any, i: number) => (l && l.hash === c.hash ? i : -1))
      .filter((i: number) => i >= 0);

    let lane: number;
    if (matches.length > 0) {
      lane = matches[0];
    } else {
      lane = allocLane(c.hash);
      matches = [lane];
    }

    c.row = row;
    c.lane = lane;
    c.color = lanes[lane].color;

    for (let i = 1; i < matches.length; i++) lanes[matches[i]] = null;

    const parents = c.parents;
    if (parents.length > 0) {
      const first = parents[0];
      lanes[lane].hash = first;
      if (first in index) {
        edges.push({
          childRow: row, childLane: lane,
          parentHash: first, routeLane: lane, color: lanes[lane].color,
        });
      }
      for (let pi = 1; pi < parents.length; pi++) {
        const p = parents[pi];
        if (!(p in index)) continue;
        const existing = lanes.findIndex((l: any) => l && l.hash === p);
        const route = existing >= 0 ? existing : allocLane(p);
        edges.push({
          childRow: row, childLane: lane,
          parentHash: p, routeLane: route, color: lanes[route].color,
        });
      }
    } else {
      lanes[lane] = null;
    }

    maxLanes = Math.max(maxLanes, lanes.length);
  }

  const resolved = edges.map((e: any) => {
    const p = commits[index[e.parentHash]];
    return {
      c: [e.childRow, e.childLane],
      p: [p.row, p.lane],
      r: e.routeLane,
      k: e.color,
    };
  });

  return { edges: resolved, maxLanes };
}

// ---------------------------------------------------------------------------
// Avatar cache (GitHub)
// ---------------------------------------------------------------------------

const avatarCache = new Map<string, string>(); // email → data:image/...

function parseGitHubRemote(repo: string): string | null {
  try {
    const remote = runGit(repo, 'remote', 'get-url', 'origin').trim();
    const m = remote.match(/github\.com[:/]([^/]+\/[^/.]+)/);
    return m ? m[1].replace(/\.git$/, '') : null;
  } catch { return null; }
}

async function downloadAvatar(url: string): Promise<string> {
  const imgRes = await net.fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!imgRes.ok) return '';
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const ct = imgRes.headers.get('content-type') || 'image/png';
  return `data:${ct};base64,${buf.toString('base64')}`;
}

async function fetchAvatarsFromGitHub(
  repoSlug: string,
  emails: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const pending = new Set(emails);
  try {
    // Fetch enough pages to cover all unique emails
    const res = await net.fetch(
      `https://api.github.com/repos/${repoSlug}/commits?per_page=100`,
      { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'GitShark' } },
    );
    if (!res.ok) return result;
    const data: any[] = await res.json();

    for (const item of data) {
      const email = item.commit?.author?.email?.trim().toLowerCase();
      if (!email || !pending.has(email)) continue;
      const avatarUrl = item.author?.avatar_url;
      if (!avatarUrl) continue;
      result.set(email, avatarUrl);
      pending.delete(email);
      if (pending.size === 0) break;
    }
  } catch {}
  return result;
}

async function fetchAvatars(
  commits: { author: string; email: string; g: string }[],
  repoPath: string,
): Promise<Record<string, string>> {
  // Collect unique emails and map email → hashes
  const emailToHashes = new Map<string, string[]>();
  for (const c of commits) {
    const email = c.email.trim().toLowerCase();
    if (!emailToHashes.has(email)) emailToHashes.set(email, []);
    const arr = emailToHashes.get(email)!;
    if (!arr.includes(c.g)) arr.push(c.g);
  }

  const uniqueEmails = [...emailToHashes.keys()];
  const emailAvatars = new Map<string, string>();

  // 1. Check cache first
  const uncached: string[] = [];
  for (const email of uniqueEmails) {
    if (avatarCache.has(email)) emailAvatars.set(email, avatarCache.get(email)!);
    else uncached.push(email);
  }

  // 2. For uncached: resolve avatar URLs via GitHub repo commits API
  if (uncached.length > 0) {
    const slug = parseGitHubRemote(repoPath);
    const avatarUrls = slug
      ? await fetchAvatarsFromGitHub(slug, uncached)
      : new Map<string, string>();

    // 3. Handle noreply emails as fallback
    for (const email of uncached) {
      if (avatarUrls.has(email)) continue;
      const m = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/);
      if (m) avatarUrls.set(email, `https://avatars.githubusercontent.com/${m[1]}?s=64`);
    }

    // 4. Download images in parallel and cache
    await Promise.all(
      uncached.map(async (email) => {
        const url = avatarUrls.get(email);
        if (!url) { avatarCache.set(email, ''); return; }
        const dataUrl = await downloadAvatar(`${url}${url.includes('?') ? '&' : '?'}s=64`);
        avatarCache.set(email, dataUrl);
        emailAvatars.set(email, dataUrl);
      }),
    );
  }

  // Build author → emails groups (same person may use different emails)
  const byAuthor = new Map<string, Set<string>>();
  for (const c of commits) {
    const name = c.author.trim().toLowerCase();
    if (!byAuthor.has(name)) byAuthor.set(name, new Set());
    byAuthor.get(name)!.add(c.email.trim().toLowerCase());
  }

  // For each author, find the best avatar across all their emails
  const bestByEmail = new Map<string, string>();
  for (const emails of byAuthor.values()) {
    let bestUrl = '';
    for (const e of emails) {
      const url = emailAvatars.get(e) || '';
      if (url) { bestUrl = url; break; }
    }
    if (bestUrl) for (const e of emails) bestByEmail.set(e, bestUrl);
  }

  // Map hash → data URL
  const out: Record<string, string> = {};
  for (const [email, hashes] of emailToHashes) {
    const url = bestByEmail.get(email) || emailAvatars.get(email) || '';
    if (url) for (const h of hashes) out[h] = url;
  }
  return out;
}

// ---------------------------------------------------------------------------

async function buildPayload(repoPath: string, maxCommits = MAX_COMMITS) {
  const repo = resolveRepoRoot(repoPath);
  const { commits, currentBranch, headHash, wip, repoName } =
    collectRepoData(repo, maxCommits);

  if (commits.length === 0) {
    throw new Error('Este repositório ainda não tem commits.');
  }

  const { edges, maxLanes } = computeLayout(commits);

  const slim = commits.map((c: any) => {
    const words = c.author.split(/\s+/).slice(0, 2);
    const initials = words.map((w: string) => w[0] || '').join('').toUpperCase() || '?';
    const emailHash = crypto.createHash('md5').update(c.email.trim().toLowerCase()).digest('hex');
    const avatarHue = parseInt(emailHash, 16) % 360;
    return {
      h: c.hash, s: c.short, a: c.author,
      i: initials, hu: avatarHue, g: emailHash, d: c.date,
      m: c.subject, r: c.refs, l: c.lane,
      k: c.color, np: c.parents.length,
      mg: c.parents.length > 1 ? 1 : 0,
    };
  });

  const avatarInput = commits.map((c: any, i: number) => ({
    author: c.author, email: c.email, g: slim[i].g,
  }));
  const avatars = await fetchAvatars(avatarInput, repo);

  return {
    repoPath: repo, repoName,
    currentBranch, headHash,
    wip, commits: slim, edges,
    maxLanes, palette: PALETTE, avatars,
  };
}

// ---------------------------------------------------------------------------
// Electron App
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 500,
    title: 'GitShark',
    frame: false,
    backgroundColor: '#1a1f24',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// --- IPC Handlers ---

ipcMain.on('win-minimize', () => mainWindow?.minimize());
ipcMain.on('win-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('win-close', () => mainWindow?.close());

ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Selecione a pasta do repositório git',
    properties: ['openDirectory'],
  });
  if (result.canceled) return { cancelled: true };
  return { path: result.filePaths[0] };
});

ipcMain.handle('load-repo', async (_event, repoPath: string, maxCommits?: number) => {
  try {
    return await buildPayload(repoPath, maxCommits || MAX_COMMITS);
  } catch (err: any) {
    return { error: err.message };
  }
});

// --- App lifecycle ---

app.whenReady().then(createWindow);

app.on('window-all-closed', () => { app.quit(); });

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
