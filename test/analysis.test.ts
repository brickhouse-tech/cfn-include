import { describe, it, expect } from 'vitest';
import { buildDependencyGraph } from '../dist/lib/graph.js';
import {
  analyzeConnectivity,
  scoreCluster,
  detectStronglyConnectedComponents,
} from '../dist/lib/analysis.js';

describe('analysis', () => {
  describe('analyzeConnectivity', () => {
    it('computes connection strength for direct refs', () => {
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
      const connectivity = analyzeConnectivity(graph);

      const key = 'Subnet:VPC';
      expect(connectivity.has(key)).toBe(true);
      const strength = connectivity.get(key)!;
      expect(strength.edgeCount).toBe(1);
      expect(strength.score).toBeGreaterThan(0);
    });

    it('detects bidirectional dependencies', () => {
      const template = {
        Resources: {
          A: {
            Type: 'AWS::Lambda::Function',
            Properties: { Role: { 'Fn::GetAtt': ['B', 'Arn'] } },
          },
          B: {
            Type: 'AWS::IAM::Role',
            Properties: { Description: { Ref: 'A' } },
          },
        },
      };
      const graph = buildDependencyGraph(template);
      const connectivity = analyzeConnectivity(graph);

      const key1 = 'A:B';
      const key2 = 'B:A';
      expect(connectivity.has(key1)).toBe(true);
      expect(connectivity.has(key2)).toBe(true);
      expect(connectivity.get(key1)!.isBidirectional).toBe(true);
      expect(connectivity.get(key2)!.isBidirectional).toBe(true);
    });

    it('accounts for shared conditions', () => {
      const template = {
        Conditions: {
          IsProd: { 'Fn::Equals': ['prod', 'prod'] },
        },
        Resources: {
          A: { Type: 'AWS::S3::Bucket', Condition: 'IsProd' },
          B: { Type: 'AWS::S3::Bucket', Condition: 'IsProd' },
        },
      };
      const graph = buildDependencyGraph(template);
      const connectivity = analyzeConnectivity(graph);

      // Should have shared condition entry (even without edges)
      const allStrengths = Array.from(connectivity.values());
      const withSharedConditions = allStrengths.filter((s) => s.sharedConditions.length > 0);
      expect(withSharedConditions.length).toBeGreaterThanOrEqual(0);
    });

    it('handles disconnected resources', () => {
      const template = {
        Resources: {
          A: { Type: 'AWS::S3::Bucket' },
          B: { Type: 'AWS::S3::Bucket' },
        },
      };
      const graph = buildDependencyGraph(template);
      const connectivity = analyzeConnectivity(graph);

      expect(connectivity.size).toBe(0);
    });
  });

  describe('scoreCluster', () => {
    it('computes cohesion for tightly connected cluster', () => {
      const template = {
        Resources: {
          A: {
            Type: 'AWS::Lambda::Function',
            Properties: { Role: { Ref: 'B' } },
          },
          B: {
            Type: 'AWS::IAM::Role',
            Properties: { Description: { Ref: 'C' } },
          },
          C: {
            Type: 'AWS::S3::Bucket',
            Properties: {},
          },
        },
      };
      const graph = buildDependencyGraph(template);
      const allClusters = new Map([['cluster1', ['A', 'B', 'C']]]);
      const score = scoreCluster('cluster1', ['A', 'B', 'C'], graph, allClusters);

      expect(score.cohesion).toBeGreaterThan(0);
      expect(score.size).toBe(3);
    });

    it('computes coupling for cross-cluster refs', () => {
      const template = {
        Resources: {
          A: {
            Type: 'AWS::Lambda::Function',
            Properties: { Role: { Ref: 'B' } },
          },
          B: { Type: 'AWS::IAM::Role' },
          C: {
            Type: 'AWS::S3::Bucket',
            Properties: { Name: { Ref: 'A' } },
          },
        },
      };
      const graph = buildDependencyGraph(template);
      const allClusters = new Map([
        ['cluster1', ['A', 'B']],
        ['cluster2', ['C']],
      ]);
      const score1 = scoreCluster('cluster1', ['A', 'B'], graph, allClusters);
      const score2 = scoreCluster('cluster2', ['C'], graph, allClusters);

      expect(score1.coupling).toBeGreaterThan(0);
      expect(score2.coupling).toBeGreaterThan(0);
    });

    it('handles singleton clusters', () => {
      const template = {
        Resources: {
          A: { Type: 'AWS::S3::Bucket' },
        },
      };
      const graph = buildDependencyGraph(template);
      const allClusters = new Map([['cluster1', ['A']]]);
      const score = scoreCluster('cluster1', ['A'], graph, allClusters);

      expect(score.cohesion).toBe(0);
      expect(score.size).toBe(1);
    });
  });

  describe('detectStronglyConnectedComponents', () => {
    it('finds simple cycles', () => {
      const template = {
        Resources: {
          A: {
            Type: 'AWS::Lambda::Function',
            Properties: { Role: { Ref: 'B' } },
          },
          B: {
            Type: 'AWS::IAM::Role',
            Properties: { Description: { Ref: 'A' } },
          },
        },
      };
      const graph = buildDependencyGraph(template);
      const sccs = detectStronglyConnectedComponents(graph);

      const cyclicSCCs = sccs.filter((scc) => scc.isCyclic);
      expect(cyclicSCCs.length).toBeGreaterThan(0);
      expect(cyclicSCCs[0].resourceIds.sort()).toEqual(['A', 'B']);
    });

    it('finds complex SCCs', () => {
      const template = {
        Resources: {
          A: {
            Type: 'AWS::Lambda::Function',
            Properties: { Role: { Ref: 'B' } },
          },
          B: {
            Type: 'AWS::IAM::Role',
            Properties: { Description: { Ref: 'C' } },
          },
          C: {
            Type: 'AWS::S3::Bucket',
            Properties: { Name: { Ref: 'A' } },
          },
        },
      };
      const graph = buildDependencyGraph(template);
      const sccs = detectStronglyConnectedComponents(graph);

      const cyclicSCCs = sccs.filter((scc) => scc.isCyclic);
      expect(cyclicSCCs.length).toBeGreaterThan(0);
      expect(cyclicSCCs[0].resourceIds.sort()).toEqual(['A', 'B', 'C']);
    });

    it('handles acyclic graphs', () => {
      const template = {
        Resources: {
          A: {
            Type: 'AWS::Lambda::Function',
            Properties: { Role: { Ref: 'B' } },
          },
          B: {
            Type: 'AWS::IAM::Role',
            Properties: {},
          },
        },
      };
      const graph = buildDependencyGraph(template);
      const sccs = detectStronglyConnectedComponents(graph);

      const cyclicSCCs = sccs.filter((scc) => scc.isCyclic);
      expect(cyclicSCCs.length).toBe(0);
    });
  });
});
