import { describe, it, expect } from 'vitest';
import {
  computeStats,
  checkThresholds,
  formatStatsReport,
  CFN_LIMITS,
  CFN_RESOURCE_LIMIT,
  CFN_OUTPUT_LIMIT,
  CFN_TEMPLATE_BYTES_LIMIT,
  WARNING_THRESHOLD,
} from '../dist/lib/stats.js';

describe('stats', () => {
  describe('computeStats', () => {
    it('counts resources, outputs, and template size', () => {
      const template = {
        Resources: {
          Bucket: { Type: 'AWS::S3::Bucket' },
          Lambda: { Type: 'AWS::Lambda::Function' },
        },
        Outputs: {
          BucketArn: { Value: 'arn' },
        },
      };
      const stats = computeStats(template);
      expect(stats.resourceCount).toBe(2);
      expect(stats.outputCount).toBe(1);
      expect(stats.resourcePercent).toBeCloseTo((2 / CFN_RESOURCE_LIMIT) * 100, 1);
      expect(stats.outputPercent).toBeCloseTo((1 / CFN_OUTPUT_LIMIT) * 100, 1);
      expect(stats.templateBytes).toBeGreaterThan(0);
      expect(stats.resourceTypes).toEqual({
        'AWS::S3::Bucket': 1,
        'AWS::Lambda::Function': 1,
      });
    });

    it('handles empty template', () => {
      const stats = computeStats({});
      expect(stats.resourceCount).toBe(0);
      expect(stats.outputCount).toBe(0);
      expect(stats.templateBytes).toBeGreaterThan(0);
    });

    it('counts duplicate resource types', () => {
      const template = {
        Resources: {
          A: { Type: 'AWS::S3::Bucket' },
          B: { Type: 'AWS::S3::Bucket' },
          C: { Type: 'AWS::Lambda::Function' },
        },
      };
      const stats = computeStats(template);
      expect(stats.resourceTypes['AWS::S3::Bucket']).toBe(2);
      expect(stats.resourceTypes['AWS::Lambda::Function']).toBe(1);
    });

    it('uses pre-serialized string for size calculation', () => {
      const template = { Resources: {} };
      const serialized = JSON.stringify(template);
      const stats = computeStats(template, serialized);
      expect(stats.templateBytes).toBe(Buffer.byteLength(serialized, 'utf8'));
    });

    it('reports correct limits from constants', () => {
      const stats = computeStats({});
      expect(stats.resourceLimit).toBe(CFN_RESOURCE_LIMIT);
      expect(stats.outputLimit).toBe(CFN_OUTPUT_LIMIT);
      expect(stats.templateLimit).toBe(CFN_TEMPLATE_BYTES_LIMIT);
    });
  });

  describe('CFN_LIMITS', () => {
    it('aggregates individual limit constants', () => {
      expect(CFN_LIMITS.resources).toBe(CFN_RESOURCE_LIMIT);
      expect(CFN_LIMITS.outputs).toBe(CFN_OUTPUT_LIMIT);
      expect(CFN_LIMITS.templateBytes).toBe(CFN_TEMPLATE_BYTES_LIMIT);
    });
  });

  describe('checkThresholds', () => {
    const thresholdCount = (limit: number) => Math.ceil(limit * WARNING_THRESHOLD);

    it('returns no warnings when under threshold', () => {
      const underThreshold = thresholdCount(CFN_RESOURCE_LIMIT) - 1;
      const stats = computeStats({
        Resources: Object.fromEntries(
          Array.from({ length: underThreshold }, (_, i) => [`R${i}`, { Type: 'AWS::S3::Bucket' }]),
        ),
      });
      expect(checkThresholds(stats)).toEqual([]);
    });

    it('warns when resources >= threshold', () => {
      const atThreshold = thresholdCount(CFN_RESOURCE_LIMIT);
      const resources = Object.fromEntries(
        Array.from({ length: atThreshold }, (_, i) => [`R${i}`, { Type: 'AWS::S3::Bucket' }]),
      );
      const stats = computeStats({ Resources: resources });
      const warnings = checkThresholds(stats);
      expect(warnings.length).toBeGreaterThanOrEqual(1);
      expect(warnings.some((w) => w.message.includes('Resource count'))).toBe(true);
    });

    it('warns when outputs >= threshold', () => {
      const atThreshold = thresholdCount(CFN_OUTPUT_LIMIT);
      const outputs = Object.fromEntries(
        Array.from({ length: atThreshold }, (_, i) => [`O${i}`, { Value: `v${i}` }]),
      );
      const stats = computeStats({ Outputs: outputs });
      const warnings = checkThresholds(stats);
      expect(warnings.some((w) => w.message.includes('Output count'))).toBe(true);
    });

    it('warns when template size >= threshold', () => {
      const stats = computeStats({});
      stats.templatePercent = WARNING_THRESHOLD * 100 + 5;
      stats.templateBytes = Math.ceil(CFN_TEMPLATE_BYTES_LIMIT * (WARNING_THRESHOLD + 0.05));
      const warnings = checkThresholds(stats);
      expect(warnings.some((w) => w.message.includes('Template size'))).toBe(true);
    });
  });

  describe('formatStatsReport', () => {
    it('produces readable output', () => {
      const stats = computeStats({
        Resources: {
          A: { Type: 'AWS::S3::Bucket' },
        },
        Outputs: {
          O: { Value: 'v' },
        },
      });
      const report = formatStatsReport(stats);
      expect(report).toContain('CloudFormation Template Statistics');
      expect(report).toContain(`Resources: 1/${CFN_RESOURCE_LIMIT}`);
      expect(report).toContain(`Outputs:   1/${CFN_OUTPUT_LIMIT}`);
      expect(report).toContain('AWS::S3::Bucket: 1');
    });
  });
});
