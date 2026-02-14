import _ from 'lodash';
import replaceEnv from '../replaceEnv.js';
import { lowerCamelCase, upperCamelCase } from '../utils.js';
import { getAwsPseudoParameters } from '../internals.js';
import type { RecurseContext, RecurseFn, TemplateObject, TemplateValue } from './types.js';

export function createFnStringify(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::Stringify'], rootTemplate, caller: 'Fn::Stringify', ...opts });
    return JSON.stringify(json);
  };
}

export function createFnStringSplit(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const { string = '', separator = ',', doLog } = await recurse({ base, scope, cft: obj['Fn::StringSplit'], rootTemplate, caller: 'Fn::StringSplit', ...opts }) as { string?: string; separator?: string; doLog?: boolean };
    if (doLog) console.log({ string, separator });
    return string.split(separator);
  };
}

export function createFnUpperCamelCase() {
  return async (ctx: RecurseContext): Promise<any> => {
    const obj = ctx.cft as TemplateObject;
    return upperCamelCase(obj['Fn::UpperCamelCase'] as string);
  };
}

export function createFnLowerCamelCase() {
  return async (ctx: RecurseContext): Promise<any> => {
    const obj = ctx.cft as TemplateObject;
    return lowerCamelCase(obj['Fn::LowerCamelCase'] as string);
  };
}

export function createFnJoinNow(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const array = await recurse({ base, scope, cft: obj['Fn::JoinNow'], rootTemplate, caller: 'Fn::JoinNow', ...opts }) as [string, unknown[]];
    let [delimiter, toJoinArray] = array;
    delimiter = replaceEnv(delimiter, opts.inject, opts.doEnv) as string;
    return toJoinArray.join(delimiter);
  };
}

export function createFnSubNow(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const input = await recurse({ base, scope, cft: obj['Fn::SubNow'], rootTemplate, caller: 'Fn::SubNow', ...opts });
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
  };
}
