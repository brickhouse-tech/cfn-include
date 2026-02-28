# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [4.6.1](https://github.com/brickhouse-tech/cfn-include/compare/v4.6.0...v4.6.1) (2026-02-28)


### Bug Fixes

* **deps:** bump rollup from 4.57.1 to 4.59.0 ([4bf442a](https://github.com/brickhouse-tech/cfn-include/commit/4bf442a65d446ad70e5bfcfa3a514f4d5a9040f1))

## [4.6.0](https://github.com/brickhouse-tech/cfn-include/compare/v4.5.1...v4.6.0) (2026-02-26)


### Features

* **test:** add conditional s3.json test support (closes [#84](https://github.com/brickhouse-tech/cfn-include/issues/84)) ([cfb4788](https://github.com/brickhouse-tech/cfn-include/commit/cfb478868922661dd0712840e65af06687b51a08))

## [4.5.1](https://github.com/brickhouse-tech/cfn-include/compare/v4.5.0...v4.5.1) (2026-02-26)


### Bug Fixes

* **deps:** bump basic-ftp from 5.1.0 to 5.2.0 ([8e40b6f](https://github.com/brickhouse-tech/cfn-include/commit/8e40b6ffdd2d7ec70726664068fb0123dfb236e5))

## [4.5.0](https://github.com/brickhouse-tech/cfn-include/compare/v4.4.1...v4.5.0) (2026-02-25)


### Features

* Phase 4.2 - Smart clustering for stack splitting ([e5a6a7b](https://github.com/brickhouse-tech/cfn-include/commit/e5a6a7b5ea61745ebffc44551dc9b91a6b7a028b)), closes [#90](https://github.com/brickhouse-tech/cfn-include/issues/90)


### Bug Fixes

* **phase4.2:** cohesion/coupling calculations + merge stopping criteria ([6094205](https://github.com/brickhouse-tech/cfn-include/commit/60942058d59e7365ef50c9ca04d6ba2ace3eec8f))

## [4.4.1](https://github.com/brickhouse-tech/cfn-include/compare/v4.4.0...v4.4.1) (2026-02-21)


### Bug Fixes

* **deps:** fix CVE-2026-26996 minimatch ReDoS + bump cft-utils to 0.1.39 ([3fb8ceb](https://github.com/brickhouse-tech/cfn-include/commit/3fb8ceb435b5078fa8a60f2e7712e3a97839c6fa))
* **deps:** use cft-utils 0.1.38 (0.1.39 was never published) ([db8d666](https://github.com/brickhouse-tech/cfn-include/commit/db8d666f4182f4e2317f0af7eb322821e857d7ed))

## [4.4.0](https://github.com/brickhouse-tech/cfn-include/compare/v4.3.2...v4.4.0) (2026-02-21)


### Features

* add executable YAML support with shebang (cfn/yml/yaml) ([865b900](https://github.com/brickhouse-tech/cfn-include/commit/865b900a3fa8d468fb031b05519fef002423c66c))

## [4.3.2](https://github.com/brickhouse-tech/cfn-include/compare/v4.3.1...v4.3.2) (2026-02-20)


### Bug Fixes

* **deps:** bump the all group with 2 updates ([3368fa5](https://github.com/brickhouse-tech/cfn-include/commit/3368fa5ca4fd5f645b2b7e4e939a26fd8b91323d))

## [4.3.1](https://github.com/brickhouse-tech/cfn-include/compare/v4.3.0...v4.3.1) (2026-02-19)


### Bug Fixes

* **deps:** bump the all group with 3 updates ([#100](https://github.com/brickhouse-tech/cfn-include/issues/100)) ([4dbbe6c](https://github.com/brickhouse-tech/cfn-include/commit/4dbbe6c91a963f498f02078128f52f2f7e0f54a6))

## [4.3.0](https://github.com/brickhouse-tech/cfn-include/compare/v4.2.2...v4.3.0) (2026-02-19)


### Features

* add template auto-split with dependency graph, suggestions, and code generation ([#90](https://github.com/brickhouse-tech/cfn-include/issues/90)) ([950a90d](https://github.com/brickhouse-tech/cfn-include/commit/950a90da29e924f44436729f9919f659074e6b48))

## [4.2.2](https://github.com/brickhouse-tech/cfn-include/compare/v4.2.1...v4.2.2) (2026-02-18)


### Bug Fixes

* **deps:** bump the all group with 2 updates ([fa305ec](https://github.com/brickhouse-tech/cfn-include/commit/fa305eca0a243078e677ad0631d8f714a1a00e50))

## [4.2.1](https://github.com/brickhouse-tech/cfn-include/compare/v4.2.0...v4.2.1) (2026-02-18)

## [4.2.0](https://github.com/brickhouse-tech/cfn-include/compare/v4.1.8...v4.2.0) (2026-02-18)


### Features

* add template stats and oversized template warnings (Phase 1 of [#90](https://github.com/brickhouse-tech/cfn-include/issues/90)) ([9ec2a97](https://github.com/brickhouse-tech/cfn-include/commit/9ec2a9775a37fb3d4d5d767d902d2ee330181da3))


### Refactor

* export CFN limits as true constants, use in tests ([95dbb8b](https://github.com/brickhouse-tech/cfn-include/commit/95dbb8b6a86c3b87498dde187e92739bc6acf635))


### Documentation

* add AWS CloudFormation limits doc references to stats constants ([03e0a76](https://github.com/brickhouse-tech/cfn-include/commit/03e0a764005c8bf8189cc91f6e66fd9873e329ea))
* add Phase 5 template stats doc, move completed phases to docs/completed/ ([141d950](https://github.com/brickhouse-tech/cfn-include/commit/141d950c2d88e5d4f4d3b3630276f57bc02e6223))
* renumber phases — stats is Phase 4, CDK is Phase 5 ([957f370](https://github.com/brickhouse-tech/cfn-include/commit/957f3706d5c7797b12916754c73fb16d6d36bfa0))

## [4.1.8](https://github.com/brickhouse-tech/cfn-include/compare/v4.1.7...v4.1.8) (2026-02-18)

## [4.1.7](https://github.com/brickhouse-tech/cfn-include/compare/v4.1.6...v4.1.7) (2026-02-17)

## [4.1.6](https://github.com/brickhouse-tech/cfn-include/compare/v4.1.5...v4.1.6) (2026-02-17)


### Bug Fixes

* **deps:** bump the all group with 5 updates ([0a65846](https://github.com/brickhouse-tech/cfn-include/commit/0a658461a4c816f2ba14d33edfaf23fea3e14fb7))

## [4.1.5](https://github.com/brickhouse-tech/cfn-include/compare/v4.1.4...v4.1.5) (2026-02-16)


### Bug Fixes

* **deps:** bump the all group with 2 updates ([f1c45aa](https://github.com/brickhouse-tech/cfn-include/commit/f1c45aac6026ae3ebb8769943e671c63542282a1))

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
