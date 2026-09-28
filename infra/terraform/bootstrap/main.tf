# Bootstrap for remote Terraform state. This has to stay on local state
# itself — you can't store the state that describes your state backend
# inside that same backend — so it's a separate, tiny root applied once
# before anything else.
#
# Usage:
#   cd infra/terraform/bootstrap
#   terraform init
#   terraform apply
#   # then add infra/terraform/environments/dev/backend.tf (already in this
#   # repo) and run, from environments/dev:
#   terraform init -migrate-state
#
# Why this exists: environments/dev was using local state, which means the
# .tfstate file — holding the RDS password in plain text, among everything
# else — lived on whichever laptop last ran `terraform apply`, with no
# locking, so two concurrent applies could corrupt it.

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = "eu-central-1"
}

variable "aws_account_id" {
  description = "AWS account ID this deploys into — folded into the state bucket's name to keep it globally unique. Must match the value used in environments/dev's terraform.tfvars."
  type        = string
}

variable "project_name" {
  description = "Prefix for the state bucket and lock table names. Must match environments/dev's terraform.tfvars."
  type        = string
  default     = "nexusretail"
}

resource "aws_s3_bucket" "tf_state" {
  bucket = "${var.project_name}-terraform-state-${var.aws_account_id}"
}

resource "aws_s3_bucket_versioning" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tf_state" {
  bucket                  = aws_s3_bucket.tf_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "tf_lock" {
  name         = "${var.project_name}-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}

# Seeds the RDS credentials secret. environments/dev only ever *reads* this
# secret (a data source, not a resource — see rds.tf) precisely so a fresh
# apply there can't invent a new password and desync it from the running
# instance. But a data source has to read something that already exists,
# which is impossible on a truly from-scratch account, or after a full
# teardown that deleted the secret along with everything else — this
# bootstrap stack runs first and only once, so it's the right place to
# create that starting value. Rotate deliberately after this (update the
# secret, then a manual ModifyDBInstance), never by re-running this or
# environments/dev.
resource "random_password" "db_initial" {
  length  = 24
  special = false
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name = "nexusretail-dev-db-credentials"
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "nexusretail_admin"
    password = random_password.db_initial.result
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
