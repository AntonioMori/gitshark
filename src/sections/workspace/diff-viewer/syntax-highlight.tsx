import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// VS Code Dark+ theme syntax highlighter (regex-based, no external deps)
// ---------------------------------------------------------------------------

const COLORS = {
  keyword: '#569cd6',     // async, const, return, if, try, catch
  function: '#dcdcaa',    // function calls and method names
  variable: '#ffffff',    // variables, parameters, property access
  string: '#ce9178',      // 'text', "text", `text`
  type: '#4ec9b0',        // string, number, boolean, void (type annotations)
  comment: '#6a9955',     // // comments, /* block */
  number: '#b5cea8',      // 123, 0xFF, 3.14
  operator: '#d4d4d4',    // =>, &&, ||
  tag: '#569cd6',         // JSX/HTML tags
  punctuation: '#d4d4d4', // , ; . : and gaps between tokens
  default: '#d4d4d4',     // plain text
} as const;

const BRACKET_COLORS = ['#ffd706', '#a364d6', '#569cd6'];

// Order matters — first match wins
const TOKEN_RULES: [RegExp, keyof typeof COLORS][] = [
  // Block comments (single line portion)
  [/\/\*.*?\*\//g, 'comment'],
  // Line comments
  [/\/\/.*/g, 'comment'],
  // Hash comments (Python, YAML, shell)
  [/(?:^|\s)#.*/g, 'comment'],
  // Template literals
  [/`(?:[^`\\]|\\.)*`/g, 'string'],
  // Double-quoted strings
  [/"(?:[^"\\]|\\.)*"/g, 'string'],
  // Single-quoted strings
  [/'(?:[^'\\]|\\.)*'/g, 'string'],
  // Type annotations (after colon or as generic, or standalone type keywords)
  [/\b(?:string|number|boolean|void|never|unknown|object|symbol|bigint|undefined|null|Array|Promise|Record|Partial|Required|Readonly|Pick|Omit|Map|Set)\b/g, 'type'],
  // JSX/HTML tags
  [/<\/?[a-zA-Z][a-zA-Z0-9.]*(?=[\s/>])/g, 'tag'],
  // Keywords (must come before function calls so `if(`, `catch(` etc. get keyword color)
  [/\b(?:import|export|from|default|const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|void|throw|try|catch|finally|class|extends|super|this|async|await|yield|of|in|as|any|type|interface|enum|namespace|declare|readonly|public|private|protected|static|abstract|implements|require|module)\b/g, 'keyword'],
  // Function calls: word followed by (
  [/\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/g, 'function'],
  // Method calls: .word followed by (
  [/(?<=\.)[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/g, 'function'],
  // Numbers (hex, float, int)
  [/\b0x[0-9a-fA-F]+\b|\b\d+\.?\d*(?:e[+-]?\d+)?\b/g, 'number'],
  // Boolean / null / undefined constants
  [/\b(?:true|false|NaN|Infinity)\b/g, 'keyword'],
  // Property access: .word (not followed by parenthesis — those are functions above)
  [/(?<=\.)[a-zA-Z_$][a-zA-Z0-9_$]*/g, 'variable'],
  // Standalone identifiers (variables/params) — after keywords/functions already claimed
  [/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g, 'variable'],
  // Arrows & operators
  [/=>|&&|\|\||[!=<>]=?=?|\?\?|\?\.|\.\.\./g, 'operator'],
];

interface Token {
  start: number;
  end: number;
  color: string;
}

// ---------------------------------------------------------------------------
// LRU cache — same lines appear on both panels and across scrolls
// ---------------------------------------------------------------------------

const MAX_CACHE = 2000;
const tokenCache = new Map<string, Token[]>();

function tokenize(text: string): Token[] {
  const cached = tokenCache.get(text);
  if (cached) return cached;

  const tokens: Token[] = [];
  const taken = new Uint8Array(text.length);

  for (const [regex, colorKey] of TOKEN_RULES) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      let overlap = false;
      for (let i = start; i < end; i++) {
        if (taken[i]) { overlap = true; break; }
      }
      if (overlap) continue;
      for (let i = start; i < end; i++) taken[i] = 1;
      tokens.push({ start, end, color: COLORS[colorKey] });
    }
  }

  tokens.sort((a, b) => a.start - b.start);

  if (tokenCache.size >= MAX_CACHE) {
    tokenCache.delete(tokenCache.keys().next().value!);
  }
  tokenCache.set(text, tokens);

  return tokens;
}

// ---------------------------------------------------------------------------
// Bracket end depth — tracks depth with per-step clamping (matches pushGap)
// ---------------------------------------------------------------------------

export function computeEndDepth(text: string, startDepth: number): number {
  if (!text) return startDepth;
  const tokens = tokenize(text);
  let depth = startDepth;
  let cursor = 0;
  for (const { start, end } of tokens) {
    for (let i = cursor; i < start; i++) {
      const ch = text[i];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth = Math.max(0, depth - 1);
    }
    cursor = end;
  }
  for (let i = cursor; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth = Math.max(0, depth - 1);
  }
  return depth;
}

// ---------------------------------------------------------------------------
// Highlight line with cross-line bracket depth
// ---------------------------------------------------------------------------

export function highlightLine(text: string, startDepth: number = 0): ReactNode[] {
  if (!text) return [text];

  const tokens = tokenize(text);
  const parts: ReactNode[] = [];
  let cursor = 0;
  let depth = startDepth;

  const pushGap = (from: number, to: number) => {
    let gc = from;
    for (let i = from; i < to; i++) {
      const ch = text[i];
      const isOpen = ch === '(' || ch === '{' || ch === '[';
      const isClose = ch === ')' || ch === '}' || ch === ']';
      if (isOpen || isClose) {
        if (gc < i) {
          parts.push(<span key={`p${gc}`} style={{ color: COLORS.punctuation }}>{text.slice(gc, i)}</span>);
        }
        if (isClose) depth = Math.max(0, depth - 1);
        parts.push(<span key={`b${i}`} style={{ color: BRACKET_COLORS[depth % 3] }}>{ch}</span>);
        if (isOpen) depth++;
        gc = i + 1;
      }
    }
    if (gc < to) {
      parts.push(<span key={`p${gc}`} style={{ color: COLORS.punctuation }}>{text.slice(gc, to)}</span>);
    }
  };

  if (tokens.length === 0) {
    pushGap(0, text.length);
    return parts.length > 0 ? parts : [<span key="0" style={{ color: COLORS.default }}>{text}</span>];
  }

  for (let i = 0; i < tokens.length; i++) {
    const { start, end, color } = tokens[i];
    if (cursor < start) {
      pushGap(cursor, start);
    }
    parts.push(
      <span key={`t${i}`} style={{ color }}>
        {text.slice(start, end)}
      </span>
    );
    cursor = end;
  }

  if (cursor < text.length) {
    pushGap(cursor, text.length);
  }

  return parts;
}
