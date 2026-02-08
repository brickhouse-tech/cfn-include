const url = require('url');
const path = require('path');
const _ = require('lodash');
const { glob } = require('glob');
const Promise = require('bluebird');
const sortObject = require('@znemz/sort-object');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { addProxyToClient } = require('aws-sdk-v3-proxy');

const pathParse = require('path-parse');
const deepMerge = require('deepmerge');
const { isTaggableResource } = require('@znemz/cft-utils/src/resources/taggable');

const request = require('./lib/request');
const PromiseExt = require('./lib/promise');

const S3 = (opts = {}) => addProxyToClient(new S3Client(opts), { throwOnNoProxy: false });

const s3 = S3();
const yaml = require('./lib/yaml');
const { getParser } = require('./lib/include/query');
const parseLocation = require('./lib/parselocation');
const replaceEnv = require('./lib/replaceEnv');

const { lowerCamelCase, upperCamelCase } = require('./lib/utils');
const { isOurExplicitFunction } = require('./lib/schema');
const { getAwsPseudoParameters, buildResourceArn } = require('./lib/internals');
const { createChildScope } = require('./lib/scope');
const { cachedReadFile } = require('./lib/cache');

/**
 * @param  {object} options
 * @param  {object} [options.template] JSON|Yaml Object Document
 *  optional and can be derived from url
 * @param  {string} [options.url] '(file|s3):///SOME_FILE_PATH.(json|yaml)'
 * @param  {boolean} options.doEnv inject environment from process.env as well
 * @param  {boolean} options.doEval allow Fn::Eval to be used (js eval)
 * @param  {Object.<string, string>} [options.inject] object to
 *      inject { KEY: Value } from where ${KEY}
 *  is substituted with Value
 * @param  {boolean} [options.doLog] log all arguments at the include recurse level
 * @param  {Array<string>} [options.refNowIgnores] array of logical resource IDs to ignore when resolving Fn::RefNow references
 * @param  {boolean} [options.refNowIgnoreMissing] if true, return Ref syntax for unresolvable references; if false, throw error
 * @param  {object} [options.rootTemplate] the root template object for resource lookups in Fn::RefNow
 *
 * Example: Load off off file system
 * include({
 *     template: yaml.load(template),
 *     url: `file://${location}`,
 *     doEnv: opts.enable === 'env',
 *     inject: opts.inject,
 *     doLog: opts.doLog,
 *     doEval: opts.doEval, -- allow Fn::Eval to be used
 *   })
 */
module.exports = async function (options) {
  let { template } = options;
  options.doEnv = getBoolEnvOpt(options.doEnv, 'CFN_INCLUDE_DO_ENV');
  options.doEval = getBoolEnvOpt(options.doEval, 'CFN_INCLUDE_DO_EVAL');

  const base = parseLocation(options.url);
  const scope = options.scope || {};
  if (base.relative) throw new Error('url cannot be relative');
  template = !template
    ? fnInclude({ base, scope, cft: options.url, ...options })
    : template;
  // Resolve template if it's a promise to extract the root template for reference lookups
  const resolvedTemplate = await Promise.resolve(template);
  return recurse({
    base, scope,
    cft: resolvedTemplate,
    rootTemplate: resolvedTemplate,
    ...options,
  });
};

/**
 * @param  {object} base file options
 * @param  {string} base.protocol 'file' | 's3
 * @param  {string} [base.host] url to download file from
 * @param  {string} base.path 'SOME_FILE_PATH.(json|yaml)',
 * @param  {boolean} [base.relative] is the file path relative?
 * @param  {string} [base.raw] '(file|s3):///SOME_FILE_PATH.(json|yaml)'
 * @param  {object} [scope] initally {} and optional eventually defined
 *     derrived in Fn::Map for template find and replace
 * IE:
 * TEMPLATE:
 *  {
 * "Fn::Map": [
 *   [1, 2], {
 *     "Value": "_"
 *   }
 * ]
 *}
 * yields:
 * { scope: { _: 1 } }
 * @param  {Document|String|Promise<DocumentString>} cft
 *    Document object is recursed at every Field level and eventually reduced to a string
 * @param  {Object} opts
 * @param  {boolean} opts.doEnv inject environment from process.env as well
 * @param  {Object} opts.inject object to inject { KEY: Value } from where ${KEY}
 *  is subtituted with Value
 * @param  {boolean} opts.doLog log all arguments at the include recurse level
 * @param  {Array<string>} [opts.refNowIgnores] array of logical resource IDs to ignore when resolving Fn::RefNow references
 * @param  {boolean} [opts.refNowIgnoreMissing] if true, return Ref syntax for unresolvable references; if false, throw error
 * @param  {object} [rootTemplate] the root template object for resource lookups in Fn::RefNow
 * @param {String} [caller] internal use only for logging, to aid in who called recurse Fn::Include, Fn::RefNow, etc..
 */
