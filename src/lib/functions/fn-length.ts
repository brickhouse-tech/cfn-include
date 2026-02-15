import type { RecurseContext, RecurseFn, TemplateObject } from './types.js';

export function createFnLength(recurse: RecurseFn) {
  return async (ctx: RecurseContext): Promise<any> => {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const arg = obj['Fn::Length'];
    if (Array.isArray(arg)) {
      return arg.length;
    }
    const result = await recurse({ base, scope, cft: arg, rootTemplate, caller: 'Fn::Length', ...opts });
    return Array.isArray(result) ? result.length : 0;
  };
}
