#!/usr/bin/env node
/**
 * Generate an oversized CloudFormation template with 600+ resources
 * for testing Phase 4.2 clustering algorithm
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const template = {
  AWSTemplateFormatVersion: '2010-09-09',
  Description: 'Oversized template with 600+ resources for Phase 4.2 testing',
  Resources: {},
};

// Create VPC and networking foundation (50 resources)
template.Resources.VPC = {
  Type: 'AWS::EC2::VPC',
  Properties: {
    CidrBlock: '10.0.0.0/16',
    EnableDnsHostnames: true,
    EnableDnsSupport: true,
  },
};

template.Resources.InternetGateway = {
  Type: 'AWS::EC2::InternetGateway',
};

template.Resources.VPCGatewayAttachment = {
  Type: 'AWS::EC2::VPCGatewayAttachment',
  Properties: {
    VpcId: { Ref: 'VPC' },
    InternetGatewayId: { Ref: 'InternetGateway' },
  },
};

// Create 20 subnets across 2 AZs
for (let i = 1; i <= 20; i++) {
  template.Resources[`Subnet${i}`] = {
    Type: 'AWS::EC2::Subnet',
    Properties: {
      VpcId: { Ref: 'VPC' },
      CidrBlock: `10.0.${i}.0/24`,
      AvailabilityZone: { 'Fn::Select': [i % 2, { 'Fn::GetAZs': '' }] },
    },
  };
}

// Create 10 route tables
for (let i = 1; i <= 10; i++) {
  template.Resources[`RouteTable${i}`] = {
    Type: 'AWS::EC2::RouteTable',
    Properties: {
      VpcId: { Ref: 'VPC' },
    },
  };
}

// Create routes for each route table
for (let i = 1; i <= 10; i++) {
  template.Resources[`Route${i}`] = {
    Type: 'AWS::EC2::Route',
    DependsOn: 'VPCGatewayAttachment',
    Properties: {
      RouteTableId: { Ref: `RouteTable${i}` },
      DestinationCidrBlock: '0.0.0.0/0',
      GatewayId: { Ref: 'InternetGateway' },
    },
  };
}

// Create 15 security groups with interconnected rules
for (let i = 1; i <= 15; i++) {
  const rules = [];
  // Each security group allows traffic from 2 others
  if (i > 1) {
    rules.push({
      IpProtocol: 'tcp',
      FromPort: 8080,
      ToPort: 8080,
      SourceSecurityGroupId: { Ref: `SecurityGroup${i - 1}` },
    });
  }
  if (i > 2) {
    rules.push({
      IpProtocol: 'tcp',
      FromPort: 443,
      ToPort: 443,
      SourceSecurityGroupId: { Ref: `SecurityGroup${i - 2}` },
    });
  }
  
  template.Resources[`SecurityGroup${i}`] = {
    Type: 'AWS::EC2::SecurityGroup',
    Properties: {
      GroupDescription: `Security Group ${i}`,
      VpcId: { Ref: 'VPC' },
      SecurityGroupIngress: rules,
    },
  };
}

// Create 200 Lambda functions (biggest resource type)
for (let i = 1; i <= 200; i++) {
  const envVars = {};
  
  // Create dependencies to other lambdas
  if (i > 1) {
    envVars[`LAMBDA_${i - 1}_ARN`] = { 'Fn::GetAtt': [`Lambda${i - 1}`, 'Arn'] };
  }
  if (i % 10 === 0 && i > 10) {
    envVars[`LAMBDA_${i - 10}_ARN`] = { 'Fn::GetAtt': [`Lambda${i - 10}`, 'Arn'] };
  }
  
  // Reference security group
  const sgRef = { Ref: `SecurityGroup${(i % 15) + 1}` };
  
  template.Resources[`Lambda${i}`] = {
    Type: 'AWS::Lambda::Function',
    Properties: {
      FunctionName: `Function${i}`,
      Runtime: 'nodejs20.x',
      Handler: 'index.handler',
      Role: { 'Fn::GetAtt': [`LambdaRole${Math.floor(i / 20) + 1}`, 'Arn'] },
      Code: {
        ZipFile: `exports.handler = async () => ({ statusCode: 200, body: 'Lambda ${i}' });`,
      },
      VpcConfig: {
        SecurityGroupIds: [sgRef],
        SubnetIds: [
          { Ref: `Subnet${(i % 20) + 1}` },
        ],
      },
      Environment: {
        Variables: envVars,
      },
    },
  };
}

// Create 10 IAM roles for lambdas
for (let i = 1; i <= 10; i++) {
  template.Resources[`LambdaRole${i}`] = {
    Type: 'AWS::IAM::Role',
    Properties:  {
      AssumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { Service: 'lambda.amazonaws.com' },
          Action: 'sts:AssumeRole',
        }],
      },
      ManagedPolicyArns: [
        'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole',
      ],
    },
  };
}

// Create 100 DynamoDB tables
for (let i = 1; i <= 100; i++) {
  template.Resources[`DynamoTable${i}`] = {
    Type: 'AWS::DynamoDB::Table',
    Properties: {
      TableName: `Table${i}`,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [{
        AttributeName: 'id',
        AttributeType: 'S',
      }],
      KeySchema: [{
        AttributeName: 'id',
        KeyType: 'HASH',
      }],
    },
  };
}

// Create 50 S3 buckets
for (let i = 1; i <= 50; i++) {
  template.Resources[`Bucket${i}`] = {
    Type: 'AWS::S3::Bucket',
    Properties: {
      VersioningConfiguration: {
        Status: 'Enabled',
      },
    },
  };
}

// Create 30 SNS topics
for (let i = 1; i <= 30; i++) {
  template.Resources[`Topic${i}`] = {
    Type: 'AWS::SNS::Topic',
    Properties: {
      DisplayName: `Topic ${i}`,
    },
  };
}

// Create 30 SQS queues
for (let i = 1; i <= 30; i++) {
  template.Resources[`Queue${i}`] = {
    Type: 'AWS::SQS::Queue',
    Properties: {
      QueueName: `Queue${i}`,
      VisibilityTimeout: 300,
    },
  };
}

// Create 20 CloudWatch alarms
for (let i = 1; i <= 20; i++) {
  template.Resources[`Alarm${i}`] = {
    Type: 'AWS::CloudWatch::Alarm',
    Properties: {
      AlarmName: `Alarm${i}`,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 1,
      MetricName: 'Invocations',
      Namespace: 'AWS/Lambda',
      Period: 300,
      Statistic: 'Sum',
      Threshold: 100,
      Dimensions: [{
        Name: 'FunctionName',
        Value: { Ref: `Lambda${i}` },
      }],
      AlarmActions: [{ Ref: `Topic${(i % 30) + 1}` }],
    },
  };
}

// Create 20 EventBridge rules
for (let i = 1; i <= 20; i++) {
  const targets = [];
  targets.push({
    Arn: { 'Fn::GetAtt': [`Lambda${i}`, 'Arn'] },
    Id: `Target${i}`,
  });
  if (i <= 10) {
    targets.push({
      Arn: { 'Fn::GetAtt': [`Lambda${i + 10}`, 'Arn'] },
      Id: `Target${i + 10}`,
    });
  }
  
  template.Resources[`EventRule${i}`] = {
    Type: 'AWS::Events::Rule',
    Properties: {
      Name: `Rule${i}`,
      State: 'ENABLED',
      EventPattern: {
        source: ['custom.app'],
        'detail-type': [`Type${i}`],
      },
      Targets: targets,
    },
  };
}

// Create 30 RDS instances (small but realistic)
for (let i = 1; i <= 30; i++) {
  // Create DB subnet group first
  template.Resources[`DBSubnetGroup${i}`] = {
    Type: 'AWS::RDS::DBSubnetGroup',
    Properties: {
      DBSubnetGroupDescription: `Subnet group for DB ${i}`,
      SubnetIds: [
        { Ref: `Subnet${(i % 20) + 1}` },
        { Ref: `Subnet${((i + 1) % 20) + 1}` },
      ],
    },
  };
  
  template.Resources[`Database${i}`] = {
    Type: 'AWS::RDS::DBInstance',
    Properties: {
      Engine: 'postgres',
      EngineVersion: '15.3',
      DBInstanceClass: 'db.t3.micro',
      AllocatedStorage: 20,
      DBName: `db${i}`,
      MasterUsername: 'admin',
      MasterUserPassword: `password${i}`,
      DBSubnetGroupName: { Ref: `DBSubnetGroup${i}` },
      VPCSecurityGroups: [{ Ref: `SecurityGroup${(i % 15) + 1}` }],
    },
  };
}

// Create 20 ElastiCache clusters
for (let i = 1; i <= 20; i++) {
  // Create cache subnet group
  template.Resources[`CacheSubnetGroup${i}`] = {
    Type: 'AWS::ElastiCache::SubnetGroup',
    Properties: {
      Description: `Cache subnet group ${i}`,
      SubnetIds: [
        { Ref: `Subnet${(i % 20) + 1}` },
      ],
    },
  };
  
  template.Resources[`CacheCluster${i}`] = {
    Type: 'AWS::ElastiCache::CacheCluster',
    Properties: {
      Engine: 'redis',
      CacheNodeType: 'cache.t3.micro',
      NumCacheNodes: 1,
      CacheSubnetGroupName: { Ref: `CacheSubnetGroup${i}` },
      VpcSecurityGroupIds: [{ Ref: `SecurityGroup${(i % 15) + 1}` }],
    },
  };
}

// Add some outputs (within limit of 200)
const outputs = {};
for (let i = 1; i <= 50; i++) {
  outputs[`Lambda${i}Arn`] = {
    Description: `ARN of Lambda ${i}`,
    Value: { 'Fn::GetAtt': [`Lambda${i}`, 'Arn'] },
    Export: {
      Name: { 'Fn::Sub': `\${AWS::StackName}-Lambda${i}Arn` },
    },
  };
}

template.Outputs = outputs;

// Count resources
const resourceCount = Object.keys(template.Resources).length;
console.log(`Generated template with ${resourceCount} resources`);

// Write to file
const outputPath = path.join(__dirname, 'oversized-stack.yml');
fs.writeFileSync(outputPath, yaml.dump(template, { lineWidth: -1, noRefs: true }));
console.log(`Written to ${outputPath}`);
