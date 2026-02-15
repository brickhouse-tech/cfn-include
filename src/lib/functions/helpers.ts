import _ from 'lodash';
import type { Scope, TemplateValue } from './types.js';

export function findAndReplace(scope: Scope, object: unknown): any {
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

export function interpolate(lines: string[], context: Record<string, TemplateValue>): unknown[][] {
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

export function JSONifyString(string: string): string[] {
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

export function getBoolEnvOpt(opt: boolean | undefined, envKey: string): boolean {
  return process.env[envKey] ? !!process.env[envKey] : !!opt;
}
