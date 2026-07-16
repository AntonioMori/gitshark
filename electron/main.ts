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
    for (const line of runGit(repo, '-c', 'core.quotepath=false', 'status', '--porcelain', '-u').split('\n')) {
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

function computeLayout(commits: any[], currentBranch: string, headHash: string | null) {
  const index: Record<string, number> = {};
  commits.forEach((c: any, i: number) => { index[c.hash] = i; });

  const pinnedColumns: Record<string, number> = {};
  
  // Trace main/master chain to col 0
  const mainHeads: string[] = [];
  commits.forEach((c: any) => {
    const isMain = c.refs.some(
      (r: any) => r.name === 'main' || r.name === 'master' || r.name.endsWith('/main') || r.name.endsWith('/master')
    );
    if (isMain) mainHeads.push(c.hash);
  });
  mainHeads.forEach((h) => {
    let curr: string | null = h;
    while (curr && curr in index) {
      const activeHash = curr;
      pinnedColumns[activeHash] = 0;
      const c: any = commits[index[activeHash]];
      curr = c.parents && c.parents.length > 0 ? c.parents[0] : null;
    }
  });

  // PASS 1: Rough column assignment to determine final columns of all commits
  const pass1Lanes: (string | null)[] = [];
  function allocPass1Lane(hash: string) {
    if (pinnedColumns[hash] !== undefined) {
      const col = pinnedColumns[hash];
      if (pass1Lanes[col] === null || pass1Lanes[col] === undefined) {
        pass1Lanes[col] = hash;
        return col;
      }
      return col;
    }
    const startCol = 0;
    for (let i = startCol; i < pass1Lanes.length; i++) {
      if (pass1Lanes[i] === null) {
        pass1Lanes[i] = hash;
        return i;
      }
    }
    const i = Math.max(startCol, pass1Lanes.length);
    while (pass1Lanes.length < i) pass1Lanes.push(null);
    pass1Lanes[i] = hash;
    return i;
  }

  const tempCommits = JSON.parse(JSON.stringify(commits));
  for (let row = 0; row < tempCommits.length; row++) {
    const c = tempCommits[row];
    c.row = row;
    let lane = pass1Lanes.indexOf(c.hash);
    if (lane < 0) {
      lane = allocPass1Lane(c.hash);
    }
    c.lane = lane;
    pass1Lanes[lane] = null;
    const parents = c.parents;
    if (parents.length > 0) {
      const first = parents[0];
      pass1Lanes[lane] = first;

      const colsForFirst = [lane];
      for (let i = 0; i < pass1Lanes.length; i++) {
        if (i !== lane && pass1Lanes[i] && pass1Lanes[i] === first) colsForFirst.push(i);
      }

      if (colsForFirst.length > 1) {
        let winnerCol: number;
        if (pinnedColumns[first] !== undefined && colsForFirst.includes(pinnedColumns[first])) {
          winnerCol = pinnedColumns[first];
        } else {
          // Resolve conflict in Pass 1 using "more commits wins"
          const childRows = colsForFirst.map(col => {
            const child = tempCommits.slice(0, row).reverse().find((lc: any) => lc.lane === col && lc.parents.includes(first));
            return child ? child.row : row;
          });
          const minRow = Math.min(...childRows);
          
          winnerCol = colsForFirst[0];
          let maxCommits = -1;
          for (const col of colsForFirst) {
            let count = 0;
            for (let r = minRow; r < row; r++) {
              if (tempCommits[r].lane === col) count++;
            }
            if (count > maxCommits) {
              maxCommits = count;
              winnerCol = col;
            } else if (count === maxCommits) {
              if (col < winnerCol) winnerCol = col;
            }
          }
        }

        // Keep only winnerCol
        pass1Lanes[winnerCol] = first;
        for (const col of colsForFirst) {
          if (col !== winnerCol) pass1Lanes[col] = null;
        }
      }

      for (let pi = 1; pi < parents.length; pi++) {
        const p = parents[pi];
        if (p in index) {
          const route = pass1Lanes.indexOf(p);
          if (route < 0) {
            allocPass1Lane(p);
          }
        }
      }
    }
  }

  const pass1Columns: Record<string, number> = {};
  tempCommits.forEach((c: any) => { pass1Columns[c.hash] = c.lane; });

  // PASS 2: Real layout computation
  const lanes: any[] = [];
  const edges: any[] = [];
  let maxLanes = 0;

  function allocLane(expectedHash: string) {
    if (pinnedColumns[expectedHash] !== undefined) {
      const col = pinnedColumns[expectedHash];
      if (lanes[col] === null || lanes[col] === undefined) {
        lanes[col] = { hash: expectedHash, color: col % PALETTE.length };
        return col;
      }
      return col;
    } else {
      const start = 0;
      for (let i = start; i < lanes.length; i++) {
        if (lanes[i] === null) {
          lanes[i] = { hash: expectedHash, color: i % PALETTE.length };
          return i;
        }
      }
      const i = lanes.length;
      lanes.push({ hash: expectedHash, color: i % PALETTE.length });
      return i;
    }
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

      // Keep first parent in current lane to keep branches straight (similar to GitKraken)
      const colsForFirst = [lane];
      for (let i = 0; i < lanes.length; i++) {
        if (i !== lane && lanes[i] && lanes[i].hash === first) colsForFirst.push(i);
      }
      if (colsForFirst.length > 1) {
        const winnerCol = Math.min(...colsForFirst);
        for (const col of colsForFirst) {
          if (col !== winnerCol) {
            lanes[col] = null;
          }
        }
      }

      const routeLane = lane;
      if (first in index) {
        edges.push({
          childRow: row, childLane: lane,
          parentHash: first, routeLane, color: lanes[routeLane]?.color ?? (routeLane % PALETTE.length),
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
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();
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

    // 3. Handle noreply emails and Gravatar as fallback
    for (const email of uncached) {
      if (avatarUrls.has(email)) continue;
      const m = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/);
      if (m) {
        avatarUrls.set(email, `https://avatars.githubusercontent.com/${m[1]}?s=64`);
      } else {
        const emailHash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
        avatarUrls.set(email, `https://www.gravatar.com/avatar/${emailHash}?d=404`);
      }
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

  const { edges, maxLanes } = computeLayout(commits, currentBranch, headHash);

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

  let remoteUrl = '';
  try {
    remoteUrl = runGit(repo, 'remote', 'get-url', 'origin').trim();
  } catch {}

  return {
    repoPath: repo, repoName,
    currentBranch, headHash,
    wip, commits: slim, edges,
    maxLanes, palette: PALETTE, avatars,
    remoteUrl,
  };
}

// ---------------------------------------------------------------------------
// Repo Watcher
// ---------------------------------------------------------------------------

const repoWatchers = new Map<string, { watcher: fs.FSWatcher; timer: ReturnType<typeof setTimeout> | null }>();

function startWatching(repoRoot: string) {
  if (repoWatchers.has(repoRoot)) return;
  const gitDir = path.join(repoRoot, '.git');
  if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) return;

  const entry: { watcher: fs.FSWatcher; timer: ReturnType<typeof setTimeout> | null } = { watcher: null as any, timer: null };

  entry.watcher = fs.watch(gitDir, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const name = filename.toString().replace(/\\/g, '/');
    // Ignore lock files and noisy internal git temp files
    if (name.endsWith('.lock') || name.includes('/.git/') || name === 'index.lock') return;

    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      entry.timer = null;
      mainWindow?.webContents.send('repo-changed', repoRoot);
    }, 600);
  });

  entry.watcher.on('error', () => {
    repoWatchers.delete(repoRoot);
  });

  repoWatchers.set(repoRoot, entry);
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
    icon: path.join(app.getAppPath(), 'src/assets/logo/logo.png'),
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
    const result = await buildPayload(repoPath, maxCommits || MAX_COMMITS);
    startWatching((result as any).repoPath ?? repoPath);
    return result;
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-pull', async (_event, repoPath: string, mode?: 'default' | 'rebase' | 'ff-only') => {
  try {
    const repo = resolveRepoRoot(repoPath);
    const args = ['pull'];
    if (mode === 'rebase') args.push('--rebase');
    else if (mode === 'ff-only') args.push('--ff-only');
    const output = runGit(repo, ...args);
    const payload = await buildPayload(repo);
    return { payload, output: output.trim() };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-branch', async (_event, repoPath: string, name: string, startPoint?: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    const args = ['checkout', '-b', name];
    if (startPoint) args.push(startPoint);
    runGit(repo, ...args);
    const payload = await buildPayload(repo);
    return { payload };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-push', async (_event, repoPath: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    const currentBranch = runGit(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim();

    let hasUpstream = false;
    try {
      runGit(repo, 'rev-parse', '--abbrev-ref', '@{u}');
      hasUpstream = true;
    } catch {}

    let output = '';
    if (hasUpstream) {
      output = runGit(repo, 'push');
    } else {
      output = runGit(repo, 'push', '-u', 'origin', currentBranch);
    }

    const payload = await buildPayload(repo);
    return { payload, output };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-status-files', async (_event, repoPath: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    const raw = runGit(repo, '-c', 'core.quotepath=false', 'status', '--porcelain', '-u');
    const staged: { path: string; status: string }[] = [];
    const unstaged: { path: string; status: string }[] = [];
    for (const line of raw.split('\n')) {
      if (line.length < 4) continue;
      const X = line[0];
      const Y = line[1];
      let filePath = line.slice(3);
      if (filePath.includes(' -> ')) filePath = filePath.split(' -> ')[1];
      filePath = filePath.trim();
      if (filePath.startsWith('"') && filePath.endsWith('"')) {
        filePath = filePath.slice(1, -1);
      }
      if (!filePath) continue;
      if (X !== ' ' && X !== '?') staged.push({ path: filePath, status: X });
      if (Y !== ' ' || X === '?') unstaged.push({ path: filePath, status: X === '?' ? '?' : Y });
    }
    return { staged, unstaged };
  } catch (err: any) {
    return { error: err.message, staged: [], unstaged: [] };
  }
});

