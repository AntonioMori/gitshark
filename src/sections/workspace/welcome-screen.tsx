import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

// ----------------------------------------------------------------------

type WelcomeScreenProps = {
  onOpenRepo: () => void;
};

export function WelcomeScreen({ onOpenRepo }: WelcomeScreenProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 1.5,
        color: 'text.secondary',
        textAlign: 'center',
        p: 2.5,
      }}
    >
      <Box
        sx={{
          width: 54,
          height: 54,
          borderRadius: '14px',
          background: 'conic-gradient(from 200deg, #00bcd4, #b158e0, #ec4899, #00bcd4)',
          opacity: 0.9,
          mb: 0.5,
        }}
      />

      <Typography variant="h6" sx={{ color: 'text.primary', fontSize: 17 }}>
        Nenhum repositório aberto
      </Typography>

      <Typography variant="caption" sx={{ color: 'text.secondary', mt: -0.5 }}>
        GitShark — visualizador de commits
      </Typography>

      <Typography variant="body2" sx={{ maxWidth: 380, fontSize: 12.5 }}>
        Clique em <b>Abrir repositório</b> e selecione a pasta de um projeto git.
        Você pode manter até 5 repositórios abertos, um por aba.
      </Typography>

      <Button
        variant="contained"
        size="small"
        onClick={onOpenRepo}
        sx={{ mt: 1 }}
      >
        Abrir repositório
      </Button>
    </Box>
  );
}
