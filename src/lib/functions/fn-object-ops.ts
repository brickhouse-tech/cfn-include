import _ from 'lodash';
import deepMerge from 'deepmerge';
import sortObject from '@znemz/sort-object';
import type { RecurseContext, RecurseFn, TemplateObject } from './types.js';

export function createFnOmit(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::Omit'], rootTemplate, caller: 'Fn::Omit', ...opts });
    const normalized = Array.isArray(json) ? { object: json[0] as Record<string, unknown>, omits: json[1] as string[] } : json as { object: Record<string, unknown>; omits: string[] };
    return _.omit(normalized.object, normalized.omits);
  };
}

export function createFnOmitEmpty(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::OmitEmpty'], rootTemplate, caller: 'Fn::OmitEmpty', ...opts }) as Record<string, unknown>;
    return _.omitBy(json, (v) => !v && v !== false && v !== 0);
  };
}

export function createFnMerge(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::Merge'], rootTemplate, caller: 'Fn::Merge', ...opts }) as unknown[];
    delete obj['Fn::Merge'];
    return recurse({ base, scope, cft: _.defaults(obj, _.merge.apply(_, json as [object, ...object[]])), rootTemplate, caller: 'Fn::Merge', ...opts });
  };
}

export function createFnDeepMerge(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::DeepMerge'], rootTemplate, caller: 'Fn::DeepMerge', ...opts }) as unknown[];
    delete obj['Fn::DeepMerge'];
    let mergedObj = {};
    if (json?.length) {
      for (const j of json) {
        mergedObj = deepMerge(mergedObj, j as object);
      }
    }
    return recurse({ base, scope, cft: _.defaults(obj, mergedObj), rootTemplate, caller: 'Fn::DeepMerge', ...opts });
  };
}

export function createFnObjectKeys(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::ObjectKeys'], rootTemplate, caller: 'Fn::ObjectKeys', ...opts });
    return Object.keys(json as object);
  };
}

export function createFnObjectValues(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::ObjectValues'], rootTemplate, caller: 'Fn::ObjectValues', ...opts });
    return Object.values(json as object);
  };
}

export function createFnSortObject(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const result = await recurse({ base, scope, cft: obj['Fn::SortObject'], rootTemplate, caller: 'Fn::SortObject', ...opts }) as { object?: unknown; options?: Record<string, unknown> };
    const { object, options: sortOpts, ...rest } = result;
    return sortObject(object || rest, sortOpts);
  };
}
