import assert from 'node:assert';

const synopsis = {
  AWSTemplateFormatVersion: '2010-09-09',
  Mappings: {},
  Resources: {
    Instance: {
      Type: 'AWS::EC2::Instance',
      Properties: {
        ImageId: {
          'Fn::FindInMap': [
            'Region2AMI',
            {
              Ref: 'AWS::Region',
            },
            'AMI',
          ],
        },
        UserData: {
          'Fn::Base64': {
            'Fn::Sub': {
              'Fn::Join': [
                '',
                [
                  '#!/bin/bash\n',
                  '"/opt/aws/bin/cfn-init -s ${AWS::StackId} -r MyInstance --region ${AWS::Region}\n',
                  '',
                ],
              ],
            },
          },
        },
      },
    },
  },
};

export default {
  yaml: [
    {
      name: 'tags',
      template: {
        'Fn::Include': 'includes/yaml/fnsub.yml',
      },
      output: {
        Resources: { Foo: 'bar' },
      },
    },
    {
      name: 'synopsis',
      template: {
        'Fn::Include': 'includes/synopsis.yml',
      },
      output(res) {
        delete res.Mappings.Region2AMI;
        assert.deepEqual(res, synopsis);
        return true;
      },
    },
    {
      // YAML 1.1 merge keys (`<<:`) — regression guard for the js-yaml 4→5
      // upgrade, where v5's CORE_SCHEMA dropped merge-key resolution.
      name: 'merge keys',
      template: {
        'Fn::Include': 'includes/yaml/merge-keys.yml',
      },
      output: {
        Defaults: { InstanceType: 't3.micro', Monitoring: true },
        Overrides: { Monitoring: false, EbsOptimized: true },
        Single: { InstanceType: 't3.micro', Monitoring: true, Name: 'single' },
        Multi: {
          InstanceType: 't3.micro',
          Monitoring: true,
          EbsOptimized: true,
          Name: 'multi',
        },
        Precedence: { InstanceType: 'm5.large', Monitoring: true },
      },
    },
    {
      name: 'yaml tags',
      template: {
        'Fn::Include': 'includes/yaml/tags.yml',
      },
      output: {
        Sub: {
          scalar: {
            'Fn::Sub': '${Foobar}',
          },
          sequence: {
            'Fn::Sub': ['foobar', { test: 123 }],
          },
        },
        Split: {
          sequence: {
            'Fn::Split': ['', 'foo bar'],
          },
        },
        GetAtt: {
          sequence: {
            'Fn::GetAtt': ['Foo', 'Bar'],
          },
          scalar: {
            'Fn::GetAtt': ['Foo', 'Bar'],
          },
          scalarDeep: {
            'Fn::GetAtt': ['Foo', 'Bar.Baz'],
          },
          scalarSingle: {
            'Fn::GetAtt': ['Foobar'],
          },
        },
      },
    },
  ],
};
