# ---------------------------------------------------------------------------
# WAF Web ACL for the ALB
# Managed rule groups start in COUNT mode (log-only) so we can verify no
# false positives against the invoice upload flow before switching to BLOCK.
# The rate-based rule is BLOCK from day one — it protects against
# cost-abuse on pay-per-call services (Textract, future Bedrock calls).
# ---------------------------------------------------------------------------

resource "aws_wafv2_web_acl" "main" {
  name        = "nexusretail-dev-waf"
  description = "WAF for NexusRetail ALB"
  scope       = "REGIONAL" # REGIONAL for ALB; CLOUDFRONT scope is separate and must be us-east-1

  default_action {
    allow {}
  }

  # -------------------------------------------------------------------------
  # Rule 1: AWS Managed Core Rule Set — common exploits (XSS, LFI, etc.)
  # COUNT MODE: logs matches, does not block, until verified safe
  # -------------------------------------------------------------------------
  rule {
    name     = "AWS-AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        # SizeRestrictions_BODY was blocking real invoice uploads (~86KB
        # multipart bodies) — confirmed via WAF sampled requests on
        # 2026-08-23, RuleNameWithinRuleGroup:
        # "AWS#AWSManagedRulesCommonRuleSet#SizeRestrictions_BODY".
        # This is a false positive on legitimate traffic, not a real
        # attack signature, so it's excluded to count-only while every
        # other CRS rule stays fully enforced.
        rule_action_override {
          action_to_use {
            count {}
          }
          name = "SizeRestrictions_BODY"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "nexusretail-dev-crs"
      sampled_requests_enabled   = true
    }
  }

  # -------------------------------------------------------------------------
  # Rule 2: Known Bad Inputs — blocks known malicious payload patterns
  # COUNT MODE initially, same reasoning as above
  # -------------------------------------------------------------------------
  rule {
    name     = "AWS-AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "nexusretail-dev-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # -------------------------------------------------------------------------
  # Rule 3: SQL Injection protection — relevant given Postgres/Prisma backend
  # COUNT MODE initially
  # -------------------------------------------------------------------------
  rule {
    name     = "AWS-AWSManagedRulesSQLiRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "nexusretail-dev-sqli"
      sampled_requests_enabled   = true
    }
  }

  # -------------------------------------------------------------------------
  # Rule 4: Rate limiting — BLOCK mode from day one
  # Blocks any single IP exceeding the threshold within a 5-minute window
  # -------------------------------------------------------------------------
  rule {
    name     = "RateLimitPerIP"
    priority = 4

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "nexusretail-dev-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "nexusretail-dev-waf"
    sampled_requests_enabled   = true
  }
}

# ---------------------------------------------------------------------------
# Associate the Web ACL with the ALB
# ---------------------------------------------------------------------------
resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------
variable "waf_rate_limit" {
  description = "Max requests from a single IP per 5-minute window before blocking"
  type        = number
  default     = 2000 # generous default; tune down once you know real traffic patterns
}