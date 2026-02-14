import { describe, it, expect, beforeEach } from 'vitest';
import assert from 'node:assert';
import {
  loadTestFile,
  withEnvAsync,
  resetAwsEnv,
  buildIncludeOptions,
  TEST_TEMPLATE_URL,
} from './helpers.js';
import type { TestCase, TestFile } from './types.js';

// Import the include function from dist
import include from '../dist/index.js';

/**
 * Use Node's assert.deepEqual for backwards compatibility with legacy test fixtures.
 * This allows type coercion (1 == "1") which some test fixtures rely on.
 * TODO: Fix test fixtures to use correct types and switch to strict equality.
 */
function assertDeepEqual(actual: unknown, expected: unknown): void {
  assert.deepEqual(actual, expected);
}

// List of test fixture files
const TEST_FILES = [
  'inject.json',
  'globs.json',
  'location.json',
  'literal.json',
  'string.json',
  'map.json',
  'flatten.json',
  'jmespath.json',
  'merge.json',
  'errors.js',
  'yaml.js',
  'stringify.json',
  'env.js',
  'outputs.json',
  'camelcase.yml',
  'jmespath.yml',
  'lodash.yml',
  'sequence.yml',
  'deepmerge.yml',
  'extendedmaps.json',
  'omit.json',
  'omitEmpty.json',
  'ifeval.js',
  'eval.js',
  'amzn-intrinsic.yml',
  'joinNow.yml',
  'subNow.yml',
  'refNow.js',
  'applyTags.yml',
  'regression.js',
];

// Set README env var used by some tests
process.env.README = 'readme';

/**
 * Run a single test case.
 */
async function runTestCase(test: TestCase): Promise<void> {
  const opts = buildIncludeOptions(test);

  await withEnvAsync(test.doEnv, async () => {
    try {
      const result = await include(opts);

      // Success path - validate output
      if (test.outputFn) {
        expect(test.outputFn(result)).toBe(true);
      } else if (typeof test.output === 'function') {
        // Legacy support for output as function
        expect((test.output as (r: unknown) => boolean)(result)).toBe(true);
      } else if (test.output !== undefined) {
        // Use loose equality for backwards compatibility with legacy test fixtures
        // that have type mismatches (e.g., expecting "1" but getting 1)
        assertDeepEqual(result, test.output);
      } else if (test.catch && !test.output) {
        // Test has only catch handler (no output) - was expected to throw but didn't
        throw new Error('Expected test to throw an error');
      }
    } catch (err) {
      if (test.catch) {
        expect(test.catch(err as Error)).toBe(true);
      } else {
        throw err;
      }
    }
  });
}

/**
 * Generate tests from a test file.
 */
function generateTests(filename: string, testFile: TestFile): void {
  describe(filename, () => {
    beforeEach(() => {
      resetAwsEnv();
    });

    for (const category of Object.keys(testFile)) {
      describe(category, () => {
        for (const test of testFile[category]) {
          const testFn = test.only ? it.only : test.skip ? it.skip : it;

          testFn(test.name || 'include', async () => {
            await runTestCase(test);
          });
        }
      });
    }
  });
}

// Dynamically load and generate tests for each fixture file
describe('cfn-include', async () => {
  for (const file of TEST_FILES) {
    try {
      const testFile = await loadTestFile(file);
      generateTests(file, testFile);
    } catch (err) {
      // Create a failing test if file can't be loaded
      describe(file, () => {
        it('should load test file', () => {
          throw err;
        });
      });
    }
  }
});
