# Remote state — was local state before, which meant the .tfstate file
# (holding the RDS password in plain text, per the "aws_db_instance" block
# in rds.tf) lived on a laptop with no locking and no history.
#
# Terraform's backend block can't reference variables — it has to be
# resolved before any variable is — so bucket/dynamodb_table are left
# unset here (a "partial" backend config) instead of hardcoding this
# account's bucket name, and supplied at init time instead. They must
# match what infra/terraform/bootstrap creates (bucket:
# "<project_name>-terraform-state-<aws_account_id>", table:
# "<project_name>-terraform-locks" — see bootstrap/main.tf), so run
# bootstrap first, then from this directory:
#   terraform init \
#     -backend-config="bucket=<project_name>-terraform-state-<aws_account_id>" \
#     -backend-config="dynamodb_table=<project_name>-terraform-locks"
# (add -migrate-state if you're moving off local state rather than
# initializing fresh).
terraform {
  backend "s3" {
    key     = "environments/dev/terraform.tfstate"
    region  = "eu-central-1"
    encrypt = true
  }
}
