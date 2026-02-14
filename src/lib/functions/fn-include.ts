import url from 'node:url';
import path from 'node:path';
import _ from 'lodash';
import { glob } from 'glob';

import request from '../request.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { addProxyToClient } from 'aws-sdk-v3-proxy';
import * as yaml from '../yaml.js';
import { getParser } from '../include/query.js';
import parseLocation from '../parselocation.js';
import replaceEnv from '../replaceEnv.js';
import { isOurExplicitFunction } from '../schema.js';
import { cachedReadFile } from '../cache.js';
import { findAndReplace, interpolate, JSONifyString } from './helpers.js';
import type { RecurseContext, RecurseFn, FnIncludeContext, FnIncludeArgs, TemplateObject, TemplateValue, TemplateDocument, Scope } from './types.js';

const S3 = (opts = {}) => addProxyToClient(new S3Client(opts), { throwOnNoProxy: false });
const s3 = S3();

export function createFnInclude(recurse: RecurseFn) {
  async function fnInclude(ctx: FnIncludeContext): Promise<any> {
    const { base, scope, cft: cftArg, ...opts } = ctx;
    let cft = fnIncludeOpts(cftArg, opts);
    cft = _.defaults(cft, { type: 'json' });

    let procTemplate = async (template: string, inject = cft.inject, doEnv = opts.doEnv) =>
      replaceEnv(template, inject, doEnv) as string;

    const handleInjectSetup = () => {
      if (cft.inject) {
        const origProcTemplate = procTemplate;
        procTemplate = async (template: string) => {
          try {
            const inject = (await recurse({ base, scope, cft: cft.inject!, ...opts })) as Record<string, string>;
            const processed = await origProcTemplate(template, inject, opts.doEnv);
            return replaceEnv(processed, inject, opts.doEnv) as string;
          } catch {
            return '';
          }
        };
      }
    };
    handleInjectSetup();

    if (cft.doLog) {
      console.log({ base, scope, args: cft, ...opts });
    }

    let body: Promise<string> | undefined;
    let absolute: string = '';
    const location = parseLocation(cft.location);

    if (!_.isEmpty(location) && !location.protocol) {
      location.protocol = base.protocol;
    }

    if (location.protocol === 'file') {
      absolute = location.relative
        ? path.join(path.dirname(base.path || ''), location.host || '', location.path || '')
        : [location.host, location.path].join('');

      cft.inject = { CFN_INCLUDE_DIRNAME: path.dirname(absolute), ...cft.inject };
      handleInjectSetup();

      if (isGlob(cft, absolute)) {
        const paths = (await glob(absolute)).sort();
        const template = yaml.load(paths.map((_p) => `- Fn::Include: file://${_p}`).join('\n')) as any;
        return recurse({ base, scope, cft: template, rootTemplate: template as TemplateDocument, ...opts });
      }
      body = cachedReadFile(absolute).then(procTemplate);
      absolute = `${location.protocol}://${absolute}`;
    } else if (location.protocol === 's3') {
      const basedir = path.parse(base.path || '').dir;
      const bucket = location.relative ? base.host : location.host;

      let key = location.relative ? url.resolve(`${basedir}/`, location.raw || '') : location.path;
      key = (key || '').replace(/^\//, '');
      absolute = `${location.protocol}://${[bucket, key].join('/')}`;
      body = s3
        .send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        )
        .then((res) => res.Body?.transformToString() || '')
        .then(procTemplate);
    } else if (location.protocol?.match(/^https?$/)) {
      const basepath = `${path.parse(base.path || '').dir}/`;

      absolute = location.relative
        ? url.resolve(`${location.protocol}://${base.host}${basepath}`, location.raw || '')
        : location.raw || '';

      body = request(absolute).then(procTemplate);
    }

    return handleIncludeBody({ scope, args: cft, body: body!, absolute });
  }

  async function handleIncludeBody(config: {
    scope: Scope;
    args: FnIncludeArgs;
    body: Promise<string>;
    absolute: string;
  }): Promise<any> {
    const { scope, args, body, absolute } = config;
    const procTemplate = (temp: string) => replaceEnv(temp, args.inject, args.doEnv) as string;

    try {
      switch (args.type) {
        case 'json': {
          let b = await body;
          b = procTemplate(b);
          const rootTemplate = yaml.load(b) as TemplateDocument;
          const caller = 'handleIncludeBody:json';

          const loopTemplate = (temp: TemplateValue): Promise<any> => {
            return recurse({
              base: parseLocation(absolute),
              scope,
              cft: temp,
              caller,
              rootTemplate,
              doEnv: args.doEnv,
              doEval: args.doEval,
              doLog: args.doLog,
              inject: args.inject,
              refNowIgnores: args.refNowIgnores,
              refNowIgnoreMissing: args.refNowIgnoreMissing,
            }).then((_temp) => {
              if (!_temp || !Object.keys(_temp as object).length) {
                return _temp;
              }
              if (isOurExplicitFunction(Object.keys(_temp as object)[0])) {
                return loopTemplate(_temp);
              }
              return _temp;
            });
          };

          return loopTemplate(rootTemplate as TemplateValue).then(async (temp) => {
            if (!args.query) {
              return temp;
            }
            const query =
              typeof args.query === 'string'
                ? (replaceEnv(args.query, args.inject, args.doEnv) as string)
                : await recurse({
                    base: parseLocation(absolute),
                    scope,
                    cft: args.query,
                    caller,
                    rootTemplate,
                    doEnv: args.doEnv,
                    doLog: args.doLog,
                    inject: args.inject,
                    refNowIgnores: args.refNowIgnores,
                    refNowIgnoreMissing: args.refNowIgnoreMissing,
                  });
            return getParser(args.parser)(temp, query as string) as TemplateValue;
          });
        }
        case 'string': {
          const template = await body;
          return procTemplate(template);
        }
        case 'literal': {
          const template = await body;
          const processed = procTemplate(template);
          let lines: any = JSONifyString(processed);
          if (_.isPlainObject(args.context)) {
            lines = interpolate(lines, args.context!);
          }
          return {
            'Fn::Join': ['', lines.flat()],
          };
        }
        default:
          throw new Error(`Unknown template type to process type: ${args.type}.`);
      }
    } catch (e) {
      if ((replaceEnv.IsRegExVar(absolute) && args.ignoreMissingVar) || args.ignoreMissingFile) {
        return '';
      }
      throw e;
    }
  }

  // Handler for Fn::Include in recurse
  async function handleFnIncludeInRecurse(ctx: RecurseContext): Promise<any> {
    const { base, scope, cft, rootTemplate, ...opts } = ctx;
    const obj = cft as TemplateObject;
    const json = await fnInclude({ base, scope, cft: obj['Fn::Include'], ...opts });
    if (!_.isPlainObject(json)) return json;
    delete obj['Fn::Include'];
    _.defaults(obj, json);
    const replaced = findAndReplace(scope, obj) as any;
    return recurse({ base, scope, cft: replaced, rootTemplate, caller: 'Fn::Include', ...opts });
  }

  return { fnInclude, handleFnIncludeInRecurse };
}

function fnIncludeOptsFromArray(cft: unknown[], opts: Record<string, unknown>): FnIncludeArgs {
  const [location, query, parser = 'lodash'] = cft as [string, string?, string?];
  return { location, query, parser, ...opts };
}

function fnIncludeOpts(cft: unknown, opts: Record<string, unknown>): FnIncludeArgs {
  if (_.isPlainObject(cft)) {
    return _.merge(cft as object, _.cloneDeep(opts)) as FnIncludeArgs;
  } else if (Array.isArray(cft)) {
    return fnIncludeOptsFromArray(cft, opts);
  } else {
    const splits = (cft as string).split('|');
    if (splits.length > 1) {
      return fnIncludeOptsFromArray(splits, opts);
    }
    return { location: cft as string, ...opts };
  }
}

function isGlob(args: FnIncludeArgs, str: string): boolean {
  return args.isGlob || /.*\*/.test(str);
}
