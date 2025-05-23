#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { LiteLLMStack } from "../lib/litellm-stack";

const isProduction = process.env.ENV === "production";
const vpcId = process.env.VPC_ID;

const env =
	process.env.CDK_DEFAULT_ACCOUNT && process.env.CDK_DEFAULT_REGION
		? {
				account: process.env.CDK_DEFAULT_ACCOUNT,
				region: process.env.CDK_DEFAULT_REGION,
			}
		: undefined;

const app = new cdk.App();
const stack = new LiteLLMStack(app, "LiteLLMStack", {
	env,
	isProduction,
	vpcId,
});
