resource "aws_route53_zone" "app" {
  name = "nexusretail.yuvarajai.com"

  tags = {
    Name = "nexusretail-dev-zone"
  }
}

output "nameservers" {
  value = aws_route53_zone.app.name_servers
}
resource "aws_acm_certificate" "app" {
  domain_name       = "nexusretail.yuvarajai.com"
  validation_method = "DNS"

  tags = {
    Name = "nexusretail-dev-cert"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.app.domain_validation_options : dvo.domain_name => {
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

resource "aws_acm_certificate_validation" "app" {
  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}
