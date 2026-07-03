import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";

import type { RepoPayload } from "src/types/electron";

// ----------------------------------------------------------------------

type Tab = {
  payload: RepoPayload;
  scrollTop: number;
  selectedIdx: number;
};

type ToolbarProps = {
  tabs: Tab[];
  activeTab: number;
  onOpenRepo: () => void;
  onActivateTab: (index: number) => void;
  onCloseTab: (index: number) => void;
};

export function Toolbar({
  tabs,
  activeTab,
  onOpenRepo,
  onActivateTab,
  onCloseTab,
}: ToolbarProps) {
  return (
    <Box
      sx={{
        height: 38,
        display: "flex",
        alignItems: "center",
        px: 1,
        gap: "2px",
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        userSelect: "none",
      }}
    >
      {/* Folder icon (open repo) */}
      <IconButton
        onClick={onOpenRepo}
        size="small"
        title="Abrir repositório (Ctrl+O)"
        sx={iconBtnSx}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M1.5 4.5v8h13v-6.5h-7l-1.5-2h-4.5z" />
        </svg>
      </IconButton>

      {/* Rocket icon */}
      <IconButton size="small" title="Iniciar" sx={iconBtnSx}>
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        >
          <path d="M8 1c-1.5 2-3 5-3 8 0 2 1 3.5 3 5 2-1.5 3-3 3-5 0-3-1.5-6-3-8z" />
          <circle cx="8" cy="8.5" r="1.5" />
          <path d="M5 9.5C3.5 10 2.5 11 2.5 11L4 13M11 9.5c1.5.5 2.5 1.5 2.5 1.5L12 13" />
        </svg>
      </IconButton>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 1 }} />

      {/* Tabs */}
      {tabs.length === 0 ? (
        <TabChip label="Nova Aba" active />
      ) : (
        tabs.map((tab, i) => (
          <TabChip
            key={tab.payload.repoPath}
            label={tab.payload.repoName}
            active={i === activeTab}
            color={
              tab.payload.palette[
                (tab.payload.commits[0]?.k ?? 0) % tab.payload.palette.length
              ]
            }
            onClick={() => onActivateTab(i)}
            onClose={() => onCloseTab(i)}
          />
        ))
      )}

      {/* + button */}
      <IconButton
        onClick={onOpenRepo}
        size="small"
        title="Nova aba"
        sx={{ ...iconBtnSx, ml: 0.5, fontSize: 15 }}
      >
        +
      </IconButton>

      <Box sx={{ flex: 1 }} />

      {/* Right side actions */}
      <Button
        size="small"
        endIcon={<DownArrow />}
        sx={{
          ...toolbarBtnSx,
          color: "#34d399",
          "&:hover": { color: "#6ee7b7" },
        }}
      >
        Upgrade
      </Button>

      <IconButton size="small" title="Notificações" sx={iconBtnSx}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <path d="M4 6a4 4 0 0 1 8 0c0 4 2 5 2 5H2s2-1 2-5" />
          <path d="M6 13a2 2 0 0 0 4 0" />
        </svg>
      </IconButton>

      <IconButton size="small" title="Configurações" sx={iconBtnSx}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <circle cx="8" cy="8" r="2.5" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" />
        </svg>
      </IconButton>

      <Button
        size="small"
        endIcon={<DownArrow />}
        sx={toolbarBtnSx}
        startIcon={
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <circle cx="8" cy="5" r="3" />
            <path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          </svg>
        }
      >
        Default Profile
      </Button>
    </Box>
  );
}

// ----------------------------------------------------------------------

function DownArrow() {
  return (
    <svg width="8" height="8" viewBox="0 0 10 6" fill="currentColor">
      <path d="M0 0l5 6 5-6z" />
    </svg>
  );
}

type TabChipProps = {
  label: string;
  active?: boolean;
  color?: string;
  onClick?: () => void;
  onClose?: () => void;
};

function TabChip({ label, active, color, onClick, onClose }: TabChipProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        maxWidth: 200,
        height: 26,
        px: "14px",
        bgcolor: active ? "#353c42" : "#2d3439",
        borderBottom: active ? "2px solid" : "2px solid transparent",
        borderBottomColor: active ? "primary.main" : "transparent",
        borderRadius: "4px 4px 0 0",
        color: active ? "text.primary" : "text.secondary",
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
        "&:hover": { bgcolor: "#353c42", color: "text.primary" },
      }}
    >
      {color && (
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            bgcolor: color,
            flexShrink: 0,
          }}
        />
      )}

      <Typography
        noWrap
        sx={{ fontSize: "inherit", fontWeight: "inherit", lineHeight: 1 }}
      >
        {label}
      </Typography>

      {onClose && (
        <Box
          component="button"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onClose();
          }}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
            borderRadius: "4px",
            border: "none",
            bgcolor: "transparent",
            color: "text.secondary",
            fontSize: 11,
            cursor: "pointer",
            "&:hover": {
              bgcolor: "rgba(255,255,255,0.12)",
              color: "text.primary",
            },
          }}
        >
          ✕
        </Box>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

const iconBtnSx = {
  width: 32,
  height: 28,
  borderRadius: "4px",
  color: "text.secondary",
  "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "text.primary" },
};

const toolbarBtnSx = {
  minWidth: "auto",
  px: "10px",
  py: "4px",
  fontSize: 11.5,
  fontWeight: 600,
  color: "text.secondary",
  textTransform: "none",
  borderRadius: "4px",
  "&:hover": { bgcolor: "rgba(255,255,255,0.06)", color: "text.primary" },
};
