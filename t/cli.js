import assert from 'node:assert';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import extendEnv from './tests/extendEnv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = ['cli'];

for (const file of files) {
  const tests = JSON.parse(readFileSync(path.join(__dirname, `tests/${file}.json`), 'utf8'));

  for (const category in tests) {

    describe(category, function () {
      for (const test of tests[category]) {
        const fn = test.only ? it.only : it;
        fn(test.name || 'include', function (done) {
          let cliArgs = test.template ? ['bin/cli.js', test.template] : ['bin/cli.js'];
          if (test.args) {
            cliArgs = cliArgs.concat(test.args);
          }
          extendEnv(test.env, () => {
            // console.log({ cliArgs });
            const proc = execFile('node', cliArgs, function (err, out, stderr) {
              // console.log({ out });
              if (test.exitCode) {
                assert.ok(stderr.match(new RegExp(test.errorMessage)), 'stderr match');
                assert.equal(test.exitCode, err.code, 'exit code');
                return done();
              }
              // console.log({out: out.toString()})
              out = out || '{}'; // fix for empty output to see failed test
              const json = JSON.parse(out.toString());
              delete json.Metadata;
              assert.deepEqual(json, test.output);
              done();
            });
            if (test.stdin) {
              proc.stdin.write(test.stdin);
              proc.stdin.end();
            }
          });
        });
      }
    });
  }
}
