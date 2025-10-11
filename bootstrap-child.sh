#!/usr/bin/env bash
set -euo pipefail

# Prereqs: aws CLI, jq, cdk CLI (latest) installed in PATH.

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <child-account-id> [<child-account-id> ...]"
  exit 1
fi

# Get the management (current) account ID to trust in bootstraps
MGMT_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"

# Wait until account is ACTIVE
wait_for_active() {
  local account_id=$1
  echo "Waiting for account $account_id to become ACTIVE..."
  for i in {1..60}; do
    status=$(aws organizations describe-account --account-id "$account_id" --query "Account.Status" --output text 2>/dev/null || echo "UNKNOWN")
    if [[ "$status" == "ACTIVE" ]]; then
      echo "  -> Account $account_id is ACTIVE."
      return 0
    fi
    echo "  status=$status; retrying in 5s..."
    sleep 5
  done
  echo "Timed out waiting for account $account_id to become ACTIVE" >&2
  exit 1
}

bootstrap_account() {
  local account_id=$1

  wait_for_active "$account_id"

  echo "Assuming OrganizationAccountAccessRole in $account_id..."
  creds_json=$(aws sts assume-role \
    --role-arn "arn:aws:iam::${account_id}:role/OrganizationAccountAccessRole" \
    --role-session-name "cdk-bootstrap-${account_id}" \
    --duration-seconds 3600)

  export AWS_ACCESS_KEY_ID=$(echo "$creds_json" | jq -r '.Credentials.AccessKeyId')
  export AWS_SECRET_ACCESS_KEY=$(echo "$creds_json" | jq -r '.Credentials.SecretAccessKey')
  export AWS_SESSION_TOKEN=$(echo "$creds_json" | jq -r '.Credentials.SessionToken')

  echo "Bootstrapping account $account_id in region $REGION (trusting $MGMT_ACCOUNT_ID)..."
  cdk bootstrap "aws://${account_id}/${REGION}" \
    --trust "${MGMT_ACCOUNT_ID}" \
    --trust-for-lookup "${MGMT_ACCOUNT_ID}" \
    --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
    --require-approval=never

  echo "Cleaning up temporary credentials for $account_id"
  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
}

for child in "$@"; do
  bootstrap_account "$child"
done

echo "✅ Bootstrapped all provided child accounts."
