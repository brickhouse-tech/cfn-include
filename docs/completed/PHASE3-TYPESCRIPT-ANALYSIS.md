# Phase 3: TypeScript Conversion Analysis

## Executive Summary

This document provides a comprehensive analysis for converting `cfn-include` from JavaScript to TypeScript. The codebase presents moderate-to-high complexity due to polymorphic function signatures, deeply nested CloudFormation template structures, and runtime dynamic behavior (eval, yaml parsing, dynamic object keys).

**Recommendation:** Full TypeScript conversion with strict mode enabled, targeting ES2022+ with NodeNext module resolution.

---

## Table of Contents

1. [Type Complexity Analysis](#1-type-complexity-analysis)
2. [Draft TypeScript Type Definitions](#2-draft-typescript-type-definitions)
3. [tsconfig.json Design](#3-tsconfigjson-design)
4. [Migration Strategy](#4-migration-strategy)
5. [Typing Challenges](#5-typing-challenges)
6. [Risk Assessment](#6-risk-assessment)
7. [Implementation Timeline](#7-implementation-timeline)

---

## 1. Type Complexity Analysis

### 1.1 Function Signature Complexity Matrix

| File | Function | Complexity | Challenge Level | Notes |
|------|----------|------------|-----------------|-------|
| `index.js` | `module.exports` (main) | High | ⚠️⚠️⚠️ | Polymorphic options, returns `Promise<TemplateDocument>` |
| `index.js` | `recurse` | Very High | ⚠️⚠️⚠️⚠️ | 30+ Fn:: handlers, recursive, scope mutations |
| `index.js` | `fnInclude` | High | ⚠️⚠️⚠️ | Protocol-aware file loading, query parsing |
| `index.js` | `handleIncludeBody` | Medium | ⚠️⚠️ | Type-based template processing |
| `index.js` | `findAndReplace` | Medium | ⚠️⚠️ | Recursive object/array traversal with mutation |
| `index.js` | `interpolate` | Low | ⚠️ | String template interpolation |
| `lib/schema.js` | YAML type constructors | High | ⚠️⚠️⚠️ | Custom YAML schema with 60+ tag definitions |
| `lib/internals.js` | `buildResourceArn` | Medium | ⚠️⚠️ | Resource-type-specific ARN construction |
| `lib/promise.js` | `mapWhatever` | Medium | ⚠️⚠️ | Generic over array/object iteration |
| `lib/replaceEnv.js` | `replaceEnv` | Low | ⚠️ | String replacement with optional chaining |
| `lib/parselocation.js` | `parseLocation` | Low | ⚠️ | Regex-based URL parsing |

### 1.2 Polymorphic Functions Analysis

#### 1.2.1 Main Export Function (`include`)

```typescript
// Current JS signature (implicit)
function include(options) -> Promise<TemplateDocument>

// The options parameter has multiple valid shapes:
{
  template?: TemplateDocument | undefined,  // Optional: inline template
  url: string,                              // Required: file/s3/http URL
  doEnv?: boolean,                          // Enable env substitution
  doEval?: boolean,                         // Enable Fn::Eval (dangerous)
  inject?: Record<string, string>,          // Variable injection
  doLog?: boolean,                          // Debug logging
  refNowIgnores?: string[],                 // Skip these refs
  refNowIgnoreMissing?: boolean,            // Don't fail on missing refs
  rootTemplate?: TemplateDocument,          // For Fn::RefNow resolution
  scope?: Scope                             // Internal: scope variables
}
```

**Complexity factors:**
- `template` can be omitted if `url` points to a loadable file
- Return type depends on template content (could be object, array, string, number)
- Options flow through recursive calls with additions

#### 1.2.2 The `recurse` Function (Most Complex)

```typescript
// Handles 30+ Fn:: intrinsic functions
// Each branch has unique input/output shapes:

'Fn::Map'     -> [list, placeholders, body] | [list, body]
'Fn::Include' -> string | [location, query, parser?] | IncludeOptions
'Fn::Eval'    -> { state, script, inject?, doLog? }
'Fn::IfEval'  -> { truthy, falsy, evalCond, inject?, doLog? }
'Fn::RefNow'  -> string | { Ref: string, returnType?: 'arn' | 'name' }
'Fn::SortBy'  -> { list, iteratees }
'Fn::Without' -> [list, withouts] | { list, withouts }
'Fn::Omit'    -> [object, omits] | { object, omits }
// ... 20+ more
```

**The union type explosion problem:**
```typescript
type FnMapArgs = 
  | [unknown[], unknown]                    // [list, body]
  | [unknown[], string, unknown]            // [list, placeholder, body]
  | [unknown[], [string, string?, string?], unknown]; // With index/size

type FnIncludeArgs = 
  | string
  | [string, string?, string?]
  | IncludeOptions;
```

#### 1.2.3 Scope Mutation Patterns

```javascript
// Current pattern (mutation-based)
scope = _.clone(scope);
scope[placeholder] = replace;
if (hasindex) scope[idx] = key;
```

This requires careful typing:
```typescript
interface Scope {
  [key: string]: unknown;
  _?: unknown;  // Default placeholder
}
```

### 1.3 Nested Structure Analysis

#### 1.3.1 CloudFormation Template Structure

```
TemplateDocument (max depth observed: 12+ levels)
├── AWSTemplateFormatVersion
├── Description
├── Metadata
│   └── CfnInclude
│       ├── GitCommit
│       └── BuildDate
├── Parameters
│   └── [ParamName]
│       ├── Type
│       ├── Default
│       └── Description
├── Mappings
│   └── [MapName]
│       └── [TopLevelKey]
│           └── [SecondLevelKey]: value
├── Conditions
│   └── [ConditionName]: IntrinsicFunction
├── Resources
│   └── [LogicalId]
│       ├── Type
│       ├── Condition?
│       ├── DependsOn?
│       ├── Properties
│       │   └── (resource-specific, deeply nested)
│       └── Metadata?
├── Outputs
│   └── [OutputName]
│       ├── Value
│       ├── Condition?
│       ├── Export?
│       │   └── Name
│       └── Description?
└── Transform?
```

#### 1.3.2 Intrinsic Function Nesting

CloudFormation intrinsic functions can nest arbitrarily deep:

```yaml
# Observed nesting patterns
Value: !Sub
  - "arn:aws:s3:::${Bucket}/*"
  - Bucket: !If
      - CreateBucket
      - !Ref NewBucket
      - !FindInMap
          - Config
          - !Ref Environment
          - BucketName
```

This requires recursive type definitions:

```typescript
type IntrinsicFunction = 
  | FnSub
  | FnRef
  | FnIf
  | FnFindInMap
  | FnGetAtt
  | FnJoin
  | FnSelect
  | FnBase64
  | FnCidr
  | FnAnd
  | FnEquals
  | FnNot
  | FnOr
  | FnImportValue
  | FnSplit
  | FnGetAZs
  // cfn-include custom
  | FnInclude
  | FnMap
  | FnMerge
  | FnDeepMerge
  | FnFlatten
  | FnEval
  | FnIfEval
  | FnRefNow
  | FnSubNow
  | FnJoinNow
  // ... etc

type TemplateValue = 
  | string 
  | number 
  | boolean 
  | null
  | TemplateValue[]
  | { [key: string]: TemplateValue }
  | IntrinsicFunction;
```

---

## 2. Draft TypeScript Type Definitions

### 2.1 Core Types

```typescript
// types/core.ts

/**
 * AWS Pseudo Parameters available at runtime
 */
export interface AwsPseudoParameters {
  'AWS::AccountId': string;
  'AWS::Partition': string;
  'AWS::Region': string;
  'AWS::StackId': string;
  'AWS::StackName': string;
  'AWS::URLSuffix': string;
  'AWS::NotificationARNs': string;
}

/**
 * Parsed location from URL/path
 */
export interface ParsedLocation {
  /** Protocol: 'file', 's3', 'http', 'https' */
  protocol: string | undefined;
  /** Host portion of URL (bucket name for S3, hostname for HTTP) */
  host: string;
  /** Path portion of URL */
  path: string | undefined;
  /** Whether the path is relative */
  relative: boolean;
  /** Original raw location string */
  raw: string;
}

/**
 * Variable scope for Fn::Map template substitutions
 * Keys are placeholder names, values are substitution values
 */
export interface Scope {
  [key: string]: unknown;
  /** Default placeholder when using shorthand Fn::Map */
  _?: unknown;
}

/**
 * Options for the main include function
 */
export interface IncludeOptions {
  /** Pre-parsed template object (optional if url is provided) */
  template?: TemplateDocument;
  /** Location URL: file://, s3://, http://, https:// */
  url: string;
  /** Enable environment variable substitution from process.env */
  doEnv?: boolean;
  /** Enable Fn::Eval and Fn::IfEval (security risk) */
  doEval?: boolean;
  /** Variables to inject for ${KEY} substitution */
  inject?: Record<string, string | number | boolean>;
  /** Enable debug logging */
  doLog?: boolean;
  /** Logical resource IDs to skip in Fn::RefNow resolution */
  refNowIgnores?: string[];
  /** If true, return Ref syntax instead of throwing for unresolvable Fn::RefNow */
  refNowIgnoreMissing?: boolean;
  /** Root template for resource lookups in Fn::RefNow */
  rootTemplate?: TemplateDocument;
  /** Internal: current variable scope */
  scope?: Scope;
}

/**
 * Internal options passed through recurse calls
 */
export interface RecurseOptions extends IncludeOptions {
  /** Parsed base location */
  base: ParsedLocation;
  /** Current template/value being processed */
  cft: TemplateValue;
  /** Current property key (used for Fn::RefNow return type inference) */
  key?: string;
  /** Calling function name (for debug logging) */
  caller?: string;
}
```

### 2.2 CloudFormation Template Types

```typescript
// types/template.ts

/**
 * CloudFormation template document
 */
export interface TemplateDocument {
  AWSTemplateFormatVersion?: '2010-09-09';
  Description?: string;
  Metadata?: TemplateMetadata;
  Parameters?: Record<string, TemplateParameter>;
  Mappings?: Record<string, Record<string, Record<string, TemplateValue>>>;
  Conditions?: Record<string, IntrinsicFunction>;
  Transform?: string | string[];
  Resources?: Record<string, Resource>;
  Outputs?: Record<string, Output>;
}

/**
 * Template metadata section
 */
export interface TemplateMetadata {
  CfnInclude?: {
    GitCommit?: string;
    BuildDate?: string;
  };
  [key: string]: unknown;
}

/**
 * CloudFormation parameter definition
 */
export interface TemplateParameter {
  Type: ParameterType;
  Default?: TemplateValue;
  Description?: string;
  AllowedPattern?: string;
  AllowedValues?: string[];
  ConstraintDescription?: string;
  MaxLength?: number;
  MaxValue?: number;
  MinLength?: number;
  MinValue?: number;
  NoEcho?: boolean;
}

export type ParameterType =
  | 'String'
  | 'Number'
  | 'List<Number>'
  | 'CommaDelimitedList'
  | 'AWS::SSM::Parameter::Name'
  | 'AWS::SSM::Parameter::Value<String>'
  | `AWS::SSM::Parameter::Value<List<${string}>>`
  | `AWS::EC2::${string}::Id`
  | `List<AWS::EC2::${string}::Id>`;

/**
 * CloudFormation resource definition
 */
export interface Resource {
  Type: string;
  Condition?: string;
  DependsOn?: string | string[];
  DeletionPolicy?: 'Delete' | 'Retain' | 'Snapshot';
  UpdatePolicy?: Record<string, unknown>;
  UpdateReplacePolicy?: 'Delete' | 'Retain' | 'Snapshot';
  CreationPolicy?: Record<string, unknown>;
  Metadata?: Record<string, unknown>;
  Properties?: Record<string, TemplateValue>;
}

/**
 * CloudFormation output definition
 */
export interface Output {
  Value: TemplateValue;
  Description?: string;
  Condition?: string;
  Export?: {
    Name: TemplateValue;
  };
}

/**
 * Any valid template value (recursive)
 */
export type TemplateValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TemplateValue[]
  | TemplateObject
  | IntrinsicFunction;

/**
 * Plain template object (not an intrinsic function)
 */
export interface TemplateObject {
  [key: string]: TemplateValue;
}
```

### 2.3 Intrinsic Function Types (AWS Standard)

```typescript
// types/intrinsics-aws.ts

/**
 * AWS CloudFormation intrinsic functions
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference.html
 */

/** Fn::Base64 - Encode string to Base64 */
export interface FnBase64 {
  'Fn::Base64': TemplateValue;
}

/** Fn::Cidr - Generate CIDR blocks */
export interface FnCidr {
  'Fn::Cidr': [TemplateValue, number | TemplateValue, number | TemplateValue];
}

/** Fn::FindInMap - Lookup value in Mappings */
export interface FnFindInMap {
  'Fn::FindInMap': [string | TemplateValue, string | TemplateValue, string | TemplateValue];
}

/** Fn::GetAtt - Get resource attribute */
export interface FnGetAtt {
  'Fn::GetAtt': [string, string] | string;  // string form: "LogicalName.Attribute"
}

/** Fn::GetAZs - Get availability zones */
export interface FnGetAZs {
  'Fn::GetAZs': string | TemplateValue;
}

/** Fn::ImportValue - Import exported value */
export interface FnImportValue {
  'Fn::ImportValue': TemplateValue;
}

/** Fn::Join - Join array with delimiter */
export interface FnJoin {
  'Fn::Join': [string, TemplateValue[]];
}

/** Fn::Select - Select item from array by index */
export interface FnSelect {
  'Fn::Select': [number | TemplateValue, TemplateValue[]];
}

/** Fn::Split - Split string into array */
export interface FnSplit {
  'Fn::Split': [string, TemplateValue];
}

/** Fn::Sub - Substitute variables in string */
export interface FnSub {
  'Fn::Sub': string | [string, Record<string, TemplateValue>];
}

/** Ref - Reference parameter or resource */
export interface Ref {
  Ref: string;
}

/** Condition - Reference a condition */
export interface Condition {
  Condition: string;
}

/** Fn::And - Logical AND */
export interface FnAnd {
  'Fn::And': IntrinsicFunction[];
}

/** Fn::Equals - Equality comparison */
export interface FnEquals {
  'Fn::Equals': [TemplateValue, TemplateValue];
}

/** Fn::If - Conditional value */
export interface FnIf {
  'Fn::If': [string, TemplateValue, TemplateValue];
}

/** Fn::Not - Logical NOT */
export interface FnNot {
  'Fn::Not': [IntrinsicFunction];
}

/** Fn::Or - Logical OR */
export interface FnOr {
  'Fn::Or': IntrinsicFunction[];
}

/** Fn::GetParam - CodePipeline parameter */
export interface FnGetParam {
  'Fn::GetParam': [string, string, string];
}

/** Union of all AWS intrinsic functions */
export type AwsIntrinsicFunction =
  | FnBase64
  | FnCidr
  | FnFindInMap
  | FnGetAtt
  | FnGetAZs
  | FnImportValue
  | FnJoin
  | FnSelect
  | FnSplit
  | FnSub
  | Ref
  | Condition
  | FnAnd
  | FnEquals
  | FnIf
  | FnNot
  | FnOr
  | FnGetParam;
```

### 2.4 cfn-include Custom Function Types

```typescript
// types/intrinsics-cfn-include.ts

/**
 * cfn-include custom intrinsic functions
 */

/** Fn::Include - Include external template */
export interface FnInclude {
  'Fn::Include': FnIncludeArgs;
}

export type FnIncludeArgs =
  | string                              // Simple path
  | [string, string?, string?]          // [location, query?, parser?]
  | FnIncludeOptions;

export interface FnIncludeOptions {
  /** File/S3/HTTP location */
  location: string;
  /** Query to extract from template (lodash path or jmespath) */
  query?: string | TemplateValue;
  /** Parser: 'lodash' or 'jmespath' */
  parser?: 'lodash' | 'jmespath';
  /** Type of content: 'json', 'string', 'literal' */
  type?: 'json' | 'string' | 'literal';
  /** Context for literal interpolation */
  context?: Record<string, unknown>;
  /** Variables to inject */
  inject?: Record<string, unknown>;
  /** Treat as glob pattern */
  isGlob?: boolean;
  /** Ignore missing ${VAR} references */
  ignoreMissingVar?: boolean;
  /** Ignore missing files */
  ignoreMissingFile?: boolean;
  /** Debug logging */
  doLog?: boolean;
}

/** Fn::Map - Map over array/object */
export interface FnMap {
  'Fn::Map': FnMapArgs;
}

export type FnMapArgs =
  | [TemplateValue[], TemplateValue]                                    // [list, body]
  | [TemplateValue[], string, TemplateValue]                           // [list, placeholder, body]
  | [TemplateValue[], [string], TemplateValue]                         // [list, [placeholder], body]
  | [TemplateValue[], [string, string], TemplateValue]                 // [list, [placeholder, idx], body]
  | [TemplateValue[], [string, string, string], TemplateValue];        // [list, [placeholder, idx, size], body]

/** Fn::Length - Get array length */
export interface FnLength {
  'Fn::Length': TemplateValue | TemplateValue[];
}

/** Fn::Flatten - Flatten array one level */
export interface FnFlatten {
  'Fn::Flatten': TemplateValue;
}

/** Fn::FlattenDeep - Flatten array recursively */
export interface FnFlattenDeep {
  'Fn::FlattenDeep': TemplateValue;
}

/** Fn::Uniq - Remove duplicates from array */
export interface FnUniq {
  'Fn::Uniq': TemplateValue;
}

/** Fn::Compact - Remove falsy values from array */
export interface FnCompact {
  'Fn::Compact': TemplateValue;
}

/** Fn::Concat - Concatenate arrays */
export interface FnConcat {
  'Fn::Concat': TemplateValue[];
}

/** Fn::Sort - Sort array */
export interface FnSort {
  'Fn::Sort': TemplateValue;
}

/** Fn::SortedUniq - Sort and remove duplicates */
export interface FnSortedUniq {
  'Fn::SortedUniq': TemplateValue;
}

/** Fn::SortBy - Sort by iteratees */
export interface FnSortBy {
  'Fn::SortBy': {
    list: TemplateValue[];
    iteratees: string | string[];
  };
}

/** Fn::SortObject - Sort object keys */
export interface FnSortObject {
  'Fn::SortObject': FnSortObjectArgs;
}

export type FnSortObjectArgs =
  | { object: TemplateObject; options?: SortObjectOptions }
  | TemplateObject;  // Object to sort (no options)

export interface SortObjectOptions {
  deep?: boolean;
  sortWith?: (a: string, b: string) => number;
}

/** Fn::Without - Remove values from array */
export interface FnWithout {
  'Fn::Without': [TemplateValue[], TemplateValue[]] | { list: TemplateValue[]; withouts: TemplateValue[] };
}

/** Fn::Omit - Omit keys from object */
export interface FnOmit {
  'Fn::Omit': [TemplateObject, string[]] | { object: TemplateObject; omits: string[] };
}

/** Fn::OmitEmpty - Omit falsy values from object */
export interface FnOmitEmpty {
  'Fn::OmitEmpty': TemplateObject;
}

/** Fn::Merge - Shallow merge objects */
export interface FnMerge {
  'Fn::Merge': TemplateValue[];
}

/** Fn::DeepMerge - Deep merge objects */
export interface FnDeepMerge {
  'Fn::DeepMerge': TemplateValue[];
}

/** Fn::ObjectKeys - Get object keys */
export interface FnObjectKeys {
  'Fn::ObjectKeys': TemplateValue;
}

/** Fn::ObjectValues - Get object values */
export interface FnObjectValues {
  'Fn::ObjectValues': TemplateValue;
}

/** Fn::Stringify - JSON stringify */
export interface FnStringify {
  'Fn::Stringify': TemplateValue;
}

/** Fn::StringSplit - Split string */
export interface FnStringSplit {
  'Fn::StringSplit': {
    string: string;
    separator?: string;
    doLog?: boolean;
  };
}

/** Fn::GetEnv - Get environment variable */
export interface FnGetEnv {
  'Fn::GetEnv': string | [string, string];  // name or [name, default]
}

/** Fn::UpperCamelCase - Convert to UpperCamelCase */
export interface FnUpperCamelCase {
  'Fn::UpperCamelCase': string;
}

/** Fn::LowerCamelCase - Convert to lowerCamelCase */
export interface FnLowerCamelCase {
  'Fn::LowerCamelCase': string;
}

/** Fn::Sequence - Generate numeric/char sequence */
export interface FnSequence {
  'Fn::Sequence': [number | string, number | string] | [number | string, number | string, number];
}

/** Fn::Outputs - Generate CloudFormation Outputs with exports */
export interface FnOutputs {
  'Fn::Outputs': Record<string, TemplateValue | { Value: TemplateValue; Condition?: string }>;
}

/** Fn::Filenames - Get filenames matching glob */
export interface FnFilenames {
  'Fn::Filenames': string | {
    location: string;
    omitExtension?: boolean;
    doLog?: boolean;
  };
}

/** Fn::Eval - Execute JavaScript (DANGEROUS) */
export interface FnEval {
  'Fn::Eval': {
    state?: unknown;
    script: string;
    inject?: Record<string, unknown>;
    doLog?: boolean;
  };
}

/** Fn::IfEval - Conditional with JavaScript evaluation (DANGEROUS) */
export interface FnIfEval {
  'Fn::IfEval': {
    evalCond: string;
    truthy?: TemplateValue;
    falsy?: TemplateValue;
    inject?: Record<string, unknown>;
    doLog?: boolean;
  };
}

/** Fn::JoinNow - Join immediately (not deferred to CloudFormation) */
export interface FnJoinNow {
  'Fn::JoinNow': [string, TemplateValue[]];
}

/** Fn::SubNow - Substitute immediately */
export interface FnSubNow {
  'Fn::SubNow': string | [string, Record<string, TemplateValue>];
}

/** Fn::RefNow - Resolve reference immediately */
export interface FnRefNow {
  'Fn::RefNow': string | FnRefNowOptions;
}

export interface FnRefNowOptions {
  Ref?: string;
  ref?: string;
  returnType?: 'arn' | 'name';
}

/** Fn::ApplyTags - Apply tags to taggable resources */
export interface FnApplyTags {
  'Fn::ApplyTags': {
    tags?: Tag[];
    Tags?: Tag[];
    resources: Record<string, Resource>;
  };
}

export interface Tag {
  Key: string;
  Value: TemplateValue;
}

/** Union of all cfn-include custom functions */
export type CfnIncludeIntrinsicFunction =
  | FnInclude
  | FnMap
  | FnLength
  | FnFlatten
  | FnFlattenDeep
  | FnUniq
  | FnCompact
  | FnConcat
  | FnSort
  | FnSortedUniq
  | FnSortBy
  | FnSortObject
  | FnWithout
  | FnOmit
  | FnOmitEmpty
  | FnMerge
  | FnDeepMerge
  | FnObjectKeys
  | FnObjectValues
  | FnStringify
  | FnStringSplit
  | FnGetEnv
  | FnUpperCamelCase
  | FnLowerCamelCase
  | FnSequence
  | FnOutputs
  | FnFilenames
  | FnEval
  | FnIfEval
  | FnJoinNow
  | FnSubNow
  | FnRefNow
  | FnApplyTags;

/** All intrinsic functions (AWS + cfn-include) */
export type IntrinsicFunction = AwsIntrinsicFunction | CfnIncludeIntrinsicFunction;
```

### 2.5 Utility Types

```typescript
// types/utils.ts

/**
 * Type guards for intrinsic function detection
 */
export function isFnInclude(value: unknown): value is FnInclude {
  return isPlainObject(value) && 'Fn::Include' in value;
}

export function isFnMap(value: unknown): value is FnMap {
  return isPlainObject(value) && 'Fn::Map' in value;
}

export function isFnRefNow(value: unknown): value is FnRefNow {
  return isPlainObject(value) && 'Fn::RefNow' in value;
}

export function isIntrinsicFunction(value: unknown): value is IntrinsicFunction {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 1) return false;
  return keys[0].startsWith('Fn::') || keys[0] === 'Ref' || keys[0] === 'Condition';
}

export function isOurExplicitFunction(key: string): boolean {
  const awsFunctions = [
    'Fn::Base64', 'Fn::FindInMap', 'Fn::GetAtt', 'Fn::GetAZs',
    'Fn::ImportValue', 'Fn::Join', 'Fn::Select', 'Fn::Split',
    'Fn::Sub', 'Fn::Cidr', 'Fn::GetParam', 'Fn::And', 'Fn::Equals',
    'Fn::If', 'Fn::Not', 'Fn::Or', 'Ref', 'Condition'
  ];
  return /^Fn::/.test(key) && !awsFunctions.includes(key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Query parser types
 */
export type QueryParser = 'lodash' | 'jmespath' | 'default';

export interface QueryParsers {
  lodash: <T>(obj: T, path: string) => unknown;
  jmespath: <T>(obj: T, query: string) => unknown;
  default: <T>(obj: T, query: string) => unknown;
}

/**
 * CLI options
 */
export interface CliOptions {
  path?: string;
  minimize?: boolean;
  metadata?: boolean;
  validate?: boolean;
  yaml?: boolean;
  lineWidth?: number;
  bucket?: string;
  context?: string;
  prefix?: string;
  enable?: string;
  inject?: Record<string, unknown>;
  doLog?: boolean;
  'ref-now-ignore-missing'?: boolean;
  'ref-now-ignores'?: string;
  version?: boolean;
}

/**
 * CloudFormation client options
 */
export interface CfnClientOptions {
  region?: string;
  bucket?: string;
  prefix?: string;
}
```

### 2.6 YAML Schema Types

```typescript
// types/schema.ts

import type { Type, Schema } from 'js-yaml';

export interface YamlTagDefinition {
  short: string;
  full: string;
  type: 'scalar' | 'sequence' | 'mapping';
  dotSyntax?: boolean;
}

/**
 * Custom YAML type that constructs CloudFormation intrinsic functions
 */
export function createYamlType(definition: YamlTagDefinition): Type;

/**
 * Extended YAML schema with CloudFormation tags
 */
export const cfnSchema: Schema;

/**
 * List of AWS intrinsic function names (bang syntax)
 */
export const BANG_AMAZON_FUNCS: readonly string[];

/**
 * List of AWS intrinsic function names (explicit syntax)
 */
export const EXPLICIT_AMAZON_FUNCS: readonly string[];
```

---

## 3. tsconfig.json Design

### 3.1 Recommended Configuration

```jsonc
// tsconfig.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    // Target & Module
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    
    // Strict Type Checking (ALL ENABLED)
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    
    // Additional Checks
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": false,  // Too restrictive for CFN templates
    
    // Interop
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    
    // Output
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    
    // Type Checking
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "t/**/*"
  ]
}
```

### 3.2 Configuration Rationale

| Option | Value | Rationale |
|--------|-------|-----------|
| `target: ES2022` | ES2022 | Node 20+ supports ES2022 features, enables `Array.at()`, `Object.hasOwn()` |
| `module: NodeNext` | NodeNext | Native ESM with `.js` extensions, aligns with Phase 2 ESM migration |
| `strict: true` | true | Catches type errors early, essential for complex recursive functions |
| `noUncheckedIndexedAccess` | true | Critical for template object access safety |
| `exactOptionalPropertyTypes` | true | Prevents `undefined` where only omission is intended |
| `useUnknownInCatchVariables` | true | Safer error handling in async code |
| `verbatimModuleSyntax` | true | Explicit `import type` for type-only imports |
| `declaration: true` | true | Generates `.d.ts` for library consumers |

### 3.3 Development vs Production Configs

```jsonc
// tsconfig.dev.json (extends base)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "incremental": true,
    "tsBuildInfoFile": "./.tsbuildinfo"
  }
}
```

```jsonc
// tsconfig.build.json (for release)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "removeComments": true,
    "stripInternal": true
  },
  "exclude": [
    "**/*.test.ts",
    "**/__tests__/**"
  ]
}
```

---

## 4. Migration Strategy

### 4.1 Recommended Approach: Full Conversion

**Decision: Full TypeScript conversion (not gradual `allowJs`)**

**Rationale:**
1. Codebase is small (10 source files, ~1,500 lines)
2. Types are highly interconnected (gradual conversion creates friction)
3. `recurse()` function requires complete type coverage to be useful
4. Benefits of strict typing only realized with full coverage

### 4.2 File Conversion Order

Ordered by dependency depth (leaves first):

```
Phase 1: Leaf modules (no internal dependencies)
├── lib/utils.ts              (10 min) - Simple string utilities
├── lib/parselocation.ts      (15 min) - URL parsing
├── lib/replaceEnv.ts         (20 min) - String substitution
├── lib/request.ts            (20 min) - HTTP client
└── lib/promise.ts            (30 min) - Bluebird wrapper

Phase 2: Core utilities
├── lib/internals.ts          (45 min) - AWS pseudo-params, ARN builder
├── lib/schema.ts             (60 min) - YAML tag definitions
├── lib/yaml.ts               (20 min) - YAML load/dump
└── lib/include/query.ts      (20 min) - Query parsers

Phase 3: Main modules
├── lib/cfnclient.ts          (30 min) - CloudFormation client
└── index.ts                  (3-4 hrs) - Main include logic

Phase 4: CLI
└── bin/cli.ts                (1 hr)   - Command-line interface

Estimated total: 8-10 hours
```

### 4.3 Testing Strategy

#### 4.3.1 Type Testing

```typescript
// types/__tests__/intrinsics.test-d.ts
import { expectType, expectError } from 'tsd';
import type { FnMap, FnInclude, TemplateValue } from '../intrinsics';

// Valid Fn::Map
expectType<FnMap>({ 'Fn::Map': [[1, 2, 3], { Value: '_' }] });
expectType<FnMap>({ 'Fn::Map': [[1, 2, 3], 'x', { Value: '${x}' }] });

// Invalid Fn::Map (wrong shape)
expectError<FnMap>({ 'Fn::Map': 'invalid' });
expectError<FnMap>({ 'Fn::Map': [] });
```

#### 4.3.2 Runtime Testing (Existing Mocha Tests)

```typescript
// t/include.test.ts
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'mocha';
import include from '../src/index.js';
import type { IncludeOptions, TemplateDocument } from '../src/types/index.js';

describe('include', () => {
  it('resolves Fn::Map with typed options', async () => {
    const options: IncludeOptions = {
      template: {
        'Fn::Map': [[1, 2], { Value: '_' }]
      },
      url: 'file:///template.json'
    };
    
    const result = await include(options);
    assert.deepEqual(result, [{ Value: 1 }, { Value: 2 }]);
  });
});
```

#### 4.3.3 Test Coverage Requirements

| Category | Target | Notes |
|----------|--------|-------|
| Type definitions | 100% | All exported types have test-d.ts coverage |
| Core functions | 95% | `recurse`, `fnInclude`, `handleIncludeBody` |
| Edge cases | 90% | Null handling, empty arrays, missing keys |
| Integration | 85% | File/S3/HTTP loading paths |

### 4.4 Pre-Migration Checklist

```markdown
- [ ] Install TypeScript 5.4+ and development dependencies
- [ ] Create `src/` directory structure
- [ ] Copy type definition files to `src/types/`
- [ ] Set up `tsconfig.json` configurations
- [ ] Configure ESLint for TypeScript (`@typescript-eslint/*`)
- [ ] Set up `tsd` for type testing
- [ ] Create `build` and `typecheck` npm scripts
- [ ] Update `.gitignore` for `dist/`, `.tsbuildinfo`
```

### 4.5 Post-Migration Checklist

```markdown
- [ ] All existing tests pass with TypeScript source
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run build` produces valid JavaScript output
- [ ] Generated `.d.ts` files are valid and complete
- [ ] Package.json exports updated for ESM + types
- [ ] Downstream CDK integration tested (Phase 4 blocker)
```

---

## 5. Typing Challenges

### 5.1 eval() and Dynamic Code Execution

**Challenge:** `Fn::Eval` and `Fn::IfEval` use JavaScript `eval()` which cannot be statically typed.

```javascript
// Current code
return eval(script);
```

**TypeScript Solution:**

```typescript
// types/eval.ts
export interface EvalContext {
  state: unknown;
  [key: string]: unknown;
}

// Implementation
function executeFnEval(args: FnEval['Fn::Eval']): unknown {
  const { state, script, inject, doLog } = args;
  
  // Create execution context
  const context: EvalContext = { state, ...inject };
  
  // Execute in sandboxed context
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function('ctx', `with(ctx) { return (${script}); }`);
  return fn(context) as unknown;
}
```

**Type safety measures:**
1. Return type is always `unknown` (caller must validate)
2. ESLint rule suppression with explicit comment
3. Runtime validation of result before use

### 5.2 Dynamic Object Keys

**Challenge:** CloudFormation templates have arbitrary string keys.

```typescript
// Problem: TypeScript doesn't know what keys exist
const resources = template.Resources;
const myRole = resources['MyRole'];  // Type: TemplateValue | undefined
```

**Solution: Type narrowing utilities**

```typescript
// lib/type-guards.ts
export function getResource(
  template: TemplateDocument,
  logicalId: string
): Resource | undefined {
  return template.Resources?.[logicalId] as Resource | undefined;
}

export function hasResource(
  template: TemplateDocument,
  logicalId: string
): boolean {
  return logicalId in (template.Resources ?? {});
}

// Usage in Fn::RefNow
if (rootTemplate && hasResource(rootTemplate, refName)) {
  const resource = getResource(rootTemplate, refName)!;
  // resource is typed as Resource
}
```

### 5.3 Bluebird Promise.props

**Challenge:** Bluebird's `Promise.props` maps over object values returning promises.

```javascript
// Current usage
return Promise.props(
  _.mapValues(cft, (template, key) => recurse({ ... }))
);
```

**TypeScript Solution:**

```typescript
// lib/promise.ts
import Bluebird from 'bluebird';

/**
 * Resolve all promise values in an object
 */
export async function promiseProps<T extends Record<string, unknown>>(
  obj: { [K in keyof T]: T[K] | Promise<T[K]> }
): Promise<T> {
  // Bluebird.props is already properly typed
  return Bluebird.props(obj) as Promise<T>;
}

// Alternative: Native Promise implementation
export async function promisePropsNative<T extends Record<string, unknown>>(
  obj: { [K in keyof T]: T[K] | Promise<T[K]> }
): Promise<T> {
  const entries = Object.entries(obj);
  const values = await Promise.all(entries.map(([, v]) => v));
  return Object.fromEntries(
    entries.map(([k], i) => [k, values[i]])
  ) as T;
}
```

**Migration path:**
1. Short-term: Use Bluebird's TypeScript definitions (`@types/bluebird`)
2. Long-term: Replace with native `Promise.all` + object reconstruction

### 5.4 yaml.load Type Safety

**Challenge:** `js-yaml`'s `load()` returns `unknown`, losing all type information.

```javascript
// Current code
const json = yaml.load(res, { schema: yamlSchema });
```

**Solution: Typed wrapper with validation**

```typescript
// lib/yaml.ts
import jsYaml from 'js-yaml';
import { cfnSchema } from './schema.js';
import type { TemplateDocument, TemplateValue } from '../types/index.js';

export function loadTemplate(content: string): TemplateDocument {
  const result = jsYaml.load(content, { schema: cfnSchema });
  
  // Runtime validation
  if (!isValidTemplate(result)) {
    throw new TypeError('Invalid CloudFormation template structure');
  }
  
  return result;
}

export function loadValue(content: string): TemplateValue {
  return jsYaml.load(content, { schema: cfnSchema }) as TemplateValue;
}

function isValidTemplate(value: unknown): value is TemplateDocument {
  if (typeof value !== 'object' || value === null) return false;
  
  // Minimal validation
  const obj = value as Record<string, unknown>;
  if ('AWSTemplateFormatVersion' in obj) {
    return obj.AWSTemplateFormatVersion === '2010-09-09';
  }
  // Allow templates without version
  return true;
}
```

### 5.5 Recursive Type Definitions

**Challenge:** Template values can nest infinitely.

```typescript
// Naive approach causes TypeScript error:
// Type alias 'TemplateValue' circularly references itself
type TemplateValue = string | number | { [key: string]: TemplateValue };
```

**Solution: Interface for object shapes**

```typescript
// This works because interfaces allow self-reference
export interface TemplateObject {
  [key: string]: TemplateValue;
}

export type TemplateValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TemplateValue[]
  | TemplateObject
  | IntrinsicFunction;
```

### 5.6 Function Overloads for Polymorphic APIs

**Challenge:** Functions accept multiple input shapes.

```typescript
// fnIncludeOpts accepts 3 different input types
function fnIncludeOpts(cft, opts) {
  if (_.isPlainObject(cft)) { ... }
  else if (_.isArray(cft)) { ... }
  else { /* string */ ... }
}
```

**Solution: Function overloads**

```typescript
// Overload signatures
function fnIncludeOpts(cft: FnIncludeOptions, opts: RecurseOptions): FnIncludeOptions;
function fnIncludeOpts(cft: [string, string?, string?], opts: RecurseOptions): FnIncludeOptions;
function fnIncludeOpts(cft: string, opts: RecurseOptions): FnIncludeOptions;

// Implementation
function fnIncludeOpts(
  cft: FnIncludeArgs,
  opts: RecurseOptions
): FnIncludeOptions {
  if (isPlainObject(cft)) {
    return { ...cft, ...opts } as FnIncludeOptions;
  }
  if (Array.isArray(cft)) {
    const [location, query, parser = 'lodash'] = cft;
    return { location, query, parser, ...opts };
  }
  // String
  const splits = cft.split('|');
  if (splits.length > 1) {
    const [location, query, parser = 'lodash'] = splits;
    return { location, query, parser, ...opts };
  }
  return { location: cft, ...opts };
}
```

---

## 6. Risk Assessment

### 6.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Type definition errors | Medium | High | Comprehensive type tests with `tsd` |
| Runtime behavior changes | Low | Critical | 100% existing test coverage before migration |
| Bluebird compatibility | Low | Medium | Use `@types/bluebird`, consider native Promise migration |
| Build complexity | Medium | Low | Well-documented npm scripts |
| Performance regression | Low | Low | Benchmark before/after (Phase 1 benchmarks) |
| Third-party type issues | Medium | Medium | Pin dependency versions, override types if needed |

### 6.2 Breaking Changes

**None expected.** TypeScript compilation should produce semantically identical JavaScript.

**Potential edge cases:**
1. Error message strings may differ slightly due to TypeScript's stricter checks
2. Stack traces will reference `.ts` files (source maps required for debugging)
3. Package.json exports must be updated correctly

### 6.3 Rollback Plan

```bash
# If TypeScript conversion causes issues
git checkout main -- src/ lib/ index.js bin/cli.js
npm run test  # Verify original code works
```

---

## 7. Implementation Timeline

### 7.1 Gantt Chart (Suggested)

```
Week 1: Foundation
├── Day 1-2: Set up TypeScript, create type definitions
├── Day 3-4: Convert leaf modules (utils, parselocation, replaceEnv)
└── Day 5: Convert request.ts, promise.ts

Week 2: Core Modules
├── Day 1-2: Convert internals.ts, schema.ts
├── Day 3: Convert yaml.ts, query.ts
└── Day 4-5: Start index.ts conversion (recurse function)

Week 3: Main Logic + CLI
├── Day 1-3: Complete index.ts conversion
├── Day 4: Convert cli.ts
└── Day 5: Integration testing

Week 4: Finalization
├── Day 1-2: Type testing with tsd
├── Day 3: Documentation updates
├── Day 4: Performance benchmarks
└── Day 5: Release preparation
```

### 7.2 Dependencies on Other Phases

| Dependency | Direction | Notes |
|------------|-----------|-------|
| Phase 2 (ESM) | Before TS | TypeScript targets ESM output |
| Phase 4 (CDK) | After TS | CDK integration needs `.d.ts` files |
| Phase 1 (Perf) | Before TS | Establish baseline benchmarks |

---

## Appendix A: Complete Type Index

```typescript
// types/index.ts - Main export file
export type {
  // Core
  AwsPseudoParameters,
  ParsedLocation,
  Scope,
  IncludeOptions,
  RecurseOptions,
  
  // Template
  TemplateDocument,
  TemplateMetadata,
  TemplateParameter,
  ParameterType,
  Resource,
  Output,
  TemplateValue,
  TemplateObject,
  
  // AWS Intrinsics
  FnBase64,
  FnCidr,
  FnFindInMap,
  FnGetAtt,
  FnGetAZs,
  FnImportValue,
  FnJoin,
  FnSelect,
  FnSplit,
  FnSub,
  Ref,
  Condition,
  FnAnd,
  FnEquals,
  FnIf,
  FnNot,
  FnOr,
  FnGetParam,
  AwsIntrinsicFunction,
  
  // cfn-include Intrinsics
  FnInclude,
  FnIncludeArgs,
  FnIncludeOptions,
  FnMap,
  FnMapArgs,
  FnLength,
  FnFlatten,
  FnFlattenDeep,
  FnUniq,
  FnCompact,
  FnConcat,
  FnSort,
  FnSortedUniq,
  FnSortBy,
  FnSortObject,
  SortObjectOptions,
  FnWithout,
  FnOmit,
  FnOmitEmpty,
  FnMerge,
  FnDeepMerge,
  FnObjectKeys,
  FnObjectValues,
  FnStringify,
  FnStringSplit,
  FnGetEnv,
  FnUpperCamelCase,
  FnLowerCamelCase,
  FnSequence,
  FnOutputs,
  FnFilenames,
  FnEval,
  FnIfEval,
  FnJoinNow,
  FnSubNow,
  FnRefNow,
  FnRefNowOptions,
  FnApplyTags,
  Tag,
  CfnIncludeIntrinsicFunction,
  IntrinsicFunction,
  
  // Utilities
  QueryParser,
  QueryParsers,
  CliOptions,
  CfnClientOptions,
  YamlTagDefinition,
} from './types.js';

// Re-export type guards
export {
  isFnInclude,
  isFnMap,
  isFnRefNow,
  isIntrinsicFunction,
  isOurExplicitFunction,
} from './type-guards.js';
```

---

## Appendix B: npm Scripts

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "build:watch": "tsc -p tsconfig.build.json --watch",
    "typecheck": "tsc -p tsconfig.dev.json",
    "typecheck:watch": "tsc -p tsconfig.dev.json --watch",
    "test:types": "tsd",
    "test": "npm run typecheck && npm run test:run",
    "clean": "rm -rf dist .tsbuildinfo",
    "prepublishOnly": "npm run clean && npm run build"
  }
}
```

---

## Appendix C: Reference Implementation Snippets

### C.1 Main Include Function (Typed)

```typescript
// src/index.ts
import type { IncludeOptions, TemplateDocument, ParsedLocation, Scope, RecurseOptions } from './types/index.js';
import { parseLocation } from './lib/parselocation.js';
import { recurse } from './lib/recurse.js';
import { fnInclude } from './lib/include.js';

export async function include(options: IncludeOptions): Promise<TemplateDocument> {
  let { template } = options;
  
  options.doEnv = getBoolEnvOpt(options.doEnv, 'CFN_INCLUDE_DO_ENV');
  options.doEval = getBoolEnvOpt(options.doEval, 'CFN_INCLUDE_DO_EVAL');
  
  const base: ParsedLocation = parseLocation(options.url);
  const scope: Scope = options.scope ?? {};
  
  if (base.relative) {
    throw new Error('url cannot be relative');
  }
  
  template = template === undefined
    ? await fnInclude({ base, scope, cft: options.url, ...options })
    : template;
  
  const resolvedTemplate = await Promise.resolve(template);
  
  return recurse({
    base,
    scope,
    cft: resolvedTemplate,
    rootTemplate: resolvedTemplate,
    ...options,
  });
}

function getBoolEnvOpt(opt: boolean | undefined, envKey: string): boolean {
  return process.env[envKey] ? Boolean(process.env[envKey]) : (opt ?? false);
}

export default include;
export type * from './types/index.js';
```

### C.2 ParseLocation Function (Typed)

```typescript
// src/lib/parselocation.ts
import type { ParsedLocation } from '../types/index.js';

export function parseLocation(location: string | undefined): ParsedLocation {
  if (!location) {
    return {
      protocol: undefined,
      host: '',
      path: undefined,
      relative: true,
      raw: '',
    };
  }
  
  const parsed = location.match(/^(((\w+):)?\/\/)?(.*?)([\\\/](.*))?$/);
  
  if (!parsed) {
    throw new Error(`Invalid location format: ${location}`);
  }
  
  return {
    protocol: parsed[3],
    host: parsed[4] ?? '',
    path: parsed[5],
    relative: parsed[1] === undefined,
    raw: location,
  };
}
```

---

*Document generated: 2026-02-08*
*Estimated conversion effort: 8-10 developer hours*
*Recommended Node.js version: 20.19+*
*Recommended TypeScript version: 5.4+*
