/**
 * Native Promise utilities to replace bluebird.
 * These are drop-in replacements for the bluebird methods we use.
 */

/**
 * Promise.props replacement - resolves an object of promises.
 * @param {Object} obj - Object with promise values
 * @returns {Promise<Object>} Object with resolved values
 */
async function promiseProps(obj) {
  const keys = Object.keys(obj);
  const values = await Promise.all(keys.map((key) => obj[key]));
  const result = {};
  for (let i = 0; i < keys.length; i++) {
    result[keys[i]] = values[i];
  }
  return result;
}

/**
 * Promise.try replacement - wraps a function to catch sync errors.
 * @param {Function} fn - Function to execute
 * @returns {Promise} Promise that resolves to fn result or rejects on error
 */
function promiseTry(fn) {
  return new Promise((resolve, reject) => {
    try {
      resolve(fn());
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Promise.map replacement - maps over array with concurrency.
 * @param {Array} arr - Array to map over
 * @param {Function} fn - Async function to apply
 * @returns {Promise<Array>} Array of resolved values
 */
function promiseMap(arr, fn) {
  return Promise.all(arr.map(fn));
}

export { promiseProps, promiseTry, promiseMap };
