import { describe, it, expect } from 'vitest';
import { load } from '../dist/lib/yaml.js';

/**
 * YAML conformance contract for cfn-include's loader.
 *
 * cfn-include promises js-yaml 4 DEFAULT_SCHEMA parse behavior: YAML 1.2 core
 * scalars PLUS the YAML 1.1 extras v4 bundled — merge keys (`<<:`),
 * !!timestamp, !!binary, !!omap, !!pairs, !!set. The js-yaml 4→5 upgrade
 * silently dropped all of those (v5's CORE_SCHEMA is 1.2-only), which broke
 * downstream templates using `<<:`. Every case below was differentially
 * verified against js-yaml 4.3.0 DEFAULT_SCHEMA; intentional deviations are
 * called out inline. If a dependency bump fails one of these, the schema in
 * src/lib/schema.ts lost a tag — fix the schema, don't update the expectation.
 */

interface ConformanceCase {
  name: string;
  yaml: string;
  /** Expected value after normalize(): Dates → {$date}, bytes → {$base64}, non-finite → {$num}. */
  expected: unknown;
}

/** Make Date/Uint8Array/NaN/Infinity comparable with toEqual. */
function normalize(v: unknown): unknown {
  if (v instanceof Date) return { $date: v.toISOString() };
  if (v instanceof Uint8Array) return { $base64: Buffer.from(v).toString('base64') };
  if (typeof v === 'number' && Number.isNaN(v)) return { $num: 'NaN' };
  if (v === Infinity) return { $num: 'Infinity' };
  if (v === -Infinity) return { $num: '-Infinity' };
  if (Array.isArray(v)) return v.map(normalize);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x)]));
  }
  return v;
}

