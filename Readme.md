# NexusRetail

A production-shaped, multi-tenant SaaS inventory and order management platform built on AWS, designed as a working demonstration of real-world cloud architecture — infrastructure, security, observability, and an end-to-end AI document-processing pipeline.

Built as both an AWS Solutions Architect Associate exam-prep project and a portfolio piece: every architectural decision here reflects an actual trade-off made and defended, not a tutorial checklist.

**Live demo:** https://app.nexusretail.yuvarajai.com
**Region:** eu-central-1 (Frankfurt)

---

## What's Built

### Core Platform
- **Networking:** Custom VPC with public/private subnets across two AZs, NAT Gateway, Internet Gateway, route tables
- **Compute:** ECS Fargate running the API as a containerized service behind an Application Load Balancer
- **Database:** RDS PostgreSQL in a private subnet, accessible only via a bastion host on a fixed Elastic IP
- **Auth:** Amazon Cognito (user pool, app client, admin user group) for authentication and role-based access
- **Frontend delivery:** S3 + CloudFront, with ACM-issued TLS certificates
- **DNS:** Route 53, custom domain with validated certificates for both API and frontend
- **Secrets:** AWS Secrets Manager for database credentials and connection strings — never hardcoded, never in environment files committed to git

### CI/CD
- GitHub Actions pipeline for the API: on push to `services/api/**`, builds a Docker image, pushes to ECR, and redeploys ECS, waiting for the service to stabilize before completing
- Debugged through real production issues along the way — most notably a missing `iam:PassRole` permission and a hardcoded stale task definition revision (fixed by letting ECS always resolve the latest active revision instead of pinning one)

**Known gap:** the frontend (`services/web`) does not yet have an automated deploy pipeline — it's currently built and synced to S3/CloudFront manually. This is a real, intentional callout rather than an oversight I'm hiding: the API pipeline was built first, and frontend automation is next on the roadmap below.

### Security
- **IAM least-privilege split:** ECS execution role (pulls images, writes logs) is deliberately separate from the ECS task role (grants the running application's AWS SDK calls — Textract, S3, Secrets Manager access). This distinction is easy to skip and causes silent, confusing runtime permission failures if missed.
- **AWS WAF** on the Application Load Balancer, running:
  - AWS Managed Core Rule Set (common web exploits)
  - AWS Managed Known Bad Inputs Rule Set
  - AWS Managed SQL Injection Rule Set
  - A custom rate-based rule limiting requests per IP (abuse/cost protection, since Textract and Bedrock usage is pay-per-call)
  - Verified live: a direct SQL-injection-pattern request against the deployed app returns an immediate `403` from the load balancer itself, confirmed against the corresponding CloudWatch metric

### Observability
- **CloudWatch dashboard** covering ECS (CPU, memory, running task count), ALB (request count, 5xx errors, p99 response time), and RDS (CPU, connections, free storage)
- **9 CloudWatch alarms** across those same signals, wired to an SNS topic with email notification
- **Container Insights** enabled on the ECS cluster for deeper per-task visibility
- Built and verified against real events during this project — including watching a live rolling deployment show up correctly on the dashboard (task count briefly doubling during the health-check overlap window, then settling back down)

### Cost Management
- Custom stop/start scripts (`nexusretail-stop.sh` / `nexusretail-start.sh`) that scale ECS to zero, stop RDS, and stop the bastion instance — since this runs on a live, personally-billed AWS account
- Start script waits for RDS to reach `available` before scaling ECS back up, avoiding a race condition where the app starts before its database connection target exists

### AI Invoice Processing Pipeline
A full document-intelligence workflow, working end-to-end through the real deployed UI (not scripts or mocks):

1. **Upload** — invoice files uploaded via a multipart form endpoint (`multer`), stored in S3 with lifecycle policies
2. **Extraction** — Amazon Textract's `AnalyzeExpense` API extracts structured data, including the PO number, directly from the invoice image/PDF
3. **Automatic PO lookup** — the extracted PO number is used to automatically locate the matching purchase order in RDS — no manual selection required
4. **Fuzzy line-item matching** — invoice line items are matched against the purchase order's expected items, tolerating minor discrepancies in naming/formatting
5. **Human-in-the-loop review** — a review UI presents the match comparison side-by-side, with an override capability for purchase orders flagged as uncertain
6. **Approval → real stock update** — approving a reviewed invoice writes actual inventory stock-level changes to the database

This is deliberately built as a real, working pipeline rather than a demo found or a match looks wrong, the UI surfaces that honestly (e.g., "No PO number found on this invoice — unable to automatically match it to a purchase order") rather than pretending success.

### Core Application
- Multi-tenant inventory tracking, purchase orders, and order management
- Order creation flow (customer + line items) working end to end
- Role-based views (owner/admin vs. standard user)

---

## Architecture Notes Worth Knowing

- **Task role vs. execution role** is the single most important IAM lesson from this build: the execution role only handles image pulls and log writes at container startup — it does *not* grant your application code any AWS permissions. A separate task role is required for anything your app itself calls (Textract, S3, Secrets Manager). Missing this causes confusing zero-permission failures that look like a code bug but are actually an IAM gap.
- **Terraform resource labels are not AWS resource names.** `aws_ecs_service.app` (the Terraform label) creates an AWS-side resource actually named `nexusretail-dev-api-service`. Alarms, dashboards, and scripts all have to reference the real AWS name, not the Terraform label.
- **CloudWatch percentile alarms need `extended_statistic`, not `statistic`.** `statistic = "p99"` is rejected outright; percentiles are a separate argument.
- **Multi-tier caching, health checks, and cache invalidation** are treated throughout this build the way they're treated at real scale — as genuine trade-offs, not defaults. (See `system-design-mental-model.md` in this repo for the fuller reference on these patterns.)

---

## In Progress / Blocked

- **Bedrock orchestrator agent** — code is fully written (Converse API, tool-calling pattern with extract/match/update-stock tools), blocked purely on an AWS Marketplace payment-instrument verification step, not a code issue

---

## Roadmap

- [ ] Automate frontend deployment (GitHub Actions job: build → sync to S3 → invalidate CloudFront), mirroring the existing API pipeline
- [ ] Unblock and deploy the Bedrock orchestrator agent
- [ ] Record and publish the full demo video (infrastructure + complete AI invoice feature)
- [ ] Continue SAA domain review, using this project's own architecture as the running example

---

## Tech Stack

**Cloud:** AWS (eu-central-1) — VPC, ECS Fargate, ALB, RDS PostgreSQL, Cognito, S3, CloudFront, Route 53, ACM, Secrets Manager, Textract, Bedrock, CloudWatch, SNS, ECR, WAF
**IaC:** Terraform
**CI/CD:** GitHub Actions
**Backend:** Node.js, Prisma ORM, multer
**Frontend:** Vite, React, Tailwind CSS

---

*This README reflects the actual current state of the project as of the last working session — including gaps and blockers — rather than an idealized end state.*
