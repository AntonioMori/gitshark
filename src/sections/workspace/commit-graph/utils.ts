import type { SlimCommit } from "src/types/electron";

import type { GroupedRef } from "./commit-graph-types";

// ----------------------------------------------------------------------

export const LANE_W = 22;
export const GRAPH_PAD = 14;
export const SPACER = 1;
export const FONT = '"Inter Variable", Inter, sans-serif';
export const MONO_FONT = "'JetBrains Mono', Consolas, Monaco, Menlo, monospace";

export const ROW_H = 22;
export const ROW_STRIDE = ROW_H + 4;

export function laneX(l: number) {
  return GRAPH_PAD + l * LANE_W + LANE_W / 2;
}
export function rowY(r: number) {
  return r * ROW_STRIDE + ROW_H / 2;
}

// ----------------------------------------------------------------------

export function esc(t: string) {
  return String(t).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ] ?? m,
  );
}

export function relTime(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const u: [number, string, string][] = [
    [31536000, "ano", "anos"],
    [2592000, "mês", "meses"],
    [604800, "semana", "semanas"],
    [86400, "dia", "dias"],
    [3600, "hora", "horas"],
    [60, "minuto", "minutos"],
  ];
  for (const [sec, sg, pl] of u) {
    const v = Math.floor(s / sec);
    if (v >= 1) return `há ${v} ${v === 1 ? sg : pl}`;
  }
  return "agora";
}

// ----------------------------------------------------------------------

// Blend palette color with graph background to produce chip bg
const BG = [0x1c, 0x1e, 0x23];

export function chipBg(hex: string, mix = 0.22): string {
  const c = [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  return (
    "#" +
    c
      .map((v, i) =>
        Math.round(v * mix + BG[i] * (1 - mix))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function groupRefs(
  refs: SlimCommit["r"],
  currentBranch: string,
): GroupedRef[] {
  const groups: GroupedRef[] = [];
  const used = new Set<number>();

  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    if (ref.type !== "branch" && ref.type !== "head_branch") continue;

    const isCurrent = ref.type === "head_branch" || ref.name === currentBranch;
    const remoteIdx = refs.findIndex(
      (r, j) =>
        !used.has(j) && r.type === "remote" && r.name === `origin/${ref.name}`,
    );
    used.add(i);
    if (remoteIdx >= 0) {
      used.add(remoteIdx);
      groups.push({ ref, remote: refs[remoteIdx], isCurrent, isTag: false });
    } else {
      groups.push({ ref, isCurrent, isTag: false });
    }
  }

  for (let i = 0; i < refs.length; i++) {
    if (used.has(i)) continue;
    const ref = refs[i];
    used.add(i);
    groups.push({ ref, isCurrent: false, isTag: ref.type === "tag" });
  }

  return groups;
}
