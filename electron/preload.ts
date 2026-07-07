import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  loadRepo: (path: string, maxCommits?: number) => ipcRenderer.invoke('load-repo', path, maxCommits),
  gitPull: (repoPath: string, mode?: 'default' | 'rebase' | 'ff-only') => ipcRenderer.invoke('git-pull', repoPath, mode),
  gitBranch: (repoPath: string, name: string, startPoint?: string) => ipcRenderer.invoke('git-branch', repoPath, name, startPoint),
  gitPush: (repoPath: string) => ipcRenderer.invoke('git-push', repoPath),
  gitStatusFiles: (repoPath: string) => ipcRenderer.invoke('git-status-files', repoPath),
  gitStageFile: (repoPath: string, filePath: string) => ipcRenderer.invoke('git-stage-file', repoPath, filePath),
  gitStageAll: (repoPath: string) => ipcRenderer.invoke('git-stage-all', repoPath),
  gitDiscardAll: (repoPath: string) => ipcRenderer.invoke('git-discard-all', repoPath),
  gitUnstageFile: (repoPath: string, filePath: string) => ipcRenderer.invoke('git-unstage-file', repoPath, filePath),
  gitCommitFiles: (repoPath: string, hash: string) => ipcRenderer.invoke('git-commit-files', repoPath, hash),
  gitCommit: (repoPath: string, summary: string, description: string) => ipcRenderer.invoke('git-commit', repoPath, summary, description),
  gitCheckoutBranch: (repoPath: string, name: string) => ipcRenderer.invoke('git-checkout-branch', repoPath, name),
  gitMergeBranch: (repoPath: string, selectedBranch: string, targetBranch: string) => ipcRenderer.invoke('git-merge-branch', repoPath, selectedBranch, targetBranch),
  gitRebaseBranch: (repoPath: string, selectedBranch: string, targetBranch: string, interactive?: boolean) => ipcRenderer.invoke('git-rebase-branch', repoPath, selectedBranch, targetBranch, interactive),
  gitDeleteBranch: (repoPath: string, name: string, local: boolean, remote: boolean) => ipcRenderer.invoke('git-delete-branch', repoPath, name, local, remote),
  gitRenameBranch: (repoPath: string, oldName: string, newName: string) => ipcRenderer.invoke('git-rename-branch', repoPath, oldName, newName),
  gitResetCommit: (repoPath: string, branchName: string, commitHash: string, mode: 'soft' | 'mixed' | 'hard') => ipcRenderer.invoke('git-reset-commit', repoPath, branchName, commitHash, mode),
  gitRevertCommit: (repoPath: string, commitHash: string) => ipcRenderer.invoke('git-revert-commit', repoPath, commitHash),
  gitCherryPickCommit: (repoPath: string, commitHash: string) => ipcRenderer.invoke('git-cherry-pick-commit', repoPath, commitHash),
  onRepoChanged: (cb: (repoPath: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, repoPath: string) => cb(repoPath);
    ipcRenderer.on('repo-changed', handler);
    return () => ipcRenderer.off('repo-changed', handler);
  },
  winMinimize: () => ipcRenderer.send('win-minimize'),
  winMaximize: () => ipcRenderer.send('win-maximize'),
  winClose: () => ipcRenderer.send('win-close'),
});
