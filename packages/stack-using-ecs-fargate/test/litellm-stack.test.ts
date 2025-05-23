import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { LiteLLMStack } from "../lib/litellm-stack";

describe("LiteLLMStack Snapshot Test", () => {
	test("Synthesizes the stack correctly", () => {
		const app = new cdk.App();
		const stack = new LiteLLMStack(app, "MyTestStack", {
			isProduction: false, // Provide a default value for isProduction
			// You might need to mock or provide other props if the stack requires them
			// For example, if it needs env:
			// env: { account: '123456789012', region: 'us-east-1' }
		});
		const template = Template.fromStack(stack);
		expect(template.toJSON()).toMatchSnapshot();
	});
});
