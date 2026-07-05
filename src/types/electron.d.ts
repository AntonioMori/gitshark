export interface ElectronAPI {
  pickFolder: () => Promise<{ cancelled?: boolean; path?: string }>;
  loadRepo: (path: string, maxCommits?: number) => Promise<RepoPayload | { error: string }>;
  winMinimize: () => void;
  winMaximize: () => void;
  winClose: () => void;
}

export interface RepoRef {
  type: 'head_branch' | 'detached_head' | 'branch' | 'remote' | 'tag';
  name: string;
}

export interface SlimCommit {
  h: string;   // full hash
  s: string;   // short hash
  a: string;   // author
  i: string;   // initials
  hu: number;  // avatar hue
  g: string;   // gravatar MD5 hash
  d: string;   // date ISO
  m: string;   // message/subject
  r: RepoRef[];
  l: number;   // lane
  k: number;   // color index
  np: number;  // number of parents
  mg: number;  // is merge (0 | 1)
}

export interface Edge {
  c: [number, number]; // [childRow, childLane]
  p: [number, number]; // [parentRow, parentLane]
  r: number;           // routeLane
  k: number;           // color index
}

export interface WipInfo {
  modified: number;
  added: number;
  deleted: number;
  untracked: number;
  total: number;
}

export interface RepoPayload {
  repoPath: string;
  repoName: string;
  currentBranch: string;
  headHash: string | null;
  wip: WipInfo;
  commits: SlimCommit[];
  edges: Edge[];
  maxLanes: number;
  palette: string[];
  avatars: Record<string, string>; // md5 → data:image URL
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
