# Phase 3 Completion: Test Migration & Legacy Cleanup

## Problem Statement

The TypeScript source migration is complete (`src/` → `dist/`), and new vitest tests exist in `test/`, but old JS test runners in `t/` remain alongside legacy JS source shims. We need to verify full test coverage parity, clean up dead files, and ensure the test suite runs green.

## Coverage Analysis

### Already Migrated (✅ Full Parity)

| Old File | New File | Status |
|----------|----------|--------|
| `t/include.js` | `test/include.test.ts` | ✅ Same 30 fixture files loaded |
| `t/cli.js` | `test/cli.test.ts` | ✅ Loads `t/tests/cli.json` |
| `t/replaceEnv.js` | `test/replaceEnv.test.ts` | ✅ Expanded (4 tests vs 1) |
| `t/tests/extendEnv.js` | `test/helpers.ts` (`withEnvAsync`) | ✅ Replaced with proper cleanup |

### NOT Migrated / Gaps

| Old File | Issue | Priority |
|----------|-------|----------|
| `t/unit.js` | Trivial — just `console.log(parseLocation(...))`. Not a real test. | Low (delete) |
| `t/tests/api.js` | AWS API integration tests (EC2 describeRegions). Not in new TEST_FILES list. Not in old default list either — old `t/include.js` doesn't load it. | Low (out of scope) |
| `s3.json` conditional | Old `t/include.js` has `if (process.env.TEST_AWS) tests.push('s3.json')`. New `test/include.test.ts` does not. | Low (add conditional) |

### Key Finding

**The new TS tests have FULL PARITY with the old JS tests.** Both load the exact same 30 fixture files. The new tests additionally have better env cleanup (proper save/restore vs lodash omit which was buggy in the old code). The `replaceEnv` tests are expanded.

## Legacy JS Files Analysis

### Shim Files (Keep or Remove?)

| File | Purpose | Verdict |
|------|---------|---------|
| `index.js` | Re-exports `./dist/index.js` | **DELETE** — `package.json` exports already point to `dist/`. No consumer should use this. |
| `bin/cli.js` | Imports `../dist/cli.js` | **KEEP** — `test/cli.test.ts` runs `node bin/cli.js`. Could update test to use `dist/cli.js` directly, then delete. |
| `lib/*.js` (10 files) | Old source code, replaced by `src/lib/*.ts` → `dist/lib/*.js` | **DELETE** — `package.json` exports use `./dist/lib/*`. Not imported by anything except old `t/` tests. |

### Test Fixture Files (KEEP)

These are **still used** by the new TS tests via `test/helpers.ts`:
- `t/tests/*.json` and `t/tests/*.js` — test fixture/case definitions
- `t/includes/` — include fixture files referenced by test cases
- `t/fixtures/` — additional fixture files
- `t/regression-fixtures/` — regression test fixtures

**Do NOT delete the `t/` directory entirely** — only the JS test runners.

---

## Tasks for Engineer

### 1. Fix Test Suite to Run Green
- [ ] Run `npm install` and `npm test` — confirm current state
- [ ] Fix any build errors in `npm run build` (tsc)
- [ ] Fix any test failures in `npm run test:run` (vitest)

### 2. Delete Old JS Test Runners
- [ ] Delete `t/cli.js` (replaced by `test/cli.test.ts`)
- [ ] Delete `t/include.js` (replaced by `test/include.test.ts`)
- [ ] Delete `t/replaceEnv.js` (replaced by `test/replaceEnv.test.ts`)
- [ ] Delete `t/unit.js` (not a real test, just a console.log)
- [ ] Delete `t/tests/extendEnv.js` (replaced by `test/helpers.ts`)

### 3. Delete Legacy JS Source Files
- [ ] Delete `index.js` (shim to dist — package.json exports handle this)
- [ ] Delete `lib/cache.js`
- [ ] Delete `lib/cfnclient.js`
- [ ] Delete `lib/include/api.js`
- [ ] Delete `lib/include/query.js`
- [ ] Delete `lib/internals.js`
- [ ] Delete `lib/parselocation.js`
- [ ] Delete `lib/promise-utils.js`
- [ ] Delete `lib/promise.js`
- [ ] Delete `lib/replaceEnv.js`
- [ ] Delete `lib/request.js`
- [ ] Delete `lib/schema.js`
- [ ] Delete `lib/scope.js`
- [ ] Delete `lib/utils.js`
- [ ] Delete `lib/yaml.js`

### 4. Handle bin/cli.js
- [ ] Option A: Update `test/cli.test.ts` to use `dist/cli.js` instead of `bin/cli.js`, then delete `bin/cli.js` and remove `bin/` dir
- [ ] Option B: Keep `bin/cli.js` as a thin shim (it's only 2 lines). Update `package.json` bin to point to `dist/cli.js` if not already.
- [ ] **Decision:** package.json already has `"bin": { "cfn-include": "./dist/cli.js" }` → `bin/cli.js` is dead code. Go with Option A.

### 5. Add Conditional S3 Test Support
- [ ] In `test/include.test.ts`, add: `if (process.env.TEST_AWS) TEST_FILES.push('s3.json');` to match old behavior

### 6. Move Test Fixtures (Optional, Low Priority)
- [ ] Consider moving `t/tests/`, `t/includes/`, `t/fixtures/`, `t/regression-fixtures/` to `test/fixtures/` for cleaner structure
- [ ] If moved, update paths in `test/helpers.ts` (`FIXTURES_DIR`, `INCLUDES_DIR`, `TEST_TEMPLATE_URL`)
- [ ] If moved, update paths inside fixture JSON files that reference relative paths (e.g., `../includes/...`)
- [ ] **Note:** This is risky due to relative path references in fixtures. Skip unless explicitly requested.

### 7. Verify and Confirm
- [ ] `npm run build` passes
- [ ] `npm run test` passes (all vitest tests green)
- [ ] `npm run typecheck` passes
- [ ] No remaining references to deleted files (grep for `lib/` imports, `index.js` imports)
- [ ] `git diff --stat` shows only deletions + minor edits

---

## Complexity Assessment

**Overall: Low-Moderate**

The heavy lifting (TS source conversion, new test harness) is already done. This is cleanup work:
- Deleting ~20 files
- 1 small test edit (cli.test.ts path or s3 conditional)
- Verification

Estimated time: 1-2 hours.

## Risks

1. **Fixture path breakage** — The new tests reference `t/tests/` and `t/includes/`. Deleting test *runners* is safe; deleting fixture *data* would break everything.
2. **bin/cli.js used externally** — Unlikely since package.json bin points to dist, but check git history for any documentation referencing it.
3. **index.js used by consumers** — package.json exports cover `./dist/index.js`. The root `index.js` shim is redundant. If any consumer does `require('cfn-include')` without respecting exports, they'd break — but this package is ESM-only (`"type": "module"`).
