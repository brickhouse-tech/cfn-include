import * as yaml from 'js-yaml';
import yamlSchema from './schema.js';

/**
 * Simple JSON minify - strips comments and whitespace.
 * Handles JavaScript-style single-line (//) and multi-line comments.
 */
function jsonMinify(json: string): string {
  let inString = false;
  let escaped = false;
  let result = '';
  let i = 0;

  while (i < json.length) {
    const char = json[i];
    const nextChar = json[i + 1];

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      i++;
    } else if (char === '"') {
      inString = true;
      result += char;
      i++;
    } else if (char === '/' && nextChar === '/') {
      // Single-line comment - skip until newline
      while (i < json.length && json[i] !== '\n') {
        i++;
      }
    } else if (char === '/' && nextChar === '*') {
      // Multi-line comment - skip until */
      i += 2;
      while (i < json.length - 1 && !(json[i] === '*' && json[i + 1] === '/')) {
        i++;
      }
      i += 2; // Skip */
    } else {
      result += char;
      i++;
    }
  }

  return result;
}

export function load(res: string): unknown {
  // js-yaml 4 returned undefined for an empty document; v5 throws.
  if (res.trim() === '') return undefined;
  // Strict JSON (with comments minified away) is tried FIRST. With js-yaml 4
  // the YAML parser threw on commented JSON and we fell through to this
  // branch; js-yaml 5's spec-conformant flow parsing instead "succeeds",
  // swallowing the comments into plain scalars — so YAML-first can no longer
  // detect JSON-with-comments input. JSON.parse is unambiguous, and for plain
  // valid JSON, JSON and YAML semantics agree.
  try {
    return JSON.parse(jsonMinify(res));
  } catch (jsonErr) {
    try {
      return yaml.load(res, { schema: yamlSchema });
    } catch (yamlErr) {
      const err = new Error(String([yamlErr, jsonErr]));
      err.name = 'SyntaxError';
      throw err;
    }
  }
}

export interface DumpOptions {
  sortKeys?: boolean;
  lineWidth?: number;
  [key: string]: unknown;
}

export function dump(obj: unknown, opts: DumpOptions = {}): string {
  return yaml.dump(obj, { sortKeys: true, ...opts });
}
