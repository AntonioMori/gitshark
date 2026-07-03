import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { RepoPayload } from 'src/types/electron';

// ----------------------------------------------------------------------

type StatusBarProps = {
  payload: RepoPayload | null;
};

export function StatusBar({ payload }: StatusBarProps) {
  if (!payload) {
    return (
      <Box sx={rootSx}>
        <Typography variant="caption" sx={textSx}>GitShark</Typography>
      </Box>
    );
  }

  const hasWip = payload.wip && payload.wip.total > 0;

  const branchSet = new Set<string>();
  for (const c of payload.commits) {
    for (const r of c.r) {
      if (r.type === 'branch' || r.type === 'head_branch') branchSet.add(r.name);
    }
  }

  return (
    <Box sx={rootSx}>
      <Typography variant="caption" sx={textSx}>
        {payload.commits.length} commits
      </Typography>
      <Typography variant="caption" sx={textSx}>
        {branchSet.size} branches locais · {payload.maxLanes} lanes
      </Typography>
      <Typography variant="caption" sx={textSx}>
        {hasWip ? `✎ ${payload.wip.total} arquivo(s) alterado(s)` : 'working tree limpo'}
      </Typography>
      <Typography variant="caption" sx={{ ...textSx, ml: 'auto' }}>
        {payload.repoPath}
      </Typography>
    </Box>
  );
}

const rootSx = {
  position: 'fixed' as const,
  left: 0,
  right: 0,
  bottom: 0,
  height: 26,
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  px: '14px',
  bgcolor: 'background.paper',
  borderTop: '1px solid',
  borderColor: 'divider',
};

const textSx = {
  fontSize: 11,
  color: 'text.secondary',
};
