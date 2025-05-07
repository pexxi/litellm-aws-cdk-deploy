import * as cdk from "aws-cdk-lib";
import * as kms from "aws-cdk-lib/aws-kms";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3Deployment from "aws-cdk-lib/aws-s3-deployment";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as path from "node:path";
import * as fs from "node:fs";
import { Construct } from "constructs";
import { SecretValue } from "aws-cdk-lib";
import { generateRandomPassword } from "../utils/random";

// Define any input props if needed, e.g., removal policies for production
// export interface ConfigConstructProps {
// }

export class ConfigConstruct extends Construct {
	public readonly key: kms.Key;
	public readonly configBucket: s3.Bucket;
	public readonly uiPasswordSecret: secretsmanager.Secret;
	public readonly masterKeySecret: secretsmanager.Secret;
	public readonly configObjectKey: string;

	constructor(scope: Construct, id: string) {
		super(scope, id);

		// KMS key for encryption
		this.key = new kms.Key(this, "LiteLLMKey", {
			enableKeyRotation: true,
			description: "KMS key for LiteLLM resources",
			removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
		});

		// S3 Bucket for config.yaml
		this.configBucket = new s3.Bucket(this, "LiteLLMS3Bucket", {
			versioned: false, // Enable versioning in production
			removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
			autoDeleteObjects: true, // Disable in production
			encryptionKey: this.key, // Encrypt bucket contents
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Ensure bucket is private
			enforceSSL: true, // Require SSL for access
		});

		const configYaml = fs.readFileSync(
			path.join(__dirname, "..", "..", "..", "config", "config.yaml"),
			"utf8",
		);
		new s3Deployment.BucketDeployment(this, "LiteLLMS3ConfigFileDeployment", {
			destinationBucket: this.configBucket,
			sources: [s3Deployment.Source.yamlData("config.yaml", configYaml)],
			destinationKeyPrefix: "config", // Optional: put config in a prefix
			memoryLimit: 256, // Increase memory limit if needed for large files
		});

		this.configObjectKey = "config/config.yaml";

		// Secrets
		this.uiPasswordSecret = new secretsmanager.Secret(this, "LiteLLMUI", {
			description: "Secret for LiteLLM UI",
			removalPolicy: cdk.RemovalPolicy.DESTROY,
			secretStringValue: SecretValue.unsafePlainText(
				generateRandomPassword(32),
			),
			encryptionKey: this.key, // Encrypt secret with the KMS key
		});

		this.masterKeySecret = new secretsmanager.Secret(this, "LiteLLMMasterKey", {
			description: "Secret for LiteLLM Master Key",
			removalPolicy: cdk.RemovalPolicy.DESTROY,
			secretStringValue: SecretValue.unsafePlainText(
				generateRandomPassword(32),
			),
			encryptionKey: this.key, // Encrypt secret with the KMS key
		});
	}
}
