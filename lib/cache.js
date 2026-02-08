/**
 * File content cache to avoid redundant disk I/O.
 */

import { readFile } from 'node:fs/promises';

// File content cache to avoid re-reading the same files
const fileCache = new Map();

/**
 * Read a file with caching to avoid redundant disk I/O
 * @param {string} absolutePath - Absolute path to the file
 * @returns {Promise<string>} File content as a string
 */
export async function cachedReadFile(absolutePath) {
  if (fileCache.has(absolutePath)) {
    return fileCache.get(absolutePath);
  }
  const content = await readFile(absolutePath, 'utf8');
  fileCache.set(absolutePath, content);
  return content;
}

/**
 * Clear the file cache (useful for testing)
 */
export function clearFileCache() {
  fileCache.clear();
}
