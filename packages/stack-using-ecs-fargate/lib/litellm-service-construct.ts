import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface LiteLLMServiceConstructProps {
  vpc: ec2.Vpc;
  configBucket: s3.Bucket;
  configObjectKey: string;
  uiPasswordSecret: secretsmanager.Secret;
  masterKeySecret: secretsmanager.Secret;
  databaseUrl: string;
  databaseSecret: secretsmanager.Secret;
}

export class LiteLLMServiceConstruct extends Construct {
  public readonly service: ecsPatterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: LiteLLMServiceConstructProps) {
    super(scope, id);

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
            "ghcr.io/berriai/litellm:main-latest",
          ), // Use specific tag if needed
          environment: {
            UI_USERNAME: "admin", // Default username for LiteLLM UI
            LITELLM_CONFIG_BUCKET_NAME: props.configBucket.bucketName,
            LITELLM_CONFIG_BUCKET_OBJECT_KEY: props.configObjectKey,
            AZURE_OPENAI_API_KEY: "placeholder", // Store sensitive keys in Secrets Manager
            OPENAI_API_KEY: "placeholder", // Store sensitive keys in Secrets Manager
            // Use the database URL
            DATABASE_URL: props.databaseUrl,
          },
          secrets: {
            // Inject secrets securely
            UI_PASSWORD: ecs.Secret.fromSecretsManager(props.uiPasswordSecret),
            LITELLM_MASTER_KEY: ecs.Secret.fromSecretsManager(props.masterKeySecret),
            // Example for API keys (create secrets for these)
            // AZURE_OPENAI_API_KEY: ecs.Secret.fromSecretsManager(secretsmanager.Secret.fromSecretNameV2(this, 'AzureApiKeySecret', 'my-azure-api-key-secret-name')),
            // OPENAI_API_KEY: ecs.Secret.fromSecretsManager(secretsmanager.Secret.fromSecretNameV2(this, 'OpenAIApiKeySecret', 'my-openai-api-key-secret-name')),
          },
          containerPort: 4000,
          logDriver: ecs.LogDrivers.awsLogs({
            // Configure CloudWatch Logs
            streamPrefix: "LiteLLMProxy",
            // logRetention: logs.RetentionDays.ONE_MONTH, // Configure log retention
          }),
        },
        assignPublicIp: false, // Fargate tasks should run in private subnets, ALB is public
        publicLoadBalancer: true, // Expose via a public ALB
        desiredCount: 1, // Start with one task
        circuitBreaker: {
          // Enable ECS deployment circuit breaker
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
      },
    );

    // Configure ALB Health Check
    this.service.targetGroup.configureHealthCheck({
      path: "/health/liveliness",
      interval: cdk.Duration.seconds(30),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
      timeout: cdk.Duration.seconds(5),
    });

    // Set up permissions
    props.configBucket.grantRead(this.service.taskDefinition.taskRole);
    props.databaseSecret.grantRead(this.service.taskDefinition.taskRole);
    props.uiPasswordSecret.grantRead(this.service.taskDefinition.taskRole);
    props.masterKeySecret.grantRead(this.service.taskDefinition.taskRole);
  }
}
