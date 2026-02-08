/**
 * Regression tests for cfn-include Phase 1 optimizations.
 * 
 * These tests ensure the Object.create() scope chain and other
 * optimizations don't break existing behavior.
 * 
 * Key areas tested:
 * - Nested Fn::Map scope inheritance (prototype chain)
 * - Scope variable shadowing
 * - Edge cases (empty arrays, nulls, booleans)
 * - Large dataset handling (performance regression)
 * 
 * Fn::Map semantics:
 * - When iterating arrays: _ (or placeholder) = value, index = array index
 * - When iterating objects: _ (or placeholder) = value, index = key name
 * - Use [placeholder, indexVar] format to access the key/index
 */

const fs = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, '..', 'regression-fixtures');

// Load fixtures
const nested3Levels = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, 'nested-3-levels.json')),
);
const scopeCollision = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, 'scope-collision.json')),
);
const edgeCases = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, 'edge-cases.json')),
);

module.exports = {
  'Scope Chain Regression': [
    {
      name: 'Nested 3-level Fn::Map with scope inheritance',
      template: nested3Levels.template,
      output: nested3Levels.expected,
    },
    {
      name: 'Scope collision - inner shadows outer correctly',
      template: scopeCollision.template,
      output: scopeCollision.expected,
    },
  ],

  'Edge Cases': edgeCases.tests.map(test => ({
    name: test.name,
    template: test.template,
    output: test.expected,
  })),

  'Scope Variable Access': [
    {
      name: 'Access parent scope variable with custom placeholder',
      template: {
        'Fn::Map': [
          ['first', 'second'],
          '$',
          {
            current: '$',
            nested: {
              'Fn::Map': [
                ['a', 'b'],
                {
                  inner: '_',
                  outer: '$',
                },
              ],
            },
          },
        ],
      },
      output: [
        {
          current: 'first',
          nested: [
            { inner: 'a', outer: 'first' },
            { inner: 'b', outer: 'first' },
          ],
        },
        {
          current: 'second',
          nested: [
            { inner: 'a', outer: 'second' },
            { inner: 'b', outer: 'second' },
          ],
        },
      ],
    },
    {
      // When iterating over an object, use index placeholder to get the key
      name: 'Object iteration with index placeholder gives key access',
      template: {
        'Fn::Map': [
          { x: 1, y: 2 },
          ['val', 'key'],  // val = value, key = object key
          {
            theKey: 'key',
            theValue: 'val',
          },
        ],
      },
      output: [
        { theKey: 'x', theValue: 1 },
        { theKey: 'y', theValue: 2 },
      ],
    },
  ],

  'Fn::Flatten with scope': [
    {
      name: 'Flatten preserves scope access',
      template: {
        'Fn::Flatten': {
          'Fn::Map': [
            ['a', 'b'],
            [{ item: '_' }, { item: '_' }],
          ],
        },
      },
      output: [
        { item: 'a' },
        { item: 'a' },
        { item: 'b' },
        { item: 'b' },
      ],
    },
  ],

  'Fn::Merge with scope': [
    {
      name: 'Merge combines map results',
      template: {
        'Fn::Merge': {
          'Fn::Map': [
            ['a', 'b', 'c'],
            { '_': true },
          ],
        },
      },
      output: { a: true, b: true, c: true },
    },
  ],

  'Object iteration in Map': [
    {
      name: 'Map over object - default placeholder gets value',
      template: {
        'Fn::Map': [
          { alpha: 'A', beta: 'B', gamma: 'G' },
          { value: '_' },  // _ = value from object
        ],
      },
      output: [
        { value: 'A' },
        { value: 'B' },
        { value: 'G' },
      ],
    },
    {
      name: 'Map over object with key access via index placeholder',
      template: {
        'Fn::Map': [
          { alpha: 'A', beta: 'B' },
          ['val', 'key'],
          {
            k: 'key',
            v: 'val',
          },
        ],
      },
      output: [
        { k: 'alpha', v: 'A' },
        { k: 'beta', v: 'B' },
      ],
    },
  ],

  'Performance sanity checks': [
    {
      name: 'Map with 50 items completes',
      template: {
        'Fn::Map': [
          Array.from({ length: 50 }, (_, i) => `item-${i}`),
          { id: '_', processed: true },
        ],
      },
      output: function (res) {
        return (
          Array.isArray(res) &&
          res.length === 50 &&
          res[0].id === 'item-0' &&
          res[49].id === 'item-49'
        );
      },
    },
    {
      name: 'Nested map with 10x10 items',
      template: {
        'Fn::Map': [
          Array.from({ length: 10 }, (_, i) => `outer-${i}`),
          'outer',
          {
            outer: 'outer',
            inner: {
              'Fn::Map': [
                Array.from({ length: 10 }, (_, i) => `inner-${i}`),
                { inner: '_', parent: 'outer' },
              ],
            },
          },
        ],
      },
      output: function (res) {
        return (
          Array.isArray(res) &&
          res.length === 10 &&
          res[0].inner.length === 10 &&
          res[0].inner[0].parent === 'outer-0'
        );
      },
    },
  ],
};
