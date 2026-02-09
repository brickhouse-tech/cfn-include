/**
 * Test case definition for cfn-include tests.
 */
export interface TestCase {
  /** Test name */
  name: string;
  /** Input template */
  template: unknown;
  /** Expected output */
  output?: unknown;
  /** Injected variables */
  inject?: Record<string, unknown>;
  /** Environment variables to set during test */
  doEnv?: Record<string, string>;
  /** Enable environment variable replacement */
  doEval?: boolean;
  /** Options for Fn::RefNow */
  refNowIgnoreMissing?: boolean;
  refNowIgnores?: string[];
  /** Error handler for tests expected to fail */
  catch?: (err: Error) => boolean;
  /** Output validation function for complex assertions */
  outputFn?: (result: unknown) => boolean;
  /** Mark test as only (focused) */
  only?: boolean;
  /** Mark test as skipped */
  skip?: boolean;
}

/**
 * Test file structure - categories containing test cases.
 */
export interface TestFile {
  [category: string]: TestCase[];
}

/**
 * CLI test case definition.
 */
export interface CliTestCase {
  name: string;
  template?: string;
  args?: string[];
  stdin?: string;
  env?: Record<string, string>;
  output?: unknown;
  exitCode?: number;
  errorMessage?: string;
  only?: boolean;
  skip?: boolean;
}

/**
 * CLI test file structure.
 */
export interface CliTestFile {
  [category: string]: CliTestCase[];
}
