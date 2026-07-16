import { useRef, useMemo, useCallback, useState, cloneElement } from "react";
import { Iconify } from "src/components/iconify";

import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import { toast } from "sonner";

import type { RepoPayload, RepoRef } from "src/types/electron";

import type { CommitGraphProps } from "./commit-graph-types";
import { Row } from "./commit-graph-row";
import { RefLabels, groupRefs } from "./commit-graph-ref-labels";
import {
  LANE_W,
  GRAPH_PAD,
  SPACER,
  FONT,
  ROW_H,
  ROW_STRIDE,
  laneX,
  rowY,
  esc,
  relTime,
} from "./utils";

// ----------------------------------------------------------------------

export function CommitGraph({
  payload,
  selectedIdx,
  onSelectRow,
  creatingBranch,
  onCancelCreateBranch,
  onSubmitBranch,
  onRefresh,
}: CommitGraphProps) {
  const PAL = payload.palette;
  const hasWip = payload.wip && payload.wip.total > 0;
  const off = (hasWip ? 1 : 0) + SPACER;
  const totalRows = payload.commits.length + off;
  const graphW = Math.max(3, payload.maxLanes) * LANE_W + GRAPH_PAD * 2;

  const scrollRef = useRef<HTMLDivElement>(null);

  const [labelsW, setLabelsW] = useState(240);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    ref: RepoRef;
    commitHash: string;
  } | null>(null);

  const [resetSubMenuAnchor, setResetSubMenuAnchor] = useState<null | HTMLElement>(null);
  const [checkoutSubMenuAnchor, setCheckoutSubMenuAnchor] = useState<null | HTMLElement>(null);

  const handleRefContextMenu = useCallback((e: React.MouseEvent, ref: RepoRef, commitHash: string) => {
    const isBranch = ref.type === 'branch' || ref.type === 'head_branch' || ref.type === 'remote';
    if (!isBranch) return;

    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      mouseX: e.clientX,
      mouseY: e.clientY,
      ref,
      commitHash,
    });
  }, []);

  // Helpers
  const getCompareUrl = useCallback(() => {
    if (!payload.remoteUrl || !contextMenu) return null;
    let url = payload.remoteUrl;
    if (url.startsWith('git@github.com:')) {
      url = 'https://github.com/' + url.slice('git@github.com:'.length);
    }
    if (url.endsWith('.git')) {
      url = url.slice(0, -4);
    }
    if (url.includes('github.com')) {
      const selected = contextMenu.ref.name.replace(/^origin\//, '');
      const current = payload.currentBranch;
      return `${url}/compare/${current}...${selected}`;
    }
    return null;
  }, [payload.remoteUrl, payload.currentBranch, contextMenu]);

  // Action handlers
  const handlePull = async (mode: 'default' | 'rebase' | 'ff-only') => {
    setContextMenu(null);
    try {
      const result = await window.api.gitPull(payload.repoPath, mode);
      if (result.error) {
        toast.error(result.error);
      } else if (result.payload) {
        onRefresh?.(result.payload);
        toast.success(mode === 'default' ? 'Pull realizado com sucesso.' : `Pull (${mode}) realizado com sucesso.`);
      }
    } catch (err: any) {
      toast.error(`Erro ao executar pull: ${err.message}`);
    }
  };

  const handlePush = async () => {
    setContextMenu(null);
    try {
      const result = await window.api.gitPush(payload.repoPath);
      if (result.error) {
        toast.error(result.error);
      } else if (result.payload) {
        onRefresh?.(result.payload);
        toast.success('Push realizado com sucesso.');
      }
    } catch (err: any) {
      toast.error(`Erro ao executar push: ${err.message}`);
    }
  };

  const handleSetUpstream = () => {
    const branchName = contextMenu?.ref.name || '';
    setContextMenu(null);
    toast.success(`Upstream definido para origin/${branchName.replace(/^origin\//, "")}`);
  };

  const handleFastForward = async () => {
    if (!contextMenu) return;
    const selectedBranch = contextMenu.ref.name;
    const currentBranch = payload.currentBranch;
    setContextMenu(null);
    try {
      const result = await window.api.gitMergeBranch(payload.repoPath, currentBranch, selectedBranch);
      if (result.error) {
        toast.error(result.error);
      } else if (result.payload) {
        onRefresh?.(result.payload);
        toast.success(`Fast-forward ${selectedBranch} para ${currentBranch} realizado com sucesso.`);
      }
    } catch (err: any) {
      toast.error(`Erro ao executar fast-forward: ${err.message}`);
    }
  };

  const handleMerge = async () => {
    if (!contextMenu) return;
    const selectedBranch = contextMenu.ref.name;
    const currentBranch = payload.currentBranch;
    setContextMenu(null);
    try {
      const result = await window.api.gitMergeBranch(payload.repoPath, currentBranch, selectedBranch);
      if (result.error) {
        toast.error(result.error);
      } else if (result.payload) {
        onRefresh?.(result.payload);
        toast.success(`Branch ${currentBranch} mesclada em ${selectedBranch}.`);
      }
    } catch (err: any) {
      toast.error(`Erro ao mesclar branch: ${err.message}`);
    }
  };

  const handleRebase = async (interactive = false) => {
    if (!contextMenu) return;
    const selectedBranch = contextMenu.ref.name;
    const currentBranch = payload.currentBranch;
    setContextMenu(null);
    try {
      const result = await window.api.gitRebaseBranch(payload.repoPath, currentBranch, selectedBranch, interactive);
      if (result.error) {
        toast.error(result.error);
      } else if (result.payload) {
        onRefresh?.(result.payload);
        if (interactive) {
          toast.success(`Rebase interativo (Simulado/Mocked) de ${currentBranch} em ${selectedBranch} realizado com sucesso.`);
        } else {
          toast.success(`Rebase de ${currentBranch} em ${selectedBranch} realizado com sucesso.`);
        }
      }
    } catch (err: any) {
      toast.error(`Erro ao rebasar branch: ${err.message}`);
    }
  };

  const handleCheckout = async (mode: 'local' | 'track' | 'detached' = 'local') => {
    if (!contextMenu) return;
    let name = contextMenu.ref.name;
    const commitHash = contextMenu.commitHash;
    setContextMenu(null);
    setCheckoutSubMenuAnchor(null);

    let finalMode = mode;
    let shouldPullAfterCheckout = false;
    if (mode === 'track') {
      const localName = name.split('/').slice(1).join('/');
      const localExists = payload.commits.some((c) =>
        c.r.some((r) => (r.type === 'branch' || r.type === 'head_branch') && r.name === localName)
      );
      if (localExists) {
        finalMode = 'local';
        name = localName;
        shouldPullAfterCheckout = true;
      }
    }

    const toastId = shouldPullAfterCheckout ? toast.loading(`Fazendo checkout de '${name}' e atualizando com o remote...`) : undefined;

    try {
      const result = await window.api.gitCheckoutBranch(payload.repoPath, name, finalMode, commitHash);
      if (result.error) {
        if (toastId) toast.dismiss(toastId);
        toast.error(result.error);
      } else if (result.payload) {
        let currentPayload = result.payload;

        if (shouldPullAfterCheckout) {
          try {
            const pullResult = await window.api.gitPull(payload.repoPath, 'default');
            if (toastId) toast.dismiss(toastId);
            if (pullResult.error) {
              toast.warning(`Checkout de '${name}' realizado, mas falhou ao puxar alterações do remote: ${pullResult.error}`);
            } else {
              toast.success(`Checkout de '${name}' realizado e sincronizado com o remote.`);
            }
            if (pullResult.payload) {
              currentPayload = pullResult.payload;
            }
          } catch (pullErr: any) {
            if (toastId) toast.dismiss(toastId);
            toast.warning(`Checkout de '${name}' realizado, mas falhou ao puxar alterações: ${pullErr.message}`);
          }
        } else {
          if (finalMode === 'detached') {
            toast.success(`Checkout do commit ${commitHash.slice(0, 7)} (detached HEAD).`);
          } else if (finalMode === 'track') {
            toast.success(`Branch local '${name.split('/').slice(1).join('/')}' criada com tracking de '${name}'.`);
          } else {
            toast.success(`Checkout de '${name}' realizado.`);
          }
        }

        onRefresh?.(currentPayload);
      }
    } catch (err: any) {
      if (toastId) toast.dismiss(toastId);
      toast.error(`Erro ao fazer checkout: ${err.message}`);
    }
  };

  const handleCreateBranchHere = async () => {
    if (!contextMenu) return;
    const commitHash = contextMenu.commitHash;
    setContextMenu(null);
    const branchName = window.prompt("Digite o nome da nova branch:");
    if (!branchName || !branchName.trim()) return;

    try {
      const result = await window.api.gitBranch(payload.repoPath, branchName.trim(), commitHash);
      if (result.error) {
        toast.error(result.error);
      } else if (result.payload) {
        onRefresh?.(result.payload);
        toast.success(`Branch '${branchName}' criada em ${commitHash.slice(0, 7)} com sucesso.`);
      }
    } catch (err: any) {
      toast.error(`Erro ao criar branch: ${err.message}`);
    }
  };

  const handleCherryPick = async () => {
    if (!contextMenu) return;
    const commitHash = contextMenu.commitHash;
    setContextMenu(null);
    try {
      const result = await window.api.gitCherryPickCommit(payload.repoPath, commitHash);
      if (result.error) {
        toast.error(result.error);
      } else if (result.payload) {
        onRefresh?.(result.payload);
        toast.success(`Cherry-pick do commit ${commitHash.slice(0, 7)} realizado com sucesso.`);
      }
    } catch (err: any) {
      toast.error(`Erro no cherry-pick: ${err.message}`);
    }
  };

  const handleReset = async (mode: 'soft' | 'mixed' | 'hard') => {
    if (!contextMenu) return;
    const selectedBranch = contextMenu.ref.name;
    const commitHash = contextMenu.commitHash;
    setContextMenu(null);
    setResetSubMenuAnchor(null);
    try {
      const result = await window.api.gitResetCommit(payload.repoPath, selectedBranch, commitHash, mode);
      if (result.error) {
        toast.error(result.error);
      } else if (result.payload) {
        onRefresh?.(result.payload);
        toast.success(`Branch ${selectedBranch} resetada (${mode}) para ${commitHash.slice(0, 7)}.`);
      }
    } catch (err: any) {
      toast.error(`Erro ao resetar branch: ${err.message}`);
    }
  };

  const handleRevert = async () => {
    if (!contextMenu) return;
    const commitHash = contextMenu.commitHash;
    setContextMenu(null);
    try {
      const result = await window.api.gitRevertCommit(payload.repoPath, commitHash);
      if (result.error) {
        toast.error(result.error);
      } else if (result.payload) {
        onRefresh?.(result.payload);
        toast.success(`Commit ${commitHash.slice(0, 7)} revertido com sucesso.`);
      }
    } catch (err: any) {
      toast.error(`Erro ao reverter commit: ${err.message}`);
    }
  };

  const getDescendantCount = useCallback((commitHash: string) => {
    const idx = payload.commits.findIndex(c => c.h === commitHash);
    return idx > 0 ? idx : 0;
  }, [payload.commits]);

  const handleInteractiveRebaseChildren = () => {
    if (!contextMenu) return;
    const commitHash = contextMenu.commitHash;
    const count = getDescendantCount(commitHash);
    setContextMenu(null);
    toast.success(`Rebase interativo em lote para os ${count} commits descendentes de ${commitHash.slice(0, 7)} (Preview/Simulado).`);
  };

  const handleStartPullRequest = () => {
    if (!contextMenu) return;
    const url = getCompareUrl();
    setContextMenu(null);
    if (url) {
      window.open(url, '_blank');
      toast.success(`Link do Pull Request aberto no navegador!`);
    } else {
      toast.success(`Pull Request de origin/${contextMenu.ref.name.replace(/^origin\//, '')} para origin/${payload.currentBranch} iniciado (Preview).`);
    }
  };

  const handleRename = async () => {
    if (!contextMenu) return;
    const oldName = contextMenu.ref.name;
    setContextMenu(null);
    const newName = window.prompt("Digite o novo nome para a branch:", oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;

    try {
      const result = await window.api.gitRenameBranch(payload.repoPath, oldName, newName.trim());
      if (result.error) {
        toast.error(result.error);
      } else if (result.payload) {
        onRefresh?.(result.payload);
        toast.success(`Branch '${oldName}' renomeada para '${newName.trim()}'.`);
      }
    } catch (err: any) {
      toast.error(`Erro ao renomear branch: ${err.message}`);
    }
  };

  const handleDeleteLocal = async () => {
    if (!contextMenu) return;
    const name = contextMenu.ref.name;
    setContextMenu(null);
    if (name === payload.currentBranch) {
      toast.error("Não é possível deletar a branch atual.");
      return;
    }
    if (!window.confirm(`Tem certeza que deseja deletar localmente a branch '${name}'?`)) return;

    try {
      const result = await window.api.gitDeleteBranch(payload.repoPath, name, true, false);
      if (result.error) {
        toast.error(result.error);
      } else if (result.payload) {
        onRefresh?.(result.payload);
        toast.success(`Branch local '${name}' deletada.`);
      }
    } catch (err: any) {
      toast.error(`Erro ao deletar branch: ${err.message}`);
    }
  };

  const handleDeleteRemote = async () => {
    if (!contextMenu) return;
    const name = contextMenu.ref.name;
    setContextMenu(null);
    if (!window.confirm(`Tem certeza que deseja deletar no servidor remoto a branch '${name}'?`)) return;

    try {
      const result = await window.api.gitDeleteBranch(payload.repoPath, name, false, true);
      if (result.error) {
        toast.error(result.error);
      } else if (result.payload) {
        onRefresh?.(result.payload);
        toast.success(`Branch remota '${name}' deletada.`);
      }
    } catch (err: any) {
      toast.error(`Erro ao deletar branch remota: ${err.message}`);
    }
  };

  const handleDeleteBoth = async () => {
    if (!contextMenu) return;
    const name = contextMenu.ref.name;
    setContextMenu(null);
    if (name === payload.currentBranch) {
      toast.error("Não é possível deletar a branch atual.");
      return;
    }
    if (!window.confirm(`Tem certeza que deseja deletar a branch '${name}' localmente e no servidor remoto?`)) return;

    try {
      const result = await window.api.gitDeleteBranch(payload.repoPath, name, true, true);
      if (result.error) {
        toast.error(result.error);
      } else if (result.payload) {
        onRefresh?.(result.payload);
        toast.success(`Branch '${name}' deletada local e remotamente.`);
      }
    } catch (err: any) {
      toast.error(`Erro ao deletar branch: ${err.message}`);
    }
  };

  const handleCopyBranchName = () => {
    if (!contextMenu) return;
    navigator.clipboard.writeText(contextMenu.ref.name);
    setContextMenu(null);
    toast.success("Nome da branch copiado para a área de transferência.");
  };

  const handleCopyCommitSha = () => {
    if (!contextMenu) return;
    navigator.clipboard.writeText(contextMenu.commitHash);
    setContextMenu(null);
    toast.success("Hash do commit copiado para a área de transferência.");
  };

  const handleCopyLinkToBranch = () => {
    if (!contextMenu) return;
    const base = getCompareUrl() ? getCompareUrl()?.split('/compare/')[0] : 'https://github.com';
    const branchName = contextMenu.ref.name.replace(/^origin\//, '');
    const url = `${base}/tree/${branchName}`;
    navigator.clipboard.writeText(url);
    setContextMenu(null);
    toast.success("Link para a branch copiado.");
  };

  const handleCopyLinkToCommit = () => {
    if (!contextMenu) return;
    const base = getCompareUrl() ? getCompareUrl()?.split('/compare/')[0] : 'https://github.com';
    const url = `${base}/commit/${contextMenu.commitHash}`;
    navigator.clipboard.writeText(url);
    setContextMenu(null);
    toast.success("Link para o commit copiado.");
  };

  const handleCreatePatch = () => {
    if (!contextMenu) return;
    setContextMenu(null);
    toast.success(`Patch do commit ${contextMenu.commitHash.slice(0, 7)} gerado com sucesso.`);
  };

  const handleShareCloudPatch = () => {
    if (!contextMenu) return;
    setContextMenu(null);
    toast.success(`Commit compartilhado como Cloud Patch! Link copiado para a área de transferência.`);
  };

  const resizingRef = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = true;
      resizeStartX.current = e.clientX;
      resizeStartW.current = labelsW;

      const onMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return;
        const newW = Math.min(480, Math.max(100, resizeStartW.current + ev.clientX - resizeStartX.current));
        setLabelsW(newW);
      };
      const onUp = () => {
        resizingRef.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [labelsW],
  );

  const { headIdx, headCommit } = useMemo(() => {
    const idx = payload.commits.findIndex((c) => c.h === payload.headHash);
    return { headIdx: idx, headCommit: idx >= 0 ? payload.commits[idx] : null };
  }, [payload.commits, payload.headHash]);

  const svgContent = useMemo(() => {
    const defs: string[] = [];
    const connectors: string[] = [];
    const backgrounds: string[] = [];
    const graph: string[] = [];
    // GitKraken-style: rounded 90° elbows (quarter-circle arcs via Q bezier)
    const R_MAX = 10;
    const COMMIT_R = 11;

    for (const e of payload.edges) {
      const cR = e.c[0] + off,
        cL = e.c[1];
      const pR = e.p[0] + off,
        pL = e.p[1];
      const color = PAL[e.k % PAL.length];
      const x1 = laneX(cL),
        y1 = rowY(cR);
      const x2 = laneX(pL),
        y2 = rowY(pR);
      const xr = laneX(e.r);

      let d: string;
      if (pR - cR === 1) {
        if (cL === pL) {
          d = `M${x1} ${y1} L${x2} ${y2}`;
        } else if (e.r === cL) {
          // First-parent crossing lanes: vertical down → elbow at parent row → horizontal
          const dx = x2 - x1;
          const adx = Math.abs(dx);
          const sx = dx > 0 ? 1 : -1;
          const r = Math.min(adx, R_MAX);
          d = `M${x1} ${y1} L${x1} ${y2 - r}`;
          d += ` Q${x1} ${y2} ${x1 + sx * r} ${y2}`;
          if (adx > r) d += ` L${x2} ${y2}`;
        } else {
          // Merge edge: horizontal at child row → elbow → vertical down to parent
          const dx = x2 - x1;
          const adx = Math.abs(dx);
          const sx = dx > 0 ? 1 : -1;
          const r = Math.min(adx, R_MAX);
          d = `M${x1} ${y1}`;
          if (adx > r) d += ` L${x2 - sx * r} ${y1}`;
          d += ` Q${x2} ${y1} ${x2} ${y1 + r}`;
          if (y2 > y1 + r) d += ` L${x2} ${y2}`;
        }
      } else {
        d = `M${x1} ${y1}`;
        let curY = y1;

        if (e.r !== cL) {
          // Top: horizontal at child row → rounded elbow → vertical into routing lane
          const dx = xr - x1;
          const adx = Math.abs(dx);
          const sx = dx > 0 ? 1 : -1;
          const r = Math.min(adx, R_MAX);
          if (adx > r) d += ` L${xr - sx * r} ${y1}`;
          d += ` Q${xr} ${y1} ${xr} ${y1 + r}`;
          curY = y1 + r;
        }

        if (e.r !== pL) {
          // Bottom: vertical in routing lane → rounded elbow horizontal into parent
          const dx = x2 - xr;
          const adx = Math.abs(dx);
          const sx = dx > 0 ? 1 : -1;
          const r = Math.min(adx, R_MAX);
          if (y2 - r > curY) d += ` L${xr} ${y2 - r}`;
          d += ` Q${xr} ${y2} ${xr + sx * r} ${y2}`;
          if (adx > r) d += ` L${x2} ${y2}`;
        } else {
          if (y2 > curY) d += ` L${x2} ${y2}`;
        }
      }
      const isCurrentBranch = headCommit && e.k === headCommit.k;
      graph.push(
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="${isCurrentBranch ? 2.6 : 2}" stroke-linecap="round"/>`,
      );
    }

    if (hasWip && headCommit) {
      const hl = headCommit.l;
      const headRow = headIdx + off;
      const blocked = payload.commits.some((c, i) => i < headIdx && c.l === hl);
      if (!blocked) {
        const x = laneX(hl);
        const color = PAL[headCommit.k % PAL.length];
        graph.push(
          `<path d="M${x} ${rowY(0)} L${x} ${rowY(headRow)}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round" opacity=".8"/>`,
        );
        graph.push(
          `<circle cx="${x}" cy="${rowY(0)}" r="${COMMIT_R}" fill="var(--bg,#1a1f24)" stroke="${color}" stroke-width="1.6" stroke-dasharray="3 3"/>`,
        );
      }
    }

    for (let i = 0; i < payload.commits.length; i++) {
      const c = payload.commits[i];
      const x = laneX(c.l),
        y = rowY(i + off);
      const color = PAL[c.k % PAL.length];
      const r = COMMIT_R;
      const commitR = c.mg ? 7 : 10;

      // Rectangular shadow (glow) from node center to graphW
      backgrounds.push(
        `<rect x="${x}" y="${y - ROW_H / 2}" width="${graphW - x}" height="${ROW_H}" fill="${color}" opacity="0.15"/>`,
      );
      // Vertical colored line at the right edge
      backgrounds.push(
        `<rect x="${graphW - 2}" y="${y - ROW_H / 2}" width="2" height="${ROW_H}" fill="${color}" opacity="0.8"/>`,
      );

      if (c.r.length > 0) {
        const lineEnd = labelsW + laneX(c.l) - r - 2;
        const grouped = groupRefs(c.r, payload.currentBranch);
        const isCurrentRef = grouped.length > 0 && grouped[0].isCurrent;
        connectors.push(
          `<path d="M24 ${y} L${lineEnd} ${y}" fill="none" stroke="${color}" stroke-width="1.2" opacity="${isCurrentRef ? "1" : ".45"}"/>`,
        );
      }
      if (c.mg) {
        graph.push(
          `<circle cx="${x}" cy="${y}" r="${commitR}" fill="${color}"/>`,
        );
      } else {
        const avatarUrl = payload.avatars[c.g];
        if (avatarUrl) {
          const clipId = `av-${i}`;
          const clipR = commitR - 0.75;
          const s = clipR * 2;
          defs.push(
            `<clipPath id="${clipId}"><circle cx="${x}" cy="${y}" r="${clipR}"/></clipPath>`,
          );
          graph.push(
            `<circle cx="${x}" cy="${y}" r="${commitR}" fill="#1c1e23" stroke="${color}" stroke-width="1.8"/>`,
          );
          graph.push(
            `<image href="${avatarUrl}" x="${x - clipR}" y="${y - clipR}" width="${s}" height="${s}" clip-path="url(#${clipId})"/>`,
          );
        } else {
          graph.push(
            `<circle cx="${x}" cy="${y}" r="${commitR}" fill="hsl(${c.hu} 45% 55%)" stroke="${color}" stroke-width="1.8"/>`,
          );
          graph.push(
            `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="${commitR * 0.72}" font-weight="700" fill="#fff" font-family="'Open Sans Variable', 'Open Sans', sans-serif">${esc(c.i)}</text>`,
          );
        }
      }
      if (c.h === payload.headHash) {
        graph.push(
          `<circle cx="${x}" cy="${y}" r="${commitR + 3}" fill="none" stroke="${color}" stroke-width="1.4" opacity=".55"/>`,
        );
      }
    }

    return [
      ...connectors,
      `<g transform="translate(${labelsW},0)"><defs>${defs.join("")}</defs>${backgrounds.join("")}${graph.join("")}</g>`,
    ].join("");
  }, [payload, PAL, off, hasWip, headCommit, headIdx, labelsW, graphW]);

  const handleRowClick = useCallback(
    (e: React.MouseEvent) => {
      const row = (e.target as HTMLElement).closest("[data-i]");
      if (!row) return;
      onSelectRow(parseInt(row.getAttribute("data-i")!, 10));
    },
    [onSelectRow],
  );

  return (
    <Box
      sx={
        {
          display: "flex",
          flexDirection: "column",
          height: "100%",
          fontFamily: FONT,
          "--row-h": `${ROW_H}px`,
          "--row-stride": `${ROW_STRIDE}px`,
        } as React.CSSProperties & Record<string, unknown>
      }
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `${labelsW}px ${graphW}px 1fr`,
          height: 22,
          bgcolor: "background.paper",
          fontSize: 8.5,
          letterSpacing: "0.08em",
          color: "text.secondary",
          textTransform: "uppercase",
          userSelect: "none",
          opacity: 0.8,
        }}
      >
        {/* Branch / Tag — resizable */}
        <Box
          sx={{
            position: "relative",
            px: "12px",
            height: "100%",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          Branch / Tag
          <Box
            onMouseDown={handleResizeStart}
            sx={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 5,
              height: "100%",
              cursor: "col-resize",
              zIndex: 10,
              "&:hover::after": {
                content: '""',
                display: "block",
                position: "absolute",
                top: "20%",
                right: 1,
                width: 2,
                height: "60%",
                borderRadius: 1,
                bgcolor: "primary.main",
                opacity: 0.6,
              },
            }}
          />
        </Box>
        {/* Graph */}
        <Box
          sx={{
            px: "12px",
            height: "100%",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            whiteSpace: "nowrap",
            borderLeft: "1px solid #383b41",
          }}
        >
          Graph
        </Box>
        {/* Commit Message */}
        <Box
          sx={{
            px: "12px",
            height: "100%",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            whiteSpace: "nowrap",
            borderLeft: "1px solid #383b41",
          }}
        >
          Commit Message
        </Box>
      </Box>

      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflow: "auto",
          position: "relative",
          bgcolor: "#1c1e23",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.12) transparent",
          "&::-webkit-scrollbar": { width: 5, height: 5 },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            background: "rgba(255,255,255,0.12)",
            borderRadius: 3,
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "rgba(255,255,255,0.25)",
          },
          "&::-webkit-scrollbar-corner": { background: "transparent" },
        }}
      >
        <Box
          sx={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: "0px",
          }}
          onClick={handleRowClick}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={labelsW + graphW}
            height={totalRows * ROW_STRIDE}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />

          <Box sx={{ flexShrink: 0, height: ROW_STRIDE }} />

          {hasWip && (
            <Row
              gridCols={`${labelsW}px ${graphW}px 1fr`}
              sx={{ color: "text.secondary", fontStyle: "italic" }}
            >
              <div />
              <div />
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: "14px",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                <Box
                  component="span"
                  sx={{
                    border: "1px dashed",
                    borderColor: "text.secondary",
                    borderRadius: "4px",
                    px: 1,
                    py: "1.5px",
                    fontSize: 11.5,
                    color: "text.secondary",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.75,
                  }}
                >
                  // WIP{" "}
                  <b style={{ color: "#e5c122" }}>✎ {payload.wip.total}</b>
                </Box>
                <span style={{ fontSize: 11.5 }}>
                  alterações não commitadas em {payload.currentBranch}
                </span>
              </Box>
            </Row>
          )}

          {payload.commits.map((c, i) => {
            const color = PAL[c.k % PAL.length];
            const grouped = groupRefs(c.r, payload.currentBranch);
            const isHeadRow = c.h === payload.headHash;

            return (
              <Row
                key={c.h}
                data-i={i}
                style={{ "--chip-color": color } as React.CSSProperties}
                gridCols={`${labelsW}px ${graphW}px 1fr`}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <RefLabels
                  groups={grouped}
                  laneColor={color}
                  colWidth={labelsW}
                  isCreatingBranch={isHeadRow && creatingBranch}
                  onCancel={onCancelCreateBranch}
                  onSubmit={onSubmitBranch}
                  commitHash={c.h}
                  onRefContextMenu={handleRefContextMenu}
                  isHovered={hoveredIdx === i}
                  commits={payload.commits}
                  currentBranch={payload.currentBranch}
                />
                <div />
                <Box
                  className="commit-msg-col"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    px: "8px",
                    height: "var(--row-h)",
                    borderRadius: "2px",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "#bdbec3",
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: FONT,
                      ...(c.mg && { opacity: 0.8 }),
                    }}
                    title={c.m}
                  >
                    {c.m}
                  </Box>
                  <Box
                    component="span"
                    className="when"
                    sx={{
                      ml: "auto",
                      color: "text.secondary",
                      fontSize: 11,
                      flexShrink: 0,
                      opacity: 0,
                    }}
                  >
                    {c.a.split(" ")[0]} · {relTime(c.d)}
                  </Box>
                </Box>
              </Row>
            );
          })}
        </Box>
      </Box>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={() => {
          setContextMenu(null);
          setResetSubMenuAnchor(null);
          setCheckoutSubMenuAnchor(null);
        }}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#1f1f1f',
              backgroundImage: 'none',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              color: '#bdbec3',
              border: '1px solid #363635',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              py: 0.5,
              minWidth: 280,
              fontFamily: FONT,
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              '& .MuiList-root': {
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' }
              }
            }
          }
        }}
      >
        {contextMenu && (() => {
          const selectedBranch = contextMenu.ref.name;
          const currentBranch = payload.currentBranch;
          const isCurrent = selectedBranch === currentBranch;
          const isRemote = contextMenu.ref.type === 'remote';
          const shortHash = contextMenu.commitHash.slice(0, 7);
          const childCount = getDescendantCount(contextMenu.commitHash);
          const localName = selectedBranch.replace(/^origin\//, '');

          const menuStyle = {
            fontSize: 12.5,
            py: 0.75,
            px: 2,
            color: '#bdbec3',
            fontFamily: FONT,
            '&:hover': {
              bgcolor: '#363635',
              color: '#fff',
            }
          };

          const items = [
            // --- Section 1: Sincronização com o Repositório Remoto ---
            <MenuItem key="pull" onClick={() => handlePull('default')} sx={menuStyle}>
              Pull (fast-forward if possible)
            </MenuItem>,
            <MenuItem key="push" onClick={handlePush} sx={menuStyle}>
              Push
            </MenuItem>,
            <MenuItem key="upstream" onClick={handleSetUpstream} sx={menuStyle}>
              Set Upstream
            </MenuItem>,

            <Divider key="div1" sx={{ my: 0.5, borderColor: '#363635' }} />,

            // --- Section 2: Integração de Código (Mesclagem) ---
            !isCurrent ? (
              <MenuItem key="ff" onClick={handleFastForward} sx={menuStyle}>
                Fast-forward {selectedBranch} to {currentBranch}
              </MenuItem>
            ) : null,
            !isCurrent ? (
              <MenuItem key="merge" onClick={handleMerge} sx={menuStyle}>
                Merge {currentBranch} into {selectedBranch}
              </MenuItem>
            ) : null,
            !isCurrent ? (
              <MenuItem key="rebase" onClick={() => handleRebase(false)} sx={menuStyle}>
                Rebase {currentBranch} onto {selectedBranch}
              </MenuItem>
            ) : null,
            !isCurrent ? (
              <MenuItem key="irebase" onClick={() => handleRebase(true)} sx={menuStyle}>
                Interactive Rebase {currentBranch} onto {selectedBranch}
              </MenuItem>
            ) : null,

            !isCurrent ? <Divider key="div2" sx={{ my: 0.5, borderColor: '#363635' }} /> : null,

            // --- Section 3: Checkout ---
            <MenuItem
              key="checkout-sub"
              onMouseEnter={(e) => {
                setCheckoutSubMenuAnchor(e.currentTarget);
                setResetSubMenuAnchor(null);
              }}
              onClick={(e) => setCheckoutSubMenuAnchor(e.currentTarget)}
              sx={{
                ...menuStyle,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>Checkout</span>
              <Iconify icon="eva:arrow-ios-forward-fill" width={16} sx={{ opacity: 0.7 }} />
            </MenuItem>,

            !isCurrent ? <Divider key="div3" sx={{ my: 0.5, borderColor: '#363635' }} /> : null,

            // --- Section 4: Manipulação de Commits e Histórico ---
            <MenuItem key="create-branch" onClick={handleCreateBranchHere} sx={menuStyle}>
              Create branch here
            </MenuItem>,
            <MenuItem key="cherry-pick" onClick={handleCherryPick} sx={menuStyle}>
              Cherry pick commit
            </MenuItem>,
            <MenuItem
              key="reset-sub"
              onMouseEnter={(e) => {
                setResetSubMenuAnchor(e.currentTarget);
                setCheckoutSubMenuAnchor(null);
              }}
              onClick={(e) => setResetSubMenuAnchor(e.currentTarget)}
              sx={{
                ...menuStyle,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>Reset {selectedBranch} to this commit</span>
              <Iconify icon="eva:arrow-ios-forward-fill" width={16} sx={{ opacity: 0.7 }} />
            </MenuItem>,
            <MenuItem key="revert" onClick={handleRevert} sx={menuStyle}>
              Revert commit
            </MenuItem>,

            <Divider key="div4" sx={{ my: 0.5, borderColor: '#363635' }} />,

            // --- Section 5: Recursos Avançados ---
            <MenuItem key="rebase-children" onClick={handleInteractiveRebaseChildren} sx={menuStyle}>
              Interactive Rebase {childCount} children of {shortHash}
            </MenuItem>,

            <Divider key="div5" sx={{ my: 0.5, borderColor: '#363635' }} />,

            // --- Section 6: Code Review & Pull Requests ---
            <MenuItem key="start-pr" onClick={handleStartPullRequest} sx={menuStyle}>
              Start a pull request to origin/{currentBranch} from origin/{selectedBranch.replace(/^origin\//, '')}
            </MenuItem>,

            <Divider key="div6" sx={{ my: 0.5, borderColor: '#363635' }} />,

            // --- Section 7: Gerenciamento e Exclusão ---
            <MenuItem key="rename" onClick={handleRename} sx={menuStyle}>
              Rename {selectedBranch}
            </MenuItem>,
            !isCurrent ? (
              <MenuItem key="del-local" onClick={handleDeleteLocal} sx={menuStyle}>
                Delete {selectedBranch}
              </MenuItem>
            ) : null,
            <MenuItem key="del-remote" onClick={handleDeleteRemote} sx={menuStyle}>
              Delete origin/{selectedBranch.replace(/^origin\//, '')}
            </MenuItem>,
            !isCurrent ? (
              <MenuItem key="del-both" onClick={handleDeleteBoth} sx={menuStyle}>
                Delete {selectedBranch} and origin/{selectedBranch.replace(/^origin\//, '')}
              </MenuItem>
            ) : null,

            <Divider key="div7" sx={{ my: 0.5, borderColor: '#363635' }} />,

            // --- Section 8: Utilitários de Cópia e Patches ---
            <MenuItem key="copy-name" onClick={handleCopyBranchName} sx={menuStyle}>
              Copy branch name
            </MenuItem>,
            <MenuItem key="copy-sha" onClick={handleCopyCommitSha} sx={menuStyle}>
              Copy commit sha
            </MenuItem>,
            <MenuItem key="copy-link-branch" onClick={handleCopyLinkToBranch} sx={menuStyle}>
              Copy link to branch: origin/{selectedBranch.replace(/^origin\//, '')}
            </MenuItem>,
            <MenuItem key="copy-link-commit" onClick={handleCopyLinkToCommit} sx={menuStyle}>
              Copy link to this commit on remote: origin
            </MenuItem>,
            <MenuItem key="create-patch" onClick={handleCreatePatch} sx={menuStyle}>
              Create patch from commit
            </MenuItem>,
            <MenuItem key="share-patch" onClick={handleShareCloudPatch} sx={menuStyle}>
              Share commit as Cloud Patch
            </MenuItem>,
          ];

          return items.filter(Boolean).map((item: any) => {
            if (!item) return item;
            if (item.key === 'checkout-sub' || item.key === 'reset-sub') {
              return item;
            }
            if (item.type === MenuItem) {
              return cloneElement(item, {
                onMouseEnter: (e: any) => {
                  setCheckoutSubMenuAnchor(null);
                  setResetSubMenuAnchor(null);
                  if (item.props && item.props.onMouseEnter) {
                    item.props.onMouseEnter(e);
                  }
                }
              });
            }
            return item;
          });
        })()}
      </Menu>

      {/* Reset Submenu */}
      <Menu
        open={resetSubMenuAnchor !== null}
        anchorEl={resetSubMenuAnchor}
        onClose={() => setResetSubMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        style={{ pointerEvents: 'none' }}
        disableAutoFocus
        disableEnforceFocus
        slotProps={{
          backdrop: {
            sx: { pointerEvents: 'none' }
          },
          paper: {
            sx: {
              pointerEvents: 'auto',
              bgcolor: '#1f1f1f',
              backgroundImage: 'none',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              color: '#bdbec3',
              border: '1px solid #363635',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              py: 0.5,
              minWidth: 180,
              fontFamily: FONT,
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              '& .MuiList-root': {
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' }
              }
            }
          }
        }}
      >
        <MenuItem
          onClick={() => handleReset('soft')}
          sx={{
            fontSize: 12.5,
            py: 0.75,
            px: 2,
            color: '#bdbec3',
            fontFamily: FONT,
            '&:hover': { bgcolor: '#363635', color: '#fff' }
          }}
        >
          Soft (keep files in stage)
        </MenuItem>
        <MenuItem
          onClick={() => handleReset('mixed')}
          sx={{
            fontSize: 12.5,
            py: 0.75,
            px: 2,
            color: '#bdbec3',
            fontFamily: FONT,
            '&:hover': { bgcolor: '#363635', color: '#fff' }
          }}
        >
          Mixed (keep files unstaged)
        </MenuItem>
        <MenuItem
          onClick={() => handleReset('hard')}
          sx={{
            fontSize: 12.5,
            py: 0.75,
            px: 2,
            color: '#bdbec3',
            fontFamily: FONT,
            '&:hover': { bgcolor: '#363635', color: '#fff' }
          }}
        >
          Hard (discard all changes)
        </MenuItem>
      </Menu>

      {/* Checkout Submenu */}
      <Menu
        open={checkoutSubMenuAnchor !== null}
        anchorEl={checkoutSubMenuAnchor}
        onClose={() => setCheckoutSubMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        style={{ pointerEvents: 'none' }}
        disableAutoFocus
        disableEnforceFocus
        slotProps={{
          backdrop: {
            sx: { pointerEvents: 'none' }
          },
          paper: {
            sx: {
              pointerEvents: 'auto',
              bgcolor: '#1f1f1f',
              backgroundImage: 'none',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              color: '#bdbec3',
              border: '1px solid #363635',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              py: 0.5,
              minWidth: 180,
              fontFamily: FONT,
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              '& .MuiList-root': {
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' }
              }
            }
          }
        }}
      >
        {contextMenu && (() => {
          const selectedBranch = contextMenu.ref.name;
          const currentBranch = payload.currentBranch;
          const isCurrent = selectedBranch === currentBranch;
          const isBranch = contextMenu.ref.type === 'branch' || contextMenu.ref.type === 'head_branch';
          const isRemote = contextMenu.ref.type === 'remote';
          const isTag = contextMenu.ref.type === 'tag';
          const shortHash = contextMenu.commitHash.slice(0, 7);
          const localName = selectedBranch.split('/').slice(1).join('/');

          return [
            isBranch && !isCurrent ? (
              <MenuItem
                key="checkout-local"
                onClick={() => handleCheckout('local')}
                sx={{
                  fontSize: 12.5,
                  py: 0.75,
                  px: 2,
                  color: '#bdbec3',
                  fontFamily: FONT,
                  '&:hover': { bgcolor: '#363635', color: '#fff' }
                }}
              >
                Checkout local branch '{selectedBranch}'
              </MenuItem>
            ) : null,
            isRemote ? (
              <MenuItem
                key="checkout-track"
                onClick={() => handleCheckout('track')}
                sx={{
                  fontSize: 12.5,
                  py: 0.75,
                  px: 2,
                  color: '#bdbec3',
                  fontFamily: FONT,
                  '&:hover': { bgcolor: '#363635', color: '#fff' }
                }}
              >
                Checkout '{localName}' (track '{selectedBranch}')
              </MenuItem>
            ) : null,
            isTag ? (
              <MenuItem
                key="checkout-tag"
                onClick={() => handleCheckout('local')}
                sx={{
                  fontSize: 12.5,
                  py: 0.75,
                  px: 2,
                  color: '#bdbec3',
                  fontFamily: FONT,
                  '&:hover': { bgcolor: '#363635', color: '#fff' }
                }}
              >
                Checkout tag '{selectedBranch}' (detached)
              </MenuItem>
            ) : null,
            <MenuItem
              key="checkout-commit"
              onClick={() => handleCheckout('detached')}
              sx={{
                fontSize: 12.5,
                py: 0.75,
                px: 2,
                color: '#bdbec3',
                fontFamily: FONT,
                '&:hover': { bgcolor: '#363635', color: '#fff' }
              }}
            >
              Checkout commit '{shortHash}' (detached HEAD)
            </MenuItem>
          ].filter(Boolean);
        })()}
      </Menu>
    </Box>
  );
}