ipcMain.handle('git-stage-file', async (_event, repoPath: string, filePath: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    runGit(repo, 'add', '--', filePath);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-stage-all', async (_event, repoPath: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    runGit(repo, 'add', '-A');
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-unstage-file', async (_event, repoPath: string, filePath: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    try {
      runGit(repo, 'restore', '--staged', '--', filePath);
    } catch {
      runGit(repo, 'reset', 'HEAD', '--', filePath);
    }
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-discard-all', async (_event, repoPath: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    try { runGit(repo, 'restore', '.'); } catch { runGit(repo, 'checkout', '--', '.'); }
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-commit-files', async (_event, repoPath: string, hash: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    const raw = runGit(repo, 'show', '--format=', '--name-status', hash);
    const files: { path: string; status: string }[] = [];
    for (const line of raw.split('\n')) {
      if (line.length < 2) continue;
      const parts = line.split('\t');
      if (parts.length < 2) continue;
      const status = parts[0][0];
      const filePath = (parts.length > 2 ? parts[2] : parts[1]).trim();
      if (filePath && status) files.push({ path: filePath, status });
    }
    return { files };
  } catch (err: any) {
    return { error: err.message, files: [] };
  }
});

ipcMain.handle('git-commit', async (_event, repoPath: string, summary: string, description: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    const args = ['commit', '-m', summary];
    if (description && description.trim()) args.push('-m', description.trim());
    const output = runGit(repo, ...args);
    const payload = await buildPayload(repo);
    return { payload, output: output.trim() };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-checkout-branch', async (_event, repoPath: string, name: string, mode: 'local' | 'track' | 'detached' = 'local', commitHash?: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    if (mode === 'detached') {
      runGit(repo, 'checkout', '--detach', commitHash || name);
    } else if (mode === 'track') {
      const localName = name.split('/').slice(1).join('/');
      try {
        runGit(repo, 'checkout', '-b', localName, name);
      } catch (err: any) {
        try {
          runGit(repo, 'checkout', localName);
        } catch {
          throw err;
        }
      }
    } else {
      runGit(repo, 'checkout', name);
    }
    const payload = await buildPayload(repo);
    return { payload };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-merge-branch', async (_event, repoPath: string, selectedBranch: string, targetBranch: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    const current = runGit(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
    if (current !== targetBranch) {
      runGit(repo, 'checkout', targetBranch);
    }
    const output = runGit(repo, 'merge', selectedBranch);
    const payload = await buildPayload(repo);
    return { payload, output: output.trim() };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-rebase-branch', async (_event, repoPath: string, selectedBranch: string, targetBranch: string, interactive?: boolean) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    if (interactive) {
      const current = runGit(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
      if (current !== selectedBranch) {
        runGit(repo, 'checkout', selectedBranch);
      }
      const output = runGit(repo, 'rebase', targetBranch);
      const payload = await buildPayload(repo);
      return { payload, output: `[Interactive Rebase Mocked] ${output.trim()}` };
    }
    const current = runGit(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
    if (current !== selectedBranch) {
      runGit(repo, 'checkout', selectedBranch);
    }
    const output = runGit(repo, 'rebase', targetBranch);
    const payload = await buildPayload(repo);
    return { payload, output: output.trim() };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-delete-branch', async (_event, repoPath: string, name: string, local: boolean, remote: boolean) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    let errorMsg = '';
    if (local) {
      try {
        runGit(repo, 'branch', '-D', name);
      } catch (err: any) {
        errorMsg += `Local: ${err.message}. `;
      }
    }
    if (remote) {
      try {
        const remoteBranch = name.replace(/^origin\//, '');
        runGit(repo, 'push', 'origin', '--delete', remoteBranch);
      } catch (err: any) {
        errorMsg += `Remote: ${err.message}. `;
      }
    }
    if (errorMsg) {
      throw new Error(errorMsg);
    }
    const payload = await buildPayload(repo);
    return { payload };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-rename-branch', async (_event, repoPath: string, oldName: string, newName: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    runGit(repo, 'branch', '-m', oldName, newName);
    const payload = await buildPayload(repo);
    return { payload };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-reset-commit', async (_event, repoPath: string, branchName: string, commitHash: string, mode: 'soft' | 'mixed' | 'hard') => {
  try {
    const repo = resolveRepoRoot(repoPath);
    const current = runGit(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
    if (current !== branchName) {
      runGit(repo, 'checkout', branchName);
    }
    runGit(repo, 'reset', `--${mode}`, commitHash);
    const payload = await buildPayload(repo);
    return { payload };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-revert-commit', async (_event, repoPath: string, commitHash: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    runGit(repo, 'revert', '--no-edit', commitHash);
    const payload = await buildPayload(repo);
    return { payload };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-cherry-pick-commit', async (_event, repoPath: string, commitHash: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    runGit(repo, 'cherry-pick', commitHash);
    const payload = await buildPayload(repo);
    return { payload };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('git-diff-file', async (_event, repoPath: string, filePath: string, context: 'staged' | 'unstaged' | 'commit', commitHash?: string) => {
  try {
    const repo = resolveRepoRoot(repoPath);
    let diff = '';
    if (context === 'unstaged') {
      // Try normal diff first
      diff = runGit(repo, 'diff', '-U99999', '--', filePath);
      // If empty, file might be untracked — generate a synthetic all-added diff
      if (!diff.trim()) {
        const absPath = path.join(repo, filePath);
        if (fs.existsSync(absPath)) {
          const content = fs.readFileSync(absPath, 'utf-8');
          const lines = content.split('\n');
          // Remove trailing empty line from split
          if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
          diff = `diff --git a/${filePath} b/${filePath}\nnew file mode 100644\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(l => '+' + l).join('\n')}\n`;
        }
      }
    } else if (context === 'staged') {
      diff = runGit(repo, 'diff', '--cached', '-U99999', '--', filePath);
      // If empty, file might be newly staged (status A) — diff HEAD vs index
      if (!diff.trim()) {
        try {
          const content = runGit(repo, 'show', `:${filePath}`);
          const lines = content.split('\n');
          if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
          diff = `diff --git a/${filePath} b/${filePath}\nnew file mode 100644\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(l => '+' + l).join('\n')}\n`;
        } catch { /* ignore */ }
      }
    } else if (context === 'commit' && commitHash) {
      let isRoot = false;
      try {
        runGit(repo, 'rev-parse', `${commitHash}^`);
      } catch {
        isRoot = true;
      }
      if (isRoot) {
        // Root commit — show entire file as added
        try {
          const content = runGit(repo, 'show', `${commitHash}:${filePath}`);
          const lines = content.split('\n');
          if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
          diff = `diff --git a/${filePath} b/${filePath}\nnew file mode 100644\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(l => '+' + l).join('\n')}\n`;
        } catch { /* ignore */ }
      } else {
        diff = runGit(repo, 'diff', '-U99999', `${commitHash}^`, commitHash, '--', filePath);
      }
    }
    return { diff };
  } catch (err: any) {
    return { error: err.message, diff: '' };
  }
});

// --- App lifecycle ---

app.whenReady().then(createWindow);

app.on('window-all-closed', () => { app.quit(); });

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
