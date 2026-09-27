# Remote state — was local state before, which meant the .tfstate file
# (holding the RDS password in plain text, per the "aws_db_instance" block
# in rds.tf) lived on a laptop with no locking and no history.
#
# Run infra/terraform/bootstrap once first to create the bucket and lock
# table this points at (see bootstrap/main.tf), then from this directory:
#   terraform init -migrate-state
terraform {
  backend "s3" {
    bucket         = "nexusretail-terraform-state-102268067799"
    key            = "environments/dev/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "nexusretail-terraform-locks"
    encrypt        = true
  }
}
