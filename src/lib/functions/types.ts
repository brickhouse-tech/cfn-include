import type { ParsedLocation, Scope, TemplateValue, TemplateDocument, TemplateObject } from '../../types/index.js';

export interface RecurseContext {
  base: ParsedLocation;
  scope: Scope;
  cft: TemplateValue;
  rootTemplate?: TemplateDocument;
  caller?: string;
  key?: string;
  doEnv?: boolean;
  doEval?: boolean;
  doLog?: boolean;
  inject?: Record<string, string>;
  refNowIgnores?: string[];
  refNowIgnoreMissing?: boolean;
  refNowReturnType?: 'arn' | 'name';
}

export interface FnIncludeContext extends Omit<RecurseContext, 'cft'> {
  cft: TemplateValue;
}

export interface FnIncludeArgs {
  location?: string;
  type?: 'json' | 'string' | 'literal';
  query?: string | TemplateValue;
  parser?: string;
  context?: Record<string, TemplateValue>;
  inject?: Record<string, string>;
  isGlob?: boolean;
  ignoreMissingVar?: boolean;
  ignoreMissingFile?: boolean;
  doEnv?: boolean;
  doEval?: boolean;
  doLog?: boolean;
  refNowIgnores?: string[];
  refNowIgnoreMissing?: boolean;
}

export type RecurseFn = (ctx: RecurseContext) => Promise<any>;
export type FnIncludeFn = (ctx: FnIncludeContext) => Promise<any>;
export type FnHandler = (ctx: RecurseContext) => Promise<any>;

export type { ParsedLocation, Scope, TemplateValue, TemplateDocument, TemplateObject };
