import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

// ----------------------------------------------------------------------

const MENU_ITEMS = ['File', 'Edit', 'View', 'Help'];

export function MenuBar() {
  return (
    <Box
      sx={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        px: '6px',
        bgcolor: '#1b1f23',
        borderBottom: '1px solid',
        borderColor: 'divider',
        userSelect: 'none',
      }}
    >
      {MENU_ITEMS.map((item) => (
        <Button
          key={item}
          size="small"
          sx={{
            minWidth: 'auto',
            px: '10px',
            py: '2px',
            fontSize: 12,
            color: 'text.secondary',
            textTransform: 'none',
            borderRadius: '3px',
            lineHeight: 1,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'text.primary' },
          }}
        >
          {item}
        </Button>
      ))}
    </Box>
  );
}
