#!/usr/bin/env node

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import _ from 'lodash';

import include from './index.js';
import * as yaml from './lib/yaml.js';
import Client from './lib/cfnclient.js';
import replaceEnv from './lib/replaceEnv.js';
import { computeStats, checkThresholds, formatStatsReport } from './lib/stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json using fs instead of import assertion
const pkg = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

const { env } = process;

interface CliOptions {
  path?: string;
  minimize: boolean;
  metadata: boolean;
  validate: boolean;
  yaml: boolean;
  lineWidth: number;
  bucket?: string;
  context?: string;
  prefix: string;
  enable: string;
  inject?: Record<string, string>;
  doLog?: boolean;
  stats: boolean;
  'ref-now-ignore-missing'?: boolean;
  'ref-now-ignores'?: string;
}

const { default: yargs } = await import('yargs');
const { hideBin } = await import('yargs/helpers');

const opts = yargs(hideBin(process.argv))
  .version(false)
  .command('$0 [path] [options]', pkg.description, (y: any) =>
    y.positional('path', {
      positional: true,
      desc: 'location of template. Either path to a local file, URL or file on an S3 bucket (e.g. s3://bucket-name/example.template)',
      required: false,
    }),
  )
  .options({
    minimize: {
      desc: 'minimize JSON output',
      default: false,
      boolean: true,
      alias: 'm',
    },
    metadata: {
      desc: 'add build metadata to output',
      default: false,
      boolean: true,
    },
    validate: {
      desc: 'validate compiled template',
      default: false,
      boolean: true,
      alias: 't',
    },
    yaml: {
      desc: 'output yaml instead of json',
      default: false,
      boolean: true,
      alias: 'y',
    },
    lineWidth: {
      desc: 'output yaml line width',
      default: 200,
      number: true,
      alias: 'l',
    },
    bucket: {
      desc: 'bucket name required for templates larger than 50k',
    },
    context: {
      desc: 'template full path. only utilized for stdin when the template is piped to this script',
      required: false,
      string: true,
    },
    prefix: {
      desc: 'prefix for templates uploaded to the bucket',
      default: 'cfn-include',
    },
    enable: {
      string: true,
      desc: `enable different options: ['env','eval'] or a combination of both via comma.`,
      choices: ['', 'env', 'env,eval', 'eval,env', 'eval'],
      default: '',
    },
    inject: {
      alias: 'i',
      string: true,
      desc: `JSON string payload to use for template injection.`,
      coerce: (valStr: string) => JSON.parse(valStr),
    },
    doLog: {
      boolean: true,
      desc: `console log out include options in recurse step`,
    },
    stats: {
      desc: 'report template statistics and CloudFormation limit warnings to stderr',
      default: false,
      boolean: true,
    },
    'ref-now-ignore-missing': {
      boolean: true,
      desc: 'do not fail if Fn::RefNow reference cannot be resolved',
    },
    'ref-now-ignores': {
      string: true,
      desc: 'comma-separated list of reference names to ignore if not found',
    },
    version: {
      boolean: true,
      desc: 'print version and exit',
      callback() {
        console.log(pkg.version);
        process.exit(0);
      },
    },
  })
  .parse() as CliOptions & { enable: string };

// make enable an array
const enableOptions = opts.enable.split(',');

// Parse ref-now-ignores into an array
const refNowIgnores = opts['ref-now-ignores'] ? opts['ref-now-ignores'].split(',').map((s) => s.trim()) : [];

let promise: Promise<any>;
if (opts.path) {
  let location: string;
  const protocol = opts.path.match(/^\w+:\/\//);
  if (protocol) location = opts.path;
  else if (path.parse(opts.path).root) location = `file://${opts.path}`;
  else location = `file://${path.join(process.cwd(), opts.path)}`;
  promise = include({
    url: location,
    doEnv: enableOptions.includes('env'),
    doEval: enableOptions.includes('eval'),
    inject: opts.inject,
    doLog: opts.doLog,
    refNowIgnoreMissing: opts['ref-now-ignore-missing'],
    refNowIgnores: refNowIgnores,
  });
} else {
  promise = new Promise<string>((resolve, reject) => {
    process.stdin.setEncoding('utf8');
    const rawData: string[] = [];
    process.stdin.on('data', (chunk: string) => rawData.push(chunk));
    process.stdin.on('error', (err) => reject(err));
    process.stdin.on('end', () => resolve(rawData.join('')));
  }).then((template) => {
    if (template.length === 0) {
      console.error('empty template received from stdin');
      process.exit(1);
    }

    const location = opts.context ? path.resolve(opts.context) : path.join(process.cwd(), 'template.yml');

    const processedTemplate = enableOptions.includes('env') ? replaceEnv(template) : template;

    return include({
      template: yaml.load(processedTemplate as string) as any,
      url: `file://${location}`,
      doEnv: enableOptions.includes('env'),
      doEval: enableOptions.includes('eval'),
      inject: opts.inject,
      doLog: opts.doLog,
      refNowIgnoreMissing: opts['ref-now-ignore-missing'],
      refNowIgnores: refNowIgnores,
    }).catch((err) => console.error(err));
  });
}

promise
  .then(function (template: any) {
    if (opts.metadata) {
      let stdout: string | undefined;
      try {
        stdout = execSync('git log -n 1 --pretty=%H', {
          stdio: [0, 'pipe', 'ignore'],
        })
          .toString()
          .trim();
      } catch {
        // ignore git errors
      }
      _.defaultsDeep(template, {
        Metadata: {
          CfnInclude: {
            GitCommit: stdout,
            BuildDate: new Date().toISOString(),
          },
        },
      });
    }
    if (opts.validate) {
      const cfn = new Client({
        region: env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-1',
        bucket: opts.bucket,
        prefix: opts.prefix,
      });
      return cfn.validateTemplate(JSON.stringify(template)).then(() => template);
    }
    return template;
  })
  .then((template: any) => {
    // Template stats and warnings
    if (opts.stats) {
      const serialized = JSON.stringify(template);
      const stats = computeStats(template, serialized);
      console.error(formatStatsReport(stats));
      const warnings = checkThresholds(stats);
      if (warnings.length > 0) {
        console.error('');
        console.error('⚠️  Warnings:');
        for (const w of warnings) {
          console.error(`  - ${w.message}`);
        }
      }
      console.error('');
    }

    console.log(opts.yaml ? yaml.dump(template, { lineWidth: opts.lineWidth }) : JSON.stringify(template, null, opts.minimize ? null : 2));
  })
  .catch(function (err: any) {
    if (typeof err?.toString === 'function') console.error(err.toString());
    else console.error(err);
    if (err?.stack) console.log(err.stack);
    process.exit(1);
  });
