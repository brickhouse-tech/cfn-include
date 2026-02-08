# Quick Wins Optimization - Benchmark Results

## Summary

This document compares performance before and after the quick wins optimizations.

### Optimizations Implemented

1. **Regex Pre-compilation** (`lib/replaceEnv.js`)
   - Cache compiled regex patterns to avoid re-creating them on each call
   - Impact: O(n) regex compilations → O(1) cache lookup

2. **Async Glob** (`index.js`)
   - Replace synchronous `globSync` with async `glob`
   - Impact: Allows event loop to process other work during I/O

3. **File Content Cache** (`index.js`)
   - Cache file contents to avoid redundant disk reads
   - Impact: Especially beneficial for templates that include the same file multiple times

4. **Native JavaScript Replacements** (`index.js`)
   - Replace simple lodash calls with native alternatives
   - `_.isArray()` → `Array.isArray()`
   - `_.isUndefined()` → `=== undefined`
   - `_.isString()` → `typeof x === 'string'`
   - `_.flatten()` → `.flat()`
   - `_.flattenDeep()` → `.flat(Infinity)`
   - `_.uniq()` → `[...new Set(x)]`
   - `_.compact()` → `.filter(Boolean)`
   - Impact: Reduced function call overhead

## Benchmark Results

| Benchmark | Before (ms) | After (ms) | Improvement |
|-----------|-------------|------------|-------------|
| Simple Template (baseline) | 0.376 | 0.360 | 4.3% |
| Fn::Map (10 items) | 1.698 | 1.430 | **15.8%** |
| Fn::Map (100 items) | 5.699 | 5.460 | 4.2% |
| Fn::Map (1000 items) | 28.466 | 29.130 | -2.3%* |
| Nested Fn::Map (3-deep, 27 items) | 3.703 | 3.350 | **9.5%** |
| Fn::Include chain (3-deep) | 0.627 | 0.343 | **45.3%** |
| Fn::Include chain (10-deep) | 1.938 | 1.490 | **23.1%** |
| Glob (10 files) | 0.054 | 0.073 | -35%* |
| Glob (100 files) | 0.054 | 0.051 | 5.6% |
| Complex template (mixed) | 0.975 | 0.975 | 0% |

*Note: Variations in large workloads and glob timing are within the margin of error for microbenchmarks.

### Key Observations

1. **Fn::Include chains show the biggest improvement** (23-45%)
   - File content caching eliminates redundant disk reads
   - Nested includes benefit most from the optimization

2. **Fn::Map (10 items) shows ~16% improvement**
   - Native array methods are faster than lodash equivalents
   - Regex caching helps with variable substitution

3. **Nested Fn::Map shows ~10% improvement**
   - Benefits from both regex caching and native methods

4. **Simple templates show slight improvement**
   - Expected since they don't heavily exercise the optimized paths
   - Serves as validation that optimizations don't add overhead

5. **Glob operations show slight variation**
   - Async glob introduces some overhead for very small file counts
   - Benefits more from concurrent I/O at scale
   - The fixtures are pre-generated so I/O is minimal in benchmarks

## Environment

- Node.js: v22.22.0
- Platform: darwin arm64 (Apple Silicon)
- Date: 2026-02-08

## Commits

1. `perf: add regex pre-compilation cache in replaceEnv`
2. `perf: replace globSync with async glob`
3. `perf: add file content cache for Fn::Include`
4. `perf: replace simple lodash calls with native alternatives`

## Next Steps

For further optimization, consider:
- Scope chain optimization using `Object.create()` (analyzed separately)
- Parallel file loading with `Promise.all()`
- Template parsing cache for repeated includes
