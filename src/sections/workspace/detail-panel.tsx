import { useCallback } from 'react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Slide from '@mui/material/Slide';

import type { RepoPayload, SlimCommit } from 'src/types/electron';

// ----------------------------------------------------------------------

type DetailPanelProps = {
  open: boolean;
  commit: SlimCommit | null;
  payload: RepoPayload | null;
  onClose: () => void;
  rightOffset?: number;
};

export function DetailPanel({ open, commit, payload, onClose, rightOffset = 0 }: DetailPanelProps) {
  const copyHash = useCallback((hash: string) => {
    navigator.clipboard.writeText(hash);
  }, []);

  if (!commit || !payload) return null;

  const color = payload.palette[commit.k % payload.palette.length];
  const dt = new Date(commit.d);

  return (
    <Slide direction="left" in={open} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          right: rightOffset,
          top: 98 + 28, // titlebar(32) + menubar(28) + toolbar(38) + colhead(28)
          bottom: 26, // statusbar
          width: 300,
          bgcolor: 'background.paper',
          borderLeft: '1px solid',
          borderColor: 'divider',
          p: 2,
          overflow: 'auto',
          zIndex: 5,
        }}
      >
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', top: 10, right: 10 }}>
          ✕
        </IconButton>

        <Typography variant="subtitle2" sx={{ mb: 1.5, pr: 2, wordBreak: 'break-word', fontSize: 13 }}>
          {commit.m}
        </Typography>

        <Field label="Autor">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: '#fff',
                bgcolor: `hsl(${commit.hu} 45% 50%)`,
                border: '1.5px solid rgba(255,255,255,0.25)',
                flexShrink: 0,
              }}
            >
              {commit.i}
            </Box>
            {commit.a}
          </Box>
        </Field>

        <Field label="Data">
          {dt.toLocaleString('pt-BR')}
        </Field>

        <Field label="Commit">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <code style={{ fontSize: 12.5 }}>{commit.s}</code>
            <Button
              size="small"
              variant="outlined"
              onClick={() => copyHash(commit.h)}
              sx={{ fontSize: 11, py: '2px', px: 1, minWidth: 'auto' }}
            >
              copiar hash
            </Button>
          </Box>
        </Field>

        <Field label="Pais">
          {commit.np === 0 ? '— (commit raiz)' : commit.np === 1 ? '1 pai' : `${commit.np} pais (merge)`}
        </Field>

        {commit.r.length > 0 && (
          <Field label="Refs">
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, '--chip-color': color }}>
              {commit.r.map((ref, i) => (
                <Box
                  key={i}
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    bgcolor: 'action.hover',
                    border: '1px solid',
                    borderColor: ref.type === 'tag' ? 'text.secondary' : 'var(--chip-color, divider)',
                    borderRadius: '4px',
                    px: '7px',
                    py: '1.5px',
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  {ref.name}
                </Box>
              ))}
            </Box>
          </Field>
        )}
      </Box>
    </Slide>
  );
}

// ----------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Typography
        variant="caption"
        sx={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'text.secondary',
          mb: 0.25,
          display: 'block',
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontSize: 12.5, wordBreak: 'break-all' }}>
        {children}
      </Typography>
    </Box>
  );
}
