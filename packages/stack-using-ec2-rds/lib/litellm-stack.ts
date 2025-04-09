import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';

export class LiteLLMStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // KMS key for encryption
    const key = new kms.Key(this, 'LiteLLMKey', {
      enableKeyRotation: true,
      description: 'KMS key for LiteLLM resources',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
    });

    // Create VPC with both public and private subnets
    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2,
    });

    // Security Group for EC2
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'LiteLLMServerSG', {
      vpc,
      description: 'Security group for LiteLLM server',
      allowAllOutbound: false,
    });

    // Allow outbound traffic only to required services
    ec2SecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS outbound traffic for package installation and API calls'
    );
    ec2SecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP outbound traffic for package installation'
    );
    ec2SecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3000),
      'Allow outbound traffic on port 3000'
    );
    ec2SecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(4000),
      'Allow outbound traffic on port 4000'
    );

    // Create IAM role for EC2 instance with principle of least privilege
    const ec2Role = new iam.Role(this, 'LiteLLMServerRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'Role for LiteLLM EC2 instance',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // Add CloudWatch Logs policy
    ec2Role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [`arn:aws:logs:${this.region}:${this.account}:log-group:/aws/litellm/*`],
    }));

    // EC2 Instance with encryption and monitoring
    const liteLLMServer = new ec2.Instance(this, 'LiteLLMServer', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: ec2SecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      role: ec2Role,
    });

    // Add tag to the instance
    cdk.Tags.of(liteLLMServer).add('Name', 'litellm-proxy');

    // Create security group for RDS
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'LiteLLMDBSecurityGroup', {
      vpc,
      description: 'Security group for LiteLLM database',
      allowAllOutbound: false,
    });

    // Allow inbound access from EC2 security group to RDS
    dbSecurityGroup.addIngressRule(
      ec2SecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from LiteLLM server'
    );

    // RDS Instance with enhanced security
    const db = new rds.DatabaseInstance(this, 'LiteLLMDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
      credentials: rds.Credentials.fromGeneratedSecret('litellmAdmin'),
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
    });

    // Output the instance ID for reference
    new cdk.CfnOutput(this, 'InstanceId', {
      value: liteLLMServer.instanceId,
      description: 'EC2 Instance ID',
    });

  }
} 