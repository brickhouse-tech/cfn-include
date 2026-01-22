function getAwsPseudoParameters() {
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

/**
 * Build an ARN for a CloudFormation resource based on its Type and Properties
 * Supports both ARN construction and property name resolution
 * @param {string} resourceType - The CloudFormation resource type (e.g., 'AWS::IAM::ManagedPolicy')
 * @param {object} properties - The resource properties
 * @param {object} pseudoParams - AWS pseudo-parameters including AccountId, Region
 * @param {object} options - Optional configuration
 * @param {string} options.returnType - 'arn' (default) or 'name' to return the resource name/identifier
 * @returns {string|null} - The ARN, name, or null if not applicable
 */
function buildResourceArn(resourceType, properties = {}, pseudoParams = {}, options = {}) {
  const accountId = pseudoParams['AWS::AccountId'] || '${AWS::AccountId}';
  const region = pseudoParams['AWS::Region'] || '${AWS::Region}';
  const partition = pseudoParams['AWS::Partition'] || 'aws';
  const returnType = options.returnType || 'arn';

  // Handle AWS::IAM::ManagedPolicy
  if (resourceType === 'AWS::IAM::ManagedPolicy') {
    const { ManagedPolicyName, Path } = properties;
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
    const { RoleName, Path } = properties;
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
    const { BucketName } = properties;
    if (BucketName) {
      if (returnType === 'name') {
        return BucketName;
      }
      return `arn:${partition}:s3:::${BucketName}`;
    }
  }

  // Handle AWS::Lambda::Function
  if (resourceType === 'AWS::Lambda::Function') {
    const { FunctionName } = properties;
    if (FunctionName) {
      if (returnType === 'name') {
        return FunctionName;
      }
      return `arn:${partition}:lambda:${region}:${accountId}:function:${FunctionName}`;
    }
  }

  // Handle AWS::SQS::Queue
  if (resourceType === 'AWS::SQS::Queue') {
    const { QueueName } = properties;
    if (QueueName) {
      if (returnType === 'name') {
        return QueueName;
      }
      return `arn:${partition}:sqs:${region}:${accountId}:${QueueName}`;
    }
  }

  // Handle AWS::SNS::Topic
  if (resourceType === 'AWS::SNS::Topic') {
    const { TopicName } = properties;
    if (TopicName) {
      if (returnType === 'name') {
        return TopicName;
      }
      return `arn:${partition}:sns:${region}:${accountId}:${TopicName}`;
    }
  }

  // Handle AWS::DynamoDB::Table
  if (resourceType === 'AWS::DynamoDB::Table') {
    const { TableName } = properties;
    if (TableName) {
      if (returnType === 'name') {
        return TableName;
      }
      return `arn:${partition}:dynamodb:${region}:${accountId}:table/${TableName}`;
    }
  }

  // Handle AWS::RDS::DBInstance
  if (resourceType === 'AWS::RDS::DBInstance') {
    const { DBInstanceIdentifier } = properties;
    if (DBInstanceIdentifier) {
      if (returnType === 'name') {
        return DBInstanceIdentifier;
      }
      return `arn:${partition}:rds:${region}:${accountId}:db:${DBInstanceIdentifier}`;
    }
  }

  // Handle AWS::EC2::SecurityGroup
  if (resourceType === 'AWS::EC2::SecurityGroup') {
    const { GroupName } = properties;
    if (GroupName) {
      if (returnType === 'name') {
        return GroupName;
      }
      // Security groups need to be referenced by ID in most cases, not ARN
      // This returns the name for reference purposes
      return GroupName;
    }
  }

  // Handle AWS::IAM::InstanceProfile
  if (resourceType === 'AWS::IAM::InstanceProfile') {
    const { InstanceProfileName, Path } = properties;
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
    // KMS keys are referenced by KeyId or KeyArn in properties
    const { KeyId } = properties;
    if (KeyId) {
      if (returnType === 'name') {
        return KeyId;
      }
      return `arn:${partition}:kms:${region}:${accountId}:key/${KeyId}`;
    }
  }

  // Handle AWS::SecretsManager::Secret
  if (resourceType === 'AWS::SecretsManager::Secret') {
    const { Name } = properties;
    if (Name) {
      if (returnType === 'name') {
        return Name;
      }
      return `arn:${partition}:secretsmanager:${region}:${accountId}:secret:${Name}`;
    }
  }

  // Add more resource types as needed
  return null;
}

module.exports = {
  getAwsPseudoParameters,
  buildResourceArn,
};
