import React, { useState, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Popover from "@mui/material/Popover";
import CircularProgress from "@mui/material/CircularProgress";
import { Iconify } from "src/components/iconify";
import type { RepoPayload, PullMode } from "src/types/electron";

interface ActionBarProps {
  payload: RepoPayload;
  pulling?: boolean;
  pushing?: boolean;
  onPull: (mode: PullMode) => void;
  onPush: () => void;
  onBranchClick?: () => void;
}

export function ActionBar({
  payload,
  pulling,
  pushing,
  onPull,
  onPush,
  onBranchClick,
}: ActionBarProps) {
  const [pullMenuAnchor, setPullMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const pullBtnRef = useRef<HTMLButtonElement>(null);

  const handlePullClick = () => {
    onPull("default");
  };

  const handlePullContext = (e: React.MouseEvent) => {
    e.preventDefault();
    setPullMenuAnchor(pullBtnRef.current);
  };

  return (
    <Box
      sx={{
        height: 48,
        bgcolor: "#33373f",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "stretch",
        px: 0,
        userSelect: "none",
      }}
    >
      {/* Left side: Repository & Branch information */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 3.5,
          pl: 2,
          justifySelf: "start",
        }}
      >
        {/* Repo Info */}
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 300,
              color: "#919eab",
              opacity: 0.85,
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}
          >
            Repositório
          </Typography>
          <Typography
            sx={{
              fontSize: 15,
              fontWeight: 700,
              color: "#ffffff",
              mt: "4px",
              lineHeight: 1,
              height: "18px",
              display: "flex",
              alignItems: "center",
            }}
          >
            {payload.repoName}
          </Typography>
        </Box>

        {/* Separator Arrow */}
        <Typography
          sx={{
            fontSize: 22,
            color: "#637381",
            fontWeight: 300,
            userSelect: "none",
            mx: 0.5,
            alignSelf: "flex-end",
            pb: "2px",
          }}
        >
          &gt;
        </Typography>

        {/* Branch Info */}
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 300,
              color: "#919eab",
              opacity: 0.85,
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}
          >
            Branch
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              mt: "4px",
              height: "18px",
            }}
          >
            <Iconify
              icon="ion:git-branch-outline"
              width={14}
              sx={{ color: "#ffffff" }}
            />
            <Typography
              sx={{
                fontSize: 15,
                fontWeight: 600,
                color: "#ffffff",
                lineHeight: 1,
              }}
            >
              {payload.currentBranch}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Center: Quick Action Buttons */}
      <Box
        sx={{ display: "flex", alignItems: "stretch", justifySelf: "center" }}
      >
        <HeaderButton
          label="Undo"
          icon={
            <Iconify
              icon="garden:reload-stroke-12"
              width={16}
              sx={{ transform: "scaleX(-1)" }}
            />
          }
        />
        <HeaderButton
          label="Redo"
          icon={<Iconify icon="garden:reload-stroke-12" width={16} />}
        />
        <HeaderButton
          ref={pullBtnRef}
          label="Pull"
          icon={
            pulling ? (
              <CircularProgress size={16} sx={{ color: "inherit" }} />
            ) : (
              <Iconify icon="lucide:download" width={18} />
            )
          }
          onClick={handlePullClick}
          onContextMenu={handlePullContext}
          disabled={pulling}
          hasDropdown
          onDropdownClick={(e) =>
            setPullMenuAnchor(e.currentTarget.closest("button") as HTMLElement)
          }
        />
        <HeaderButton
          label="Push"
          icon={
            pushing ? (
              <CircularProgress size={16} sx={{ color: "inherit" }} />
            ) : (
              <Iconify icon="lucide:upload" width={18} />
            )
          }
          onClick={onPush}
          disabled={pushing}
        />
        <HeaderButton
          label="Branch"
          icon={<Iconify icon="ion:git-branch-outline" width={18} />}
          onClick={onBranchClick}
        />
        <HeaderButton
          label="Stash"
          icon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
        />
        <HeaderButton
          label="Pop"
          icon={<Iconify icon="solar:upload-minimalistic-linear" width={18} />}
        />
      </Box>

      {/* Right side: Search Action */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "stretch",
          pr: 0.5,
          justifySelf: "end",
        }}
      >
        <HeaderButton
          label="Search"
          icon={<Iconify icon="lucide:search" width={18} />}
        />
      </Box>

      {/* Pull mode menu */}
      <Popover
        open={!!pullMenuAnchor}
        anchorEl={pullMenuAnchor}
        onClose={() => setPullMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#2a2d34",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "6px",
              py: 0.5,
              minWidth: 220,
              mt: 0.5,
            },
          },
        }}
      >
        <PullMenuItem
          label="Pull (fast-forward if possible)"
          description="Default — merge if fast-forward is not possible"
          onClick={() => {
            onPull("default");
            setPullMenuAnchor(null);
          }}
        />
        <PullMenuItem
          label="Pull (fast-forward only)"
          description="Abort if fast-forward is not possible"
          onClick={() => {
            onPull("ff-only");
            setPullMenuAnchor(null);
          }}
        />
        <PullMenuItem
          label="Pull (rebase)"
          description="Rebase current branch onto upstream"
          onClick={() => {
            onPull("rebase");
            setPullMenuAnchor(null);
          }}
        />
      </Popover>
    </Box>
  );
}

