/**
 * File content cache to avoid redundant disk I/O.
 */

const { readFile } = require('fs/promises');

// File content cache to avoid re-reading the same files
const fileCache = new Map();

/**
 * Read a file with caching to avoid redundant disk I/O
 * @param {string} absolutePath - Absolute path to the file
 * @returns {Promise<string>} File content as a string
 */
async function cachedReadFile(absolutePath) {
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
function clearFileCache() {
  fileCache.clear();
}

module.exports = {
  cachedReadFile,
  clearFileCache,
};
