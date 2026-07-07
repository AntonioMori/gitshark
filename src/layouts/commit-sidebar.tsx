import React, { useState, useEffect, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import { toast } from "sonner";
import { Iconify } from "src/components/iconify";
import type { IconifyName } from "src/components/iconify/register-icons";
import type { RepoPayload, FileStatus } from "src/types/electron";

// ─── Constants ───────────────────────────────────────────────────────────────

export const COMMIT_SIDEBAR_WIDTH = 380;
const SUMMARY_MAX = 72;

const BG = "#272a31";
const BG_DARK = "#14171c";
const TEXT = "#ffffff";
const MUTED = "#8a94a6";
const GREEN = "#2ea44f";
const ORANGE = "#d97706";
const TEAL = "#005f73";
const RED_BG = "#4a2f33";
const BORDER = "rgba(255,255,255,0.08)";
const FONT = '"Inter Variable", Inter, sans-serif';

const STATUS_ICON: Record<string, { icon: IconifyName; color: string }> = {
  M: { icon: "mdi:pencil", color: "#de9b43" },
  A: { icon: "ic:baseline-add", color: "#5cb85c" },
  D: { icon: "mdi:minus-circle-outline", color: "#ef4444" },
  R: { icon: "mdi:arrow-right-circle-outline", color: "#a78bfa" },
  "?": { icon: "mdi:help-circle-outline", color: MUTED },
};

const iconBtn = {
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

const scrollHide = {
  overflowY: "auto",
  overflowX: "hidden",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { width: 0 },
} as const;

// ─── Tree types ───────────────────────────────────────────────────────────────

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: TreeNode[];
  file?: FileStatus;
}

function buildTree(files: FileStatus[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const file of files) {
    const parts = file.path.replace(/\\/g, "/").split("/");
    let nodes = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");
      if (isLast) {
        nodes.push({
          name: part,
          fullPath: file.path,
          isDir: false,
          children: [],
          file,
        });
      } else {
        let dir = nodes.find((n) => n.isDir && n.name === part);
        if (!dir) {
          dir = { name: part, fullPath, isDir: true, children: [] };
          nodes.push(dir);
        }
        nodes = dir.children;
      }
    }
  }
  return root;
}

// ─── FileItem (path view) ─────────────────────────────────────────────────────

function FileItem({
  file,
  staged,
  onClick,
}: {
  file: FileStatus;
  staged?: boolean;
  onClick: () => void;
}) {
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

// ─── TreeNodeView (tree view) ─────────────────────────────────────────────────

function TreeNodeView({
  node,
  depth,
  staged,
  collapsedDirs,
  onToggleDir,
  onFileClick,
}: {
  node: TreeNode;
  depth: number;
  staged?: boolean;
  collapsedDirs: Set<string>;
  onToggleDir: (p: string) => void;
  onFileClick: (p: string) => void;
}) {
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

// ─── FileSection ──────────────────────────────────────────────────────────────

function FileSection({
  title,
  files,
  staged,
  open,
  onToggle,
  onFileClick,
  onActionAll,
  actionBtn,
  viewMode,
  sortOrder,
  collapsedDirs,
  onToggleDir,
}: {
  title: string;
  files: FileStatus[];
  staged?: boolean;
  open: boolean;
  onToggle: () => void;
  onFileClick: (p: string) => void;
  onActionAll: () => void;
  actionBtn: React.ReactNode;
  viewMode: "path" | "tree";
  sortOrder: "asc" | "desc";
  collapsedDirs: Set<string>;
  onToggleDir: (p: string) => void;
}) {
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
            onClick={(e: React.MouseEvent) => {
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
                  onClick={() => onFileClick(f.path)}
                />
              ))
            : tree.map((n) => (
                <TreeNodeView
                  key={n.fullPath}
                  node={n}
                  depth={0}
                  staged={staged}
                  collapsedDirs={collapsedDirs}
                  onToggleDir={onToggleDir}
                  onFileClick={onFileClick}
                />
              ))}
        </Box>
      )}
    </Box>
  );
}

// ─── Action button templates ──────────────────────────────────────────────────

const StageAllBtn = (
  <Box
    sx={{
      fontSize: 12,
      color: "rgba(255,255,255,0.8)",
      fontWeight: 500,
      border: "1px solid #5cb85c",
      borderRadius: "3px",
      px: 0.75,
      py: "2px",
      bgcolor: "#314739",
      "&:hover": { bgcolor: "#477f4b" },
      pointerEvents: "none", // handled by parent button wrapper
    }}
  >
    Stage All Changes
  </Box>
);

