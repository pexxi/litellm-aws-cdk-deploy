#!/bin/bash

# Get the instance ID using the tag
INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=litellm-proxy" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text)

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
    echo "Could not find a running instance with tag 'Name=litellm-proxy'"
    exit 1
fi

echo "Found LiteLLM Proxy instance ID: $INSTANCE_ID"
echo "Waiting for instance to be ready for SSM connections..."

# Function to check if instance is ready for SSM
check_ssm_ready() {
    aws ssm describe-instance-information \
        --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
        --query 'InstanceInformationList[0].PingStatus' \
        --output text 2>/dev/null || echo "NOT_READY"
}

# Wait for SSM to be ready with timeout
MAX_ATTEMPTS=10
ATTEMPT=1
while true; do
    STATUS=$(check_ssm_ready)
    if [ "$STATUS" = "Online" ]; then
        echo "Instance is ready for SSM connections!"
        break
    fi
    
    if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
        echo "Timeout waiting for instance to be ready for SSM connections"
        exit 1
    fi
    
    echo "Attempt $ATTEMPT/$MAX_ATTEMPTS: Instance not ready yet (status: $STATUS), waiting..."
    ATTEMPT=$((ATTEMPT + 1))
    sleep 10
done

# Create a session and run commands
aws ssm send-command \
    --instance-ids $INSTANCE_ID \
    --document-name AWS-StartInteractiveCommand \
    --parameters command="sudo -i && \
    yum update -y && \
    yum install -y git docker && \
    systemctl start docker && \
    systemctl enable docker && \
    usermod -a -G docker ec2-user && \
    cd /home/ec2-user && \
    git clone https://github.com/BerriAI/litellm.git && \
    cd litellm && \
    docker compose up -d"

echo "Setup complete! LiteLLM should now be running on the instance."
echo "To access the instance in the future, use:"
echo "aws ssm start-session --target $INSTANCE_ID" 