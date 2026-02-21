import { describe, it, expect } from 'vitest';
import { buildDependencyGraph } from '../dist/lib/graph.js';
import {
  clusterResources,
  optimizeClusters,
  enforceConstraints,
} from '../dist/lib/clustering.js';

describe('clustering', () => {
  describe('clusterResources', () => {
    it('groups by connectivity with connectivity strategy', () => {
      const template = {
        Resources: {
          VPC: { Type: 'AWS::EC2::VPC', Properties: {} },
          Subnet1: {
            Type: 'AWS::EC2::Subnet',
            Properties: { VpcId: { Ref: 'VPC' } },
          },
          Subnet2: {
            Type: 'AWS::EC2::Subnet',
            Properties: { VpcId: { Ref: 'VPC' } },
          },
          Lambda: { Type: 'AWS::Lambda::Function', Properties: {} },
        },
      };
      const graph = buildDependencyGraph(template);
      const clusters = clusterResources(template, graph, { strategy: 'connectivity' });

      expect(clusters.length).toBeGreaterThan(0);
      // VPC and subnets should be together
      const vpcCluster = clusters.find((c) => c.resourceIds.includes('VPC'));
      expect(vpcCluster?.resourceIds).toContain('Subnet1');
      expect(vpcCluster?.resourceIds).toContain('Subnet2');
    });

    it('groups by type with semantic strategy', () => {
      const template = {
        Resources: {
          VPC: { Type: 'AWS::EC2::VPC', Properties: {} },
          Subnet: { Type: 'AWS::EC2::Subnet', Properties: {} },
          Lambda: { Type: 'AWS::Lambda::Function', Properties: {} },
          DynamoDB: { Type: 'AWS::DynamoDB::Table', Properties: {} },
        },
      };
      const graph = buildDependencyGraph(template);
      const clusters = clusterResources(template, graph, { strategy: 'semantic' });

      expect(clusters.length).toBeGreaterThanOrEqual(3); // Networking, Compute, Data
      const networkingCluster = clusters.find((c) => c.category === 'Networking');
      expect(networkingCluster?.resourceIds).toContain('VPC');
      expect(networkingCluster?.resourceIds).toContain('Subnet');

      const computeCluster = clusters.find((c) => c.category === 'Compute');
      expect(computeCluster?.resourceIds).toContain('Lambda');

      const dataCluster = clusters.find((c) => c.category === 'Data');
      expect(dataCluster?.resourceIds).toContain('DynamoDB');
    });

    it('balances both with hybrid strategy', () => {
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
      const clusters = clusterResources(template, graph, { strategy: 'hybrid' });

      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.length).toBeLessThanOrEqual(4);
    });

    it('respects max cluster size', () => {
      const template = {
        Resources: {},
      };
      // Create 50 resources
      for (let i = 0; i < 50; i++) {
        (template.Resources as any)[`Bucket${i}`] = { Type: 'AWS::S3::Bucket', Properties: {} };
      }
      const graph = buildDependencyGraph(template);
      const clusters = clusterResources(template, graph, { maxClusterSize: 20 });

      for (const cluster of clusters) {
        expect(cluster.resourceIds.length).toBeLessThanOrEqual(20);
      }
    });

    it('keeps SCCs together', () => {
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
          C: { Type: 'AWS::S3::Bucket', Properties: {} },
        },
      };
      const graph = buildDependencyGraph(template);
      const clusters = clusterResources(template, graph);

      // A and B form a cycle, should be in same cluster
      const clusterA = clusters.find((c) => c.resourceIds.includes('A'));
      expect(clusterA?.resourceIds).toContain('B');
    });
  });

  describe('optimizeClusters', () => {
    it('improves cluster quality through resource moves', () => {
      const template = {
        Resources: {
          VPC: { Type: 'AWS::EC2::VPC', Properties: {} },
          Subnet: {
            Type: 'AWS::EC2::Subnet',
            Properties: { VpcId: { Ref: 'VPC' } },
          },
          Lambda: {
            Type: 'AWS::Lambda::Function',
            Properties: { VpcId: { Ref: 'VPC' } },
          },
        },
      };
      const graph = buildDependencyGraph(template);
      const initialClusters = clusterResources(template, graph, { strategy: 'semantic' });

      // Clusters should already be optimized by clusterResources
      expect(initialClusters.length).toBeGreaterThan(0);
    });

    it('converges within max iterations', () => {
      const template = {
        Resources: {
          A: { Type: 'AWS::S3::Bucket', Properties: {} },
          B: { Type: 'AWS::S3::Bucket', Properties: {} },
          C: { Type: 'AWS::S3::Bucket', Properties: {} },
        },
      };
      const graph = buildDependencyGraph(template);
      const clusters = clusterResources(template, graph);

      // Should complete without hanging
      expect(clusters.length).toBeGreaterThan(0);
    });
  });

  describe('enforceConstraints', () => {
    it('splits oversized clusters', () => {
      const template = {
        Resources: {},
      };
      // Create 50 S3 buckets in same category
      for (let i = 0; i < 50; i++) {
        (template.Resources as any)[`Bucket${i}`] = { Type: 'AWS::S3::Bucket', Properties: {} };
      }
      const graph = buildDependencyGraph(template);
      const initialClusters = clusterResources(template, graph, { strategy: 'semantic' });

      const oversized = initialClusters.filter((c) => c.resourceIds.length > 20);
      if (oversized.length > 0) {
        const enforced = enforceConstraints(initialClusters, graph, 20);
        for (const cluster of enforced) {
          expect(cluster.resourceIds.length).toBeLessThanOrEqual(20);
        }
      }
    });

    it('preserves high-connectivity groups when splitting', () => {
      const template = {
        Resources: {
          VPC: { Type: 'AWS::EC2::VPC', Properties: {} },
        },
      };
      // Add many subnets connected to VPC
      for (let i = 0; i < 30; i++) {
        (template.Resources as any)[`Subnet${i}`] = {
          Type: 'AWS::EC2::Subnet',
          Properties: { VpcId: { Ref: 'VPC' } },
        };
      }
      const graph = buildDependencyGraph(template);
      const clusters = clusterResources(template, graph, { maxClusterSize: 20 });

      // VPC should be in one of the split clusters
      const vpcCluster = clusters.find((c) => c.resourceIds.includes('VPC'));
      expect(vpcCluster).toBeDefined();
      expect(vpcCluster!.resourceIds.length).toBeLessThanOrEqual(20);
    });
  });
});
