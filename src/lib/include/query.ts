import _ from 'lodash';
import jmespath from 'jmespath';

type QueryParser = (obj: unknown, path: string) => unknown;

// This exists cause in most cases lodash get is plenty sufficient
// Also this bug/error in jmespath is ridiculous https://github.com/jmespath/jmespath.js/issues/35
const queryParsers: Record<string, QueryParser> = {
  lodash: (obj: unknown, path: string) => _.get(obj, path) || '',
  jmespath: jmespath.search,
  default: jmespath.search,
};

queryParsers['default'] = queryParsers[process.env.CFN_INCLUDE_QUERY_PARSER || ''] || queryParsers.default;

export function getParser(type?: string): QueryParser {
  return queryParsers[type || ''] || queryParsers.default;
}
