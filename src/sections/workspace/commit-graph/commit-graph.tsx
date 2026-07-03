import { useRef, useMemo, useCallback } from "react";

import Box from "@mui/material/Box";

import type { RepoPayload } from "src/types/electron";

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
}: CommitGraphProps) {
  const PAL = payload.palette;
  const hasWip = payload.wip && payload.wip.total > 0;
  const off = (hasWip ? 1 : 0) + SPACER;
  const totalRows = payload.commits.length + off;
  const graphW = Math.max(3, payload.maxLanes) * LANE_W + GRAPH_PAD * 2;

  const scrollRef = useRef<HTMLDivElement>(null);

  const labelsW = useMemo(() => {
    let maxChars = 0;
    for (const c of payload.commits)
      for (const r of c.r)
        maxChars = Math.max(maxChars, Math.min(r.name.length, 26));
    return Math.min(260, Math.max(150, maxChars * 7.2 + 60));
  }, [payload.commits]);

  const { headIdx, headCommit } = useMemo(() => {
    const idx = payload.commits.findIndex((c) => c.h === payload.headHash);
    return { headIdx: idx, headCommit: idx >= 0 ? payload.commits[idx] : null };
  }, [payload.commits, payload.headHash]);

  const svgContent = useMemo(() => {
    const connectors: string[] = [];
    const graph: string[] = [];
    const CURVE = ROW_H * 0.72;

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
        d =
          cL === pL
            ? `M${x1} ${y1} L${x2} ${y2}`
            : `M${x1} ${y1} C${x1} ${y1 + CURVE} ${x2} ${y2 - CURVE} ${x2} ${y2}`;
      } else {
        d = `M${x1} ${y1}`;
        let curY = y1;
        if (e.r !== cL) {
          const ny = rowY(cR + 1);
          d += ` C${x1} ${y1 + CURVE} ${xr} ${ny - CURVE} ${xr} ${ny}`;
          curY = ny;
        }
        if (e.r !== pL) {
          const by = rowY(pR - 1);
          if (by > curY) d += ` L${xr} ${by}`;
          d += ` C${xr} ${by + CURVE} ${x2} ${y2 - CURVE} ${x2} ${y2}`;
        } else {
          d += ` L${x2} ${y2}`;
        }
      }
      graph.push(
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`,
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
          `<circle cx="${x}" cy="${rowY(0)}" r="7" fill="var(--bg,#1a1f24)" stroke="${color}" stroke-width="1.6" stroke-dasharray="3 3"/>`,
        );
      }
    }

    for (let i = 0; i < payload.commits.length; i++) {
      const c = payload.commits[i];
      const x = laneX(c.l),
        y = rowY(i + off);
      const color = PAL[c.k % PAL.length];
      const r = 9;

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
          `<circle cx="${x}" cy="${y}" r="${r - 2}" fill="${color}"/>`,
        );
        graph.push(
          `<circle cx="${x}" cy="${y}" r="2.5" fill="var(--bg,#1a1f24)"/>`,
        );
      } else {
        graph.push(
          `<circle cx="${x}" cy="${y}" r="${r}" fill="hsl(${c.hu} 45% 55%)" stroke="${color}" stroke-width="2"/>`,
        );
        graph.push(
          `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="${r * 0.72}" font-weight="700" fill="#fff" font-family="Open Sans, Arial, sans-serif">${esc(c.i)}</text>`,
        );
      }
      if (c.h === payload.headHash) {
        graph.push(
          `<circle cx="${x}" cy="${y}" r="${r + 3}" fill="none" stroke="${color}" stroke-width="1.4" opacity=".55"/>`,
        );
      }
    }

    return [
      ...connectors,
      `<g transform="translate(${labelsW},0)">${graph.join("")}</g>`,
    ].join("");
  }, [payload, PAL, off, hasWip, headCommit, headIdx, labelsW]);

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
        } as React.CSSProperties & Record<string, unknown>
      }
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `${labelsW}px ${graphW}px 1fr`,
          height: 28,
          alignItems: "center",
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
          fontSize: 10.5,
          letterSpacing: "0.08em",
          color: "text.secondary",
          textTransform: "uppercase",
          userSelect: "none",
          "& > div": { px: "12px", whiteSpace: "nowrap", overflow: "hidden" },
          "& > div + div": {
            borderLeft: "1px solid",
            borderColor: "divider",
            height: "100%",
            display: "flex",
            alignItems: "center",
          },
        }}
      >
        <div>Branch / Tag</div>
        <div>Graph</div>
        <div>Commit Message</div>
      </Box>

      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflow: "auto",
          position: "relative",
          bgcolor: "#1c1e23",
        }}
      >
        <Box
          sx={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
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

          <Box sx={{ flexShrink: 0, height: ROW_H }} />

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

            return (
              <Row
                key={c.h}
                data-i={i}
                style={{ "--chip-color": color } as React.CSSProperties}
                gridCols={`${labelsW}px ${graphW}px 1fr`}
              >
                <RefLabels groups={grouped} laneColor={color} />
                <div />
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    px: "14px 14px 14px 10px",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "#b1b3ba",
                      fontSize: 12.5,
                      fontWeight: 500,
                      fontFamily: FONT,
                      ...(c.mg && { opacity: 0.65 }),
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
                      transition: "opacity .12s",
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
    </Box>
  );
}
