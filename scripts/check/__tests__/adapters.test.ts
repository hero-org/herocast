/**
 * @file adapters.test.ts
 * @description Fixture-based unit tests for the OODA harness adapters' parse functions.
 * Each adapter parser is tested against an error fixture (non-empty diagnostics with the
 * expected shape) and an ok fixture (empty diagnostics).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { parseBiomeOutput } from '../adapters/biome';
import { parseJestOutput } from '../adapters/jest';
import { parseTscOutput } from '../adapters/tsc';

const FIXTURES = path.join(__dirname, '..', '__fixtures__');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

describe('tsc adapter parser', () => {
  it('parses errors with file/line/col/code/message and applies hints', () => {
    const out = parseTscOutput(readFixture('tsc.error.txt'));
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]).toMatchObject({
      tool: 'tsc',
      severity: 'error',
      code: 'TS2322',
      file: expect.any(String),
      line: expect.any(Number),
      col: expect.any(Number),
      message: expect.any(String),
    });
    // Hint map seeded for TS2322; ensure the parser surfaces it.
    expect(out[0].fix_hint).toBeDefined();
    expect(out[0].see_also).toMatch(/typecheck\.md/);
    // Multiple diagnostics parsed (3 in the fixture).
    expect(out.length).toBe(3);
    expect(out.map((d) => d.code).sort()).toEqual(['TS2304', 'TS2322', 'TS2339']);
  });

  it('returns empty diagnostics on clean output', () => {
    expect(parseTscOutput(readFixture('tsc.ok.txt'))).toEqual([]);
  });
});

describe('biome adapter parser', () => {
  it('parses diagnostics from JSON reporter and applies hints', () => {
    const out = parseBiomeOutput(readFixture('biome.error.json'));
    expect(out.length).toBe(2);
    const codes = out.map((d) => d.code).sort();
    expect(codes).toEqual(['lint/correctness/noUnusedImports', 'lint/suspicious/noExplicitAny']);
    const noUnused = out.find((d) => d.code === 'lint/correctness/noUnusedImports');
    expect(noUnused).toMatchObject({
      tool: 'biome',
      severity: 'error',
      file: 'src/components/Example.tsx',
    });
    expect(noUnused?.fix_hint).toBeDefined();
    expect(noUnused?.see_also).toMatch(/typecheck\.md/);
    // Both shapes of `path` (object form and string form) are handled.
    const noAny = out.find((d) => d.code === 'lint/suspicious/noExplicitAny');
    expect(noAny?.file).toBe('src/lib/helpers/foo.ts');
    expect(noAny?.severity).toBe('warning');
  });

  it('returns empty diagnostics on clean JSON', () => {
    expect(parseBiomeOutput(readFixture('biome.ok.json'))).toEqual([]);
  });
});

describe('jest adapter parser', () => {
  it('parses failed assertions, classifies code, and extracts stack frame', () => {
    const out = parseJestOutput(readFixture('jest.error.json'), '/Users/dev/repo');
    expect(out.length).toBe(2);
    expect(out[0]).toMatchObject({
      tool: 'jest',
      severity: 'error',
      code: 'JEST_TEST_FAILURE',
      file: expect.stringMatching(/example\.test\.ts$/),
      line: expect.any(Number),
      col: expect.any(Number),
    });
    expect(out[0].fix_hint).toBeDefined();
    expect(out[0].message).toMatch(/myUtil/);
  });

  it('returns empty diagnostics when all tests passed', () => {
    expect(parseJestOutput(readFixture('jest.ok.json'), '/Users/dev/repo')).toEqual([]);
  });
});
