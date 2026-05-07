/**
 * @file adapters/tsc.ts
 * @description tsc adapter: spawns `tsc --noEmit --pretty false --noErrorTruncation --locale en`
 * and parses the stable text format `path(line,col): error TSxxxx: message`.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Adapter, AdapterResult, AdapterRunOpts, Diagnostic, HintMap } from '../types';

const HINTS_PATH = path.join(__dirname, '..', 'hints', 'tsc.json');

let cachedHints: HintMap | null = null;
function loadHints(): HintMap {
  if (cachedHints) return cachedHints;
  try {
    const raw = fs.readFileSync(HINTS_PATH, 'utf8');
    cachedHints = JSON.parse(raw) as HintMap;
  } catch {
    cachedHints = {};
  }
  return cachedHints;
}

const TSC_LINE =
  /^(?<file>[^(]+)\((?<line>\d+),(?<col>\d+)\):\s+(?<severity>error|warning)\s+(?<code>TS\d+):\s+(?<message>.*)$/;

/**
 * Pure parser. Exported for unit tests. Accepts merged stdout/stderr text from tsc.
 */
export function parseTscOutput(text: string, hints: HintMap = loadHints()): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const match = TSC_LINE.exec(line);
    if (!match || !match.groups) continue;
    const { file, line: ln, col, severity, code, message } = match.groups;
    const hint = hints[code] ?? {};
    diagnostics.push({
      tool: 'tsc',
      severity: severity === 'warning' ? 'warning' : 'error',
      code,
      file,
      line: Number(ln),
      col: Number(col),
      message: message.trim(),
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
    tool: 'tsc',
    severity: 'error',
    code,
    message,
    ...(hint.fix_hint ? { fix_hint: hint.fix_hint } : {}),
    ...(hint.see_also ? { see_also: hint.see_also } : {}),
  };
}

export const tscAdapter: Adapter = {
  name: 'tsc',
  async run(opts: AdapterRunOpts): Promise<AdapterResult> {
    const hints = loadHints();
    const args = ['exec', 'tsc', '--noEmit', '--pretty', 'false', '--noErrorTruncation', '--locale', 'en'];

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
          const combined = `${stdoutBuf}\n${stderrBuf}`;
          resolve({
            diagnostics: [
              synthesizeFailureDiagnostic('TOOL_CRASH', `tsc terminated by signal ${signal ?? 'unknown'}`, hints),
            ],
            rawStderr: combined.trim(),
          });
          return;
        }
        // tsc reports diagnostics on stdout when --pretty false; also fall back to stderr.
        const combined = `${stdoutBuf}\n${stderrBuf}`;
        const diagnostics = parseTscOutput(combined, hints);
        if (diagnostics.length === 0 && exitCode !== 0) {
          diagnostics.push(synthesizeFailureDiagnostic('UNKNOWN_FAILURE', `tsc exited with code ${exitCode}`, hints));
        }
        // Forward both streams as rawStderr so the aggregator can pass them through.
        resolve({ diagnostics, rawStderr: combined.trim() });
      });
    });
  },
};
