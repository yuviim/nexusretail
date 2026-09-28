# Account ID, domain, and project prefix used across this environment's S3
# bucket names, ARNs, Route 53 records, and ACM certificates. Previously
# hardcoded (102268067799, nexusretail.yuvarajai.com) in ~10 files — the
# account ID is fine to hardcode for one person's own deployment, but S3
# bucket names are globally unique across every AWS account on earth, so a
# fork running `terraform apply` unmodified would collide with buckets this
# account already owns and fail immediately. See terraform.tfvars.example.

variable "aws_account_id" {
  description = "AWS account ID this environment deploys into. Used in S3 bucket names (to keep them globally unique) and a couple of IAM policy ARNs."
  type        = string
}

variable "domain_name" {
  description = "Root domain this environment owns in Route 53 (must already be a registered domain/hosted zone you control). The API is served at the root, the app at app.<domain_name>, and the landing page at www.<domain_name>."
  type        = string
}

variable "project_name" {
  description = "Prefix used in resource names (S3 buckets, the ECS cluster/service, IAM roles, etc.) — change this if you want to run more than one copy of this stack in the same account."
  type        = string
  default     = "nexusretail"
}
