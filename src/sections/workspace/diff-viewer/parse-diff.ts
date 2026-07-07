// ---------------------------------------------------------------------------
// Unified diff parser → structured side-by-side data
// ---------------------------------------------------------------------------

export type LineType = 'added' | 'removed' | 'context' | 'modified';

export interface InlineSegment {
  start: number;
  end: number;
}

export interface DiffLine {
  type: LineType;
  lineNo: number | null;
  text: string;
  /** Character ranges that were actually changed (only for `modified` lines) */
  highlights?: InlineSegment[];
}

export interface SideBySideRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

export interface DiffData {
  rows: SideBySideRow[];
  hunkStarts: number[];
  totalLeft: number;
  totalRight: number;
}

interface RawHunk {
  leftStart: number;
  leftCount: number;
  rightStart: number;
  rightCount: number;
  lines: string[];
}

// ---------------------------------------------------------------------------

function parseHunkHeader(line: string): { leftStart: number; leftCount: number; rightStart: number; rightCount: number } | null {
  const m = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
  if (!m) return null;
  return {
    leftStart: parseInt(m[1], 10),
    leftCount: m[2] !== undefined ? parseInt(m[2], 10) : 1,
    rightStart: parseInt(m[3], 10),
    rightCount: m[4] !== undefined ? parseInt(m[4], 10) : 1,
  };
}

function extractHunks(diffText: string): RawHunk[] {
  const lines = diffText.split('\n');
  const hunks: RawHunk[] = [];
  let current: RawHunk | null = null;

  for (const line of lines) {
    const header = parseHunkHeader(line);
    if (header) {
      current = { ...header, lines: [] };
      hunks.push(current);
      continue;
    }
    if (current) {
      if (line.startsWith('diff --git')) break;
      current.lines.push(line);
    }
  }
  return hunks;
}

// ---------------------------------------------------------------------------
// Word-level inline diff between two strings
// ---------------------------------------------------------------------------

function computeInlineHighlights(oldStr: string, newStr: string): { oldHL: InlineSegment[]; newHL: InlineSegment[] } {
  // Split into word-like tokens preserving positions
  const tokenize = (s: string) => {
    const tokens: { start: number; end: number; text: string }[] = [];
    const re = /\S+|\s+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      tokens.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
    return tokens;
  };

  const oldTokens = tokenize(oldStr);
  const newTokens = tokenize(newStr);

  // Simple LCS on tokens to find matching regions
  const n = oldTokens.length;
  const m = newTokens.length;

  // For very long lines, fall back to highlighting the whole line
  if (n > 200 || m > 200) {
    return {
      oldHL: oldStr.length > 0 ? [{ start: 0, end: oldStr.length }] : [],
      newHL: newStr.length > 0 ? [{ start: 0, end: newStr.length }] : [],
    };
  }

  // Build LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldTokens[i - 1].text === newTokens[j - 1].text) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find matched token indices
  const oldMatched = new Set<number>();
  const newMatched = new Set<number>();
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (oldTokens[i - 1].text === newTokens[j - 1].text) {
      oldMatched.add(i - 1);
      newMatched.add(j - 1);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  // Unmatched tokens = highlights
  const oldHL: InlineSegment[] = [];
  for (let k = 0; k < n; k++) {
    if (!oldMatched.has(k)) {
      const t = oldTokens[k];
      // Merge adjacent
      if (oldHL.length > 0 && oldHL[oldHL.length - 1].end >= t.start) {
        oldHL[oldHL.length - 1].end = t.end;
      } else {
        oldHL.push({ start: t.start, end: t.end });
      }
    }
  }

  const newHL: InlineSegment[] = [];
  for (let k = 0; k < m; k++) {
    if (!newMatched.has(k)) {
      const t = newTokens[k];
      if (newHL.length > 0 && newHL[newHL.length - 1].end >= t.start) {
        newHL[newHL.length - 1].end = t.end;
      } else {
        newHL.push({ start: t.start, end: t.end });
      }
    }
  }

  return { oldHL, newHL };
}

// ---------------------------------------------------------------------------
// Build side-by-side rows from hunks (no collapsed sections)
// ---------------------------------------------------------------------------

export function parseDiff(diffText: string): DiffData {
  if (!diffText.trim()) {
    return { rows: [], hunkStarts: [], totalLeft: 0, totalRight: 0 };
  }

  const hunks = extractHunks(diffText);
  const rows: SideBySideRow[] = [];
  const hunkStarts: number[] = [];
  let maxLeft = 0;
  let maxRight = 0;

  for (const hunk of hunks) {
    hunkStarts.push(rows.length);

    let leftNo = hunk.leftStart;
    let rightNo = hunk.rightStart;

    let i = 0;
    while (i < hunk.lines.length) {
      const line = hunk.lines[i];

      if (line.startsWith('-')) {
        // Collect consecutive removals
        const removals: string[] = [];
        while (i < hunk.lines.length && hunk.lines[i].startsWith('-')) {
          removals.push(hunk.lines[i].slice(1));
          i++;
        }
        // Collect consecutive additions right after
        const additions: string[] = [];
        while (i < hunk.lines.length && hunk.lines[i].startsWith('+')) {
          additions.push(hunk.lines[i].slice(1));
          i++;
        }

        const maxLen = Math.max(removals.length, additions.length);
        for (let j = 0; j < maxLen; j++) {
          const hasOld = j < removals.length;
          const hasNew = j < additions.length;

          if (hasOld && hasNew) {
            // Modified line — compute inline diff
            const { oldHL, newHL } = computeInlineHighlights(removals[j], additions[j]);
            rows.push({
              left: { type: 'modified', lineNo: leftNo++, text: removals[j], highlights: oldHL },
              right: { type: 'modified', lineNo: rightNo++, text: additions[j], highlights: newHL },
            });
          } else {
            rows.push({
              left: hasOld
                ? { type: 'removed', lineNo: leftNo++, text: removals[j] }
                : null,
              right: hasNew
                ? { type: 'added', lineNo: rightNo++, text: additions[j] }
                : null,
            });
          }
        }
      } else if (line.startsWith('+')) {
        rows.push({
          left: null,
          right: { type: 'added', lineNo: rightNo++, text: line.slice(1) },
        });
        i++;
      } else if (line.startsWith('\\')) {
        i++;
      } else {
        const text = line.startsWith(' ') ? line.slice(1) : line;
        rows.push({
          left: { type: 'context', lineNo: leftNo++, text },
          right: { type: 'context', lineNo: rightNo++, text },
        });
        i++;
      }
    }

    if (leftNo > hunk.leftStart) maxLeft = Math.max(maxLeft, leftNo - 1);
    if (rightNo > hunk.rightStart) maxRight = Math.max(maxRight, rightNo - 1);
  }

  return { rows, hunkStarts, totalLeft: maxLeft, totalRight: maxRight };
}
