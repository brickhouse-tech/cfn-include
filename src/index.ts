import url from 'node:url';
import path from 'node:path';
import _ from 'lodash';
import { glob } from 'glob';
import sortObject from '@znemz/sort-object';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { addProxyToClient } from 'aws-sdk-v3-proxy';
import deepMerge from 'deepmerge';
import { isTaggableResource } from '@znemz/cft-utils/src/resources/taggable.js';

import request from './lib/request.js';
import * as PromiseExt from './lib/promise.js';
import * as yaml from './lib/yaml.js';
import { getParser } from './lib/include/query.js';
import parseLocation from './lib/parselocation.js';
import replaceEnv from './lib/replaceEnv.js';
import { lowerCamelCase, upperCamelCase } from './lib/utils.js';
import { isOurExplicitFunction } from './lib/schema.js';
import { getAwsPseudoParameters, buildResourceArn } from './lib/internals.js';
import { cachedReadFile } from './lib/cache.js';
import { createChildScope } from './lib/scope.js';
import { promiseProps } from './lib/promise-utils.js';

import type {
  IncludeOptions as TypeIncludeOptions,
  ParsedLocation,
  Scope,
  TemplateValue,
  TemplateDocument,
  TemplateObject,
  Resource,
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

const S3 = (opts = {}) => addProxyToClient(new S3Client(opts), { throwOnNoProxy: false });
const s3 = S3();

interface RecurseContext {
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

interface FnIncludeContext extends Omit<RecurseContext, 'cft'> {
  cft: TemplateValue;
}

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
    ? fnInclude({ ...options, base, scope, cft: options.url, doEnv, doEval })
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

/**
 * Recursively process CloudFormation template, handling all Fn:: intrinsics
 */
async function recurse(ctx: RecurseContext): Promise<any> {
  const { base, cft, rootTemplate, caller, ...opts } = ctx;
  let { scope } = ctx;

  if (opts.doLog) {
    console.log({ base, scope, cft, rootTemplate, caller, ...opts });
  }

  scope = createChildScope(scope);

  if (Array.isArray(cft)) {
    return Promise.all(
      cft.map((o) => recurse({ base, scope, cft: o, rootTemplate, caller: 'recurse:isArray', ...opts })),
    );
  }

  if (_.isPlainObject(cft)) {
    const obj = cft as TemplateObject;

    if (obj['Fn::Map']) {
      return handleFnMap({ base, scope, cft: obj, rootTemplate, ...opts });
    }

    if (obj['Fn::Length']) {
      const arg = obj['Fn::Length'];
      if (Array.isArray(arg)) {
        return arg.length;
      }
      const result = await recurse({ base, scope, cft: arg, rootTemplate, caller: 'Fn::Length', ...opts });
      return Array.isArray(result) ? result.length : 0;
    }

    if (obj['Fn::Include']) {
      const json = await fnInclude({ base, scope, cft: obj['Fn::Include'], ...opts });
      if (!_.isPlainObject(json)) return json;
      delete obj['Fn::Include'];
      _.defaults(obj, json);
      const replaced = findAndReplace(scope, obj) as any;
      return recurse({ base, scope, cft: replaced, rootTemplate, caller: 'Fn::Include', ...opts });
    }

    if (obj['Fn::Flatten']) {
      const json = await recurse({ base, scope, cft: obj['Fn::Flatten'], rootTemplate, caller: 'Fn::Flatten', ...opts });
      return (json as unknown[]).flat();
    }

    if (obj['Fn::FlattenDeep']) {
      const json = await recurse({ base, scope, cft: obj['Fn::FlattenDeep'], rootTemplate, caller: 'Fn::FlattenDeep', ...opts });
      return (json as unknown[]).flat(Infinity);
    }

    if (obj['Fn::Uniq']) {
      const json = await recurse({ base, scope, cft: obj['Fn::Uniq'], rootTemplate, caller: 'Fn::Uniq', ...opts });
      return [...new Set(json as unknown[])];
    }

    if (obj['Fn::Compact']) {
      const json = await recurse({ base, scope, cft: obj['Fn::Compact'], rootTemplate, caller: 'Fn::Compact', ...opts });
      return (json as unknown[]).filter(Boolean);
    }

    if (obj['Fn::Concat']) {
      const json = await recurse({ base, scope, cft: obj['Fn::Concat'], rootTemplate, caller: 'Fn::Concat', ...opts });
      return _.concat(...(json as unknown[][]));
    }

    if (obj['Fn::Sort']) {
      const array = await recurse({ base, scope, cft: obj['Fn::Sort'], rootTemplate, caller: 'Fn::Sort', ...opts });
      return (array as unknown[]).sort();
    }

    if (obj['Fn::SortedUniq']) {
      const array = await recurse({ base, scope, cft: obj['Fn::SortedUniq'], rootTemplate, caller: 'Fn::SortedUniq', ...opts });
      return _.sortedUniq((array as unknown[]).sort());
    }

    if (obj['Fn::SortBy']) {
      const { list, iteratees } = await recurse({ base, scope, cft: obj['Fn::SortBy'], rootTemplate, caller: 'Fn::SortBy', ...opts }) as { list: unknown[]; iteratees: string | string[] };
      return _.sortBy(list, iteratees);
    }

    if (obj['Fn::SortObject']) {
      const result = await recurse({ base, scope, cft: obj['Fn::SortObject'], rootTemplate, caller: 'Fn::SortObject', ...opts }) as { object?: unknown; options?: Record<string, unknown> };
      const { object, options: sortOpts, ...rest } = result;
      return sortObject(object || rest, sortOpts);
    }

    if (obj['Fn::Without']) {
      const json = await recurse({ base, scope, cft: obj['Fn::Without'], rootTemplate, caller: 'Fn::Without', ...opts });
      const normalized = Array.isArray(json) ? { list: json[0] as unknown[], withouts: json[1] as unknown[] } : json as { list: unknown[]; withouts: unknown[] };
      return _.without(normalized.list, ...normalized.withouts);
    }

    if (obj['Fn::Omit']) {
      const json = await recurse({ base, scope, cft: obj['Fn::Omit'], rootTemplate, caller: 'Fn::Omit', ...opts });
      const normalized = Array.isArray(json) ? { object: json[0] as Record<string, unknown>, omits: json[1] as string[] } : json as { object: Record<string, unknown>; omits: string[] };
      return _.omit(normalized.object, normalized.omits);
    }

    if (obj['Fn::OmitEmpty']) {
      const json = await recurse({ base, scope, cft: obj['Fn::OmitEmpty'], rootTemplate, caller: 'Fn::OmitEmpty', ...opts }) as Record<string, unknown>;
      return _.omitBy(json, (v) => !v && v !== false && v !== 0);
    }

    if (obj['Fn::Eval']) {
      if (!opts.doEval) {
        return Promise.reject(new Error('Fn::Eval is not allowed doEval is falsy'));
      }
      const json = await recurse({ base, scope, cft: obj['Fn::Eval'], rootTemplate, caller: 'Fn::Eval', ...opts }) as { state?: unknown; script: string; inject?: Record<string, string>; doLog?: boolean };
      let { script } = json;
      const { state, inject, doLog } = json;
      script = replaceEnv(script, _.merge(_.cloneDeep(opts.inject), inject), opts.doEnv) as string;
      if (doLog) {
        console.log({ state, script, inject });
      }
      // eslint-disable-next-line no-eval
      return eval(script);
    }

    if (obj['Fn::Filenames']) {
      return handleFnFilenames({ base, scope, cft: obj['Fn::Filenames'], rootTemplate, ...opts });
    }

    if (obj['Fn::Merge']) {
      const json = await recurse({ base, scope, cft: obj['Fn::Merge'], rootTemplate, caller: 'Fn::Merge', ...opts }) as unknown[];
      delete obj['Fn::Merge'];
      return recurse({ base, scope, cft: _.defaults(obj, _.merge.apply(_, json as [object, ...object[]])), rootTemplate, caller: 'Fn::Merge', ...opts });
    }

    if (obj['Fn::DeepMerge']) {
      const json = await recurse({ base, scope, cft: obj['Fn::DeepMerge'], rootTemplate, caller: 'Fn::DeepMerge', ...opts }) as unknown[];
      delete obj['Fn::DeepMerge'];
      let mergedObj = {};
      if (json?.length) {
        for (const j of json) {
          mergedObj = deepMerge(mergedObj, j as object);
        }
      }
      return recurse({ base, scope, cft: _.defaults(obj, mergedObj), rootTemplate, caller: 'Fn::DeepMerge', ...opts });
    }

    if (obj['Fn::ObjectKeys']) {
      const json = await recurse({ base, scope, cft: obj['Fn::ObjectKeys'], rootTemplate, caller: 'Fn::ObjectKeys', ...opts });
      return Object.keys(json as object);
    }

    if (obj['Fn::ObjectValues']) {
      const json = await recurse({ base, scope, cft: obj['Fn::ObjectValues'], rootTemplate, caller: 'Fn::ObjectValues', ...opts });
      return Object.values(json as object);
    }

    if (obj['Fn::Stringify']) {
      const json = await recurse({ base, scope, cft: obj['Fn::Stringify'], rootTemplate, caller: 'Fn::Stringify', ...opts });
      return JSON.stringify(json);
    }

    if (obj['Fn::StringSplit']) {
      const { string = '', separator = ',', doLog } = await recurse({ base, scope, cft: obj['Fn::StringSplit'], rootTemplate, caller: 'Fn::StringSplit', ...opts }) as { string?: string; separator?: string; doLog?: boolean };
      if (doLog) console.log({ string, separator });
      return string.split(separator);
    }

    if (obj['Fn::UpperCamelCase']) {
      return upperCamelCase(obj['Fn::UpperCamelCase'] as string);
    }

    if (obj['Fn::LowerCamelCase']) {
      return lowerCamelCase(obj['Fn::LowerCamelCase'] as string);
    }

    if (obj['Fn::GetEnv']) {
      const args = obj['Fn::GetEnv'];
      if (Array.isArray(args)) {
        const val = process.env[args[0] as string];
        return val === undefined ? args[1] : val;
      }
      const val = process.env[args as string];
      if (val === undefined) {
        throw new Error(`environmental variable ${args} is undefined`);
      }
      return val;
    }

    if (obj['Fn::Outputs']) {
      return handleFnOutputs({ base, scope, cft: obj['Fn::Outputs'], rootTemplate, ...opts });
    }

    if (obj['Fn::Sequence']) {
      return handleFnSequence({ base, scope, cft: obj['Fn::Sequence'], rootTemplate, ...opts });
    }

    if (obj['Fn::IfEval']) {
      return handleFnIfEval({ base, scope, cft: obj['Fn::IfEval'], rootTemplate, ...opts });
    }

    if (obj['Fn::JoinNow']) {
      const array = await recurse({ base, scope, cft: obj['Fn::JoinNow'], rootTemplate, caller: 'Fn::JoinNow', ...opts }) as [string, unknown[]];
      let [delimiter, toJoinArray] = array;
      delimiter = replaceEnv(delimiter, opts.inject, opts.doEnv) as string;
      return toJoinArray.join(delimiter);
    }

    if (obj['Fn::SubNow']) {
      return handleFnSubNow({ base, scope, cft: obj['Fn::SubNow'], rootTemplate, ...opts });
    }

    if (obj['Fn::RefNow']) {
      return handleFnRefNow({ base, scope, cft: obj['Fn::RefNow'], rootTemplate, ...opts });
    }

    if (obj['Fn::ApplyTags']) {
      return handleFnApplyTags({ base, scope, cft: obj['Fn::ApplyTags'], rootTemplate, ...opts });
    }

    // Process remaining properties
    return promiseProps(
      _.mapValues(obj, (template, key) =>
        recurse({ base, scope, cft: template, key, rootTemplate, caller: 'recurse:isPlainObject:end', ...opts }),
      ),
    );
  }

  if (cft === undefined) {
    return null;
  }

  return replaceEnv(cft, opts.inject, opts.doEnv) as TemplateValue;
}

// Handler functions for complex Fn:: intrinsics

async function handleFnMap(ctx: RecurseContext): Promise<any> {
  const { base, scope, cft, rootTemplate, ...opts } = ctx;
  const obj = cft as TemplateObject;
  const args = obj['Fn::Map'] as unknown[];
  const [list] = args;
  const body = args[args.length - 1];
  let placeholder = args[1] as string | string[];
  let idx: string | undefined;
  let sz: string | undefined;
  let hasindex = false;
  let hassize = false;

  if (Array.isArray(placeholder)) {
    idx = placeholder[1];
    hasindex = true;
    if (placeholder.length > 2) {
      sz = placeholder[2];
      hassize = true;
    }
    placeholder = placeholder[0];
  }
  if (args.length === 2) {
    placeholder = '_';
  }

  let result: any = await PromiseExt.mapX(
    recurse({ base, scope, cft: list as any, rootTemplate, caller: 'Fn::Map', ...opts }),
    (replace, key) => {
      const additions: Record<string, unknown> = { [placeholder as string]: replace };
      if (hasindex && idx) {
        additions[idx] = key;
      }
      const childScope = createChildScope(scope, additions);
      const replaced = findAndReplace(childScope, _.cloneDeep(body)) as any;
      return recurse({ base, scope: childScope, cft: replaced, rootTemplate, caller: 'Fn::Map', ...opts });
    },
  );

  if (hassize && sz) {
    result = findAndReplace({ [sz]: result.length }, result) as any;
  }
  return recurse({ base, scope, cft: result, rootTemplate, caller: 'Fn::Map', ...opts });
}

async function handleFnFilenames(ctx: RecurseContext): Promise<any> {
  const { base, scope, cft, rootTemplate, ...opts } = ctx;
  const json = await recurse({ base, scope, cft, rootTemplate, caller: 'Fn::Filenames', ...opts });
  const normalized = _.isPlainObject(json) ? { ...(json as object) } : { location: json };
  const { location: loc, omitExtension, doLog } = normalized as { location: unknown; omitExtension?: boolean; doLog?: boolean };

  if (doLog) console.log(normalized);

  const location = parseLocation(loc as string);
  if (!_.isEmpty(location) && !location.protocol) {
    location.protocol = base.protocol;
  }

  if (location.protocol === 'file') {
    const absolute = location.relative
      ? path.join(path.dirname(base.path || ''), location.host || '', location.path || '')
      : [location.host, location.path].join('');
    const globs = (await glob(absolute)).sort();
    if (omitExtension) {
      return globs.map((f) => path.basename(f, path.extname(f)));
    }
    return globs;
  }
  return 'Unsupported File Type';
}

async function handleFnOutputs(ctx: RecurseContext): Promise<any> {
  const { base, scope, cft, ...opts } = ctx;
  const outputs = await recurse({ base, scope, cft, caller: 'Fn::Outputs', ...opts }) as Record<string, TemplateValue>;
  const result: Record<string, unknown> = {};

  for (const output in outputs) {
    const val = outputs[output];
    const exp = {
      Export: { Name: { 'Fn::Sub': '${AWS::StackName}:' + output } },
    };
    if (!Array.isArray(val) && typeof val === 'object' && val !== null) {
      const objVal = val as { Value?: unknown; Condition?: unknown };
      result[output] = {
        Value: { 'Fn::Sub': objVal.Value },
        Condition: objVal.Condition,
        ...exp,
      };
    } else {
      result[output] = {
        Value: { 'Fn::Sub': val },
        ...exp,
      };
    }
  }
  return result;
}

async function handleFnSequence(ctx: RecurseContext): Promise<any> {
  const { base, scope, cft, ...opts } = ctx;
  const outputs = await recurse({ base, scope, cft, caller: 'Fn::Sequence', ...opts }) as [number | string, number | string, number?];

  let [start, stop, step = 1] = outputs;
  const isString = typeof start === 'string';
  if (isString) {
    start = (start as string).charCodeAt(0);
    stop = (stop as string).charCodeAt(0);
  }
  const seq = Array.from(
    { length: Math.floor(((stop as number) - (start as number)) / step) + 1 },
    (__, i) => (start as number) + i * step,
  );
  return isString ? seq.map((i) => String.fromCharCode(i)) : seq;
}

async function handleFnIfEval(ctx: RecurseContext): Promise<any> {
  const { base, scope, cft, rootTemplate, ...opts } = ctx;
  if (!opts.doEval) {
    return Promise.reject(new Error('Fn::IfEval is not allowed doEval is falsy'));
  }
  const json = await recurse({ base, scope, cft, rootTemplate, caller: 'Fn::IfEval', ...opts }) as {
    truthy?: TemplateValue;
    falsy?: TemplateValue;
    evalCond?: string;
    inject?: Record<string, string>;
    doLog?: boolean;
  };

  let { truthy = '', falsy = '', evalCond, inject, doLog } = json;
  if (!evalCond) {
    return Promise.reject(new Error('Fn::IfEval evalCond is required'));
  }
  evalCond = `(${evalCond})`;

  evalCond = replaceEnv(evalCond, _.merge(_.cloneDeep(opts.inject), inject), opts.doEnv) as string;
  truthy = replaceEnv(truthy, _.merge(_.cloneDeep(opts.inject), inject), opts.doEnv) as TemplateValue;
  if (falsy) {
    falsy = replaceEnv(falsy, _.merge(_.cloneDeep(opts.inject), inject), opts.doEnv) as TemplateValue;
  }

  // eslint-disable-next-line no-eval
  const condResult = eval(evalCond);

  if (doLog) {
    console.log({ truthy, falsy, inject, evalCond, condResult });
  }

  if (condResult) {
    return recurse({ base, scope, cft: truthy, rootTemplate, caller: 'Fn::IfEval', ...opts });
  }
  return recurse({ base, scope, cft: falsy, rootTemplate, caller: 'Fn::IfEval', ...opts });
}

async function handleFnSubNow(ctx: RecurseContext): Promise<any> {
  const { base, scope, cft, rootTemplate, ...opts } = ctx;
  const input = await recurse({ base, scope, cft, rootTemplate, caller: 'Fn::SubNow', ...opts });
  let template = input as string;
  let variables: Record<string, TemplateValue> = {};

  if (Array.isArray(input)) {
    [template, variables] = input as [string, Record<string, TemplateValue>];
  }

  const allVariables = {
    ...getAwsPseudoParameters(),
    ...opts.inject,
    ...variables,
  };

  let result = template.toString();
  _.forEach(allVariables, (value, key) => {
    const regex = new RegExp(`\\$\\{${_.escapeRegExp(key)}\\}`, 'g');
    result = result.replace(regex, String(value));
  });

  return result;
}

async function handleFnRefNow(ctx: RecurseContext): Promise<any> {
  const { base, scope, cft, rootTemplate, ...opts } = ctx;
  const refInput = await recurse({ base, scope, cft, rootTemplate, caller: 'Fn::RefNow', ...opts });

  let refName = refInput as string;
  let refOptions: Record<string, unknown> = {};

  if (_.isPlainObject(refInput)) {
    const obj = refInput as { Ref?: string; ref?: string };
    refName = obj.Ref || obj.ref || '';
    refOptions = _.omit(obj, ['Ref', 'ref']);
  }

  if (opts.refNowIgnores?.includes(refName)) {
    return { Ref: refName };
  }

  const allRefs: Record<string, unknown> = {
    ...getAwsPseudoParameters(),
    ...process.env,
    ...opts.inject,
    ...scope,
  };

  if (refName in allRefs) {
    return allRefs[refName] as TemplateValue;
  }

  if (rootTemplate?.Resources) {
    const resources = rootTemplate.Resources;
    if (refName in resources) {
      const resource = resources[refName];
      const resourceType = resource.Type;
      const properties = resource.Properties || {};

      let returnType: 'arn' | 'name' = 'arn';
      if (opts.key?.endsWith('Name')) {
        returnType = 'name';
      }

      const resourceOptions = {
        returnType,
        ...(opts.refNowReturnType ? { returnType: opts.refNowReturnType } : {}),
        ...refOptions,
      };
      const result = buildResourceArn(resourceType, properties, allRefs, resourceOptions);
      if (result) {
        return result;
      }
    }
  }

  if (opts.refNowIgnoreMissing) {
    return { Ref: refName };
  }

  throw new Error(`Unable to resolve Ref for logical name: ${refName}`);
}

async function handleFnApplyTags(ctx: RecurseContext): Promise<any> {
  const { base, scope, cft, rootTemplate, ...opts } = ctx;
  const json = await recurse({ base, scope, cft, rootTemplate, caller: 'Fn::ApplyTags', ...opts }) as {
    tags?: TemplateValue[];
    Tags?: TemplateValue[];
    resources: Record<string, Resource>;
  };

  let { tags, Tags, resources } = json;
  tags = tags || Tags;

  const promises: Promise<Resource>[] = [];
  _.each(resources, (val, id) => {
    promises.push(
      isTaggableResource(val.Type).then((isTaggable: boolean) => {
        if (isTaggable) {
          resources[id] = deepMerge(
            {
              Properties: {
                Tags: tags,
              },
            },
            val,
          ) as Resource;
        }
        return resources[id];
      }),
    );
  });
  await Promise.all(promises);
  return resources;
}

// Helper functions

function findAndReplace(scope: Scope, object: unknown): any {
  let result: any = object;
  if (typeof result === 'string') {
    for (const find in scope) {
      if (result === find) {
        result = scope[find];
      }
    }
  }
  if (typeof result === 'string') {
    for (const find in scope) {
      const replace = scope[find];
      const regex = new RegExp(`\\\${${find}}`, 'g');
      if (find !== '_' && (result as string).match(regex)) {
        result = (result as string).replace(regex, String(replace));
      }
    }
  }
  if (Array.isArray(result)) {
    result = result.map((item: any) => findAndReplace(scope, item));
  } else if (_.isPlainObject(result)) {
    result = _.mapKeys(result as object, (value, key) => findAndReplace(scope, key) as string);
    for (const key of Object.keys(result as object)) {
      if (key === 'Fn::Map') continue;
      (result as Record<string, unknown>)[key] = findAndReplace(scope, (result as Record<string, unknown>)[key]);
    }
  }
  return result;
}

function interpolate(lines: string[], context: Record<string, TemplateValue>): unknown[][] {
  return lines.map((line) => {
    const parts: unknown[] = [];
    line
      .split(/({{\w+?}})/g)
      .map((_line) => {
        const match = _line.match(/^{{(\w+)}}$/);
        const value = match ? context[match[1]] : undefined;
        if (!match) return _line;
        if (value === undefined) return '';
        return value;
      })
      .forEach((part) => {
        const last = parts[parts.length - 1];
        if (_.isPlainObject(part) || _.isPlainObject(last) || !parts.length) {
          parts.push(part);
        } else if (parts.length) {
          parts[parts.length - 1] = String(last) + part;
        }
      });
    return parts.filter((part) => part !== '');
  });
}

interface FnIncludeArgs {
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

function fnIncludeOptsFromArray(cft: unknown[], opts: Record<string, unknown>): FnIncludeArgs {
  const [location, query, parser = 'lodash'] = cft as [string, string?, string?];
  return { location, query, parser, ...opts };
}

function fnIncludeOpts(cft: unknown, opts: Record<string, unknown>): FnIncludeArgs {
  if (_.isPlainObject(cft)) {
    return _.merge(cft as object, _.cloneDeep(opts)) as FnIncludeArgs;
  } else if (Array.isArray(cft)) {
    return fnIncludeOptsFromArray(cft, opts);
  } else {
    const splits = (cft as string).split('|');
    if (splits.length > 1) {
      return fnIncludeOptsFromArray(splits, opts);
    }
    return { location: cft as string, ...opts };
  }
}

async function fnInclude(ctx: FnIncludeContext): Promise<any> {
  const { base, scope, cft: cftArg, ...opts } = ctx;
  let cft = fnIncludeOpts(cftArg, opts);
  cft = _.defaults(cft, { type: 'json' });

  let procTemplate = async (template: string, inject = cft.inject, doEnv = opts.doEnv) =>
    replaceEnv(template, inject, doEnv) as string;

  const handleInjectSetup = () => {
    if (cft.inject) {
      const origProcTemplate = procTemplate;
      procTemplate = async (template: string) => {
        try {
          const inject = (await recurse({ base, scope, cft: cft.inject!, ...opts })) as Record<string, string>;
          const processed = await origProcTemplate(template, inject, opts.doEnv);
          return replaceEnv(processed, inject, opts.doEnv) as string;
        } catch {
          return '';
        }
      };
    }
  };
  handleInjectSetup();

  if (cft.doLog) {
    console.log({ base, scope, args: cft, ...opts });
  }

  let body: Promise<string> | undefined;
  let absolute: string = '';
  const location = parseLocation(cft.location);

  if (!_.isEmpty(location) && !location.protocol) {
    location.protocol = base.protocol;
  }

  if (location.protocol === 'file') {
    absolute = location.relative
      ? path.join(path.dirname(base.path || ''), location.host || '', location.path || '')
      : [location.host, location.path].join('');

    cft.inject = { CFN_INCLUDE_DIRNAME: path.dirname(absolute), ...cft.inject };
    handleInjectSetup();

    if (isGlob(cft, absolute)) {
      const paths = (await glob(absolute)).sort();
      const template = yaml.load(paths.map((_p) => `- Fn::Include: file://${_p}`).join('\n')) as any;
      return recurse({ base, scope, cft: template, rootTemplate: template as TemplateDocument, ...opts });
    }
    body = cachedReadFile(absolute).then(procTemplate);
    absolute = `${location.protocol}://${absolute}`;
  } else if (location.protocol === 's3') {
    const basedir = path.parse(base.path || '').dir;
    const bucket = location.relative ? base.host : location.host;

    let key = location.relative ? url.resolve(`${basedir}/`, location.raw || '') : location.path;
    key = (key || '').replace(/^\//, '');
    absolute = `${location.protocol}://${[bucket, key].join('/')}`;
    body = s3
      .send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      )
      .then((res) => res.Body?.transformToString() || '')
      .then(procTemplate);
  } else if (location.protocol?.match(/^https?$/)) {
    const basepath = `${path.parse(base.path || '').dir}/`;

    absolute = location.relative
      ? url.resolve(`${location.protocol}://${base.host}${basepath}`, location.raw || '')
      : location.raw || '';

    body = request(absolute).then(procTemplate);
  }

  return handleIncludeBody({ scope, args: cft, body: body!, absolute });
}

function isGlob(args: FnIncludeArgs, str: string): boolean {
  return args.isGlob || /.*\*/.test(str);
}

async function handleIncludeBody(config: {
  scope: Scope;
  args: FnIncludeArgs;
  body: Promise<string>;
  absolute: string;
}): Promise<any> {
  const { scope, args, body, absolute } = config;
  const procTemplate = (temp: string) => replaceEnv(temp, args.inject, args.doEnv) as string;

  try {
    switch (args.type) {
      case 'json': {
        let b = await body;
        b = procTemplate(b);
        const rootTemplate = yaml.load(b) as TemplateDocument;
        const caller = 'handleIncludeBody:json';

        const loopTemplate = (temp: TemplateValue): Promise<any> => {
          return recurse({
            base: parseLocation(absolute),
            scope,
            cft: temp,
            caller,
            rootTemplate,
            doEnv: args.doEnv,
            doEval: args.doEval,
            doLog: args.doLog,
            inject: args.inject,
            refNowIgnores: args.refNowIgnores,
            refNowIgnoreMissing: args.refNowIgnoreMissing,
          }).then((_temp) => {
            if (!_temp || !Object.keys(_temp as object).length) {
              return _temp;
            }
            if (isOurExplicitFunction(Object.keys(_temp as object)[0])) {
              return loopTemplate(_temp);
            }
            return _temp;
          });
        };

        return loopTemplate(rootTemplate as TemplateValue).then(async (temp) => {
          if (!args.query) {
            return temp;
          }
          const query =
            typeof args.query === 'string'
              ? (replaceEnv(args.query, args.inject, args.doEnv) as string)
              : await recurse({
                  base: parseLocation(absolute),
                  scope,
                  cft: args.query,
                  caller,
                  rootTemplate,
                  doEnv: args.doEnv,
                  doLog: args.doLog,
                  inject: args.inject,
                  refNowIgnores: args.refNowIgnores,
                  refNowIgnoreMissing: args.refNowIgnoreMissing,
                });
          return getParser(args.parser)(temp, query as string) as TemplateValue;
        });
      }
      case 'string': {
        const template = await body;
        return procTemplate(template);
      }
      case 'literal': {
        const template = await body;
        const processed = procTemplate(template);
        let lines: any = JSONifyString(processed);
        if (_.isPlainObject(args.context)) {
          lines = interpolate(lines, args.context!);
        }
        return {
          'Fn::Join': ['', lines.flat()],
        };
      }
      default:
        throw new Error(`Unknown template type to process type: ${args.type}.`);
    }
  } catch (e) {
    if ((replaceEnv.IsRegExVar(absolute) && args.ignoreMissingVar) || args.ignoreMissingFile) {
      return '';
    }
    throw e;
  }
}

function JSONifyString(string: string): string[] {
  const lines: string[] = [];
  const split = string.toString().split(/(\r?\n)/);
  for (let idx = 0; idx < split.length; idx++) {
    const line = split[idx];
    if (idx % 2) {
      lines[(idx - 1) / 2] = lines[(idx - 1) / 2] + line;
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function getBoolEnvOpt(opt: boolean | undefined, envKey: string): boolean {
  return process.env[envKey] ? !!process.env[envKey] : !!opt;
}
