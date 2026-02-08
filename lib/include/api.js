// NOTE: This module uses the legacy AWS SDK v2 via aws-sdk-proxy
// It may be unused and could be removed or rewritten for SDK v3
import AWS from 'aws-sdk-proxy';
import jmespath from 'jmespath';

export default function (args) {
  const service = new AWS[args.service](args.region ? { region: args.region } : null);
  return service[args.action](args.parameters ? args.parameters : {})
    .promise()
    .then(function (res) {
      return args.query ? jmespath.search(res, args.query) : res;
    });
}
