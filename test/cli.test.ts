import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCliTestFile, withEnvAsync } from './helpers.js';
import type { CliTestCase } from './types.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// Load CLI test fixtures
const cliTests = loadCliTestFile('cli.json');

/**
 * Run a CLI test case.
 */
async function runCliTest(test: CliTestCase): Promise<void> {
  const cliPath = path.join(PROJECT_ROOT, 'bin', 'cli.js');
  let args = test.template ? [cliPath, test.template] : [cliPath];

  if (test.args) {
    args = args.concat(test.args);
  }

  await withEnvAsync(test.env, async () => {
    try {
      const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const proc = execFile('node', args, (err, stdout, stderr) => {
          if (err && test.exitCode) {
            // Expected error
            resolve({ stdout: stdout?.toString() || '', stderr: stderr?.toString() || '' });
          } else if (err) {
            reject(err);
          } else {
            resolve({ stdout: stdout?.toString() || '', stderr: stderr?.toString() || '' });
          }
        });

        if (test.stdin) {
          proc.stdin?.write(test.stdin);
          proc.stdin?.end();
        }
      });

      if (test.exitCode) {
        expect(result.stderr).toMatch(new RegExp(test.errorMessage || ''));
      } else {
        const json = JSON.parse(result.stdout || '{}');
        delete json.Metadata;
        expect(json).toEqual(test.output);
      }
    } catch (err: unknown) {
      if (test.exitCode && err && typeof err === 'object' && 'code' in err) {
        expect((err as { code: number }).code).toBe(test.exitCode);
      } else {
        throw err;
      }
    }
  });
}

describe('CLI', () => {
  for (const category of Object.keys(cliTests)) {
    describe(category, () => {
      for (const test of cliTests[category]) {
        const testFn = test.only ? it.only : test.skip ? it.skip : it;

        testFn(test.name || 'cli', async () => {
          await runCliTest(test);
        });
      }
    });
  }
});
