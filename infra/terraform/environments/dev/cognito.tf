resource "aws_cognito_user_pool" "main" {
  name = "nexusretail-dev-user-pool"

  username_attributes     = ["email"]
  auto_verified_attributes = ["email"]

  # Closed off self-signup deliberately. Cognito's SignUp API is public by
  # definition (the app client ID ships in the frontend bundle), and this
  # user pool has a custom:tenant_id attribute that decides which tenant's
  # data a user can see. Leaving self-signup open meant anyone could call
  # SignUp, set custom:tenant_id to any UUID they could get their hands on,
  # and read that tenant's data. Users are provisioned by an admin via
  # AdminCreateUser instead, which is the only path that also creates the
  # matching row in our own `users` table — see auth.ts for why the API
  # doesn't trust this claim anymore either.
  admin_create_user_config {
    allow_admin_create_user_only = true
  }

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

  # Belt-and-suspenders on top of disabling self-signup: even an
  # authenticated user calling UpdateUserAttributes can't touch
  # custom:tenant_id from this client. Every other standard attribute is
  # still writable so profile edits keep working.
  write_attributes = ["email", "name", "family_name", "given_name"]
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_app_client_id" {
  value = aws_cognito_user_pool_client.app.id
}
resource "aws_cognito_user_group" "super_admin" {
  name         = "super-admin"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Platform-level administrators with cross-tenant access"
}