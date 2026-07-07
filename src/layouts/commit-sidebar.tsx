import { useState, useEffect, useCallback } from "react";
import type { ChangeEvent } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

import { toast } from "sonner";

import { Iconify } from "src/components/iconify";
import type { FileStatus, RepoPayload } from "src/types/electron";

import {
  BG,
  BORDER,
  COMMIT_SIDEBAR_WIDTH,
  FONT,
  GREEN,
  MUTED,
  RED_BG,
  SUMMARY_MAX,
  TEAL,
  TEXT,
  iconBtn,
} from "./sidebar/constants";
import { FileSection } from "./sidebar/file-section";

export { COMMIT_SIDEBAR_WIDTH };

// ----------------------------------------------------------------------

const StageAllBtn = (
  <Box
    sx={{
      fontSize: 12,
      color: "rgba(255,255,255,0.8)",
      fontWeight: 500,
      border: "1px solid #5cb85c",
      borderRadius: "2px",
      px: 1,
      py: "4px",
      bgcolor: "#314739",
      transition: "all 0.1s",
      "&:hover": { bgcolor: "#477f4b", borderColor: "#477f4b" },
      pointerEvents: "auto",
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
      borderRadius: "2px",
      px: 1,
      py: "4px",
      bgcolor: "#4a2f33",
      transition: "all 0.1s",
      "&:hover": { bgcolor: "#923839", borderColor: "#923839" },
      pointerEvents: "auto",
      
    }}
  >
    Unstage All
  </Box>
);

// ----------------------------------------------------------------------

type Props = {
  payload: RepoPayload;
  onRefresh: (newPayload: RepoPayload) => void;
};

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

  const handleStageAll = useCallback(async () => {
    await window.api.gitStageAll(payload.repoPath);
    await loadStatus();
  }, [payload.repoPath, loadStatus]);

  const handleStageFile = useCallback(
    async (p: string) => {
      await window.api.gitStageFile(payload.repoPath, p);
      await loadStatus();
    },
    [payload.repoPath, loadStatus],
  );

  const handleUnstageFile = useCallback(
    async (p: string) => {
      await window.api.gitUnstageFile(payload.repoPath, p);
      await loadStatus();
    },
    [payload.repoPath, loadStatus],
  );

  const handleUnstageAll = useCallback(async () => {
    await Promise.all(
      staged.map((f) => window.api.gitUnstageFile(payload.repoPath, f.path)),
    );
    await loadStatus();
  }, [staged, payload.repoPath, loadStatus]);

  const handleDiscardConfirm = useCallback(async () => {
    setDiscardOpen(false);
    const result = await window.api.gitDiscardAll(payload.repoPath);
    if (result.error) toast.error(result.error);
    else {
      await loadStatus();
      toast.success("Alterações descartadas.");
    }
  }, [payload.repoPath, loadStatus]);

  const handleCommit = useCallback(async () => {
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
          } catch (pushErr: unknown) {
            toast.dismiss("push-loading");
            const msg =
              pushErr instanceof Error ? pushErr.message : String(pushErr);
            toast.error(`Erro no push: ${msg}`);
          }
        }
      }
    } finally {
      setCommitting(false);
    }
  }, [
    summary,
    staged,
    committing,
    payload.repoPath,
    description,
    loadStatus,
    onRefresh,
    pushAfterCommit,
  ]);

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
          "& *": { fontFamily: FONT },
        }}
      >
        {/* ── TOP SECTION ── */}
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
          {/* Header */}
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
                borderRadius: "2px",
                width: 24,
                height: 24,
                flexShrink: 0,
                "& .trash-icon": { opacity: 0.7, transition: "opacity 0.1s" },
                "&:hover": {
                  bgcolor: "#923839",
                  "& .trash-icon": { opacity: 1 },
                },
              }}
              title="Descartar todas as alterações"
            >
              <Iconify
                icon="solar:trash-bin-trash-linear"
                width={16}
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

          {/* View Toggle */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              px: 0.75,
              minHeight: 32,
              flexShrink: 0,
            }}
          >
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

            <Box sx={{ width: 22, flexShrink: 0 }} />
          </Box>

          {/* File List */}
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

        {/* ── Commit Panel ── */}
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
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
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
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
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
                gap: 0.25,
                userSelect: "none",
              }}
            >
              <Iconify
                icon={showOptions ? "ic:baseline-arrow-drop-down" : "ic:baseline-arrow-right"}
                width={16}
                sx={{ ml: -0.5 }}
              />
              Commit options
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
                // transition: "all 0.15s",
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

      {/* ── Discard dialog ── */}
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
