import type { MouseEvent } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { Iconify } from "src/components/iconify";
import type { FileStatus } from "src/types/electron";

import { STATUS_ICON } from "./constants";

// ----------------------------------------------------------------------

type Props = {
  file: FileStatus;
  staged?: boolean;
  selected?: boolean;
  onClick: () => void;
  onSelect?: () => void;
};

export function FileItem({ file, staged, selected, onClick, onSelect }: Props) {
  const info = STATUS_ICON[file.status] ?? STATUS_ICON["unknown"];
  const normalized = file.path.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  const dir = slash >= 0 ? normalized.slice(0, slash + 1) : "";
  const name = slash >= 0 ? normalized.slice(slash + 1) : normalized;

  const isStaged = !!staged;
  const isAddOrMinus = info.icon === "ic:baseline-add" || info.icon === "ic:baseline-minus";

  return (
    <Box
      component="button"
      onClick={onSelect || onClick}
      title={file.path}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        width: "100%",
        px: 1.5,
        py: 0.75,
        bgcolor: selected ? "rgba(91,155,213,0.15)" : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        position: "relative",
        "&:hover": {
          bgcolor: selected ? "rgba(91,155,213,0.2)" : "#2b3446",
          "& .file-action-btn": { opacity: 1, visibility: "visible" },
        },
        outline: "none",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      <Iconify
        icon={info.icon}
        width={isAddOrMinus ? 16 : 14}
        sx={{ color: info.color, flexShrink: 0, opacity: 1 }}
      />
      <Typography
        sx={{
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          minWidth: 0,
          flexGrow: 1,
          lineHeight: 1.4,
          fontFamily: "'Open Sans Variable', 'Open Sans', sans-serif !important",
        }}
      >
        <Box
          component="span"
          sx={{
            textOverflow: "ellipsis",
            overflow: "hidden",
            whiteSpace: "nowrap",
            color: "#777d88",
            minWidth: 0,
            flexShrink: 1,
          }}
        >
          {dir}
        </Box>
        <Box
          component="span"
          sx={{
            whiteSpace: "nowrap",
            color: "rgba(255,255,255,0.7)",
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {name}
        </Box>
      </Typography>
      <Box
        component="span"
        className="file-action-btn"
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          onClick();
        }}
        sx={{
          opacity: 0,
          visibility: "hidden",
          transition: "opacity 0.15s, visibility 0.15s",
          fontSize: 12,
          color: "rgba(255,255,255,0.8)",
          fontWeight: 500,
          border: isStaged ? "1px solid #d9413d" : "1px solid #5cb85c",
          borderRadius: "2px",
          px: 0.75,
          py: "3px",
          bgcolor: isStaged ? "#4a2f33" : "#314739",
          position: "absolute",
          right: "12px",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 1,
          flexShrink: 0,
          "&:hover": isStaged
            ? { bgcolor: "#923839", borderColor: "#923839" }
            : { bgcolor: "#477f4b", borderColor: "#477f4b" },
        }}
      >
        {isStaged ? "Unstage file" : "Stage file"}
      </Box>
    </Box>
  );
}
