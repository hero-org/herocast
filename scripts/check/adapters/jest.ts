/**
 * @file adapters/jest.ts
 * @description jest adapter: spawns `jest --json --silent`, parses the JSON report,
 * and extracts the first stack frame matching the repo CWD as file/line/col.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Adapter, AdapterResult, AdapterRunOpts, Diagnostic, HintMap } from '../types';

const HINTS_PATH = path.join(__dirname, '..', 'hints', 'jest.json');

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

interface JestAssertion {
  ancestorTitles?: string[];
  failureMessages?: string[];
  fullName?: string;
  status?: string;
  title?: string;
  location?: { line?: number; column?: number } | null;
}

interface JestSuiteResult {
  assertionResults?: JestAssertion[];
  message?: string;
  name?: string;
  status?: string;
}

interface JestReport {
  success?: boolean;
  testResults?: JestSuiteResult[];
}

/**
 * Strip ANSI color escape sequences so failure messages render cleanly.
 * The regex deliberately targets the ESC control char (0x1B) — biome's
 * noControlCharactersInRegex would flag a literal `\x1B`, so we build the
 * pattern dynamically.
 */
const ANSI_RE = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*[A-Za-z]`, 'g');
function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

/**
 * Extract first stack frame referencing a path inside the repo (cwd).
 * Frame format examples: `at Object.<anonymous> (/path/to/file.test.ts:14:24)`
 * or `at /path/to/file.test.ts:14:24`.
 */
function extractFrame(messages: string[], cwd: string): { file?: string; line?: number; col?: number } {
  const frameRe = /\(?(\/[^\s():]+):(\d+):(\d+)\)?/g;
  for (const raw of messages) {
    const cleaned = stripAnsi(raw);
    let m: RegExpExecArray | null;
    frameRe.lastIndex = 0;
    while ((m = frameRe.exec(cleaned)) !== null) {
      const file = m[1];
      // Skip node_modules and jest internals; prefer first frame inside the repo.
      if (file.includes('/node_modules/')) continue;
      const inRepo = !cwd || file.startsWith(cwd);
      if (inRepo) {
        return { file, line: Number(m[2]), col: Number(m[3]) };
      }
    }
  }
  return {};
}

type FailureCode = 'JEST_TIMEOUT' | 'JEST_SNAPSHOT' | 'JEST_TEST_FAILURE' | 'API_CONTRACT_DRIFT';

function classifyFailure(message: string, suiteFile?: string): FailureCode {
  const cleaned = stripAnsi(message).toLowerCase();
  if (cleaned.includes('exceeded timeout') || cleaned.includes('timeout of ')) return 'JEST_TIMEOUT';
  if (cleaned.includes('snapshot')) return 'JEST_SNAPSHOT';
  if (suiteFile && /\/api-contracts\/__tests__\//.test(suiteFile)) return 'API_CONTRACT_DRIFT';
  return 'JEST_TEST_FAILURE';
}

/**
 * Pure parser. Exported for unit tests.
 */
export function parseJestOutput(text: string, cwd = '', hints: HintMap = loadHints()): Diagnostic[] {
  if (!text || !text.trim()) return [];
  let report: JestReport;
  try {
    report = JSON.parse(text) as JestReport;
  } catch {
    return [];
  }
  const diagnostics: Diagnostic[] = [];

  for (const suite of report.testResults ?? []) {
    const suiteFile = suite.name;
    const assertions = suite.assertionResults ?? [];
    const hadFailingAssertion = assertions.some((a) => a.status === 'failed');

    // Suite-level failure (e.g. file failed to load) without per-assertion data.
    if (suite.status === 'failed' && !hadFailingAssertion) {
      const code = 'JEST_SUITE_FAILURE';
      const hint = hints[code] ?? {};
      diagnostics.push({
        tool: 'jest',
        severity: 'error',
        code,
        ...(suiteFile ? { file: suiteFile } : {}),
        message:
          stripAnsi(suite.message ?? `Suite failed: ${suiteFile ?? '<unknown>'}`).trim() ||
          `Suite failed: ${suiteFile ?? '<unknown>'}`,
        ...(hint.fix_hint ? { fix_hint: hint.fix_hint } : {}),
        ...(hint.see_also ? { see_also: hint.see_also } : {}),
      });
    }

    for (const assertion of assertions) {
      if (assertion.status !== 'failed') continue;
      const failureMessages = assertion.failureMessages ?? [];
      const code = classifyFailure(failureMessages.join('\n'), suiteFile);
      const hint = hints[code] ?? {};
      const frame = extractFrame(failureMessages, cwd);
      const fullName =
        assertion.fullName ?? [...(assertion.ancestorTitles ?? []), assertion.title ?? ''].filter(Boolean).join(' > ');
      const messageBody = stripAnsi(failureMessages[0] ?? '')
        .split('\n')
        .slice(0, 8)
        .join('\n')
        .trim();
      diagnostics.push({
        tool: 'jest',
        severity: 'error',
        code,
        ...(frame.file ? { file: frame.file } : suiteFile ? { file: suiteFile } : {}),
        ...(frame.line !== undefined ? { line: frame.line } : {}),
        ...(frame.col !== undefined ? { col: frame.col } : {}),
        message: `${fullName}${messageBody ? `\n${messageBody}` : ''}`.trim() || fullName || 'Jest assertion failed',
        ...(hint.fix_hint ? { fix_hint: hint.fix_hint } : {}),
        ...(hint.see_also ? { see_also: hint.see_also } : {}),
      });
    }
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
    tool: 'jest',
    severity: 'error',
    code,
    message,
    ...(hint.fix_hint ? { fix_hint: hint.fix_hint } : {}),
    ...(hint.see_also ? { see_also: hint.see_also } : {}),
  };
}

export const jestAdapter: Adapter = {
  name: 'jest',
  async run(opts: AdapterRunOpts): Promise<AdapterResult> {
    const hints = loadHints();
    const args = ['exec', 'jest', '--json', '--silent'];

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
              synthesizeFailureDiagnostic('TOOL_CRASH', `jest terminated by signal ${signal ?? 'unknown'}`, hints),
            ],
            rawStderr: stderrBuf.trim(),
          });
          return;
        }
        const diagnostics = parseJestOutput(stdoutBuf, opts.cwd, hints);
        if (diagnostics.length === 0 && exitCode !== 0) {
          diagnostics.push(synthesizeFailureDiagnostic('UNKNOWN_FAILURE', `jest exited with code ${exitCode}`, hints));
        }
        resolve({ diagnostics, rawStderr: stderrBuf.trim() });
      });
    });
  },
};
