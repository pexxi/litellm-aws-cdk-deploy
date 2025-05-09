# LiteLLM CDK Deployment

**Project Overview:**

This project provides an AWS Cloud Development Kit (CDK) setup to deploy a scalable and persistent LiteLLM proxy service on AWS. LiteLLM acts as a unified interface to interact with various Large Language Model (LLM) APIs. This deployment sets up the necessary AWS infrastructure to host this proxy reliably.

**Infrastructure Deployed:**

The CDK stack provisions the following core components:
- **ECS Fargate Service with Application Load Balancer:** Runs the LiteLLM proxy application in containers, ensuring high availability and scalability based on demand.
- **RDS PostgreSQL Database:** Provides persistent storage, potentially used by LiteLLM for logging, key management, or configuration storage (depending on how LiteLLM is configured).
- **S3 Bucket:** Stores the LiteLLM configuration file (`config.yaml`).
- **VPC and Networking:** Sets up the necessary network infrastructure (VPC, subnets, security groups).
- **Secrets Manager:** Securely stores and manages the RDS database credentials and application secrets.

This setup allows you to have a self-hosted, centralized endpoint for managing and routing requests to different LLM providers within your AWS environment.

**Key Features:**

- **Scalable LiteLLM Proxy:** Utilizes ECS Fargate for a serverless, scalable proxy deployment.
- **Persistent Storage:** Leverages RDS PostgreSQL for data persistence needs.
- **Secure Configuration:** Manages sensitive data like API keys and database credentials using AWS Secrets Manager.
- **Centralized Configuration:** Uses an S3 bucket for storing and managing the LiteLLM `config.yaml`.
- **Environment-Specific Deployments:** Supports distinct configurations for `development` and `production` environments.
    - **Production Safeguards:** Includes resource retention policies (S3, KMS, SecretsManager, RDS), S3 bucket versioning, RDS deletion protection, and ECS deployment circuit breakers to protect production workloads.
    - **Development Convenience:** Uses more destructive default policies in non-production environments for easier cleanup and iteration.
- **Container Health Checks:** Implements robust health checks for the LiteLLM service to ensure reliability.

## Prerequisites

- Node.js (v14.x or later)
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

## Deployment

1.  Copy the example environment file and edit as needed:
    ```bash
    cp packages/stack-using-ecs-fargate/.env.example packages/stack-using-ecs-fargate/.env
    # Edit .env with your credentials and secrets
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Build the TypeScript code:
    ```bash
    npm run build
    ```

4.  Deploy the stack:

    For a **development** deployment (default, with resources configured for easier cleanup):
    ```bash
    npm run cdk:deploy
    ```

    For a **production** deployment (with enhanced data protection and safety features):
    ```bash
    ENV=production npm run cdk:deploy
    ```

## Environment Variables

Environment variables are required for deployment and operation. See `packages/stack-using-ecs-fargate/.env.example` for all required variables:
- `CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION`: AWS account and region
- `AZURE_OPENAI_API_KEY`, `OPENAI_API_KEY`: API keys for LLM providers
- `LITELLM_MASTER_KEY`, `UI_USERNAME`, `UI_PASSWORD`: Application secrets
- `ENV`: (Optional) Specifies the deployment environment (e.g., `production`). If not set, defaults to a development-like deployment. Controls resource retention policies, S3 versioning, RDS deletion protection, and other environment-specific settings.

## Configuration

- The LiteLLM configuration file is stored in the S3 bucket and can be customized in `config/config.yaml` before deployment.
- The VPC is configured with both public and private subnets. **It is strongly recommended to review and adjust VPC, subnet, and Security Group configurations for production environments to limit exposure.**
- Ensure you understand the network access rules before deploying to production.
- **Production deployments (`ENV=production`) automatically enable stricter resource protection measures**, including S3 bucket versioning, RDS deletion protection, and retention policies for critical resources like KMS keys and secrets.

## Useful Commands

*   `npm run build`           compile typescript to js
*   `npm run watch`           watch for changes and compile
*   `npm run cdk:deploy`      deploy this stack to your default AWS account/region
*   `npm run cdk:diff`        compare deployed stack with current state
*   `npm run cdk:synth`       emits the synthesized CloudFormation template
*   `npm run cdk:destroy`     destroy the deployed resources

## Security Notes

- The RDS database credentials and application secrets are managed through AWS Secrets Manager.
- The VPC is configured with both public and private subnets. **It is strongly recommended to review and adjust VPC, subnet, and Security Group configurations for production environments to limit exposure.**
- Ensure you understand the network access rules before deploying to production.

## Clean Up

To destroy the deployed resources:
```bash
npm run cdk:destroy
```
