import { promiseTry, promiseMap } from './promise-utils.js';

/**
 * Maps over objects or iterables just like lodash.
 */
export function mapWhatever<T, R>(
  promises: T[] | Record<string, T> | Promise<T[] | Record<string, T>>,
  cb: (value: T, key: string | number, size: number) => R | Promise<R>,
): Promise<R[]> {
  return promiseTry(() =>
    Promise.resolve(promises).then((arrayOrObject) => {
      if (Array.isArray(arrayOrObject)) {
        return promiseMap(arrayOrObject, (item, index) => cb(item, index, arrayOrObject.length));
      }
      const entries = Object.entries(arrayOrObject);
      const size = entries.length;
      return Promise.all(entries.map(([key, value]) => cb(value, key, size)));
    }),
  );
}

export { mapWhatever as mapX };
