import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { DatabaseConstruct } from "./database-construct";
import { LiteLLMServiceConstruct } from "./litellm-service-construct";
import { ConfigConstruct } from "./config-construct";

interface LiteLLMStackProps extends cdk.StackProps {
	isProduction: boolean;
	vpcId?: string;
}

export class LiteLLMStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, props: LiteLLMStackProps) {
		super(scope, id, props);

		const isProduction = props.isProduction;

		// Use existing VPC if vpcId is provided, otherwise create a new one
		const vpc = props.vpcId
			? ec2.Vpc.fromLookup(this, "VPC", { vpcId: props.vpcId })
			: new ec2.Vpc(this, "VPC", {
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

		// Create Config construct
		const config = new ConfigConstruct(this, "Config", {
			isProduction,
		});

		// Create database construct
		const database = new DatabaseConstruct(this, "Database", {
			vpc,
			encryptionKey: config.key,
			isProduction,
		});

		const liteLLMService = new LiteLLMServiceConstruct(this, "LiteLLMProxy", {
			vpc,
			database,
			config,
			isProduction,
		});

		// --- Outputs ---
		new cdk.CfnOutput(this, "LoadBalancerDNS", {
			value: liteLLMService.service.loadBalancer.loadBalancerDnsName,
			description: "DNS name of the Application Load Balancer",
		});

		new cdk.CfnOutput(this, "ConfigBucketName", {
			value: config.configBucket.bucketName,
			description: "Name of the S3 bucket storing the LiteLLM config",
		});

		new cdk.CfnOutput(this, "DatabaseSecretARN", {
			value: database.dbSecret.secretArn,
			description: "ARN of the database credentials secret in Secrets Manager",
		});

		new cdk.CfnOutput(this, "UISecretARN", {
			value: config.uiPasswordSecret.secretArn,
			description: "ARN of the UI password secret in Secrets Manager",
		});

		new cdk.CfnOutput(this, "MasterKeySecretARN", {
			value: config.masterKeySecret.secretArn,
			description: "ARN of the Master Key secret in Secrets Manager",
		});

		new cdk.CfnOutput(this, "ApiSecretsSecretARN", {
			value: config.apiSecrets.secretArn,
			description: "ARN of the API secrets secret in Secrets Manager",
		});
	}
}
