# PHASE 2: ES6/ESM Conversion Analysis

**Date:** 2025-02-08  
**Repository:** brickhouse-tech/cfn-include  
**Package:** @znemz/cfn-include@2.1.18

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current CommonJS Patterns](#current-commonjs-patterns)
3. [Dependency ESM Compatibility](#dependency-esm-compatibility)
4. [Conversion Challenges](#conversion-challenges)
5. [File-by-File Conversion Checklist](#file-by-file-conversion-checklist)
6. [ESM Migration Plan](#esm-migration-plan)
7. [Testing Strategy](#testing-strategy)

---

## Executive Summary

This analysis covers the conversion of cfn-include from CommonJS to ES6 Modules (ESM). The codebase consists of:
- **12 source files** (index.js, bin/cli.js, lib/*.js)
- **7 test files** (t/*.js, t/tests/*.js)

**Key Findings:**
- ✅ No `__dirname`/`__filename` usage in source files (only in tests)
- ✅ No dynamic `require()` calls that would complicate ESM
- ⚠️ The CLI already uses dynamic `import()` for yargs
- ⚠️ One deprecated dependency (`lib/include/api.js` uses `aws-sdk-proxy` - legacy SDK v2)
- ✅ All major dependencies have ESM support or can be replaced

---

## Current CommonJS Patterns

### 1. All `require()` Statements

#### `/index.js` (Main Entry Point)
```javascript
const url = require('url');                    // Node builtin
const path = require('path');                  // Node builtin
const { readFile } = require('fs/promises');   // Node builtin
const _ = require('lodash');                   // Has ESM
const { globSync } = require('glob');          // Has ESM
const Promise = require('bluebird');           // ⚠️ No ESM, needs replacement
const sortObject = require('@znemz/sort-object'); // Internal package
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3'); // Has ESM
const { addProxyToClient } = require('aws-sdk-v3-proxy'); // Has ESM
const pathParse = require('path-parse');       // CJS only, needs replacement
const deepMerge = require('deepmerge');        // Has ESM
const { isTaggableResource } = require('@znemz/cft-utils/src/resources/taggable'); // Internal
const request = require('./lib/request');       // Local
const PromiseExt = require('./lib/promise');    // Local
const yaml = require('./lib/yaml');             // Local
const { getParser } = require('./lib/include/query');     // Local
const parseLocation = require('./lib/parselocation');     // Local
const replaceEnv = require('./lib/replaceEnv'); // Local
const { lowerCamelCase, upperCamelCase } = require('./lib/utils');    // Local
const { isOurExplicitFunction } = require('./lib/schema');            // Local
const { getAwsPseudoParameters, buildResourceArn } = require('./lib/internals'); // Local
```

#### `/bin/cli.js`
```javascript
const exec = require('child_process').execSync;  // Node builtin
const path = require('path');                    // Node builtin
const _ = require('lodash');                     // Has ESM
const pathParse = require('path-parse');         // CJS only
const include = require('../index');              // Local
const yaml = require('../lib/yaml');              // Local
const Client = require('../lib/cfnclient');       // Local
const pkg = require('../package.json');           // ⚠️ JSON import
const replaceEnv = require('../lib/replaceEnv');  // Local

// Already uses dynamic import for ESM packages:
const { default: yargs } = await import('yargs');
const { hideBin } = await import('yargs/helpers');
```

#### `/lib/request.js`
```javascript
var url = require('url');    // Node builtin
var https = require('https'); // Node builtin
var http = require('http');   // Node builtin
```

#### `/lib/promise.js`
```javascript
const Promise = require('bluebird');  // ⚠️ No ESM
const _ = require('lodash');          // Has ESM
```

#### `/lib/include/query.js`
```javascript
const { get } = require("lodash");       // Has ESM
const { search } = require("jmespath");  // Has ESM
```

#### `/lib/include/api.js` (⚠️ DEPRECATED/UNUSED)
```javascript
let AWS = require('aws-sdk-proxy');      // ⚠️ Legacy SDK v2!
let jmespath = require('jmespath');       // Has ESM
```
> **Note:** This file appears unused. It references the deprecated aws-sdk-proxy (v2 SDK). Should be removed or rewritten for v3.

#### `/lib/internals.js`
```javascript
// No requires - pure functions only
```

#### `/lib/schema.js`
```javascript
var yaml = require('js-yaml');  // Has ESM
var _ = require('lodash');       // Has ESM
```

#### `/lib/utils.js`
```javascript
const assert = require('assert').strict;  // Node builtin
```

#### `/lib/yaml.js`
```javascript
const minify = require('jsonminify');  // CJS only
const yaml = require('js-yaml');        // Has ESM
const yamlSchema = require('./schema'); // Local
```

#### `/lib/replaceEnv.js`
```javascript
// No requires - pure functions only
```

#### `/lib/parselocation.js`
```javascript
var { isUndefined } = require('lodash');  // Has ESM
```

#### `/lib/cfnclient.js`
```javascript
const { CloudFormationClient, ValidateTemplateCommand } = require('@aws-sdk/client-cloudformation'); // Has ESM
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');          // Has ESM
const { addProxyToClient } = require('aws-sdk-v3-proxy');  // Has ESM
const { posix: path } = require('path');   // Node builtin
const crypto = require('crypto');          // Node builtin
```

### 2. All `module.exports` Usage

| File | Export Style |
|------|-------------|
| `/index.js` | `module.exports = async function (options) { ... }` |
| `/bin/cli.js` | N/A (CLI entry point, no exports) |
| `/lib/request.js` | `module.exports = function(location) { ... }` |
| `/lib/promise.js` | `module.exports = { mapWhatever, mapX }` |
| `/lib/include/query.js` | `module.exports = { getParser }` |
| `/lib/include/api.js` | `module.exports = function (args) { ... }` |
| `/lib/internals.js` | `module.exports = { getAwsPseudoParameters, buildResourceArn }` |
| `/lib/schema.js` | `module.exports = yaml.DEFAULT_SCHEMA.extend(tags);` + additional exports |
| `/lib/utils.js` | `module.exports = { lowerCamelCase, upperCamelCase }` |
| `/lib/yaml.js` | `module.exports = { load, dump }` |
| `/lib/replaceEnv.js` | `module.exports = replaceEnv;` + `replaceEnv.IsRegExVar = IsRegExVar;` |
| `/lib/parselocation.js` | `module.exports = function parseLocation(location) { ... }` |
| `/lib/cfnclient.js` | `module.exports = Client;` |

### 3. Dynamic Requires Analysis

**Good news:** There are **no problematic dynamic requires** in the source code.

The only dynamic-looking pattern is in the test files:
```javascript
// t/include.js - This is a computed test file path
require(`./tests/${file}`)

// t/cli.js - Same pattern for test loading
require(`./tests/${file}.json`)
```

These test patterns can be converted to dynamic `import()` easily.

### 4. Circular Dependency Analysis

**Dependency Graph:**
```
index.js
├── lib/request.js          (no deps on lib/)
├── lib/promise.js          (no deps on lib/)
├── lib/yaml.js             (depends on lib/schema.js)
│   └── lib/schema.js       (no deps on lib/)
├── lib/include/query.js    (no deps on lib/)
├── lib/parselocation.js    (no deps on lib/)
├── lib/replaceEnv.js       (no deps on lib/)
├── lib/utils.js            (no deps on lib/)
├── lib/schema.js           (no deps on lib/)
└── lib/internals.js        (no deps on lib/)

bin/cli.js
├── index.js (circular OK - no issue at runtime)
├── lib/yaml.js
├── lib/cfnclient.js
│   └── (no deps on lib/)
└── lib/replaceEnv.js
```

**Result: No circular dependencies exist.**

---

## Dependency ESM Compatibility

### NPM Dependencies Analysis

| Package | Version | ESM Support | Recommendation |
|---------|---------|-------------|----------------|
| `lodash` | ^4.17.21 | ✅ Via `lodash-es` | Replace with `lodash-es` or cherry-pick imports |
| `bluebird` | ^3.7.2 | ❌ No ESM | **Replace with native Promise** |
| `js-yaml` | ^4.1.1 | ✅ Has ESM | Direct import works |
| `glob` | ^13.0.0 | ✅ Pure ESM | Already compatible |
| `deepmerge` | ^4.2.2 | ✅ Has ESM | Direct import works |
| `jmespath` | ^0.16.0 | ✅ Has ESM | Direct import works |
| `jsonminify` | ^0.4.1 | ❌ CJS only | Replace with `minify-json` or inline |
| `path-parse` | ~1.0.7 | ❌ CJS only | **Replace with Node `path.parse()`** |
| `@aws-sdk/client-s3` | ^3.637.0 | ✅ Full ESM | Direct import works |
| `@aws-sdk/client-cloudformation` | ^3.637.0 | ✅ Full ESM | Direct import works |
| `aws-sdk-v3-proxy` | 2.2.0 | ✅ Has ESM | Direct import works |
| `@znemz/sort-object` | ^3.0.4 | ⚠️ Check | Internal package, convert as needed |
| `@znemz/cft-utils` | 0.1.33 | ⚠️ Check | Internal package, convert as needed |
| `yargs` | ~18.0.0 | ✅ Pure ESM | Already imported dynamically |

### Replacements Needed

#### 1. `bluebird` → Native Promise + Custom Helpers
Bluebird is used for:
- `Promise.props()` - Map object values to promises
- `Promise.map()` - Concurrent array mapping
- `Promise.try()` - Safe promise start

**Native replacements:**
```javascript
// Promise.props equivalent
async function promiseProps(obj) {
  const entries = Object.entries(obj);
  const values = await Promise.all(entries.map(([, v]) => v));
  return Object.fromEntries(entries.map(([k], i) => [k, values[i]]));
}

// Promise.map equivalent (with concurrency)
async function promiseMap(arr, fn, { concurrency = Infinity } = {}) {
  if (concurrency === Infinity) return Promise.all(arr.map(fn));
  const results = [];
  for (let i = 0; i < arr.length; i += concurrency) {
    const chunk = arr.slice(i, i + concurrency);
    results.push(...await Promise.all(chunk.map((item, j) => fn(item, i + j))));
  }
  return results;
}

// Promise.try equivalent
const promiseTry = (fn) => new Promise((resolve) => resolve(fn()));
```

#### 2. `path-parse` → Native `path.parse()`
```javascript
// Before
const pathParse = require('path-parse');
const parsed = pathParse('/foo/bar.json');

// After
import path from 'node:path';
const parsed = path.parse('/foo/bar.json');
```

#### 3. `jsonminify` → Inline implementation or alternative
```javascript
// Simple JSON minify (remove comments and whitespace)
function jsonMinify(json) {
  return JSON.stringify(JSON.parse(json));
}
// Note: This loses comment support. May need more complex solution if comments are used.
```

---

## Conversion Challenges

### 1. `__dirname` / `__filename` Replacements

**Source files:** ✅ **No usage found!**

**Test files only:**
```javascript
// t/include.js line 65
url: `file://${__dirname}/template.json`
```

**ESM Replacement:**
```javascript
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

### 2. JSON Imports

The CLI imports `package.json`:
```javascript
const pkg = require('../package.json');
```

**ESM options:**
```javascript
// Option 1: Import assertion (Node 18+, experimental)
import pkg from '../package.json' with { type: 'json' };

// Option 2: Read and parse (safest)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

// Option 3: createRequire (hybrid approach)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
```

### 3. Top-Level Await Opportunities

The CLI already uses top-level await (wrapped in IIFE). Can simplify:
```javascript
// Current (wrapped IIFE)
(async () => {
  const { default: yargs } = await import('yargs');
  // ...
})();

// ESM with top-level await
const { default: yargs } = await import('yargs');
// ... rest of code
```

### 4. Dynamic Imports in Tests

```javascript
// Current
const testFile = require(`./tests/${file}`);

// ESM
const testFile = await import(`./tests/${file}`);
```

### 5. Default Export Pattern Change

```javascript
// Current (CommonJS)
module.exports = async function (options) { ... }

// ESM equivalent
export default async function (options) { ... }
```

---

## File-by-File Conversion Checklist

### Conversion Order (Leaf Dependencies First)

| Order | File | Complexity | Dependencies | Notes |
|-------|------|------------|--------------|-------|
| 1 | `/lib/internals.js` | 🟢 Easy | None | Pure functions, no requires |
| 2 | `/lib/replaceEnv.js` | 🟢 Easy | None | Pure functions, no requires |
| 3 | `/lib/utils.js` | 🟢 Easy | `assert` | Only Node builtin |
| 4 | `/lib/parselocation.js` | 🟢 Easy | `lodash` | Single lodash import |
| 5 | `/lib/request.js` | 🟢 Easy | `url`, `http`, `https` | All Node builtins |
| 6 | `/lib/schema.js` | 🟡 Medium | `js-yaml`, `lodash` | Creates YAML schema |
| 7 | `/lib/yaml.js` | 🟡 Medium | `jsonminify`, `js-yaml`, local | jsonminify needs replacement |
| 8 | `/lib/include/query.js` | 🟢 Easy | `lodash`, `jmespath` | Small file |
| 9 | `/lib/promise.js` | 🟡 Medium | `bluebird`, `lodash` | **Bluebird replacement needed** |
| 10 | `/lib/cfnclient.js` | 🟡 Medium | AWS SDK, `path`, `crypto` | Class export |
| 11 | `/lib/include/api.js` | 🔴 Complex | `aws-sdk-proxy` (v2!) | **Consider removing/rewriting** |
| 12 | `/index.js` | 🔴 Complex | Many deps | Main module, many imports |
| 13 | `/bin/cli.js` | 🟡 Medium | Local modules, yargs | CLI entry point |

### Test File Conversion (After Source)

| File | Notes |
|------|-------|
| `/t/include.js` | Uses `__dirname`, dynamic require |
| `/t/cli.js` | Uses child_process, dynamic require |
| `/t/replaceEnv.js` | Simple, one assertion |
| `/t/tests/extendEnv.js` | Uses lodash |
| `/t/tests/yaml.js` | Uses assert |
| `/t/tests/*.js` | Data files, minimal changes |

---

## ESM Migration Plan

### Phase 2A: Package.json Configuration

```json
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./index.js",
      "require": "./dist/index.cjs"
    },
    "./lib/*": {
      "import": "./lib/*.js",
      "require": "./dist/lib/*.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./index.js",
  "engines": {
    "node": ">=20.19"
  }
}
```

### Phase 2B: Replace Dependencies

1. **Remove `bluebird`** - Replace with native Promise helpers
2. **Remove `path-parse`** - Use Node's built-in `path.parse()`
3. **Replace `jsonminify`** - Inline or use ESM alternative
4. **Update `lodash`** - Use `lodash-es` or individual imports
5. **Remove `lib/include/api.js`** - Unused legacy code

### Phase 2C: Convert Files (In Order)

1. **Add ESM polyfills file** (`/lib/esm-compat.js`):
   ```javascript
   // Polyfills for CJS patterns
   import { fileURLToPath } from 'node:url';
   import { dirname } from 'node:path';
   
   export const getDirname = (importMetaUrl) => 
     dirname(fileURLToPath(importMetaUrl));
   
   export async function promiseProps(obj) { /* ... */ }
   export async function promiseMap(arr, fn) { /* ... */ }
   ```

2. **Convert leaf modules** (internals, utils, replaceEnv, parselocation, request)
3. **Convert intermediate modules** (schema, yaml, query, promise)
4. **Convert main module** (index.js)
5. **Convert CLI** (bin/cli.js)
6. **Convert tests**

### Phase 2D: Dual Package Support (Optional)

For backwards compatibility, build CJS versions:

```bash
# Using esbuild for CJS transpilation
npx esbuild index.js --bundle --platform=node --format=cjs --outfile=dist/index.cjs
npx esbuild lib/*.js --platform=node --format=cjs --outdir=dist/lib
```

### Phase 2E: Bun Compatibility

**Status:** Bun is not installed on this system.

**Bun Considerations:**
- ✅ Bun supports ESM natively
- ✅ Bun has built-in `Bun.file()` for file reading
- ⚠️ Some Node APIs may differ slightly
- ✅ Test with `bun test` after conversion

**Recommendation:** After ESM conversion, add Bun to CI:
```yaml
# .github/workflows/test.yml
jobs:
  test-bun:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun test
```

---

## Testing Strategy

### Between Each Conversion Step

1. **Run existing tests** after each file conversion
   ```bash
   npm test
   ```

2. **Verify CLI works**
   ```bash
   echo '{"Fn::Include": "t/fixtures/simple.json"}' | node bin/cli.js
   ```

3. **Check for import errors**
   ```bash
   node --experimental-vm-modules -e "import('./index.js').then(m => console.log('OK', typeof m.default))"
   ```

### Full Test Strategy

1. **Unit tests** - Convert Mocha tests to ESM
2. **CLI tests** - Keep child_process spawning
3. **Integration tests** - Test with real templates
4. **Cross-runtime** - Test on Node 20, 22, and Bun

### ESM Test Configuration

Update `mocha` config for ESM:
```javascript
// mocha.config.mjs
export default {
  timeout: 20000,
  bail: true,
  spec: ['t/**/*.js'],
  // Enable experimental ESM loader
  'node-option': ['experimental-vm-modules']
};
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes | Medium | High | Dual CJS/ESM package |
| Bluebird removal breaks async | Low | High | Comprehensive test coverage |
| Test failures | Medium | Medium | Convert tests incrementally |
| Dependency ESM issues | Low | Medium | Pin versions, test thoroughly |

---

## Conclusion

The cfn-include codebase is **well-suited for ESM conversion**:
- No circular dependencies
- No problematic dynamic requires
- No `__dirname`/`__filename` in source (only tests)
- Most dependencies have ESM support
- Clean separation of concerns

**Estimated effort:** 2-3 days for full conversion with testing.

**Recommended approach:**
1. Start with leaf dependencies (lib/*.js)
2. Convert main index.js
3. Convert CLI
4. Convert tests
5. Add dual package support if needed
6. Test on Node 20/22 and Bun
