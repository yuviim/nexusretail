# NexusRetail

I built this to answer a question I couldn't shake after 18 years in architecture roles: what do system design decisions actually look like when you implement them yourself, end to end, in a real AWS account, and live with what you chose?

NexusRetail is a multi-tenant inventory and order management platform with a full AI invoice-reconciliation pipeline. The product itself isn't really the point — I picked it because it's messy enough to force real decisions across networking, compute, identity, multi-tenancy, security, AI document processing, CI/CD, and observability, all in one system instead of as separate exercises. Every decision here reflects a real trade-off I made and can defend, not a tutorial checklist.

I also used this project as my hands-on companion while studying for the AWS Solutions Architect Associate exam — most of the domains show up somewhere in this build, not as abstract concepts but as things I actually had to configure, break, and fix.

**Live app:** https://app.nexusretail.yuvarajai.com**

**Landing page:** https://www.nexusretail.yuvarajai.com**

**Full architecture walkthrough (video):** https://youtu.be/K_kagA2orUU**

**Region:** eu-central-1 (Frankfurt)**

---

## What's Built

### Core Platform

Custom VPC across two availability zones, split into public and private subnets — not because it's best practice, but because I wanted a specific failure mode closed off: my database and application containers have no direct route to the internet at all, regardless of what security group rule I might get wrong elsewhere. ECS Fargate runs the API behind an Application Load Balancer. RDS PostgreSQL sits in the private subnet, reachable only through the application or a bastion host on a fixed Elastic IP. Cognito handles authentication and tenant-scoped access. The frontend is served through S3 and CloudFront with ACM-issued certificates, and Route 53 handles DNS across three separate subdomains — the API, the app, and a landing page — each with its own certificate and deploy lifecycle. Secrets Manager holds database credentials; nothing sensitive is hardcoded or committed to git.

### Landing Page

A separate, independently deployed static site at `www.nexusretail.yuvarajai.com` — its own S3 bucket, its own CloudFront distribution, completely decoupled from the application frontend. I split it out deliberately: a marketing page and an authenticated product have different deploy cadences and different risk profiles, and I didn't want a copy tweak on the landing page anywhere near the same pipeline as the actual app.

### CI/CD

Two independent GitHub Actions pipelines, and I want to be honest about how the second one came to exist. I built the API pipeline first — push to `services/api/**` builds a Docker image, pushes to ECR, and redeploys ECS, waiting for the service to stabilize. Along the way I hit a missing `iam:PassRole` permission and a hardcoded stale task definition revision, both real bugs, both fixed.

Partway through building the invoice feature, I realized the frontend had never had automated deploy at all — I'd been building and syncing it to S3 by hand the whole time. That wasn't part of the plan; I just noticed the inconsistency while working on something else. So I built a second pipeline and scoped its IAM permissions to exactly what it needed. It broke on the first real run — the build succeeded but shipped a broken API URL, because the GitHub Actions runner never had access to the `VITE_API_BASE_URL` environment variable my local `.env` file provides. Fixed it by wiring the variable through as a GitHub repository secret and passing it into the build step explicitly. Both pipelines are now green and tested against real pushes.

### Security

The execution role and task role for ECS are deliberately separate — the execution role only pulls images and writes logs, the task role is what my application code actually uses to call S3, Textract, and Secrets Manager. I got this wrong the first time: I built the Textract integration, deployed it, and hit access-denied, because I'd assumed the execution role's permissions covered my own code too. They don't. Two different identities, two different trust boundaries.

AWS WAF sits in front of the load balancer running the Managed Core Rule Set, Known Bad Inputs, SQL Injection protection, and a rate-based rule I wrote myself. I didn't just turn blocking on — I ran the managed rule sets in count-only mode first, specifically to check they wouldn't false-positive against my own invoice upload flow, then verified them live: a direct SQL-injection-pattern request against the deployed app returns an immediate `403` from the load balancer, confirmed against the corresponding CloudWatch metric.

I actually found two separate WAF false positives after switching to full enforcement, both against the exact same invoice upload endpoint, both from real PDF uploads rather than synthetic testing. The first was `SizeRestrictions_BODY` blocking a genuinely-sized invoice file. The second, found a day later on a freshly generated test PDF, was `CrossSiteScripting_BODY` — something in the PDF's binary structure was tripping a signature-based XSS rule. Both diagnosed the same way: pull the WAF sampled requests, find the exact rule name, exclude only that rule to count-only, document why in the Terraform comment, leave every other rule fully enforced. Neither fix touches anything else in the rule set.

### Observability

A CloudWatch dashboard covering ECS CPU, memory, and running task count, ALB request count, 5xx errors, and p99 response time, and RDS CPU, connections, and free storage — all defined as Terraform, not clicked together. Nine alarms wired to an SNS topic with email notification. I've watched this catch a real event: during a deployment, ECS task count briefly went to two while the replacement task passed its health check, then back to one once the old one drained. Because the metrics were there, I could tell that was a normal rolling deployment, not an incident.

### Cost Management

