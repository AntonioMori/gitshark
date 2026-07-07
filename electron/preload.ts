import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  loadRepo: (path: string, maxCommits?: number) => ipcRenderer.invoke('load-repo', path, maxCommits),
  gitPull: (repoPath: string, mode?: 'default' | 'rebase' | 'ff-only') => ipcRenderer.invoke('git-pull', repoPath, mode),
  gitBranch: (repoPath: string, name: string) => ipcRenderer.invoke('git-branch', repoPath, name),
  gitPush: (repoPath: string) => ipcRenderer.invoke('git-push', repoPath),
  gitStatusFiles: (repoPath: string) => ipcRenderer.invoke('git-status-files', repoPath),
  gitStageFile: (repoPath: string, filePath: string) => ipcRenderer.invoke('git-stage-file', repoPath, filePath),
  gitStageAll: (repoPath: string) => ipcRenderer.invoke('git-stage-all', repoPath),
  gitDiscardAll: (repoPath: string) => ipcRenderer.invoke('git-discard-all', repoPath),
  gitUnstageFile: (repoPath: string, filePath: string) => ipcRenderer.invoke('git-unstage-file', repoPath, filePath),
  gitCommitFiles: (repoPath: string, hash: string) => ipcRenderer.invoke('git-commit-files', repoPath, hash),
  gitCommit: (repoPath: string, summary: string, description: string) => ipcRenderer.invoke('git-commit', repoPath, summary, description),
  onRepoChanged: (cb: (repoPath: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, repoPath: string) => cb(repoPath);
    ipcRenderer.on('repo-changed', handler);
    return () => ipcRenderer.off('repo-changed', handler);
  },
  winMinimize: () => ipcRenderer.send('win-minimize'),
  winMaximize: () => ipcRenderer.send('win-maximize'),
  winClose: () => ipcRenderer.send('win-close'),
});
