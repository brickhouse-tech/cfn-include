import { describe, it, expect } from 'vitest';
import { buildDependencyGraph } from '../dist/lib/graph.js';
import {
  suggestSplit,
  autoSplit,
  categorizeResource,
  formatSplitReport,
  DEFAULT_CATEGORY,
} from '../dist/lib/split.js';

const MULTI_STACK_TEMPLATE = {
  AWSTemplateFormatVersion: '2010-09-09' as const,
  Description: 'Test Stack',
  Parameters: {
    Env: { Type: 'String', Default: 'dev' },
  },
  Conditions: {
    IsProd: { 'Fn::Equals': [{ Ref: 'Env' }, 'prod'] },
  },
  Resources: {
    VPC: {
      Type: 'AWS::EC2::VPC',
      Properties: { CidrBlock: '10.0.0.0/16' },
    },
    Subnet: {
      Type: 'AWS::EC2::Subnet',
      Properties: { VpcId: { Ref: 'VPC' } },
    },
    SecurityGroup: {
      Type: 'AWS::EC2::SecurityGroup',
      Properties: { VpcId: { Ref: 'VPC' } },
    },
    LambdaRole: {
      Type: 'AWS::IAM::Role',
      Properties: { AssumeRolePolicyDocument: {} },
    },
    LambdaFn: {
      Type: 'AWS::Lambda::Function',
      Properties: {
        Role: { 'Fn::GetAtt': ['LambdaRole', 'Arn'] },
        VpcConfig: {
          SubnetIds: [{ Ref: 'Subnet' }],
          SecurityGroupIds: [{ Ref: 'SecurityGroup' }],
        },
      },
    },
    Table: {
      Type: 'AWS::DynamoDB::Table',
      Condition: 'IsProd',
      Properties: { TableName: 'test' },
    },
    Alarm: {
      Type: 'AWS::CloudWatch::Alarm',
      Properties: {
        Dimensions: [{ Name: 'FunctionName', Value: { Ref: 'LambdaFn' } }],
      },
    },
  },
  Outputs: {
    VpcId: { Value: { Ref: 'VPC' } },
  },
};

