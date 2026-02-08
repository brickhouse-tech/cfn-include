/**
 * cfn-include Options Type Definitions
 */

import type { TemplateDocument, TemplateValue } from './template.js';

/**
 * Options for the main include function
 */
export interface IncludeOptions {
  /** JSON/YAML template object (optional if url points to loadable file) */
  template?: TemplateValue;
  /** URL to template file (file://, s3://, http://, https://) */
  url: string;
  /** Enable environment variable substitution */
  doEnv?: boolean;
  /** Enable Fn::Eval (dangerous - allows JS eval) */
  doEval?: boolean;
  /** Variables to inject into template */
  inject?: Record<string, string>;
  /** Enable debug logging */
  doLog?: boolean;
  /** Logical resource IDs to ignore when resolving Fn::RefNow */
  refNowIgnores?: string[];
  /** If true, return Ref syntax for unresolvable references instead of throwing */
  refNowIgnoreMissing?: boolean;
  /** Root template for Fn::RefNow resource lookups */
  rootTemplate?: TemplateDocument;
  /** Internal: scope variables for Fn::Map */
  scope?: Scope;
  /** Return type for Fn::RefNow */
  refNowReturnType?: 'arn' | 'name';
}

/**
 * Options passed through the recursive processing
 */
export interface RecurseOptions extends Omit<IncludeOptions, 'template' | 'url' | 'scope'> {
  /** Current key being processed (for context-sensitive behavior) */
  key?: string;
  /** Calling function name (for debug logging) */
  caller?: string;
}

/**
 * Scope object for variable substitution in Fn::Map
 * Uses prototype chain for efficient child scope creation
 */
export interface Scope {
  [key: string]: unknown;
}

/**
 * Parsed location from URL
 */
export interface ParsedLocation {
  protocol?: string;
  host?: string;
  path?: string;
  relative: boolean;
  raw?: string;
}

/**
 * Base context for recursive processing
 */
export interface BaseContext {
  /** Parsed URL components */
  base: ParsedLocation;
  /** Current scope for variable substitution */
  scope: Scope;
  /** Current CloudFormation template being processed */
  cft: TemplateValue;
  /** Root template for reference lookups */
  rootTemplate?: TemplateDocument;
}

/**
 * Full context for recursive processing
 */
export interface ProcessContext extends BaseContext, RecurseOptions {}

/**
 * AWS pseudo-parameters that can be resolved
 */
export interface AwsPseudoParameters {
  'AWS::AccountId': string;
  'AWS::Partition': string;
  'AWS::Region': string;
  'AWS::StackId': string;
  'AWS::StackName': string;
  'AWS::URLSuffix': string;
  'AWS::NotificationARNs': string;
}
