#!/usr/bin/env node
// Supabase migration linter.
//
// Scans every file in supabase/migrations/*.sql and enforces security rules
// so we never regress the hardening done in April 2026.
//
// Rules:
//   a) security_invoker on public views: every `CREATE [OR REPLACE] VIEW
//      public.<name>` must include `WITH (security_invoker = true)` within
//      ~500 chars of the CREATE keyword. Whitespace- and case-insensitive.
//      Grandfather: an earlier CREATE on the same view name passes if a
//      later migration (by filename) creates the same view WITH security_invoker.
//   b) search_path on functions: every `CREATE [OR REPLACE] FUNCTION` must
//      include a `SET search_path ...` clause in its header (before `AS $...$`).
//   c) No `WITH CHECK (true)` policies unless the line immediately above
//      carries `-- lint-allow-with-check-true: <reason>`.
//   d) No bare JWT-shaped tokens in SQL (pattern eyJ[A-Za-z0-9_\-.]{40,}).
//      The role identifier `service_role` is fine; only literal token values fail.
//
// Output: `<file>:<line>: <rule>: <message>`. Exit 0 on pass, 1 on failure.
// Pass `--summary` to emit counts. Pass `--ignore-before=YYYYMMDD` to suppress
// failures in migrations whose filename date is strictly earlier than the cutoff
// (useful for CI during the initial rollout — pre-existing violations in legacy
// migrations are a separate concern per the signer-hardening plan).
//
// Plain Node (no dependencies).

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations');

const WINDOW_VIEW = 500;
const WINDOW_FUNC = 4000;

const args = process.argv.slice(2);
const SUMMARY_MODE = args.includes('--summary');
let IGNORE_BEFORE = null;
for (const a of args) {
  const m = a.match(/^--ignore-before=(\d{8})$/);
  if (m) IGNORE_BEFORE = m[1];
}

// Strip SQL comments (line `-- ...` and block `/*...*/`) while preserving
// newline positions so any line lookups on the stripped source stay accurate.
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let inLine = false;
  let inBlock = false;
  let inSingle = false;
  let inDouble = false;
  let inDollar = false;
  let dollarTag = '';
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (inLine) {
      if (c === '\n') {
        inLine = false;
        out += c;
      } else {
        out += ' ';
      }
      i++;
      continue;
    }
    if (inBlock) {
      if (c === '*' && c2 === '/') {
        inBlock = false;
        out += '  ';
        i += 2;
        continue;
      }
      out += c === '\n' ? '\n' : ' ';
      i++;
      continue;
    }
    if (inSingle) {
      out += c;
      if (c === "'" && src[i - 1] !== '\\') inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      out += c;
      if (c === '"') inDouble = false;
      i++;
      continue;
    }
    if (inDollar) {
      out += c;
      if (c === '$') {
        const end = src.indexOf('$', i + 1);
        if (end !== -1) {
          const candidate = src.slice(i, end + 1);
          if (candidate === dollarTag) {
            out += src.slice(i + 1, end + 1);
            i = end + 1;
            inDollar = false;
            continue;
          }
        }
      }
      i++;
      continue;
    }
    if (c === '-' && c2 === '-') {
      inLine = true;
      out += '  ';
      i += 2;
      continue;
    }
    if (c === '/' && c2 === '*') {
      inBlock = true;
      out += '  ';
      i += 2;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      out += c;
      i++;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      out += c;
      i++;
      continue;
    }
    if (c === '$') {
      const close = src.indexOf('$', i + 1);
      if (close !== -1) {
        const tag = src.slice(i, close + 1);
        if (/^\$[A-Za-z0-9_]*\$$/.test(tag)) {
          inDollar = true;
          dollarTag = tag;
          out += tag;
          i = close + 1;
          continue;
        }
      }
    }
    out += c;
    i++;
  }
  return out;
}

function lineNumberOf(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) {
    if (src[i] === '\n') line++;
  }
  return line;
}

