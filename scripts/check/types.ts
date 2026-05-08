/**
 * @file types.ts
 * @description Shared types for the OODA aggregator: Diagnostic envelope and per-tool Adapter contract.
 * Stdout = exactly one trailing JSON line conforming to the Envelope shape.
 * Stderr = pass-through of each tool's human-readable output, prefixed with [tool].
 */

export type ToolName = 'tsc' | 'biome' | 'jest';
export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  tool: ToolName;
  severity: Severity;
  /** Stable identifier per tool: TS2322, lint/correctness/noUnusedImports, JEST_TEST_FAILURE, etc. */
  code: string;
  /** Repo-relative or absolute path. Optional for non-locatable diagnostics. */
  file?: string;
  line?: number;
  col?: number;
  message: string;
  /** Short remediation pointer; pulled from hints/<tool>.json when available. */
  fix_hint?: string;
  /** Anchor like docs/agents/typecheck.md#ts2322 */
  see_also?: string;
}

export interface EnvelopeSummary {
  errors: number;
  warnings: number;
}

export interface Envelope {
  version: 1;
  ok: boolean;
  duration_ms: number;
  summary: EnvelopeSummary;
  diagnostics: Diagnostic[];
}

export interface AdapterRunOpts {
  /** When true, adapter applies fast-path (e.g. biome --staged); aggregator drops jest entirely. */
  fast: boolean;
  /** Project root, used as CWD for spawned child processes. */
  cwd: string;
  /** When true, suppress raw stderr forwarding from this adapter. */
  silentStderr?: boolean;
  /** Optional --since revision to scope tools that support incremental hinting (currently biome). */
  since?: string;
}

export interface AdapterResult {
  diagnostics: Diagnostic[];
  /** Raw human-readable stderr captured from the underlying tool. Aggregator forwards verbatim. */
  rawStderr: string;
}

export interface Adapter {
  name: ToolName;
  run(opts: AdapterRunOpts): Promise<AdapterResult>;
}

/** Per-tool hint map: { "<code>": { fix_hint, see_also } } */
export type HintMap = Record<string, { fix_hint?: string; see_also?: string }>;
