/**
 * Native Promise utilities to replace bluebird.
 * These are drop-in replacements for the bluebird methods we use.
 */

/**
 * Promise.props replacement - resolves an object of promises.
 */
export async function promiseProps<T extends Record<string, unknown>>(
  obj: T,
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const keys = Object.keys(obj) as Array<keyof T>;
  const values = await Promise.all(keys.map((key) => obj[key]));
  const result = {} as { [K in keyof T]: Awaited<T[K]> };
  for (let i = 0; i < keys.length; i++) {
    result[keys[i]] = values[i] as Awaited<T[keyof T]>;
  }
  return result;
}

/**
 * Promise.try replacement - wraps a function to catch sync errors.
 */
export function promiseTry<T>(fn: () => T | Promise<T>): Promise<T> {
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
 */
export function promiseMap<T, R>(arr: T[], fn: (item: T, index: number) => R | Promise<R>): Promise<R[]> {
  return Promise.all(arr.map(fn));
}
