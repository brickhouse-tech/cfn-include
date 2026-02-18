# Phase 5: Template Stats & Auto-Split Oversized Stacks

**Date:** February 2026  
**Issue:** [#90](https://github.com/brickhouse-tech/cfn-include/issues/90)  
**Status:** Phase 1 In Progress

---

## Problem

CloudFormation has hard limits that teams inevitably hit:

- **500 resources** per stack
- **200 outputs** per stack
- **1 MB** (1,048,576 bytes) template body size

When a stack outgrows these limits, teams must manually split stacks, wire cross-stack references, and maintain deployment ordering. This is tedious, error-prone, and blocks iteration.

## Phased Approach

### Phase 1: Detection & Warnings ✅ (PR #93)

- `--stats` CLI flag reports template statistics to stderr after processing
- Resource count, output count, and template size with % of CloudFormation limits
- Breakdown of resource types and counts
- **80% threshold warnings** — automatically warns when any metric reaches 80% of its limit
- All output goes to stderr so it doesn't interfere with template output on stdout

**Usage:**

```bash
# Process template and show stats on stderr
cfn-include template.yml --stats

# Stats don't break piping
cfn-include template.yml --stats > output.json
```

**Files:**

- `src/lib/stats.ts` — `computeStats()`, `checkThresholds()`, `formatStatsReport()`
- `src/cli.ts` — `--stats` flag integration
- `test/stats.test.ts` — unit tests

### Phase 2: Suggestions (Planned)

- Analyze resource dependency graph
- Suggest natural split boundaries (e.g., networking vs compute vs data)
- Output a report: "Split these N resource groups into separate stacks"

### Phase 3: Auto-Split (Planned)

- `cfn-include --auto-split` generates:
  - Multiple child stack templates
  - Cross-stack `Fn::ImportValue` / `Export` references auto-wired
  - Parent/orchestrator stack with `AWS::CloudFormation::Stack` nested references
  - Correct dependency ordering

### Phase 4: Managed Multi-Stack (Planned)

- Track split stacks as a "stack group"
- Deploy/update/rollback as a unit
- Drift detection across the group

## Why This Matters

- **Unique capability** — no other CFN preprocessor does this
- **Real pain point** — every team hits the 500 resource wall eventually
- **cfn-include is already positioned** — `Fn::Eval` (executable YAML) + includes + auto-split = the complete CFN toolchain
- ~4,600 downloads/week already

## CloudFormation Limits Reference

| Metric | Limit | Warning Threshold (80%) |
|--------|-------|------------------------|
| Resources per stack | 500 | 400 |
| Outputs per stack | 200 | 160 |
| Template body size | 1 MB (1,048,576 bytes) | ~800 KB |
