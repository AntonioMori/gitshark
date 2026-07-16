import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export type RecentRepo = {
  name: string;
  path: string;
};

const RECENT_REPOS_KEY = 'gitshark:recent-repos';

export function getRecentRepos(): RecentRepo[] {
  try {
    const raw = localStorage.getItem(RECENT_REPOS_KEY);
    if (!raw) {
      // Pre-populate with gitshark repo if empty to match screenshot
      const defaultList: RecentRepo[] = [
        {
          name: 'gitshark',
          path: 'C:\\Users\\camar\\Desktop\\repositorios\\gitshark',
        },
      ];
      localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(defaultList));
      return defaultList;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addRecentRepo(name: string, path: string) {
  try {
    const list = getRecentRepos();
    const filtered = list.filter((item) => item.path !== path);
    filtered.unshift({ name, path });
    localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(filtered.slice(0, 10)));
  } catch (e) {
    console.error(e);
  }
}

type Props = {
  onOpenRepo: () => void;
  onOpenRecentRepo: (path: string) => void;
};

export function NewTabScreen({ onOpenRepo, onOpenRecentRepo }: Props) {
  const [recents, setRecents] = useState<RecentRepo[]>([]);

  useEffect(() => {
    setRecents(getRecentRepos());
  }, []);

  const handleDummyAction = (action: string) => {
    // Show a toast or handle dummy action
    alert(`${action} feature coming soon!`);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        bgcolor: '#171a21', // Dark background matching design
        color: '#ffffff',
        fontFamily: "'Open Sans Variable', 'Open Sans', sans-serif",
      }}
    >
      {/* Left Panel: Repositories & Recent */}
      <Box
        sx={{
          flex: 7, // 70% width
          display: 'flex',
          flexDirection: 'column',
          p: 6,
          overflowY: 'auto',
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontSize: 24,
            fontWeight: 400,
            mb: 3,
            color: 'rgba(255, 255, 255, 0.9)',
          }}
        >
          Repositories
        </Typography>

        {/* Buttons Row */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 4 }}>
          <Button
            variant="outlined"
            onClick={onOpenRepo}
            startIcon={<Iconify icon="lucide:folder-open" width={16} />}
            sx={buttonStyle}
          >
            Open
          </Button>
          <Button
            variant="outlined"
            onClick={() => handleDummyAction('Clone')}
            startIcon={<Iconify icon="lucide:cloud" width={16} />}
            sx={buttonStyle}
          >
            Clone
          </Button>
          <Button
            variant="outlined"
            onClick={() => handleDummyAction('Create')}
            startIcon={<Iconify icon="lucide:plus" width={16} />}
            sx={buttonStyle}
          >
            Create
          </Button>
        </Box>

        {/* Recent Repositories */}
        <Typography
          variant="subtitle1"
          sx={{
            fontSize: 13,
            color: 'rgba(255, 255, 255, 0.4)',
            fontWeight: 500,
            mb: 1.5,
          }}
        >
          Recent
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {recents.map((repo) => (
            <Box
              key={repo.path}
              onClick={() => onOpenRecentRepo(repo.path)}
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 1.5,
                cursor: 'pointer',
                py: 0.25,
                '&:hover .repo-name': {
                  textDecoration: 'underline',
                  color: '#4fc3f7',
                },
              }}
            >
              <Typography
                className="repo-name"
                sx={{
                  color: '#5b9bd5', // Light blue link color
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'color 0.15s',
                }}
              >
                {repo.name}
              </Typography>
              <Typography
                sx={{
                  color: '#777d88', // Muted path color
                  fontSize: 13,
                  fontFamily: 'monospace',
                }}
              >
                {repo.path}
              </Typography>
            </Box>
          ))}
          {recents.length === 0 && (
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: 13, fontStyle: 'italic' }}>
              Nenhum repositório recente
            </Typography>
          )}
        </Box>
      </Box>

      {/* Vertical Divider */}
      <Divider
        orientation="vertical"
        flexItem
        sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}
      />

      {/* Right Panel: Referrals & Resources */}
      <Box
        sx={{
          flex: 4, // 40% width
          display: 'flex',
          flexDirection: 'column',
          p: 6,
          overflowY: 'auto',
        }}
      >
        {/* Resources */}
        <Typography
          variant="subtitle2"
          sx={{
            fontSize: 12,
            fontWeight: 600,
            color: '#777d88',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            mb: 2,
          }}
        >
          Resources
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box
            component="a"
            href="https://www.gitkraken.com/tutorials"
            target="_blank"
            rel="noopener"
            sx={resourceLinkStyle}
          >
            Intro Tutorials
          </Box>
          <Box
            component="a"
            href="https://www.gitkraken.com/blog"
            target="_blank"
            rel="noopener"
            sx={resourceLinkStyle}
          >
            Release Notes
          </Box>
          <Box
            component="a"
            href="https://support.gitkraken.com"
            target="_blank"
            rel="noopener"
            sx={{
              ...resourceLinkStyle,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            Documentation <Iconify icon="lucide:external-link" width={12} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// Reusable styles
const buttonStyle = {
  color: 'rgba(255, 255, 255, 0.85)',
  borderColor: 'rgba(255, 255, 255, 0.15)',
  bgcolor: '#2b303b',
  textTransform: 'none',
  fontSize: 13,
  fontWeight: 400,
  px: 2.25,
  py: 0.75,
  borderRadius: '4px',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
  transition: 'all 0.15s ease-in-out',
  '&:hover': {
    borderColor: 'rgba(255, 255, 255, 0.3)',
    bgcolor: '#353a45',
  },
};

const resourceLinkStyle = {
  color: '#5b9bd5',
  fontSize: 13.5,
  textDecoration: 'none',
  width: 'fit-content',
  cursor: 'pointer',
  '&:hover': {
    textDecoration: 'underline',
    color: '#4fc3f7',
  },
};
