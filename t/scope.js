/**
 * Unit tests for lib/scope.js
 */

const assert = require('assert');
const { createChildScope, scopeToObject, forEachInScope } = require('../lib/scope');

describe('lib/scope.js', function () {
  describe('createChildScope', function () {
    it('creates a child scope that inherits from parent', function () {
      const parent = { a: 1, b: 2 };
      const child = createChildScope(parent);

      assert.strictEqual(child.a, 1);
      assert.strictEqual(child.b, 2);
    });

    it('allows adding properties to child scope', function () {
      const parent = { a: 1 };
      const child = createChildScope(parent, { b: 2 });

      assert.strictEqual(child.a, 1);
      assert.strictEqual(child.b, 2);
    });

    it('child properties shadow parent properties', function () {
      const parent = { a: 1, b: 2 };
      const child = createChildScope(parent, { a: 'overridden' });

      assert.strictEqual(child.a, 'overridden');
      assert.strictEqual(child.b, 2);
    });

    it('modifications to child do not affect parent', function () {
      const parent = { a: 1 };
      const child = createChildScope(parent);
      child.a = 999;
      child.newProp = 'new';

      assert.strictEqual(parent.a, 1);
      assert.strictEqual(parent.newProp, undefined);
    });

    it('supports multiple levels of inheritance', function () {
      const grandparent = { level: 'grandparent', a: 1 };
      const parent = createChildScope(grandparent, { level: 'parent', b: 2 });
      const child = createChildScope(parent, { level: 'child', c: 3 });

      assert.strictEqual(child.level, 'child');
      assert.strictEqual(child.a, 1);
      assert.strictEqual(child.b, 2);
      assert.strictEqual(child.c, 3);
    });
  });

  describe('scopeToObject', function () {
    it('flattens prototype chain to plain object', function () {
      const parent = { a: 1, b: 2 };
      const child = createChildScope(parent, { c: 3 });
      const flat = scopeToObject(child);

      assert.strictEqual(flat.a, 1);
      assert.strictEqual(flat.b, 2);
      assert.strictEqual(flat.c, 3);
      assert.strictEqual(Object.getPrototypeOf(flat), Object.prototype);
    });

    it('child properties take precedence when flattening', function () {
      const parent = { a: 1 };
      const child = createChildScope(parent, { a: 'overridden' });
      const flat = scopeToObject(child);

      assert.strictEqual(flat.a, 'overridden');
    });
  });

  describe('forEachInScope', function () {
    it('iterates over all properties including inherited', function () {
      const parent = { a: 1, b: 2 };
      const child = createChildScope(parent, { c: 3 });
      const collected = {};

      forEachInScope(child, (value, key) => {
        collected[key] = value;
      });

      assert.deepStrictEqual(collected, { a: 1, b: 2, c: 3 });
    });

    it('sees shadowed values from child', function () {
      const parent = { a: 1 };
      const child = createChildScope(parent, { a: 'shadowed' });
      const collected = {};

      forEachInScope(child, (value, key) => {
        collected[key] = value;
      });

      assert.strictEqual(collected.a, 'shadowed');
    });
  });
});
