import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { Iconify } from "src/components/iconify";

import { MUTED, STATUS_ICON } from "./constants";
import type { TreeNode } from "./utils";

// ----------------------------------------------------------------------

type Props = {
  node: TreeNode;
  depth: number;
  staged?: boolean;
  collapsedDirs: Set<string>;
  onToggleDir: (p: string) => void;
  onFileClick: (p: string) => void;
};

export function TreeNodeView({
  node,
  depth,
  staged,
  collapsedDirs,
  onToggleDir,
  onFileClick,
}: Props) {
  if (!node.isDir && node.file) {
    const info = STATUS_ICON[node.file.status] ?? STATUS_ICON["?"];
    return (
      <Box
        component="button"
        onClick={() => onFileClick(node.fullPath)}
        title={staged ? `Unstage: ${node.fullPath}` : `Stage: ${node.fullPath}`}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          width: "100%",
          pl: `${12 + depth * 14}px`,
          pr: 1.5,
          py: 0.6,
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
          width={13}
          sx={{ color: info.color, flexShrink: 0 }}
        />
        <Typography
          noWrap
          sx={{
            fontSize: 13,
            color: "rgba(255,255,255,0.7)",
            fontWeight: 500,
            minWidth: 0,
          }}
        >
          {node.name}
        </Typography>
      </Box>
    );
  }

  const isExpanded = !collapsedDirs.has(node.fullPath);
  return (
    <Box>
      <Box
        onClick={() => onToggleDir(node.fullPath)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: `${12 + depth * 14}px`,
          pr: 1.5,
          py: 0.5,
          cursor: "pointer",
          "&:hover": { bgcolor: "#2b3446" },
        }}
      >
        <Iconify
          icon={isExpanded ? "mdi:chevron-down" : "mdi:chevron-right"}
          width={12}
          sx={{ color: MUTED, flexShrink: 0 }}
        />
        <Iconify
          icon="mdi:folder-outline"
          width={14}
          sx={{ color: "#8ab4f8", flexShrink: 0 }}
        />
        <Typography
          noWrap
          sx={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}
        >
          {node.name}
        </Typography>
      </Box>
      {isExpanded &&
        node.children.map((child) => (
          <TreeNodeView
            key={child.fullPath}
            node={child}
            depth={depth + 1}
            staged={staged}
            collapsedDirs={collapsedDirs}
            onToggleDir={onToggleDir}
            onFileClick={onFileClick}
          />
        ))}
    </Box>
  );
}
