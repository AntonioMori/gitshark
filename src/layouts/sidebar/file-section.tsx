import { useMemo } from "react";
import type { ReactNode, MouseEvent } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { Iconify } from "src/components/iconify";
import type { FileStatus } from "src/types/electron";

import { BORDER, MUTED, scrollHide } from "./constants";
import { buildTree } from "./utils";
import { FileItem } from "./file-item";
import { TreeNodeView } from "./tree-node-view";

// ----------------------------------------------------------------------

type Props = {
  title: string;
  files: FileStatus[];
  staged?: boolean;
  selectedFile?: string | null;
  open: boolean;
  onToggle: () => void;
  onFileClick: (p: string) => void;
  onSelectFile?: (p: string) => void;
  onActionAll: () => void;
  actionBtn: ReactNode;
  viewMode: "path" | "tree";
  sortOrder: "asc" | "desc";
  collapsedDirs: Set<string>;
  onToggleDir: (p: string) => void;
};

export function FileSection({
  title,
  files,
  staged,
  selectedFile,
  open,
  onToggle,
  onFileClick,
  onSelectFile,
  onActionAll,
  actionBtn,
  viewMode,
  sortOrder,
  collapsedDirs,
  onToggleDir,
}: Props) {
  const sorted = useMemo(
    () =>
      [...files].sort((a, b) =>
        sortOrder === "asc"
          ? a.path.localeCompare(b.path)
          : b.path.localeCompare(a.path),
      ),
    [files, sortOrder],
  );

  const tree = useMemo(
    () => (viewMode === "tree" ? buildTree(sorted) : []),
    [sorted, viewMode],
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: open ? 1 : "none",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Box
        onClick={onToggle}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 0.75,
          py: 0.6,
          cursor: "pointer",
          flexShrink: 0,
          ...(open && { borderBottom: `1px solid ${BORDER}` }),
          "&:hover": {
            bgcolor: "rgba(255,255,255,0.03)",
            "& p": { color: "#e8e8e9" },
          },
        }}
      >
        <Iconify
          icon={open ? "mdi:chevron-down" : "mdi:chevron-right"}
          width={16}
          sx={{ color: MUTED, flexShrink: 0 }}
        />
        <Typography
          sx={{
            fontSize: 13,
            color: "#b8b9bb",
            fontWeight: 500,
            flex: 1,
            transition: "color 0.15s",
          }}
        >
          {title} ({files.length})
        </Typography>
        {files.length > 0 && (
          <Box
            component="button"
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              onActionAll();
            }}
            sx={{
              bgcolor: "transparent",
              border: "none",
              p: 0,
              cursor: "pointer",
              outline: "none",
              flexShrink: 0,
            }}
          >
            {actionBtn}
          </Box>
        )}
      </Box>

      {open && (
        <Box sx={{ flex: 1, minHeight: 0, ...scrollHide }}>
          {viewMode === "path"
            ? sorted.map((f) => (
                <FileItem
                  key={f.path}
                  file={f}
                  staged={staged}
                  selected={selectedFile === f.path}
                  onClick={() => onFileClick(f.path)}
                  onSelect={onSelectFile ? () => onSelectFile(f.path) : undefined}
                />
              ))
            : tree.map((n) => (
                <TreeNodeView
                  key={n.fullPath}
                  node={n}
                  depth={0}
                  staged={staged}
                  selectedFile={selectedFile}
                  collapsedDirs={collapsedDirs}
                  onToggleDir={onToggleDir}
                  onFileClick={onFileClick}
                  onSelectFile={onSelectFile}
                />
              ))}
        </Box>
      )}
    </Box>
  );
}
