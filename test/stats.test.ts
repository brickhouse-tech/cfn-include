import { describe, it, expect } from 'vitest';
import { computeStats, checkThresholds, formatStatsReport } from '../dist/lib/stats.js';

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
      expect(stats.resourcePercent).toBeCloseTo((2 / 500) * 100, 1);
      expect(stats.outputPercent).toBeCloseTo((1 / 200) * 100, 1);
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
  });

  describe('checkThresholds', () => {
    it('returns no warnings when under 80%', () => {
      const stats = computeStats({
        Resources: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`R${i}`, { Type: 'AWS::S3::Bucket' }]),
        ),
      });
      expect(checkThresholds(stats)).toEqual([]);
    });

    it('warns when resources >= 80%', () => {
      const resources = Object.fromEntries(
        Array.from({ length: 400 }, (_, i) => [`R${i}`, { Type: 'AWS::S3::Bucket' }]),
      );
      const stats = computeStats({ Resources: resources });
      const warnings = checkThresholds(stats);
      expect(warnings.length).toBeGreaterThanOrEqual(1);
      expect(warnings.some((w) => w.message.includes('Resource count'))).toBe(true);
    });

    it('warns when outputs >= 80%', () => {
      const outputs = Object.fromEntries(
        Array.from({ length: 160 }, (_, i) => [`O${i}`, { Value: `v${i}` }]),
      );
      const stats = computeStats({ Outputs: outputs });
      const warnings = checkThresholds(stats);
      expect(warnings.some((w) => w.message.includes('Output count'))).toBe(true);
    });

    it('warns when template size >= 80%', () => {
      // Create a stats object with artificially high template percent
      const stats = computeStats({});
      stats.templatePercent = 85;
      stats.templateBytes = 890000;
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
      expect(report).toContain('Resources: 1/500');
      expect(report).toContain('Outputs:   1/200');
      expect(report).toContain('AWS::S3::Bucket: 1');
    });
  });
});