async function recurse({ base, scope, cft, rootTemplate, caller, ...opts }) {
  if (opts.doLog) {
    console.log({ base, scope, cft, rootTemplate, caller, ...opts });
  }
  // NOTE: We don't clone/create child scope here anymore.
  // With prototype-chain scopes, Fn::Map creates children only when adding variables.
  // This avoids unnecessary intermediate scopes that break prototype lookups.
  if (Array.isArray(cft)) {
    return Promise.all(cft.map((o) => recurse({ base, scope, cft: o, rootTemplate, caller: 'recurse:isArray', ...opts })));
  }
  if (_.isPlainObject(cft)) {
    if (cft['Fn::Map']) {
      const args = cft['Fn::Map'];
      const [list] = args;
      const body = args[args.length - 1];
      let placeholder = args[1],
        idx,
        sz,
        hasindex = false,
        hassize = false;
      if (Array.isArray(placeholder)) {
        // multiple placeholders
        idx = placeholder[1];
        hasindex = true;
        if (placeholder.length > 2) {
          sz = placeholder[2];
          hassize = true;
        }
        placeholder = placeholder[0];
      }
      if (args.length === 2) {
        placeholder = '_';
      }
      return PromiseExt.mapX(recurse({ base, scope, cft: list, rootTemplate, caller: 'Fn::Map', ...opts }), (replace, key) => {
        // Use Object.create() for O(1) child scope creation instead of O(n) clone
        const additions = { [placeholder]: replace };
        if (hasindex) {
          additions[idx] = key;
        }
        const childScope = createChildScope(scope, additions);
        const replaced = findAndReplace(childScope, _.cloneDeep(body));
        return recurse({ base, scope: childScope, cft: replaced, rootTemplate, caller: 'Fn::Map', ...opts });
      }).then((_cft) => {
        if (hassize) {
          _cft = findAndReplace({ [sz]: _cft.length }, _cft);
        }
        return recurse({ base, scope, cft: _cft, rootTemplate, caller: 'Fn::Map', ...opts });
      });
    }
    if (cft['Fn::Length']) {
      if (Array.isArray(cft['Fn::Length'])) {
        return cft['Fn::Length'].length;
      }
      return recurse({ base, scope, cft: cft['Fn::Length'], rootTemplate, caller: 'Fn::Length', ...opts }).then((x) => {
        if (Array.isArray(x)) {
          return x.length;
        }
        return 0;
      });
    }
    if (cft['Fn::Include']) {
      return fnInclude({ base, scope, cft: cft['Fn::Include'], ...opts })
        .then(function (json) {
          if (!_.isPlainObject(json)) return json;
          delete cft['Fn::Include'];
          _.defaults(cft, json);
          return cft;
        })
        .then((_cft) => findAndReplace(scope, _cft))
        .then((t) => recurse({ base, scope, cft: t, rootTemplate, caller: 'Fn::Include', ...opts }));
    }
    if (cft['Fn::Flatten']) {
      return recurse({ base, scope, cft: cft['Fn::Flatten'], rootTemplate, caller: 'Fn::Flatten', ...opts }).then(function (json) {
        return json.flat();
      });
    }
    if (cft['Fn::FlattenDeep']) {
      return recurse({ base, scope, cft: cft['Fn::FlattenDeep'], rootTemplate, caller: 'Fn::FlattenDeep', ...opts }).then(
        function (json) {
          return json.flat(Infinity);
        },
      );
    }
    if (cft['Fn::Uniq']) {
      return recurse({ base, scope, cft: cft['Fn::Uniq'], rootTemplate, caller: 'Fn::Uniq', ...opts }).then(function (json) {
        return [...new Set(json)];
      });
    }
    if (cft['Fn::Compact']) {
      return recurse({ base, scope, cft: cft['Fn::Compact'], rootTemplate, caller: 'Fn::Compact', ...opts }).then(function (json) {
        return json.filter(Boolean);
      });
    }
    if (cft['Fn::Concat']) {
      return recurse({ base, scope, cft: cft['Fn::Concat'], rootTemplate, caller: 'Fn::Concat', ...opts }).then(function (json) {
        return _.concat(...json);
      });
    }
    if (cft['Fn::Sort']) {
      return recurse({ base, scope, cft: cft['Fn::Sort'], rootTemplate, caller: 'Fn::Sort', ...opts }).then(function (array) {
        return array.sort();
      });
    }
    if (cft['Fn::SortedUniq']) {
      return recurse({ base, scope, cft: cft['Fn::SortedUniq'], rootTemplate, caller: 'Fn::SortedUniq', ...opts }).then(
        function (array) {
          return _.sortedUniq(array.sort());
        },
      );
    }
    if (cft['Fn::SortBy']) {
      return recurse({ base, scope, cft: cft['Fn::SortBy'], rootTemplate, caller: 'Fn::SortBy', ...opts }).then(function ({
        list,
        iteratees,
      }) {
        return _.sortBy(list, iteratees);
      });
    }
    if (cft['Fn::SortObject']) {
      return recurse({ base, scope, cft: cft['Fn::SortObject'], rootTemplate, caller: 'Fn::SortObject', ...opts }).then(function ({

        object,
        options,
        ...rest // allow object to be optional (implied)
      }) {
        return sortObject(object || rest, options);
      });
    }
    if (cft['Fn::Without']) {
      return recurse({ base, scope, cft: cft['Fn::Without'], rootTemplate, caller: 'Fn::Without', ...opts }).then(function (json) {
        json = Array.isArray(json) ? { list: json[0], withouts: json[1] } : json;
        return _.without(json.list, ...json.withouts);
      });
    }
    if (cft['Fn::Omit']) {
      return recurse({ base, scope, cft: cft['Fn::Omit'], rootTemplate, caller: 'Fn::Omit', ...opts }).then(function (json) {
        json = Array.isArray(json) ? { object: json[0], omits: json[1] } : json;
        return _.omit(json.object, json.omits);
      });
    }
    if (cft['Fn::OmitEmpty']) {
      return recurse({ base, scope, cft: cft['Fn::OmitEmpty'], rootTemplate, caller: 'Fn::OmitEmpty', ...opts }).then(
        function (json) {
          // omit falsy values except false, and 0
          return _.omitBy(json, (v) => !v && v !== false && v !== 0);
        },
      );
    }
    if (cft['Fn::Eval']) {
      if (!opts.doEval) {
        return Promise.reject(new Error('Fn::Eval is not allowed doEval is falsy'));
      }
      return recurse({ base, scope, cft: cft['Fn::Eval'], rootTemplate, caller: 'Fn::Eval', ...opts }).then(function (json) {
        // **WARNING** you have now enabled god mode

        let { state, script, inject, doLog } = json;
        script = replaceEnv(script, _.merge(_.cloneDeep(opts.inject), inject), opts.doEnv);
        if (doLog) {

          console.log({ state, script, inject });
        }

        return eval(script);
      });
    }
    if (cft['Fn::Filenames']) {
      return recurse({ base, scope, cft: cft['Fn::Filenames'], rootTemplate, caller: 'Fn::Filenames', ...opts }).then(
        async function (json) {
          json = _.isPlainObject(json) ? { ...json } : { location: json };
          if (json.doLog) {

            console.log(json);
          }
          const location = parseLocation(json.location);

          if (!_.isEmpty(location) && !location.protocol) {
            location.protocol = base.protocol;
          }
          if (location.protocol === 'file') {
            const absolute = location.relative
              ? path.join(path.dirname(base.path), location.host, location.path || '')
              : [location.host, location.path].join('');
            const globs = (await glob(absolute)).sort();
            if (json.omitExtension) {
              return globs.map((f) => path.basename(f, path.extname(f)));
            }
            return globs;
          }
          return 'Unsupported File Type';
        },
      );
    }
    if (cft['Fn::Merge']) {
      return recurse({ base, scope, cft: cft['Fn::Merge'], rootTemplate, caller: 'Fn::Merge', ...opts }).then(function (json) {
        delete cft['Fn::Merge'];

        return recurse({ base, scope, cft: _.defaults(cft, _.merge.apply(_, json)), rootTemplate, caller: 'Fn::Merge', ...opts });
      });
    }
    if (cft['Fn::DeepMerge']) {
      return recurse({ base, scope, cft: cft['Fn::DeepMerge'], rootTemplate, caller: 'Fn::DeepMerge', ...opts }).then(
        function (json) {
          delete cft['Fn::DeepMerge'];
          let mergedObj = {};
          if (json && json.length) {
            json.forEach((j) => {
              mergedObj = deepMerge(mergedObj, j);
            });
          }
          return recurse({ base, scope, cft: _.defaults(cft, mergedObj), rootTemplate, caller: 'Fn::DeepMerge', ...opts });
        },
      );
    }
    if (cft['Fn::ObjectKeys']) {
      return recurse({ base, scope, cft: cft['Fn::ObjectKeys'], rootTemplate, caller: 'Fn::ObjectKeys', ...opts }).then((json) =>
        Object.keys(json),
      );
    }
    if (cft['Fn::ObjectValues']) {
      return recurse({ base, scope, cft: cft['Fn::ObjectValues'], rootTemplate, caller: 'Fn::ObjectValues', ...opts }).then((json) =>
        Object.values(json),
      );
    }
    if (cft['Fn::Stringify']) {
      return recurse({ base, scope, cft: cft['Fn::Stringify'], rootTemplate, caller: 'Fn::Stringify', ...opts }).then(
        function (json) {
          return JSON.stringify(json);
        },
      );
    }
    if (cft['Fn::StringSplit']) {
      return recurse({ base, scope, cft: cft['Fn::StringSplit'], rootTemplate, caller: 'Fn::StringSplit', ...opts }).then(
        ({ string, separator, doLog }) => {
          if (!string) {
            string = '';
          }

          if (doLog) console.log({ string, separator });
          if (!separator) {
            separator = ',';
          }
          return string.split(separator);
        },
      );
    }
    if (cft['Fn::UpperCamelCase']) {
      return upperCamelCase(cft['Fn::UpperCamelCase']);
    }
    if (cft['Fn::LowerCamelCase']) {
      return lowerCamelCase(cft['Fn::LowerCamelCase']);
    }

    if (cft['Fn::GetEnv']) {
      const args = cft['Fn::GetEnv'];
      if (Array.isArray(args)) {
        const val = process.env[args[0]];
        return val === undefined ? args[1] : val;
      }
      const val = process.env[args];
      if (val === undefined) {
        throw new Error(`environmental variable ${args} is undefined`);
      }
      return val;
    }

    if (cft['Fn::Outputs']) {
      const outputs = await recurse({ base, scope, cft: cft['Fn::Outputs'], caller: 'Fn::Outputs', ...opts });
      const result = {};

      for (const output in outputs) {
        const val = outputs[output];
        const exp = {
          Export: { Name: { 'Fn::Sub': '${AWS::StackName}:' + output } },
        };
        if (!Array.isArray(val) && typeof val === 'object') {
          result[output] = {
            Value: { 'Fn::Sub': val.Value },
            Condition: val.Condition,
            ...exp,
          };
        } else {
          result[output] = {
            Value: { 'Fn::Sub': val },
            ...exp,
          };
        }
      }
      return result;
    }

    if (cft['Fn::Sequence']) {
      const outputs = await recurse({ base, scope, cft: cft['Fn::Sequence'], caller: 'Fn::Sequence', ...opts });

      let [start, stop, step = 1] = outputs;
      const isString = typeof start === 'string';
      if (isString) {
        start = start.charCodeAt(0);
        stop = stop.charCodeAt(0);
      }
      const seq = Array.from(
        { length: Math.floor((stop - start) / step) + 1 },
        (__, i) => start + i * step,
      );
      return isString ? seq.map((i) => String.fromCharCode(i)) : seq;
    }

    if (cft['Fn::IfEval']) {
      if (!opts.doEval) {
        return Promise.reject(new Error('Fn::IfEval is not allowed doEval is falsy'));
      }
      return recurse({ base, scope, cft: cft['Fn::IfEval'], rootTemplate, caller: 'Fn::IfEval', ...opts }).then(function (json) {

        let { truthy, falsy, evalCond, inject, doLog } = json;
        if (!evalCond) {
          return Promise.reject(new Error('Fn::IfEval evalCond is required'));
        }
        evalCond = `(${evalCond})`;
        if (!falsy) {
          falsy = '';
        }
        if (!truthy) {
          truthy = '';
        }

        evalCond = replaceEnv(evalCond, _.merge(_.cloneDeep(opts.inject), inject), opts.doEnv);
        truthy = replaceEnv(truthy, _.merge(_.cloneDeep(opts.inject), inject), opts.doEnv);
        if (falsy) {
          falsy = replaceEnv(falsy, _.merge(_.cloneDeep(opts.inject), inject), opts.doEnv);
        }


        const condResult = eval(evalCond);

        if (doLog) {

          console.log({ truthy, falsy, inject, evalCond, condResult });
        }

        if (condResult) {
          return recurse({ base, scope, cft: truthy, rootTemplate, caller: 'Fn::IfEval', ...opts });
        }
        return recurse({ base, scope, cft: falsy, rootTemplate, caller: 'Fn::IfEval', ...opts });
      });
    }
    if (cft['Fn::JoinNow']) {
      return recurse({ base, scope, cft: cft['Fn::JoinNow'], rootTemplate, caller: 'Fn::JoinNow', ...opts }).then((array) => {
        // keeps with same format as Fn::Join ~ more complex
        // vs let [delimitter, ...toJoinArray] = array;
        let [delimitter, toJoinArray] = array;
        delimitter = replaceEnv(delimitter, opts.inject, opts.doEnv);
        return toJoinArray.join(delimitter);
      });
    }
    if (cft['Fn::SubNow']) {
      return recurse({ base, scope, cft: cft['Fn::SubNow'], rootTemplate, caller: 'Fn::SubNow', ...opts }).then((input) => {
        let template = input;
        let variables = {};

        // Handle both string and [string, variables] formats
        if (Array.isArray(input)) {
          [template, variables] = input;
        }

        // Merge variables with inject and AWS pseudo-parameters
        const allVariables = {
          ...getAwsPseudoParameters(),
          ...opts.inject,
          ...variables,
        };

        // Perform substitution for ${VarName} pattern
        let result = template.toString();
        _.forEach(allVariables, (value, key) => {
          const regex = new RegExp(`\\$\\{${_.escapeRegExp(key)}\\}`, 'g');
          result = result.replace(regex, String(value));
        });

        return result;
      });
    }
    if (cft['Fn::RefNow']) {
      // console.log("outter");
      // console.log(opts);
      // Handle both simple string and object format for Fn::RefNow
      // e.g., Fn::RefNow: "MyRole" or Fn::RefNow: { Ref: "MyRole" }
      return recurse({ base, scope, cft: cft['Fn::RefNow'], rootTemplate, caller: 'Fn::RefNow', ...opts }).then((refInput) => {
        // console.log("inner");
        // console.log(opts);
        let refName = refInput;
        let refOptions = {};

        // Parse the input - could be string or object
        if (_.isPlainObject(refInput)) {
          refName = refInput.Ref || refInput.ref;
          refOptions = _.omit(refInput, ['Ref', 'ref']);
        }

        // Check if this ref name is in the ignores list
        if (opts.refNowIgnores && opts.refNowIgnores.includes(refName)) {
          return { Ref: refName };
        }

        // Merge AWS pseudo-parameters with inject and scope variables
        const allRefs = {
          ...getAwsPseudoParameters(),
          ...process.env,
          ...opts.inject,
          ...scope,
        };

        // Try to resolve the reference
        if (refName in allRefs) {
          return allRefs[refName];
        }

        // Check if this is a LogicalResourceId in the Resources section
        if (rootTemplate && rootTemplate.Resources) {
          const resources = rootTemplate.Resources;
          if (refName in resources) {
            const resource = resources[refName];
            const resourceType = resource.Type;
            const properties = resource.Properties || {};

            // Determine return type based on key name
            // If the key ends with "Name" (e.g., RoleName, BucketName), return name/identifier
            // Otherwise return ARN (default)
            let returnType = 'arn';
            if (opts.key && opts.key.endsWith('Name')) {
              returnType = 'name';
            }

            // Try to build an ARN or name for this resource
            // Merge ref options with global options (ref options take precedence)
            const resourceOptions = {
              returnType,
              ...opts.refNowReturnType ? { returnType: opts.refNowReturnType } : {},
              ...refOptions,
            };
            const result = buildResourceArn(resourceType, properties, allRefs, resourceOptions);
            if (result) {
              return result;
            }
          }
        }

        // If not found and refNowIgnoreMissing is true, return Ref syntax; otherwise throw error
        if (opts.refNowIgnoreMissing) {
          return { Ref: refName };
        }

        // Default behavior: throw an error (backward compatible)
        throw new Error(`Unable to resolve Ref for logical name: ${refName}`);
      });
    }
    if (cft['Fn::ApplyTags']) {
      return recurse({ base, scope, cft: cft['Fn::ApplyTags'], rootTemplate, caller: 'Fn::ApplyTags', ...opts }).then((json) => {
        let { tags, Tags, resources } = json;
        tags = tags || Tags; // allow for both caseing
        const promises = [];
        _.each(resources, (val, id) => {
          promises.push(
            isTaggableResource(val.Type).then((isTaggable) => {
              if (isTaggable) {
                resources[id] = deepMerge(
                  {
                    Properties: {
                      Tags: tags,
                    },
                  },
                  val,
                );
              }
              return resources[id];
            }),
          );
        });
        return Promise.all(promises).then(() => resources);
      });
    }

    return Promise.props(
      _.mapValues(cft, (template, key) => recurse({ base, scope, cft: template, key, rootTemplate, caller: 'recurse:isPlainObject:end', ...opts })),
    );
  }

  if (cft === undefined) {
    return null;
  }
  return replaceEnv(cft, opts.inject, opts.doEnv);
}

