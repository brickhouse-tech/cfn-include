import {
  CORE_SCHEMA,
  NOT_RESOLVED,
  binaryTag,
  defineMappingTag,
  defineScalarTag,
  defineSequenceTag,
  omapTag,
  pairsTag,
  timestampTag,
  type TagDefinition as YamlTagDefinition,
} from 'js-yaml';
import _ from 'lodash';

interface TagDefinition {
  short: string;
  full: string;
  type: 'scalar' | 'mapping' | 'sequence';
  dotSyntax?: boolean;
}

const tagDefinitions: TagDefinition[] = [
  { short: 'Include', full: 'Fn::Include', type: 'scalar' },
  { short: 'Include', full: 'Fn::Include', type: 'mapping' },
  { short: 'Stringify', full: 'Fn::Stringify', type: 'sequence' },
  { short: 'Stringify', full: 'Fn::Stringify', type: 'mapping' },
  { short: 'Map', full: 'Fn::Map', type: 'sequence' },
  { short: 'Length', full: 'Fn::Length', type: 'sequence' },
  { short: 'Flatten', full: 'Fn::Flatten', type: 'sequence' },
  { short: 'FlattenDeep', full: 'Fn::FlattenDeep', type: 'sequence' },
  { short: 'Uniq', full: 'Fn::Uniq', type: 'sequence' },
  { short: 'GetEnv', full: 'Fn::GetEnv', type: 'sequence' },
  { short: 'GetEnv', full: 'Fn::GetEnv', type: 'scalar' },
  { short: 'Merge', full: 'Fn::Merge', type: 'sequence' },
  { short: 'Outputs', full: 'Fn::Outputs', type: 'mapping' },
  { short: 'LowerCamelCase', full: 'Fn::LowerCamelCase', type: 'scalar' },
  { short: 'UpperCamelCase', full: 'Fn::UpperCamelCase', type: 'scalar' },
  { short: 'Sequence', full: 'Fn::Sequence', type: 'sequence' },
  { short: 'DeepMerge', full: 'Fn::DeepMerge', type: 'sequence' },
  { short: 'Compact', full: 'Fn::Compact', type: 'sequence' },
  { short: 'Concat', full: 'Fn::Concat', type: 'sequence' },
  { short: 'Sort', full: 'Fn::Sort', type: 'sequence' },
  { short: 'SortedUniq', full: 'Fn::SortedUniq', type: 'sequence' },
  { short: 'SortBy', full: 'Fn::SortBy', type: 'mapping' },
  { short: 'SortObject', full: 'Fn::SortObject', type: 'mapping' },
  { short: 'ObjectKeys', full: 'Fn::ObjectKeys', type: 'sequence' },
  { short: 'ObjectValues', full: 'Fn::ObjectValues', type: 'sequence' },
  { short: 'Filenames', full: 'Fn::Filenames', type: 'sequence' },
  { short: 'Without', full: 'Fn::Without', type: 'sequence' },
  { short: 'Omit', full: 'Fn::Omit', type: 'sequence' },
  { short: 'Omit', full: 'Fn::Omit', type: 'mapping' },
  { short: 'OmitEmpty', full: 'Fn::OmitEmpty', type: 'mapping' },
  { short: 'Eval', full: 'Fn::Eval', type: 'sequence' },
  { short: 'IfEval', full: 'Fn::IfEval', type: 'mapping' },
  { short: 'JoinNow', full: 'Fn::JoinNow', type: 'scalar' },
  { short: 'SubNow', full: 'Fn::SubNow', type: 'scalar' },
  { short: 'SubNow', full: 'Fn::SubNow', type: 'sequence' },
  { short: 'RefNow', full: 'Fn::RefNow', type: 'scalar' },
  { short: 'ApplyTags', full: 'Fn::ApplyTags', type: 'mapping' },

  // AWS intrinsics
  { short: 'Base64', full: 'Fn::Base64', type: 'scalar' },
  { short: 'Base64', full: 'Fn::Base64', type: 'mapping' },
  { short: 'FindInMap', full: 'Fn::FindInMap', type: 'sequence' },
  { short: 'GetAtt', full: 'Fn::GetAtt', type: 'sequence' },
  { short: 'GetAtt', full: 'Fn::GetAtt', type: 'scalar', dotSyntax: true },
  { short: 'GetAZs', full: 'Fn::GetAZs', type: 'sequence' },
  { short: 'GetAZs', full: 'Fn::GetAZs', type: 'scalar' },
  { short: 'ImportValue', full: 'Fn::ImportValue', type: 'scalar' },
  { short: 'ImportValue', full: 'Fn::ImportValue', type: 'mapping' },
  { short: 'Join', full: 'Fn::Join', type: 'sequence' },
  { short: 'Select', full: 'Fn::Select', type: 'sequence' },
  { short: 'Sub', full: 'Fn::Sub', type: 'sequence' },
  { short: 'Sub', full: 'Fn::Sub', type: 'mapping' },
  { short: 'Sub', full: 'Fn::Sub', type: 'scalar' },
  { short: 'Split', full: 'Fn::Split', type: 'sequence' },
  { short: 'Ref', full: 'Ref', type: 'scalar' },
  { short: 'Cidr', full: 'Fn::Cidr', type: 'sequence' },
  { short: 'Cidr', full: 'Fn::Cidr', type: 'mapping' },
  { short: 'GetParam', full: 'Fn::GetParam', type: 'sequence' },
  { short: 'And', full: 'Fn::And', type: 'sequence' },
  { short: 'Equals', full: 'Fn::Equals', type: 'sequence' },
  { short: 'If', full: 'Fn::If', type: 'sequence' },
  { short: 'Not', full: 'Fn::Not', type: 'sequence' },
  { short: 'Or', full: 'Fn::Or', type: 'sequence' },
  { short: 'Condition', full: 'Condition', type: 'scalar' },
];

