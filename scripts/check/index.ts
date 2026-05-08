#!/usr/bin/env node
/**
 * @file scripts/check/index.ts
 * @description OODA harness aggregator. Runs tsc/biome/jest in parallel,
 * forwards each tool's stderr (prefixed with [tool]), and emits a single
 * trailing JSON envelope on stdout.
 *
 * Usage:
 *   pnpm check                    # all tools
 *   pnpm check --fast             # drop jest (pre-push escape)
 *   pnpm check --json             # suppress stderr forwarding (envelope only)
 *   pnpm check --tools=tsc,biome  # subset
 *   pnpm check --since=HEAD       # passes --staged to biome (tsc full in v1)
 *
 * Exit code: 0 when ok=true, 1 otherwise.
 */

import { biomeAdapter } from './adapters/biome';
import { jestAdapter } from './adapters/jest';
import { tscAdapter } from './adapters/tsc';
import type { Adapter, Diagnostic, Envelope, ToolName } from './types';

interface CliOpts {
  fast: boolean;
  json: boolean;
  tools: ToolName[];
  since?: string;
}

const ALL_TOOLS: ToolName[] = ['tsc', 'biome', 'jest'];

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = { fast: false, json: false, tools: [...ALL_TOOLS] };
  let toolsExplicit = false;
  for (const arg of argv) {
    if (arg === '--fast') {
      opts.fast = true;
      continue;
    }
    if (arg === '--json') {
      opts.json = true;
      continue;
    }
    if (arg.startsWith('--tools=')) {
      const list = arg
        .slice('--tools='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const validated = list.filter((t): t is ToolName => (ALL_TOOLS as string[]).includes(t));
      opts.tools = validated;
      toolsExplicit = true;
      continue;
    }
    if (arg.startsWith('--since=')) {
      opts.since = arg.slice('--since='.length);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  if (opts.fast && !toolsExplicit) {
    opts.tools = opts.tools.filter((t) => t !== 'jest');
  }
  return opts;
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`pnpm check [--fast] [--json] [--tools=tsc,biome,jest] [--since=<rev>]
  --fast            Drop jest (pre-push escape hatch); equivalent to --tools=tsc,biome
  --json            Suppress stderr forwarding; only emit JSON envelope on stdout
  --tools=<list>    Subset of tools to run (comma-separated)
  --since=<rev>     Pass --staged to biome (incremental hint)`);
}

function adapterByName(name: ToolName): Adapter {
  switch (name) {
    case 'tsc':
      return tscAdapter;
    case 'biome':
      return biomeAdapter;
    case 'jest':
      return jestAdapter;
  }
}

/**
 * Re-emit a tool's raw stderr with a `[tool]` prefix on every line, to stderr.
 * Skipped entirely in --json mode.
 */
function forwardStderr(tool: ToolName, raw: string): void {
  if (!raw) return;
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (line.length === 0) continue;
    process.stderr.write(`[${tool}] ${line}\n`);
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const start = Date.now();

  if (opts.tools.length === 0) {
    const envelope: Envelope = {
      version: 1,
      ok: true,
      duration_ms: 0,
      summary: { errors: 0, warnings: 0 },
      diagnostics: [],
    };
    process.stdout.write(`${JSON.stringify(envelope)}\n`);
    process.exit(0);
  }

  const runs = opts.tools.map(async (name) => {
    const adapter = adapterByName(name);
    try {
      const result = await adapter.run({ fast: opts.fast, cwd, silentStderr: opts.json, since: opts.since });
      if (!opts.json) forwardStderr(name, result.rawStderr);
      return result.diagnostics;
    } catch (e) {
      const err = e as Error;
      if (!opts.json) forwardStderr(name, err.stack ?? err.message);
      const diag: Diagnostic = {
        tool: name,
        severity: 'error',
        code: 'TOOL_CRASH',
        message: err.message,
      };
      return [diag];
    }
  });

  const results = await Promise.all(runs);
  const diagnostics = results.flat();

  const summary = diagnostics.reduce(
    (acc, d) => {
      if (d.severity === 'error') acc.errors += 1;
      else if (d.severity === 'warning') acc.warnings += 1;
      return acc;
    },
    { errors: 0, warnings: 0 }
  );

  const envelope: Envelope = {
    version: 1,
    ok: summary.errors === 0,
    duration_ms: Date.now() - start,
    summary,
    diagnostics,
  };

  process.stdout.write(`${JSON.stringify(envelope)}\n`);
  process.exit(envelope.ok ? 0 : 1);
}

main().catch((e) => {
  // Last-resort error handler: emit a minimal envelope so consumers can still parse stdout.
  const err = e as Error;
  const envelope: Envelope = {
    version: 1,
    ok: false,
    duration_ms: 0,
    summary: { errors: 1, warnings: 0 },
    diagnostics: [
      {
        tool: 'tsc',
        severity: 'error',
        code: 'TOOL_CRASH',
        message: `Aggregator crashed: ${err.message}`,
      },
    ],
  };
  process.stderr.write(`[check] ${err.stack ?? err.message}\n`);
  process.stdout.write(`${JSON.stringify(envelope)}\n`);
  process.exit(1);
});