function findAndReplace(scope, object) {
  if (typeof object === 'string') {
    // Use for...in to walk prototype chain (Object.create() based scopes)
    for (const find in scope) {
      if (object === find) {
        object = scope[find];
      }
    }
  }
  if (typeof object === 'string') {
    // Use for...in to walk prototype chain (Object.create() based scopes)
    for (const find in scope) {
      const replace = scope[find];
      const regex = new RegExp(`\\\${${find}}`, 'g');
      if (find !== '_' && object.match(regex)) {
        object = object.replace(regex, replace);
      }
    }
  }
  if (Array.isArray(object)) {
    object = object.map(_.bind(findAndReplace, this, scope));
  } else if (_.isPlainObject(object)) {
    object = _.mapKeys(object, function (value, key) {
      return findAndReplace(scope, key);
    });
    Object.keys(object).forEach(function (key) {
      if (key === 'Fn::Map') return;
      object[key] = findAndReplace(scope, object[key]);
    });
  }
  return object;
}

function interpolate(lines, context) {
  return lines.map(function (line) {
    const parts = [];
    line
      .split(/({{\w+?}})/g)
      .map(function (_line) {
        const match = _line.match(/^{{(\w+)}}$/);
        const value = match ? context[match[1]] : undefined;
        if (!match) return _line;
        if (value === undefined) {
          return '';
        }
        return value;
      })
      .forEach(function (part) {
        const last = parts[parts.length - 1];
        if (_.isPlainObject(part) || _.isPlainObject(last) || !parts.length) {
          parts.push(part);
        } else if (parts.length) {
          parts[parts.length - 1] = last + part;
        }
      });
    return parts.filter(function (part) {
      return part !== '';
    });
  });
}