// --- Rule implementations -----------------------------------------------

function findViewCreates(stripped) {
  // Returns list of { schema, name, index, hasInvoker } for every CREATE VIEW.
  const re =
    /create\s+(?:or\s+replace\s+)?(?:temp(?:orary)?\s+|materialized\s+)?view\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*\.\s*)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
  const results = [];
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const schema = (m[1] || 'public').toLowerCase();
    const name = m[2];
    const index = m.index;
    const window = stripped.slice(index, index + WINDOW_VIEW);
    // Accept `security_invoker` or `"security_invoker"`, any whitespace, `= true`
    // with optional single quotes around the value.
    const hasInvoker = /"?security_invoker"?\s*=\s*'?\s*true\s*'?/i.test(window);
    results.push({ schema, name, index, hasInvoker });
  }
  return results;
}

function findFunctionCreates(stripped) {
  const re =
    /create\s+(?:or\s+replace\s+)?function\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*\.\s*)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
  const results = [];
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const schema = (m[1] || 'public').toLowerCase();
    const name = m[2];
    const index = m.index;
    const window = stripped.slice(index, index + WINDOW_FUNC);
    // Header ends at the first `AS $...$` body marker, or at the end of the
    // window if the header is unusually long.
    const bodyMatch = window.match(/\bas\s*\$/i);
    const endIdx = bodyMatch ? bodyMatch.index : window.length;
    const header = window.slice(0, endIdx);
    const hasSearchPath = /\bset\s+search_path\b/i.test(header);
    results.push({ schema, name, index, hasSearchPath });
  }
  return results;
}

function findPolicyWithCheckTrue(raw, stripped) {
  const re = /create\s+policy\b[\s\S]*?with\s+check\s*\(\s*true\s*\)/gi;
  const allowComment = /--\s*lint-allow-with-check-true\s*:/i;
  const rawLines = raw.split('\n');
  const results = [];
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const localIdx = m[0].search(/with\s+check\s*\(\s*true\s*\)/i);
    const absIdx = m.index + (localIdx >= 0 ? localIdx : 0);
    const lineNo = lineNumberOf(raw, absIdx);
    const createLine = lineNumberOf(raw, m.index);
    const above = rawLines[createLine - 2] || '';
    if (allowComment.test(above)) continue;
    results.push({ index: absIdx, line: lineNo });
  }
  return results;
}

function findBareJwts(stripped) {
  const re = /eyJ[A-Za-z0-9_\-.]{40,}/g;
  const results = [];
  let m;
  while ((m = re.exec(stripped)) !== null) {
    results.push({ index: m.index, match: m[0] });
  }
  return results;
}

// --- Driver -------------------------------------------------------------

function filenameDate(filename) {
  // Supabase migration filenames start with YYYYMMDDHHMMSS. Extract the YYYYMMDD.
  const m = filename.match(/^(\d{8})/);
  return m ? m[1] : null;
}

