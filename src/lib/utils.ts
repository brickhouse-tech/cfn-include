import assert from 'node:assert/strict';

export function upperCamelCase(str: string): string {
  assert(typeof str === 'string', 'argument to upper/lowerCamelCase must be a string');
  return str
    .split(/[\._-\s]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');
}

export function lowerCamelCase(str: string): string {
  const upper = upperCamelCase(str);
  return upper.charAt(0).toLowerCase() + upper.slice(1);
}
