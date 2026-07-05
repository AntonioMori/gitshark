import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';

import type { RepoPayload } from 'src/types/electron';

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
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg: string) => setToast(msg), []);

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
      {activePayload && <ActionBar payload={activePayload} />}

      {/* Workspace */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {activePayload ? (
          <CommitGraph
            payload={activePayload}
            selectedIdx={activeSelected}
            onSelectRow={selectRow}
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

      <Snackbar
        open={!!toast}
        message={toast}
        autoHideDuration={2600}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: 40 }}
      />
    </Box>
  );
}
