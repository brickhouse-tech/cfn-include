# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [3.0.0](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.24...v3.0.0) (2026-02-08)

### ⚠ BREAKING CHANGES

* **ESM-only:** Package is now ESM-only. CommonJS `require()` no longer works. Use dynamic `import()` or migrate to ESM.

### Features

* **Phase 3a:** add TypeScript source with build pipeline ([4b576b7](https://github.com/brickhouse-tech/cfn-include/commit/4b576b7))
  - Create src/ directory structure (lib/, types/, lib/include/)
  - Add comprehensive type definitions in src/types/
  - Convert 13 lib files to TypeScript
  - Add main src/index.ts with all Fn:: handlers
  - Configure TypeScript (strict mode, ES2022, NodeNext)

## [2.1.24](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.23...v2.1.24) (2026-02-08)

*Released in error - see 3.0.0*

## [2.1.23](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.22...v2.1.23) (2026-02-08)

*No notable changes*

## [2.1.22](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.21...v2.1.22) (2026-02-08)

### ⚠ BREAKING CHANGES

* **ESM:** Package converted to ES Modules. CommonJS `require()` no longer works.

### Features

* convert to ES Modules (ESM) ([0ceb431](https://github.com/brickhouse-tech/cfn-include/commit/0ceb431))

### Bug Fixes

* convert benchmark runner to ESM ([ba70ddb](https://github.com/brickhouse-tech/cfn-include/commit/ba70ddb))
* rename config files to .cjs for ESM compatibility ([d77608a](https://github.com/brickhouse-tech/cfn-include/commit/d77608a))

## [2.1.21](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.20...v2.1.21) (2026-02-08)

### Refactor

* remove bluebird and path-parse dependencies ([9ae7a59](https://github.com/brickhouse-tech/cfn-include/commit/9ae7a59))

## [2.1.20](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.19...v2.1.20) (2026-02-08)

### Performance

* **Phase 1 optimizations:**
  - async glob for Fn::Include ([6409511](https://github.com/brickhouse-tech/cfn-include/commit/6409511))
  - file content cache for Fn::Include ([0724a23](https://github.com/brickhouse-tech/cfn-include/commit/0724a23))
  - replace simple lodash calls with native alternatives ([0ad6df6](https://github.com/brickhouse-tech/cfn-include/commit/0ad6df6))
  - regex pre-compilation cache in replaceEnv ([34f2e93](https://github.com/brickhouse-tech/cfn-include/commit/34f2e93))
  - Object.create() for O(1) scope creation in Fn::Map ([22aae96](https://github.com/brickhouse-tech/cfn-include/commit/22aae96))

### Tests

* add regression test suite for Phase 1 optimizations ([def9fd2](https://github.com/brickhouse-tech/cfn-include/commit/def9fd2))

## 2.1.19 (2026-02-08)

## 2.1.18 (2026-02-04)

## 2.1.17 (2026-02-04)

## 2.1.16 (2026-01-30)

## 2.1.15 (2026-01-30)

## 2.1.14 (2026-01-27)

## 2.1.13 (2026-01-22)

## 2.1.12 (2026-01-22)

## 2.1.11 (2026-01-22)

## 2.1.10 (2026-01-22)

## 2.1.9 (2026-01-17)

## 2.1.8 (2025-12-24)

## 2.1.7 (2025-12-12)

## 2.1.6 (2025-11-21)


### Bug Fixes

* safeDump to dump ([98393d1](https://github.com/nmccready/cfn-include/commit/98393d1902a7ee681bc5bd214a244a65c0222bec))

## 2.1.5 (2025-11-18)

## 2.1.4 (2025-11-06)

## 2.1.3 (2025-09-01)

## 2.1.2 (2025-05-12)

## 2.1.1 (2025-02-26)

## 2.1.0 (2025-01-21)


### Features

* env file support CFN_INCLUDE_(DO_ENV|DO_EVAL) ([8e6208d](https://github.com/nmccready/cfn-include/commit/8e6208d4762710268da2a2e011576f341a3986d3))

## [2.0.2](https://github.com/nmccready/cfn-include/compare/v2.0.1...v2.0.2) (2025-01-21)

## [2.0.1](https://github.com/nmccready/cfn-include/compare/v2.0.0...v2.0.1) (2024-11-14)


### Bug Fixes

* dependency bump CVE serve ([eed7ac5](https://github.com/nmccready/cfn-include/commit/eed7ac5de3dbb5a0607d8966d1c220857b8cc636))
* **handleIncludeBody:** loopTemplate pass on option doEval ([95dd1a0](https://github.com/nmccready/cfn-include/commit/95dd1a0059fbf4ac37e445cd407c5baec2c3792a))
* scoped to @znemz/cfn-include to publish 2.0.0 ([492e479](https://github.com/nmccready/cfn-include/commit/492e479a8fa8c1e15a33ce3a7962a7cca5affb94))

## [2.0.0](https://github.com/monken/cfn-include/compare/v1.4.1...v2.0.0) (2024-08-24)


### ⚠ BREAKING CHANGES

* capital one features and more Fn::*

### Features

* capital one features and more Fn::* ([3265793](https://github.com/monken/cfn-include/commit/32657939f9ac772e132ba73df7e8fa04b2e33000))
* cli added --context to allow stdin to work with includes ([ee33ba9](https://github.com/monken/cfn-include/commit/ee33ba95bee24ce04b262001f05951947621b27d))
* cli added --context to allow stdin to work with includes ([7f6986f](https://github.com/monken/cfn-include/commit/7f6986fb34dad85c700ecccd70ec2f49895b2523))


### Bug Fixes

* cve globby issue resolved via glob ([7e27d12](https://github.com/monken/cfn-include/commit/7e27d1272996ead317ab6448e672f4787a3d882b))
* make eval opt in for Fn::Eval, Fn::IfEval off by default ([5ec4c02](https://github.com/monken/cfn-include/commit/5ec4c022787cdf9c7515681e43094f9b7ad7e754))
* moved cft-utils out to @znemz/cft-utils to seperate concerns ([80f1c7b](https://github.com/monken/cfn-include/commit/80f1c7b809044a2c297058b9c1fbd902bc32991f))
