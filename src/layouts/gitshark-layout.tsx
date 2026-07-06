import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import { Toaster, toast } from 'sonner';

import type { RepoPayload, PullMode } from 'src/types/electron';

import { TitleBar } from './title-bar';
import { MenuBar } from './menu-bar';
import { Toolbar } from './toolbar';
import { ActionBar } from './action-bar';
import { WelcomeScreen } from 'src/sections/workspace/welcome-screen';
import { CommitGraph } from 'src/sections/workspace/commit-graph/commit-graph';
import { DetailPanel } from 'src/sections/workspace/detail-panel';
import { StatusBar } from 'src/sections/workspace/status-bar';

// ----------------------------------------------------------------------

const MAX_TABS = 5;

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

  const showToast = useCallback((msg: string) => {
    if (msg.toLowerCase().includes('erro') || msg.toLowerCase().includes('não foi') || msg.toLowerCase().includes('máximo')) {
      toast.error(msg);
    } else if (msg.toLowerCase().includes('sucesso') || msg.toLowerCase().includes('atualizado')) {
      toast.success(msg);
    } else {
      toast(msg);
    }
  }, []);

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

  const closeDetail = useCallback(() => {
    setTabs((prev) => {
      const updated = [...prev];
      const tab = updated[activeTab];
      if (!tab) return prev;
      updated[activeTab] = { ...tab, selectedIdx: -1 };
      return updated;
    });
  }, [activeTab]);

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
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {activePayload ? (
          <CommitGraph
            payload={activePayload}
            selectedIdx={activeSelected}
            onSelectRow={selectRow}
            creatingBranch={creatingBranch}
            onCancelCreateBranch={() => setCreatingBranch(false)}
            onSubmitBranch={handleCreateBranch}
          />
        ) : (
          <WelcomeScreen onOpenRepo={openRepo} />
        )}
      </Box>

      {/* Detail panel */}
      <DetailPanel
        open={activeSelected >= 0}
        commit={activeCommit}
        payload={activePayload}
        onClose={closeDetail}
      />

      <StatusBar payload={activePayload} />

      <Toaster theme="dark" position="bottom-left" />
    </Box>
  );
}
