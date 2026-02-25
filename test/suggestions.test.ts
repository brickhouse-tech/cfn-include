import { describe, it, expect } from 'vitest';
import { buildDependencyGraph } from '../dist/lib/graph.js';
import {
  generateSplitSuggestions,
  rankSuggestions,
  formatDetailedReport,
} from '../dist/lib/suggestions.js';

describe('suggestions', () => {
  describe('generateSplitSuggestions', () => {
    it('provides multiple strategies', () => {
      const template = {
        Resources: {
          VPC: { Type: 'AWS::EC2::VPC', Properties: {} },
          Subnet: {
            Type: 'AWS::EC2::Subnet',
            Properties: { VpcId: { Ref: 'VPC' } },
          },
          Lambda: { Type: 'AWS::Lambda::Function', Properties: {} },
          DynamoDB: { Type: 'AWS::DynamoDB::Table', Properties: {} },
        },
      };
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);

      expect(suggestion.recommended).toBeDefined();
      expect(suggestion.alternatives.length).toBeGreaterThan(0);
      expect(suggestion.analysis).toBeDefined();
    });

    it('ranks strategies by quality', () => {
      const template = {
        Resources: {
          VPC: { Type: 'AWS::EC2::VPC', Properties: {} },
          Subnet: {
            Type: 'AWS::EC2::Subnet',
            Properties: { VpcId: { Ref: 'VPC' } },
          },
          Lambda: { Type: 'AWS::Lambda::Function', Properties: {} },
          DynamoDB: { Type: 'AWS::DynamoDB::Table', Properties: {} },
        },
      };
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);

      // Recommended should have highest score
      const allScores = [
        suggestion.recommended.overallScore,
        ...suggestion.alternatives.map((a) => a.overallScore),
      ];
      expect(suggestion.recommended.overallScore).toBeGreaterThanOrEqual(
        Math.min(...allScores),
      );
    });

    it('detects anti-patterns', () => {
      const template = {
        Resources: {},
      };
      // Create oversized template
      for (let i = 0; i < 250; i++) {
        (template.Resources as any)[`Resource${i}`] = { Type: 'AWS::S3::Bucket', Properties: {} };
      }
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);

      expect(suggestion.analysis.antiPatterns.length).toBeGreaterThan(0);
    });

    it('suggests opportunities', () => {
      const template = {
        Resources: {
          VPC: { Type: 'AWS::EC2::VPC', Properties: {} },
          Subnet: { Type: 'AWS::EC2::Subnet', Properties: {} },
          Lambda: { Type: 'AWS::Lambda::Function', Properties: {} },
          DynamoDB: { Type: 'AWS::DynamoDB::Table', Properties: {} },
          Role: { Type: 'AWS::IAM::Role', Properties: {} },
        },
      };
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);

      expect(suggestion.analysis.opportunities.length).toBeGreaterThan(0);
    });

    it('detects when template exceeds limits', () => {
      const template = {
        Resources: {},
      };
      // Create template that exceeds resource limit
      for (let i = 0; i < 520; i++) {
        (template.Resources as any)[`Resource${i}`] = { Type: 'AWS::S3::Bucket', Properties: {} };
      }
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);

      expect(suggestion.analysis.exceedsLimits).toBe(true);
      expect(suggestion.analysis.resourceOverage).toBeGreaterThan(0);
    });
  });

  describe('formatDetailedReport', () => {
    it('formats comprehensive report', () => {
      const template = {
        Resources: {
          VPC: { Type: 'AWS::EC2::VPC', Properties: {} },
          Subnet: {
            Type: 'AWS::EC2::Subnet',
            Properties: { VpcId: { Ref: 'VPC' } },
          },
          Lambda: { Type: 'AWS::Lambda::Function', Properties: {} },
          DynamoDB: { Type: 'AWS::DynamoDB::Table', Properties: {} },
        },
      };
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);
      const report = formatDetailedReport(suggestion);

      expect(report).toContain('CloudFormation Stack Split Analysis');
      expect(report).toContain('RECOMMENDED');
      expect(report).toContain('Quality Score');
    });

    it('includes quality metrics', () => {
      const template = {
        Resources: {
          VPC: { Type: 'AWS::EC2::VPC', Properties: {} },
          Subnet: {
            Type: 'AWS::EC2::Subnet',
            Properties: { VpcId: { Ref: 'VPC' } },
          },
        },
      };
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);
      const report = formatDetailedReport(suggestion);

      expect(report).toContain('Cohesion');
      expect(report).toContain('Coupling');
    });

    it('shows deployment order', () => {
      const template = {
        Resources: {
          VPC: { Type: 'AWS::EC2::VPC', Properties: {} },
          Subnet: {
            Type: 'AWS::EC2::Subnet',
            Properties: { VpcId: { Ref: 'VPC' } },
          },
          Lambda: { Type: 'AWS::Lambda::Function', Properties: {} },
        },
      };
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);
      const report = formatDetailedReport(suggestion);

      expect(report).toContain('Deployment Order');
      expect(report).toContain('→');
    });
  });

  describe('rankSuggestions', () => {
    it('sorts by quality score descending', () => {
      const options = [
        {
          strategy: 'A',
          clusters: [],
          crossStackDeps: [],
          deploymentOrder: [],
          overallScore: 0.5,
          estimatedDeploymentMin: 10,
        },
        {
          strategy: 'B',
          clusters: [],
          crossStackDeps: [],
          deploymentOrder: [],
          overallScore: 0.8,
          estimatedDeploymentMin: 10,
        },
        {
          strategy: 'C',
          clusters: [],
          crossStackDeps: [],
          deploymentOrder: [],
          overallScore: 0.3,
          estimatedDeploymentMin: 10,
        },
      ];

      const ranked = rankSuggestions(options);
      expect(ranked[0].overallScore).toBe(0.8);
      expect(ranked[1].overallScore).toBe(0.5);
      expect(ranked[2].overallScore).toBe(0.3);
    });
  });
});
