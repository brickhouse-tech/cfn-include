# cfn-include

`cfn-include` is a preprocessor for CloudFormation templates which extends CloudFormation's [intrinsic functions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference.html).
For example, [`Fn::Include`](#fninclude) provides a convenient way to include files, which can be local, a URL or on an S3 bucket (with proper IAM authentication if necessary). It supports both JSON and YAML as input and output format. CloudFormation's tag syntax for YAML (e.g. `!GetAtt`) is supported as well.

`cfn-include` tries to be minimally invasive, meaning that the template will still look and feel like an ordinary CloudFormation template. This is what sets `cfn-include` apart from other CloudFormation preprocessors such as [CFNDSL](https://github.com/stevenjack/cfndsl), [StackFormation](https://github.com/AOEpeople/StackFormation) and [AWSBoxen](https://github.com/mozilla/awsboxen). There is no need to use a scripting language or adjust to new syntax. Check them out though, they might be a better fit for you.

**Functions**
- [cfn-include](#cfn-include)
  - [Installation](#installation)
  - [Synopsis](#synopsis)
    - [CLI](#cli)
    - [Example](#example)
  - [Fn::Include](#fninclude)
    - [Examples](#examples)
      - [Include a file from a URL](#include-a-file-from-a-url)
      - [Include a file in the same folder](#include-a-file-in-the-same-folder)
      - [Include an AWS API response](#include-an-aws-api-response)
      - [Include Globs](#include-globs)
      - [Include Inject State](#include-inject-state)
  - [Fn::Map](#fnmap)
  - [Fn::Flatten](#fnflatten)
  - [Fn::FlattenDeep](#fnflattendeep)
  - [Fn::GetEnv](#fngetenv)
  - [Fn::Length](#fnlength)
  - [Fn::Merge](#fnmerge)
  - [Fn::DeepMerge](#fndeepmerge)
  - [Fn::Sequence](#fnsequence)
  - [Fn::Stringify](#fnstringify)
  - [Fn::Uniq](#fnuniq)
  - [Fn::Compact](#fncompact)
  - [Fn::Concat](#fnconcat)
  - [Fn::Sort](#fnsort)
  - [Fn::SortedUniq](#fnsorteduniq)
  - [Fn::SortBy](#fnsortby)
  - [Fn::SortObject](#fnsortobject)
  - [Fn::ObjectKeys](#fnobjectkeys)
  - [Fn::ObjectValues](#fnobjectvalues)
  - [Fn::Filenames](#fnfilenames)
  - [Fn::StringSplit](#fnstringsplit)
  - [Fn::Without](#fnwithout)
  - [Fn::Omit](#fnomit)
  - [Fn::OmitEmpty](#fnomitempty)
  - [Fn::Eval](#fneval)
  - [Fn::IfEval](#fnifeval)
  - [Fn::JoinNow](#fnjoinnow)
  - [Fn::SubNow](#fsubnow)
  - [Fn::RefNow](#frefnow)
  - [Fn::ApplyTags](#fnapplytags)
  - [Fn::Outputs](#fnoutputs)
  - [More Examples](#more-examples)
  - [Proxy Support](#proxy-support)
  - [Compatibility](#compatibility)
  - [Web Service](#web-service)

Tag-based syntax is available in YAML templates. For example,`Fn::Include` becomes `!Include`.

## Installation

You can either install `cfn-include` or use a web service to compile templates.

```
npm install --global @znemz/cfn-include
```

The web service can be called with your favorite CLI tool such as `curl`.

```
curl https://api.netcubed.de/latest/template -XPOST -d @template.json
```

## Synopsis

### CLI

    cfn-include <path> [options]

- `path`

  location of template. Either path to a local file, URL or file on an S3 bucket (e.g. `s3://bucket-name/example.template`)

Options:

* `-m, --minimize`   minimize JSON output  [false]
* `--metadata`       add build metadata to output  [false]
* `-t, --validate`   validate compiled template  [false]
* `-y, --yaml`       output yaml instead of json  [false]
* `--bucket`         bucket name required for templates larger than 50k
* `--prefix`         prefix for templates uploaded to the bucket ['cfn-include']
* `--version`        print version and exit
* `--context`        template full path. only utilized for stdin when the template is piped to this script
  example:          `cat examples/base.template | cfn-include --context examples/base.template`
* `--enable`         different options / toggles: ['env','eval']    [string] [choices: 'env','eval','env.eval' etc...]
  * `env` pre-process env vars and inject into templates as they are processed looks for $KEY or ${KEY} matches
* `-i, --inject`     JSON string payload to use for template injection. (Takes precedence over process.env (if enabled) injection and will be merged on top of process.env)
* `--doLog`          console log out include options in recurse step. Shows caller parameter to aid debugging nested function calls.
* `--ref-now-ignore-missing`    do not fail if `Fn::RefNow` reference cannot be resolved; instead return in standard CloudFormation `Ref` syntax
* `--ref-now-ignores <names>`   comma-separated list of reference names to ignore if not found (e.g., `OptionalRef1,OptionalRef2`)
`cfn-include` also accepts a template passed from stdin

```
cat mytemplate.yml | cfn-include
```

### Example

```yaml
Mappings:
  Region2AMI: !Include https://api.netcubed.de/latest/ami/lookup?platform=amzn2
Resources:
  Instance:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: !FindInMap [Region2AMI, !Ref AWS::Region, AMI]
      UserData:
        Fn::Base64:
          Fn::Sub: !Include { type: string, location: userdata.sh }
```

This is what the `userdata.sh` looks like:

```bash
#!/bin/bash
/opt/aws/bin/cfn-init -s ${AWS::StackId} -r MyInstance --region ${AWS::Region}
```

```bash
cfn-include synopsis.json > output.template
# you can also compile remote files
cfn-include https://raw.githubusercontent.com/nmccready/cfn-include/master/examples/synopsis.json > output.template
```

The output will be something like this:

```javascript
{
  "AWSTemplateFormatVersion": "2010-09-09",
  "Mappings": {
    "Region2AMI": {
      "Metadata": {
        "Name": "amzn-ami-hvm-2016.09.0.20161028-x86_64-gp2",
        "Owner": "amazon",
        "CreationDate": "2016-10-29T00:49:47.000Z"
      },
      "us-east-2": {
        "AMI": "ami-58277d3d"
      },
      // ...
  } },
  "Resources": {
    "Instance": {
      "Type": "AWS::EC2::Instance",
      "Properties": {
        "ImageId": {
          "FindInMap": [ "Region2AMI", { "Ref": "AWS::Region" }, "AMI" ]
        },
        "UserData": {
          "Fn::Base64": {
            "Fn::Sub": {
              "Fn::Join": ["", [
                  "#!/bin/bash\n",
                  "\"/opt/aws/bin/cfn-init -s ${AWS::StackId} -r MyInstance --region ${AWS::Region}\n",
                  ""
] ] } } } } } } }
```

## Fn::Include

Place `Fn::Include` anywhere in the template and it will be replaced by the contents it is referring to. The function accepts an object. Parameters are:

- **location**: The location to the file can be relative or absolute. A relative location is interpreted relative to the template. Included files can in turn include more files, i.e. recursion is supported.
- **ignoreMissingVar**: If set to `true` the function will not throw an error if a variable is not found (unset). Instead, the variable will be replaced by an empty string. Defaults to `false`.
- **ignoreMissingFile**: If set to `true` the function will not throw an error if the file is not found. Instead, the function will be replaced by an empty string. Defaults to `false`.
- **type** (optional): either `json`, `string` or `api`. Defaults to `json`. `string` will include the file literally which is useful in combination with `Fn::Sub`. `api` will call any AWS API and return the response which can be included in the template. Choose `json` for both JSON and YAML files. The `literal` type is deprecated and uses the infamous `Fn::Join` syntax.
- **context** (optional, deprecated): If `type` is `literal` a context object with variables can be provided. The object can contain plain values or references to parameters or resources in the CloudFormation template (e.g. `{ "Ref": "StackId" }`). Use Mustache like syntax in the file. This option is deprecated in favor of the `Fn::Sub` syntax (see examples below).
- **parser** (optional):
  - string: default is `"jmespath"`
  - object `{location, query, parser}`: default is `"jmespath"`
  - array: `[location, query, parser]`: default is `"lodash"`
  - string (split |) `location|query|parser`: default is `"lodash"`
- **query** (optional): If `type` is `json`, `array`, or `string split |`
  - [JMESPath](http://jmespath.org/) query can be provided. The file to include is then queried using the value as a JMESPath expression.
  - [Lodash _.get](https://lodash.com/docs/4.17.15#get) query

Only applicable if **type** is `api`:

- **service**: Service to call (see [AWSJavaScriptSDK](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/index.html), case sensitive, e.g. `EC2`, `CloudFormation`)
- **action**: Action to call (case sensitive, e.g. `updateStack`, `describeRegions`)
- **parameters** (optional): Parameters passed to **action** (e.g. `{ StackName: "MyStack" }`)
- **region** (optional): Either `AWS_DEFAULT_REGION` or this parameter have to be set which specifies the region where the API call is made.
You can also use a plain string if you want the default behavior, which is simply including a JSON file.
- **isGlob** (optional): Forces the usage of [glob](https://www.npmjs.com/package/glob) to spit out an array of includes
- **inject** (optional): Pass in localized env / options to be injected into a template

### Examples

#### Include via Query

```yaml
# all equivalent
Fn::Include:
  location: ./t/includes/complex.json
  query: bulb[1].c

Fn::Include:
  location: ./t/includes/complex.json
  query: bulb.1.c
  parser: lodash

# Array parser is lodash
Fn::Include: [./t/includes/complex.json, bulb.1.c]

# Array default parser is lodash
Fn::Include:
  - ./t/includes/complex.json
  - bulb.1.c

# string split "|" default  parser is lodash
Fn::Include: ./t/includes/complex.json|bulb.1.c
```

#### Include a file from a URL

```yaml
!Include https://example.com/include.json

// equivalent to

Fn::Include:
  type: json
  location: https://example.com/include.json
```

Include a file from an S3 bucket. Authentication is handled by `aws-sdk`. See [Setting AWS Credentials](https://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html#Setting_AWS_Credentials) for details.

```yaml
!Include s3://bucket-name/include1.json
```

#### Include a file in the same folder

```yaml
!Include include.json
```

Include a file literally and make use of `Fn::Sub`:

```yaml
Fn::Sub:
  Fn::Include:
    type: string
    location: https://example.com/userdata.txt
```

#### Include an AWS API response

IE: loop through all regions and return the image id of a specific AMI:

```yaml
Fn::Merge:
  Fn::Map:
    - Fn::Include:
        action: describeRegions
        query: "Regions[*].RegionName[]"
        service: EC2
        type: api
    - _:
        AMI:
          Fn::Include:
            action: describeImages
            parameters:
              Filters:
                - Name: manifest-location
                  Values:
                    - amazon/amzn-ami-hvm-2016.03.3.x86_64-gp2
            query: "Images[*].ImageId | [0]"
            region: _
            service: EC2
            type: api
```

Output as JSON:

```json
{ "ap-south-1": { "AMI": "ami-ffbdd790" },
  "eu-west-1": {"AMI": "ami-f9dd458a" },
  "ap-southeast-1": { "AMI": "ami-a59b49c6" },
  ...
}
```

#### Include Globs

Essentially imagine if you had several yaml or json files you wanted to include.

```
./src/
  files/
    - one.yml
    - two.yml
    - three.yml
    - four.yml
  main.yml
```

Before Glob you would have to do:

main.yml

```yml
Fn::Map:
  - [one, two, three]
  - [FILE]
  - Fn::Include: ./files/${FILE}.yml
```

With Glob

main.yml

```yml
Fn::Include: ./files/*.yml
```

or (say you need to ignore something)

```yml
Fn::Include:
  location: ./files/!(four).yml
  isGlob: true
```

#### Include Inject State

This feature uses the exact same logic as doEnv in that all env variables are traversed and replaced however this is
with localized state for the included file.

File to inject to:

`toInject.yml` - your include file

```yml
SomeResource:
  Name: ${LOCALIZED_NAME}
```

Consume it and add some custom state

```yml
Fn::Include:
  location: ./toInject.yml
  inject:
    LOCALIZED_NAME: CustomName
```

yields

```yml
SomeResource:
  Name: CustomName
```

## Fn::Map

`Fn::Map` is the equivalent of the lodash [`map()`](https://lodash.com/docs/4.17.15#map) function allowing for the transformation of an input array or object to an output array.
By default the string `_` is used as the variable in the map function. A custom variable can be provided as a second parameter, see [`Fn::Flatten`](#fnflatten) for an example. If a custom variable is used, the variable will also be replaced if found in the object key, see [`Fn::Merge`](#fnmerge) for an example.

```yaml
Fn::Map:
  - [80, 443]
  - CidrIp: 0.0.0.0/0
    FromPort: _
    ToPort: _
    IpProtocol: tcp
```

```json
[
  {
    "CidrIp": "0.0.0.0/0",
    "FromPort": "80",
    "ToPort": "80"
  },
  {
    "CidrIp": "0.0.0.0/0",
    "FromPort": "443",
    "ToPort": "443"
  }
]
```

Custom variables can be specified as a single value, of as a list of up to three values. If a list is specified, the second variable is used as index and the third (if present) as size.

```yaml
Fn::Map:
  - !Sequence [A, C]
  - [NET, INDEX, N]
  - Subnet${NET}:
      Type: 'AWS::EC2::Subnet'
      Properties:
        CidrBlock: !Select [INDEX, !Cidr [MyCIDR, N, 8]]
```

```json
[{
  "SubnetA": {
    "Type": "AWS::EC2::Subnet",
    "Properties": {
      "CidrBlock": { "Fn::Select": [ 0, { "Fn::Cidr": [ "MyCIDR", 3, 8 ] } ] }
    }
  }
}, {
  "SubnetB": {
    "Type": "AWS::EC2::Subnet",
    "Properties": {
      "CidrBlock": { "Fn::Select": [ 1, { "Fn::Cidr": [ "MyCIDR", 3, 8 ] } ] }
    }
  }
}, {
  "SubnetC": {
    "Type": "AWS::EC2::Subnet",
    "Properties": {
      "CidrBlock": { "Fn::Select": [ 2, { "Fn::Cidr": [ "MyCIDR", 3, 8 ] } ] }
    }
  }
}]
```


## Fn::Flatten

This function flattens an array a single level. This is useful for flattening out nested [`Fn::Map`](#fnmap) calls.

```yaml
SecurityGroupIngress:
  Fn::Flatten:
    Fn::Map:
      - [80, 443]
      - $
      - Fn::Map:
          - [10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16]
          - CidrIp: _
            FromPort: $
            ToPort: $
            IpProtocol: tcp
```

Results in:

```json
{
  "SecurityGroupIngress": [
    {
      "CidrIp": "10.0.0.0/8",
      "FromPort": "80",
      "ToPort": "80",
      "IpProtocol": "tcp"
    },
    {
      "CidrIp": "172.16.0.0/12",
      "FromPort": "80",
      "ToPort": "80",
      "IpProtocol": "tcp"
    },
    {
      "CidrIp": "192.168.0.0/16",
      "FromPort": "80",
      "ToPort": "80",
      "IpProtocol": "tcp"
    },
    {
      "CidrIp": "10.0.0.0/8",
      "FromPort": "443",
      "ToPort": "443",
      "IpProtocol": "tcp"
    },
    {
      "CidrIp": "172.16.0.0/12",
      "FromPort": "443",
      "ToPort": "443",
      "IpProtocol": "tcp"
    },
    {
      "CidrIp": "192.168.0.0/16",
      "FromPort": "443",
      "ToPort": "443",
      "IpProtocol": "tcp"
    }
  ]
}
```

## Fn::FlattenDeep

This function flattens an array as many levels as possible. This is useful for flattening out nested [`Fn::Map`](#fnmap) calls.

```yaml
SecurityGroupIngress:
  Fn::FlattenDeep:
    Fn::Map:
      - [80, 443]
      - $
      - Fn::Map:
          - [10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16]
          - Fn::Map:
              - [tcp, udp]
              - PROTOCOL
              - CidrIp: _
                FromPort: $
                ToPort: $
                IpProtocol: PROTOCOL
```

Results in:

```json
{
  "SecurityGroupIngress": [
    {
      "CidrIp": "10.0.0.0/8",
      "FromPort": "80",
      "ToPort": "80",
      "IpProtocol": "tcp"
    },
    {
      "CidrIp": "10.0.0.0/8",
      "FromPort": "80",
      "ToPort": "80",
      "IpProtocol": "udp"
    },
    {
      "CidrIp": "172.16.0.0/12",
      "FromPort": "80",
      "ToPort": "80",
      "IpProtocol": "tcp"
    },
    {
      "CidrIp": "172.16.0.0/12",
      "FromPort": "80",
      "ToPort": "80",
      "IpProtocol": "udp"
    },
    {
      "CidrIp": "192.168.0.0/16",
      "FromPort": "80",
      "ToPort": "80",
      "IpProtocol": "tcp"
    },
    {
      "CidrIp": "192.168.0.0/16",
      "FromPort": "80",
      "ToPort": "80",
      "IpProtocol": "udp"
    },
    {
      "CidrIp": "10.0.0.0/8",
      "FromPort": "443",
      "ToPort": "443",
      "IpProtocol": "tcp"
    },
    {
      "CidrIp": "10.0.0.0/8",
      "FromPort": "443",
      "ToPort": "443",
      "IpProtocol": "udp"
    },
    {
      "CidrIp": "172.16.0.0/12",
      "FromPort": "443",
      "ToPort": "443",
      "IpProtocol": "tcp"
    },
    {
      "CidrIp": "172.16.0.0/12",
      "FromPort": "443",
      "ToPort": "443",
      "IpProtocol": "udp"
    },
    {
      "CidrIp": "192.168.0.0/16",
      "FromPort": "443",
      "ToPort": "443",
      "IpProtocol": "tcp"
    },
    {
      "CidrIp": "192.168.0.0/16",
      "FromPort": "443",
      "ToPort": "443",
      "IpProtocol": "udp"
    }
  ]
}
```

## Fn::GetEnv

```yaml
Resources:
  Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !GetEnv [BUCKET_NAME, !Ref AWS::NoValue]
```

The second argument is optional and provides the default value and will be used of the environmental variable is not defined. If the second argument is omitted `!GetEnv BUCKET_NAME` and the environmental variable is not defined then the compilation will fail.

## Fn::Length

`Fn::Length` returns the length of a list or expanded section.


## Fn::Merge

`Fn::Merge` will merge an array of objects into a single object. See [lodash / merge](https://devdocs.io/lodash~4/index#merge) for details on its behavior. This function is useful if you want to add functionality to an existing template if you want to merge objects of your template that have been created with [`Fn::Map`](#fnmap).

`Fn::Merge` accepts a list of objects that will be merged together. You can use other `cfn-include` functions such as `Fn::Include` to pull in template from remote locations such as S3 buckets.

```yaml
Fn::Merge:
  - !Include s3://my-templates/my-template.json

  - !Include s3://my-templates/my-other-template.json

  - Parameters:
      MyCustomParameter:
        Type: String

    Resources:
      MyBucket:
        Type: AWS::S3::Bucket
```

## Fn::DeepMerge

`Fn::DeepMerge` will deeply merge an array of objects and arrays into a single object. See [deepmerge](https://www.npmjs.com/package/deepmerge) for details on its behavior. This function is useful if you want to add functionality to an existing template if you want to merge objects of your template that have been created with [`Fn::Map`](#fnmap).

`Fn::DeepMerge` accepts a list of objects that will be merged together. You can use other `cfn-include` functions such as `Fn::Include` to pull in template from remote locations such as S3 buckets.

To understand it better besides the below example refer to this [test](t/tests/deepmerge.yml). Note that all arrays are concatenated.

Why does `Fn::Merge` still exist? Answer: Backwards compatibility for expected behavior.

```yaml
Fn::DeepMerge:
  - !Include s3://my-templates/my-template.json

  - !Include s3://my-templates/my-other-template.json

  - Parameters:
      MyCustomParameter:
        Type: String

    Resources:
      MyBucket:
        Type: AWS::S3::Bucket
```

This snippet shows how multiple subnets can be created for each AZ and then merged with the rest of the template.

```yaml
Resources:
  IAMUser:
    Type: AWS::IAM::User
  SecurityGroup:
    Type: AWS::EC2::SecurityGroup
  Fn::Merge:
    Fn::Map:
      - [A, B]
      - AZ
      - Subnet${AZ}:
          Type: AWS::EC2::Subnet
```

```json
{
  "Resources": {
    "SubnetA": {
      "Type": "AWS::EC2::Subnet"
    },
    "SubnetB": {
      "Type": "AWS::EC2::Subnet"
    },
    "SG": {
      "Type": "AWS::EC2::SecurityGroup"
    }
  }
}
```

## Fn::Sequence

`Fn::Sequence` generates a sequence of numbers of characters. You can specify the start, end and step.

```yaml
!Sequence [1, 4]

# generates
[1, 2, 3 4]

!Sequence [1, 10, 2]

# generates
[1, 3, 5, 7, 9]

!Sequence [a, d]

# generates
[a, b, c, d]
```

`Fn::Sequence` can be used in combination with `Fn::Map` to generate complex objects:

```
Fn::Map:
  - !Sequence [a, c]
  - AZ
  - Subnet${AZ}:
      Type: AWS::EC2::Subnet
```

## Fn::Stringify

`Fn::Stringify` will take the passed value and transform it to a JSON string. This is useful for parameters that require a JSON document as a string. Using this function, you can keep writing your configuration in YAML and let the function transform it into a JSON string.

Another useful application is the use of this function in a config file passed as `--cli-input-json` parameter.

```yaml
# stack.config.yml

StackName: MyStack

TemplateBody:
  Fn::Stringify: !Include mytemplate.yml

Parameters:
  - ParameterKey: Foo
    ParameterValue: Bar
```

You can then simply run the following command to deploy a stack:

```
cfn-include stack.config.yml > stack.config.json
aws cloudformation create-stack --cli-input-json file://stack.config.json
```

## Fn::Uniq

This function filters only the unique elements of an array

```yaml
SecurityGroupIngress:
  Fn::Uniq:
    Fn::Flatten:
      - [1, 2]
      - [3, 4]
      - [1, 4, 6]
```

Results in:

```json
{
  "SecurityGroupIngress": [
    1,
    2,
    3,
    4,
    6
  ]
}
```

## Fn::Compact

This function removes falsy elements same as [lodash](https://lodash.com/docs/4.17.15#compact)

```yaml
SecurityGroupIngress:
  Fn::Compact:
    - 1
    - a
    - ""
    - false
    - true
```

Results in:

```json
{
  "SecurityGroupIngress": [
    1,
    "a",
    true
  ]
}
```

## Fn::Concat

_.concat

```yaml
Fn::Concat:
  - [a, b, c]
  - d
```

Results in:

```json
[
  "a",
  "b",
  "c",
  "d"
]
```

## Fn::Sort

`$ cfn-include [examples/sort.yaml](examples/sort.yaml)`

```json
[
  1,
  20,
  22,
  30,
  30,
  33.3,
  40,
  5.5,
  50,
  50
]
```

## Fn::SortedUniq

`$ cfn-include [examples/sortedUniq.yaml](examples/sortedUniq.yaml)`

```json
[
  1,
  20,
  22,
  30,
  33.3,
  40,
  5.5,
  50
]
```

## Fn::SortBy

`$ cfn-include [examples/sortBy.yaml](examples/sortBy.yaml)`

```json
[
  {
    "name": "Ana",
    "age": 12
  },
  {
    "name": "Ana",
    "age": 31
  },
  {
    "name": "Bob",
    "age": 17
  },
  {
    "name": "Colby",
    "age": 35
  },
  {
    "name": "Fred",
    "age": 50
  },
  {
    "name": "Jack",
    "age": 40
  },
  {
    "name": "Ted",
    "age": 20
  },
  {
    "name": "Zed",
    "age": 90
  }
]
```

## Fn::SortObject

See: [examples/sortObject.yaml](examples/sortObject.yaml)

`$ cfn-include examples/sortObject.yaml`

```json
{
  "a": "hi",
  "c": "z",
  "h": 20,
  "i": true,
  "z": 1
}
```

## Fn::ObjectKeys

This function uses [Object.keys](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys)

```yaml
FamilyNames:
  Fn::ObjectKeys:
    Ted: 18 
    Lucy: 5
    Tom: 10
```

Results in:

```yaml
FamilyNames:
  - Ted
  - Lucy
  - Tom
```

## Fn::ObjectValues

This function uses [Object.values](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/values)

```yaml
FamilyAges:
  Fn::ObjectValues:
    Ted: 18 
    Lucy: 5
    Tom: 10
```

Results in:

```yaml
FamilyAges:
  - 18
  - 5
  - 10
```

## Fn::Filenames

```yaml
Fn::Filenames:
  location: "../t/fixtures"
  omitExtension: true
```

```json
[
  "deep",
  "foobar",
  "subfolder",
  "synopsis",
  "verydeep",
  "include1",
  "include2"
]
```

## Fn::StringSplit

Useful for injected Includes which you need to run `Fn::Map` upon.

```yaml
Fn::StringSplit:
  string: "A,B,C"
  separator: "," # defaults to this so it can be omitted
```

```yaml
- A
- B
- C
```

## Fn::Without

```yaml
Fn::Without:
  - ["a", "b", "c", "d"]
  - ["b", "c"]
```

```yaml
- "a",
- "d"
```

## Fn::Omit

[omit_object](t/includes/omit_object.json)
[omit_array](t/includes/omit_array.json)

```yaml
b: b
```

## Fn::OmitEmpty

See [omitEmpty test file](t/omitEmpty.json), file and expectations (output). 

In summary falsy values are omitted from an object except `false` and `0`.

## Fn::Eval

Opt in to use `eval` in your templates. This is disabled by default.

`--enable eval` is required to turn on options.doEval in the include function.

```yaml
Fn::Eval:
  state: [1, 2, 3]
  script: >
    state.map((v) => 2 * v);
```

```yaml
- 2
- 4
- 6
```

## Fn::IfEval

Opt in to use `eval` in your templates. This is disabled by default.

`--enable eval` is required to turn on options.doEval in the include function.

```yaml
Fn::IfEval:
  inject:
    lastName: bear
  # doLog: true
  evalCond: ('$lastName' === 'bear')
  truthy:
    Name: Yogi
    LastName: Bear
  falsy:
    Name: Fred
    LastName: Flint
```

```yaml
Name: Yogi
LastName: Bear
```

## Fn::JoinNow

```yaml
Fn::JoinNow:
  - ""
  - - "arn:aws:s3:::c1-acme-iam-cache-engine-"
    - ${AWS::AccountId}
    - "-us-east-1$CFT_STACK_SUFFIX"
```

```yaml
arn:aws:s3:::c1-acme-iam-cache-engine-${AWS::AccountId}-us-east-1$CFT_STACK_SUFFIX
```

## Fn::SubNow

`Fn::SubNow` performs immediate string substitution similar to AWS CloudFormation's `Fn::Sub`, but evaluates during template preprocessing rather than at stack creation time. It supports variable substitution using `${VariableName}` syntax and AWS pseudo-parameters.

The function supports two input formats:

**String format:**
```yaml
Fn::SubNow: "arn:aws:s3:::bucket-${BucketSuffix}"
```

**Array format with variables:**
```yaml
Fn::SubNow:
  - "arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:${LogGroupName}"
  - LogGroupName: /aws/lambda/my-function
```

**Supported AWS pseudo-parameters:**
- `${AWS::AccountId}` - AWS Account ID
- `${AWS::Region}` - AWS Region
- `${AWS::StackName}` - Stack name
- `${AWS::StackId}` - Stack ID
- `${AWS::Partition}` - AWS Partition (e.g., 'aws')
- `${AWS::URLSuffix}` - URL suffix (e.g., 'amazonaws.com')

Variables can be provided via:
1. The `inject` option passed to `cfn-include`
2. Explicit variables in the array format (takes precedence over `inject`)
3. Environment variables when using the `doEnv` option

**Example with environment variables:**
```yaml
BucketName: !SubNow "my-bucket-${Environment}-${AWS::Region}"
```

With `CFN_INCLUDE_DO_ENV=true` and environment variable `ENVIRONMENT=prod`, this resolves to:
```yaml
BucketName: "my-bucket-prod-us-east-1"
```

## Fn::RefNow

`Fn::RefNow` resolves a reference immediately during template preprocessing, similar to AWS CloudFormation's `Fn::Ref` but evaluated at processing time rather than stack creation time. It resolves references to parameters, variables, and AWS pseudo-parameters.

**Basic syntax:**
```yaml
BucketRef:
  Fn::RefNow: BucketName
```

or using YAML tag syntax:
```yaml
BucketRef: !RefNow BucketName
```

**Supported AWS pseudo-parameters:**
- `AWS::AccountId` - AWS Account ID (environment: `AWS_ACCOUNT_ID` or `AWS_ACCOUNT_NUM`, fallback: `${AWS::AccountId}`)
- `AWS::Region` - AWS Region (environment: `AWS_REGION`, fallback: `${AWS::Region}`)
- `AWS::StackName` - Stack name (environment: `AWS_STACK_NAME`, fallback: `${AWS::StackName}`)
- `AWS::StackId` - Stack ID (environment: `AWS_STACK_ID`, fallback: `${AWS::StackId}`)
- `AWS::Partition` - AWS Partition (environment: `AWS_PARTITION`, default: `'aws'`)
- `AWS::URLSuffix` - URL suffix (environment: `AWS_URL_SUFFIX`, default: `'amazonaws.com'`)
- `AWS::NotificationARNs` - SNS topic ARNs for notifications (environment: `AWS_NOTIFICATION_ARNS`, fallback: `${AWS::NotificationARNs}`)

**Reference resolution priority:**
1. AWS pseudo-parameters (with environment variable fallbacks)
2. Variables from the `inject` option
3. Variables from the current scope (useful with `Fn::Map`)

**Reference indirection:**
If a resolved reference is a string, it will be treated as a reference name and resolved again. This enables reference chaining, useful when using `Fn::RefNow` with `Fn::Map`:

```yaml
Fn::Map:
  - [BucketVar1, BucketVar2]
  - BucketName:
      Fn::RefNow: _
```

With `inject: { BucketVar1: "my-bucket-1", BucketVar2: "my-bucket-2" }`, this via 

`$ Bucket1=my-bucket-1 BucketVar2=my-bucket-2 cnf-include examples/refNow.yml --enable env,eval` via exports / env

or 

`$ cnf-include examples/refNow.yml --enable env,eval --inject '{"BucketVar1":"my-bucket-1","BucketVar2":"my-bucket-2"}'` via inject

resolves to:
```yaml
BucketVar1: my-bucket-1
BucketVar2: my-bucket-2
```

The `_` placeholder resolves to `"BucketVar1"` or `"BucketVar2"`, which are then resolved again to their actual values.

**Example with injected variables:**
```yaml
Resources:
  Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName:
        Fn::RefNow: BucketName
```

With `inject: { BucketName: "my-app-bucket" }`, this resolves to:
```yaml
BucketName: "my-app-bucket"
```

**Example with AWS pseudo-parameters:**
```yaml
LogGroup:
  Fn::RefNow: AWS::StackName
```

With `AWS_STACK_NAME=my-stack`, this resolves to:
```yaml
LogGroup: "my-stack"
```

**Unresolved AWS pseudo-parameters:**
If an AWS pseudo-parameter is not set via environment variables, it falls back to a placeholder string (e.g., `${AWS::AccountId}`). Only `AWS::Partition` and `AWS::URLSuffix` have hardcoded defaults since they are rarely environment-specific.

**Error handling:**
If a reference cannot be resolved, `Fn::RefNow` will throw an error. Ensure all referenced parameters and variables are available via inject, scope, or environment variables.

**Resolving LogicalResourceIds:**

`Fn::RefNow` can also resolve references to CloudFormation Resource LogicalResourceIds, enabling you to construct ARNs or other resource-specific values during template preprocessing. When a reference matches a LogicalResourceId in the Resources section, `Fn::RefNow` will automatically generate the appropriate ARN based on the resource type and properties.

**Supported Resource Types for ARN/Name Resolution:**

- `AWS::IAM::ManagedPolicy` - Returns policy ARN (supports Path)
- `AWS::IAM::Role` - Returns role ARN (supports Path)
- `AWS::IAM::InstanceProfile` - Returns instance profile ARN (supports Path)
- `AWS::S3::Bucket` - Returns bucket ARN
- `AWS::Lambda::Function` - Returns function ARN
- `AWS::SQS::Queue` - Returns queue ARN
- `AWS::SNS::Topic` - Returns topic ARN
- `AWS::DynamoDB::Table` - Returns table ARN
- `AWS::RDS::DBInstance` - Returns DB instance ARN
- `AWS::SecretsManager::Secret` - Returns secret ARN
- `AWS::KMS::Key` - Returns key ARN

Example with AWS::IAM::ManagedPolicy:

```yaml
Resources:
  ObjPolicy:
    Type: AWS::IAM::ManagedPolicy
    Properties:
      ManagedPolicyName: teststack-CreateTestDBPolicy-16M23YE3CS700
      Path: /CRAP/

  IAMRole:
    Type: AWS::IAM::Role
    Properties:
      ManagedPolicyArns:
        - Fn::RefNow: ObjPolicy  # Resolves to: arn:aws:iam::${AWS_ACCOUNT_ID}:policy/CRAP/teststack-CreateTestDBPolicy-16M23YE3CS700
```

**Returning Resource Names Instead of ARNs:**

By default, `Fn::RefNow` returns the ARN for supported resource types. However, if the key name ends with `Name` (e.g., `RoleName`, `BucketName`, `FunctionName`), it automatically returns the resource name/identifier instead:

```yaml
Resources:
  MyRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: MyExecutionRole

  RoleArn:
    Fn::RefNow: MyRole  # Returns: arn:aws:iam::${AWS_ACCOUNT_ID}:role/MyExecutionRole

  RoleName:
    Fn::RefNow: MyRole  # Returns: MyExecutionRole (because key ends with "Name")
```

This intuitive approach makes templates more readable and follows natural CloudFormation naming conventions.

**CLI Options for Fn::RefNow:**

The `cfn-include` command provides CLI options to control how unresolved references are handled:

- `--ref-now-ignore-missing`: Do not fail if a `Fn::RefNow` reference cannot be resolved. Instead, the reference will be returned in AWS CloudFormation's standard `Ref` syntax (e.g., `{ Ref: 'UnresolvedRef' }`), allowing CloudFormation to resolve it at stack creation time.
- `--ref-now-ignores <names>`: Comma-separated list of reference names to ignore if not found. These references will be returned in `Ref` syntax instead of throwing an error.

**Example usage:**

```bash
# Ignore all unresolved references
cfn-include template.yaml --ref-now-ignore-missing

# Ignore specific reference names
cfn-include template.yaml --ref-now-ignores "OptionalRef1,OptionalRef2"

# Combine both options
cfn-include template.yaml --ref-now-ignore-missing --ref-now-ignores "SpecificRef"
```

This is useful for templates that reference CloudFormation parameters or other resources that may not be available at template processing time but will be available at stack creation time.

## Fn::ApplyTags

See [ApplyTags test file](t/tests/applyTags.yml).

Fields:
`(T|t)ags`: sequence of {Key, Value} objects to me merged in as Tags properties of a taggable resource.
`resources`: Object mapping of resources, this is usually your root `CFT.Resources` block.

## Fn::UpperCamelCase

```yaml
Name: !UpperCamelCase foo-bar # yields FooBar
```

## Fn::Outputs

This helper transformation simplifies the definition of output variables and exports.

```yaml
Outputs:
  Fn::Outputs:
    Version: !GetEnv [VERSION, "1.0.0"]
    BucketArn: ${Bucket.Arn}
    BucketPolicy:
      Condition: HasBucketPolicy
      Value: ${BucketPolicy}
    Subnets:
      - ${SubnetA},${SubnetB},${Provided}
      - Provided: ${SubnetC}
```

This will translate into:

```yaml
Outputs:
  Version:
    Value: !Sub "1.0.0"
    Export:
      Name: !Sub ${AWS::StackName}:Version

  BucketArn:
    Value: !Sub ${Bucket.Arn}
    Export:
      Name: !Sub ${AWS::StackName}:BucketArn

  BucketPolicy:
    Value: !Sub ${BucketPolicy}
    Condition: HasBucketPolicy
    Export:
      Name: !Sub ${AWS::StackName}:BucketPolicy

  Subnets:
    Value:
      Fn::Sub:
        - ${SubnetA},${SubnetB},${Provided}
        - Provided: ${SubnetC}
    Export:
      Name: !Sub ${AWS::StackName}:Subnets
```

## More Examples

See [/examples](https://github.com/nmccready/cfn-include/tree/master/examples) for templates that call an API Gateway endpoint to collect AMI IDs for all regions. There is also a good amount of [tests](https://github.com/nmccready/cfn-include/tree/master/t) that might be helpful.

A common pattern is to process a template, validate it against the AWS [validate-template](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/validate-template.html) API, minimize it and upload the result to S3. You can do this with a single line of code:

```bash
cfn-include example.template -t -m | aws s3 cp - s3://bucket-name/output.template
```

## Proxy Support

`cfn-include` honors proxy settings defined in the `https_proxy` environmental variable. The module will attempt to load `proxy-agent`. Make sure `proxy-agent` is installed since it is not a dependency for this module.

## Compatibility

Node.js versions 8 and up are supported both on Windows and Linux.

## Web Service

    curl https://api.netcubed.de/latest/template?[options] -XPOST -d @<path>

- `path`

  the contents of `path` will be `POST`ed to the web service. See `man curl` for details.

Options:

Options are query parameters.

- `validate=false` do not validate template [true]

## Developer Documentation

### Debug Logging with doLog

The `cfn-include` preprocessor supports comprehensive debug logging for tracing template processing. When enabled, the `doLog` option logs all arguments at each recursion level in the template processing pipeline.

#### Enabling doLog

**CLI:**
```bash
cfn-include template.yaml --doLog
```

**Programmatic:**
```javascript
include({
  template: myTemplate,
  url: 'file:///path/to/template.yaml',
  doLog: true
})
```

#### Understanding Caller Parameter

The `recurse` function now includes a `caller` parameter to help identify which function triggered each recursion step. This is invaluable for debugging complex templates with nested function calls. The caller parameter provides a trace path like:

- `recurse:isArray` - Processing an array
- `Fn::Map` - Inside an `Fn::Map` function
- `Fn::Include` - Inside an `Fn::Include` function
- `recurse:isPlainObject:end` - Final plain object processing
- `handleIncludeBody:json` - JSON body being processed

When `doLog` is enabled, the console output will show the caller for each recursion:
```javascript
{
  base: {...},
  scope: {...},
  cft: {...},
  rootTemplate: {...},
  caller: "Fn::Map",
  doEnv: false,
  doEval: false,
  ...
}
```

This makes it easy to trace execution flow through nested `Fn::Include`, `Fn::Map`, `Fn::RefNow`, and other functions.

#### Example Debug Output

```bash
$ cfn-include examples/base.template --doLog | head -50
{
  base: {
    protocol: 'file',
    host: '/Users/SOME_USER/code',
    path: '/examples/base.template'
  },
  scope: {},
  cft: { AWSTemplateFormatVersion: '2010-09-09', ... },
  rootTemplate: { AWSTemplateFormatVersion: '2010-09-09', ... },
  caller: 'recurse:isPlainObject:end',
  doEnv: false,
  doEval: false,
  inject: undefined,
  doLog: true
}
```

### Fn::RefNow Improvements

#### CLI Options for Reference Resolution

Two new CLI options control how unresolved `Fn::RefNow` references are handled:

- `--ref-now-ignore-missing`: Do not fail if a reference cannot be resolved. Instead, return the reference in CloudFormation's standard `Ref` syntax, allowing CloudFormation to resolve it at stack creation time.

- `--ref-now-ignores <names>`: Comma-separated list of specific reference names to ignore if not found. Useful for optional references.

**Example usage:**
```bash
# Ignore all unresolved references
cfn-include template.yaml --ref-now-ignore-missing

# Ignore specific references
cfn-include template.yaml --ref-now-ignores "OptionalParam,CustomRef"

# Combine both
cfn-include template.yaml --ref-now-ignore-missing --ref-now-ignores "SpecificRef"
```

#### rootTemplate Parameter

The `recurse` function now receives the complete `rootTemplate` for all recursion calls. This enables `Fn::RefNow` to resolve references to CloudFormation resources defined anywhere in the template, even when processing deeply nested includes or function results.

### Fn::SubNow and Fn::JoinNow

New intrinsic functions for immediate string substitution and joining:

- `Fn::SubNow` - Performs immediate string substitution similar to `Fn::Sub`, but evaluates at template processing time
- `Fn::JoinNow` - Joins array elements into a string at template processing time

See the main documentation sections above for detailed usage.

### Template Processing Pipeline

The template processing follows this call chain for better debugging:

1. Entry point calls `recurse()` with `caller: undefined`
2. Array elements call `recurse()` with `caller: 'recurse:isArray'`
3. Each `Fn::*` function calls `recurse()` with `caller: 'Fn::FunctionName'`
4. Final plain object recursion uses `caller: 'recurse:isPlainObject:end'`
5. Include body processing uses `caller: 'handleIncludeBody:json'`

When combined with `--doLog`, this provides complete visibility into how `cfn-include` processes your templates.

To compile the synopsis run the following command.

```
curl -Ssf -XPOST https://api.netcubed.de/latest/template -d '{"Fn::Include":"https://raw.githubusercontent.com/nmccready/cfn-include/master/examples/synopsis.json"}' > output.template
```