const UnstageAllBtn = (
  <Box
    sx={{
      fontSize: 12,
      color: "rgba(255,255,255,0.8)",
      fontWeight: 500,
      border: "1px solid #d9413d",
      borderRadius: "3px",
      px: 0.75,
      py: "2px",
      bgcolor: "#4a2f33",
      "&:hover": { bgcolor: "#923839" },
      pointerEvents: "none",
    }}
  >
    Unstage All
  </Box>
);

// ─── CommitSidebar ────────────────────────────────────────────────────────────

interface Props {
  payload: RepoPayload;
  onRefresh: (newPayload: RepoPayload) => void;
}

export function CommitSidebar({ payload, onRefresh }: Props) {
  const [staged, setStaged] = useState<FileStatus[]>([]);
  const [unstaged, setUnstaged] = useState<FileStatus[]>([]);
  const [unstagedOpen, setUnstagedOpen] = useState(true);
  const [stagedOpen, setStagedOpen] = useState(true);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [amend, setAmend] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [viewMode, setViewMode] = useState<"path" | "tree">("path");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const [discardOpen, setDiscardOpen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [pushAfterCommit, setPushAfterCommit] = useState(false);

  const loadStatus = useCallback(async () => {
    const result = await window.api.gitStatusFiles(payload.repoPath);
    if (!result.error) {
      setStaged(result.staged);
      setUnstaged(result.unstaged);
    }
  }, [payload.repoPath]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleStageAll = async () => {
    await window.api.gitStageAll(payload.repoPath);
    await loadStatus();
  };
  const handleStageFile = async (p: string) => {
    await window.api.gitStageFile(payload.repoPath, p);
    await loadStatus();
  };
  const handleUnstageFile = async (p: string) => {
    await window.api.gitUnstageFile(payload.repoPath, p);
    await loadStatus();
  };
  const handleUnstageAll = async () => {
    await Promise.all(
      staged.map((f) => window.api.gitUnstageFile(payload.repoPath, f.path)),
    );
    await loadStatus();
  };

  const handleDiscardConfirm = async () => {
    setDiscardOpen(false);
    const result = await window.api.gitDiscardAll(payload.repoPath);
    if (result.error) toast.error(result.error);
    else {
      await loadStatus();
      toast.success("Alterações descartadas.");
    }
  };

  const handleCommit = async () => {
    if (!summary.trim() || staged.length === 0 || committing) return;
    setCommitting(true);
    try {
      const result = await window.api.gitCommit(
        payload.repoPath,
        summary.trim(),
        description,
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        setSummary("");
        setDescription("");
        await loadStatus();
        if (result.payload) onRefresh(result.payload);
        toast.success("Commit realizado com sucesso.");
        if (pushAfterCommit) {
          toast.loading("Executando push...", { id: "push-loading" });
          try {
            const pushResult = await window.api.gitPush(payload.repoPath);
            toast.dismiss("push-loading");
            if (pushResult.error) {
              toast.error(`Erro ao fazer push: ${pushResult.error}`);
            } else {
              toast.success("Push realizado com sucesso.");
              if (pushResult.payload) onRefresh(pushResult.payload);
            }
          } catch (pushErr: any) {
            toast.dismiss("push-loading");
            toast.error(`Erro no push: ${pushErr.message || pushErr}`);
          }
        }
      }
    } finally {
      setCommitting(false);
    }
  };

  const toggleDir = useCallback((path: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const totalChanges = staged.length + unstaged.length;
  const canCommit =
    staged.length > 0 && summary.trim().length > 0 && !committing;
  const remaining = SUMMARY_MAX - summary.length;

  return (
    <>
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
        {/* ── TOP SECTION (scrollable, absorve o espaço restante) ── */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { width: 0 },
          }}
        >
          {/* ── Header ── */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 0.75,
              py: 0.5,
              bgcolor: BG,
              borderBottom: `1px solid ${BORDER}`,
              minHeight: 36,
              flexShrink: 0,
            }}
          >
            <Box
              component="button"
              onClick={() => setDiscardOpen(true)}
              sx={{
                ...iconBtn,
                bgcolor: RED_BG,
                border: "1px solid #d9413d",
                borderRadius: "4px",
                width: 24,
                height: 24,
                flexShrink: 0,
                "& .trash-icon": { opacity: 0.8, transition: "opacity 0.15s" },
                "&:hover": {
                  bgcolor: "#923839",
                  "& .trash-icon": { opacity: 1 },
                },
              }}
              title="Descartar todas as alterações"
            >
              <Iconify
                icon="solar:trash-bin-trash-linear"
                width={13}
                className="trash-icon"
                sx={{ color: TEXT }}
              />
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                minWidth: 0,
                overflow: "hidden",
                ml: 0.75,
              }}
            >
              <Typography sx={{ fontSize: 12.5, color: MUTED, flexShrink: 0 }}>
                {totalChanges} file{totalChanges !== 1 ? "s" : ""} on
              </Typography>
              <Box
                sx={{
                  bgcolor: TEAL,
                  px: 0.75,
                  py: "2px",
                  borderRadius: "3px",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <Typography
                  noWrap
                  sx={{
                    fontSize: 12,
                    color: TEXT,
                    fontWeight: 500,
                    lineHeight: 1.5,
                  }}
                >
                  {payload.currentBranch}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* ── View Toggle ── */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              px: 0.75,
              minHeight: 32,
              flexShrink: 0,
            }}
          >
            {/* Sort */}
            <Box
              component="button"
              onClick={() =>
                setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
              }
              sx={{ ...iconBtn, flexShrink: 0 }}
              title={
                sortOrder === "asc"
                  ? "A→Z (clique para inverter)"
                  : "Z→A (clique para inverter)"
              }
            >
              <Iconify
                icon={
                  sortOrder === "asc"
                    ? "mdi:sort-alphabetical-ascending"
                    : "mdi:sort-alphabetical-descending"
                }
                width={16}
              />
            </Box>

            {/* Path / Tree — centered */}
            <Box
              sx={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                gap: 0.5,
              }}
            >
              {(["path", "tree"] as const).map((m) => (
                <Typography
                  key={m}
                  component="button"
                  onClick={() => setViewMode(m)}
                  sx={{
                    fontSize: 12.5,
                    fontWeight: m === viewMode ? 600 : 400,
                    color: m === viewMode ? TEXT : MUTED,
                    bgcolor:
                      m === viewMode ? "rgba(255,255,255,0.08)" : "transparent",
                    border: "none",
                    borderRadius: "3px",
                    px: 1,
                    py: 0.3,
                    cursor: "pointer",
                    outline: "none",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
                  }}
                >
                  {m === "path" ? "≡ Path" : "⌂ Tree"}
                </Typography>
              ))}
            </Box>

            {/* Spacer to balance sort button */}
            <Box sx={{ width: 22, flexShrink: 0 }} />
          </Box>

          {/* ── File List ── */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <FileSection
              title="Unstaged Files"
              files={unstaged}
              open={unstagedOpen}
              onToggle={() => setUnstagedOpen((v) => !v)}
              onFileClick={handleStageFile}
              onActionAll={handleStageAll}
              actionBtn={StageAllBtn}
              viewMode={viewMode}
              sortOrder={sortOrder}
              collapsedDirs={collapsedDirs}
              onToggleDir={toggleDir}
            />
            <FileSection
              title="Staged Files"
              files={staged}
              staged
              open={stagedOpen}
              onToggle={() => setStagedOpen((v) => !v)}
              onFileClick={handleUnstageFile}
              onActionAll={handleUnstageAll}
              actionBtn={UnstageAllBtn}
              viewMode={viewMode}
              sortOrder={sortOrder}
              collapsedDirs={collapsedDirs}
              onToggleDir={toggleDir}
            />
          </Box>
        </Box>
        {/* fim TOP SECTION */}

        {/* ── Commit Panel ── filho direto do sidebar, nunca comprimido ── */}
        <Box
          sx={{ flexShrink: 0, bgcolor: BG, borderTop: `1px solid ${BORDER}` }}
        >
          {/* Tabs */}
          <Box sx={{ display: "flex", alignItems: "stretch" }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                px: 1.25,
                py: 0.65,
                borderBottom: `2px solid ${TEXT}`,
              }}
            >
              <Typography
                sx={{ fontSize: 12, color: MUTED, letterSpacing: "0.03em" }}
              >
                -o-
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                Commit
              </Typography>
            </Box>
            <Box
              component="button"
              sx={{ ...iconBtn, px: 1.25, py: 0.65 }}
              title="Stash"
            >
              <Iconify icon="solar:download-minimalistic-bold" width={16} />
            </Box>
            <Box
              component="button"
              sx={{ ...iconBtn, px: 1.25, py: 0.65 }}
              title="Push"
            >
              <Iconify icon="mdi:cloud-upload-outline" width={16} />
            </Box>
          </Box>

          {/* Amend */}
          <Box
            sx={{ display: "flex", alignItems: "center", px: 0.75, py: 0.35 }}
          >
            <Checkbox
              size="small"
              checked={amend}
              onChange={(e) => setAmend(e.target.checked)}
              sx={{
                p: "3px",
                mr: 0.5,
                color: MUTED,
                "&.Mui-checked": { color: GREEN },
              }}
            />
            <Typography sx={{ fontSize: 12.5, color: MUTED }}>
              Amend previous commit
            </Typography>
          </Box>

          {/* Inputs */}
          <Box
            sx={{
              mx: 0.75,
              mb: 0.75,
              bgcolor: "#1f2227",
              borderRadius: "4px",
              border: "1px solid #383b41",
              overflow: "hidden",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", px: 1, py: 0.9 }}>
              <Box
                component="input"
                placeholder="Commit summary"
                value={summary}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSummary(e.target.value.slice(0, SUMMARY_MAX))
                }
                sx={{
                  flex: 1,
                  bgcolor: "transparent",
                  border: "none",
                  outline: "none",
                  color: TEXT,
                  fontSize: 15,
                  fontWeight: 500,
                  userSelect: "text",
                  "&::placeholder": { color: MUTED },
                }}
              />
              <Typography
                sx={{ fontSize: 12, color: MUTED, ml: 0.5, flexShrink: 0 }}
              >
                {remaining}
              </Typography>
            </Box>
            <Box
              component="textarea"
              placeholder="Description"
              value={description}
              rows={5}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(e.target.value)
              }
              sx={{
                display: "block",
                width: "100%",
                bgcolor: "transparent",
                border: "none",
                outline: "none",
                color: TEXT,
                fontSize: 13,
                resize: "none",
                p: "8px 10px",
                boxSizing: "border-box",
                userSelect: "text",
                fontFamily: "inherit",
                "&::placeholder": { color: MUTED },
              }}
            />
          </Box>

          {/* Options */}
          <Box sx={{ px: 0.75, mb: 0.75 }}>
            <Typography
              onClick={() => setShowOptions((v) => !v)}
              sx={{
                fontSize: 12.5,
                color: MUTED,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                userSelect: "none",
              }}
            >
              {showOptions ? "▼" : "▶"} Commit options
            </Typography>
            {showOptions && (
              <Box
                sx={{ display: "flex", alignItems: "center", mt: 0.5, pl: 0.5 }}
              >
                <Checkbox
                  size="small"
                  checked={pushAfterCommit}
                  onChange={(e) => setPushAfterCommit(e.target.checked)}
                  sx={{
                    p: "3px",
                    mr: 0.5,
                    color: MUTED,
                    "&.Mui-checked": { color: GREEN },
                  }}
                />
                <Typography sx={{ fontSize: 12.5, color: MUTED }}>
                  Push after committing
                </Typography>
              </Box>
            )}
          </Box>

          {/* CTA */}
          <Box sx={{ p: 1, pt: 0, pb: 1.5 }}>
            <Box
              component="button"
              onClick={canCommit ? handleCommit : undefined}
              sx={{
                width: "100%",
                py: 1,
                borderRadius: "0px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.75,
                bgcolor: "#314739",
                border: "1px solid #5cb85c",
                cursor: canCommit ? "pointer" : "default",
                outline: "none",
                transition: "all 0.15s",
                opacity: canCommit ? 1 : 0.4,
                "&:hover": canCommit ? { bgcolor: "#477f4b" } : {},
              }}
            >
              <Typography sx={{ fontSize: 12, color: TEXT }}>-o-</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                {canCommit
                  ? `Commit ${staged.length} file${staged.length !== 1 ? "s" : ""}`
                  : "Stage Changes to Commit"}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Discard confirmation dialog ── */}
      <Dialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#1e2228",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              minWidth: 340,
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            fontSize: 14,
            fontWeight: 600,
            color: TEXT,
            fontFamily: FONT,
            pb: 0.5,
          }}
        >
          Descartar todas as alterações?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: MUTED, fontFamily: FONT }}>
            Todos os arquivos não commitados serão revertidos para o estado do
            último commit. Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setDiscardOpen(false)}
            sx={{
              fontSize: 12.5,
              color: MUTED,
              fontFamily: FONT,
              textTransform: "none",
              "&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDiscardConfirm}
            sx={{
              fontSize: 12.5,
              fontFamily: FONT,
              textTransform: "none",
              fontWeight: 600,
              bgcolor: "#4a2f33",
              color: "#f87171",
              border: "1px solid #d9413d",
              borderRadius: "4px",
              px: 2,
              "&:hover": { bgcolor: "#923839" },
            }}
          >
            Descartar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
