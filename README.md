# LiteLLM CDK Deployment

**Project Overview:**

This project provides an AWS Cloud Development Kit (CDK) setup to deploy a scalable and persistent LiteLLM proxy service on AWS. LiteLLM acts as a unified interface to interact with various Large Language Model (LLM) APIs. This deployment sets up the necessary AWS infrastructure to host this proxy reliably.

**Infrastructure Deployed:**

The CDK stack provisions the following core components:
- **EC2 Instance within an Auto Scaling Group (ASG):** Runs the LiteLLM proxy application, ensuring high availability and scalability based on demand.
- **RDS PostgreSQL Database:** Provides persistent storage, potentially used by LiteLLM for logging, key management, or configuration storage (depending on how LiteLLM is configured).
- **VPC and Networking:** Sets up the necessary network infrastructure (VPC, subnets, security groups).
- **Secrets Manager:** Securely stores and manages the RDS database credentials.

This setup allows you to have a self-hosted, centralized endpoint for managing and routing requests to different LLM providers within your AWS environment.

## Prerequisites

- Node.js (v14.x or later)
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Build the TypeScript code:
    ```bash
    npm run build
    ```

3.  Deploy the stack:
    ```bash
    cdk deploy
    ```

## Useful Commands

*   `npm run build`           compile typescript to js
*   `npm run watch`           watch for changes and compile
*   `npm run cdk:deploy`      deploy this stack to your default AWS account/region
*   `npm run cdk:diff`        compare deployed stack with current state
*   `npm run cdk:synth`       emits the synthesized CloudFormation template

## Security Notes

- The RDS database credentials are managed through AWS Secrets Manager.
- The VPC is configured with public subnets for simplicity. **It is strongly recommended to review and adjust VPC, subnet, and Security Group configurations for production environments to limit exposure.**
- Ensure you understand the network access rules before deploying to production.

## Clean Up

To destroy the deployed resources:
```bash
npm run cdk:destroy
