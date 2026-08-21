# ---------------------------------------------------------------------------
# Landing page: S3 + CloudFront, served at www.nexusretail.yuvarajai.com
# Separate from the app (app.nexusretail.yuvarajai.com) and API
# (nexusretail.yuvarajai.com) — purely additive, no changes to existing infra.
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "landing" {
  bucket = "nexusretail-dev-landing-102268067799"
  tags = {
    Name = "nexusretail-dev-landing"
  }
}

resource "aws_s3_bucket_public_access_block" "landing" {
  bucket                  = aws_s3_bucket.landing.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "landing" {
  name                              = "nexusretail-dev-landing-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "landing" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.landing.bucket_regional_domain_name
    origin_id                = "s3-landing"
    origin_access_control_id = aws_cloudfront_origin_access_control.landing.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-landing"
    viewer_protocol_policy = "redirect-to-https"

    # Landing pages are static and change rarely — longer TTL than the app,
    # which needs fresher cache behavior for frequent deploys.
    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  # Simple 404 handling — landing pages typically don't need client-side
  # routing the way the React app does, but this keeps a clean fallback.
  custom_error_response {
    error_code         = 404
    response_code      = 404
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  aliases = ["www.nexusretail.yuvarajai.com"]

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.landing.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name = "nexusretail-dev-landing-cdn"
  }
}

resource "aws_s3_bucket_policy" "landing" {
  bucket = aws_s3_bucket.landing.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontServicePrincipal"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.landing.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.landing.arn
        }
      }
    }]
  })
}

output "landing_cloudfront_domain" {
  value = aws_cloudfront_distribution.landing.domain_name
}

resource "aws_acm_certificate" "landing" {
  provider          = aws.us_east_1
  domain_name       = "www.nexusretail.yuvarajai.com"
  validation_method = "DNS"
  tags = {
    Name = "nexusretail-dev-landing-cert"
  }
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "landing_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.landing.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  zone_id = aws_route53_zone.app.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "landing" {
  provider                = aws.us_east_1
  certificate_arn          = aws_acm_certificate.landing.arn
  validation_record_fqdns = [for record in aws_route53_record.landing_cert_validation : record.fqdn]
}

resource "aws_route53_record" "landing" {
  zone_id = aws_route53_zone.app.zone_id
  name    = "www.nexusretail.yuvarajai.com"
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.landing.domain_name
    zone_id                = aws_cloudfront_distribution.landing.hosted_zone_id
    evaluate_target_health = false
  }
}
