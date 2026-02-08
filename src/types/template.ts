/**
 * CloudFormation Template Type Definitions
 */

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
  [key: string]: any;
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
  Type: string;
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
 * Union of all intrinsic function types
 */
export type IntrinsicFunction =
  | FnInclude
  | FnMap
  | FnMerge
  | FnDeepMerge
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
  | FnLength
  | FnStringify
  | FnStringSplit
  | FnObjectKeys
  | FnObjectValues
  | FnFilenames
  | FnSequence
  | FnOutputs
  | FnGetEnv
  | FnUpperCamelCase
  | FnLowerCamelCase
  | FnEval
  | FnIfEval
  | FnJoinNow
  | FnSubNow
  | FnRefNow
  | FnApplyTags
  // AWS intrinsics
  | FnBase64
  | FnFindInMap
  | FnGetAtt
  | FnGetAZs
  | FnImportValue
  | FnJoin
  | FnSelect
  | FnSub
  | FnSplit
  | FnRef
  | FnCidr
  | FnGetParam
  | FnAnd
  | FnEquals
  | FnIf
  | FnNot
  | FnOr
  | Condition;

// cfn-include custom intrinsics
export interface FnInclude {
  'Fn::Include': string | FnIncludeOptions | [string, string?, string?];
}

export interface FnIncludeOptions {
  location: string;
  type?: 'json' | 'string' | 'literal';
  query?: string | TemplateValue;
  parser?: 'lodash' | 'jmespath';
  context?: Record<string, TemplateValue>;
  inject?: Record<string, string>;
  isGlob?: boolean;
  ignoreMissingVar?: boolean;
  ignoreMissingFile?: boolean;
  doEnv?: boolean;
  doEval?: boolean;
  doLog?: boolean;
}

export interface FnMap {
  'Fn::Map': [TemplateValue, TemplateValue] | [TemplateValue, string | string[], TemplateValue];
}

export interface FnMerge {
  'Fn::Merge': TemplateValue[];
}

export interface FnDeepMerge {
  'Fn::DeepMerge': TemplateValue[];
}

export interface FnFlatten {
  'Fn::Flatten': TemplateValue;
}

export interface FnFlattenDeep {
  'Fn::FlattenDeep': TemplateValue;
}

export interface FnUniq {
  'Fn::Uniq': TemplateValue;
}

export interface FnCompact {
  'Fn::Compact': TemplateValue;
}

export interface FnConcat {
  'Fn::Concat': TemplateValue[];
}

export interface FnSort {
  'Fn::Sort': TemplateValue;
}

export interface FnSortedUniq {
  'Fn::SortedUniq': TemplateValue;
}

export interface FnSortBy {
  'Fn::SortBy': { list: TemplateValue; iteratees: string | string[] };
}

export interface FnSortObject {
  'Fn::SortObject': { object?: TemplateValue; options?: Record<string, unknown> } | TemplateValue;
}

export interface FnWithout {
  'Fn::Without': [TemplateValue[], TemplateValue[]] | { list: TemplateValue[]; withouts: TemplateValue[] };
}

export interface FnOmit {
  'Fn::Omit': [TemplateObject, string[]] | { object: TemplateObject; omits: string[] };
}

export interface FnOmitEmpty {
  'Fn::OmitEmpty': TemplateObject;
}

export interface FnLength {
  'Fn::Length': TemplateValue;
}

export interface FnStringify {
  'Fn::Stringify': TemplateValue;
}

export interface FnStringSplit {
  'Fn::StringSplit': { string: string; separator?: string; doLog?: boolean };
}

export interface FnObjectKeys {
  'Fn::ObjectKeys': TemplateValue;
}

export interface FnObjectValues {
  'Fn::ObjectValues': TemplateValue;
}

export interface FnFilenames {
  'Fn::Filenames': string | { location: string; omitExtension?: boolean; doLog?: boolean };
}

export interface FnSequence {
  'Fn::Sequence': [number | string, number | string, number?];
}

export interface FnOutputs {
  'Fn::Outputs': Record<string, TemplateValue>;
}

export interface FnGetEnv {
  'Fn::GetEnv': string | [string, TemplateValue];
}

export interface FnUpperCamelCase {
  'Fn::UpperCamelCase': string;
}

export interface FnLowerCamelCase {
  'Fn::LowerCamelCase': string;
}

export interface FnEval {
  'Fn::Eval': { state?: unknown; script: string; inject?: Record<string, string>; doLog?: boolean };
}

export interface FnIfEval {
  'Fn::IfEval': {
    evalCond: string;
    truthy?: TemplateValue;
    falsy?: TemplateValue;
    inject?: Record<string, string>;
    doLog?: boolean;
  };
}

export interface FnJoinNow {
  'Fn::JoinNow': [string, TemplateValue[]];
}

export interface FnSubNow {
  'Fn::SubNow': string | [string, Record<string, TemplateValue>];
}

export interface FnRefNow {
  'Fn::RefNow': string | { Ref?: string; ref?: string; returnType?: 'arn' | 'name' };
}

export interface FnApplyTags {
  'Fn::ApplyTags': { tags?: TemplateValue[]; Tags?: TemplateValue[]; resources: Record<string, Resource> };
}

// AWS standard intrinsics
export interface FnBase64 {
  'Fn::Base64': TemplateValue;
}

export interface FnFindInMap {
  'Fn::FindInMap': [string | TemplateValue, string | TemplateValue, string | TemplateValue];
}

export interface FnGetAtt {
  'Fn::GetAtt': [string, string] | string;
}

export interface FnGetAZs {
  'Fn::GetAZs': string | TemplateValue;
}

export interface FnImportValue {
  'Fn::ImportValue': TemplateValue;
}

export interface FnJoin {
  'Fn::Join': [string, TemplateValue[]];
}

export interface FnSelect {
  'Fn::Select': [number | TemplateValue, TemplateValue[]];
}

export interface FnSub {
  'Fn::Sub': string | [string, Record<string, TemplateValue>];
}

export interface FnSplit {
  'Fn::Split': [string, TemplateValue];
}

export interface FnRef {
  Ref: string;
}

export interface FnCidr {
  'Fn::Cidr': [TemplateValue, number | TemplateValue, number | TemplateValue];
}

export interface FnGetParam {
  'Fn::GetParam': [string, string, string];
}

export interface FnAnd {
  'Fn::And': TemplateValue[];
}

export interface FnEquals {
  'Fn::Equals': [TemplateValue, TemplateValue];
}

export interface FnIf {
  'Fn::If': [string, TemplateValue, TemplateValue];
}

export interface FnNot {
  'Fn::Not': [TemplateValue];
}

export interface FnOr {
  'Fn::Or': TemplateValue[];
}

export interface Condition {
  Condition: string;
}
