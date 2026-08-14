resource "aws_cognito_user_pool" "main" {
  name = "nexusretail-dev-user-pool"

  username_attributes     = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  # Custom attribute: ties every user to exactly one tenant
  schema {
    name                = "tenant_id"
    attribute_data_type = "String"
    mutable             = true
    required            = false

    string_attribute_constraints {
      min_length = 1
      max_length = 64
    }
  }

  tags = {
    Name = "nexusretail-dev-user-pool"
  }
}

resource "aws_cognito_user_pool_client" "app" {
  name         = "nexusretail-dev-app-client"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  # No client secret — appropriate for a public-facing app client (frontend/CLI use)
  generate_secret = false
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_app_client_id" {
  value = aws_cognito_user_pool_client.app.id
}