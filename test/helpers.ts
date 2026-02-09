import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestCase, TestFile, CliTestFile } from './types.js';

// ESM dirname helper
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to test fixtures (legacy t/tests directory)
export const FIXTURES_DIR = path.join(__dirname, '..', 't', 'tests');
export const INCLUDES_DIR = path.join(__dirname, '..', 't', 'includes');
export const TEST_TEMPLATE_URL = `file://${path.join(__dirname, '..', 't')}/template.json`;

/**
 * Load a test file (JSON, YAML, or JS module).
 */
export async function loadTestFile(filename: string): Promise<TestFile> {
  const ext = path.extname(filename);
  const filepath = path.join(FIXTURES_DIR, filename);

  if (ext === '.js') {
    const module = await import(filepath);
    return module.default as TestFile;
  }

  // Import yaml loader from dist
  const { load } = await import('../dist/lib/yaml.js');
  const content = fs.readFileSync(filepath, 'utf8');
  return load(content) as TestFile;
}

/**
 * Load a CLI test file.
 */
export function loadCliTestFile(filename: string): CliTestFile {
  const filepath = path.join(FIXTURES_DIR, filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf8')) as CliTestFile;
}

/**
 * Environment variable helper - sets env vars, runs callback, then cleans up.
 */
export function withEnv<T>(env: Record<string, string> | undefined, fn: () => T): T {
  const originalEnv: Record<string, string | undefined> = {};

  if (env) {
    for (const [key, value] of Object.entries(env)) {
      originalEnv[key] = process.env[key];
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    if (env) {
      for (const key of Object.keys(env)) {
        if (originalEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = originalEnv[key];
        }
      }
    }
  }
}

/**
 * Async version of withEnv.
 */
export async function withEnvAsync<T>(
  env: Record<string, string> | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const originalEnv: Record<string, string | undefined> = {};

  if (env) {
    for (const [key, value] of Object.entries(env)) {
      originalEnv[key] = process.env[key];
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    if (env) {
      for (const key of Object.keys(env)) {
        if (originalEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = originalEnv[key];
        }
      }
    }
  }
}

/**
 * Reset common AWS environment variables.
 */
export function resetAwsEnv(): void {
  delete process.env.AWS_REGION;
  delete process.env.AWS_ACCOUNT_NUM;
  delete process.env.AWS_ACCOUNT_ID;
  delete process.env.AWS_STACK_NAME;
}

/**
 * Build include options from a test case.
 */
export function buildIncludeOptions(test: TestCase): Record<string, unknown> {
  const opts: Record<string, unknown> = {
    template: test.template,
    url: TEST_TEMPLATE_URL,
    doEnv: !!test.doEnv || false,
    doEval: !!test.doEval || false,
  };

  if (test.inject) {
    opts.inject = test.inject;
  }
  if (test.refNowIgnoreMissing !== undefined) {
    opts.refNowIgnoreMissing = test.refNowIgnoreMissing;
  }
  if (test.refNowIgnores) {
    opts.refNowIgnores = test.refNowIgnores;
  }

  return opts;
}
