export default {
  refNow: [
    {
      name: 'Fn::RefNow resolves injected variable',
      template: {
        BucketName: {
          'Fn::RefNow': 'MyBucket',
        },
      },
      inject: {
        MyBucket: 'my-production-bucket',
      },
      output: {
        BucketName: 'my-production-bucket',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS pseudo-parameter AccountId',
      template: {
        AccountId: {
          'Fn::RefNow': 'AWS::AccountId',
        },
      },
      doEnv: {
        AWS_ACCOUNT_ID: '123456789012',
      },
      output: {
        AccountId: '123456789012',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS pseudo-parameter Region',
      template: {
        Region: {
          'Fn::RefNow': 'AWS::Region',
        },
      },
      doEnv: {
        AWS_REGION: 'eu-west-1',
      },
      output: {
        Region: 'eu-west-1',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS pseudo-parameter StackName',
      template: {
        StackName: {
          'Fn::RefNow': 'AWS::StackName',
        },
      },
      doEnv: {
        AWS_STACK_NAME: 'my-app-stack',
      },
      output: {
        StackName: 'my-app-stack',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS pseudo-parameter Partition',
      template: {
        Partition: {
          'Fn::RefNow': 'AWS::Partition',
        },
      },
      output: {
        Partition: 'aws',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS pseudo-parameter URLSuffix',
      template: {
        URLSuffix: {
          'Fn::RefNow': 'AWS::URLSuffix',
        },
      },
      output: {
        URLSuffix: 'amazonaws.com',
      },
    },
    {
      name: 'Fn::RefNow resolves scope variable',
      template: {
        Value: {
          'Fn::RefNow': 'ScopeVar',
        },
      },
      doEnv: true,
      inject: {
        ScopeVar: 'scope-value-123',
      },
      output: {
        Value: 'scope-value-123',
      },
    },
    {
      name: 'Fn::RefNow prioritizes inject over pseudo-parameters',
      template: {
        Value: {
          'Fn::RefNow': 'AWS::Region',
        },
      },
      inject: {
        'AWS::Region': 'override-region',
      },
      output: {
        Value: 'override-region',
      },
    },
    {
      name: 'Fn::RefNow in array context',
      template: {
        'Fn::Map': [
          ['Bucket1', 'Bucket2'],
          {
            BucketRef: {
              'Fn::RefNow': '_',
            },
          },
        ],
      },
      inject: {
        Bucket1: 'my-bucket-1',
        Bucket2: 'my-bucket-2',
      },
      output: [
        {
          BucketRef: 'my-bucket-1',
        },
        {
          BucketRef: 'my-bucket-2',
        },
      ],
    },
    {
      name: 'Fn::RefNow fails gracefully when reference not found',
      template: {
        Value: {
          'Fn::RefNow': 'NonExistentRef',
        },
      },
      catch: (err) => err.message.includes('Unable to resolve Ref for logical name'),
    },
    {
      name: 'Fn::RefNow with AccountId fallback',
      template: {
        AccountId: {
          'Fn::RefNow': 'AWS::AccountId',
        },
      },
      output: {
        AccountId: '${AWS::AccountId}',
      },
    },
    {
      name: 'Fn::RefNow with multiple references',
      template: {
        Details: {
          Bucket: {
            'Fn::RefNow': 'BucketName',
          },
          Region: {
            'Fn::RefNow': 'AWS::Region',
          },
          Stack: {
            'Fn::RefNow': 'AWS::StackName',
          },
        },
      },
      inject: {
        BucketName: 'data-bucket',
      },
      doEnv: {
        AWS_REGION: 'us-west-2',
        AWS_STACK_NAME: 'my-stack',
      },
      output: {
        Details: {
          Bucket: 'data-bucket',
          Region: 'us-west-2',
          Stack: 'my-stack',
        },
      },
    },
    {
      name: 'Fn::RefNow with numeric value',
      template: {
        InstanceCount: {
          'Fn::RefNow': 'InstanceCount',
        },
      },
      inject: {
        InstanceCount: 5,
      },
      output: {
        InstanceCount: 5,
      },
    },
    {
      name: 'Fn::RefNow with refNowIgnoreMissing option returns Ref syntax',
      template: {
        Value: {
          'Fn::RefNow': 'NonExistentRef',
        },
      },
      refNowIgnoreMissing: true,
      output: {
        Value: {
          Ref: 'NonExistentRef',
        },
      },
    },
    {
      name: 'Fn::RefNow with refNowIgnores array returns Ref syntax for specified refs',
      template: {
        Value1: {
          'Fn::RefNow': 'IgnoredRef1',
        },
        Value2: {
          'Fn::RefNow': 'IgnoredRef2',
        },
      },
      refNowIgnores: ['IgnoredRef1', 'IgnoredRef2'],
      output: {
        Value1: {
          Ref: 'IgnoredRef1',
        },
        Value2: {
          Ref: 'IgnoredRef2',
        },
      },
    },
    {
      name: 'Fn::RefNow with refNowIgnores returns Ref only for matching refs',
      template: {
        IgnoredValue: {
          'Fn::RefNow': 'IgnoredRef',
        },
        ResolvedValue: {
          'Fn::RefNow': 'ExistingRef',
        },
      },
      refNowIgnores: ['IgnoredRef'],
      inject: {
        ExistingRef: 'resolved-value',
      },
      output: {
        IgnoredValue: {
          Ref: 'IgnoredRef',
        },
        ResolvedValue: 'resolved-value',
      },
    },
    {
      name: 'Fn::RefNow with refNowIgnoreMissing and refNowIgnores combined',
      template: {
        Value1: {
          'Fn::RefNow': 'IgnoredRef',
        },
        Value2: {
          'Fn::RefNow': 'NonExistentRef',
        },
      },
      refNowIgnores: ['IgnoredRef'],
      refNowIgnoreMissing: true,
      output: {
        Value1: {
          Ref: 'IgnoredRef',
        },
        Value2: {
          Ref: 'NonExistentRef',
        },
      },
    },
    {
      name: 'Fn::RefNow resolves IAM ManagedPolicy LogicalResourceId to ARN',
      template: {
        Resources: {
          ObjPolicy: {
            Type: 'AWS::IAM::ManagedPolicy',
            Properties: {
              ManagedPolicyName: 'teststack-CreateTestDBPolicy-16M23YE3CS700',
              Path: '/CRAP/',
            },
          },
        },
        PolicyArn: {
          'Fn::RefNow': 'ObjPolicy',
        },
      },
      doEnv: {
        AWS_ACCOUNT_ID: '123456789012',
      },
      output: {
        Resources: {
          ObjPolicy: {
            Type: 'AWS::IAM::ManagedPolicy',
            Properties: {
              ManagedPolicyName: 'teststack-CreateTestDBPolicy-16M23YE3CS700',
              Path: '/CRAP/',
            },
          },
        },
        PolicyArn: 'arn:aws:iam::123456789012:policy/CRAP/teststack-CreateTestDBPolicy-16M23YE3CS700',
      },
    },
    {
      name: 'Fn::RefNow resolves IAM ManagedPolicy with default path to ARN',
      template: {
        Resources: {
          ObjPolicy: {
            Type: 'AWS::IAM::ManagedPolicy',
            Properties: {
              ManagedPolicyName: 'MyPolicy',
            },
          },
        },
        PolicyArn: {
          'Fn::RefNow': 'ObjPolicy',
        },
      },
      doEnv: {
        AWS_ACCOUNT_ID: '123456789012',
      },
      output: {
        Resources: {
          ObjPolicy: {
            Type: 'AWS::IAM::ManagedPolicy',
            Properties: {
              ManagedPolicyName: 'MyPolicy',
            },
          },
        },
        PolicyArn: 'arn:aws:iam::123456789012:policy/MyPolicy',
      },
    },
    {
      name: 'Fn::RefNow with LogicalResourceId ignores missing variable',
      template: {
        Resources: {
          ObjPolicy: {
            Type: 'AWS::IAM::ManagedPolicy',
            Properties: {
              ManagedPolicyName: 'MyPolicy',
            },
          },
        },
        PolicyArn: {
          'Fn::RefNow': 'NonExistent',
        },
      },
      refNowIgnoreMissing: true,
      output: {
        Resources: {
          ObjPolicy: {
            Type: 'AWS::IAM::ManagedPolicy',
            Properties: {
              ManagedPolicyName: 'MyPolicy',
            },
          },
        },
        PolicyArn: {
          Ref: 'NonExistent',
        },
      },
    },
    {
      name: 'Fn::RefNow resolves AWS::IAM::Role to RoleArn',
      template: {
        Resources: {
          MyRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
              RoleName: 'MyLambdaExecutionRole',
              AssumeRolePolicyDocument: {},
            },
          },
        },
        RoleArn: {
          'Fn::RefNow': 'MyRole',
        },
      },
      doEnv: {
        AWS_ACCOUNT_ID: '123456789012',
      },
      output: {
        Resources: {
          MyRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
              RoleName: 'MyLambdaExecutionRole',
              AssumeRolePolicyDocument: {},
            },
          },
        },
        RoleArn: 'arn:aws:iam::123456789012:role/MyLambdaExecutionRole',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS::S3::Bucket to BucketArn',
      template: {
        Resources: {
          MyBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {
              BucketName: 'my-data-bucket',
            },
          },
        },
        BucketArn: {
          'Fn::RefNow': 'MyBucket',
        },
      },
      output: {
        Resources: {
          MyBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {
              BucketName: 'my-data-bucket',
            },
          },
        },
        BucketArn: 'arn:aws:s3:::my-data-bucket',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS::Lambda::Function to FunctionArn',
      template: {
        Resources: {
          MyFunction: {
            Type: 'AWS::Lambda::Function',
            Properties: {
              FunctionName: 'my-processor',
              Runtime: 'nodejs18.x',
              Handler: 'index.handler',
              Code: { S3Bucket: 'bucket', S3Key: 'key' },
            },
          },
        },
        FunctionArn: {
          'Fn::RefNow': 'MyFunction',
        },
      },
      doEnv: {
        AWS_ACCOUNT_ID: '123456789012',
        AWS_REGION: 'us-east-1',
      },
      output: {
        Resources: {
          MyFunction: {
            Type: 'AWS::Lambda::Function',
            Properties: {
              FunctionName: 'my-processor',
              Runtime: 'nodejs18.x',
              Handler: 'index.handler',
              Code: { S3Bucket: 'bucket', S3Key: 'key' },
            },
          },
        },
        FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-processor',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS::SQS::Queue to QueueArn',
      template: {
        Resources: {
          MyQueue: {
            Type: 'AWS::SQS::Queue',
            Properties: {
              QueueName: 'my-queue',
            },
          },
        },
        QueueArn: {
          'Fn::RefNow': 'MyQueue',
        },
      },
      doEnv: {
        AWS_ACCOUNT_ID: '123456789012',
        AWS_REGION: 'us-west-2',
      },
      output: {
        Resources: {
          MyQueue: {
            Type: 'AWS::SQS::Queue',
            Properties: {
              QueueName: 'my-queue',
            },
          },
        },
        QueueArn: 'arn:aws:sqs:us-west-2:123456789012:my-queue',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS::SNS::Topic to TopicArn',
      template: {
        Resources: {
          MyTopic: {
            Type: 'AWS::SNS::Topic',
            Properties: {
              TopicName: 'my-notifications',
            },
          },
        },
        TopicArn: {
          'Fn::RefNow': 'MyTopic',
        },
      },
      doEnv: {
        AWS_ACCOUNT_ID: '123456789012',
        AWS_REGION: 'eu-west-1',
      },
      output: {
        Resources: {
          MyTopic: {
            Type: 'AWS::SNS::Topic',
            Properties: {
              TopicName: 'my-notifications',
            },
          },
        },
        TopicArn: 'arn:aws:sns:eu-west-1:123456789012:my-notifications',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS::DynamoDB::Table to TableArn',
      template: {
        Resources: {
          MyTable: {
            Type: 'AWS::DynamoDB::Table',
            Properties: {
              TableName: 'users-table',
              AttributeDefinitions: [],
              KeySchema: [],
              BillingMode: 'PAY_PER_REQUEST',
            },
          },
        },
        TableArn: {
          'Fn::RefNow': 'MyTable',
        },
      },
      doEnv: {
        AWS_ACCOUNT_ID: '123456789012',
        AWS_REGION: 'us-east-1',
      },
      output: {
        Resources: {
          MyTable: {
            Type: 'AWS::DynamoDB::Table',
            Properties: {
              TableName: 'users-table',
              AttributeDefinitions: [],
              KeySchema: [],
              BillingMode: 'PAY_PER_REQUEST',
            },
          },
        },
        TableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/users-table',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS::RDS::DBInstance to DBInstanceArn',
      template: {
        Resources: {
          MyDB: {
            Type: 'AWS::RDS::DBInstance',
            Properties: {
              DBInstanceIdentifier: 'mydb-instance',
              DBInstanceClass: 'db.t3.micro',
              Engine: 'mysql',
            },
          },
        },
        DBArn: {
          'Fn::RefNow': 'MyDB',
        },
      },
      doEnv: {
        AWS_ACCOUNT_ID: '123456789012',
        AWS_REGION: 'us-east-1',
      },
      output: {
        Resources: {
          MyDB: {
            Type: 'AWS::RDS::DBInstance',
            Properties: {
              DBInstanceIdentifier: 'mydb-instance',
              DBInstanceClass: 'db.t3.micro',
              Engine: 'mysql',
            },
          },
        },
        DBArn: 'arn:aws:rds:us-east-1:123456789012:db:mydb-instance',
      },
    },
    {
      name: 'Fn::RefNow with key ending in Name returns resource name instead of ARN',
      template: {
        Resources: {
          MyRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
              RoleName: 'MyExecutionRole',
              AssumeRolePolicyDocument: {},
            },
          },
        },
        RoleName: {
          'Fn::RefNow': 'MyRole',
        },
      },
      output: {
        Resources: {
          MyRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
              RoleName: 'MyExecutionRole',
              AssumeRolePolicyDocument: {},
            },
          },
        },
        RoleName: 'MyExecutionRole',
      },
    },
    {
      name: 'Fn::RefNow with BucketName key returns bucket name',
      template: {
        Resources: {
          MyBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {
              BucketName: 'my-bucket-2024',
            },
          },
        },
        BucketName: {
          'Fn::RefNow': 'MyBucket',
        },
      },
      output: {
        Resources: {
          MyBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {
              BucketName: 'my-bucket-2024',
            },
          },
        },
        BucketName: 'my-bucket-2024',
      },
    },
    {
      name: 'Fn::RefNow with FunctionName key returns function name',
      template: {
        Resources: {
          MyFunction: {
            Type: 'AWS::Lambda::Function',
            Properties: {
              FunctionName: 'my-lambda-processor',
              Runtime: 'nodejs18.x',
              Handler: 'index.handler',
              Code: { S3Bucket: 'bucket', S3Key: 'key' },
            },
          },
        },
        FunctionName: {
          'Fn::RefNow': 'MyFunction',
        },
      },
      output: {
        Resources: {
          MyFunction: {
            Type: 'AWS::Lambda::Function',
            Properties: {
              FunctionName: 'my-lambda-processor',
              Runtime: 'nodejs18.x',
              Handler: 'index.handler',
              Code: { S3Bucket: 'bucket', S3Key: 'key' },
            },
          },
        },
        FunctionName: 'my-lambda-processor',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS::IAM::InstanceProfile to InstanceProfileArn',
      template: {
        Resources: {
          MyInstanceProfile: {
            Type: 'AWS::IAM::InstanceProfile',
            Properties: {
              InstanceProfileName: 'EC2RoleProfile',
            },
          },
        },
        InstanceProfileArn: {
          'Fn::RefNow': 'MyInstanceProfile',
        },
      },
      doEnv: {
        AWS_ACCOUNT_ID: '123456789012',
      },
      output: {
        Resources: {
          MyInstanceProfile: {
            Type: 'AWS::IAM::InstanceProfile',
            Properties: {
              InstanceProfileName: 'EC2RoleProfile',
            },
          },
        },
        InstanceProfileArn: 'arn:aws:iam::123456789012:instance-profile/EC2RoleProfile',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS::SecretsManager::Secret to SecretArn',
      template: {
        Resources: {
          MySecret: {
            Type: 'AWS::SecretsManager::Secret',
            Properties: {
              Name: 'my-app-secret',
            },
          },
        },
        SecretArn: {
          'Fn::RefNow': 'MySecret',
        },
      },
      doEnv: {
        AWS_ACCOUNT_ID: '123456789012',
        AWS_REGION: 'us-east-1',
      },
      output: {
        Resources: {
          MySecret: {
            Type: 'AWS::SecretsManager::Secret',
            Properties: {
              Name: 'my-app-secret',
            },
          },
        },
        SecretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-app-secret',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS::IAM::Role with Path to RoleArn',
      template: {
        Resources: {
          MyRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
              RoleName: 'MyExecutionRole',
              Path: '/service/',
              AssumeRolePolicyDocument: {},
            },
          },
        },
        RoleArn: {
          'Fn::RefNow': 'MyRole',
        },
      },
      doEnv: {
        AWS_ACCOUNT_ID: '123456789012',
      },
      output: {
        Resources: {
          MyRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
              RoleName: 'MyExecutionRole',
              Path: '/service/',
              AssumeRolePolicyDocument: {},
            },
          },
        },
        RoleArn: 'arn:aws:iam::123456789012:role/service/MyExecutionRole',
      },
    },
    {
      name: 'Fn::RefNow resolves AWS::IAM::InstanceProfile with Path to InstanceProfileArn',
      template: {
        Resources: {
          MyInstanceProfile: {
            Type: 'AWS::IAM::InstanceProfile',
            Properties: {
              InstanceProfileName: 'EC2RoleProfile',
              Path: '/apps/',
            },
          },
        },
        InstanceProfileArn: {
          'Fn::RefNow': 'MyInstanceProfile',
        },
      },
      doEnv: {
        AWS_ACCOUNT_ID: '123456789012',
      },
      output: {
        Resources: {
          MyInstanceProfile: {
            Type: 'AWS::IAM::InstanceProfile',
            Properties: {
              InstanceProfileName: 'EC2RoleProfile',
              Path: '/apps/',
            },
          },
        },
        InstanceProfileArn: 'arn:aws:iam::123456789012:instance-profile/apps/EC2RoleProfile',
      },
    },
  ],
};