const sections: Record<string, ConformanceCase[]> = {
  'null scalars': [
    { name: 'tilde', yaml: 'v: ~', expected: { v: null } },
    { name: 'null', yaml: 'v: null', expected: { v: null } },
    { name: 'Null', yaml: 'v: Null', expected: { v: null } },
    { name: 'NULL', yaml: 'v: NULL', expected: { v: null } },
    { name: 'empty value', yaml: 'v:', expected: { v: null } },
  ],

  'boolean scalars': [
    { name: 'true', yaml: 'v: true', expected: { v: true } },
    { name: 'True', yaml: 'v: True', expected: { v: true } },
    { name: 'TRUE', yaml: 'v: TRUE', expected: { v: true } },
    { name: 'false', yaml: 'v: false', expected: { v: false } },
    // YAML 1.1 bool words are NOT booleans in core (matches v4):
    { name: 'yes stays string', yaml: 'v: yes', expected: { v: 'yes' } },
    { name: 'on stays string', yaml: 'v: on', expected: { v: 'on' } },
    { name: 'no stays string', yaml: 'v: no', expected: { v: 'no' } },
    { name: 'off stays string', yaml: 'v: off', expected: { v: 'off' } },
    { name: 'y stays string', yaml: 'v: y', expected: { v: 'y' } },
  ],

  'integer scalars': [
    { name: 'plain', yaml: 'v: 42', expected: { v: 42 } },
    { name: 'negative', yaml: 'v: -17', expected: { v: -17 } },
    { name: 'zero', yaml: 'v: 0', expected: { v: 0 } },
    { name: 'hex', yaml: 'v: 0x1A', expected: { v: 26 } },
    { name: '0o octal', yaml: 'v: 0o14', expected: { v: 12 } },
    { name: 'leading-zero is decimal (not 1.1 octal)', yaml: 'v: 014', expected: { v: 14 } },
    // INTENTIONAL deviation from v4 (which parsed 0b1010 → 10): v5's core int
    // tag has no binary literals. Accepted — fixing it would require the 1.1
    // int tag, which also changes 014→12, "1:30"→90, and "1_000_000"→number.
    { name: '0b binary stays string (v4: 10)', yaml: 'v: 0b1010', expected: { v: '0b1010' } },
    { name: 'underscores stay string', yaml: 'v: 1_000_000', expected: { v: '1_000_000' } },
    { name: 'sexagesimal stays string', yaml: 'v: 1:30', expected: { v: '1:30' } },
    { name: 'MAX_SAFE_INTEGER', yaml: 'v: 9007199254740991', expected: { v: 9007199254740991 } },
  ],

  'float scalars': [
    { name: 'plain', yaml: 'v: 3.14', expected: { v: 3.14 } },
    { name: 'negative', yaml: 'v: -0.5', expected: { v: -0.5 } },
    { name: 'exponent', yaml: 'v: 1.2e3', expected: { v: 1200 } },
    { name: 'uppercase exponent', yaml: 'v: 1.2E3', expected: { v: 1200 } },
    { name: 'leading dot', yaml: 'v: .5', expected: { v: 0.5 } },
    { name: 'trailing dot', yaml: 'v: 5.', expected: { v: 5 } },
    { name: '.inf', yaml: 'v: .inf', expected: { v: { $num: 'Infinity' } } },
    { name: '-.inf', yaml: 'v: -.inf', expected: { v: { $num: '-Infinity' } } },
    { name: '.Inf', yaml: 'v: .Inf', expected: { v: { $num: 'Infinity' } } },
    { name: '.nan', yaml: 'v: .nan', expected: { v: { $num: 'NaN' } } },
    { name: '.NaN', yaml: 'v: .NaN', expected: { v: { $num: 'NaN' } } },
    { name: 'underscores stay string', yaml: 'v: 1_000.5', expected: { v: '1_000.5' } },
  ],

  'string scalars': [
    { name: 'plain', yaml: 'v: hello world', expected: { v: 'hello world' } },
    { name: 'single quoted', yaml: "v: 'a: b'", expected: { v: 'a: b' } },
    { name: 'double quoted with escape', yaml: 'v: "tab\\there"', expected: { v: 'tab\there' } },
    { name: 'unicode escape', yaml: 'v: "\\u263A"', expected: { v: '☺' } },
    { name: 'quoted number stays string', yaml: "v: '42'", expected: { v: '42' } },
    { name: 'version-like stays string', yaml: 'v: 1.2.3', expected: { v: '1.2.3' } },
    { name: 'colon without space', yaml: 'v: a:b', expected: { v: 'a:b' } },
    { name: 'unicode plain', yaml: 'v: héllo wörld ☺', expected: { v: 'héllo wörld ☺' } },
  ],

  'explicit core tags': [
    { name: '!!str forces string', yaml: 'v: !!str 42', expected: { v: '42' } },
    { name: '!!int forces number', yaml: "v: !!int '42'", expected: { v: 42 } },
    { name: '!!float forces number', yaml: "v: !!float '3.5'", expected: { v: 3.5 } },
    { name: '!!bool forces boolean', yaml: "v: !!bool 'true'", expected: { v: true } },
    // INTENTIONAL deviation: v4 threw on `!!null ''`; v5 resolves it. Strictly
    // more lenient — nothing that parsed before changes meaning.
    { name: '!!null on empty string', yaml: "v: !!null ''", expected: { v: null } },
    { name: '!!map', yaml: 'v: !!map {a: 1}', expected: { v: { a: 1 } } },
    { name: '!!seq', yaml: 'v: !!seq [1, 2]', expected: { v: [1, 2] } },
  ],

  'YAML 1.1 extras (v4 DEFAULT_SCHEMA parity)': [
    {
      name: 'implicit date → Date',
      yaml: 'v: 2001-12-14',
      expected: { v: { $date: '2001-12-14T00:00:00.000Z' } },
    },
    {
      name: 'implicit ISO datetime → Date',
      yaml: 'v: 2001-12-14T21:59:43.10-05:00',
      expected: { v: { $date: '2001-12-15T02:59:43.100Z' } },
    },
    {
      name: 'implicit spaced datetime → Date',
      yaml: 'v: 2001-12-14 21:59:43.10 -5',
      expected: { v: { $date: '2001-12-15T02:59:43.100Z' } },
    },
    {
      name: '!!timestamp explicit',
      yaml: 'v: !!timestamp 2001-12-14',
      expected: { v: { $date: '2001-12-14T00:00:00.000Z' } },
    },
    {
      name: '!!binary → bytes',
      yaml: 'v: !!binary "R0lGODlh"',
      expected: { v: { $base64: 'R0lGODlh' } },
    },
    {
      name: '!!omap → array of single-pair objects',
      yaml: 'v: !!omap [{a: 1}, {b: 2}]',
      expected: { v: [{ a: 1 }, { b: 2 }] },
    },
    {
      name: '!!pairs → array of [key, value]',
      yaml: 'v: !!pairs [{a: 1}, {a: 2}]',
      expected: { v: [['a', 1], ['a', 2]] },
    },
    {
      // v5's built-in setTag returns a JS Set (JSON-serializes to {});
      // src/lib/schema.ts overrides it with v4's plain-object form.
      name: '!!set → object with null values',
      yaml: 'v: !!set {a, b}',
      expected: { v: { a: null, b: null } },
    },
  ],

  'merge keys (<<:)': [
    {
      name: 'single alias merge',
      yaml: 'b: &b {x: 1, y: 2}\nv:\n  <<: *b\n  z: 3',
      expected: { b: { x: 1, y: 2 }, v: { x: 1, y: 2, z: 3 } },
    },
    {
      name: 'explicit key beats merged key',
      yaml: 'b: &b {x: 1, y: 2}\nv:\n  <<: *b\n  x: 9',
      expected: { b: { x: 1, y: 2 }, v: { x: 9, y: 2 } },
    },
    {
      name: 'list merge — earlier alias wins',
      yaml: 'a: &a {x: 1}\nb: &b {x: 2, y: 2}\nv:\n  <<: [*a, *b]',
      expected: { a: { x: 1 }, b: { x: 2, y: 2 }, v: { x: 1, y: 2 } },
    },
    {
      name: 'list merge with explicit override',
      yaml: 'a: &a {x: 1}\nb: &b {x: 2, y: 2}\nv:\n  <<: [*a, *b]\n  x: 9',
      expected: { a: { x: 1 }, b: { x: 2, y: 2 }, v: { x: 9, y: 2 } },
    },
    {
      name: 'chained merges through anchors',
      yaml: 'a: &a {x: 1}\nb: &b\n  <<: *a\n  y: 2\nv:\n  <<: *b\n  z: 3',
      expected: { a: { x: 1 }, b: { x: 1, y: 2 }, v: { x: 1, y: 2, z: 3 } },
    },
    {
      name: 'quoted "<<" is a literal key, not a merge',
      yaml: 'b: &b {x: 1}\nv:\n  "<<": *b',
      expected: { b: { x: 1 }, v: { '<<': { x: 1 } } },
    },
    {
      name: 'merge inside a custom CFN mapping tag',
      yaml: 'b: &b {x: 1}\nv: !Sub\n  <<: *b\n  y: 2',
      expected: { b: { x: 1 }, v: { 'Fn::Sub': { x: 1, y: 2 } } },
    },
    {
      // v4 merged whatever the source RESOLVED to, so `<<: !Include x` merges
      // {Fn::Include: x} into the parent and the include engine then expands
      // it in place — THE cross-file merge idiom. js-yaml 5's core merge
      // machinery rejects tagged sources; resolveMerges() restores this.
      name: 'merge of a scalar-tagged source (<<: !Include)',
      yaml: 'v:\n  <<: !Include common.yml\n  b: 2',
      expected: { v: { 'Fn::Include': 'common.yml', b: 2 } },
    },
    {
      name: 'merge of a mapping-tagged source',
      yaml: 'v:\n  <<: !Include {location: common.yml}\n  b: 2',
      expected: { v: { 'Fn::Include': { location: 'common.yml' }, b: 2 } },
    },
    {
      name: 'merge via alias to a tagged node',
      yaml: 'x: &x !Include common.yml\nv:\n  <<: *x\n  b: 2',
      expected: { x: { 'Fn::Include': 'common.yml' }, v: { 'Fn::Include': 'common.yml', b: 2 } },
    },
    {
      name: 'merge of an inline (non-alias) map',
      yaml: 'v:\n  <<: {a: 1}\n  b: 2',
      expected: { v: { a: 1, b: 2 } },
    },
    {
      name: 'repeated << keys — earlier wins',
      yaml: 'a: &a {x: 1, y: 1}\nb: &b {y: 2, z: 2}\nv:\n  <<: *a\n  <<: *b',
      expected: { a: { x: 1, y: 1 }, b: { y: 2, z: 2 }, v: { x: 1, y: 1, z: 2 } },
    },
    {
      name: 'explicit key before << still wins',
      yaml: 'b: &b {x: 1, y: 2}\nv:\n  x: 9\n  <<: *b',
      expected: { b: { x: 1, y: 2 }, v: { x: 9, y: 2 } },
    },
    {
      name: 'merge in a flow mapping',
      yaml: 'b: &b {x: 1}\nv: {<<: *b, c: 3}',
      expected: { b: { x: 1 }, v: { x: 1, c: 3 } },
    },
    {
      name: 'explicit !!merge tag',
      yaml: 'b: &b {x: 1}\nv:\n  !!merge <<: *b\n  c: 3',
      expected: { b: { x: 1 }, v: { x: 1, c: 3 } },
    },
    {
      name: '<< in value position stays a string',
      yaml: 'v: <<',
      expected: { v: '<<' },
    },
    {
      name: '<< as a sequence item stays a string',
      yaml: '- <<',
      expected: ['<<'],
    },
    {
      name: 'merge source containing a tagged node',
      yaml: 'b: &b {r: !Ref Foo}\nv:\n  <<: *b\n  y: 2',
      expected: { b: { r: { Ref: 'Foo' } }, v: { r: { Ref: 'Foo' }, y: 2 } },
    },
  ],

  'anchors and aliases': [
    { name: 'scalar alias', yaml: 'a: &x hello\nv: *x', expected: { a: 'hello', v: 'hello' } },
    { name: 'map alias', yaml: 'a: &x {k: 1}\nv: *x', expected: { a: { k: 1 }, v: { k: 1 } } },
    { name: 'seq alias', yaml: 'a: &x [1, 2]\nv: *x', expected: { a: [1, 2], v: [1, 2] } },
    { name: 'alias reused in seq', yaml: 'a: &x hi\nv: [*x, *x]', expected: { a: 'hi', v: ['hi', 'hi'] } },
    {
      name: 'alias to a custom-tagged node',
      yaml: 'a: &x !Ref Foo\nv: *x',
      expected: { a: { Ref: 'Foo' }, v: { Ref: 'Foo' } },
    },
  ],

  collections: [
    { name: 'nested block map', yaml: 'v:\n  a:\n    b: 1', expected: { v: { a: { b: 1 } } } },
    { name: 'block seq', yaml: 'v:\n  - 1\n  - 2', expected: { v: [1, 2] } },
    { name: 'block seq of maps', yaml: 'v:\n  - a: 1\n  - b: 2', expected: { v: [{ a: 1 }, { b: 2 }] } },
    { name: 'flow map', yaml: 'v: {a: 1, b: [2, 3]}', expected: { v: { a: 1, b: [2, 3] } } },
    { name: 'flow seq', yaml: 'v: [a, {b: 1}]', expected: { v: ['a', { b: 1 }] } },
    { name: 'empty flow map', yaml: 'v: {}', expected: { v: {} } },
    { name: 'empty flow seq', yaml: 'v: []', expected: { v: [] } },
    { name: 'explicit key (? :)', yaml: 'v:\n  ? key\n  : value', expected: { v: { key: 'value' } } },
  ],

  'block scalars': [
    { name: 'literal |', yaml: 'v: |\n  line1\n  line2', expected: { v: 'line1\nline2\n' } },
    { name: 'literal keep |+', yaml: 'v: |+\n  line1\n\n', expected: { v: 'line1\n\n' } },
    { name: 'literal strip |-', yaml: 'v: |-\n  line1\n  line2\n', expected: { v: 'line1\nline2' } },
    { name: 'folded >', yaml: 'v: >\n  line1\n  line2', expected: { v: 'line1 line2\n' } },
    { name: 'folded strip >-', yaml: 'v: >-\n  line1\n  line2\n', expected: { v: 'line1 line2' } },
    { name: 'explicit indentation |2', yaml: 'v: |2\n    indented', expected: { v: '  indented\n' } },
  ],

  'comments, documents, directives': [
    { name: 'comments ignored', yaml: '# top\nv: 1 # inline', expected: { v: 1 } },
    { name: 'doc start marker', yaml: '---\nv: 1', expected: { v: 1 } },
    { name: 'doc start and end markers', yaml: '---\nv: 1\n...', expected: { v: 1 } },
  ],

  'mapping keys': [
    { name: 'numeric key becomes string', yaml: '1: one', expected: { '1': 'one' } },
    { name: 'bool-looking key', yaml: 'true: yep', expected: { true: 'yep' } },
    { name: 'null-looking key', yaml: 'null: nothing', expected: { null: 'nothing' } },
    { name: 'quoted numeric key', yaml: '"1": one', expected: { '1': 'one' } },
  ],

  'document edge cases': [
    { name: 'empty input → undefined', yaml: '', expected: undefined },
    { name: 'whitespace-only input → undefined', yaml: '   \n', expected: undefined },
    { name: 'plain JSON input', yaml: '{"a": 1, "b": [true, null]}', expected: { a: 1, b: [true, null] } },
    { name: 'JSON with // comments', yaml: '{"a": 1 // c\n}', expected: { a: 1 } },
  ],
};

describe('yaml conformance (js-yaml 4 DEFAULT_SCHEMA parity)', () => {
  for (const [section, cases] of Object.entries(sections)) {
    describe(section, () => {
      for (const c of cases) {
        it(c.name, () => {
          expect(normalize(load(c.yaml))).toEqual(normalize(c.expected));
        });
      }
    });
  }

  describe('unmergeable sources throw (v4 parity)', () => {
    const bad: Array<[string, string]> = [
      ['plain scalar source', 'v:\n  <<: foo\n  b: 2'],
      ['null source', 'v:\n  <<:\n  b: 2'],
      ['alias to plain scalar', 'x: &x foo\nv:\n  <<: *x\n  b: 2'],
    ];
    for (const [name, yaml] of bad) {
      it(name, () => {
        expect(() => load(yaml)).toThrow(/cannot merge mappings/);
      });
    }
  });
});
