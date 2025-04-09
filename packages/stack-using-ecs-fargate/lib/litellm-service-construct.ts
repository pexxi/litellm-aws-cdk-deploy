import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import type { DatabaseConstruct } from "./database-construct";
import type { ConfigConstruct } from "./config-construct";

export interface LiteLLMServiceConstructProps {
	vpc: ec2.Vpc;
	database: DatabaseConstruct;
	config: ConfigConstruct;
	isProduction: boolean;
}

export class LiteLLMServiceConstruct extends Construct {
	public readonly service: ecsPatterns.ApplicationLoadBalancedFargateService;

	constructor(
		scope: Construct,
		id: string,
		props: LiteLLMServiceConstructProps,
	) {
		super(scope, id);

		const getApiKey = (key: string) => {
			return ecs.Secret.fromSecretsManager(props.config.apiSecrets, key);
		};

		// Create Fargate service with Application Load Balancer
		this.service = new ecsPatterns.ApplicationLoadBalancedFargateService(
			this,
			"Service",
			{
				vpc: props.vpc,
				taskSubnets: {
					// Run tasks in private subnets with internet access
					subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
				},
				taskImageOptions: {
					image: ecs.ContainerImage.fromRegistry(
						"ghcr.io/berriai/litellm:main-stable",
					), // Use specific tag if needed
					environment: {
						UI_USERNAME: process.env.UI_USERNAME || "admin", // Default username for LiteLLM UI
						LITELLM_CONFIG_BUCKET_NAME: props.config.configBucket.bucketName,
						LITELLM_CONFIG_BUCKET_OBJECT_KEY: props.config.configObjectKey,
						// Use the database URL
						DATABASE_URL: props.database.databaseUrl,
					},
					secrets: {
						// Inject secrets securely
						UI_PASSWORD: ecs.Secret.fromSecretsManager(
							props.config.uiPasswordSecret,
						),
						LITELLM_MASTER_KEY: ecs.Secret.fromSecretsManager(
							props.config.masterKeySecret,
						),
						AZURE_API_KEY: getApiKey("AZURE_API_KEY"),
						OPENAI_API_KEY: getApiKey("OPENAI_API_KEY"),
						ANTHROPIC_API_KEY: getApiKey("ANTHROPIC_API_KEY"),
						GROQ_API_KEY: getApiKey("GROQ_API_KEY"),
					},
					containerPort: 4000,
					logDriver: ecs.LogDrivers.awsLogs({
						// Configure CloudWatch Logs
						streamPrefix: "LiteLLMProxy",
						logRetention: props.isProduction
							? RetentionDays.ONE_MONTH
							: RetentionDays.ONE_WEEK,
					}),
				},
				assignPublicIp: false, // Fargate tasks should run in private subnets, ALB is public
				publicLoadBalancer: true, // Expose via a public ALB
				desiredCount: 1, // Start with one task
				minHealthyPercent: props.isProduction ? 100 : 50,
				circuitBreaker: {
					// Enable ECS deployment circuit breaker for production
					enable: props.isProduction,
					rollback: true,
				},
				cpu: 512, // Specify CPU units (adjust as needed)
				memoryLimitMiB: 1024, // Specify memory (adjust as needed)
				platformVersion: ecs.FargatePlatformVersion.LATEST, // Use the latest Fargate platform version
				runtimePlatform: {
					// Specify architecture if needed (e.g., for Graviton)
					operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
					cpuArchitecture: ecs.CpuArchitecture.ARM64,
				},
				// healthCheck: {
				// 	command: ["CMD-SHELL", "curl -f http://localhost:4000/ || exit 1"],
				// 	interval: cdk.Duration.seconds(30),
				// 	timeout: cdk.Duration.seconds(5),
				// 	retries: 3,
				// 	startPeriod: cdk.Duration.seconds(60), // Allow time for container to initialize
				// },
			},
		);

		// Configure ALB Health Check
		this.service.targetGroup.configureHealthCheck({
			path: "/health/readiness", // Update ALB health check to use the same endpoint
			interval: cdk.Duration.seconds(30),
			healthyThresholdCount: 2,
			unhealthyThresholdCount: 3,
			timeout: cdk.Duration.seconds(5),
		});

		// Allow inbound access from the Fargate service's security group to the DB security group
		props.database.allowConnectionFrom(
			this.service.service.connections.securityGroups[0],
		);

		// Set up permissions
		props.config.configBucket.grantRead(this.service.taskDefinition.taskRole);
		props.config.key?.grantDecrypt(this.service.taskDefinition.taskRole);
		props.config.uiPasswordSecret.grantRead(
			this.service.taskDefinition.taskRole,
		);
		props.config.masterKeySecret.grantRead(
			this.service.taskDefinition.taskRole,
		);
		props.config.apiSecrets.grantRead(this.service.taskDefinition.taskRole);
		props.database.dbSecret.grantRead(this.service.taskDefinition.taskRole);
	}
}
