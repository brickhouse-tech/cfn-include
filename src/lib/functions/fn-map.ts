import _ from 'lodash';
import * as PromiseExt from '../promise.js';
import { createChildScope } from '../scope.js';
import { findAndReplace } from './helpers.js';
import type { RecurseContext, RecurseFn, TemplateObject } from './types.js';

export function createFnMap(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
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
  };
}
