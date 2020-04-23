'use strict'

/**
 * Test script for serverless-plugin-additional-stacks
 * Kenneth Falck <kennu@sc5.io> 2017
 *
 * These tests will use the default AWS profile (or environment settings)
 * to deploy the test stacks defined in service/serverless.yml.
 */

const AWS = require('aws-sdk')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const childProcess = require('child_process')
const path = require('path')
const chalk = require('chalk')

// set region if not set (as not set by the SDK by default)
if (!AWS.config.region) {
  AWS.config.update({
    region: 'us-east-1'
  });
}

const cloudformation = new AWS.CloudFormation()
chai.use(chaiAsPromised)
const assert = chai.assert

const SLS = path.join(__dirname, '/node_modules', '.bin', 'sls')
const BASE_STACK_FULLNAME = 'additional-stacks-plugin-service-test'
const PRIMARY_STACK = 'primary'
const PRIMARY_STACK_FULLNAME = 'additional-stacks-plugin-service-test-primary'
const SECONDARY_STACK = 'secondary'
const SECONDARY_STACK_FULLNAME = 'additional-stacks-plugin-service-test-customname-secondary'
const TERTIARY_STACK = 'tertiary'
const TERTIARY_STACK_FULLNAME = 'additional-stacks-plugin-service-test-customname-tertiary'

function sls(args) {
  console.log('   ', chalk.gray.dim('$'), chalk.gray.dim('sls ' + args.join(' ')))
  const dir = path.join(__dirname, 'service')
  return new Promise((resolve, reject) => {
    const child = childProcess.execFile(SLS, args, {
      cwd: dir,
    }, (err, stdout, stderr) => {
      // if (stdout) console.log(chalk.gray.dim(stdout))
      // if (stderr) console.error(chalk.red(stderr))
      if (err) return reject(err)
      resolve(stdout)
    })
    child.stdout.on('data', data => {
      process.stdout.write(chalk.gray.dim(data))
    })
    child.stderr.on('data', data => {
      process.stderr.write(chalk.red(data))
    })
  })
}

function describeStack(stackName) {
  return cloudformation.describeStacks({
    StackName: stackName,
  })
  .promise()
  .then(response => {
    return response.Stacks && response.Stacks[0]
  })
  .then(null, err => {
    if (err.message && err.message.match(/does not exist$/)) {
      // Stack doesn't exist yet
      return null
    } else {
      // Some other error, let it throw
      return Promise.reject(err)
    }
  })
}

function deleteStack(stackName) {
  return Promise.resolve()
  .then(() => {
    return describeStack(stackName)
  })
  .then(response => {
    if (response) {
      console.log('   ', chalk.yellow.dim('Cleaning up additional stack ' + stackName))
      return cloudformation.deleteStack({
        StackName: stackName,
      })
      .promise()
    }
  })
  .then(response => {
    if (response) {
      return cloudformation.waitFor('stackDeleteComplete', {
        StackName: stackName,
      })
      .promise()
    }
  })
}

function describeAllStacks() {
  return Promise.all([
    describeStack(BASE_STACK_FULLNAME),
    describeStack(PRIMARY_STACK_FULLNAME),
    describeStack(SECONDARY_STACK_FULLNAME),
    describeStack(TERTIARY_STACK_FULLNAME),
  ])
}

function deleteAllStacks() {
  return Promise.resolve()
  .then(() => {
    // Check if main Serverless stack exists - it must be removed with sls
    return describeStack(BASE_STACK_FULLNAME)
  })
  .then(response => {
    if (response) {
      console.log('   ', chalk.yellow.dim('Cleaning up base stack'))
      return sls(['remove'])
    }
  })
  .then(() => {
    return deleteStack(PRIMARY_STACK_FULLNAME)
  })
  .then(() => {
    return deleteStack(SECONDARY_STACK_FULLNAME)
  })
  .then(() => {
    return deleteStack(TERTIARY_STACK_FULLNAME)
  })
}

