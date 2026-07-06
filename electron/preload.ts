import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  loadRepo: (path: string, maxCommits?: number) => ipcRenderer.invoke('load-repo', path, maxCommits),
  gitPull: (repoPath: string, mode?: 'default' | 'rebase' | 'ff-only') => ipcRenderer.invoke('git-pull', repoPath, mode),
  gitBranch: (repoPath: string, name: string) => ipcRenderer.invoke('git-branch', repoPath, name),
  gitPush: (repoPath: string) => ipcRenderer.invoke('git-push', repoPath),
  winMinimize: () => ipcRenderer.send('win-minimize'),
  winMaximize: () => ipcRenderer.send('win-maximize'),
  winClose: () => ipcRenderer.send('win-close'),
});
