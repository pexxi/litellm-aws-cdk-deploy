# LiteLLM CDK Deployment

This is an AWS CDK project that deploys the LiteLLM infrastructure including:
- EC2 Instance
- Auto Scaling Group
- RDS PostgreSQL Database

## Prerequisites

- Node.js (v14.x or later)
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the TypeScript code:
```bash
npm run build
```

3. Deploy the stack:
```bash
cdk deploy
```

## Useful Commands

* `npm run build`           compile typescript to js
* `npm run watch`           watch for changes and compile
* `npm run cdk:deploy`      deploy this stack to your default AWS account/region
* `npm run cdk:diff`        compare deployed stack with current state
* `npm run cdk:synth`       emits the synthesized CloudFormation template

## Security Notes

- The RDS database credentials are managed through AWS Secrets Manager
- The VPC is configured with public subnets for simplicity, but you may want to adjust this for production use
- Make sure to review the security groups and network access before deploying to production

## Clean Up

To destroy the deployed resources:
```bash
npm run cdk:destroy
``` 