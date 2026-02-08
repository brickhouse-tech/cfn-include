import type { ParsedLocation } from '../types/index.js';

export default function parseLocation(location: string | undefined | null): ParsedLocation {
  if (!location) return { relative: true };
  if (typeof location !== 'string' || !location.match) {
    console.error('location.match is not a function', location);
  }
  const parsed = location.match(/^(((\w+):)?\/\/)?(.*?)([\\\/](.*))?$/);

  if (!parsed) {
    return { relative: true, raw: location };
  }

  return {
    protocol: parsed[3],
    host: parsed[4],
    path: parsed[5],
    relative: parsed[1] === undefined,
    raw: location,
  };
}
