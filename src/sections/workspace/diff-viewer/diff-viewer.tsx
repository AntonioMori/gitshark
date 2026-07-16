import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import type { ReactNode } from 'react';

import { parseDiff } from './parse-diff';
import type { DiffData, DiffLine, InlineSegment } from './parse-diff';
import { highlightLine, computeEndDepth } from './syntax-highlight';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT = '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace';
const HEADER_FONT = '"Open Sans Variable", "Open Sans", sans-serif';
const LINE_HEIGHT = 20;
const OVERSCAN = 20;
const MINIMAP_W = 40;

const BG = '#1c1e23';
const BG_HEADER = '#272a31';
const BG_TOOLBAR = '#21232b';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#ffffff';
const MUTED = '#808080';

const ADDED_BG = '#304f35';
const ADDED_GUTTER = '#304f35';
const MODIFIED_NEW_BG = '#26352c';
const MODIFIED_OLD_BG = '#382427';
const MODIFIED_NEW_HL = '#304f35';
const MODIFIED_OLD_HL = '#582a2b';
const REMOVED_BG = '#382427';
const REMOVED_GUTTER = '#382427';
const ADDED_PREFIX_COLOR = '#34d399';
const REMOVED_PREFIX_COLOR = '#f87171';

const MINIMAP_TRACK_BG = '#1a1d24';
const MINIMAP_DELETION = '#7f1d1d';
const MINIMAP_ADDITION = '#14532d';
const MINIMAP_THUMB_BG = 'rgba(255,255,255,0.1)';
const MINIMAP_THUMB_BORDER = 'rgba(255,255,255,0.05)';

const BTN: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  outline: 'none',
  borderRadius: 3,
  padding: 4,
  color: MUTED,
  lineHeight: 1,
};

// ---------------------------------------------------------------------------
// Injected CSS — eliminates inline style objects from the hot path
// ---------------------------------------------------------------------------

