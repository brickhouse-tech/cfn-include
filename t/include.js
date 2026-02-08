import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import include from '../index.js';
import extendEnv from './tests/extendEnv.js';

import * as yaml from '../lib/yaml.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tests = [
  'inject.json',
  'globs.json',
  'location.json',
  'literal.json',
  'string.json',
  'map.json',
  'flatten.json',
  'jmespath.json',
  'merge.json',
  'errors.js',
  'yaml.js',
  'stringify.json',
  'env.js',
  'outputs.json',
  'camelcase.yml',
  'jmespath.yml',
  'lodash.yml',
  'sequence.yml',
  'deepmerge.yml',
  'extendedmaps.json',
  'omit.json',
  'omitEmpty.json',
  'ifeval.js',
  'eval.js',
  'amzn-intrinsic.yml',
  'joinNow.yml',
  'subNow.yml',
  'refNow.js',
  'applyTags.yml',
  'regression.js',
];
if (process.env.TEST_AWS) tests.push('s3.json');

process.env.README = 'readme';

for (const file of tests) {
  let testFile;
  if (path.posix.extname(file) === '.js') {
    const module = await import(`./tests/${file}`);
    testFile = module.default;
  } else {
    testFile = yaml.load(fs.readFileSync(`t/tests/${file}`, 'utf8'));
  }

  for (const category in testFile) {

    describe(file, function () {
      beforeEach(function () {
        // Reset environment variables before each test
        delete process.env.AWS_REGION;
        delete process.env.AWS_ACCOUNT_NUM;
        delete process.env.AWS_ACCOUNT_ID;
      });
      for (const test of testFile[category]) {
        const fn = test.only ? it.only : it;
        const opts = {
          template: test.template,
          url: `file://${__dirname}/template.json`,
          doEnv: !!test.doEnv || false,
          doEval: !!test.doEval || false,
        };
        if (test.inject) {
          opts.inject = test.inject;
        }
        if (test.refNowIgnoreMissing !== undefined) {
          opts.refNowIgnoreMissing = test.refNowIgnoreMissing;
        }
        if (test.refNowIgnores) {
          opts.refNowIgnores = test.refNowIgnores;
        }
        // console.log(opts);
        fn(test.name || 'include', function (done) {
          extendEnv(test.doEnv, () => {
            include(opts)
              .then(function (json) {
                typeof test.output === 'function'
                  ? assert.ok(test.output(json) === true)
                  : assert.deepEqual(json, test.output);
                done();
              })
              .catch(
                test.catch
                  ? function (err) {
                      assert.ok(test.catch(err) === true);
                      done();
                    }
                  : done,
              );
          });
        });
      }
    });
  }
}
