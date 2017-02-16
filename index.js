'use strict'

const path = require('path')

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless
    this.options = options
    this.provider = this.serverless.getProvider('aws')

    this.commands = {
      deploy: {
        commands: {
          additionalstack: {
            usage: 'Deploy additional stacks',
            lifecycleEvents: [
              'deploy',
            ],
            options: {
              all: {
                usage: 'Deploy all additional stacks',
                shortcut: 'a',
                required: false,
              },
              stack: {
                usage: 'Additional stack name to deploy',
                shortcut: 'k',
                required: false,
              },
            },
          },
        },
      },
    }

    this.hooks = {
      'before:deploy:deploy': this.beforeDeployGlobal.bind(this),
      'after:deploy:deploy': this.afterDeployGlobal.bind(this),
      'deploy:additionalstack:deploy': this.deployAdditionalStackDeploy.bind(this),
    }
  }

  getAdditionalStacks() {
    return this.serverless.service.custom && this.serverless.service.custom.additionalStacks || {}
  }

  getAdditionalBeforeStacks() {
    const beforeStacks = {}
    const stacks = this.getAdditionalStacks()
    Object.keys(stacks).map(stackName => {
      if (!stacks[stackName].Deploy || stacks[stackName].Deploy.toLowerCase() === 'before') {
        beforeStacks[stackName] = stacks[stackName]
      }
    })
    return beforeStacks
  }

  getAdditionalAfterStacks() {
    const afterStacks = {}
    const stacks = this.getAdditionalStacks()
    Object.keys(stacks).map(stackName => {
      if (stacks[stackName].Deploy && stacks[stackName].Deploy.toLowerCase() === 'after') {
        afterStacks[stackName] = stacks[stackName]
      }
    })
    return afterStacks
  }

  // Deploy additional stacks befpre deploying the main stack
  // These are stacks with Deploy: Before, which is the default
  beforeDeployGlobal() {
    const stacks = this.getAdditionalBeforeStacks()
    if (Object.keys(stacks).length > 0) {
      this.serverless.cli.log('Deploying additional stacks...')
      return this.deployStacks(stacks)
    }
  }

  // Deploy additional stacks after deploying the main stack
  // These are stacks with Deploy: After
  afterDeployGlobal() {
    const stacks = this.getAdditionalAfterStacks()
    if (Object.keys(stacks).length > 0) {
      this.serverless.cli.log('Deploying additional stacks...')
      return this.deployStacks(stacks)
    }
  }

  // Deploy additional stacks specified with sls deploy stack [name]
  deployAdditionalStackDeploy() {
    const stacks = this.getAdditionalStacks()

    if (this.options.all) {
      // Deploy all additional stacks
      if (Object.keys(stacks).length > 0) {
        this.serverless.cli.log('Deploying all additional stacks...')
        return this.deployStacks(stacks)
      } else {
        this.serverless.cli.log('No additional stacks defined. Add a custom.additionalStacks section to serverless.yml.')
        return Promise.resolve()
      }
    } else if (this.options.stack) {
      const stack = stacks[this.options.stack]
      if (stack) {
        this.serverless.cli.log('Deploying additional stack ' + this.options.stack + '...')
        return this.deployStack(this.options.stack, stack)
      } else {
        return Promise.reject(new Error('Additional stack not found: ' + this.options.stack))
      }
    } else {
      return Promise.reject(new Error('Please specify either sls deploy additionalstack -a to deploy all additional stacks or -k [stackName] to deploy a single stack'))
    }
  }

  // This deploys all the specified stacks
  deployStacks(stacks) {
    let promise = Promise.resolve()
    Object.keys(stacks).map(stackName => {
      promise = promise
      .then(() => {
        return this.deployStack(stackName, stacks[stackName])
      })
    })
    return promise
  }

  // This is where we actually handle the deployment to AWS
  deployStack(stackName, stack) {
    this.serverless.cli.log('DEPLOYING NOW ' + stackName + ' ' + JSON.stringify(stack))
  }
}

module.exports = ServerlessPlugin
