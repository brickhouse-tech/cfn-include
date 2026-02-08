# cfn-include Benchmark Suite

Performance benchmarks for measuring template compilation times and memory usage.

## Running Benchmarks

```bash
# Basic run
node benchmarks/benchmark-runner.js

# With GC exposed for accurate memory measurement
node --expose-gc benchmarks/benchmark-runner.js
```

## What's Measured

1. **Simple Template** - Baseline with no custom Fn:: functions
2. **Fn::Map (10/100/1000 items)** - Tests scaling behavior
3. **Nested Fn::Map (3-deep)** - Tests recursion overhead
4. **Fn::Include chains (3/10-deep)** - Tests include resolution
5. **Glob operations (10/100 files)** - Tests file discovery
6. **Complex template** - Mixed real-world scenario

## Output

Results are printed to console and saved to `results.json`.

## Fixtures

The benchmark runner auto-generates fixtures in `fixtures/` directory:
- Simple templates
- Map templates with varying sizes
- Nested map templates
- Include chain templates
- Glob test files

## Adding New Benchmarks

Edit `benchmark-runner.js` and add a new `runBenchmark()` call:

```javascript
results.push(await runBenchmark('My New Benchmark', async () => {
  await include({
    template: myTemplate,
    url: 'file:///path/to/template.json',
  });
}));
printResult(results[results.length - 1]);
```
