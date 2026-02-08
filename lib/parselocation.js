export default function parseLocation(location) {
  if (!location) return {};
  if (!location.match) {
    console.error('location.match is not a function', location);
  }
  const parsed = location.match(/^(((\w+):)?\/\/)?(.*?)([\\\/](.*))?$/);

  return {
    protocol: parsed[3],
    host: parsed[4],
    path: parsed[5],
    relative: parsed[1] === undefined,
    raw: location,
  };
}