/**
 * Merge keys (`<<:`) are resolved by cfn-include itself, not by js-yaml 5's
 * built-in mergeTag. The built-in machinery only accepts merge sources whose
 * NODE is an (alias to an) untagged mapping — it throws "cannot merge
 * mappings" for `<<: !Include common.yml`, which js-yaml 4 supported (v4
 * merged whatever the value RESOLVED to). So our merge tag resolves a plain
 * `<<` key to this sentinel string, mappings accumulate it like any other
 * key, and resolveMerges() in yaml.ts applies v4 merge semantics post-parse.
 * The NUL bytes make an accidental collision with real template data
 * effectively impossible (NUL is not representable in plain YAML scalars).
 */
export const MERGE_SENTINEL = '\u0000Fn::MergeKey\u0000';

function addPairMergeAware(
  carrier: Record<string, unknown>,
  key: unknown,
  value: unknown,
  complexKeyError: string,
): string {
  if (key !== null && typeof key === 'object') {
    return complexKeyError;
  }
  const normalizedKey = String(key);
  if (normalizedKey === MERGE_SENTINEL) {
    // Accumulate every `<<:` in this mapping (YAML 1.1 allows repeats);
    // resolveMerges() flattens and applies them in order.
    const pending = (carrier[MERGE_SENTINEL] as unknown[] | undefined) ?? [];
    pending.push(value);
    carrier[MERGE_SENTINEL] = pending;
    return '';
  }
  if (normalizedKey === '__proto__') {
    Object.defineProperty(carrier, normalizedKey, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  } else {
    carrier[normalizedKey] = value;
  }
  return '';
}

// `has` must deny the sentinel so repeated `<<:` keys skip the core
// duplicated-mapping-key check (they accumulate in addPairMergeAware instead).
function hasMergeAware(carrier: Record<string, unknown>, key: unknown): boolean {
  if (key !== null && typeof key === 'object') return false;
  const normalizedKey = String(key);
  if (normalizedKey === MERGE_SENTINEL) return false;
  return Object.prototype.hasOwnProperty.call(carrier, normalizedKey);
}

// Replaces js-yaml's mergeTag: same implicit resolution of a plain `<<` (a
// quoted "<<" stays a literal key), but yields MERGE_SENTINEL instead of the
// core MERGE_KEY symbol so the core merge machinery never runs.
const cfnMergeTag = defineScalarTag<string>('tag:yaml.org,2002:merge', {
  implicit: true,
  implicitFirstChars: ['<'],
  resolve: (source, isExplicit) =>
    source === '<<' || (isExplicit && source === '') ? MERGE_SENTINEL : NOT_RESOLVED,
});

// Replaces js-yaml's default map tag: identical construction/dump behavior,
// plus MERGE_SENTINEL accumulation for plain mappings.
function isPlainObjectValue(v: unknown): boolean {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

const mergeAwareMapTag = defineMappingTag<Record<string, unknown>, Record<string, unknown>>(
  'tag:yaml.org,2002:map',
  {
    create: () => ({}),
    identify: isPlainObjectValue,
    represent: (data: Record<string, unknown>) => {
      const map = new Map<unknown, unknown>();
      for (const key of Object.keys(data)) map.set(key, data[key]);
      return map;
    },
    addPair: (carrier, key, value) =>
      addPairMergeAware(carrier, key, value, 'object-based map does not support complex keys'),
    has: hasMergeAware,
    keys: (result) => Object.keys(result),
    get: (result, key) => result[String(key)],
  },
);

// js-yaml 5 replaced the v4 `new yaml.Type(tag, { kind, construct })` API with
// per-kind builder factories (defineScalarTag / defineSequenceTag /
// defineMappingTag). All our tags do the same thing construct() did before:
// collect the node's value, then wrap it as { <Fn::Full>: value }.
const tags: YamlTagDefinition[] = tagDefinitions.map((fn) => {
  const tagName = '!' + fn.short;
  const wrap = (obj: unknown): Record<string, unknown> => _.fromPairs([[fn.full, obj]]);

  switch (fn.type) {
    case 'scalar':
      return defineScalarTag<Record<string, unknown>>(tagName, {
        resolve: (source) => {
          let obj: unknown = source;
          if (fn.dotSyntax && _.isString(obj)) {
            const indexOfDot = obj.indexOf('.');
            if (indexOfDot !== -1) {
              obj = [obj.substring(0, indexOfDot), obj.substring(indexOfDot + 1)];
            } else {
              obj = [obj];
            }
          }
          return wrap(obj);
        },
      });
    case 'sequence':
      return defineSequenceTag<unknown[], Record<string, unknown>>(tagName, {
        create: () => [],
        addItem: (carrier, item) => {
          carrier.push(item);
        },
        finalize: (carrier) => wrap(carrier),
      });
    case 'mapping':
      return defineMappingTag<Record<string, unknown>, Record<string, unknown>>(tagName, {
        create: () => ({}),
        addPair: (carrier, key, value) =>
          addPairMergeAware(
            carrier,
            key,
            value,
            `${tagName} does not support complex mapping keys`,
          ),
        has: hasMergeAware,
        keys: (result) => Object.keys(result),
        get: (result, key) => result[String(key)],
        finalize: (carrier) => wrap(carrier),
      });
  }
});

// Build array of strings of all Amazon Intrinsic functions
export const BANG_AMAZON_FUNCS = [
  'Base64',
  'FindInMap',
  'GetAtt',
  'GetAZs',
  'ImportValue',
  'Join',
  'Select',
  'Split',
  'Sub',
  'Ref',
  'Cidr',
  'GetParam',
  'And',
  'Equals',
  'If',
  'Not',
  'Or',
  'Condition',
];

export const EXPLICIT_AMAZON_FUNCS = BANG_AMAZON_FUNCS.map((f) => `Fn::${f}`);

// v5's built-in setTag constructs a JS Set, which JSON-serializes to {} —
// templates are ultimately JSON, so keep v4's plain-object form
// ({key: null, ...}) instead.
const v4SetTag = defineMappingTag<Record<string, null>, Record<string, null>>(
  'tag:yaml.org,2002:set',
  {
    create: () => ({}),
    addPair: (carrier, key, value) => {
      if (value !== null) return 'cannot resolve a set item';
      carrier[String(key)] = null;
      return '';
    },
    has: (carrier, key) => Object.prototype.hasOwnProperty.call(carrier, String(key)),
    keys: (result) => Object.keys(result),
    get: () => null,
  },
);

// v4's yaml.DEFAULT_SCHEMA.extend(tags) → v5's CORE_SCHEMA.withTags(tags).
// v5's CORE_SCHEMA is YAML 1.2 core only; v4's DEFAULT_SCHEMA additionally
// bundled the YAML 1.1 extras — merge keys (`<<:`), !!timestamp, !!binary,
// !!omap, !!pairs, !!set. Templates in the wild rely on `<<:` merge keys, so
// re-add all of them to keep v4 parse behavior. test/yaml-conformance.test.ts
// pins the resulting baseline; keep it in sync with any schema change here.
const yamlSchema = CORE_SCHEMA.withTags([
  cfnMergeTag,
  mergeAwareMapTag,
  timestampTag,
  binaryTag,
  omapTag,
  pairsTag,
  v4SetTag,
  ...tags,
]);

/**
 * Test the function key to make sure it's something we should process.
 */
export function isOurExplicitFunction(testKeyForFunc: string): boolean {
  return /Fn::.*/.test(testKeyForFunc) && !EXPLICIT_AMAZON_FUNCS.includes(testKeyForFunc);
}

export default yamlSchema;
