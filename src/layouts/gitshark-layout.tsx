import { useState, useCallback, useEffect, useRef } from 'react';

import Box from '@mui/material/Box';
import { Toaster, toast } from 'sonner';

import type { RepoPayload, PullMode } from 'src/types/electron';

import { TitleBar } from './title-bar';
import { MenuBar } from './menu-bar';
import { Toolbar } from './toolbar';
import { ActionBar } from './action-bar';
import { WelcomeScreen } from 'src/sections/workspace/welcome-screen';
import { CommitGraph } from 'src/sections/workspace/commit-graph/commit-graph';
import { StatusBar } from 'src/sections/workspace/status-bar';
import { CommitSidebar } from './commit-sidebar';
import { CommitDetail } from './sidebar/commit-detail';
import { DiffViewer } from 'src/sections/workspace/diff-viewer/diff-viewer';
import type { DiffContext } from 'src/sections/workspace/diff-viewer/diff-viewer';

// ----------------------------------------------------------------------

const MAX_TABS = 5;
const SESSION_KEY = 'gitshark:session';

type PersistedSession = { paths: string[]; activeIdx: number };

type Tab = {
  payload: RepoPayload;
  scrollTop: number;
  selectedIdx: number;
};

export function GitSharkLayout() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState(-1);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [diffTarget, setDiffTarget] = useState<{ path: string; context: DiffContext; commitHash?: string } | null>(null);

  const showToast = useCallback((msg: string) => {
    if (msg.toLowerCase().includes('erro') || msg.toLowerCase().includes('não foi') || msg.toLowerCase().includes('máximo')) {
      toast.error(msg);
    } else if (msg.toLowerCase().includes('sucesso') || msg.toLowerCase().includes('atualizado')) {
      toast.success(msg);
    } else {
      toast(msg);
    }
  }, []);

  // Guard: only save after restore completes (prevents overwriting storage on first render)
  const canSaveRef = useRef(false);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        try {
          const { paths, activeIdx } = JSON.parse(raw) as PersistedSession;
          if (Array.isArray(paths) && paths.length > 0) {
            const results = await Promise.allSettled(
              paths.slice(0, MAX_TABS).map((p) => window.api.loadRepo(p))
            );
            const loaded: Tab[] = [];
            const origIdxs: number[] = [];
            results.forEach((r, i) => {
              if (r.status === 'fulfilled' && r.value && !('error' in r.value)) {
                loaded.push({ payload: r.value, scrollTop: 0, selectedIdx: -1 });
                origIdxs.push(i);
              }
            });
            if (loaded.length > 0) {
              setTabs(loaded);
              const ai = origIdxs.indexOf(activeIdx);
              setActiveTab(ai >= 0 ? ai : 0);
            }
          }
        } catch {
          // ignore corrupt data
        }
      }
      canSaveRef.current = true;
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh when external git changes are detected (e.g. commit from terminal)
  useEffect(() => {
    const unsub = window.api.onRepoChanged((changedPath) => {
      window.api.loadRepo(changedPath).then((result) => {
        if ('error' in result) return;
        setTabs((prev) =>
          prev.map((t) =>
            t.payload.repoPath === changedPath ? { ...t, payload: result as RepoPayload } : t
          )
        );
      });
    });
    return unsub;
  }, []);

  // Persist session whenever tabs or activeTab change
  useEffect(() => {
    if (!canSaveRef.current) return;
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        paths: tabs.map((t) => t.payload.repoPath),
        activeIdx: activeTab,
      } satisfies PersistedSession)
    );
  }, [tabs, activeTab]);

  const activePayload = activeTab >= 0 && tabs[activeTab] ? tabs[activeTab].payload : null;
  const activeSelected = activeTab >= 0 && tabs[activeTab] ? tabs[activeTab].selectedIdx : -1;
  const activeCommit = activePayload && activeSelected >= 0
    ? activePayload.commits[activeSelected]
    : null;

  // --- Open repo ---
  const openRepo = useCallback(async () => {
    if (tabs.length >= MAX_TABS) {
      showToast('Máximo de 5 repositórios abertos — feche uma aba primeiro.');
      return;
    }
    let result: any;
    try {
      result = await window.api.pickFolder();
    } catch {
      showToast('Não foi possível abrir o seletor de pastas.');
      return;
    }
    if (result.cancelled || !result.path) return;

    let payload: any;
    try {
      payload = await window.api.loadRepo(result.path);
    } catch {
      showToast('Erro de comunicação com o processo principal.');
      return;
    }
    if (payload.error) { showToast(payload.error); return; }

    setTabs((prev) => {
      const existing = prev.findIndex((t) => t.payload.repoPath === payload.repoPath);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], payload };
        setActiveTab(existing);
        showToast('Este repositório já estava aberto — aba atualizada.');
        return updated;
      }
      const newTabs = [...prev, { payload, scrollTop: 0, selectedIdx: -1 }];
      setActiveTab(newTabs.length - 1);
      return newTabs;
    });
  }, [tabs.length, showToast]);

  // --- Tab actions ---
  const activateTab = useCallback((i: number) => setActiveTab(i), []);

  const closeTab = useCallback((i: number) => {
    setTabs((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      setActiveTab((curr) => {
        if (next.length === 0) return -1;
        if (i < curr) return curr - 1;
        if (i === curr) return Math.min(curr, next.length - 1);
        return curr;
      });
      return next;
    });
  }, []);

  // --- Row selection ---
  const selectRow = useCallback((idx: number) => {
    setTabs((prev) => {
      const updated = [...prev];
      const tab = updated[activeTab];
      if (!tab) return prev;
      updated[activeTab] = {
        ...tab,
        selectedIdx: tab.selectedIdx === idx ? -1 : idx,
      };
      return updated;
    });
  }, [activeTab]);

  const handleRefresh = useCallback((newPayload: RepoPayload) => {
    setTabs((prev) => {
      const updated = [...prev];
      if (updated[activeTab]) {
        updated[activeTab] = { ...updated[activeTab], payload: newPayload };
      }
      return updated;
    });
  }, [activeTab]);

  const closeDetail = useCallback(() => {
    setDiffTarget(null);
    setTabs((prev) => {
      const updated = [...prev];
      const tab = updated[activeTab];
      if (!tab) return prev;
      updated[activeTab] = { ...tab, selectedIdx: -1 };
      return updated;
    });
  }, [activeTab]);

  const handleSelectFileForDiff = useCallback((path: string, context: DiffContext, commitHash?: string) => {
    setDiffTarget({ path, context, commitHash });
  }, []);

  const closeDiff = useCallback(() => {
    setDiffTarget(null);
  }, []);

  // --- Pull ---
  const handlePull = useCallback(async (mode: PullMode) => {
    const tab = tabs[activeTab];
    if (!tab || pulling) return;

    setPulling(true);
    try {
      const result = await window.api.gitPull(tab.payload.repoPath, mode);
      if (result.error) {
        showToast(result.error);
      } else if (result.payload) {
        setTabs((prev) => {
          const updated = [...prev];
          updated[activeTab] = { ...updated[activeTab], payload: result.payload! };
          return updated;
        });
        const msg = result.output?.includes('Already up to date')
          ? 'Já está atualizado.'
          : 'Pull realizado com sucesso.';
        showToast(msg);
      }
    } catch (err: any) {
      showToast(`Erro ao executar pull: ${err.message || err}`);
    } finally {
      setPulling(false);
    }
  }, [tabs, activeTab, pulling, showToast]);

  // --- Push ---
  const handlePush = useCallback(async () => {
    const tab = tabs[activeTab];
    if (!tab || pushing) return;

    setPushing(true);
    try {
      const result = await window.api.gitPush(tab.payload.repoPath);
      if (result.error) {
        showToast(result.error);
      } else if (result.payload) {
        setTabs((prev) => {
          const updated = [...prev];
          updated[activeTab] = { ...updated[activeTab], payload: result.payload! };
          return updated;
        });
        showToast('Push realizado com sucesso.');
      }
    } catch (err: any) {
      showToast(`Erro ao executar push: ${err.message || err}`);
    } finally {
      setPushing(false);
    }
  }, [tabs, activeTab, pushing, showToast]);

  // --- Create Branch ---
  const handleCreateBranch = useCallback(async (name: string) => {
    const tab = tabs[activeTab];
    if (!tab) return;
    try {
      const result = await window.api.gitBranch(tab.payload.repoPath, name);
      if (result.error) {
        showToast(result.error);
      } else if (result.payload) {
        setTabs((prev) => {
          const updated = [...prev];
          updated[activeTab] = { ...updated[activeTab], payload: result.payload! };
          return updated;
        });
        showToast(`Branch '${name}' criada com sucesso.`);
      }
    } catch (err: any) {
      showToast(`Erro ao criar branch: ${err.message || err}`);
    } finally {
      setCreatingBranch(false);
    }
  }, [tabs, activeTab, showToast]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflow: 'hidden' }}>
      <TitleBar />
      <MenuBar />
      <Toolbar
        tabs={tabs}
        activeTab={activeTab}
        onOpenRepo={openRepo}
        onActivateTab={activateTab}
        onCloseTab={closeTab}
      />
      {activePayload && (
        <ActionBar
          payload={activePayload}
          pulling={pulling}
          pushing={pushing}
          onPull={handlePull}
          onPush={handlePush}
          onBranchClick={() => setCreatingBranch(true)}
        />
      )}

      {/* Workspace */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {activePayload && diffTarget ? (
            <DiffViewer
              repoPath={activePayload.repoPath}
              filePath={diffTarget.path}
              context={diffTarget.context}
              commitHash={diffTarget.commitHash}
              onClose={closeDiff}
            />
          ) : activePayload ? (
            <CommitGraph
              payload={activePayload}
              selectedIdx={activeSelected}
              onSelectRow={selectRow}
              creatingBranch={creatingBranch}
              onCancelCreateBranch={() => setCreatingBranch(false)}
              onSubmitBranch={handleCreateBranch}
              onRefresh={handleRefresh}
            />
          ) : (
            <WelcomeScreen onOpenRepo={openRepo} />
          )}
        </Box>
        {activePayload && (
          activeSelected >= 0 && activeCommit ? (
            <CommitDetail
              commit={activeCommit}
              payload={activePayload}
              onClose={closeDetail}
              selectedFile={diffTarget?.path}
              onSelectFile={(path) => handleSelectFileForDiff(path, 'commit', activeCommit.h)}
            />
          ) : (
            <CommitSidebar
              payload={activePayload}
              onRefresh={handleRefresh}
              selectedFile={diffTarget?.path}
              onSelectFile={(path, ctx) => handleSelectFileForDiff(path, ctx)}
              onCommitSuccess={closeDiff}
            />
          )
        )}
      </Box>

      <StatusBar payload={activePayload} />

      <Toaster theme="dark" position="bottom-left" />
    </Box>
  );
}
