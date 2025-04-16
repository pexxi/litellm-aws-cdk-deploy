import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as kms from "aws-cdk-lib/aws-kms";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3Deployment from "aws-cdk-lib/aws-s3-deployment";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as path from "node:path";
import * as fs from "node:fs";
import { DatabaseConstruct } from "./database-construct";
import { LiteLLMServiceConstruct } from "./litellm-service-construct";

export class LiteLLMStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		// Create a VPC with two availability zones (RDS needs at least two)
		const vpc = new ec2.Vpc(this, "VPC", {
			availabilityZones: ["eu-north-1a", "eu-north-1b"], // Specify AZs for your region, RDS needs at least two
			natGateways: 1, // Use one NAT Gateway for private subnets
			// Ensure private subnets are created for RDS
			// If you only specify one AZ, CDK might only create public subnets by default.
			// For production, ensure you have a proper multi-AZ setup with private subnets.
			// For simplicity here, we might rely on default behavior or adjust as needed.
			// Let's explicitly request private subnets for better practice.
			subnetConfiguration: [
				{
					cidrMask: 24,
					name: "ingress",
					subnetType: ec2.SubnetType.PUBLIC,
				},
				{
					cidrMask: 24,
					name: "application",
					subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
				},
				{
					cidrMask: 28,
					name: "database",
					subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
				},
			],
		});

		// KMS key for encryption
		const key = new kms.Key(this, "LiteLLMKey", {
			enableKeyRotation: true,
			description: "KMS key for LiteLLM resources",
			removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
		});

		const s3ConfigBucket = new s3.Bucket(this, "LiteLLMS3Bucket", {
			versioned: false, // Enable versioning in production
			removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
			autoDeleteObjects: true, // Disable in production
			encryptionKey: key, // Encrypt bucket contents
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Ensure bucket is private
			enforceSSL: true, // Require SSL for access
		});
		const configYaml = fs.readFileSync(
			path.join(__dirname, "..", "..", "..", "config", "config.yaml"),
			"utf8",
		);
		new s3Deployment.BucketDeployment(this, "LiteLLMS3ConfigFileDeployment", {
			destinationBucket: s3ConfigBucket,
			sources: [s3Deployment.Source.yamlData("config.yaml", configYaml)],
			destinationKeyPrefix: "config", // Optional: put config in a prefix
			memoryLimit: 256, // Increase memory limit if needed for large files
		});

		const uiPassword = new secretsmanager.Secret(this, "LiteLLMUI", {
			description: "Secret for LiteLLM UI",
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});

		const masterKeySecret = new secretsmanager.Secret(
			this,
			"LiteLLMMasterKey",
			{
				description: "Secret for LiteLLM Master Key",
				removalPolicy: cdk.RemovalPolicy.DESTROY,
			},
		);

		// Create database construct
		const database = new DatabaseConstruct(this, "Database", {
			vpc,
			encryptionKey: key,
		});

		// Create LiteLLM service using the extracted construct
		const liteLLMService = new LiteLLMServiceConstruct(this, "LiteLLMProxy", {
			vpc,
			configBucket: s3ConfigBucket,
			configObjectKey: "config/config.yaml",
			uiPasswordSecret: uiPassword,
			masterKeySecret: masterKeySecret,
			databaseUrl: database.databaseUrl,
			databaseSecret: database.dbSecret,
		});

		// Allow inbound access from the Fargate service's security group to the DB security group
		database.allowConnectionFrom(
			liteLLMService.service.service.connections.securityGroups[0],
		);

		// --- Outputs ---
		new cdk.CfnOutput(this, "LoadBalancerDNS", {
			value: liteLLMService.service.loadBalancer.loadBalancerDnsName,
			description: "DNS name of the Application Load Balancer",
		});

		new cdk.CfnOutput(this, "ConfigBucketName", {
			value: s3ConfigBucket.bucketName,
			description: "Name of the S3 bucket storing the LiteLLM config",
		});

		new cdk.CfnOutput(this, "DatabaseSecretARN", {
			value: database.dbSecret.secretArn,
			description: "ARN of the database credentials secret in Secrets Manager",
		});

		new cdk.CfnOutput(this, "UISecretARN", {
			value: uiPassword.secretArn,
			description: "ARN of the UI password secret in Secrets Manager",
		});

		new cdk.CfnOutput(this, "MasterKeySecretARN", {
			value: masterKeySecret.secretArn,
			description: "ARN of the Master Key secret in Secrets Manager",
		});
	}
}