function main() {
  let files;
  try {
    files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch (err) {
    console.error(`lint-supabase-migrations: cannot read ${MIGRATIONS_DIR}: ${err.message}`);
    process.exit(2);
  }

  // First pass: collect view-create information across ALL files so we can
  // implement the grandfather rule for security_invoker_on_views.
  // For each view name, remember the chronological order of CREATE statements
  // and whether any of them has security_invoker. An earlier CREATE without
  // security_invoker is grandfathered ONLY if a later CREATE for the same view
  // name in a later file has security_invoker.
  const viewHistory = new Map(); // name -> [{ file, hasInvoker, sortKey }]

  const parsedFiles = [];
  for (const f of files) {
    const full = join(MIGRATIONS_DIR, f);
    const raw = readFileSync(full, 'utf8');
    const stripped = stripComments(raw);
    const views = findViewCreates(stripped);
    const funcs = findFunctionCreates(stripped);
    const polyTrue = findPolicyWithCheckTrue(raw, stripped);
    const jwts = findBareJwts(stripped);
    parsedFiles.push({ file: f, raw, stripped, views, funcs, polyTrue, jwts });
    for (const v of views) {
      if (v.schema !== 'public') continue;
      if (!viewHistory.has(v.name)) viewHistory.set(v.name, []);
      viewHistory.get(v.name).push({ file: f, hasInvoker: v.hasInvoker });
    }
  }

  // For each view name, determine which (file, name) pairs are grandfathered.
  // A statement is grandfathered if there exists a later file where the same
  // view name is CREATEd WITH security_invoker.
  const grandfathered = new Set(); // key: `${file}::${name}`
  for (const [name, entries] of viewHistory.entries()) {
    // entries are already in chronological order (files are sorted).
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].hasInvoker) continue;
      // Is there a later entry with hasInvoker?
      for (let j = i + 1; j < entries.length; j++) {
        if (entries[j].hasInvoker) {
          grandfathered.add(`${entries[i].file}::${name}`);
          break;
        }
      }
    }
  }

  // Second pass: emit failures.
  const allFailures = [];
  for (const pf of parsedFiles) {
    const rel = `supabase/migrations/${pf.file}`;
    for (const v of pf.views) {
      if (v.schema !== 'public') continue;
      if (v.hasInvoker) continue;
      if (grandfathered.has(`${pf.file}::${v.name}`)) continue;
      allFailures.push({
        file: rel,
        rawFile: pf.file,
        line: lineNumberOf(pf.raw, v.index),
        rule: 'security-invoker-view',
        message: `view "public"."${v.name}" missing WITH (security_invoker = true)`,
      });
    }
    for (const fn of pf.funcs) {
      if (fn.schema !== 'public') continue;
      if (fn.hasSearchPath) continue;
      allFailures.push({
        file: rel,
        rawFile: pf.file,
        line: lineNumberOf(pf.raw, fn.index),
        rule: 'function-search-path',
        message: `function "public"."${fn.name}" missing SET search_path clause in header`,
      });
    }
    for (const p of pf.polyTrue) {
      allFailures.push({
        file: rel,
        rawFile: pf.file,
        line: p.line,
        rule: 'no-with-check-true',
        message: 'policy uses WITH CHECK (true) without allowlist comment',
      });
    }
    for (const j of pf.jwts) {
      allFailures.push({
        file: rel,
        rawFile: pf.file,
        line: lineNumberOf(pf.raw, j.index),
        rule: 'no-bare-jwt',
        message: `literal JWT-shaped token found: "${j.match.slice(0, 16)}..."`,
      });
    }
  }

  // Apply --ignore-before filter for exit code (still print all).
  let blocking = 0;
  for (const f of allFailures) {
    const fdate = filenameDate(f.rawFile);
    const isBlocking = !IGNORE_BEFORE || !fdate || fdate >= IGNORE_BEFORE;
    const marker = isBlocking ? '' : ' [ignored:pre-cutoff]';
    console.log(`${f.file}:${f.line}: ${f.rule}: ${f.message}${marker}`);
    if (isBlocking) blocking++;
  }

  if (SUMMARY_MODE) {
    const byRule = new Map();
    for (const f of allFailures) {
      const fdate = filenameDate(f.rawFile);
      const isBlocking = !IGNORE_BEFORE || !fdate || fdate >= IGNORE_BEFORE;
      const key = `${f.rule}${isBlocking ? '' : ' (ignored)'}`;
      byRule.set(key, (byRule.get(key) || 0) + 1);
    }
    console.log('---');
    console.log(`files scanned: ${parsedFiles.length}`);
    console.log(`total failures: ${allFailures.length}`);
    console.log(`blocking failures: ${blocking}`);
    if (IGNORE_BEFORE) console.log(`ignore-before cutoff: ${IGNORE_BEFORE}`);
    for (const [rule, count] of [...byRule.entries()].sort()) {
      console.log(`  ${rule}: ${count}`);
    }
  }

  process.exit(blocking === 0 ? 0 : 1);
}

main();
