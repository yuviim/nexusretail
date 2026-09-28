#!/usr/bin/env bash
# Moves ownership of the nexusretail-dev-db-credentials secret from
# environments/dev to bootstrap, fixing the chicken-and-egg where
# environments/dev's data source had to read a secret that the same stack
# only created later in the same apply — impossible on a truly fresh
# account or after a full teardown.
#
# This is a STATE-ONLY move on the environments/dev side (terraform state
# rm never touches AWS) and an IMPORT on the bootstrap side (also
# state-only — it attaches bootstrap's state to the secret that already
# exists, it does not recreate it). Nothing in AWS is deleted, created, or
# modified by this script. Run from: infra/terraform
set -euo pipefail

DEV_DIR="environments/dev"
BOOTSTRAP_DIR="bootstrap"

echo "== Step 0: sanity checks =="
command -v terraform >/dev/null || { echo "terraform not on PATH — stop."; exit 1; }
[ -d "$DEV_DIR" ] && [ -d "$BOOTSTRAP_DIR" ] || { echo "Run this from infra/terraform — stop."; exit 1; }

echo "== Step 1: capture the secret's real identifiers from environments/dev's current state =="
cd "$DEV_DIR"
SECRET_ARN=$(terraform state show -no-color 'aws_secretsmanager_secret.db_credentials' | awk -F'"' '/^\s*arn *=/ {print $2; exit}')
VERSION_ID=$(terraform state show -no-color 'aws_secretsmanager_secret_version.db_credentials' | awk -F'"' '/^\s*id *=/ {print $2; exit}')

if [ -z "$SECRET_ARN" ] || [ -z "$VERSION_ID" ]; then
  echo "Could not read the secret ARN or version id from state — stop and check manually."
  echo "  SECRET_ARN=$SECRET_ARN"
  echo "  VERSION_ID=$VERSION_ID"
  exit 1
fi
echo "  SECRET_ARN=$SECRET_ARN"
echo "  VERSION_ID=$VERSION_ID"
cd - >/dev/null

echo "== Step 2: import both into bootstrap's state (state-only — object already exists) =="
cd "$BOOTSTRAP_DIR"
terraform init
terraform import aws_secretsmanager_secret.db_credentials "$SECRET_ARN"
terraform import aws_secretsmanager_secret_version.db_credentials "$VERSION_ID"

echo "== Step 3: plan bootstrap — should be clean (secret_string is ignore_changes'd) =="
terraform plan
echo "Read the plan above. It should show 0 changes, or at most a harmless"
echo "metadata diff — NOT a request to replace or recreate the secret."
read -p "Looked clean? (y/n) " ans
[ "$ans" = "y" ] || { echo "Stopping — do not proceed to step 4 until this is resolved."; exit 1; }
cd - >/dev/null

echo "== Step 4: remove both from environments/dev's state (state-only — AWS untouched) =="
cd "$DEV_DIR"
terraform state rm aws_secretsmanager_secret.db_credentials
terraform state rm aws_secretsmanager_secret_version.db_credentials

echo "== Step 5: plan environments/dev — should show 0 changes =="
echo "(rds.tf no longer declares these as resources, only as data sources —"
echo "the data source reads still resolve to the same real secret.)"
terraform plan
echo
echo "If that plan is clean, the transfer is done. If it isn't, do NOT apply —"
echo "paste the plan output back instead."