// ----------------------------------------------------------------------

interface HeaderButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  hasDropdown?: boolean;
  onDropdownClick?: (e: React.MouseEvent) => void;
}

const HeaderButton = React.forwardRef<HTMLButtonElement, HeaderButtonProps>(
  (
    {
      label,
      icon,
      onClick,
      onContextMenu,
      disabled,
      hasDropdown,
      onDropdownClick,
    },
    ref,
  ) => (
    <Box sx={{ display: "flex", alignItems: "stretch", position: "relative" }}>
      <Box
        component="button"
        ref={ref}
        onClick={disabled ? undefined : onClick}
        onContextMenu={onContextMenu}
        disabled={disabled}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          pt: "7px",
          gap: "4px",
          height: "100%",
          px: 1.5,
          color: "#ffffff",
          bgcolor: "transparent",
          border: "none",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "all 0.15s ease",
          "&:hover": {
            bgcolor: disabled ? "transparent" : "#292c33",
          },
          "&:active": {
            bgcolor: "rgba(255, 255, 255, 0.05)",
          },
          outline: "none",
        }}
      >
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 300,
            color: "inherit",
            opacity: 0.65,
            letterSpacing: "0.02em",
            lineHeight: 1,
          }}
        >
          {label}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "inherit",
          }}
        >
          {icon}
        </Box>
      </Box>
      {hasDropdown && (
        <Box
          component="button"
          onClick={onDropdownClick}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 14,
            bgcolor: "transparent",
            border: "none",
            color: "#ffffff",
            opacity: 0.5,
            cursor: "pointer",
            px: 0,
            ml: "-4px",
            "&:hover": { opacity: 1 },
            outline: "none",
          }}
        >
          <svg width="7" height="7" viewBox="0 0 10 6" fill="currentColor">
            <path d="M0 0l5 6 5-6z" />
          </svg>
        </Box>
      )}
    </Box>
  ),
);

// ----------------------------------------------------------------------

interface PullMenuItemProps {
  label: string;
  description: string;
  onClick: () => void;
}

function PullMenuItem({ label, description, onClick }: PullMenuItemProps) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        width: "100%",
        px: 1.5,
        py: 1,
        bgcolor: "transparent",
        border: "none",
        color: "#ffffff",
        cursor: "pointer",
        textAlign: "left",
        "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
        outline: "none",
      }}
    >
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 11, color: "#919eab", lineHeight: 1.2 }}>
        {description}
      </Typography>
    </Box>
  );
}
