import * as cdk from "aws-cdk-lib";
import * as kms from "aws-cdk-lib/aws-kms";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3Deployment from "aws-cdk-lib/aws-s3-deployment";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as path from "node:path";
import * as fs from "node:fs";
import { Construct } from "constructs";

export interface ConfigConstructProps {
	isProduction: boolean;
}

export class ConfigConstruct extends Construct {
	public readonly key: kms.Key | undefined;
	public readonly configBucket: s3.Bucket;
	public readonly uiPasswordSecret: secretsmanager.Secret;
	public readonly masterKeySecret: secretsmanager.Secret;
	public readonly apiSecrets: secretsmanager.Secret;
	public readonly configObjectKey: string;

	constructor(scope: Construct, id: string, props: ConfigConstructProps) {
		super(scope, id);

		// KMS key for encryption
		this.key = new kms.Key(this, "LiteLLMKey", {
			enableKeyRotation: true,
			description: "KMS key for LiteLLM resources",
			removalPolicy: props.isProduction
				? cdk.RemovalPolicy.RETAIN
				: cdk.RemovalPolicy.DESTROY,
		});

		// S3 Bucket for config.yaml
		this.configBucket = new s3.Bucket(this, "LiteLLMS3Bucket", {
			versioned: props.isProduction,
			removalPolicy: props.isProduction
				? cdk.RemovalPolicy.RETAIN
				: cdk.RemovalPolicy.DESTROY,
			autoDeleteObjects: !props.isProduction, // Disable in production
			encryptionKey: this.key, // Encrypt bucket contents
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Ensure bucket is private
			enforceSSL: true, // Require SSL for access
		});
		this.configObjectKey = "config/config.yaml";

		new s3Deployment.BucketDeployment(this, "LiteLLMS3ConfigFileDeployment", {
			destinationBucket: this.configBucket,
			sources: [
				s3Deployment.Source.asset(
					path.join(__dirname, "..", "..", "..", "config"),
				),
			],
			destinationKeyPrefix: "config", // Optional: put config in a prefix
			memoryLimit: 256, // Increase memory limit if needed for large files
			contentType: "application/yaml",
		});

		// Secrets
		const uiPasswordOverride = process.env.UI_PASSWORD_OVERRIDE;
		this.uiPasswordSecret = new secretsmanager.Secret(this, "LiteLLMUI", {
			description: "Secret for LiteLLM UI",
			removalPolicy: props.isProduction
				? cdk.RemovalPolicy.RETAIN
				: cdk.RemovalPolicy.DESTROY,
			encryptionKey: this.key, // Encrypt secret with the KMS key
			secretStringValue: uiPasswordOverride
				? cdk.SecretValue.unsafePlainText(uiPasswordOverride)
				: undefined,
			generateSecretString: !uiPasswordOverride
				? {
						passwordLength: 32,
						excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@" + '"' + "\\",
					}
				: undefined,
		});

		const masterKeyOverride = process.env.MASTER_KEY_OVERRIDE;
		this.masterKeySecret = new secretsmanager.Secret(this, "LiteLLMMasterKey", {
			description: "Secret for LiteLLM Master Key",
			removalPolicy: props.isProduction
				? cdk.RemovalPolicy.RETAIN
				: cdk.RemovalPolicy.DESTROY,
			encryptionKey: this.key, // Encrypt secret with the KMS key
			secretStringValue: masterKeyOverride
				? cdk.SecretValue.unsafePlainText(masterKeyOverride)
				: undefined,
			generateSecretString: !masterKeyOverride
				? {
						passwordLength: 32,
						excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@" + '"' + "\\",
					}
				: undefined,
		});

		// API keys
		// Note: this list must be in sync with the list of API keys in the config.yaml file
		// and the list of API keys in the service construct environment variables
		const azureApiKey = process.env.AZURE_API_KEY || "placeholder";
		const openaiApiKey = process.env.OPENAI_API_KEY || "placeholder";
		const anthropicApiKey = process.env.ANTHROPIC_API_KEY || "placeholder";
		const groqApiKey = process.env.GROQ_API_KEY || "placeholder";

		this.apiSecrets = new secretsmanager.Secret(this, "LiteLLMApiSecrets", {
			description: "Secret for LiteLLM API",
			removalPolicy: props.isProduction
				? cdk.RemovalPolicy.RETAIN
				: cdk.RemovalPolicy.DESTROY,
			secretObjectValue: {
				AZURE_API_KEY: cdk.SecretValue.unsafePlainText(azureApiKey),
				OPENAI_API_KEY: cdk.SecretValue.unsafePlainText(openaiApiKey),
				ANTHROPIC_API_KEY: cdk.SecretValue.unsafePlainText(anthropicApiKey),
				GROQ_API_KEY: cdk.SecretValue.unsafePlainText(groqApiKey),
			},
		});
	}
}
