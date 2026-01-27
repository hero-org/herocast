/**
 * @file benchmark-compare.ts
 * @description Compare two benchmark results to measure improvement/regression
 *
 * Usage:
 *   pnpm run benchmark:compare                    # Compare latest local results
 *   pnpm run benchmark:compare before.json after.json  # Compare specific files
 */

import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
  timestamp: string;
  baseUrl: string;
  results: {
    [pageName: string]: {
      average: {
        loadTime: number;
        domContentLoaded: number;
        firstContentfulPaint?: number;
        largestContentfulPaint?: number;
      };
    };
  };
}

function loadResult(filePath: string): BenchmarkResult {
  const fullPath = filePath.startsWith('/') ? filePath : path.join(__dirname, 'benchmark-results', filePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

function formatDiff(before: number, after: number): string {
  const diff = after - before;
  const pct = ((diff / before) * 100).toFixed(1);
  const sign = diff > 0 ? '+' : '';
  const icon = diff < 0 ? '✅' : diff > 0 ? '❌' : '➖';
  return `${icon} ${sign}${diff}ms (${sign}${pct}%)`;
}

function compare(beforePath: string, afterPath: string) {
  const before = loadResult(beforePath);
  const after = loadResult(afterPath);

  console.log('\n' + '='.repeat(70));
  console.log('📊 BENCHMARK COMPARISON');
  console.log('='.repeat(70));
  console.log(`Before: ${before.timestamp} (${beforePath})`);
  console.log(`After:  ${after.timestamp} (${afterPath})`);
  console.log('-'.repeat(70));

  const allPages = new Set([...Object.keys(before.results), ...Object.keys(after.results)]);

  let totalImprovement = 0;
  let totalMetrics = 0;

  for (const pageName of allPages) {
    const beforeData = before.results[pageName]?.average;
    const afterData = after.results[pageName]?.average;

    if (!beforeData || !afterData) {
      console.log(`\n${pageName.toUpperCase()}: Missing data`);
      continue;
    }

    console.log(`\n${pageName.toUpperCase()}`);
    console.log(
      `  Load Time:     ${beforeData.loadTime}ms → ${afterData.loadTime}ms  ${formatDiff(beforeData.loadTime, afterData.loadTime)}`
    );
    console.log(
      `  DOM Ready:     ${beforeData.domContentLoaded}ms → ${afterData.domContentLoaded}ms  ${formatDiff(beforeData.domContentLoaded, afterData.domContentLoaded)}`
    );

    totalImprovement += beforeData.loadTime - afterData.loadTime;
    totalMetrics++;

    if (beforeData.firstContentfulPaint && afterData.firstContentfulPaint) {
      console.log(
        `  FCP:           ${beforeData.firstContentfulPaint}ms → ${afterData.firstContentfulPaint}ms  ${formatDiff(beforeData.firstContentfulPaint, afterData.firstContentfulPaint)}`
      );
    }

    if (beforeData.largestContentfulPaint && afterData.largestContentfulPaint) {
      console.log(
        `  LCP:           ${beforeData.largestContentfulPaint}ms → ${afterData.largestContentfulPaint}ms  ${formatDiff(beforeData.largestContentfulPaint, afterData.largestContentfulPaint)}`
      );
    }
  }

  console.log('\n' + '-'.repeat(70));
  console.log('OVERALL');
  const avgImprovement = totalMetrics > 0 ? Math.round(totalImprovement / totalMetrics) : 0;
  const icon = avgImprovement > 0 ? '🎉' : avgImprovement < 0 ? '😟' : '➖';
  console.log(`  ${icon} Average Load Time Change: ${avgImprovement > 0 ? '-' : '+'}${Math.abs(avgImprovement)}ms`);
  console.log('='.repeat(70) + '\n');
}

// Main
const args = process.argv.slice(2);

if (args.length === 2) {
  // Compare two specific files
  compare(args[0], args[1]);
} else if (args.length === 0) {
  // Compare latest-local files (before and current)
  const resultsDir = path.join(__dirname, 'benchmark-results');

  if (!fs.existsSync(resultsDir)) {
    console.error('No benchmark results found. Run `pnpm run benchmark` first.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(resultsDir)
    .filter((f) => f.startsWith('benchmark-local-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length < 2) {
    console.error('Need at least 2 benchmark results to compare. Run `pnpm run benchmark` again.');
    process.exit(1);
  }

  compare(files[1], files[0]); // Second most recent vs most recent
} else {
  console.log('Usage:');
  console.log('  pnpm run benchmark:compare                      # Compare two most recent results');
  console.log('  pnpm run benchmark:compare before.json after.json  # Compare specific files');
  process.exit(1);
}
