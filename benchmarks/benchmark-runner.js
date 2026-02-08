/**
 * cfn-include Performance Benchmark Suite
 *
 * Measures:
 * - Template compilation times for various complexity levels
 * - Memory usage during compilation
 * - Nested template performance (1-deep, 3-deep, 10-deep)
 * - Fn::Map with varying array sizes (10, 100, 1000 items)
 * - Glob operations with varying file counts
 */

import { performance } from 'node:perf_hooks';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import include from '../index.js';
import * as yaml from '../lib/yaml.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

/**
 * Format memory usage in human-readable format
 */
function formatMemory(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Get memory usage
 */
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    rss: usage.rss,
  };
}

/**
 * Run a benchmark with memory tracking
 */
async function runBenchmark(name, fn, iterations = 5) {
  const results = [];

  // Warm up
  await fn();

  // Force GC if available
  if (global.gc) global.gc();

  const startMemory = getMemoryUsage();

  for (let i = 0; i < iterations; i++) {
    if (global.gc) global.gc();

    const start = performance.now();
    await fn();
    const end = performance.now();

    results.push(end - start);
  }

  const endMemory = getMemoryUsage();

  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  const min = Math.min(...results);
  const max = Math.max(...results);
  const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

  return {
    name,
    iterations,
    avg,
    min,
    max,
    memoryDelta,
    startMemory: startMemory.heapUsed,
    endMemory: endMemory.heapUsed,
  };
}

/**
 * Print benchmark result
 */
function printResult(result) {
  console.log(`${colors.cyan}${result.name}${colors.reset}`);
  console.log(`  Iterations: ${result.iterations}`);
  console.log(`  Average: ${colors.green}${formatDuration(result.avg)}${colors.reset}`);
  console.log(`  Min: ${formatDuration(result.min)}`);
  console.log(`  Max: ${formatDuration(result.max)}`);
  console.log(`  Memory Delta: ${formatMemory(result.memoryDelta)}`);
  console.log();
}

/**
 * Generate fixture templates
 */