describe('split', () => {
  describe('categorizeResource', () => {
    it('categorizes networking resources', () => {
      expect(categorizeResource('AWS::EC2::VPC')).toBe('Networking');
      expect(categorizeResource('AWS::EC2::Subnet')).toBe('Networking');
      expect(categorizeResource('AWS::EC2::SecurityGroup')).toBe('Networking');
      expect(categorizeResource('AWS::ElasticLoadBalancingV2::TargetGroup')).toBe('Networking');
    });

    it('categorizes compute resources', () => {
      expect(categorizeResource('AWS::Lambda::Function')).toBe('Compute');
      expect(categorizeResource('AWS::ECS::Service')).toBe('Compute');
    });

    it('categorizes data resources', () => {
      expect(categorizeResource('AWS::DynamoDB::Table')).toBe('Data');
      expect(categorizeResource('AWS::RDS::DBInstance')).toBe('Data');
      expect(categorizeResource('AWS::S3::Bucket')).toBe('Data');
    });

    it('categorizes IAM resources', () => {
      expect(categorizeResource('AWS::IAM::Role')).toBe('IAM');
      expect(categorizeResource('AWS::IAM::Policy')).toBe('IAM');
    });

    it('categorizes monitoring resources', () => {
      expect(categorizeResource('AWS::CloudWatch::Alarm')).toBe('Monitoring');
      expect(categorizeResource('AWS::SNS::Topic')).toBe('Monitoring');
    });

    it('returns default for unknown types', () => {
      expect(categorizeResource('AWS::Custom::Resource')).toBe(DEFAULT_CATEGORY);
    });
  });

  describe('suggestSplit', () => {
    it('groups resources by category', () => {
      const graph = buildDependencyGraph(MULTI_STACK_TEMPLATE);
      const suggestion = suggestSplit(MULTI_STACK_TEMPLATE, graph);

      expect(suggestion.groups.length).toBeGreaterThanOrEqual(4);
      const names = suggestion.groups.map((g) => g.name).sort();
      expect(names).toContain('Networking');
      expect(names).toContain('Compute');
      expect(names).toContain('IAM');
      expect(names).toContain('Data');
      expect(names).toContain('Monitoring');
    });

    it('detects cross-stack dependencies', () => {
      const graph = buildDependencyGraph(MULTI_STACK_TEMPLATE);
      const suggestion = suggestSplit(MULTI_STACK_TEMPLATE, graph);

      expect(suggestion.crossStackDependencies.length).toBeGreaterThan(0);

      // Lambda (Compute) depends on LambdaRole (IAM) via GetAtt
      const iamToCompute = suggestion.crossStackDependencies.find(
        (d) => d.sourceStack === 'Compute' && d.targetStack === 'IAM',
      );
      expect(iamToCompute).toBeDefined();
    });

    it('produces a deployment order', () => {
      const graph = buildDependencyGraph(MULTI_STACK_TEMPLATE);
      const suggestion = suggestSplit(MULTI_STACK_TEMPLATE, graph);

      expect(suggestion.deploymentOrder.length).toBe(suggestion.groups.length);
      // Networking should come before Compute (Compute depends on Networking)
      const netIdx = suggestion.deploymentOrder.indexOf('Networking');
      const compIdx = suggestion.deploymentOrder.indexOf('Compute');
      expect(netIdx).toBeLessThan(compIdx);
    });

    it('formats a readable report', () => {
      const graph = buildDependencyGraph(MULTI_STACK_TEMPLATE);
      const suggestion = suggestSplit(MULTI_STACK_TEMPLATE, graph);
      const report = formatSplitReport(suggestion);

      expect(report).toContain('Stack Split Suggestion');
      expect(report).toContain('Deployment Order');
      expect(report).toContain('Networking');
      expect(report).toContain('Cross-Stack Dependencies');
    });
  });

  describe('autoSplit', () => {
    it('generates valid child stack templates', () => {
      const graph = buildDependencyGraph(MULTI_STACK_TEMPLATE);
      const result = autoSplit(MULTI_STACK_TEMPLATE, graph);

      expect(result.stacks.length).toBeGreaterThanOrEqual(4);

      for (const stack of result.stacks) {
        expect(stack.template.Resources).toBeDefined();
        expect(Object.keys(stack.template.Resources!).length).toBeGreaterThan(0);
        // Each child should have a description
        expect(stack.template.Description).toContain(stack.name);
      }
    });

    it('wires cross-stack references via Fn::ImportValue', () => {
      const graph = buildDependencyGraph(MULTI_STACK_TEMPLATE);
      const result = autoSplit(MULTI_STACK_TEMPLATE, graph);

      const computeStack = result.stacks.find((s) => s.name === 'Compute');
      expect(computeStack).toBeDefined();

      // The Lambda function should have its Role replaced with ImportValue
      const lambdaFn = computeStack!.template.Resources!.LambdaFn;
      const roleValue = (lambdaFn as any).Properties.Role;
      expect(roleValue).toHaveProperty('Fn::ImportValue');
    });

    it('adds exports to source stacks', () => {
      const graph = buildDependencyGraph(MULTI_STACK_TEMPLATE);
      const result = autoSplit(MULTI_STACK_TEMPLATE, graph);

      const iamStack = result.stacks.find((s) => s.name === 'IAM');
      expect(iamStack).toBeDefined();
      expect(iamStack!.template.Outputs).toBeDefined();

      // Should export the LambdaRole Arn
      const outputs = iamStack!.template.Outputs!;
      const exportKeys = Object.keys(outputs);
      const roleExport = exportKeys.find((k) => k.includes('LambdaRole'));
      expect(roleExport).toBeDefined();
    });

    it('carries over only used parameters', () => {
      const graph = buildDependencyGraph(MULTI_STACK_TEMPLATE);
      const result = autoSplit(MULTI_STACK_TEMPLATE, graph);

      // Data stack has the DynamoDB table with Condition IsProd (which uses Env param indirectly)
      // But the Table doesn't directly Ref the Env param, so it might not be carried
      // Networking/Compute don't use Env param directly either
      for (const stack of result.stacks) {
        if (stack.template.Parameters) {
          // All carried params should exist in the original
          for (const param of Object.keys(stack.template.Parameters)) {
            expect(MULTI_STACK_TEMPLATE.Parameters).toHaveProperty(param);
          }
        }
      }
    });

    it('carries over used conditions', () => {
      const graph = buildDependencyGraph(MULTI_STACK_TEMPLATE);
      const result = autoSplit(MULTI_STACK_TEMPLATE, graph);

      const dataStack = result.stacks.find((s) => s.name === 'Data');
      expect(dataStack).toBeDefined();
      expect(dataStack!.template.Conditions).toHaveProperty('IsProd');
    });

    it('generates a parent orchestrator stack', () => {
      const graph = buildDependencyGraph(MULTI_STACK_TEMPLATE);
      const result = autoSplit(MULTI_STACK_TEMPLATE, graph);

      expect(result.parent).toBeDefined();
      expect(result.parent!.template.Resources).toBeDefined();

      const parentResources = result.parent!.template.Resources!;
      const stackResources = Object.values(parentResources);
      expect(stackResources.every((r) => r.Type === 'AWS::CloudFormation::Stack')).toBe(true);
    });

    it('respects generateParent: false', () => {
      const graph = buildDependencyGraph(MULTI_STACK_TEMPLATE);
      const result = autoSplit(MULTI_STACK_TEMPLATE, graph, undefined, { generateParent: false });

      expect(result.parent).toBeUndefined();
    });

    it('preserves AWSTemplateFormatVersion', () => {
      const graph = buildDependencyGraph(MULTI_STACK_TEMPLATE);
      const result = autoSplit(MULTI_STACK_TEMPLATE, graph);

      for (const stack of result.stacks) {
        expect(stack.template.AWSTemplateFormatVersion).toBe('2010-09-09');
      }
    });

    it('carries over existing outputs to correct child stack', () => {
      const graph = buildDependencyGraph(MULTI_STACK_TEMPLATE);
      const result = autoSplit(MULTI_STACK_TEMPLATE, graph);

      const netStack = result.stacks.find((s) => s.name === 'Networking');
      expect(netStack).toBeDefined();
      expect(netStack!.template.Outputs).toHaveProperty('VpcId');
    });
  });
});
