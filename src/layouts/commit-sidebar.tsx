import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import { toast } from 'sonner';
import { Iconify } from 'src/components/iconify';
import type { RepoPayload, FileStatus } from 'src/types/electron';

// ─── Constants ───────────────────────────────────────────────────────────────

export const COMMIT_SIDEBAR_WIDTH = 380;
const SUMMARY_MAX = 72;

const BG      = '#272a31';
const BG_DARK = '#14171c';
const TEXT     = '#ffffff';
const MUTED    = '#8a94a6';
const GREEN    = '#2ea44f';
const ORANGE   = '#d97706';
const TEAL     = '#005f73';
const RED_BG   = '#4a2f33';
const BORDER   = 'rgba(255,255,255,0.08)';
const FONT     = '"Inter Variable", Inter, sans-serif';

const STATUS_ICON: Record<string, { icon: string; color: string }> = {
  M: { icon: 'mdi:pencil',                    color: '#de9b43' },
  A: { icon: 'ic:baseline-add',               color: '#5cb85c' },
  D: { icon: 'mdi:minus-circle-outline',      color: '#ef4444' },
  R: { icon: 'mdi:arrow-right-circle-outline', color: '#a78bfa' },
  '?': { icon: 'mdi:help-circle-outline',     color: MUTED   },
};

const iconBtn = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  bgcolor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  outline: 'none',
  borderRadius: '3px',
  p: '3px',
  color: MUTED,
  '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: TEXT },
} as const;

// ─── FileItem ─────────────────────────────────────────────────────────────────

function FileItem({ file, staged, onClick }: { file: FileStatus; staged?: boolean; onClick: () => void }) {
  const info = STATUS_ICON[file.status] ?? STATUS_ICON['?'];
  const normalized = file.path.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  const dir  = slash >= 0 ? normalized.slice(0, slash + 1) : '';
  const name = slash >= 0 ? normalized.slice(slash + 1)    : normalized;

  return (
    <Box
      component="button"
      onClick={onClick}
      title={staged ? `Unstage: ${file.path}` : `Stage: ${file.path}`}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75,
        width: '100%', px: 1.5, py: 0.75,
        bgcolor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        '&:hover': { bgcolor: '#2b3446' },
        outline: 'none', overflow: 'hidden', minWidth: 0,
      }}
    >
      <Iconify icon={info.icon} width={14} sx={{ color: info.color, flexShrink: 0 }} />
      <Typography noWrap sx={{ fontSize: 13, lineHeight: 1.5, minWidth: 0, fontFamily: FONT }}>
        <span style={{ color: '#777d88' }}>{dir}</span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{name}</span>
      </Typography>
    </Box>
  );
}

// ─── CommitSidebar ────────────────────────────────────────────────────────────

interface Props {
  payload: RepoPayload;
  onRefresh: (newPayload: RepoPayload) => void;
}