describe('Automatic Stack Deployment', () => {
  before(() => {
    // Clean up before tests
    return deleteAllStacks()
  })

  it('all stacks deployed on sls deploy', () => {
    return Promise.resolve()
    .then(() => {
      return sls(['deploy'])
    })
    .then(() => {
      return describeAllStacks()
    })
    .then(responses => {
      assert.isOk(responses[0], 'serverless stack')
      assert.isOk(responses[1], 'primary stack')
      assert.isOk(responses[2], 'secondary stack')
      assert.isOk(responses[3], 'tertiary stack')
      assert.equal(responses[0].StackStatus, 'UPDATE_COMPLETE', 'serverless stack')
      assert.equal(responses[1].StackStatus, 'CREATE_COMPLETE', 'primary stack')
      assert.equal(responses[2].StackStatus, 'CREATE_COMPLETE', 'secondary stack')
      assert.equal(responses[3].StackStatus, 'CREATE_COMPLETE', 'tertiary stack')
      assert.equal(responses[0].Tags.filter(tag => tag.Key === 'Owner')[0].Value, 'owner@example.org', 'serverless stack custom tag')
      assert.equal(responses[1].Tags.filter(tag => tag.Key === 'Owner')[0].Value, 'owner@example.org', 'primary stack custom tag')
      assert.equal(responses[2].Tags.filter(tag => tag.Key === 'Owner')[0].Value, 'another@example.org', 'secondary stack custom tag')
      assert.equal(responses[3].Tags.filter(tag => tag.Key === 'Owner')[0].Value, 'yetanother@example.org', 'tertiary stack custom tag')
    })
  })

  it('additional stacks unchanged on sls deploy', () => {
    return Promise.resolve()
    .then(() => {
      return sls(['deploy'])
    })
    .then(() => {
      return describeAllStacks()
    })
    .then(responses => {
      assert.isOk(responses[0], 'serverless stack')
      assert.isOk(responses[1], 'primary stack')
      assert.isOk(responses[2], 'secondary stack')
      assert.isOk(responses[3], 'tertiary stack')
      assert.equal(responses[0].StackStatus, 'UPDATE_COMPLETE', 'serverless stack')
      assert.equal(responses[1].StackStatus, 'CREATE_COMPLETE', 'primary stack')
      assert.equal(responses[2].StackStatus, 'CREATE_COMPLETE', 'secondary stack')
      assert.equal(responses[3].StackStatus, 'CREATE_COMPLETE', 'tertiary stack')
    })
  })

  it('all stacks updated on sls deploy', () => {
    return Promise.resolve()
    .then(() => {
      // The --topicname argument will cause the secondary stack to rename the SNS topic
      return sls(['deploy', '--topicname', 'newname'])
    })
    .then(() => {
      return describeAllStacks()
    })
    .then(responses => {
      assert.isOk(responses[0], 'serverless stack')
      assert.isOk(responses[1], 'primary stack')
      assert.isOk(responses[2], 'secondary stack')
      assert.isOk(responses[3], 'tertiary stack')
      assert.equal(responses[0].StackStatus, 'UPDATE_COMPLETE', 'serverless stack')
      assert.equal(responses[1].StackStatus, 'CREATE_COMPLETE', 'primary stack')
      assert.equal(responses[2].StackStatus, 'UPDATE_COMPLETE', 'secondary stack')
      assert.equal(responses[3].StackStatus, 'CREATE_COMPLETE', 'tertiary stack')
    })
  })

  it('additional stacks NOT removed on sls remove', () => {
    return Promise.resolve()
    .then(() => {
      return sls(['remove'])
    })
    .then(() => {
      return describeAllStacks()
    })
    .then(responses => {
      assert.isNull(responses[0], 'serverless stack')
      assert.isOk(responses[1], 'primary stack')
      assert.isOk(responses[2], 'secondary stack')
      assert.isOk(responses[3], 'tertiary stack')
      assert.equal(responses[1].StackStatus, 'CREATE_COMPLETE', 'primary stack')
      assert.equal(responses[2].StackStatus, 'UPDATE_COMPLETE', 'secondary stack')
      assert.equal(responses[3].StackStatus, 'CREATE_COMPLETE', 'tertiary stack')
    })
  })
})

describe('Manual Stack Deployment', () => {
  before(() => {
    // Clean up before tests
    return deleteAllStacks()
  })

  it('additional stacks deployed on sls deploy additionalstacks', () => {
    return Promise.resolve()
    .then(() => {
      return sls(['deploy', 'additionalstacks'])
    })
    .then(() => {
      return describeAllStacks()
    })
    .then(responses => {
      assert.isNull(responses[0], 'serverless stack')
      assert.isOk(responses[1], 'primary stack')
      assert.isOk(responses[2], 'secondary stack')
      assert.isOk(responses[3], 'tertiary stack')
      assert.equal(responses[1].StackStatus, 'CREATE_COMPLETE', 'primary stack')
      assert.equal(responses[2].StackStatus, 'CREATE_COMPLETE', 'secondary stack')
      assert.equal(responses[3].StackStatus, 'CREATE_COMPLETE', 'tertiary stack')
    })
  })

  it('additional stacks unchanged on sls deploy additionalstacks', () => {
    return Promise.resolve()
    .then(() => {
      return sls(['deploy', 'additionalstacks'])
    })
    .then(() => {
      return describeAllStacks()
    })
    .then(responses => {
      assert.isNull(responses[0], 'serverless stack')
      assert.isOk(responses[1], 'primary stack')
      assert.isOk(responses[2], 'secondary stack')
      assert.isOk(responses[3], 'tertiary stack')
      assert.equal(responses[1].StackStatus, 'CREATE_COMPLETE', 'primary stack')
      assert.equal(responses[2].StackStatus, 'CREATE_COMPLETE', 'secondary stack')
      assert.equal(responses[3].StackStatus, 'CREATE_COMPLETE', 'tertiary stack')
    })
  })

  it('additional stacks updated on sls deploy additionalstacks', () => {
    return Promise.resolve()
    .then(() => {
      // The --topicname argument will cause the secondary stack to rename the SNS topic
      return sls(['deploy', 'additionalstacks', '--topicname', 'newname'])
    })
    .then(() => {
      return describeAllStacks()
    })
    .then(responses => {
      assert.isNull(responses[0], 'serverless stack')
      assert.isOk(responses[1], 'primary stack')
      assert.isOk(responses[2], 'secondary stack')
      assert.isOk(responses[3], 'tertiary stack')
      assert.equal(responses[1].StackStatus, 'CREATE_COMPLETE', 'primary stack')
      assert.equal(responses[2].StackStatus, 'UPDATE_COMPLETE', 'secondary stack')
      assert.equal(responses[3].StackStatus, 'CREATE_COMPLETE', 'tertiary stack')
    })
  })

  it('additional stacks removed on sls remove additionalstacks', () => {
    return Promise.resolve()
    .then(() => {
      // Deploy the base stack to see that it's not removed
      return sls(['deploy'])
    })
    .then(() => {
      return sls(['remove', 'additionalstacks'])
    })
    .then(() => {
      return describeAllStacks()
    })
    .then(responses => {
      assert.isOk(responses[0], 'serverless stack')
      assert.isNull(responses[1], 'primary stack')
      assert.isNull(responses[2], 'secondary stack')
      assert.isNull(responses[3], 'tertiary stack')
      assert.equal(responses[0].StackStatus, 'UPDATE_COMPLETE', 'serverless stack')
    })
  })
})

