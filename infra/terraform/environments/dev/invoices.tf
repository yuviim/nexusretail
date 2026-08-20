resource "aws_s3_bucket" "invoices" {
  bucket = "nexusretail-dev-invoices-102268067799"

  tags = {
    Name = "nexusretail-dev-invoices"
  }
}

resource "aws_s3_bucket_public_access_block" "invoices" {
  bucket = aws_s3_bucket.invoices.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "invoices" {
  bucket = aws_s3_bucket.invoices.id

  rule {
    id     = "expire-old-invoices"
    status = "Enabled"

    filter {}

    expiration {
      days = 90
    }
  }
}

output "invoices_bucket_name" {
  value = aws_s3_bucket.invoices.bucket
}
resource "aws_iam_role_policy" "ecs_textract_access" {
  name = "nexusretail-dev-ecs-textract-access"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "TextractAccess"
        Effect = "Allow"
        Action = [
          "textract:AnalyzeDocument",
          "textract:AnalyzeExpense"
        ]
        Resource = "*"
      },
      {
        Sid    = "InvoicesBucketAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.invoices.arn}/*"
      },
      {
        Sid    = "BedrockAccess"
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:Converse"
        ]
        Resource = "*"
      }
    ]
  })
}