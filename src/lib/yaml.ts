import * as yaml from 'js-yaml';
import yamlSchema, { MERGE_SENTINEL } from './schema.js';

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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Collect merge sources, flattening `<<: [*a, *b]` lists and repeated `<<:` keys. */
function flattenMergeSources(value: unknown, out: unknown[]): void {
  if (Array.isArray(value)) {
    for (const element of value) flattenMergeSources(element, out);
  } else {
    out.push(value);
  }
}

function setKey(out: Record<string, unknown>, key: string, value: unknown): void {
  if (key === '__proto__') {
    Object.defineProperty(out, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  } else {
    out[key] = value;
  }
}

/**
 * Apply YAML merge keys (`<<:`) with js-yaml 4 semantics, post-parse.
 *
 * The schema resolves a plain `<<` key to MERGE_SENTINEL instead of letting
 * js-yaml 5's core merge machinery run, because the core only accepts merge
 * sources that are (aliases to) untagged mapping NODES. v4 merged whatever
 * the source RESOLVED to — which is what makes `<<: !Include common.yml`
 * work. Semantics: explicit keys always win over merged keys (whether they
 * appear before or after the `<<`), and among multiple sources the earliest
 * wins. A `<<` in value position resolves back to the literal string "<<",
 * as in v4. The `seen` memo preserves alias identity and terminates cycles.
 */
function resolveMerges(node: unknown, seen = new Map<unknown, unknown>()): unknown {
  if (node === MERGE_SENTINEL) return '<<';
  if (Array.isArray(node)) {
    if (seen.has(node)) return seen.get(node);
    const out: unknown[] = [];
    seen.set(node, out);
    for (const element of node) out.push(resolveMerges(element, seen));
    return out;
  }
  if (isPlainObject(node)) {
    if (seen.has(node)) return seen.get(node);
    const out: Record<string, unknown> = {};
    seen.set(node, out);
    for (const [key, value] of Object.entries(node)) {
      if (key !== MERGE_SENTINEL) {
        setKey(out, key, resolveMerges(value, seen));
        continue;
      }
      const sources: unknown[] = [];
      flattenMergeSources(value, sources);
      for (const source of sources) {
        const resolved = resolveMerges(source, seen);
        if (!isPlainObject(resolved)) {
          throw new yaml.YAMLException(
            'cannot merge mappings; the provided source object is unacceptable',
          );
        }
        for (const [sourceKey, sourceValue] of Object.entries(resolved)) {
          if (!Object.prototype.hasOwnProperty.call(out, sourceKey)) {
            setKey(out, sourceKey, sourceValue);
          }
        }
      }
    }
    return out;
  }
  return node;
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
      return resolveMerges(yaml.load(res, { schema: yamlSchema }));
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
