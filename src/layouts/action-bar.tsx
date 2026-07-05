import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { RepoPayload } from "src/types/electron";

interface ActionBarProps {
  payload: RepoPayload;
}

export function ActionBar({ payload }: ActionBarProps) {
  return (
    <Box
      sx={{
        height: 48,
        bgcolor: "#33373f",
        borderBottom: "1px solid",
        borderColor: "divider",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "stretch",
        px: 0,
        userSelect: "none",
      }}
    >
      {/* Left side: Repository & Branch information */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 3.5, pl: 2, justifySelf: "start" }}>
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: "4px", height: "18px" }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
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
      <Box sx={{ display: "flex", alignItems: "stretch", justifySelf: "center" }}>
        <HeaderButton label="Undo" icon={<UndoIcon />} />
        <HeaderButton label="Redo" icon={<RedoIcon />} />
        <HeaderButton label="Pull" icon={<PullIcon />} />
        <HeaderButton label="Push" icon={<PushIcon />} />
        <HeaderButton label="Branch" icon={<BranchIcon />} />
        <HeaderButton label="Stash" icon={<StashIcon />} />
        <HeaderButton label="Pop" icon={<PopIcon />} />
      </Box>

      {/* Right side: Search Action */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "stretch", pr: 2, justifySelf: "end" }}>
        <HeaderButton label="Search" icon={<SearchIcon />} />
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

interface HeaderButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

function HeaderButton({ label, icon, onClick }: HeaderButtonProps) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        height: "100%",
        px: 1.5,
        color: "#ffffff",
        bgcolor: "transparent",
        border: "none",
        cursor: "pointer",
        transition: "all 0.15s ease",
        "&:hover": {
          bgcolor: "#292c33",
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", color: "inherit" }}>
        {icon}
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

function UndoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
    </svg>
  );
}

function PullIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v13M19 10l-7 7-7-7M5 21h14" />
    </svg>
  );
}

function PushIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 17V4M5 11l7-7 7 7M5 21h14" />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

// Box/archive-like Stash
function StashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 8H3V4h18v4zm-1 0v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8m6 4h4" />
    </svg>
  );
}

// Arrow popping out of Box
function PopIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 8H3V4h18v4zm-1 0v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8m6 4h4" />
      <path d="M12 12v-5M9 9l3-3 3 3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
