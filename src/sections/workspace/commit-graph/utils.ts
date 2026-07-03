import type { SlimCommit } from "src/types/electron";

import type { GroupedRef } from "./commit-graph-types";

// ----------------------------------------------------------------------

export const LANE_W = 22;
export const GRAPH_PAD = 14;
export const SPACER = 1;
export const FONT = "'Segoe UI', sans-serif";

export const ROW_H = window.screen.width > 1536 ? 22 : 27;
export const ROW_STRIDE = ROW_H + 6;

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

const MAIN_BRANCHES = new Set(["main", "master", "develop", "dev"]);

export function chipColor(group: GroupedRef): string {
  const { ref, isCurrent, isTag } = group;
  if (isTag) return "#39174b";
  if (isCurrent) return "#195f71";
  const baseName = ref.name.replace(/^origin\//, "");
  if (MAIN_BRANCHES.has(baseName)) return "#39174b";
  return "#1a3f4a";
}

export function chipColorDark(group: GroupedRef): string {
  const { ref, isCurrent, isTag } = group;
  if (isTag) return "#2a1038";
  if (isCurrent) return "#113d4d";
  const baseName = ref.name.replace(/^origin\//, "");
  if (MAIN_BRANCHES.has(baseName)) return "#2a1038";
  return "#122a32";
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