function fnIncludeOptsFromArray(cft, opts) {
  // Array 1, location, Array 2 Query, Array 3 Optional Parser (default lodash)
  const [location, query, parser = 'lodash'] = cft;
  cft = { location, query, parser, ...opts };
  return cft;
}

function fnIncludeOpts(cft, opts) {
  if (_.isPlainObject(cft)) {
    cft = _.merge(cft, _.cloneDeep(opts));
  } else if (Array.isArray(cft)) {
    cft = fnIncludeOptsFromArray(cft, opts);
  } else {
    // should be string{
    const splits = cft.split('|');
    if (splits.length > 1) {
      cft = fnIncludeOptsFromArray(splits, opts);
    } else {
      cft = { location: cft, ...opts };
    }
  }

  cft = _.defaults(cft, { type: 'json' });
  return cft;
}

/**
 * Process includes for template documents
 * @param  {object} base file options (protocol, host, path, relative, raw)
 * @param  {object} scope variable scope for Fn::Map substitutions
 * @param  {Document|String|Array} cft include specification (location, query, parser, type, etc.)
 * @param  {Object} opts processing options
 * @param  {boolean} [opts.doEnv] inject environment from process.env
 * @param  {boolean} [opts.doEval] allow Fn::Eval to be used
 * @param  {Object} [opts.inject] object to inject { KEY: Value }
 * @param  {boolean} [opts.doLog] log all arguments at the include recurse level
 * @param  {Array<string>} [opts.refNowIgnores] array of logical resource IDs to ignore when resolving Fn::RefNow references
 * @param  {boolean} [opts.refNowIgnoreMissing] if true, return Ref syntax for unresolvable references; if false, throw error
 * @param  {object} [opts.rootTemplate] the root template object for resource lookups in Fn::RefNow
 * @returns {Promise} resolved include content
 */
