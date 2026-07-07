import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { Iconify } from "src/components/iconify";
import type { FileStatus } from "src/types/electron";

import { STATUS_ICON } from "./constants";

// ----------------------------------------------------------------------

type Props = {
  file: FileStatus;
  staged?: boolean;
  onClick: () => void;
};

export function FileItem({ file, staged, onClick }: Props) {
  const info = STATUS_ICON[file.status] ?? STATUS_ICON["?"];
  const normalized = file.path.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  const dir = slash >= 0 ? normalized.slice(0, slash + 1) : "";
  const name = slash >= 0 ? normalized.slice(slash + 1) : normalized;

  return (
    <Box
      component="button"
      onClick={onClick}
      title={staged ? `Unstage: ${file.path}` : `Stage: ${file.path}`}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        width: "100%",
        px: 1.5,
        py: 0.75,
        bgcolor: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        "&:hover": { bgcolor: "#2b3446" },
        outline: "none",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      <Iconify
        icon={info.icon}
        width={14}
        sx={{ color: info.color, flexShrink: 0 }}
      />
      <Typography noWrap sx={{ fontSize: 13, lineHeight: 1.5, minWidth: 0 }}>
        <span style={{ color: "#777d88" }}>{dir}</span>
        <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
          {name}
        </span>
      </Typography>
    </Box>
  );
}
