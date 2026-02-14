import type { FnHandler, RecurseFn } from './types.js';

import { createFnMap } from './fn-map.js';
import { createFnLength } from './fn-length.js';
import { createFnInclude } from './fn-include.js';
import { createFnFlatten, createFnFlattenDeep, createFnUniq, createFnCompact, createFnConcat, createFnSort, createFnSortedUniq, createFnSortBy, createFnWithout } from './fn-array-ops.js';
import { createFnOmit, createFnOmitEmpty, createFnMerge, createFnDeepMerge, createFnObjectKeys, createFnObjectValues, createFnSortObject } from './fn-object-ops.js';
import { createFnStringify, createFnStringSplit, createFnUpperCamelCase, createFnLowerCamelCase, createFnJoinNow, createFnSubNow } from './fn-string-ops.js';
import { createFnGetEnv, createFnEval, createFnFilenames, createFnOutputs, createFnSequence, createFnIfEval, createFnRefNow, createFnApplyTags } from './fn-misc.js';

export interface FnRegistry {
  handlers: Record<string, FnHandler>;
  fnInclude: ReturnType<typeof createFnInclude>['fnInclude'];
}

export function buildRegistry(recurse: RecurseFn): FnRegistry {
  const includeModule = createFnInclude(recurse);

  const handlers: Record<string, FnHandler> = {
    'Fn::Map': createFnMap(recurse),
    'Fn::Length': createFnLength(recurse),
    'Fn::Include': includeModule.handleFnIncludeInRecurse,
    'Fn::Flatten': createFnFlatten(recurse),
    'Fn::FlattenDeep': createFnFlattenDeep(recurse),
    'Fn::Uniq': createFnUniq(recurse),
    'Fn::Compact': createFnCompact(recurse),
    'Fn::Concat': createFnConcat(recurse),
    'Fn::Sort': createFnSort(recurse),
    'Fn::SortedUniq': createFnSortedUniq(recurse),
    'Fn::SortBy': createFnSortBy(recurse),
    'Fn::SortObject': createFnSortObject(recurse),
    'Fn::Without': createFnWithout(recurse),
    'Fn::Omit': createFnOmit(recurse),
    'Fn::OmitEmpty': createFnOmitEmpty(recurse),
    'Fn::Eval': createFnEval(recurse),
    'Fn::Filenames': createFnFilenames(recurse),
    'Fn::Merge': createFnMerge(recurse),
    'Fn::DeepMerge': createFnDeepMerge(recurse),
    'Fn::ObjectKeys': createFnObjectKeys(recurse),
    'Fn::ObjectValues': createFnObjectValues(recurse),
    'Fn::Stringify': createFnStringify(recurse),
    'Fn::StringSplit': createFnStringSplit(recurse),
    'Fn::UpperCamelCase': createFnUpperCamelCase(),
    'Fn::LowerCamelCase': createFnLowerCamelCase(),
    'Fn::GetEnv': createFnGetEnv(),
    'Fn::Outputs': createFnOutputs(recurse),
    'Fn::Sequence': createFnSequence(recurse),
    'Fn::IfEval': createFnIfEval(recurse),
    'Fn::JoinNow': createFnJoinNow(recurse),
    'Fn::SubNow': createFnSubNow(recurse),
    'Fn::RefNow': createFnRefNow(recurse),
    'Fn::ApplyTags': createFnApplyTags(recurse),
  };

  return { handlers, fnInclude: includeModule.fnInclude };
}