async function fnInclude({ base, scope, cft, ...opts }) {
  let procTemplate = async (template, inject = cft.inject, doEnv = opts.doEnv) =>
    replaceEnv(template, inject, doEnv);
  const handleInjectSetup = () => {
    if (cft.inject) {
      const origProcTemplate = procTemplate;
      procTemplate = async (template) => {
        try {
          const inject = await recurse({ base, scope, cft: cft.inject, ...opts });
          const processed = await origProcTemplate(template, inject, opts.doEnv);
          return replaceEnv(processed, inject, opts.doEnv);
        } catch {
          return '';
        }
      };
    }
  };
  handleInjectSetup();
  cft = fnIncludeOpts(cft, opts);

  if (cft.doLog) {
    console.log({ base, scope, args: cft, ...opts });
  }
  // console.log(args)
  let body;
  let absolute;
  const location = parseLocation(cft.location);
  if (!_.isEmpty(location) && !location.protocol) location.protocol = base.protocol;
  if (location.protocol === 'file') {
    absolute = location.relative
      ? path.join(path.dirname(base.path), location.host, location.path || '')
      : [location.host, location.path].join('');

    // allow script to resolve their own, __dirname via ${CFN_INCLUDE_DIRNAME}
    cft.inject = { CFN_INCLUDE_DIRNAME: path.dirname(absolute), ...cft.inject };

    handleInjectSetup();
    if (isGlob(cft, absolute)) {
      const paths = (await glob(absolute)).sort();
      const template = yaml.load(paths.map((_p) => `- Fn::Include: file://${_p}`).join('\n'));
      return recurse({ base, scope, cft: template, rootTemplate: template, ...opts });
    }
    body = cachedReadFile(absolute).then(procTemplate);
    absolute = `${location.protocol}://${absolute}`;
  } else if (location.protocol === 's3') {
    const basedir = pathParse(base.path).dir;
    const bucket = location.relative ? base.host : location.host;

    let key = location.relative ? url.resolve(`${basedir}/`, location.raw) : location.path;
    key = key.replace(/^\//, '');
    absolute = `${location.protocol}://${[bucket, key].join('/')}`;
    body = s3
      .send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      )
      .then((res) => res.Body.toString())
      .then(procTemplate);
  } else if (location.protocol && location.protocol.match(/^https?$/)) {
    const basepath = `${pathParse(base.path).dir}/`;

    absolute = location.relative
      ? url.resolve(`${location.protocol}://${base.host}${basepath}`, location.raw)
      : location.raw;

    body = request(absolute).then(procTemplate);
  }
  return handleIncludeBody({ scope, args: cft, body, absolute });
}

