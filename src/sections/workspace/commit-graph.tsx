import { useRef, useMemo, useCallback } from 'react';

import Box from '@mui/material/Box';

import type { RepoPayload, SlimCommit } from 'src/types/electron';

// ----------------------------------------------------------------------

const ROW_H = 30;
const LANE_W = 22;
const DOT_R = 5.5;
const GRAPH_PAD = 14;

function laneX(l: number) { return GRAPH_PAD + l * LANE_W + LANE_W / 2; }
function rowY(r: number) { return r * ROW_H + ROW_H / 2; }

function esc(t: string) {
  return String(t).replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] ?? m)
  );
}

function relTime(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const u: [number, string, string][] = [
    [31536000, 'ano', 'anos'], [2592000, 'mês', 'meses'], [604800, 'semana', 'semanas'],
    [86400, 'dia', 'dias'], [3600, 'hora', 'horas'], [60, 'minuto', 'minutos'],
  ];
  for (const [sec, sg, pl] of u) {
    const v = Math.floor(s / sec);
    if (v >= 1) return `há ${v} ${v === 1 ? sg : pl}`;
  }
  return 'agora';
}

// ----------------------------------------------------------------------

type CommitGraphProps = {
  payload: RepoPayload;
  selectedIdx: number;
  onSelectRow: (idx: number) => void;
};

