import _ from 'lodash';

import parseLocation from './lib/parselocation.js';
import replaceEnv from './lib/replaceEnv.js';
import { createChildScope } from './lib/scope.js';
import { promiseProps } from './lib/promise-utils.js';
import { buildRegistry } from './lib/functions/registry.js';
import { getBoolEnvOpt } from './lib/functions/helpers.js';
import type { RecurseContext } from './lib/functions/types.js';
import { MAX_RECURSE_DEPTH } from './lib/functions/types.js';

import type {
  IncludeOptions as TypeIncludeOptions,
  Scope,
  TemplateValue,
  TemplateDocument,
  TemplateObject,
} from './types/index.js';

// Re-export types
export type { TypeIncludeOptions as IncludeOptions, TemplateDocument, TemplateValue };

// Main function options
interface MainIncludeOptions {
  template?: TemplateValue;
  url: string;
  scope?: Scope;
  doEnv?: boolean;
  doEval?: boolean;
  inject?: Record<string, string>;
  doLog?: boolean;
  refNowIgnores?: string[];
  refNowIgnoreMissing?: boolean;
  refNowReturnType?: 'arn' | 'name';
}

// Build registry with recurse reference
let registry: ReturnType<typeof buildRegistry>;

async function recurse(ctx: RecurseContext): Promise<any> {
  const { base, cft, rootTemplate, caller, depth = 0, ...opts } = ctx;
  let { scope } = ctx;

  if (depth > MAX_RECURSE_DEPTH) {
    throw new Error(`Maximum recursion depth (${MAX_RECURSE_DEPTH}) exceeded at caller: ${caller}`);
  }

  if (opts.doLog) {
    console.log({ base, scope, cft, rootTemplate, caller, ...opts });
  }

  scope = createChildScope(scope);

  const nextDepth = depth + 1;

  if (Array.isArray(cft)) {
    return Promise.all(
      cft.map((o) => recurse({ base, scope, cft: o, rootTemplate, caller: 'recurse:isArray', depth: nextDepth, ...opts })),
    );
  }

  if (_.isPlainObject(cft)) {
    const obj = cft as TemplateObject;

    // Dispatch to registered handler
    for (const fnName of Object.keys(obj)) {
      const handler = registry.handlers[fnName];
      if (handler) {
        return handler({ ...ctx, scope, depth: nextDepth });
      }
    }

    // Process remaining properties (no Fn:: match)
    return promiseProps(
      _.mapValues(obj, (template, key) =>
        recurse({ base, scope, cft: template, key, rootTemplate, caller: 'recurse:isPlainObject:end', depth: nextDepth, ...opts }),
      ),
    );
  }

  if (cft === undefined) {
    return null;
  }

  return replaceEnv(cft, opts.inject, opts.doEnv) as TemplateValue;
}

// Initialize registry
registry = buildRegistry(recurse);

/**
 * Main entry point for cfn-include template processing
 */
export default async function include(options: MainIncludeOptions): Promise<any> {
  let { template } = options;
  const doEnv = getBoolEnvOpt(options.doEnv, 'CFN_INCLUDE_DO_ENV');
  const doEval = getBoolEnvOpt(options.doEval, 'CFN_INCLUDE_DO_EVAL');

  const base = parseLocation(options.url);
  const scope: Scope = options.scope || {};
  if (base.relative) throw new Error('url cannot be relative');

  const processedTemplate = !template
    ? registry.fnInclude({ ...options, base, scope, cft: options.url, doEnv, doEval })
    : template;

  const resolvedTemplate = await Promise.resolve(processedTemplate);
  return recurse({
    base,
    scope,
    cft: resolvedTemplate,
    rootTemplate: resolvedTemplate as TemplateDocument,
    doEnv,
    doEval,
    doLog: options.doLog,
    inject: options.inject,
    refNowIgnores: options.refNowIgnores,
    refNowIgnoreMissing: options.refNowIgnoreMissing,
  });
}