function generateFixtures() {
  const fixturesDir = path.join(__dirname, 'fixtures');

  // Simple template
  const simple = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'Simple benchmark template',
    Resources: {
      MyBucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: 'my-simple-bucket',
        },
      },
    },
  };
  fs.writeFileSync(path.join(fixturesDir, 'simple.json'), JSON.stringify(simple, null, 2));

  // Template with Fn::Map (10 items)
  const map10 = {
    Resources: {
      'Fn::Merge': [
        {
          'Fn::Map': [
            Array.from({ length: 10 }, (_, i) => `item${i}`),
            '$',
            {
              'Bucket${$}': {
                Type: 'AWS::S3::Bucket',
                Properties: {
                  BucketName: { 'Fn::Sub': 'bucket-${$}' },
                },
              },
            },
          ],
        },
      ],
    },
  };
  fs.writeFileSync(path.join(fixturesDir, 'map-10.json'), JSON.stringify(map10, null, 2));

  // Template with Fn::Map (100 items)
  const map100 = {
    Resources: {
      'Fn::Merge': [
        {
          'Fn::Map': [
            Array.from({ length: 100 }, (_, i) => `item${i}`),
            '$',
            {
              'Bucket${$}': {
                Type: 'AWS::S3::Bucket',
                Properties: {
                  BucketName: { 'Fn::Sub': 'bucket-${$}' },
                },
              },
            },
          ],
        },
      ],
    },
  };
  fs.writeFileSync(path.join(fixturesDir, 'map-100.json'), JSON.stringify(map100, null, 2));

  // Template with Fn::Map (1000 items)
  const map1000 = {
    Resources: {
      'Fn::Merge': [
        {
          'Fn::Map': [
            Array.from({ length: 1000 }, (_, i) => `item${i}`),
            '$',
            {
              'Bucket${$}': {
                Type: 'AWS::S3::Bucket',
                Properties: {
                  BucketName: { 'Fn::Sub': 'bucket-${$}' },
                },
              },
            },
          ],
        },
      ],
    },
  };
  fs.writeFileSync(path.join(fixturesDir, 'map-1000.json'), JSON.stringify(map1000, null, 2));

  // Nested Map template (3-deep)
  const nestedMap3 = {
    Resources: {
      'Fn::Merge': [
        {
          'Fn::Map': [
            ['a', 'b', 'c'],
            'outer',
            {
              'Fn::Merge': [
                {
                  'Fn::Map': [
                    ['x', 'y', 'z'],
                    'middle',
                    {
                      'Fn::Merge': [
                        {
                          'Fn::Map': [
                            [1, 2, 3],
                            'inner',
                            {
                              'Resource${outer}${middle}${inner}': {
                                Type: 'AWS::S3::Bucket',
                                Properties: {
                                  BucketName: { 'Fn::Sub': 'bucket-${outer}-${middle}-${inner}' },
                                },
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
  fs.writeFileSync(path.join(fixturesDir, 'nested-map-3.json'), JSON.stringify(nestedMap3, null, 2));

  // Include chain base templates
  const include1 = {
    Level1: {
      'Fn::Include': 'file://' + path.join(fixturesDir, 'include-level2.json'),
    },
  };
  fs.writeFileSync(path.join(fixturesDir, 'include-level1.json'), JSON.stringify(include1, null, 2));

  const include2 = {
    Level2: {
      'Fn::Include': 'file://' + path.join(fixturesDir, 'include-level3.json'),
    },
  };
  fs.writeFileSync(path.join(fixturesDir, 'include-level2.json'), JSON.stringify(include2, null, 2));

  const include3 = {
    Level3: {
      Value: 'deepest-level',
    },
  };
  fs.writeFileSync(path.join(fixturesDir, 'include-level3.json'), JSON.stringify(include3, null, 2));

  // 10-deep include chain
  for (let i = 1; i <= 10; i++) {
    const content =
      i < 10
        ? { [`Level${i}`]: { 'Fn::Include': `file://${path.join(fixturesDir, `deep-include-level${i + 1}.json`)}` } }
        : { Level10: { Value: 'deepest' } };
    fs.writeFileSync(path.join(fixturesDir, `deep-include-level${i}.json`), JSON.stringify(content, null, 2));
  }

  // Create glob test files
  const globDir = path.join(fixturesDir, 'glob-test');
  if (!fs.existsSync(globDir)) fs.mkdirSync(globDir, { recursive: true });

  // 10 files for glob
  for (let i = 0; i < 10; i++) {
    fs.writeFileSync(
      path.join(globDir, `resource-${i}.json`),
      JSON.stringify({ [`Resource${i}`]: { Type: 'AWS::S3::Bucket' } }, null, 2),
    );
  }

  // 100 files for glob
  const globDir100 = path.join(fixturesDir, 'glob-test-100');
  if (!fs.existsSync(globDir100)) fs.mkdirSync(globDir100, { recursive: true });
  for (let i = 0; i < 100; i++) {
    fs.writeFileSync(
      path.join(globDir100, `resource-${i}.json`),
      JSON.stringify({ [`Resource${i}`]: { Type: 'AWS::S3::Bucket' } }, null, 2),
    );
  }

  // Complex template with multiple features
  const complex = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'Complex benchmark template',
    Parameters: {
      Environment: { Type: 'String', Default: 'dev' },
    },
    Resources: {
      'Fn::Merge': [
        {
          'Fn::Map': [
            ['web', 'api', 'worker'],
            'service',
            {
              '${service}Bucket': {
                Type: 'AWS::S3::Bucket',
                Properties: {
                  BucketName: { 'Fn::Sub': '${AWS::StackName}-${service}' },
                },
              },
            },
          ],
        },
        {
          'Fn::Map': [
            { 'Fn::Sequence': [1, 5] },
            'idx',
            {
              'Lambda${idx}': {
                Type: 'AWS::Lambda::Function',
                Properties: {
                  FunctionName: { 'Fn::Sub': 'function-${idx}' },
                },
              },
            },
          ],
        },
      ],
    },
    Outputs: {
      'Fn::Merge': [
        {
          'Fn::Map': [
            ['web', 'api', 'worker'],
            'service',
            {
              '${service}Output': {
                Value: { 'Fn::Ref': '${service}Bucket' },
                Export: { Name: { 'Fn::Sub': '${AWS::StackName}-${service}' } },
              },
            },
          ],
        },
      ],
    },
  };
  fs.writeFileSync(path.join(fixturesDir, 'complex.json'), JSON.stringify(complex, null, 2));

  console.log(`${colors.green}✓ Generated fixture templates${colors.reset}\n`);
}

/**
 * Main benchmark suite
 */
async function main() {
  console.log(`${colors.bright}cfn-include Performance Benchmark Suite${colors.reset}\n`);
  console.log(`Node.js ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}\n`);

  // Generate fixtures
  generateFixtures();

  const fixturesDir = path.join(__dirname, 'fixtures');
  const results = [];

  // 1. Simple template (baseline)
  results.push(
    await runBenchmark('Simple Template (baseline)', async () => {
      await include({
        template: yaml.load(fs.readFileSync(path.join(fixturesDir, 'simple.json'), 'utf8')),
        url: `file://${path.join(fixturesDir, 'simple.json')}`,
      });
    }),
  );
  printResult(results[results.length - 1]);

  // 2. Fn::Map with 10 items
  results.push(
    await runBenchmark('Fn::Map (10 items)', async () => {
      await include({
        template: yaml.load(fs.readFileSync(path.join(fixturesDir, 'map-10.json'), 'utf8')),
        url: `file://${path.join(fixturesDir, 'map-10.json')}`,
      });
    }),
  );
  printResult(results[results.length - 1]);

  // 3. Fn::Map with 100 items
  results.push(
    await runBenchmark('Fn::Map (100 items)', async () => {
      await include({
        template: yaml.load(fs.readFileSync(path.join(fixturesDir, 'map-100.json'), 'utf8')),
        url: `file://${path.join(fixturesDir, 'map-100.json')}`,
      });
    }),
  );
  printResult(results[results.length - 1]);

  // 4. Fn::Map with 1000 items
  results.push(
    await runBenchmark('Fn::Map (1000 items)', async () => {
      await include({
        template: yaml.load(fs.readFileSync(path.join(fixturesDir, 'map-1000.json'), 'utf8')),
        url: `file://${path.join(fixturesDir, 'map-1000.json')}`,
      });
    }),
  );
  printResult(results[results.length - 1]);

  // 5. Nested Map (3-deep)
  results.push(
    await runBenchmark('Nested Fn::Map (3-deep, 3x3x3=27 items)', async () => {
      await include({
        template: yaml.load(fs.readFileSync(path.join(fixturesDir, 'nested-map-3.json'), 'utf8')),
        url: `file://${path.join(fixturesDir, 'nested-map-3.json')}`,
      });
    }),
  );
  printResult(results[results.length - 1]);

  // 6. Include chain (3-deep)
  results.push(
    await runBenchmark('Fn::Include chain (3-deep)', async () => {
      await include({
        template: yaml.load(fs.readFileSync(path.join(fixturesDir, 'include-level1.json'), 'utf8')),
        url: `file://${path.join(fixturesDir, 'include-level1.json')}`,
      });
    }),
  );
  printResult(results[results.length - 1]);

  // 7. Include chain (10-deep)
  results.push(
    await runBenchmark('Fn::Include chain (10-deep)', async () => {
      await include({
        template: yaml.load(fs.readFileSync(path.join(fixturesDir, 'deep-include-level1.json'), 'utf8')),
        url: `file://${path.join(fixturesDir, 'deep-include-level1.json')}`,
      });
    }),
  );
  printResult(results[results.length - 1]);

  // 8. Glob with 10 files
  const glob10Template = {
    Resources: {
      'Fn::Merge': [
        {
          'Fn::Include': {
            location: path.join(fixturesDir, 'glob-test', '*.json'),
            isGlob: true,
          },
        },
      ],
    },
  };
  results.push(
    await runBenchmark('Glob (10 files)', async () => {
      await include({
        template: glob10Template,
        url: `file://${fixturesDir}/glob-benchmark.json`,
      });
    }),
  );
  printResult(results[results.length - 1]);

  // 9. Glob with 100 files
  const glob100Template = {
    Resources: {
      'Fn::Merge': [
        {
          'Fn::Include': {
            location: path.join(fixturesDir, 'glob-test-100', '*.json'),
            isGlob: true,
          },
        },
      ],
    },
  };
  results.push(
    await runBenchmark('Glob (100 files)', async () => {
      await include({
        template: glob100Template,
        url: `file://${fixturesDir}/glob-benchmark.json`,
      });
    }),
  );
  printResult(results[results.length - 1]);

  // 10. Complex template
  results.push(
    await runBenchmark('Complex template (mixed features)', async () => {
      await include({
        template: yaml.load(fs.readFileSync(path.join(fixturesDir, 'complex.json'), 'utf8')),
        url: `file://${path.join(fixturesDir, 'complex.json')}`,
      });
    }),
  );
  printResult(results[results.length - 1]);

  // Summary
  console.log(`${colors.bright}Summary${colors.reset}`);
  console.log('─'.repeat(60));

  const baselineAvg = results[0].avg;
  for (const r of results) {
    const ratio = r.avg / baselineAvg;
    const ratioColor = ratio > 10 ? colors.red : ratio > 3 ? colors.yellow : colors.green;
    console.log(
      `${r.name.padEnd(40)} ${colors.green}${formatDuration(r.avg).padStart(12)}${colors.reset} ` +
        `(${ratioColor}${ratio.toFixed(1)}x${colors.reset})`,
    );
  }

  // Write results to JSON
  const jsonResults = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    results: results.map((r) => ({
      name: r.name,
      avgMs: r.avg,
      minMs: r.min,
      maxMs: r.max,
      memoryDeltaBytes: r.memoryDelta,
    })),
  };

  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(jsonResults, null, 2));
  console.log(`\n${colors.green}✓ Results saved to benchmarks/results.json${colors.reset}`);
}

main().catch(console.error);
