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
 *
 * @param {Object} parent - The parent scope to inherit from
 * @param {Object} [additions={}] - Properties to add to the child scope
 * @returns {Object} A new child scope with prototype chain to parent
 */
function createChildScope(parent, additions = {}) {
  const child = Object.create(parent);
  Object.assign(child, additions);
  return child;
}

/**
 * Convert a prototype-chain scope to a plain object.
 * Uses for...in to walk the entire prototype chain.
 *
 * Useful when we need to pass scope to functions that don't
 * walk the prototype chain (e.g., Object.keys, _.forEach).
 *
 * @param {Object} scope - The scope to flatten
 * @returns {Object} A plain object with all inherited properties
 */
function scopeToObject(scope) {
  const result = {};
  for (const key in scope) {
    result[key] = scope[key];
  }
  return result;
}

/**
 * Iterate over all properties in a scope, including inherited ones.
 * This is a replacement for _.forEach that walks the prototype chain.
 *
 * @param {Object} scope - The scope to iterate over
 * @param {Function} callback - Function to call with (value, key)
 */
function forEachInScope(scope, callback) {
  for (const key in scope) {
    callback(scope[key], key);
  }
}

module.exports = {
  createChildScope,
  scopeToObject,
  forEachInScope,
};
