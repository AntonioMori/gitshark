import { useState, useEffect, useMemo, useCallback } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { Iconify } from "src/components/iconify";
import type { FileStatus, RepoPayload, SlimCommit } from "src/types/electron";

import {
  BG,
  BG_DARK,
  BORDER,
  COMMIT_SIDEBAR_WIDTH,
  FONT,
  MUTED,
  STATUS_ICON,
  TEXT,
  iconBtn,
  scrollHide,
} from "./constants";
import { buildTree } from "./utils";
import { TreeNodeView } from "./tree-node-view";

// ----------------------------------------------------------------------

type Props = {
  commit: SlimCommit;
  payload: RepoPayload;
  onClose: () => void;
  onSelectFile?: (path: string) => void;
  selectedFile?: string | null;
};

export function CommitDetail({ commit, payload, onClose, onSelectFile, selectedFile }: Props) {
  const [viewMode, setViewMode] = useState<"path" | "tree">("path");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<FileStatus[] | null>(null);

  const color = payload.palette[commit.k % payload.palette.length];
  const avatarUrl = payload.avatars[commit.g];

  const dt = new Date(commit.d);
  const dateStr =
    dt.toLocaleDateString("pt-BR") +
    " @ " +
    dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const authorName = commit.a.includes(" <")
    ? commit.a.split(" <")[0]
    : commit.a;

  const parentLabel =
    commit.np === 0
      ? "root commit"
      : commit.np === 1
        ? "1 parent"
        : `${commit.np} parents`;

  useEffect(() => {
    setFiles(null);
    window.api.gitCommitFiles(payload.repoPath, commit.h).then((result) => {
      setFiles(result.files ?? []);
    });
  }, [commit.h, payload.repoPath]);

  const sorted = useMemo(() => {
    if (!files) return [];
    return [...files].sort((a, b) =>
      sortOrder === "asc"
        ? a.path.localeCompare(b.path)
        : b.path.localeCompare(a.path),
    );
  }, [files, sortOrder]);

  const tree = useMemo(
    () => (viewMode === "tree" ? buildTree(sorted) : []),
    [sorted, viewMode],
  );

  const toggleDir = useCallback((path: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return (
    <Box
      sx={{
        width: COMMIT_SIDEBAR_WIDTH,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: BG,
        borderLeft: `1px solid ${BORDER}`,
        height: "100%",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: FONT,
        "& *": { fontFamily: `${FONT} !important` },
      }}
    >
      {/* ── WIP banner ── */}
      {payload.wip.total > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1.25,
            px: 1.5,
            height: 36,
            flexShrink: 0,
            bgcolor: "#364f83",
          }}
        >
          <Typography
            sx={{ fontSize: 12, color: TEXT, lineHeight: 1, fontWeight: 400 }}
          >
            {payload.wip.total} file{payload.wip.total !== 1 ? "s" : ""} changes
            in working directory
          </Typography>
          <Box
            component="button"
            onClick={onClose}
            sx={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.8)",
              borderRadius: "2px",
              px: 1,
              py: "4px",
              color: "rgba(255,255,255,0.8)",
              fontSize: 12,
              cursor: "pointer",
              lineHeight: 1,
              transition: "border-color 0.15s, color 0.15s",
              "&:hover": {
                borderColor: "rgba(255,255,255,1)",
                color: "rgba(255,255,255,1)",
              },
            }}
          >
            View changes
          </Box>
        </Box>
      )}

      {/* ── Header ── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1,
          py: 0.6,
          borderBottom: `1px solid ${BORDER}`,
          minHeight: 36,
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{ fontSize: 12, color: "rgba(255,255,255,0.8)", flexShrink: 0 }}
        >
          commit:{" "}
          <span
            style={{ color: TEXT, fontFamily: "monospace", fontSize: 12.5 }}
          >
            {commit.s}
          </span>
        </Typography>

        <Box sx={{ flex: 1 }} />

        <Box
          component="button"
          onClick={onClose}
          sx={{ ...iconBtn, flexShrink: 0 }}
          title="Fechar"
        >
          <Iconify icon="mingcute:close-line" width={15} />
        </Box>
      </Box>

      {/* ── Scrollable body ── */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          ...scrollHide,
        }}
      >
        {/* Commit message card */}
        <Box sx={{ mx: 1, mt: 1, mb: 0.75, flexShrink: 0 }}>
          <Box
            sx={{
              bgcolor: BG_DARK,
              borderRadius: "4px",
              border: `1px solid ${BORDER}`,
              px: 1.25,
              py: 1,
              minHeight: 44,
            }}
          >
            <Typography
              sx={{
                fontSize: 13,
                color: TEXT,
                fontWeight: 500,
                lineHeight: 1.55,
                wordBreak: "break-word",
                userSelect: "text",
              }}
            >
              {commit.m}
            </Typography>
          </Box>
        </Box>

        {/* Author row */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.25,
            py: 0.75,
            pb: 3,
            flexShrink: 0,
          }}
        >
          {avatarUrl ? (
            <Box
              component="img"
              src={avatarUrl}
              sx={{
                width: 28,
                height: 28,
                borderRadius: "4px",
                flexShrink: 0,
                border: `1.5px solid ${color}`,
                objectFit: "cover",
              }}
            />
          ) : (
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "4px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
                bgcolor: `hsl(${commit.hu} 45% 38%)`,
                border: `1.5px solid ${color}`,
              }}
            >
              {commit.i}
            </Box>
          )}

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              noWrap
              sx={{ fontSize: 12.5, color: TEXT, fontWeight: 500 }}
            >
              {authorName}
            </Typography>
            <Typography
              noWrap
              sx={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}
            >
              authored {dateStr}
            </Typography>
          </Box>

          <Typography
            sx={{
              fontSize: 11,
              color: "rgba(255,255,255,0.8)",
              flexShrink: 0,
              textAlign: "right",
            }}
          >
            {parentLabel}
          </Typography>
        </Box>

        {/* ── View toggle bar ── */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            px: 0.75,
            minHeight: 30,
            flexShrink: 0,
          }}
        >
          <Box
            component="button"
            onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
            sx={{ ...iconBtn, flexShrink: 0 }}
            title={sortOrder === "asc" ? "A→Z" : "Z→A"}
          >
            <Iconify
              icon={
                sortOrder === "asc"
                  ? "mdi:sort-alphabetical-ascending"
                  : "mdi:sort-alphabetical-descending"
              }
              width={15}
            />
          </Box>

          <Box
            sx={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              gap: 0.25,
            }}
          >
            {(["path", "tree"] as const).map((m) => (
              <Typography
                key={m}
                component="button"
                onClick={() => setViewMode(m)}
                sx={{
                  fontSize: 12,
                  fontWeight: m === viewMode ? 600 : 400,
                  color: m === viewMode ? TEXT : MUTED,
                  bgcolor:
                    m === viewMode ? "rgba(255,255,255,0.08)" : "transparent",
                  border: "none",
                  borderRadius: "3px",
                  px: 0.75,
                  py: 0.25,
                  cursor: "pointer",
                  outline: "none",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
                }}
              >
                {m === "path" ? "≡ Path" : "⌂ Tree"}
              </Typography>
            ))}
          </Box>

          {files !== null && (
            <Typography
              sx={{
                fontSize: 11.5,
                color: "rgba(255,255,255,0.8)",
                flexShrink: 0,
              }}
            >
              {files.length} file{files.length !== 1 ? "s" : ""}
            </Typography>
          )}
        </Box>

        {/* ── File list ── */}
        <Box sx={{ height: "1px", bgcolor: BORDER, flexShrink: 0, mt: 1 }} />
        <Box sx={{ flex: 1, minHeight: 0, ...scrollHide }}>
          {files === null ? (
            <Typography
              sx={{
                fontSize: 12,
                color: "rgba(255,255,255,0.8)",
                px: 1.5,
                py: 1,
              }}
            >
              Carregando...
            </Typography>
          ) : files.length === 0 ? (
            <Typography
              sx={{
                fontSize: 12,
                color: "rgba(255,255,255,0.8)",
                px: 1.5,
                py: 1,
              }}
            >
              Nenhum arquivo alterado.
            </Typography>
          ) : viewMode === "path" ? (
            sorted.map((f) => (
              <DetailFileItem
                key={f.path}
                file={f}
                selected={selectedFile === f.path}
                onSelect={onSelectFile ? () => onSelectFile(f.path) : undefined}
              />
            ))
          ) : (
            tree.map((n) => (
              <TreeNodeView
                key={n.fullPath}
                node={n}
                depth={0}
                selectedFile={selectedFile}
                collapsedDirs={collapsedDirs}
                onToggleDir={toggleDir}
                onFileClick={() => {}}
                onSelectFile={onSelectFile}
              />
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

function DetailFileItem({ file, selected, onSelect }: { file: FileStatus; selected?: boolean; onSelect?: () => void }) {
  const info = STATUS_ICON[file.status] ?? STATUS_ICON["?"];
  const normalized = file.path.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  const dir = slash >= 0 ? normalized.slice(0, slash + 1) : "";
  const name = slash >= 0 ? normalized.slice(slash + 1) : normalized;

  return (
    <Box
      onClick={onSelect}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        width: "100%",
        px: 1.5,
        py: 0.75,
        overflow: "hidden",
        minWidth: 0,
        cursor: "pointer",
        bgcolor: selected ? "rgba(91,155,213,0.15)" : "transparent",
        "&:hover": { bgcolor: selected ? "rgba(91,155,213,0.2)" : "#2b3446" },
      }}
    >
      <Iconify
        icon={info.icon}
        width={15}
        sx={{ color: info.color, flexShrink: 0 }}
      />
      <Typography
        noWrap
        sx={{
          fontSize: 13.5,
          minWidth: 0,
          letterSpacing: 0.25,
          fontFamily: "Inter",
        }}
      >
        <span style={{ color: "#777d88", fontWeight: 500 }}>{dir}</span>
        <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 400 }}>
          {name}
        </span>
      </Typography>
    </Box>
  );
}
