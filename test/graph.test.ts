import { describe, it, expect } from 'vitest';
import { buildDependencyGraph, PSEUDO_PARAMETERS } from '../dist/lib/graph.js';

describe('graph', () => {
  describe('buildDependencyGraph', () => {
    it('detects Ref dependencies', () => {
      const template = {
        Resources: {
          VPC: { Type: 'AWS::EC2::VPC', Properties: { CidrBlock: '10.0.0.0/16' } },
          Subnet: {
            Type: 'AWS::EC2::Subnet',
            Properties: { VpcId: { Ref: 'VPC' } },
          },
        },
      };
      const graph = buildDependencyGraph(template);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toMatchObject({
        source: 'Subnet',
        target: 'VPC',
        type: 'Ref',
      });
      expect(graph.nodes.get('Subnet')!.dependsOn.has('VPC')).toBe(true);
      expect(graph.nodes.get('VPC')!.dependedOnBy.has('Subnet')).toBe(true);
    });

    it('detects Fn::GetAtt dependencies (array form)', () => {
      const template = {
        Resources: {
          Role: { Type: 'AWS::IAM::Role', Properties: {} },
          Lambda: {
            Type: 'AWS::Lambda::Function',
            Properties: { Role: { 'Fn::GetAtt': ['Role', 'Arn'] } },
          },
        },
      };
      const graph = buildDependencyGraph(template);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toMatchObject({
        source: 'Lambda',
        target: 'Role',
        type: 'Fn::GetAtt',
        attribute: 'Arn',
      });
    });

    it('detects Fn::GetAtt dependencies (string form)', () => {
      const template = {
        Resources: {
          Role: { Type: 'AWS::IAM::Role', Properties: {} },
          Lambda: {
            Type: 'AWS::Lambda::Function',
            Properties: { Role: { 'Fn::GetAtt': 'Role.Arn' } },
          },
        },
      };
      const graph = buildDependencyGraph(template);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toMatchObject({
        source: 'Lambda',
        target: 'Role',
        type: 'Fn::GetAtt',
        attribute: 'Arn',
      });
    });

    it('detects DependsOn (string)', () => {
      const template = {
        Resources: {
          A: { Type: 'AWS::S3::Bucket', DependsOn: 'B' },
          B: { Type: 'AWS::S3::Bucket' },
        },
      };
      const graph = buildDependencyGraph(template);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toMatchObject({ source: 'A', target: 'B', type: 'DependsOn' });
    });

    it('detects DependsOn (array)', () => {
      const template = {
        Resources: {
          A: { Type: 'AWS::S3::Bucket', DependsOn: ['B', 'C'] },
          B: { Type: 'AWS::S3::Bucket' },
          C: { Type: 'AWS::S3::Bucket' },
        },
      };
      const graph = buildDependencyGraph(template);
      const dependsOnEdges = graph.edges.filter((e) => e.type === 'DependsOn');
      expect(dependsOnEdges).toHaveLength(2);
    });

    it('tracks Condition usage', () => {
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
      expect(graph.conditionUsage.get('IsProd')?.size).toBe(2);
      expect(graph.nodes.get('A')!.conditions).toContain('IsProd');
    });

    it('finds deeply nested refs', () => {
      const template = {
        Resources: {
          SG: { Type: 'AWS::EC2::SecurityGroup', Properties: {} },
          Instance: {
            Type: 'AWS::EC2::Instance',
            Properties: {
              NetworkInterfaces: [
                {
                  GroupSet: [{ Ref: 'SG' }],
                },
              ],
            },
          },
        },
      };
      const graph = buildDependencyGraph(template);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toMatchObject({ source: 'Instance', target: 'SG', type: 'Ref' });
    });

    it('ignores pseudo-parameters', () => {
      const template = {
        Resources: {
          A: {
            Type: 'AWS::S3::Bucket',
            Properties: {
              BucketName: { 'Fn::Sub': '${AWS::StackName}-bucket' },
              Region: { Ref: 'AWS::Region' },
            },
          },
        },
      };
      const graph = buildDependencyGraph(template);
      expect(graph.edges).toHaveLength(0);
    });

    it('ignores parameter refs', () => {
      const template = {
        Parameters: {
          Env: { Type: 'String' },
        },
        Resources: {
          A: {
            Type: 'AWS::S3::Bucket',
            Properties: { BucketName: { Ref: 'Env' } },
          },
        },
      };
      const graph = buildDependencyGraph(template);
      expect(graph.edges).toHaveLength(0);
      expect(graph.parameterIds.has('Env')).toBe(true);
    });

    it('deduplicates edges', () => {
      const template = {
        Resources: {
          VPC: { Type: 'AWS::EC2::VPC', Properties: { CidrBlock: '10.0.0.0/16' } },
          Subnet: {
            Type: 'AWS::EC2::Subnet',
            Properties: {
              VpcId: { Ref: 'VPC' },
              Tags: [{ Key: 'VPC', Value: { Ref: 'VPC' } }],
            },
          },
        },
      };
      const graph = buildDependencyGraph(template);
      expect(graph.edges).toHaveLength(1);
    });

    it('handles empty template', () => {
      const graph = buildDependencyGraph({});
      expect(graph.nodes.size).toBe(0);
      expect(graph.edges).toHaveLength(0);
    });
  });
});
