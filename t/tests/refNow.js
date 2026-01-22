module.exports = {
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
  ],
};