export function CommitSidebar({ payload, onRefresh }: Props) {
  const [staged,      setStaged]      = useState<FileStatus[]>([]);
  const [unstaged,    setUnstaged]    = useState<FileStatus[]>([]);
  const [unstagedOpen, setUnstagedOpen] = useState(true);
  const [stagedOpen,   setStagedOpen]   = useState(true);
  const [summary,     setSummary]     = useState('');
  const [description, setDescription] = useState('');
  const [amend,       setAmend]       = useState(false);
  const [committing,  setCommitting]  = useState(false);

  const loadStatus = useCallback(async () => {
    const result = await window.api.gitStatusFiles(payload.repoPath);
    if (!result.error) {
      setStaged(result.staged);
      setUnstaged(result.unstaged);
    }
  }, [payload.repoPath]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleStageAll = async () => {
    await window.api.gitStageAll(payload.repoPath);
    await loadStatus();
  };

  const handleStageFile = async (filePath: string) => {
    await window.api.gitStageFile(payload.repoPath, filePath);
    await loadStatus();
  };

  const handleUnstageFile = async (filePath: string) => {
    await window.api.gitUnstageFile(payload.repoPath, filePath);
    await loadStatus();
  };

  const handleCommit = async () => {
    if (!summary.trim() || staged.length === 0 || committing) return;
    setCommitting(true);
    try {
      const result = await window.api.gitCommit(payload.repoPath, summary.trim(), description);
      if (result.error) {
        toast.error(result.error);
      } else {
        setSummary('');
        setDescription('');
        await loadStatus();
        if (result.payload) onRefresh(result.payload);
        toast.success('Commit realizado com sucesso.');
      }
    } finally {
      setCommitting(false);
    }
  };

  const totalChanges = staged.length + unstaged.length;
  const canCommit    = staged.length > 0 && summary.trim().length > 0 && !committing;
  const remaining    = SUMMARY_MAX - summary.length;

  return (
    <Box sx={{
      width: COMMIT_SIDEBAR_WIDTH, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      bgcolor: BG, borderLeft: `1px solid ${BORDER}`,
      height: '100%', userSelect: 'none',
      fontFamily: FONT,
      '& *': { fontFamily: `${FONT} !important` },
    }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.75, py: 0.5, bgcolor: BG, borderBottom: `1px solid ${BORDER}`, minHeight: 36 }}>
        <Box
          component="button"
          sx={{
            ...iconBtn,
            bgcolor: RED_BG,
            border: '1px solid #d9413d',
            borderRadius: '4px',
            width: 24, height: 24, flexShrink: 0,
            '& .trash-icon': { opacity: 0.8, transition: 'opacity 0.15s' },
            '&:hover': { bgcolor: '#923839', '& .trash-icon': { opacity: 1 } },
          }}
          title="Descartar alterações"
        >
          <Iconify icon="solar:trash-bin-minimalistic-bold" width={13} className="trash-icon" sx={{ color: TEXT }} />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, overflow: 'hidden', ml: 0.75 }}>
          <Typography sx={{ fontSize: 12.5, color: MUTED, flexShrink: 0 }}>
            {totalChanges} file{totalChanges !== 1 ? 's' : ''} on
          </Typography>
          <Box sx={{ bgcolor: TEAL, px: 0.75, py: '2px', borderRadius: '3px', minWidth: 0, overflow: 'hidden' }}>
            <Typography noWrap sx={{ fontSize: 12, color: TEXT, fontWeight: 500, lineHeight: 1.5 }}>
              {payload.currentBranch}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── View Toggle ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 0.75, py: 0.35, borderBottom: `1px solid ${BORDER}`, minHeight: 30, gap: 0.5 }}>
        <Box component="button" sx={iconBtn} title="Ordenação">
          <Iconify icon="mdi:sort-alphabetical-ascending" width={16} />
        </Box>
        <Box sx={{ flex: 1 }} />
        {(['path', 'tree'] as const).map((m) => (
          <Typography
            key={m}
            component="button"
            sx={{
              fontSize: 12.5, fontWeight: m === 'path' ? 600 : 400,
              color: m === 'path' ? TEXT : MUTED,
              bgcolor: m === 'path' ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: 'none', borderRadius: '3px', px: 1, py: 0.3,
              cursor: 'pointer', outline: 'none',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            {m === 'path' ? '≡ Path' : '⌂ Tree'}
          </Typography>
        ))}
      </Box>

      {/* ── File List ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Unstaged */}
        <Box sx={{
          display: 'flex', flexDirection: 'column',
          flex: unstagedOpen ? 1 : 'none',
          maxHeight: unstagedOpen ? '50%' : 'none',
          minHeight: 0,
        }}>
          <Box
            onClick={() => setUnstagedOpen((v) => !v)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.6,
              cursor: 'pointer', flexShrink: 0,
              ...(unstagedOpen && { borderBottom: `1px solid ${BORDER}` }),
              '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', '& p': { color: '#e8e8e9' } },
            }}
          >
            <Iconify icon={unstagedOpen ? 'mdi:chevron-down' : 'mdi:chevron-right'} width={16} sx={{ color: MUTED, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 13, color: '#b8b9bb', fontWeight: 500, flex: 1, transition: 'color 0.15s' }}>
              Unstaged Files ({unstaged.length})
            </Typography>
            {unstaged.length > 0 && (
              <Box
                component="button"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleStageAll(); }}
                sx={{
                  fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500,
                  fontFamily: '"Inter Variable", Inter, sans-serif',
                  border: '1px solid #5cb85c', borderRadius: '3px',
                  px: 0.75, py: '2px', bgcolor: '#314739',
                  cursor: 'pointer', flexShrink: 0, outline: 'none',
                  '&:hover': { bgcolor: '#477f4b' },
                }}
              >
                Stage All Changes
              </Box>
            )}
          </Box>
          {unstagedOpen && (
            <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', '&::-webkit-scrollbar': { width: 0 } }}>
              {unstaged.map((f) => (
                <FileItem key={f.path} file={f} onClick={() => handleStageFile(f.path)} />
              ))}
            </Box>
          )}
        </Box>

        {/* Staged */}
        <Box sx={{
          display: 'flex', flexDirection: 'column',
          flex: stagedOpen ? 1 : 'none',
          minHeight: 0,
        }}>
          <Box
            onClick={() => setStagedOpen((v) => !v)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.6,
              cursor: 'pointer', flexShrink: 0,
              ...(stagedOpen && { borderBottom: `1px solid ${BORDER}` }),
              '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', '& p': { color: '#e8e8e9' } },
            }}
          >
            <Iconify icon={stagedOpen ? 'mdi:chevron-down' : 'mdi:chevron-right'} width={16} sx={{ color: MUTED, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 13, color: '#b8b9bb', fontWeight: 500, flex: 1, transition: 'color 0.15s' }}>
              Staged Files ({staged.length})
            </Typography>
            {staged.length > 0 && (
              <Box
                component="button"
                onClick={async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  await Promise.all(staged.map((f) => window.api.gitUnstageFile(payload.repoPath, f.path)));
                  await loadStatus();
                }}
                sx={{
                  fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500,
                  fontFamily: '"Inter Variable", Inter, sans-serif',
                  border: '1px solid #d9413d', borderRadius: '3px',
                  px: 0.75, py: '2px', bgcolor: '#4a2f33',
                  cursor: 'pointer', flexShrink: 0, outline: 'none',
                  '&:hover': { bgcolor: '#923839' },
                }}
              >
                Unstage All
              </Box>
            )}
          </Box>
          {stagedOpen && (
            <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', '&::-webkit-scrollbar': { width: 0 } }}>
              {staged.map((f) => (
                <FileItem key={f.path} file={f} staged onClick={() => handleUnstageFile(f.path)} />
              ))}
            </Box>
          )}
        </Box>

      </Box>

      {/* ── Commit Panel ── */}
      <Box sx={{ borderTop: `1px solid ${BORDER}`, bgcolor: BG, flexShrink: 0 }}>

        {/* Tabs */}
        <Box sx={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${BORDER}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.65, borderBottom: `2px solid ${TEXT}` }}>
            <Typography sx={{ fontSize: 12, color: MUTED, letterSpacing: '0.03em' }}>-o-</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Commit</Typography>
          </Box>
          <Box component="button" sx={{ ...iconBtn, px: 1.25, py: 0.65 }} title="Stash">
            <Iconify icon="solar:download-minimalistic-bold" width={16} />
          </Box>
          <Box component="button" sx={{ ...iconBtn, px: 1.25, py: 0.65 }} title="Push">
            <Iconify icon="mdi:cloud-upload-outline" width={16} />
          </Box>
        </Box>

        {/* Amend */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 0.75, py: 0.35 }}>
          <Checkbox
            size="small"
            checked={amend}
            onChange={(e) => setAmend(e.target.checked)}
            sx={{ p: '3px', mr: 0.5, color: MUTED, '&.Mui-checked': { color: GREEN } }}
          />
          <Typography sx={{ fontSize: 12.5, color: MUTED }}>Amend previous commit</Typography>
        </Box>

        {/* Input block */}
        <Box sx={{ mx: 0.75, mb: 0.75, bgcolor: '#1f2227', borderRadius: '4px', border: '1px solid #383b41', overflow: 'hidden' }}>
          {/* Summary */}
          <Box sx={{ display: 'flex', alignItems: 'center', px: 0.75, py: 0.5, borderBottom: '1px solid #383b41' }}>
            <Box
              component="input"
              placeholder="Commit summary"
              value={summary}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSummary(e.target.value.slice(0, SUMMARY_MAX))}
              sx={{
                flex: 1, bgcolor: 'transparent', border: 'none', outline: 'none',
                color: TEXT, fontSize: 13, userSelect: 'text',
                '&::placeholder': { color: MUTED },
              }}
            />
            <Typography sx={{ fontSize: 12, color: MUTED, ml: 0.5, flexShrink: 0 }}>{remaining}</Typography>
          </Box>
          {/* Description */}
          <Box
            component="textarea"
            placeholder="Description"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            rows={3}
            sx={{
              display: 'block', width: '100%', bgcolor: 'transparent', border: 'none',
              outline: 'none', color: TEXT, fontSize: 13, resize: 'none',
              p: '6px 8px', boxSizing: 'border-box', userSelect: 'text', fontFamily: 'inherit',
              '&::placeholder': { color: MUTED },
            }}
          />
        </Box>

        {/* Options row */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 0.75, mb: 0.75 }}>
          <Typography sx={{ fontSize: 12.5, color: MUTED, cursor: 'pointer' }}>
            › Commit options
          </Typography>
        </Box>

        {/* Main CTA */}
        <Box
          component="button"
          onClick={canCommit ? handleCommit : undefined}
          sx={{
            width: '100%', py: 0.9,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
            bgcolor: 'transparent', border: 'none',
            borderTop: `1px solid ${canCommit ? GREEN : 'rgba(46,164,79,0.25)'}`,
            cursor: canCommit ? 'pointer' : 'default',
            outline: 'none', transition: 'background 0.15s',
            '&:hover': canCommit ? { bgcolor: 'rgba(46,164,79,0.1)' } : {},
          }}
        >
          <Typography sx={{ fontSize: 12, color: MUTED }}>-o-</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: canCommit ? GREEN : 'rgba(46,164,79,0.35)' }}>
            {canCommit
              ? `Commit ${staged.length} file${staged.length !== 1 ? 's' : ''}`
              : 'Stage Changes to Commit'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