const INJECTED_CSS = `
.dv-btn:hover{background:rgba(255,255,255,0.07)!important;color:${TEXT}!important}
.dl-r{height:${LINE_HEIGHT}px;display:flex;font-family:${FONT};font-size:12px;line-height:${LINE_HEIGHT}px;white-space:pre}
.dl-r-a{background:${ADDED_BG}}.dl-r-rm{background:${REMOVED_BG}}
.dl-r-mo{background:${MODIFIED_OLD_BG}}.dl-r-mn{background:${MODIFIED_NEW_BG}}
.dl-r-nl{background:rgba(56,36,39,0.3)}.dl-r-nr{background:rgba(48,79,53,0.3)}
.dl-g{width:44px;flex-shrink:0;text-align:right;padding-right:6px;color:rgba(255,255,255,0.3);user-select:none;font-size:11px}
.dl-g-a{background:${ADDED_GUTTER}}.dl-g-rm{background:${REMOVED_GUTTER}}
.dl-g-mo{background:${MODIFIED_OLD_BG}}.dl-g-mn{background:${MODIFIED_NEW_BG}}
.dl-p{width:14px;flex-shrink:0;text-align:center;user-select:none;font-weight:700}
.dl-pa{color:${ADDED_PREFIX_COLOR}}.dl-pr{color:${REMOVED_PREFIX_COLOR}}.dl-pc{color:transparent}
.dl-c{flex:1;padding-right:8px;overflow:hidden}
.dl-eg{width:52px;flex-shrink:0}.dl-ef{flex:1}
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiffContext = 'staged' | 'unstaged' | 'commit';

type Props = {
  repoPath: string;
  filePath: string;
  context: DiffContext;
  commitHash?: string;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Minimap block builder
// ---------------------------------------------------------------------------

interface MinimapBlock {
  startIdx: number;
  count: number;
  type: 'added' | 'removed';
}

function buildMinimapBlocks(data: DiffData): MinimapBlock[] {
  const blocks: MinimapBlock[] = [];
  let i = 0;
  while (i < data.rows.length) {
    const row = data.rows[i];
    let type: 'added' | 'removed' | null = null;
    if (row.left?.type === 'removed' || row.left?.type === 'modified') type = 'removed';
    else if (row.right?.type === 'added' || row.right?.type === 'modified') type = 'added';
    if (!type) { i++; continue; }
    const startIdx = i;
    while (i < data.rows.length) {
      const r = data.rows[i];
      let rType: 'added' | 'removed' | null = null;
      if (r.left?.type === 'removed' || r.left?.type === 'modified') rType = 'removed';
      else if (r.right?.type === 'added' || r.right?.type === 'modified') rType = 'added';
      if (rType !== type) break;
      i++;
    }
    blocks.push({ startIdx, count: i - startIdx, type });
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Change block starts — groups of non-context rows for navigation
// ---------------------------------------------------------------------------

function buildChangeStarts(data: DiffData): number[] {
  const starts: number[] = [];
  let inChange = false;
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    const isChange =
      (row.left !== null && row.left.type !== 'context') ||
      (row.right !== null && row.right.type !== 'context');
    if (isChange && !inChange) {
      starts.push(i);
      inChange = true;
    } else if (!isChange) {
      inChange = false;
    }
  }
  return starts;
}

// ---------------------------------------------------------------------------
// Bracket depth map — pre-computes starting depth for each row
// ---------------------------------------------------------------------------

function buildBracketDepths(data: DiffData): { left: number[]; right: number[] } {
  const left: number[] = [];
  const right: number[] = [];
  let ld = 0;
  let rd = 0;

  const estimateDepth = (text: string): number => {
    const match = text.match(/^([ \t]*)/);
    if (!match) return 0;
    const whitespace = match[1];
    let spaces = 0;
    for (const char of whitespace) {
      if (char === '\t') spaces += 4;
      else spaces += 1;
    }
    return Math.floor(spaces / 2); // assume 2 spaces per indent level
  };

  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    if (data.hunkStarts.includes(i)) {
      if (row.left) ld = estimateDepth(row.left.text);
      else if (row.right) ld = estimateDepth(row.right.text);

      if (row.right) rd = estimateDepth(row.right.text);
      else if (row.left) rd = estimateDepth(row.left.text);
    }
    left.push(ld);
    right.push(rd);
    if (row.left) ld = computeEndDepth(row.left.text, ld);
    if (row.right) rd = computeEndDepth(row.right.text, rd);
  }
  return { left, right };
}

// ---------------------------------------------------------------------------
// Virtualized panel (memoized)
// ---------------------------------------------------------------------------

const VirtualPanel = memo(function VirtualPanel({
  rows,
  side,
  scrollTop,
  viewportHeight,
  totalRows,
  depths,
  onRef,
  onScroll,
  hideScrollbar,
}: {
  rows: DiffData['rows'];
  side: 'left' | 'right';
  scrollTop: number;
  viewportHeight: number;
  totalRows: number;
  depths: number[];
  onRef: (el: HTMLDivElement | null) => void;
  onScroll: () => void;
  hideScrollbar?: boolean;
}) {
  const totalHeight = totalRows * LINE_HEIGHT;
  const startRow = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / LINE_HEIGHT) + OVERSCAN * 2;
  const endRow = Math.min(totalRows, startRow + visibleCount);

  return (
    <div
      ref={onRef}
      onScroll={onScroll}
      style={{
        width: '50%',
        overflowY: 'auto',
        overflowX: 'auto',
        ...(side === 'left' ? { borderRight: `1px solid ${BORDER}` } : { paddingRight: MINIMAP_W }),
        scrollbarWidth: hideScrollbar ? 'none' : 'thin',
        scrollbarColor: hideScrollbar ? undefined : '#3a3d45 transparent',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative', minWidth: 'max-content' }}>
        <div style={{ position: 'absolute', top: startRow * LINE_HEIGHT, left: 0, right: 0 }}>
          {Array.from({ length: endRow - startRow }, (_, i) => {
            const idx = startRow + i;
            const row = rows[idx];
            const line = side === 'left' ? row.left : row.right;
            return <DiffLineRow key={idx} line={line} side={side} startDepth={depths[idx]} />;
          })}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiffViewer({ repoPath, filePath, context, commitHash, onClose }: Props) {
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);
  const hasScrolledToFirst = useRef(false);
  const rafRef = useRef(0);

  // --- Fetch diff ---

  useEffect(() => {
    setLoading(true);
    setError(null);
    hasScrolledToFirst.current = false;
    window.api.gitDiffFile(repoPath, filePath, context, commitHash).then((result) => {
      if (result.error) {
        setError(result.error);
        setDiffData(null);
      } else {
        setDiffData(parseDiff(result.diff));
      }
      setLoading(false);
    });
  }, [repoPath, filePath, context, commitHash]);

  // --- Measure viewport ---

  useEffect(() => {
    if (!leftRef.current) return undefined;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
      }
    });
    ro.observe(leftRef.current);
    return () => ro.disconnect();
  }, [loading, diffData]);

  // --- Auto-scroll to first change ---

  useEffect(() => {
    if (!diffData || hasScrolledToFirst.current) return;
    hasScrolledToFirst.current = true;
    const firstChangeIdx = diffData.rows.findIndex(
      (r) => (r.left && r.left.type !== 'context') || (r.right && r.right.type !== 'context')
    );
    if (firstChangeIdx <= 0) return;
    const targetRow = Math.max(0, firstChangeIdx - 3);
    const top = targetRow * LINE_HEIGHT;
    requestAnimationFrame(() => {
      leftRef.current?.scrollTo({ top, behavior: 'auto' });
      rightRef.current?.scrollTo({ top, behavior: 'auto' });
    });
  }, [diffData]);

  // --- Scroll sync + rAF throttle + direct DOM thumb ---

  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    const from = source === 'left' ? leftRef.current : rightRef.current;
    const to = source === 'left' ? rightRef.current : leftRef.current;
    if (from && to) {
      to.scrollTop = from.scrollTop;
    }
    if (from) {
      const { scrollTop: st, scrollHeight, clientHeight } = from;
      // Thumb: immediate DOM update
      if (thumbRef.current) {
        const maxScroll = scrollHeight - clientHeight;
        const ratio = maxScroll > 0 ? st / maxScroll : 0;
        const tRatio = scrollHeight > 0 ? clientHeight / scrollHeight : 1;
        thumbRef.current.style.top = `${ratio * (1 - tRatio) * 100}%`;
        thumbRef.current.style.height = `${Math.max(tRatio * 100, 5)}%`;
      }
      // Virtualization: coalesce to 1 state update per frame
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setScrollTop(st);
      });
    }
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, []);

  // --- Change blocks ---

  const changeStarts = useMemo(() => {
    if (!diffData) return [];
    return buildChangeStarts(diffData);
  }, [diffData]);

  const currentChangeIdx = useMemo(() => {
    if (changeStarts.length === 0) return 0;
    const currentRow = Math.floor(scrollTop / LINE_HEIGHT);
    let idx = 0;
    for (let i = 0; i < changeStarts.length; i++) {
      if (changeStarts[i] <= currentRow + 5) idx = i;
      else break;
    }
    return idx;
  }, [changeStarts, scrollTop]);

  const goToChange = useCallback((dir: 1 | -1) => {
    if (changeStarts.length === 0) return;
    const next = Math.max(0, Math.min(changeStarts.length - 1, currentChangeIdx + dir));
    const top = Math.max(0, changeStarts[next] - 3) * LINE_HEIGHT;
    leftRef.current?.scrollTo({ top, behavior: 'smooth' });
    rightRef.current?.scrollTo({ top, behavior: 'smooth' });
  }, [changeStarts, currentChangeIdx]);

  // --- Bracket depths ---

  const bracketDepths = useMemo(() => {
    if (!diffData) return { left: [] as number[], right: [] as number[] };
    return buildBracketDepths(diffData);
  }, [diffData]);

  // --- Minimap ---

  const minimapBlocks = useMemo(() => {
    if (!diffData) return [];
    return buildMinimapBlocks(diffData);
  }, [diffData]);

  const handleMinimapMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!diffData || !leftRef.current) return;
    const container = e.currentTarget;

    const handleDrag = (clientY: number) => {
      if (!leftRef.current) return;
      const rect = container.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const { scrollHeight, clientHeight } = leftRef.current;
      const top = pct * (scrollHeight - clientHeight);
      leftRef.current.scrollTo({ top, behavior: 'auto' });
      rightRef.current?.scrollTo({ top, behavior: 'auto' });
    };

    handleDrag(e.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      handleDrag(moveEvent.clientY);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [diffData]);

  // Stable callbacks for VirtualPanel memo
  const handleLeftRef = useCallback((el: HTMLDivElement | null) => { leftRef.current = el; }, []);
  const handleRightRef = useCallback((el: HTMLDivElement | null) => { rightRef.current = el; }, []);
  const handleLeftScroll = useCallback(() => handleScroll('left'), [handleScroll]);
  const handleRightScroll = useCallback(() => handleScroll('right'), [handleScroll]);

  // File path display
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const fileName = parts.pop() || '';
  const dirPath = parts.length > 0 ? `${parts.join('/')}/` : '';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: BG,
      overflow: 'hidden',
      fontFamily: HEADER_FONT,
    }}>
      <style>{INJECTED_CSS}</style>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        minHeight: 36,
        flexShrink: 0,
        background: BG_HEADER,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: MUTED }}>{dirPath}</span>
          <span style={{ color: TEXT, fontWeight: 500 }}>{fileName}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: MUTED }}>UTF-8</span>
          <button className="dv-btn" onClick={onClose} title="Fechar" style={{ ...BTN, fontSize: 16, fontWeight: 700 }}>
            ×
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        minHeight: 34,
        flexShrink: 0,
        background: BG_TOOLBAR,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <span style={{
          fontSize: 12, color: '#5b9bd5', border: '1px solid #5b9bd5',
          borderRadius: 3, padding: '3px 8px', fontWeight: 500, fontFamily: HEADER_FONT,
        }}>
          {context === 'commit' ? `Commit ${commitHash?.slice(0, 7) || ''}` : context === 'staged' ? 'Staged' : 'Working Directory'}
        </span>

        <span style={{
          fontSize: 12, fontWeight: 600, color: TEXT, background: 'rgba(255,255,255,0.08)',
          borderRadius: 3, padding: '3px 8px', borderBottom: '2px solid #d4a843',
        }}>
          Diff View
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {changeStarts.length > 0 && (
            <span style={{ fontSize: 11, color: MUTED, marginRight: 4 }}>
              {currentChangeIdx + 1}/{changeStarts.length}
            </span>
          )}
          <button className="dv-btn" onClick={() => goToChange(-1)} title="Previous change" style={{ ...BTN, fontSize: 14 }}>
            ▲
          </button>
          <button className="dv-btn" onClick={() => goToChange(1)} title="Next change" style={{ ...BTN, fontSize: 14 }}>
            ▼
          </button>
        </div>
      </div>

      {/* ── Diff Content ── */}
      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: MUTED }}>Carregando diff...</span>
        </div>
      )}

      {error && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: '#f87171' }}>{error}</span>
        </div>
      )}

      {!loading && !error && diffData && diffData.rows.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: MUTED }}>Nenhuma alteração encontrada.</span>
        </div>
      )}

      {!loading && !error && diffData && diffData.rows.length > 0 && (
        <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
          <VirtualPanel
            rows={diffData.rows}
            side="left"
            scrollTop={scrollTop}
            viewportHeight={viewportHeight}
            totalRows={diffData.rows.length}
            depths={bracketDepths.left}
            onRef={handleLeftRef}
            onScroll={handleLeftScroll}
          />
          <VirtualPanel
            rows={diffData.rows}
            side="right"
            scrollTop={scrollTop}
            viewportHeight={viewportHeight}
            totalRows={diffData.rows.length}
            depths={bracketDepths.right}
            onRef={handleRightRef}
            onScroll={handleRightScroll}
            hideScrollbar
          />

          {/* ── Minimap ── */}
          <div
            onMouseDown={handleMinimapMouseDown}
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0,
              width: MINIMAP_W, background: MINIMAP_TRACK_BG,
              borderLeft: `1px solid ${BORDER}`, cursor: 'pointer',
            }}
          >
            {minimapBlocks.map((block, bIdx) => {
              const topPct = (block.startIdx / diffData.rows.length) * 100;
              const heightPct = Math.max(0.3, (block.count / diffData.rows.length) * 100);
              const isDel = block.type === 'removed';
              return (
                <div
                  key={bIdx}
                  style={{
                    position: 'absolute', top: `${topPct}%`, height: `${heightPct}%`, minHeight: 2,
                    ...(isDel
                      ? { left: 0, width: '50%', background: MINIMAP_DELETION }
                      : { right: 0, width: '50%', background: MINIMAP_ADDITION }),
                  }}
                />
              );
            })}
            <div
              ref={thumbRef}
              style={{
                position: 'absolute', left: 0, right: 0, top: '0%', height: '100%',
                background: MINIMAP_THUMB_BG, border: `1px solid ${MINIMAP_THUMB_BORDER}`,
                borderRadius: 2, pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline highlight renderer (tracks bracket depth across slices)
// ---------------------------------------------------------------------------

function renderWithHighlights(text: string, highlights: InlineSegment[], hlColor: string, startDepth: number = 0): ReactNode[] {
  if (highlights.length === 0) return highlightLine(text, startDepth);

  const parts: ReactNode[] = [];
  let cursor = 0;
  let depth = startDepth;

  for (let i = 0; i < highlights.length; i++) {
    const { start, end } = highlights[i];
    if (cursor < start) {
      const slice = text.slice(cursor, start);
      parts.push(<span key={`n${i}`}>{highlightLine(slice, depth)}</span>);
      depth = computeEndDepth(slice, depth);
    }
    const hlSlice = text.slice(start, end);
    parts.push(
      <span key={`h${i}`} style={{ backgroundColor: hlColor, borderRadius: 2 }}>
        {highlightLine(hlSlice, depth)}
      </span>
    );
    depth = computeEndDepth(hlSlice, depth);
    cursor = end;
  }
  if (cursor < text.length) {
    parts.push(<span key="tail">{highlightLine(text.slice(cursor), depth)}</span>);
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Line Row (memoized) — uses CSS classes, zero inline style objects
// ---------------------------------------------------------------------------

const DiffLineRow = memo(function DiffLineRow({ line, side, startDepth }: { line: DiffLine | null; side: 'left' | 'right'; startDepth: number }) {
  if (!line) {
    return (
      <div className={`dl-r ${side === 'left' ? 'dl-r-nl' : 'dl-r-nr'}`}>
        <div className="dl-eg" />
        <div className="dl-ef" />
      </div>
    );
  }

  const { type, text, highlights } = line;
  const isModified = type === 'modified';
  const isLeft = side === 'left';

  let rowCls: string;
  let gutterCls: string;
  let prefixCls: string;
  let prefix: string;

  if (type === 'added') {
    rowCls = 'dl-r dl-r-a'; gutterCls = 'dl-g dl-g-a'; prefixCls = 'dl-p dl-pa'; prefix = '+';
  } else if (type === 'removed') {
    rowCls = 'dl-r dl-r-rm'; gutterCls = 'dl-g dl-g-rm'; prefixCls = 'dl-p dl-pr'; prefix = '-';
  } else if (isModified && isLeft) {
    rowCls = 'dl-r dl-r-mo'; gutterCls = 'dl-g dl-g-mo'; prefixCls = 'dl-p dl-pr'; prefix = '-';
  } else if (isModified) {
    rowCls = 'dl-r dl-r-mn'; gutterCls = 'dl-g dl-g-mn'; prefixCls = 'dl-p dl-pa'; prefix = '+';
  } else {
    rowCls = 'dl-r'; gutterCls = 'dl-g'; prefixCls = 'dl-p dl-pc'; prefix = ' ';
  }

  let content: ReactNode;
  if (isModified && highlights && highlights.length > 0) {
    content = renderWithHighlights(text, highlights, isLeft ? MODIFIED_OLD_HL : MODIFIED_NEW_HL, startDepth);
  } else {
    content = highlightLine(text, startDepth);
  }

  return (
    <div className={rowCls}>
      <div className={gutterCls}>{line.lineNo}</div>
      <div className={prefixCls}>{prefix}</div>
      <div className="dl-c">{content}</div>
    </div>
  );
});
