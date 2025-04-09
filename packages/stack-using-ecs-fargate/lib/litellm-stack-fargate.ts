import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3Assets from "aws-cdk-lib/aws-s3-assets";
import * as s3Deployment from "aws-cdk-lib/aws-s3-deployment";
import * as path from "node:path";
import * as fs from "node:fs";
import { getEnv } from "../utils/env";
export class LiteLLMFargateStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = new ec2.Vpc(this, "VPC", {
			maxAzs: 2,
		});
		// Create security group for RDS
		const dbSecurityGroup = new ec2.SecurityGroup(
			this,
			"LiteLLMDBSecurityGroup",
			{
				vpc,
				description: "Security group for LiteLLM database",
				allowAllOutbound: false,
			},
		);

		// KMS key for encryption
		const key = new kms.Key(this, "LiteLLMKey", {
			enableKeyRotation: true,
			description: "KMS key for LiteLLM resources",
			removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
		});
		const dbCredentials = rds.Credentials.fromGeneratedSecret("litellmAdmin");

		// RDS Instance with enhanced security
		const db = new rds.DatabaseInstance(this, "LiteLLMDB", {
			engine: rds.DatabaseInstanceEngine.postgres({
				version: rds.PostgresEngineVersion.VER_16,
			}),
			vpc,
			instanceType: ec2.InstanceType.of(
				ec2.InstanceClass.T3,
				ec2.InstanceSize.MICRO,
			),
			allocatedStorage: 20,
			credentials: dbCredentials,
			securityGroups: [dbSecurityGroup],
			storageEncrypted: true,
			storageEncryptionKey: key,
			backupRetention: cdk.Duration.days(7),
			monitoringInterval: cdk.Duration.seconds(60),
			enablePerformanceInsights: true,
			performanceInsightEncryptionKey: key,
			publiclyAccessible: false,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
			deletionProtection: false,
			databaseName: "litellm",
		});

		const s3ConfigBucket = new s3.Bucket(this, "LiteLLMS3Bucket", {
			versioned: true,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
			autoDeleteObjects: true,
		});
		const configYaml = fs.readFileSync(
			path.join(__dirname, "..", "..", "..", "config", "config.yaml"),
			"utf8",
		);
		new s3Deployment.BucketDeployment(this, "LiteLLMS3ConfigFileDeployment", {
			destinationBucket: s3ConfigBucket,
			sources: [s3Deployment.Source.yamlData("config.yaml", configYaml)],
		});

		const liteLLMService =
			new ecsPatterns.ApplicationLoadBalancedFargateService(
				this,
				"LiteLLMProxy",
				{
					vpc,
					taskImageOptions: {
						image: ecs.ContainerImage.fromRegistry("litellm/litellm"),
						environment: {
							LITELLM_MASTER_KEY: getEnv("LITELLM_MASTER_KEY"),
							LITELLM_CONFIG_BUCKET_NAME: s3ConfigBucket.bucketName,
							LITELLM_CONFIG_BUCKET_OBJECT_KEY: "config.yaml",
							AZURE_OPENAI_API_KEY: getEnv("AZURE_OPENAI_API_KEY"),
							OPENAI_API_KEY: getEnv("OPENAI_API_KEY"),
							DATABASE_USER: "litellmAdmin",
							DATABASE_PASSWORD: dbCredentials.password?.unsafeUnwrap() ?? "",
							DATABASE_PORT: "5432",
							DATABASE_HOST: db.instanceEndpoint.hostname,
							DATABASE_NAME: "litellm",
						},
						containerPort: 4000,
					},
					assignPublicIp: true,
					publicLoadBalancer: true,
					desiredCount: 1,
					circuitBreaker: {
						rollback: true,
						enable: true,
					},
				},
			);
		s3ConfigBucket.grantReadWrite(liteLLMService.taskDefinition.taskRole);
		dbCredentials.secret?.grantRead(liteLLMService.taskDefinition.taskRole);

		// Add tag to the instance
		cdk.Tags.of(liteLLMService).add("Name", "litellm-proxy");

		// Allow inbound access from EC2 security group to RDS
		for (const sg of liteLLMService.service.connections.securityGroups) {
			dbSecurityGroup.addIngressRule(
				sg,
				ec2.Port.tcp(5432),
				"Allow PostgreSQL access from LiteLLM server",
			);
		}
	}
}