function isGlob(args, str) {
  return args.isGlob || /.*\*/.test(str);
}

/**
 * Process the resolved include body content
 * @param  {object} config configuration object
 * @param  {object} config.scope variable scope for substitutions
 * @param  {Object} config.args include arguments (type, query, parser, inject, doEnv, doEval, doLog, refNowIgnores, refNowIgnoreMissing, rootTemplate)
 * @param  {Promise} config.body promise resolving to the file content
 * @param  {string} config.absolute absolute path/URL to the included resource
 * @param  {string} [config.args.type='json'] type of content to process (json, string, literal)
 * @param  {Object|string|Array} [config.args.query] query to apply to the processed template
 * @param  {string} [config.args.parser='lodash'] parser to use for querying (lodash, jsonpath)
 * @param  {Object} [config.args.context] context object for literal interpolation
 * @param  {Object} [config.args.inject] object to inject { KEY: Value }
 * @param  {boolean} [config.args.doEnv] inject environment from process.env
 * @param  {boolean} [config.args.doEval] allow Fn::Eval to be used
 * @param  {boolean} [config.args.doLog] log all arguments at the include recurse level
 * @param  {Array<string>} [config.args.refNowIgnores] array of logical resource IDs to ignore when resolving Fn::RefNow references
 * @param  {boolean} [config.args.refNowIgnoreMissing] if true, return Ref syntax for unresolvable references; if false, throw error
 * 
 * rootTeamplate is not an argument here cause it's loaded via arg.type
 * @returns {Promise} processed template content
 */
