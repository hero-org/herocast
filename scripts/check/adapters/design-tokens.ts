/**
 * @file adapters/design-tokens.ts
 * @description design-tokens adapter: scans src/ and app/ for raw color literals
 * (hex, rgb, hsl) that should resolve through tokens instead. Catches new leaks
 * before they land. Exemptions live in EXEMPT_FILES.
 *
 * Rationale: the design-system spec mandates `hsl(var(--token))` everywhere in
 * product chrome. ESLint can't reliably match patterns inside JSX `className`
 * strings, so a grep-based check is the pragmatic option.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Adapter, AdapterResult, AdapterRunOpts, Diagnostic } from '../types';

const SCAN_DIRS = ['src', 'app'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.module.css']);

/**
 * Files where raw color literals are intentional and exempt from the check.
 * Add a paths-relative-to-repo-root entry with a one-line rationale.
 */
const EXEMPT_FILES = new Set<string>([
  'src/globals.css', // design-system source of truth (shadow stacks intentionally use raw hsl/rgba)
  'src/common/components/PerfPanel.tsx', // dev-only panel, intentionally vibrant
  'src/common/components/icons/FarcasterIcon.tsx', // external brand SVG (#8A63D2)
  'src/common/components/MiniApp/MiniAppSplash.tsx', // splash takes a runtime hex from miniapp metadata
  'src/common/components/WelcomeCards.tsx', // third-party Paragraph iframe wrapper
  'app/manifest.ts', // PWA theme_color/background_color need literal hex
  'app/global-error.tsx', // app-crash boundary; intentional minimal styling
  'src/lib/faker-stub.ts', // dependency stub, no UI
]);

/**
 * Patterns that flag raw color literals in product chrome.
 * - Hex: #RGB, #RRGGBB, #RRGGBBAA
 * - rgb/rgba/hsl/hsla functional notation
 * - Tailwind palette utilities outside the semantic-token allowlist
 */
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_RE = /\brgba?\s*\(/g;
const HSL_RE = /\bhsla?\s*\(/g;
const TW_PALETTE_RE =
  /\b(bg|text|border|ring|from|to|via|fill|stroke|outline|divide|placeholder|caret|accent|shadow)-(red|green|blue|amber|yellow|orange|purple|violet|sky|slate|gray|zinc|neutral|stone|emerald|lime|teal|cyan|fuchsia|pink|rose|indigo)-(50|100|200|300|400|500|600|700|800|900|950)\b/g;

/**
 * Inside CSS-like contexts (CSS files, style props, CSS modules) we allow
 * `hsl(var(...))` and `rgba(0 0 0 / ...)` patterns for shadows. The check below
 * filters those.
 */
function isAllowedHslCall(line: string, matchIndex: number): boolean {
  // hsl(var(--token)) — token resolution, allowed everywhere
  return /hsl\s*\(\s*var\s*\(/.test(line.slice(matchIndex, matchIndex + 24));
}

function isAllowedRgbCall(line: string, matchIndex: number): boolean {
  // rgb(255 255 255 / var(--alpha)) and similar token-driven shadow helpers
  const slice = line.slice(matchIndex, matchIndex + 60);
  return /rgba?\s*\(\s*\d+\s+\d+\s+\d+\s*\/\s*var\s*\(/.test(slice);
}

function relPath(absPath: string, cwd: string): string {
  const rel = path.relative(cwd, absPath);
  return rel.split(path.sep).join('/');
}

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      walk(full, out);
      continue;
    }
    const ext = path.extname(ent.name);
    const compoundExt = ent.name.endsWith('.module.css') ? '.module.css' : ext;
    if (SCAN_EXTENSIONS.has(ext) || SCAN_EXTENSIONS.has(compoundExt)) {
      out.push(full);
    }
  }
}

function stripCommentTail(line: string): string {
  // Strip everything after // (line comment), but only if // is outside a string literal.
  // Cheap heuristic: count quotes before the //; if balanced, the // starts a comment.
  const commentIdx = line.indexOf('//');
  if (commentIdx === -1) return line;
  const before = line.slice(0, commentIdx);
  const singleQuotes = (before.match(/'/g) ?? []).length;
  const doubleQuotes = (before.match(/"/g) ?? []).length;
  const backticks = (before.match(/`/g) ?? []).length;
  if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0 && backticks % 2 === 0) {
    return before;
  }
  return line;
}

function scanLine(file: string, rawLine: string, lineNumber: number, diagnostics: Diagnostic[]): void {
  // Strip line comments so hex/rgb in code comments doesn't trigger.
  const trimmed = rawLine.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
  const line = stripCommentTail(rawLine);

  // Hex literals
  HEX_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  m = HEX_RE.exec(line);
  while (m) {
    diagnostics.push({
      tool: 'design-tokens',
      severity: 'warning',
      code: 'raw-hex',
      file,
      line: lineNumber,
      col: m.index + 1,
      message: `Raw hex literal "${m[0]}" — use hsl(var(--token)) or a Tailwind token class instead.`,
      fix_hint: 'Add the file to EXEMPT_FILES in scripts/check/adapters/design-tokens.ts only when intentional.',
    });
    m = HEX_RE.exec(line);
  }

  RGB_RE.lastIndex = 0;
  m = RGB_RE.exec(line);
  while (m) {
    if (!isAllowedRgbCall(line, m.index)) {
      diagnostics.push({
        tool: 'design-tokens',
        severity: 'warning',
        code: 'raw-rgb',
        file,
        line: lineNumber,
        col: m.index + 1,
        message: 'Raw rgb()/rgba() call — use hsl(var(--token) / <alpha>) or a Tailwind token class.',
      });
    }
    m = RGB_RE.exec(line);
  }

  HSL_RE.lastIndex = 0;
  m = HSL_RE.exec(line);
  while (m) {
    if (!isAllowedHslCall(line, m.index)) {
      diagnostics.push({
        tool: 'design-tokens',
        severity: 'warning',
        code: 'raw-hsl',
        file,
        line: lineNumber,
        col: m.index + 1,
        message: 'Raw hsl()/hsla() call — wrap a token: hsl(var(--token) / <alpha>).',
      });
    }
    m = HSL_RE.exec(line);
  }

  TW_PALETTE_RE.lastIndex = 0;
  m = TW_PALETTE_RE.exec(line);
  while (m) {
    diagnostics.push({
      tool: 'design-tokens',
      severity: 'warning',
      code: 'tailwind-palette',
      file,
      line: lineNumber,
      col: m.index + 1,
      message: `Raw Tailwind palette utility "${m[0]}" — map to a semantic token (text-foreground, text-mention, text-channel, text-destructive, text-success, text-warning, text-info, text-muted-foreground).`,
    });
    m = TW_PALETTE_RE.exec(line);
  }
}

async function runDesignTokens(opts: AdapterRunOpts): Promise<AdapterResult> {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    walk(path.join(opts.cwd, dir), files);
  }

  const diagnostics: Diagnostic[] = [];
  for (const abs of files) {
    const rel = relPath(abs, opts.cwd);
    if (EXEMPT_FILES.has(rel)) continue;
    let content: string;
    try {
      content = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      scanLine(rel, lines[i], i + 1, diagnostics);
    }
  }

  const errorCount = diagnostics.length;
  const rawStderr =
    errorCount === 0
      ? ''
      : `design-tokens: ${errorCount} raw color leak${errorCount === 1 ? '' : 's'} (see envelope for details)`;

  return { diagnostics, rawStderr };
}

export const designTokensAdapter: Adapter = {
  name: 'design-tokens',
  run: runDesignTokens,
};
