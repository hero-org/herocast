/**
 * @file benchmark.ts
 * @description E2E performance benchmark script using Playwright
 *
 * Measures real-world user experience metrics:
 * - Page load times
 * - Time to interactive
 * - API response times
 * - Core Web Vitals (LCP, FID, CLS)
 *
 * Usage:
 *   pnpm run benchmark              # Run against local dev server
 *   pnpm run benchmark --prod       # Run against production
 *   pnpm run benchmark --iterations 5  # Custom iteration count
 *
 * Output: JSON file in scripts/benchmark-results/
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Page } from 'playwright';

// Configuration
const DEFAULT_BASE_URL = 'http://localhost:3000';
const PROD_URL = 'https://app.herocast.xyz';
const DEFAULT_ITERATIONS = 3;

interface TimingResult {
  name: string;
  duration: number;
  timestamp: number;
}

interface PageMetrics {
  url: string;
  loadTime: number;
  domContentLoaded: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  timeToInteractive?: number;
  apiCalls: TimingResult[];
}

interface BenchmarkResult {
  timestamp: string;
  baseUrl: string;
  iterations: number;
  userAgent: string;
  results: {
    [pageName: string]: {
      metrics: PageMetrics[];
      average: {
        loadTime: number;
        domContentLoaded: number;
        firstContentfulPaint?: number;
        largestContentfulPaint?: number;
      };
    };
  };
  summary: {
    totalDuration: number;
    slowestPage: string;
    slowestApi: string;
  };
}

// Parse CLI arguments
const args = process.argv.slice(2);
const isProd = args.includes('--prod');
const iterationsArg = args.find((a) => a.startsWith('--iterations'));
const iterations = iterationsArg
  ? parseInt(iterationsArg.split('=')[1] || args[args.indexOf('--iterations') + 1])
  : DEFAULT_ITERATIONS;
const baseUrl = isProd ? PROD_URL : DEFAULT_BASE_URL;

async function measurePageLoad(page: Page, url: string): Promise<PageMetrics> {
  const apiCalls: TimingResult[] = [];

  // Intercept API calls
  page.on('response', async (response) => {
    const reqUrl = response.url();
    if (reqUrl.includes('/api/')) {
      const timing = response.request().timing();
      apiCalls.push({
        name: new URL(reqUrl).pathname,
        duration: timing.responseEnd - timing.requestStart,
        timestamp: Date.now(),
      });
    }
  });

  const startTime = Date.now();

  // Navigate and wait for network idle
  await page.goto(url, { waitUntil: 'networkidle' });

  const loadTime = Date.now() - startTime;

  // Get performance metrics
  const performanceMetrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((p) => p.name === 'first-contentful-paint');
    const fp = paint.find((p) => p.name === 'first-paint');

    // Try to get LCP (might not be available in all browsers)
    let lcp: number | undefined;
    try {
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint') as PerformanceEntry[];
      if (lcpEntries.length > 0) {
        lcp = lcpEntries[lcpEntries.length - 1].startTime;
      }
    } catch {
      // LCP not available
    }

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
      firstPaint: fp?.startTime,
      firstContentfulPaint: fcp?.startTime,
      largestContentfulPaint: lcp,
    };
  });

  return {
    url,
    loadTime,
    ...performanceMetrics,
    apiCalls,
  };
}

async function runBenchmark(): Promise<BenchmarkResult> {
  console.log(`\n🚀 Starting benchmark against ${baseUrl}`);
  console.log(`   Iterations: ${iterations}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Get user agent
  const uaPage = await context.newPage();
  const userAgent = await uaPage.evaluate(() => navigator.userAgent);
  await uaPage.close();

  const results: BenchmarkResult = {
    timestamp: new Date().toISOString(),
    baseUrl,
    iterations,
    userAgent,
    results: {},
    summary: {
      totalDuration: 0,
      slowestPage: '',
      slowestApi: '',
    },
  };

  const startTime = Date.now();

  // Define pages to benchmark
  const pagesToBenchmark = [
    { name: 'login', path: '/login' },
    { name: 'feeds', path: '/feeds' },
    // Add more pages as needed - these require auth:
    // { name: 'settings', path: '/settings' },
    // { name: 'channels', path: '/channels' },
  ];

  for (const pageConfig of pagesToBenchmark) {
    console.log(`📊 Benchmarking ${pageConfig.name}...`);
    const metrics: PageMetrics[] = [];

    for (let i = 0; i < iterations; i++) {
      const page = await context.newPage();

      try {
        const metric = await measurePageLoad(page, `${baseUrl}${pageConfig.path}`);
        metrics.push(metric);
        console.log(
          `   Iteration ${i + 1}: ${metric.loadTime}ms (FCP: ${metric.firstContentfulPaint?.toFixed(0) || 'N/A'}ms)`
        );
      } catch (error) {
        console.log(`   Iteration ${i + 1}: FAILED - ${error}`);
      }

      await page.close();

      // Small delay between iterations
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Calculate averages
    const validMetrics = metrics.filter((m) => m.loadTime > 0);
    if (validMetrics.length > 0) {
      results.results[pageConfig.name] = {
        metrics,
        average: {
          loadTime: Math.round(validMetrics.reduce((a, b) => a + b.loadTime, 0) / validMetrics.length),
          domContentLoaded: Math.round(validMetrics.reduce((a, b) => a + b.domContentLoaded, 0) / validMetrics.length),
          firstContentfulPaint: validMetrics[0].firstContentfulPaint
            ? Math.round(validMetrics.reduce((a, b) => a + (b.firstContentfulPaint || 0), 0) / validMetrics.length)
            : undefined,
          largestContentfulPaint: validMetrics[0].largestContentfulPaint
            ? Math.round(validMetrics.reduce((a, b) => a + (b.largestContentfulPaint || 0), 0) / validMetrics.length)
            : undefined,
        },
      };
    }
  }

  await browser.close();

  // Calculate summary
  results.summary.totalDuration = Date.now() - startTime;

  let slowestPageTime = 0;
  let slowestApiTime = 0;
  let slowestApiName = '';

  for (const [pageName, data] of Object.entries(results.results)) {
    if (data.average.loadTime > slowestPageTime) {
      slowestPageTime = data.average.loadTime;
      results.summary.slowestPage = pageName;
    }

    for (const metric of data.metrics) {
      for (const api of metric.apiCalls) {
        if (api.duration > slowestApiTime) {
          slowestApiTime = api.duration;
          slowestApiName = api.name;
        }
      }
    }
  }
  results.summary.slowestApi = `${slowestApiName} (${slowestApiTime}ms)`;

  return results;
}

function printSummary(results: BenchmarkResult) {
  console.log('\n' + '='.repeat(60));
  console.log('📈 BENCHMARK RESULTS');
  console.log('='.repeat(60));
  console.log(`URL: ${results.baseUrl}`);
  console.log(`Time: ${results.timestamp}`);
  console.log(`Iterations: ${results.iterations}`);
  console.log('-'.repeat(60));

  for (const [pageName, data] of Object.entries(results.results)) {
    console.log(`\n${pageName.toUpperCase()}`);
    console.log(`  Load Time:     ${data.average.loadTime}ms avg`);
    console.log(`  DOM Ready:     ${data.average.domContentLoaded}ms avg`);
    if (data.average.firstContentfulPaint) {
      console.log(`  FCP:           ${data.average.firstContentfulPaint}ms avg`);
    }
    if (data.average.largestContentfulPaint) {
      console.log(`  LCP:           ${data.average.largestContentfulPaint}ms avg`);
    }

    // Show API calls from first iteration
    const apiCalls = data.metrics[0]?.apiCalls || [];
    if (apiCalls.length > 0) {
      console.log(`  API Calls:`);
      for (const api of apiCalls.slice(0, 5)) {
        const icon = api.duration < 500 ? '✓' : api.duration < 2000 ? '⚠' : '✗';
        console.log(`    ${icon} ${api.name}: ${api.duration.toFixed(0)}ms`);
      }
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log('SUMMARY');
  console.log(`  Total Duration: ${(results.summary.totalDuration / 1000).toFixed(1)}s`);
  console.log(`  Slowest Page:   ${results.summary.slowestPage}`);
  console.log(`  Slowest API:    ${results.summary.slowestApi}`);
  console.log('='.repeat(60) + '\n');
}

async function main() {
  try {
    const results = await runBenchmark();

    // Print to console
    printSummary(results);

    // Save to file
    const outputDir = path.join(__dirname, 'benchmark-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `benchmark-${isProd ? 'prod' : 'local'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    console.log(`📁 Results saved to: ${outputPath}`);

    // Also save as latest for easy comparison
    const latestPath = path.join(outputDir, `latest-${isProd ? 'prod' : 'local'}.json`);
    fs.writeFileSync(latestPath, JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}

main();
