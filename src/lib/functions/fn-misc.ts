import path from 'node:path';
import _ from 'lodash';
import { glob } from 'glob';
import deepMerge from 'deepmerge';
import { isTaggableResource } from '@znemz/cft-utils/src/resources/taggable.js';
import replaceEnv from '../replaceEnv.js';
import parseLocation from '../parselocation.js';
import { getAwsPseudoParameters, buildResourceArn } from '../internals.js';
import type { RecurseContext, RecurseFn, TemplateObject, TemplateValue } from './types.js';
import type { Resource } from '../../types/index.js';

export function createFnGetEnv() {
  return async (ctx: RecurseContext): Promise<any> => {
    const obj = ctx.cft as TemplateObject;
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
  };
}

export function createFnEval(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    if (!opts.doEval) {
      return Promise.reject(new Error('Fn::Eval is not allowed doEval is falsy'));
    }
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::Eval'], rootTemplate, caller: 'Fn::Eval', ...opts }) as { state?: unknown; script: string; inject?: Record<string, string>; doLog?: boolean };
    let { script } = json;
    const { state, inject, doLog } = json;
    script = replaceEnv(script, _.merge(_.cloneDeep(opts.inject), inject), opts.doEnv) as string;
    if (doLog) {
      console.log({ state, script, inject });
    }
    // eslint-disable-next-line no-eval
    return eval(script);
  };
}

export function createFnFilenames(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::Filenames'], rootTemplate, caller: 'Fn::Filenames', ...opts });
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
  };
}

export function createFnOutputs(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const outputs = await recurse({ base, scope, cft: obj['Fn::Outputs'], caller: 'Fn::Outputs', ...opts }) as Record<string, TemplateValue>;
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
  };
}

export function createFnSequence(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const outputs = await recurse({ base, scope, cft: obj['Fn::Sequence'], caller: 'Fn::Sequence', ...opts }) as [number | string, number | string, number?];

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
  };
}

export function createFnIfEval(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    if (!opts.doEval) {
      return Promise.reject(new Error('Fn::IfEval is not allowed doEval is falsy'));
    }
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::IfEval'], rootTemplate, caller: 'Fn::IfEval', ...opts }) as {
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
  };
}

export function createFnRefNow(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const refInput = await recurse({ base, scope, cft: obj['Fn::RefNow'], rootTemplate, caller: 'Fn::RefNow', ...opts });

    let refName = refInput as string;
    let refOptions: Record<string, unknown> = {};

    if (_.isPlainObject(refInput)) {
      const rObj = refInput as { Ref?: string; ref?: string };
      refName = rObj.Ref || rObj.ref || '';
      refOptions = _.omit(rObj, ['Ref', 'ref']);
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
  };
}

export function createFnApplyTags(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await recurse({ base, scope, cft: obj['Fn::ApplyTags'], rootTemplate, caller: 'Fn::ApplyTags', ...opts }) as {
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
  };
}
