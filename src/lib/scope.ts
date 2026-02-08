import type { Scope } from '../types/index.js';

/**
 * Scope helper functions for lazy prototype-chain based scope management.
 *
 * Instead of _.clone(scope) which copies O(n) properties each time,
 * we use Object.create(scope) which creates a child scope in O(1) time
 * that inherits from the parent via the prototype chain.
 */

/**
 * Create a child scope that inherits from the parent.
 * Uses Object.create() for O(1) creation instead of cloning.
 */
export function createChildScope(parent: Scope, additions: Record<string, unknown> = {}): Scope {
  const child = Object.create(parent) as Scope;
  Object.assign(child, additions);
  return child;
}

/**
 * Convert a prototype-chain scope to a plain object.
 * Uses for...in to walk the entire prototype chain.
 */
export function scopeToObject(scope: Scope): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in scope) {
    result[key] = scope[key];
  }
  return result;
}

/**
 * Iterate over all properties in a scope, including inherited ones.
 */
export function forEachInScope(scope: Scope, callback: (value: unknown, key: string) => void): void {
  for (const key in scope) {
    callback(scope[key], key);
  }
}
