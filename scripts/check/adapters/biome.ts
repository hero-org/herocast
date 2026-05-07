/**
 * @file adapters/biome.ts
 * @description biome adapter: spawns `biome check . --reporter=json` (or `--staged` when --since is set),
 * parses the JSON envelope, and maps each diagnostic.category to a hint.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Adapter, AdapterResult, AdapterRunOpts, Diagnostic, HintMap, Severity } from '../types';

// NOTE: filename is `biome-hints.json` rather than `biome.json` because biome v2 walks
// every nested directory and tries to deserialize any file named `biome.json` as a config.
// A hint map keyed by lint categories isn't a valid biome config, so the lint run fails.
const HINTS_PATH = path.join(__dirname, '..', 'hints', 'biome-hints.json');

let cachedHints: HintMap | null = null;
function loadHints(): HintMap {
  if (cachedHints) return cachedHints;
  try {
    cachedHints = JSON.parse(fs.readFileSync(HINTS_PATH, 'utf8')) as HintMap;
  } catch {
    cachedHints = {};
  }
  return cachedHints;
}

interface BiomeDiagnostic {
  category?: string;
  severity?: string;
  description?: string;
  message?: unknown;
  location?: {
    path?: string | { file?: string };
    span?: [number, number] | { start?: number; end?: number };
    sourceCode?: string;
    lineStarts?: number[];
  };
}

interface BiomeReport {
  diagnostics?: BiomeDiagnostic[];
  summary?: unknown;
}

function extractMessage(diag: BiomeDiagnostic): string {
  if (typeof diag.description === 'string' && diag.description.trim()) return diag.description.trim();
  const msg = diag.message;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) {
    const parts = msg
      .map((m) => {
        if (typeof m === 'string') return m;
        if (m && typeof m === 'object' && 'content' in m && typeof (m as { content: unknown }).content === 'string') {
          return (m as { content: string }).content;
        }
        return '';
      })
      .filter(Boolean);
    if (parts.length) return parts.join('').trim();
  }
  return diag.category ?? 'Biome diagnostic';
}

function extractFile(diag: BiomeDiagnostic): string | undefined {
  const p = diag.location?.path;
  if (!p) return undefined;
  if (typeof p === 'string') return p;
  if (typeof p === 'object' && typeof p.file === 'string') return p.file;
  return undefined;
}

function spanStart(diag: BiomeDiagnostic): number | undefined {
  const span = diag.location?.span;
  if (!span) return undefined;
  if (Array.isArray(span)) return typeof span[0] === 'number' ? span[0] : undefined;
  if (typeof span === 'object' && typeof span.start === 'number') return span.start;
  return undefined;
}

/**
 * Convert a byte offset to {line, col} (1-indexed) using either the lineStarts array
 * (preferred — provided by biome) or by scanning sourceCode for newlines.
 */
function offsetToLineCol(diag: BiomeDiagnostic, offset: number): { line?: number; col?: number } {
  const lineStarts = diag.location?.lineStarts;
  if (Array.isArray(lineStarts) && lineStarts.length > 0) {
    // Find the largest lineStart <= offset.
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, col: offset - lineStarts[lo] + 1 };
  }
  const src = diag.location?.sourceCode;
  if (typeof src === 'string') {
    const slice = src.slice(0, Math.min(offset, src.length));
    const nlCount = (slice.match(/\n/g) ?? []).length;
    const lastNl = slice.lastIndexOf('\n');
    return { line: nlCount + 1, col: lastNl === -1 ? offset + 1 : offset - lastNl };
  }
  return {};
}

function normalizeSeverity(s: string | undefined): Severity {
  if (s === 'error' || s === 'fatal') return 'error';
  if (s === 'warning' || s === 'warn') return 'warning';
  return 'info';
}

/**
 * Pure parser. Exported for unit tests.
 */
export function parseBiomeOutput(text: string, hints: HintMap = loadHints()): Diagnostic[] {
  if (!text || !text.trim()) return [];
  let report: BiomeReport;
  try {
    report = JSON.parse(text) as BiomeReport;
  } catch {
    return [];
  }
  const diagnostics: Diagnostic[] = [];
  for (const d of report.diagnostics ?? []) {
    const code = d.category ?? 'biome/unknown';
    const hint = hints[code] ?? {};
    const file = extractFile(d);
    const start = spanStart(d);
    const { line, col } = start !== undefined ? offsetToLineCol(d, start) : {};
    diagnostics.push({
      tool: 'biome',
      severity: normalizeSeverity(d.severity),
      code,
      ...(file ? { file } : {}),
      ...(line !== undefined ? { line } : {}),
      ...(col !== undefined ? { col } : {}),
      message: extractMessage(d),
      ...(hint.fix_hint ? { fix_hint: hint.fix_hint } : {}),
      ...(hint.see_also ? { see_also: hint.see_also } : {}),
    });
  }
  return diagnostics;
}

function synthesizeFailureDiagnostic(
  code: 'TOOL_CRASH' | 'UNKNOWN_FAILURE',
  message: string,
  hints: HintMap
): Diagnostic {
  const hint = hints[code] ?? {};
  return {
    tool: 'biome',
    severity: 'error',
    code,
    message,
    ...(hint.fix_hint ? { fix_hint: hint.fix_hint } : {}),
    ...(hint.see_also ? { see_also: hint.see_also } : {}),
  };
}

export const biomeAdapter: Adapter = {
  name: 'biome',
  async run(opts: AdapterRunOpts): Promise<AdapterResult> {
    const hints = loadHints();
    const args = ['exec', 'biome', 'check', '.', '--reporter=json'];
    if (opts.since) args.push('--staged');

    return await new Promise<AdapterResult>((resolve) => {
      let child;
      try {
        child = spawn('pnpm', args, {
          cwd: opts.cwd,
          env: { ...process.env, FORCE_COLOR: '0' },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (e) {
        const err = e as Error;
        resolve({
          diagnostics: [synthesizeFailureDiagnostic('TOOL_CRASH', err.message, hints)],
          rawStderr: err.stack ?? err.message,
        });
        return;
      }

      let stdoutBuf = '';
      let stderrBuf = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString('utf8');
      });

      child.on('error', (err) => {
        resolve({
          diagnostics: [synthesizeFailureDiagnostic('TOOL_CRASH', err.message, hints)],
          rawStderr: err.stack ?? err.message,
        });
      });

      child.on('close', (exitCode, signal) => {
        // Child killed by signal (e.g. OOM): exitCode is null, signal is set.
        if (exitCode === null) {
          resolve({
            diagnostics: [
              synthesizeFailureDiagnostic('TOOL_CRASH', `biome terminated by signal ${signal ?? 'unknown'}`, hints),
            ],
            rawStderr: stderrBuf.trim(),
          });
          return;
        }
        const diagnostics = parseBiomeOutput(stdoutBuf, hints);
        if (diagnostics.length === 0 && exitCode !== 0) {
          diagnostics.push(synthesizeFailureDiagnostic('UNKNOWN_FAILURE', `biome exited with code ${exitCode}`, hints));
        }
        resolve({ diagnostics, rawStderr: stderrBuf.trim() });
      });
    });
  },
};
