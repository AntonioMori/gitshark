import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

// ----------------------------------------------------------------------

export function TitleBar() {
  return (
    <Box
      sx={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        px: '10px',
        bgcolor: '#1b1f23',
        borderBottom: '1px solid',
        borderColor: 'divider',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          width: 16,
          height: 16,
          borderRadius: '4px',
          background: 'conic-gradient(from 200deg, #00bcd4, #b158e0, #ec4899, #00bcd4)',
          mr: 1,
          flexShrink: 0,
        }}
      />

      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12, color: 'text.primary' }}>
        GitShark Desktop
      </Typography>

      <Box sx={{ flex: 1 }} />

      {/* Window controls */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          height: '100%',
          WebkitAppRegion: 'no-drag',
        }}
      >
        <IconButton
          onClick={() => window.api.winMinimize()}
          sx={winBtnSx}
          title="Minimizar"
          size="small"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </IconButton>

        <IconButton
          onClick={() => window.api.winMaximize()}
          sx={winBtnSx}
          title="Maximizar"
          size="small"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x=".5" y=".5" width="9" height="9" />
          </svg>
        </IconButton>

        <IconButton
          onClick={() => window.api.winClose()}
          sx={{
            ...winBtnSx,
            '&:hover': { bgcolor: '#e81123', color: '#fff' },
          }}
          title="Fechar"
          size="small"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M1 1l8 8M9 1l-8 8" />
          </svg>
        </IconButton>
      </Box>
    </Box>
  );
}

const winBtnSx = {
  width: 46,
  height: '100%',
  borderRadius: 0,
  color: 'text.secondary',
  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'text.primary' },
};