Since this runs on a personally-billed AWS account, I built a single startup script that checks my current IP against what's allowed in the security group, updates and applies Terraform automatically if it's changed, starts the bastion and RDS and waits for each to actually be ready before continuing, scales ECS back up, opens the SSH tunnel I use for database access, and finishes with a real health check against the live API and app URLs. A matching shutdown script scales everything back down. Both exist because I was manually chasing IP changes and race conditions between services often enough that it was worth automating properly.

### AI Invoice Processing Pipeline

This is the part of the project I spent the most time getting right, because the interesting part isn't the AI extraction — it's the decision about how much to trust it.

An uploaded invoice is stored in S3 first, as a durable object independent of the application container. Amazon Textract's `AnalyzeExpense` API extracts vendor, PO number, and line items — I chose it over writing my own PDF parsing specifically because positional/regex-based extraction breaks the moment a supplier changes their invoice template, and Textract is built to handle that variation. The extracted PO number is used to automatically look up the matching purchase order, no manual selection. Line items are compared using fuzzy matching, since supplier descriptions rarely match internal product names exactly — I tuned the matching threshold by running real invoice variations through it and watching where it produced false flags versus missed genuine mismatches.

Here's the decision I actually care about: I could have made this pipeline fully automatic — extract, match, update stock, done. I didn't. When the match is confident, stock updates immediately. When it isn't, the system stops and shows a person exactly what didn't align, with nothing changing in the database until they approve or explicitly flag it. If Textract can't find a PO number at all, the upload fails cleanly with an explicit message rather than guessing or silently creating a bad record. I decided the cost of a wrong automatic stock update is higher than the cost of asking someone to look at a genuinely ambiguous case. That's not a limitation I'm working around — that's the actual design.

### Core Application

Multi-tenant inventory tracking, purchase orders, and order management, with an end-to-end order creation flow and role-based views separating owner/admin access from standard users.

---

## Architecture Notes Worth Knowing

**Task role vs. execution role** is the single most important IAM lesson from this build. The execution role only handles image pulls and log writes at container startup — it does not grant your application code any AWS permissions. A separate task role is required for anything your app itself calls. Missing this causes confusing zero-permission failures that look like a code bug but are actually an IAM gap, and it's completely invisible in most tutorials because they never separate the two.

**Terraform resource labels are not AWS resource names.** `aws_ecs_service.app` in the Terraform code creates a real AWS resource actually named `nexusretail-dev-api-service`. Every script, alarm, and dashboard reference has to use the real AWS name, not the Terraform label — I hit this confusion more than once early on.

**CloudWatch percentile alarms need `extended_statistic`, not `statistic`.** Writing `statistic = "p99"` gets rejected outright by Terraform's provider validation, since percentiles aren't a standard statistic — they're a separate argument entirely. Small thing, but the kind of error you only catch by actually running `terraform plan` against real AWS validation.

**A CDN-fronted S3 bucket will return `403`, not `404`, for a route it doesn't recognize.** This matters for single-page apps: if CloudFront's error handling only maps `404 → index.html` (the standard SPA fallback), a request for a path S3 genuinely can't list — which happens because the bucket has no `s3:ListBucket` permission granted to CloudFront's OAC — comes back as `403 AccessDenied` instead, and silently bypasses the SPA fallback entirely. Direct navigation to a client-side route, or a page refresh on one, breaks unless both status codes are mapped.

**WAF's body-inspection rules can false-positive on legitimate binary content**, not just malicious payloads. Both real incidents on this project were PDF uploads — one tripped a body-size rule, the other tripped an XSS-signature rule on the PDF's internal structure. Neither was a security gap; both were genuine false positives against real business documents, found by actually reading the WAF sampled requests rather than assuming a block means an attack.

**Multi-tier caching, health checks, and cache invalidation** are treated throughout this build as genuine trade-offs, not defaults. See `system-design-mental-model.md` in this repo for the fuller reference on these patterns.

---

## In Progress / Blocked

**Bedrock orchestrator agent** — the code is fully written: a tool-calling loop using the Converse API with extract, match, and update-stock tools. It's blocked on an AWS Marketplace payment-instrument issue on my account, and I've traced it as far as I currently can — eleven separate subscription attempts, each created and automatically terminated within about a minute, every time with the same payment-instrument error from Marketplace's billing system, which is separate from my regular AWS billing that works fine. I'm leaving this documented as genuinely unresolved rather than implying it works, because an honest account of an open problem is worth more than a polished description of one that doesn't actually run.

---

## Roadmap

- [x] Automate frontend deployment — done, including a real bug found and fixed in the process (see CI/CD above)
- [x] Record and publish the full architecture walkthrough — [video here](https://youtu.be/K_kagA2orUU)
- [ ] Unblock and deploy the Bedrock orchestrator agent
- [ ] Continue AWS SAA domain review, using this project's own architecture as the running example

---

## Tech Stack

**Cloud:** AWS (eu-central-1) — VPC, ECS Fargate, ALB, RDS PostgreSQL, Cognito, S3, CloudFront, Route 53, ACM, Secrets Manager, Textract, Bedrock, CloudWatch, SNS, ECR, WAF
**IaC:** Terraform
**CI/CD:** GitHub Actions
**Backend:** Node.js, Prisma ORM, multer
**Frontend:** Vite, React, Tailwind CSS

---

*This README reflects the actual current state of the project, including what's genuinely still broken. I'd rather it stayed honest than looked finished.*
