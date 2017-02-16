# Additional Stacks Plugin for Serverless 1.x
Created by Kenneth Falck <<kennu@sc5.io>> in 2017.  
Copyright [SC5 Online](https://sc5.io). Released under the MIT license.

## Overview and purpose

This plugin provides support for managing multiple AWS CloudFormation stacks
in your Serverless 1.x service (serverless.yml).

Normally, Serverless creates a single CloudFormation stack which contains
all your CloudFormation resources. If you ever delete your service, these
resources are also deleted, including data stored in S3 or DynamoDB.

The Additional Stacks Plugin allows you to move your "permanent"
resources into a separate CloudFormation stack, which is not tightly coupled
with the service. If you delete your Serverless service and deploy it again from
scratch, the permanent resources and their stored data remain untouched.

The cost of separation is that `Ref:` no longer works for directly referencing
resources between stacks. If you need such references, you'll need to define
exported stack output values and then use `Fn::ImportValue` to refer to the
value in the other stack.

However, you can also use shared Serverless variables in stack definitions. So
you can define resource names in `serverless.yml` and then refer to them
using variables like `${self:custom.tableName}`.

You can use the plugin to manage as many additional stacks as you like
in your serverless.yml, placed under the `custom.additionalStacks` section.

## Installation

To install with npm, run this in your service directory:

    npm install --save serverless-plugin-additional-stacks

To install with yarn, run this in your service directory:

    yarn add serverless-plugin-additional-stacks

Then add this to your `serverless.yml`:

```yml
plugins:
 - serverless-plugin-additional-stacks
```

## Configuration

To define additional stacks, add an `additionalStacks` section like this
in your `serverless.yml`:

```yml
custom:
  additionalStacks:
    permanent:
      Resources:
        S3BucketData:
          Type: AWS::S3::Bucket
          Properties:
            Name: ${self:service}-data
```

If you'd like to place the additional resource definitions at the end of
`serverless.yml` but keep the `custom` section elsewhere, you can use a
Serverless variable to split the configuration like this:

```yml
custom:
  additionalStacks:
    permanent: ${self:permanentResources}

permanentResources:
  Resources:
    S3BucketData:
      Type: AWS::S3::Bucket
      Properties:
        Name: ${self:service}-data
```


The full name of the deployed CloudFormation stack will include the service
name. If your service is called `my-service` and you deploy it to the `dev`
stage, the additional stack would be called `my-service-permanent-dev`.

The syntax of the Resources section is identical to the normal resources
in `serverless.yml`, so you can just cut-paste resource definitions around.

### Using Deploy: After stacks

By default, additional stacks are deployed *before* any other CloudFormation
resources. This ensures they are immediately available when your Lambda
functions run.

If you need to deploy an additional stack *after* other CloudFormation
resources, you can add `Deploy: After` to its definition. Here's an example:

```yml
custom:
  additionalStacks:
    secondary:
      Deploy: After
      Resources:
        S3BucketData:
          Type: AWS::S3::Bucket
          Properties:
            Name: ${self:service}-data

```

## Command Line Usage

Your additional stacks will be deployed automatically when you run:

    sls deploy

To deploy an additional stack individually, you can use:

    sls deploy additionalstack [stackname]

If you want to remove an additional stack, you need to run:

    sls remove additionalstack [stackname]

Or you can remove all additional stacks in the service with:

    sls remove additionalstack -a

Alternatively, you can remove stacks manually in AWS CloudFormation Console.