describe('Individual Stack Deployment', () => {
  before(() => {
    // Clean up before tests
    return deleteAllStacks()
  })

  it('specified stack is deployed on sls deploy additionalstacks --stack', () => {
    return Promise.resolve()
    .then(() => {
      return sls(['deploy', 'additionalstacks', '--stack', SECONDARY_STACK])
    })
    .then(() => {
      return describeAllStacks()
    })
    .then(responses => {
      assert.isNull(responses[0], 'serverless stack')
      assert.isNull(responses[1], 'primary stack')
      assert.isOk(responses[2], 'secondary stack')
      assert.equal(responses[2].StackStatus, 'CREATE_COMPLETE', 'secondary stack')
      assert.isNull(responses[3], 'tertiary stack')
    })
  })

  it('specified stack is unchanged on sls deploy additionalstacks --stack', () => {
    return Promise.resolve()
    .then(() => {
      return sls(['deploy', 'additionalstacks', '--stack', SECONDARY_STACK])
    })
    .then(() => {
      return describeAllStacks()
    })
    .then(responses => {
      assert.isNull(responses[0], 'serverless stack')
      assert.isNull(responses[1], 'primary stack')
      assert.isOk(responses[2], 'secondary stack')
      assert.equal(responses[2].StackStatus, 'CREATE_COMPLETE', 'secondary stack')
      assert.isNull(responses[3], 'tertiary stack')
    })
  })

  it('specified stack is updated on sls deploy additionalstacks --stack', () => {
    return Promise.resolve()
    .then(() => {
      return sls(['deploy', 'additionalstacks', '--stack', SECONDARY_STACK, '--topicname', 'newname'])
    })
    .then(() => {
      return describeAllStacks()
    })
    .then(responses => {
      assert.isNull(responses[0], 'serverless stack')
      assert.isNull(responses[1], 'primary stack')
      assert.isOk(responses[2], 'secondary stack')
      assert.equal(responses[2].StackStatus, 'UPDATE_COMPLETE', 'secondary stack')
      assert.isNull(responses[3], 'tertiary stack')
    })
  })

  it('specified stack is removed on sls deploy additionalstacks --stack', () => {
    return Promise.resolve()
    .then(() => {
      return sls(['remove', 'additionalstacks', '--stack', SECONDARY_STACK])
    })
    .then(() => {
      return describeAllStacks()
    })
    .then(responses => {
      assert.isNull(responses[0], 'serverless stack')
      assert.isNull(responses[1], 'primary stack')
      assert.isNull(responses[2], 'secondary stack')
      assert.isNull(responses[3], 'tertiary stack')
    })
  })
})

describe('Stack Info', () => {
  before(() => {
    // Clean up before tests
    return deleteAllStacks()
  })

  after(() => {
    // Clean up after tests
    return deleteAllStacks()
  })

  it('is shown as completed after deploying', () => {
    return Promise.resolve()
    .then(() => {
      return sls(['deploy'])
    })
    .then(() => {
      return sls(['info'])
    })
    .then(stdout => {
      //console.log('STDOUT', stdout)
    })
  })

  it('is not shown after removing', () => {
    return Promise.resolve()
    .then(() => {
      return sls(['remove', 'additionalstacks'])
    })
    .then(() => {
      return sls(['info'])
    })
    .then(stdout => {
      //console.log('STDOUT', stdout)
    })
  })
})
