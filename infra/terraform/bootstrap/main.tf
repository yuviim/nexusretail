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
  }
}

provider "aws" {
  region = "eu-central-1"
}

resource "aws_s3_bucket" "tf_state" {
  bucket = "nexusretail-terraform-state-102268067799"
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
  name         = "nexusretail-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}
