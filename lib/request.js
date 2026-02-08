import { parse as urlParse } from 'node:url';
import https from 'node:https';
import http from 'node:http';

export default function request(location) {
  const parsed = urlParse(location);
  const proto = parsed.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) =>
    proto
      .get(location, (res) => {
        if (res.statusCode > 299) {
          return reject(new Error('HTTP request failed with status code ' + res.statusCode));
        }
        const rawData = [];
        res.setEncoding('utf8');
        res.on('data', (chunk) => rawData.push(chunk));
        res.on('end', () => resolve(rawData.join('')));
      })
      .on('error', reject),
  );
}
