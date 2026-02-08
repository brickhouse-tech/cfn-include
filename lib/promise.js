import { promiseTry, promiseMap } from './promise-utils.js';

/*
  Maps over objects or iterables just like lodash.
*/
const mapWhatever = (promises, cb) =>
  promiseTry(() =>
    Promise.resolve(promises).then((arrayOrObject) => {
      if (Array.isArray(arrayOrObject)) {
        return promiseMap(arrayOrObject, cb);
      }
      const size = Object.values(arrayOrObject).length;
      const entries = Object.entries(arrayOrObject);
      return Promise.all(entries.map(([key, value]) => cb(value, key, size)));
    }),
  );

export { mapWhatever, mapWhatever as mapX };
