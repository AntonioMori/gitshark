import type { IconifyName } from "src/components/iconify/register-icons";

export const COMMIT_SIDEBAR_WIDTH = 380;
export const SUMMARY_MAX = 72;

export const BG = "#272a31";
export const BG_DARK = "#14171c";
export const TEXT = "#ffffff";
export const MUTED = "#c9cacb";
export const GREEN = "#2ea44f";
export const TEAL = "#005f73";
export const RED_BG = "#4a2f33";
export const BORDER = "rgba(255,255,255,0.08)";
export const FONT = '"Inter Variable", Inter, sans-serif';

export const STATUS_ICON: Record<string, { icon: IconifyName; color: string }> =
  {
    M: { icon: "mdi:pencil", color: "#de9b43" },
    A: { icon: "ic:baseline-add", color: "#5cb85c" },
    D: { icon: "mdi:minus-circle-outline", color: "#ef4444" },
    R: { icon: "mdi:arrow-right-circle-outline", color: "#a78bfa" },
    "?": { icon: "mdi:help-circle-outline", color: MUTED },
  };

export const iconBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  bgcolor: "transparent",
  border: "none",
  cursor: "pointer",
  outline: "none",
  borderRadius: "3px",
  p: "3px",
  color: MUTED,
  "&:hover": { bgcolor: "rgba(255,255,255,0.07)", color: TEXT },
} as const;

export const scrollHide = {
  overflowY: "auto",
  overflowX: "hidden",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { width: 0 },
} as const;
