import _ from 'lodash';
import type { RecurseContext, RecurseFn, TemplateObject } from './types.js';

export function createFnFlatten(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::Flatten'], rootTemplate, caller: 'Fn::Flatten', ...opts });
    return (json as unknown[]).flat();
  };
}

export function createFnFlattenDeep(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::FlattenDeep'], rootTemplate, caller: 'Fn::FlattenDeep', ...opts });
    return (json as unknown[]).flat(Infinity);
  };
}

export function createFnUniq(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::Uniq'], rootTemplate, caller: 'Fn::Uniq', ...opts });
    return [...new Set(json as unknown[])];
  };
}

export function createFnCompact(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::Compact'], rootTemplate, caller: 'Fn::Compact', ...opts });
    return (json as unknown[]).filter(Boolean);
  };
}

export function createFnConcat(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::Concat'], rootTemplate, caller: 'Fn::Concat', ...opts });
    return _.concat(...(json as unknown[][]));
  };
}

export function createFnSort(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const array = await recurse({ base, scope, cft: obj['Fn::Sort'], rootTemplate, caller: 'Fn::Sort', ...opts });
    return (array as unknown[]).sort();
  };
}

export function createFnSortedUniq(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const array = await recurse({ base, scope, cft: obj['Fn::SortedUniq'], rootTemplate, caller: 'Fn::SortedUniq', ...opts });
    return _.sortedUniq((array as unknown[]).sort());
  };
}

export function createFnSortBy(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const { list, iteratees } = await recurse({ base, scope, cft: obj['Fn::SortBy'], rootTemplate, caller: 'Fn::SortBy', ...opts }) as { list: unknown[]; iteratees: string | string[] };
    return _.sortBy(list, iteratees);
  };
}

export function createFnWithout(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::Without'], rootTemplate, caller: 'Fn::Without', ...opts });
    const normalized = Array.isArray(json) ? { list: json[0] as unknown[], withouts: json[1] as unknown[] } : json as { list: unknown[]; withouts: unknown[] };
    return _.without(normalized.list, ...normalized.withouts);
  };
}
