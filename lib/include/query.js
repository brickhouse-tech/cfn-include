import _ from 'lodash';
import jmespath from 'jmespath';

// this exists cause in most cases lodash get is plenty sufficient
// also this bug / error in jmespath is ridiculous https://github.com/jmespath/jmespath.js/issues/35
const queryParsers = {
  lodash: (obj, path) => _.get(obj, path) || '',
  jmespath: jmespath.search,
  default: jmespath.search,
};

queryParsers['default'] = queryParsers[process.env.CFN_INCLUDE_QUERY_PARSER] || queryParsers.default;

export function getParser(type) {
  return queryParsers[type] || queryParsers.default;
}
