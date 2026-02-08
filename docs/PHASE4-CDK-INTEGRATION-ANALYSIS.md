# Phase 4: AWS CDK Import/Eject Functionality Analysis

**Date:** February 8, 2026  
**Author:** TARS (nmccready-tars)  
**Status:** Research & Design Complete

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [AWS CDK CfnInclude Module Research](#2-aws-cdk-cfninclude-module-research)
3. [Existing Tools Analysis](#3-existing-tools-analysis)
4. [EJECT Functionality Design (cfn-include → CDK)](#4-eject-functionality-design-cfn-include--cdk)
5. [IMPORT Functionality Design (CDK → cfn-include)](#5-import-functionality-design-cdk--cfn-include)
6. [CLI Design](#6-cli-design)
7. [Challenges and Limitations](#7-challenges-and-limitations)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Appendix: cfn-include Function Mapping](#appendix-cfn-include-function-mapping)

---

## 1. Executive Summary

This document analyzes the feasibility and design of bidirectional integration between `cfn-include` (a CloudFormation template preprocessor) and AWS CDK (Cloud Development Kit). The goal is to enable:

1. **EJECT** - Convert cfn-include templates to AWS CDK TypeScript/Python code
2. **IMPORT** - Convert CDK-synthesized CloudFormation templates back to optimized cfn-include templates

### Key Findings

- **EJECT is feasible** but requires a two-phase approach: first resolve all custom `Fn::*` functions, then convert to CDK
- **IMPORT has limited utility** - CDK templates are already optimized for CDK workflows; reverse engineering patterns is complex
- **Existing tools exist** - `cdk-from-cfn` handles the CloudFormation → CDK conversion well
- **Fn::Eval is non-portable** - Arbitrary JavaScript cannot be safely converted to CDK

### Recommended Approach

Implement EJECT as a wrapper around existing tools (`cdk-from-cfn`) with a pre-processing step that resolves cfn-include's custom functions. IMPORT should focus on pattern detection for migration assistance rather than full conversion.

---

## 2. AWS CDK CfnInclude Module Research

### 2.1 What is @aws-cdk/cloudformation-include?

The `cloudformation-include` module (now `aws-cdk-lib/cloudformation-include`) allows importing existing CloudFormation templates into CDK applications. It provides:

```typescript
import * as cfn_inc from 'aws-cdk-lib/cloudformation-include';

const cfnTemplate = new cfn_inc.CfnInclude(this, 'Template', {
  templateFile: 'my-template.json',
});
```

### 2.2 Key Capabilities

| Feature | Description |
|---------|-------------|
| **Template Import** | Import JSON/YAML CloudFormation templates |
| **Resource Access** | Get L1 constructs via `getResource('LogicalId')` |
| **L1 → L2 Conversion** | Convert with `fromCfn*()` methods (e.g., `Key.fromCfnKey()`) |
| **Parameter Replacement** | Replace parameters with build-time values |
| **Nested Stacks** | Support for `AWS::CloudFormation::Stack` resources |
| **Preserve Logical IDs** | Option to keep original IDs or rename with CDK algorithm |

### 2.3 Construct Levels in CDK

| Level | Description | Example |
|-------|-------------|---------|
| **L1 (CfnXxx)** | 1:1 mapping to CloudFormation resources | `CfnBucket` |
| **L2 (High-Level)** | Abstractions with sensible defaults | `Bucket` |
| **L3 (Patterns)** | Multi-resource patterns | `ApplicationLoadBalancedFargateService` |

**cfn-include templates produce L1 constructs when imported via CfnInclude**, since they're raw CloudFormation.

### 2.4 Converting L1 to L2

Two methods:

**Method 1: `fromCfn*()` methods (Preferred)**
```typescript
const cfnKey = cfnTemplate.getResource('Key') as kms.CfnKey;
const key = kms.Key.fromCfnKey(cfnKey); // Mutable L2
```

**Method 2: `fromXxxArn/Name()` methods (Fallback)**
```typescript
const cfnBucket = cfnTemplate.getResource('Bucket') as s3.CfnBucket;
const bucket = s3.Bucket.fromBucketName(this, 'L2Bucket', cfnBucket.ref); // Immutable
```

### 2.5 Limitations of CfnInclude

- Does not execute CloudFormation transforms
- Cannot handle cycles between resources (unless `allowCyclicalReferences: true`)
- Resources using complex `Fn::If` may not convert to L2
- Custom resources return as generic `CfnResource`

---

## 3. Existing Tools Analysis

### 3.1 cdk-from-cfn

**Repository:** `cdklabs/cdk-from-cfn`  
**Type:** Rust CLI with WASM bindings (npm package available)

**Features:**
- Converts CloudFormation JSON/YAML to CDK code
- Supports: TypeScript, Python, Java, Go, C#
- Generates either `Stack` or `Construct` classes
- Handles most intrinsic functions

**Supported Intrinsic Functions:**
- ✅ `Fn::FindInMap`, `Fn::Join`, `Fn::Sub`, `Ref`
- ✅ `Fn::And`, `Fn::Equals`, `Fn::If`, `Fn::Not`, `Fn::Or`
- ✅ `Fn::GetAtt`, `Fn::Base64`, `Fn::ImportValue`, `Fn::Select`
- ✅ `Fn::GetAZs`, `Fn::Cidr`
- ❌ SSM/SecretsManager dynamic references
- ❌ Create policies

**Usage:**
```bash
# CLI
cdk-from-cfn template.json output.ts --language typescript --stack-name MyStack

# Node.js
import * as cdk_from_cfn from 'cdk-from-cfn';
const cdkCode = cdk_from_cfn.transmute(template, 'typescript', 'MyStack');
```

### 3.2 AWS CloudFormation Registry

The CDK uses CloudFormation schema definitions from the registry to generate L1 constructs. This is why `cdk-from-cfn` can accurately map resources.

### 3.3 Other Tools

| Tool | Description | Status |
|------|-------------|--------|
| **former2** | Generates IaC from existing AWS resources | Alternative approach |
| **AWS CDK Migrate** | Official tool for importing existing stacks | Stack-focused, not template-focused |

---

## 4. EJECT Functionality Design (cfn-include → CDK)

### 4.1 Overview

Convert a cfn-include template (with custom `Fn::*` functions) to AWS CDK code.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  cfn-include    │────▶│  Standard CFN   │────▶│   CDK Code      │
│  Template       │     │  Template       │     │  (TS/Python)    │
│  (Fn::Include,  │     │  (Resolved)     │     │                 │
│   Fn::Map, etc) │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
      Phase 1                Phase 2                Phase 3
   (cfn-include)         (cdk-from-cfn)        (Code Generation)
```

### 4.2 Phase 1: Resolve cfn-include Functions

Use the existing `cfn-include` CLI to resolve all custom functions:

```bash
cfn-include input.yml --enable env,eval > resolved.json
```

This handles:
- `Fn::Include` → File contents inlined
- `Fn::Map` → Array expanded
- `Fn::Flatten` → Arrays flattened
- `Fn::Merge` → Objects merged
- `Fn::RefNow` → References resolved
- etc.

### 4.3 Phase 2: Convert to CDK

Pass the resolved CloudFormation template to `cdk-from-cfn`:

```typescript
import * as cdk_from_cfn from 'cdk-from-cfn';
import * as cfnInclude from '@znemz/cfn-include';

async function eject(templatePath: string, language: string) {
  // Phase 1: Resolve cfn-include functions
  const resolved = await cfnInclude({
    url: `file://${templatePath}`,
    doEnv: true,
    doEval: true,
  });
  
  // Phase 2: Convert to CDK
  const cdkCode = cdk_from_cfn.transmute(
    JSON.stringify(resolved),
    language,
    'GeneratedStack'
  );
  
  return cdkCode;
}
```

### 4.4 Phase 3: Output Structure

Generate a complete CDK application structure:

```
output/
├── package.json
├── tsconfig.json
├── cdk.json
├── lib/
│   └── generated-stack.ts    # Generated CDK code
├── bin/
│   └── app.ts                # CDK app entry point
└── README.md                 # Migration notes
```

### 4.5 Preserving Intent with Comments

Since cfn-include functions carry semantic meaning that's lost in resolution, we should:

1. **Parse original template** to detect cfn-include function usage
2. **Generate comments** in output explaining original patterns

```typescript
// Originally: Fn::Map over [80, 443] with template for each port
const securityGroupIngress80 = new ec2.CfnSecurityGroupIngress(this, 'Ingress80', {
  // ...
});
const securityGroupIngress443 = new ec2.CfnSecurityGroupIngress(this, 'Ingress443', {
  // ...
});
```

### 4.6 Handling Special Cases

#### Fn::Eval (JavaScript Evaluation)
```yaml
# NOT CONVERTIBLE - Contains arbitrary JS
Fn::Eval:
  state: [1, 2, 3]
  script: "state.map(v => v * 2);"
```
**Strategy:** Warn user, output as comment with manual intervention required.

#### Fn::Include with dynamic paths
```yaml
# Dynamic path based on environment
Fn::Include: "${ENVIRONMENT}/config.yml"
```
**Strategy:** Resolve at eject time with specific environment, document the source.

#### Fn::IfEval (Conditional JS)
```yaml
Fn::IfEval:
  evalCond: "('${ENV}' === 'prod')"
  truthy: { ... }
  falsy: { ... }
```
**Strategy:** Evaluate at eject time, document the condition that was used.

---

## 5. IMPORT Functionality Design (CDK → cfn-include)

### 5.1 Overview

Convert a CDK-synthesized CloudFormation template back to an optimized cfn-include template.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  CDK Stack      │────▶│  cdk synth      │────▶│  cfn-include    │
│  (TypeScript)   │     │  output.json    │     │  optimized.yml  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        Pattern Detection
                        - Repeated resources
                        - Similar structures
                        - Extractable modules
```

### 5.2 Pattern Detection Algorithms

#### 5.2.1 Repeated Resource Pattern → Fn::Map

Detect resources with similar structure that differ only in specific values:

```json
// Input (synthesized CFN)
{
  "SubnetA": { "Type": "AWS::EC2::Subnet", "Properties": { "AvailabilityZone": "us-east-1a" } },
  "SubnetB": { "Type": "AWS::EC2::Subnet", "Properties": { "AvailabilityZone": "us-east-1b" } },
  "SubnetC": { "Type": "AWS::EC2::Subnet", "Properties": { "AvailabilityZone": "us-east-1c" } }
}
```

```yaml
# Output (cfn-include)
Fn::Merge:
  Fn::Map:
    - [a, b, c]
    - AZ
    - Subnet${AZ}:
        Type: AWS::EC2::Subnet
        Properties:
          AvailabilityZone: !Sub us-east-1${AZ}
```

**Algorithm:**
1. Group resources by Type
2. Compare property structures (ignoring values)
3. Identify varying fields
4. Check if variations follow a pattern (sequential, from list, etc.)
5. Generate `Fn::Map` if pattern detected

#### 5.2.2 Similar Structure Detection → Fn::Include

Identify resource blocks that could be extracted to reusable includes:

```json
// Input: Multiple Lambda functions with similar config
{
  "Function1": { "Type": "AWS::Lambda::Function", "Properties": { "Runtime": "nodejs18.x", "Handler": "index.handler", "MemorySize": 256 } },
  "Function2": { "Type": "AWS::Lambda::Function", "Properties": { "Runtime": "nodejs18.x", "Handler": "index.handler", "MemorySize": 256 } }
}
```

```yaml
# Output: Extracted include
# includes/lambda-defaults.yml
Type: AWS::Lambda::Function
Properties:
  Runtime: nodejs18.x
  Handler: index.handler
  MemorySize: 256

# main.yml
Function1:
  Fn::DeepMerge:
    - Fn::Include: includes/lambda-defaults.yml
    - Properties:
        FunctionName: function-1
Function2:
  Fn::DeepMerge:
    - Fn::Include: includes/lambda-defaults.yml
    - Properties:
        FunctionName: function-2
```

### 5.3 Optimization Strategies

| Strategy | Description | Trigger |
|----------|-------------|---------|
| **Fn::Map extraction** | Convert repeated resources to map | 3+ similar resources |
| **Fn::Include extraction** | Extract common patterns to files | Repeated structures |
| **Fn::Merge usage** | Combine base + overrides | Inheritance patterns |
| **Fn::Sequence generation** | Detect sequential patterns | A, B, C or 1, 2, 3 patterns |

### 5.4 Limitations of IMPORT

1. **Loss of L2 abstraction** - CDK synthesizes to L1, can't recover L2 intent
2. **CDK metadata** - Contains CDK-specific constructs that don't reverse well
3. **Token resolution** - CDK tokens are resolved, original references lost
4. **Code generation impossible** - Can't regenerate original TypeScript/Python

### 5.5 Recommended Use Cases for IMPORT

- **Migration assistance** - Help identify patterns when migrating away from CDK
- **Template optimization** - Reduce template size by extracting patterns
- **Documentation** - Generate simplified cfn-include views of complex CDK stacks

---

## 6. CLI Design

### 6.1 EJECT Command

```bash
cfn-include eject <template> [options]

Arguments:
  template                 Path to cfn-include template (YAML/JSON)

Options:
  -o, --output <dir>       Output directory for CDK app (default: ./cdk-app)
  -l, --language <lang>    Output language: typescript, python, java, go, csharp
                           (default: typescript)
  -n, --stack-name <name>  Name for generated stack class (default: GeneratedStack)
  --as <type>              Output type: stack, construct (default: stack)
  --enable <opts>          Enable cfn-include options: env, eval
  -i, --inject <json>      JSON string for template injection
  --preserve-comments      Add comments documenting original cfn-include patterns
  --dry-run                Show what would be generated without writing files
  -v, --verbose            Verbose output

Examples:
  cfn-include eject infra.yml -o ./my-cdk-app -l typescript
  cfn-include eject template.yml --enable env --inject '{"ENV":"prod"}'
```

### 6.2 IMPORT Command

```bash
cfn-include import <template> [options]

Arguments:
  template                 Path to CloudFormation template (from cdk synth)

Options:
  -o, --output <path>      Output file path (default: stdout)
  --optimize               Enable pattern detection and optimization
  --extract-includes       Extract repeated patterns to include files
  --include-dir <dir>      Directory for extracted includes (default: ./includes)
  --min-repeat <n>         Minimum repetitions to trigger extraction (default: 3)
  --format <fmt>           Output format: yaml, json (default: yaml)
  --analyze-only           Show detected patterns without generating output
  -v, --verbose            Verbose output

Examples:
  cfn-include import cdk.out/MyStack.template.json -o optimized.yml --optimize
  cfn-include import template.json --analyze-only
```

### 6.3 Integration with Existing CLI

Add to `bin/cli.js`:

```javascript
const opts = yargs(hideBin(process.argv))
  .command('$0 [path] [options]', pkg.description, /* ... existing ... */)
  .command('eject <template>', 'Convert cfn-include template to CDK code', (y) =>
    y.positional('template', { desc: 'Path to cfn-include template' })
     .option('output', { alias: 'o', desc: 'Output directory', default: './cdk-app' })
     .option('language', { alias: 'l', desc: 'Output language', default: 'typescript' })
     // ... more options
  )
  .command('import <template>', 'Import CloudFormation template to cfn-include', (y) =>
    y.positional('template', { desc: 'Path to CloudFormation template' })
     .option('output', { alias: 'o', desc: 'Output file path' })
     .option('optimize', { desc: 'Enable pattern optimization', boolean: true })
     // ... more options
  )
  .parse();
```

---

## 7. Challenges and Limitations

### 7.1 Non-Convertible Features

| Feature | Issue | Mitigation |
|---------|-------|------------|
| `Fn::Eval` | Arbitrary JavaScript execution | Warn user, output as comment |
| `Fn::IfEval` | Conditional JavaScript | Evaluate at eject time, document |
| Dynamic `Fn::Include` | Runtime path resolution | Resolve with current env, document |
| AWS API calls (`type: api`) | Runtime AWS calls | Cache result, document source |
| Globs (`Fn::Include: *.yml`) | Filesystem dependent | Expand at eject time |

### 7.2 CDK vs cfn-include Paradigm Differences

| Aspect | cfn-include | CDK |
|--------|-------------|-----|
| **Evaluation time** | Build time (before deployment) | Synth time (code execution) |
| **Abstraction** | Template preprocessing | Object-oriented constructs |
| **Type safety** | None (YAML/JSON) | Full (TypeScript/Python) |
| **Conditionals** | Fn::If (CloudFormation) + Fn::IfEval | Native language conditionals |
| **Loops** | Fn::Map (template-based) | Native language loops |
| **Reuse** | File includes | Classes and composition |

### 7.3 L2 Construct Detection

When importing CDK templates, we cannot reliably detect which L2 constructs were used:

```typescript
// Original CDK code
new s3.Bucket(this, 'Bucket', {
  versioned: true,
  encryption: BucketEncryption.S3_MANAGED,
});
```

```json
// Synthesized CloudFormation - L2 information lost
{
  "Bucket": {
    "Type": "AWS::S3::Bucket",
    "Properties": {
      "VersioningConfiguration": { "Status": "Enabled" },
      "BucketEncryption": {
        "ServerSideEncryptionConfiguration": [
          { "ServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" } }
        ]
      }
    }
  }
}
```

### 7.4 CDK Metadata and Constructs

CDK adds metadata that's not useful in cfn-include:

```json
{
  "Metadata": {
    "aws:cdk:path": "MyStack/Bucket/Resource"
  },
  "Rules": {
    "CheckBootstrapVersion": { /* CDK bootstrap check */ }
  }
}
```

**Strategy:** Strip CDK-specific metadata during import.

---

## 8. Implementation Roadmap

### Phase 4.1: EJECT MVP (4-6 weeks)

1. **Week 1-2:** Integration with `cdk-from-cfn`
   - Add as optional dependency
   - Wrapper function for resolution + conversion
   - Basic CLI command

2. **Week 3-4:** Output generation
   - CDK app scaffolding
   - Package.json generation
   - TypeScript configuration

3. **Week 5-6:** Documentation and testing
   - Comment generation for original patterns
   - Comprehensive test suite
   - User documentation

### Phase 4.2: IMPORT MVP (6-8 weeks)

1. **Week 1-2:** Pattern detection infrastructure
   - Resource similarity scoring
   - Structure comparison algorithms

2. **Week 3-4:** Fn::Map extraction
   - Repeated resource detection
   - Variable extraction

3. **Week 5-6:** Fn::Include extraction
   - Common structure detection
   - Include file generation

4. **Week 7-8:** Optimization and testing
   - Fine-tuning detection thresholds
   - Comprehensive test suite

### Phase 4.3: Advanced Features (Future)

- Python output support for eject
- Interactive pattern selection for import
- IDE plugins for migration assistance
- CI/CD integration helpers

---

## Appendix: cfn-include Function Mapping

### Custom Functions (cfn-include specific)

| Function | Description | CDK Equivalent |
|----------|-------------|----------------|
| `Fn::Include` | Include external files | N/A (resolved at preprocessing) |
| `Fn::Map` | Transform arrays | Native loops |
| `Fn::Flatten` | Flatten arrays | `Array.flat()` |
| `Fn::FlattenDeep` | Deep flatten | `Array.flat(Infinity)` |
| `Fn::Merge` | Merge objects | Object spread / `Object.assign` |
| `Fn::DeepMerge` | Deep merge objects | Deep merge utility |
| `Fn::Length` | Array length | `Array.length` |
| `Fn::Uniq` | Unique values | `[...new Set(arr)]` |
| `Fn::Compact` | Remove falsy | `Array.filter(Boolean)` |
| `Fn::Concat` | Concatenate arrays | `Array.concat()` |
| `Fn::Sort` | Sort array | `Array.sort()` |
| `Fn::SortBy` | Sort by property | `_.sortBy()` |
| `Fn::Without` | Remove values | `Array.filter()` |
| `Fn::Omit` | Omit object keys | Object destructuring |
| `Fn::OmitEmpty` | Remove empty values | Filter utility |
| `Fn::ObjectKeys` | Object keys | `Object.keys()` |
| `Fn::ObjectValues` | Object values | `Object.values()` |
| `Fn::Stringify` | JSON stringify | `JSON.stringify()` |
| `Fn::StringSplit` | Split string | `String.split()` |
| `Fn::Sequence` | Generate sequence | `Array.from({length})` |
| `Fn::GetEnv` | Environment variable | `process.env` |
| `Fn::Eval` | JavaScript eval | **Not convertible** |
| `Fn::IfEval` | Conditional eval | **Not convertible** |
| `Fn::JoinNow` | Immediate join | `Array.join()` |
| `Fn::SubNow` | Immediate substitution | Template literals |
| `Fn::RefNow` | Immediate reference | Variable reference |
| `Fn::ApplyTags` | Apply tags to resources | Tagging construct |
| `Fn::Outputs` | Generate outputs | CDK CfnOutput |
| `Fn::Filenames` | List filenames | `fs.readdirSync()` |
| `Fn::UpperCamelCase` | Case conversion | String utility |
| `Fn::LowerCamelCase` | Case conversion | String utility |

### Standard CloudFormation Functions (Preserved)

| Function | CDK Equivalent |
|----------|----------------|
| `Ref` | `resource.ref` or `Fn.ref()` |
| `Fn::GetAtt` | `resource.getAtt()` |
| `Fn::Join` | `Fn.join()` |
| `Fn::Sub` | `Fn.sub()` |
| `Fn::Select` | `Fn.select()` |
| `Fn::Split` | `Fn.split()` |
| `Fn::If` | `Fn.conditionIf()` |
| `Fn::And` | `Fn.conditionAnd()` |
| `Fn::Or` | `Fn.conditionOr()` |
| `Fn::Not` | `Fn.conditionNot()` |
| `Fn::Equals` | `Fn.conditionEquals()` |
| `Fn::FindInMap` | `Fn.findInMap()` |
| `Fn::Base64` | `Fn.base64()` |
| `Fn::Cidr` | `Fn.cidr()` |
| `Fn::GetAZs` | `Fn.getAzs()` |
| `Fn::ImportValue` | `Fn.importValue()` |

---

## References

1. [AWS CDK cloudformation-include documentation](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.cloudformation_include-readme.html)
2. [cdk-from-cfn GitHub repository](https://github.com/cdklabs/cdk-from-cfn)
3. [AWS CDK CfnResource API](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.CfnResource.html)
4. [cfn-include README](../README.md)
