# DB Subnet Group — tells RDS which private subnets it can use
resource "aws_db_subnet_group" "main" {
  name       = "nexusretail-dev-db-subnet-group"
  subnet_ids = [aws_subnet.private_1a.id, aws_subnet.private_1b.id]

  tags = {
    Name = "nexusretail-dev-db-subnet-group"
  }
}

# Security Group for RDS — only allows traffic FROM the ECS tasks SG
resource "aws_security_group" "rds" {
  name        = "nexusretail-dev-rds-sg"
  description = "RDS security group - allows Postgres only from ECS tasks"
  vpc_id      = aws_vpc.main.id


  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "nexusretail-dev-rds-sg"
  }
}

# The DB password used to be generated fresh by `random_password` on every
# apply that didn't already have it in state. That's exactly what bit us
# after a state-loss incident: state forgets the old value, a fresh apply
# generates a new one and tries to push it onto the live instance and the
# stored secret, desyncing both from every client that already has the old
# credential cached. Reading the CURRENT value back out of Secrets Manager
# instead makes this idempotent — Terraform stops being able to invent a
# password out of thin air, and can only ever reflect what's actually
# there. Rotate deliberately (update the secret, then ModifyDBInstance),
# not as a side effect of recovering from an unrelated apply.
data "aws_secretsmanager_secret" "db_credentials" {
  name = "nexusretail-dev-db-credentials"
}

data "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = data.aws_secretsmanager_secret.db_credentials.id
}

locals {
  db_password = jsondecode(data.aws_secretsmanager_secret_version.db_credentials.secret_string).password
}

# Container for the credentials — still Terraform-managed for lifecycle
# purposes, but its value now comes from local.db_password above, not from
# a resource Terraform can regenerate on its own.
resource "aws_secretsmanager_secret" "db_credentials" {
  name = "nexusretail-dev-db-credentials"
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "nexusretail_admin"
    password = local.db_password
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# The RDS instance itself
resource "aws_db_instance" "main" {
  identifier     = "nexusretail-dev-db"
  engine         = "postgres"
  engine_version = "16.14"
  instance_class = "db.t4g.micro"
  allocated_storage = 20
  storage_type      = "gp3"

  db_name  = "nexusretail"
  username = "nexusretail_admin"
  password = local.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az             = false
  publicly_accessible  = false

  # After a state-loss incident, random_password.db_password can't be
  # re-imported (the random provider has no external system to import that
  # value back from), so a fresh apply would generate a brand new password
  # and try to push it onto this already-running instance — desyncing it
  # from every already-connected client and cached secret. Ignoring changes
  # to password here means Terraform stops trying to manage this instance's
  # credential after initial creation; rotate it deliberately (through
  # Secrets Manager + a manual ModifyDBInstance call) if you ever need to,
  # not as an incidental side effect of an unrelated apply.
  lifecycle {
    ignore_changes = [password]
  }

  # Deliberate for a dev/portfolio environment, not an oversight: this
  # database gets torn down and reseeded regularly, and a final snapshot or
  # a real backup window just adds cost and teardown latency for data that
  # isn't meant to survive anyway. A prod environment for this same app
  # would flip both: skip_final_snapshot = false and a real
  # backup_retention_period (7+ days), plus multi_az = true.
  skip_final_snapshot     = true
  backup_retention_period = 1

  tags = {
    Name = "nexusretail-dev-db"
  }
}

output "rds_endpoint" {
  value = aws_db_instance.main.endpoint
}
resource "aws_secretsmanager_secret" "database_url" {
  name = "nexusretail-dev-database-url"
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://${aws_db_instance.main.username}:${local.db_password}@${aws_db_instance.main.address}:5432/${aws_db_instance.main.db_name}?schema=public"

  lifecycle {
    ignore_changes = [secret_string]
  }
}