#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LiteLLMFargateStack } from '../lib/litellm-stack-fargate';

const app = new cdk.App();
const stack = new LiteLLMFargateStack(app, 'LiteLLMStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-north-1'
  }
});

