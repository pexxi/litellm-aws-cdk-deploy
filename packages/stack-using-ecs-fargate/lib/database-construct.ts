import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import type * as kms from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

export interface DatabaseConstructProps {
	vpc: ec2.Vpc;
	encryptionKey: kms.Key;
}

export class DatabaseConstruct extends Construct {
	public readonly dbSecret: rds.DatabaseSecret;
	public readonly dbInstance: rds.DatabaseInstance;
	public readonly dbSecurityGroup: ec2.SecurityGroup;
	public readonly databaseName: string;
	public readonly databaseUrl: string;

	constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
		super(scope, id);

		// Create security group for RDS
		this.dbSecurityGroup = new ec2.SecurityGroup(
			this,
			"DatabaseSecurityGroup",
			{
				vpc: props.vpc,
				description: "Security group for LiteLLM database",
				allowAllOutbound: false, // Keep outbound restricted unless needed
			},
		);

		// Create a secret for the database credentials
		this.dbSecret = new rds.DatabaseSecret(this, "DBSecret", {
			username: "postgres",
			secretName: "litellm-db-credentials", // Optional: provide a name
		});

		this.databaseName = "litellm"; // Specify the database name

		// Single RDS PostgreSQL instance (t3.micro) - more cost-effective than Aurora
		this.dbInstance = new rds.DatabaseInstance(this, "DB", {
			engine: rds.DatabaseInstanceEngine.postgres({
				version: rds.PostgresEngineVersion.VER_16_8, // Use PostgreSQL 16.8
			}),
			credentials: rds.Credentials.fromSecret(this.dbSecret), // Get credentials from Secrets Manager
			instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO), // Cost-efficient t3.micro
			vpc: props.vpc,
			vpcSubnets: {
				// Place the instance in private isolated subnets
				subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
			},
			securityGroups: [this.dbSecurityGroup],
			storageEncrypted: true, // Ensure storage encryption is enabled
			storageEncryptionKey: props.encryptionKey, // Use our KMS key for storage encryption
			allocatedStorage: 20, // Minimum allocated storage in GB
			maxAllocatedStorage: 100, // Maximum storage scaling limit in GB (enables storage autoscaling)
			backupRetention: cdk.Duration.days(7), // Configure backup retention
			preferredBackupWindow: "03:00-04:00", // Backup window (UTC)
			databaseName: this.databaseName, // Specify the initial database name
			copyTagsToSnapshot: true, // Copy tags to DB snapshots
			removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
			deletionProtection: false, // Change to true for production
			// Performance Insights is not included to reduce costs
		});

		// Construct database URL for application
		this.databaseUrl = `postgresql://${this.dbSecret.secretValueFromJson("username").unsafeUnwrap()}:${this.dbSecret.secretValueFromJson("password").unsafeUnwrap()}@${this.dbInstance.instanceEndpoint.hostname}:${this.dbInstance.instanceEndpoint.port}/${this.databaseName}`;
	}

	// Method to allow access from a security group
	public allowConnectionFrom(securityGroup: ec2.ISecurityGroup): void {
		this.dbSecurityGroup.addIngressRule(
			securityGroup,
			ec2.Port.tcp(this.dbInstance.instanceEndpoint.port),
			"Allow access to database",
		);
	}
}
