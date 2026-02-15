# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [4.1.4](https://github.com/brickhouse-tech/cfn-include/compare/v4.1.3...v4.1.4) (2026-02-15)


### Refactor

* add recursion depth tracking and limit (MAX_RECURSE_DEPTH=100) ([05fba95](https://github.com/brickhouse-tech/cfn-include/commit/05fba95f2b50e4251d97d2bfbc15a1bed9a168e2))
* extract all Fn:: handlers into modular files under src/lib/functions/ ([b70eccb](https://github.com/brickhouse-tech/cfn-include/commit/b70eccb22bffeb49492d05f6cd177d21a61b39ba))

## [4.1.3](https://github.com/brickhouse-tech/cfn-include/compare/v4.1.2...v4.1.3) (2026-02-15)

## [4.1.2](https://github.com/brickhouse-tech/cfn-include/compare/v4.1.1...v4.1.2) (2026-02-14)


### Bug Fixes

* **deps:** add globals and @eslint/js for eslint 10 ([3d6a39a](https://github.com/brickhouse-tech/cfn-include/commit/3d6a39a814827de1f751f9bcb3954d76b9052ed9))
* **deps:** bump the all group across 1 directory with 7 updates ([ddd66b6](https://github.com/brickhouse-tech/cfn-include/commit/ddd66b676be60bf5e53a4431e03855e462351e26))

## [4.1.1](https://github.com/brickhouse-tech/cfn-include/compare/v4.1.0...v4.1.1) (2026-02-14)

## [4.1.0](https://github.com/brickhouse-tech/cfn-include/compare/v4.0.1...v4.1.0) (2026-02-14)


### Features

* migrate tests from Mocha to Vitest + TypeScript (Phase 3b) ([47ccd3d](https://github.com/brickhouse-tech/cfn-include/commit/47ccd3d385a24e7689e5971bcb711950e39bc645))

## [4.0.1](https://github.com/brickhouse-tech/cfn-include/compare/v4.0.0...v4.0.1) (2026-02-12)


### Bug Fixes

* **deps:** bump the all group across 1 directory with 7 updates ([56989d3](https://github.com/brickhouse-tech/cfn-include/commit/56989d3f2de9c50bc5968b4cafcb059b887b96f4))

## [4.0.0](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.24...v4.0.0) (2026-02-08)


### ⚠ BREAKING CHANGES

* **release:** Package is now ESM-only. CommonJS require() no longer works.

- Fix version bump (should have been 3.0.0 due to ESM breaking change)
- Update CHANGELOG.md with Phase 1-3 changes
- Add .versionrc.json for commit-and-tag-version config

* **release:** 3.0.0 ([3d0bf89](https://github.com/brickhouse-tech/cfn-include/commit/3d0bf89a39d73d0f9645f96b6d56bd3ec0dce6a0))


### Bug Fixes

* **ci:** detect breaking changes in merge commits ([09f848c](https://github.com/brickhouse-tech/cfn-include/commit/09f848c434d9b287283fd9c48ed8e48d19a3cbd1))

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

## [2.1.19](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.18...v2.1.19) (2026-02-08)

### Bug Fixes

* lint errors in benchmark-runner.js (trailing commas) ([8257735](https://github.com/brickhouse-tech/cfn-include/commit/8257735))

### Documentation

* clarify scope vs body cloning optimization strategy ([4c3ddc1](https://github.com/brickhouse-tech/cfn-include/commit/4c3ddc1))
* add Phase 3 TypeScript Analysis ([3758d4d](https://github.com/brickhouse-tech/cfn-include/commit/3758d4d))
* add Phase 4 CDK Integration Analysis ([38a7090](https://github.com/brickhouse-tech/cfn-include/commit/38a7090))

### Features

* **benchmarks:** add Phase 1 performance analysis and benchmark suite ([7bb7670](https://github.com/brickhouse-tech/cfn-include/commit/7bb7670))

## [2.1.18](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.17...v2.1.18) (2026-02-04)

*No notable changes*

## [2.1.17](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.16...v2.1.17) (2026-02-04)

### Bug Fixes

* **deps:** bump @isaacs/brace-expansion from 5.0.0 to 5.0.1 ([92f242e](https://github.com/brickhouse-tech/cfn-include/commit/92f242e))
* **deps:** bump the all group with 2 updates ([c10adc7](https://github.com/brickhouse-tech/cfn-include/commit/c10adc7))

## [2.1.16](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.15...v2.1.16) (2026-01-30)

### Security

* CVE fast-xml-parse 5.3.4 override ([ca5c7cc](https://github.com/brickhouse-tech/cfn-include/commit/ca5c7cc))

## [2.1.15](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.14...v2.1.15) (2026-01-30)

### Bug Fixes

* **deps:** bump the all group with 3 updates ([f0c5bd2](https://github.com/brickhouse-tech/cfn-include/commit/f0c5bd2))

## [2.1.14](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.13...v2.1.14) (2026-01-27)

### Bug Fixes

* **deps:** bump @znemz/cft-utils from 0.1.30 to 0.1.31 in the all group ([06669aa](https://github.com/brickhouse-tech/cfn-include/commit/06669aa))

## [2.1.13](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.12...v2.1.13) (2026-01-22)

### Bug Fixes

* Fn::RefNow bug fixes ([f42119e](https://github.com/brickhouse-tech/cfn-include/commit/f42119e))

## [2.1.12](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.11...v2.1.12) (2026-01-22)

### Features

* RefNow LogicalId support ([2a01d82](https://github.com/brickhouse-tech/cfn-include/commit/2a01d82))

## [2.1.11](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.10...v2.1.11) (2026-01-22)

### Features

* refNowIgnoreMissing and refNowIgnores for cli for passthrough ([cfd4740](https://github.com/brickhouse-tech/cfn-include/commit/cfd4740))

## [2.1.10](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.9...v2.1.10) (2026-01-22)

### Bug Fixes

* **deps:** bump lodash from 4.17.21 to 4.17.23 ([f45ef98](https://github.com/brickhouse-tech/cfn-include/commit/f45ef98))

## [2.1.9](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.8...v2.1.9) (2026-01-17)

### Features

* Fn::RefNow ([81e6867](https://github.com/brickhouse-tech/cfn-include/commit/81e6867))
* Fn::SubNow ([45a1cbc](https://github.com/brickhouse-tech/cfn-include/commit/45a1cbc))

## [2.1.8](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.7...v2.1.8) (2025-12-24)

### Chore

* npm publish OIDC ([bef7a21](https://github.com/brickhouse-tech/cfn-include/commit/bef7a21))

## [2.1.7](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.6...v2.1.7) (2025-12-12)

### Bug Fixes

* **deps:** bump the all group across 1 directory with 2 updates ([4d2266e](https://github.com/brickhouse-tech/cfn-include/commit/4d2266e))

## [2.1.6](https://github.com/brickhouse-tech/cfn-include/compare/v2.1.5...v2.1.6) (2025-11-21)

### Bug Fixes

* safeDump to dump ([98393d1](https://github.com/nmccready/cfn-include/commit/98393d1902a7ee681bc5bd214a244a65c0222bec))

## 2.1.5 (2025-11-18)

## 2.1.4 (2025-11-06)

## 2.1.3 (2025-09-01)

## 2.1.2 (2025-05-12)

## 2.1.1 (2025-02-26)

## [2.1.0](https://github.com/brickhouse-tech/cfn-include/compare/v2.0.2...v2.1.0) (2025-01-21)

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
