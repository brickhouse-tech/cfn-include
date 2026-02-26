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
 * Check if AWS credentials are available.
 * Tests will be skipped if no credentials are found.
 */
function hasAwsCredentials(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_PROFILE ||
    process.env.AWS_SESSION_TOKEN
  );
}

/**
 * Use Node's assert.deepEqual for backwards compatibility with legacy test fixtures.
 * This allows type coercion (1 == "1") which some test fixtures rely on.
 */
function assertDeepEqual(actual: unknown, expected: unknown): void {
  assert.deepEqual(actual, expected);
}

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

// Skip all S3 tests if AWS credentials are not available
describe.skipIf(!hasAwsCredentials())('s3.json - S3 includes', async () => {
  let testFile: TestFile;

  try {
    testFile = await loadTestFile('s3.json');
  } catch (err) {
    // Create a failing test if file can't be loaded
    it('should load s3.json test file', () => {
      throw err;
    });
    // Exit early since we can't generate tests
    return;
  }

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