export function CommitGraph({ payload, selectedIdx, onSelectRow }: CommitGraphProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const D = payload;
  const PAL = D.palette;
  const hasWip = D.wip && D.wip.total > 0;
  const off = hasWip ? 1 : 0;
  const totalRows = D.commits.length + off;

  const graphW = Math.max(3, D.maxLanes) * LANE_W + GRAPH_PAD * 2;

  const labelsW = useMemo(() => {
    let maxChars = 0;
    for (const c of D.commits)
      for (const r of c.r) maxChars = Math.max(maxChars, Math.min(r.name.length, 26));
    return Math.min(260, Math.max(150, maxChars * 7.2 + 60));
  }, [D.commits]);

  const headIdx = D.commits.findIndex((c) => c.h === D.headHash);
  const headCommit = headIdx >= 0 ? D.commits[headIdx] : null;

  const svgContent = useMemo(() => {
    const parts: string[] = [];
    const CURVE = ROW_H * 0.72;

    // Edges
    for (const e of D.edges) {
      const cR = e.c[0] + off, cL = e.c[1];
      const pR = e.p[0] + off, pL = e.p[1];
      const color = PAL[e.k % PAL.length];
      const x1 = laneX(cL), y1 = rowY(cR);
      const x2 = laneX(pL), y2 = rowY(pR);
      const xr = laneX(e.r);
      let d: string;
      if (pR - cR === 1) {
        d = (cL === pL) ? `M${x1} ${y1} L${x2} ${y2}`
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
      parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`);
    }

    // WIP line
    if (hasWip && headCommit) {
      const hl = headCommit.l;
      const headRow = headIdx + off;
      const blocked = D.commits.some((c, i) => i < headIdx && c.l === hl);
      if (!blocked) {
        const x = laneX(hl);
        const color = PAL[headCommit.k % PAL.length];
        parts.push(`<path d="M${x} ${rowY(0)} L${x} ${rowY(headRow)}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round" opacity=".8"/>`);
        parts.push(`<circle cx="${x}" cy="${rowY(0)}" r="${DOT_R + 1.5}" fill="var(--bg,#1a1f24)" stroke="${color}" stroke-width="1.6" stroke-dasharray="3 3"/>`);
      }
    }

    // Dots
    for (let i = 0; i < D.commits.length; i++) {
      const c = D.commits[i];
      const x = laneX(c.l), y = rowY(i + off);
      const color = PAL[c.k % PAL.length];
      if (c.mg) {
        parts.push(`<circle cx="${x}" cy="${y}" r="${DOT_R - 1}" fill="${color}"/>`);
        parts.push(`<circle cx="${x}" cy="${y}" r="2" fill="var(--bg,#1a1f24)"/>`);
      } else {
        parts.push(`<circle cx="${x}" cy="${y}" r="${DOT_R}" fill="hsl(${c.hu} 45% 55%)" stroke="${color}" stroke-width="2"/>`);
        parts.push(`<text x="${x}" y="${y + 2.6}" text-anchor="middle" font-size="6.5" font-weight="700" fill="#fff" font-family="system-ui">${esc(c.i)}</text>`);
      }
      if (c.h === D.headHash) {
        parts.push(`<circle cx="${x}" cy="${y}" r="${DOT_R + 3.5}" fill="none" stroke="${color}" stroke-width="1.4" opacity=".55"/>`);
      }
    }

    return parts.join('');
  }, [D, PAL, off, hasWip, headCommit, headIdx]);

  const handleRowClick = useCallback((e: React.MouseEvent) => {
    const row = (e.target as HTMLElement).closest('[data-i]');
    if (!row) return;
    onSelectRow(parseInt(row.getAttribute('data-i')!, 10));
  }, [onSelectRow]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Column headers */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `${labelsW}px ${graphW}px 1fr`,
          height: 28,
          alignItems: 'center',
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          fontSize: 10.5,
          letterSpacing: '0.08em',
          color: 'text.secondary',
          textTransform: 'uppercase',
          userSelect: 'none',
          '& > div': { px: '12px', whiteSpace: 'nowrap', overflow: 'hidden' },
          '& > div + div': { borderLeft: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', alignItems: 'center' },
        }}
      >
        <div>Branch / Tag</div>
        <div>Graph</div>
        <div>Commit Message</div>
      </Box>

      {/* Scroll area */}
      <Box ref={scrollRef} sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <Box sx={{ position: 'relative', height: totalRows * ROW_H }} onClick={handleRowClick}>
          {/* SVG graph */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={graphW}
            height={totalRows * ROW_H}
            style={{ position: 'absolute', top: 0, left: labelsW, pointerEvents: 'none' }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />

          {/* WIP row */}
          {hasWip && (
            <Row
              style={{ top: 0 }}
              gridCols={`${labelsW}px ${graphW}px 1fr`}
              sx={{ color: 'text.secondary', fontStyle: 'italic' }}
            >
              <div />
              <div />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: '14px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <Box component="span" sx={{ border: '1px dashed', borderColor: 'text.secondary', borderRadius: '4px', px: 1, py: '1.5px', fontSize: 11.5, color: 'text.secondary', display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                  // WIP <b style={{ color: '#e5c122' }}>✎ {D.wip.total}</b>
                </Box>
                <span style={{ fontSize: 11.5 }}>alterações não commitadas em {D.currentBranch}</span>
              </Box>
            </Row>
          )}

          {/* Commit rows */}
          {D.commits.map((c, i) => {
            const color = PAL[c.k % PAL.length];
            return (
              <Row
                key={c.h}
                data-i={i}
                style={{ top: (i + off) * ROW_H, '--chip-color': color } as React.CSSProperties}
                gridCols={`${labelsW}px ${graphW}px 1fr`}
                selected={selectedIdx === i}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', px: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {c.r.map((ref, ri) => (
                    <RefChip key={ri} ref_={ref} currentBranch={D.currentBranch} />
                  ))}
                </Box>
                <div />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', px: '14px 14px 14px 10px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <Box
                    component="span"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      ...(c.mg && { color: 'text.secondary' }),
                    }}
                    title={c.m}
                  >
                    {c.m}
                  </Box>
                  <Box
                    component="span"
                    className="when"
                    sx={{
                      ml: 'auto',
                      color: 'text.secondary',
                      fontSize: 11,
                      flexShrink: 0,
                      opacity: 0,
                      transition: 'opacity .12s',
                    }}
                  >
                    {c.a.split(' ')[0]} · {relTime(c.d)}
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

// ----------------------------------------------------------------------

function Row({ children, gridCols, selected, sx, ...props }: any) {
  return (
    <Box
      {...props}
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: ROW_H,
        display: 'grid',
        gridTemplateColumns: gridCols,
        alignItems: 'center',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.045)' },
        '&:hover .when': { opacity: 1 },
        ...(selected && {
          bgcolor: 'rgba(79,143,247,0.14)',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            bgcolor: 'primary.main',
          },
          '& .when': { opacity: 1 },
        }),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

// ----------------------------------------------------------------------

const ICON = {
  computer: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="3" width="13" height="8.5" rx="1"/><path d="M5 14h6"/></svg>',
  cloud: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.5 12.5a3 3 0 0 1-.3-6A4 4 0 0 1 12 7.6a2.6 2.6 0 0 1-.6 4.9z"/></svg>',
  tag: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2h5l7 7-5 5-7-7z"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none"/></svg>',
  check: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 8.5 6.5 12 13 4.5"/></svg>',
};

function RefChip({ ref_, currentBranch }: { ref_: SlimCommit['r'][number]; currentBranch: string }) {
  let icon = ICON.computer;
  let isCurrent = false;
  let isTag = false;

  if (ref_.type === 'remote') icon = ICON.cloud;
  if (ref_.type === 'tag') { icon = ICON.tag; isTag = true; }
  if (ref_.type === 'head_branch' || (ref_.type === 'branch' && ref_.name === currentBranch)) {
    icon = ICON.check;
    isCurrent = true;
  }

  return (
    <Box
      component="span"
      title={ref_.name}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        maxWidth: '100%',
        bgcolor: isCurrent ? 'rgba(var(--chip-color), 0.22)' : 'action.hover',
        border: '1px solid',
        borderColor: isTag ? 'text.secondary' : 'var(--chip-color, divider)',
        borderLeftWidth: isTag ? 1 : 3,
        borderRadius: '4px',
        px: '7px',
        py: '1.5px',
        fontSize: 11.5,
        fontWeight: 600,
        color: isTag ? 'text.secondary' : 'text.primary',
        overflow: 'hidden',
      }}
    >
      <span dangerouslySetInnerHTML={{ __html: icon }} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {ref_.name}
      </Box>
    </Box>
  );
}
