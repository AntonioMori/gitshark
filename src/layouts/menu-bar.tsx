import Box from '@mui/material/Box';

// ----------------------------------------------------------------------

const MENU_ITEMS = ['File', 'Edit', 'View', 'Help'];

export function MenuBar() {
  return (
    <Box
      sx={{
        height: 22,
        display: 'flex',
        alignItems: 'center',
        px: '6px',
        bgcolor: '#1f1f1f',
        borderBottom: '1px solid',
        borderColor: 'divider',
        userSelect: 'none',
      }}
    >
      {MENU_ITEMS.map((item) => (
        <Box
          key={item}
          component="button"
          sx={{
            bgcolor: 'transparent',
            border: 'none',
            outline: 'none',
            cursor: 'pointer',
            height: 16,
            px: '6px',
            fontSize: 10.5,
            fontWeight: 500,
            color: 'text.secondary',
            textTransform: 'none',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'inherit',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'text.primary' },
          }}
        >
          {item}
        </Box>
      ))}
    </Box>
  );
}
