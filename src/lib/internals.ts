import type { AwsPseudoParameters } from '../types/index.js';

export function getAwsPseudoParameters(): AwsPseudoParameters {
  return {
    'AWS::AccountId': process.env.AWS_ACCOUNT_ID || process.env.AWS_ACCOUNT_NUM || '${AWS::AccountId}',
    'AWS::Partition': process.env.AWS_PARTITION || 'aws',
    'AWS::Region': process.env.AWS_REGION || '${AWS::Region}',
    'AWS::StackId': process.env.AWS_STACK_ID || '${AWS::StackId}',
    'AWS::StackName': process.env.AWS_STACK_NAME || '${AWS::StackName}',
    'AWS::URLSuffix': process.env.AWS_URL_SUFFIX || 'amazonaws.com',
    'AWS::NotificationARNs': process.env.AWS_NOTIFICATION_ARNS || '${AWS::NotificationARNs}',
  };
}

export interface BuildResourceArnOptions {
  returnType?: 'arn' | 'name';
}

/**
 * Build an ARN for a CloudFormation resource based on its Type and Properties
 */
export function buildResourceArn(
  resourceType: string,
  properties: Record<string, unknown> = {},
  pseudoParams: Partial<AwsPseudoParameters> = {},
  options: BuildResourceArnOptions = {},
): string | null {
  const accountId = pseudoParams['AWS::AccountId'] || '${AWS::AccountId}';
  const region = pseudoParams['AWS::Region'] || '${AWS::Region}';
  const partition = pseudoParams['AWS::Partition'] || 'aws';
  const returnType = options.returnType || 'arn';

  // Handle AWS::IAM::ManagedPolicy
  if (resourceType === 'AWS::IAM::ManagedPolicy') {
    const { ManagedPolicyName, Path } = properties as { ManagedPolicyName?: string; Path?: string };
    if (ManagedPolicyName) {
      if (returnType === 'name') {
        return ManagedPolicyName;
      }
      const path = Path || '/';
      return `arn:${partition}:iam::${accountId}:policy${path}${ManagedPolicyName}`;
    }
  }

  // Handle AWS::IAM::Role
  if (resourceType === 'AWS::IAM::Role') {
    const { RoleName, Path } = properties as { RoleName?: string; Path?: string };
    if (RoleName) {
      if (returnType === 'name') {
        return RoleName;
      }
      const path = Path || '/';
      return `arn:${partition}:iam::${accountId}:role${path}${RoleName}`;
    }
  }

  // Handle AWS::S3::Bucket
  if (resourceType === 'AWS::S3::Bucket') {
    const { BucketName } = properties as { BucketName?: string };
    if (BucketName) {
      if (returnType === 'name') {
        return BucketName;
      }
      return `arn:${partition}:s3:::${BucketName}`;
    }
  }

  // Handle AWS::Lambda::Function
  if (resourceType === 'AWS::Lambda::Function') {
    const { FunctionName } = properties as { FunctionName?: string };
    if (FunctionName) {
      if (returnType === 'name') {
        return FunctionName;
      }
      return `arn:${partition}:lambda:${region}:${accountId}:function:${FunctionName}`;
    }
  }

  // Handle AWS::SQS::Queue
  if (resourceType === 'AWS::SQS::Queue') {
    const { QueueName } = properties as { QueueName?: string };
    if (QueueName) {
      if (returnType === 'name') {
        return QueueName;
      }
      return `arn:${partition}:sqs:${region}:${accountId}:${QueueName}`;
    }
  }

  // Handle AWS::SNS::Topic
  if (resourceType === 'AWS::SNS::Topic') {
    const { TopicName } = properties as { TopicName?: string };
    if (TopicName) {
      if (returnType === 'name') {
        return TopicName;
      }
      return `arn:${partition}:sns:${region}:${accountId}:${TopicName}`;
    }
  }

  // Handle AWS::DynamoDB::Table
  if (resourceType === 'AWS::DynamoDB::Table') {
    const { TableName } = properties as { TableName?: string };
    if (TableName) {
      if (returnType === 'name') {
        return TableName;
      }
      return `arn:${partition}:dynamodb:${region}:${accountId}:table/${TableName}`;
    }
  }

  // Handle AWS::RDS::DBInstance
  if (resourceType === 'AWS::RDS::DBInstance') {
    const { DBInstanceIdentifier } = properties as { DBInstanceIdentifier?: string };
    if (DBInstanceIdentifier) {
      if (returnType === 'name') {
        return DBInstanceIdentifier;
      }
      return `arn:${partition}:rds:${region}:${accountId}:db:${DBInstanceIdentifier}`;
    }
  }

  // Handle AWS::EC2::SecurityGroup
  if (resourceType === 'AWS::EC2::SecurityGroup') {
    const { GroupName } = properties as { GroupName?: string };
    if (GroupName) {
      if (returnType === 'name') {
        return GroupName;
      }
      return GroupName;
    }
  }

  // Handle AWS::IAM::InstanceProfile
  if (resourceType === 'AWS::IAM::InstanceProfile') {
    const { InstanceProfileName, Path } = properties as { InstanceProfileName?: string; Path?: string };
    if (InstanceProfileName) {
      if (returnType === 'name') {
        return InstanceProfileName;
      }
      const path = Path || '/';
      return `arn:${partition}:iam::${accountId}:instance-profile${path}${InstanceProfileName}`;
    }
  }

  // Handle AWS::KMS::Key
  if (resourceType === 'AWS::KMS::Key') {
    const { KeyId } = properties as { KeyId?: string };
    if (KeyId) {
      if (returnType === 'name') {
        return KeyId;
      }
      return `arn:${partition}:kms:${region}:${accountId}:key/${KeyId}`;
    }
  }

  // Handle AWS::SecretsManager::Secret
  if (resourceType === 'AWS::SecretsManager::Secret') {
    const { Name } = properties as { Name?: string };
    if (Name) {
      if (returnType === 'name') {
        return Name;
      }
      return `arn:${partition}:secretsmanager:${region}:${accountId}:secret:${Name}`;
    }
  }

  return null;
}
