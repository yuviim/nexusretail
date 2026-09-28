# Deploying the real AWS stack

The [Quick start](../Readme.md#quick-start) runs this app locally with no
AWS account. This document is for provisioning the real infrastructure —
RDS, Cognito, S3, Textract, ECS, CloudFront — instead.

## Required variables

Both `bootstrap` and `environments/dev` take variables — copy each
directory's `terraform.tfvars.example` to `terraform.tfvars` and fill it
in. Never commit the real `terraform.tfvars` files (`*.tfvars` is already
gitignored).

| Variable | Where | What it's for |
|---|---|---|
| `aws_account_id` | bootstrap, environments/dev | Your 12-digit AWS account ID. S3 bucket names are globally unique across every AWS account, so this keeps this stack's buckets from colliding with someone else's. |
| `project_name` | bootstrap, environments/dev | Resource name prefix. Defaults to `nexusretail` — only override to run more than one copy of this stack in one account. |
| `domain_name` | environments/dev | A domain you control in Route 53. The API is served at the root, the app at `app.<domain_name>`, the landing page at `www.<domain_name>`. |
| `my_ip` | environments/dev | Your current public IP (`curl -s https://checkip.amazonaws.com`), CIDR form — locks down bastion SSH. Rotates when your ISP reassigns you a new IP; re-`apply` when SSH starts timing out. |
| `alarm_email` | environments/dev | Where CloudWatch alarms notify. Leave empty to skip. |
| `ecr_repo_uri` | environments/dev | ECR repo URI for the API image — create the ECR repository first, then paste its URI here. |
| `github_repo` | environments/dev | `owner/repo` allowed to assume the GitHub Actions deploy role. Defaults to this repo; change it if you've forked. |

## Deploy order

Each step depends on state or resources the previous one created — running
these out of order is the most common way to get a confusing error.

1. **`infra/terraform/bootstrap`** — creates the S3 bucket + DynamoDB table
   that hold this stack's remote Terraform state, and seeds the initial RDS
   credentials secret (`terraform init && terraform apply`).
2. **Migrate `environments/dev` onto that remote state** — its
   `backend.tf` is a partial config (backend blocks can't reference
   variables), so the bucket/table names go in at init time:
   ```
   cd environments/dev
   terraform init \
     -backend-config="bucket=<project_name>-terraform-state-<aws_account_id>" \
     -backend-config="dynamodb_table=<project_name>-terraform-locks"
   ```
3. **`terraform apply`** in `environments/dev` — everything else: VPC,
   RDS, Cognito, ECS, ALB, CloudFront, WAF, monitoring.
4. **Run the database migrations and Cognito backfill for real**, against
   the RDS instance this just created — see the API's own setup (SSH
   tunnel through the bastion, `npx prisma migrate deploy`, then
   `npx tsx scripts/backfill-cognito-sub.ts` if you have existing users to
   carry over).
5. **Deploy the app** — push to `main` with changes under `services/api/**`
   or `services/web/**` and the matching GitHub Actions workflow builds and
   deploys it. First push needs these GitHub Actions repository
   secrets/variables set (Settings > Secrets and variables > Actions):
   - `AWS_ROLE_ARN` — from `terraform output github_actions_role_arn`
   - `VITE_API_BASE_URL`, `VITE_COGNITO_REGION`, `VITE_COGNITO_APP_CLIENT_ID` (secrets, used at frontend build time)
   - `FRONTEND_S3_BUCKET` — from `terraform output frontend_bucket_name` (repository *variable*, not secret)
   - `FRONTEND_CLOUDFRONT_DISTRIBUTION_ID` — from `terraform output frontend_cloudfront_distribution_id` (repository *variable*)
6. **`infra/terraform/transfer_db_secret_ownership.sh`** (from
   `infra/terraform`, once, after step 3) — moves the RDS credentials
   secret's Terraform ownership from `environments/dev` to `bootstrap`,
   fixing a chicken-and-egg where `environments/dev`'s data source has to
   read a secret that only exists because `bootstrap` created it first, but
   a from-scratch `environments/dev` apply used to also try to own it as a
   resource. Read the script before running it — it stops for confirmation
   before anything that touches real state.

## What's deliberately not parameterized

Only account ID, domain, and the S3 bucket names that embed them were
pulled into variables — those are the values that actually block a fork's
`terraform apply` (S3 bucket names are globally unique; a hardcoded
account ID in an ARN is simply wrong for anyone else). Resource names like
the ECS cluster, the Cognito user pool, or IAM role names stay as literal
`nexusretail-dev-*` strings: those are scoped to your own account and
region, not globally unique, so they don't block anything, and turning
every one of them into `${var.project_name}-dev-*` would touch dozens of
resources for no portability benefit while adding real risk of an
unintended `terraform plan` diff against an already-deployed stack.