async function handleIncludeBody({ scope, args, body, absolute }) {
  const procTemplate = (temp) => replaceEnv(temp, args.inject, args.doEnv);
  try {
    switch (args.type) {
      case 'json': {
        let b = await body;
        b = procTemplate(b);
        const rootTemplate = yaml.load(b);
        const caller = 'handleIncludeBody:json';
        // recurse all the way down and work your way out
        const loopTemplate = (temp) => {
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
            refNowIgnoreMissing: args.refNowIgnoreMissing, // note we can't use ...args here because of circular ref
          }).then((_temp) => {
            if (!_temp || !Object.keys(_temp).length) {
              return _temp;
            }
            // ONLY RECURSE IF it is one of our funcs.
            if (isOurExplicitFunction(Object.keys(_temp)[0])) {
              return loopTemplate(_temp);
            }
            return _temp;
          });
        };

        return loopTemplate(rootTemplate).then(async (temp) => {
          if (!args.query) {
            return temp;
          }
          // once fully recursed we can query the resultant template
          const query = typeof args.query === 'string'
            ? replaceEnv(args.query, args.inject, args.doEnv)
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
          return getParser(args.parser)(temp, query);
        });
      }
      case 'string': {
        const template = await body;
        return procTemplate(template);
      }
      case 'literal': {
        return body.then(function (template) {
          template = procTemplate(template);
          let lines = JSONifyString(template);
          if (_.isPlainObject(args.context)) {
            lines = interpolate(lines, args.context);
          }
          return {
            'Fn::Join': ['', lines.flat()],
          };
        });
      }
      default:
        throw new Error(`Unknown template type to process type: ${args.type}.`);
    }
  } catch (e) {
    // if the location matches replaceEnv.IsRegExVar then swallow error and retun ''
    if ((replaceEnv.IsRegExVar(absolute) && args.ignoreMissingVar) || args.ignoreMissingFile) {
      return '';
    }
    throw e;
  }
}

function JSONifyString(string) {
  const lines = [];
  const split = string.toString().split(/(\r?\n)/);
  split.forEach(function (line, idx) {
    if (idx % 2) {
      lines[(idx - 1) / 2] = lines[(idx - 1) / 2] + line;
    } else {
      lines.push(line);
    }
  });
  return lines;
}

function getBoolEnvOpt(opt, envKey) {
  return process.env[envKey] ? !!process.env[envKey] : opt;
}
