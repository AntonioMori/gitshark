import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { Iconify } from "src/components/iconify";

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
        height: 34,
        display: "flex",
        alignItems: "center",
        px: 1,
        gap: "2px",
        bgcolor: "#2a2d34",
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
        <Iconify icon="lucide:folder-open" width={16} />
      </IconButton>

      {/* Rocket icon */}
      <IconButton size="small" title="Iniciar" sx={iconBtnSx}>
        <Iconify icon="lucide:rocket" width={16} />
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
        endIcon={<Iconify icon="lucide:chevron-down" width={8} />}
        sx={{
          ...toolbarBtnSx,
          color: "#34d399",
          "&:hover": { color: "#6ee7b7" },
        }}
      >
        Upgrade
      </Button>

      <IconButton size="small" title="Notificações" sx={iconBtnSx}>
        <Iconify icon="lucide:bell" width={15} />
      </IconButton>

      <IconButton size="small" title="Configurações" sx={iconBtnSx}>
        <Iconify icon="lucide:settings" width={15} />
      </IconButton>

      <Button
        size="small"
        endIcon={<Iconify icon="lucide:chevron-down" width={8} />}
        sx={toolbarBtnSx}
        startIcon={<Iconify icon="lucide:user" width={12} />}
      >
        Default Profile
      </Button>
    </Box>
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
        height: "100%",
        alignSelf: "stretch",
        px: "14px",
        bgcolor: active ? "#33373f" : "transparent",
        borderRadius: "4px 4px 0 0",
        color: active ? "text.primary" : "text.secondary",
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
        "& :hover": { color: "text.primary" },
        "&:hover": { bgcolor: active ? "#33373f" : "#32363e", color: "text.primary" },
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
