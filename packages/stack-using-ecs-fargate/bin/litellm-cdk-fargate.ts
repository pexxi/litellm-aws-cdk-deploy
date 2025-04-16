#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { LiteLLMStack } from "../lib/litellm-stack";

const app = new cdk.App();
const stack = new LiteLLMStack(app, "LiteLLMStack", {
	env: {
		account: process.env.CDK_DEFAULT_ACCOUNT,
		region: process.env.CDK_DEFAULT_REGION,
	},
});
