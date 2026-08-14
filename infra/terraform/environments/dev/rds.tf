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

# Auto-generated DB password
resource "random_password" "db_password" {
  length  = 24
  special = false
}

# Store credentials in Secrets Manager
resource "aws_secretsmanager_secret" "db_credentials" {
  name = "nexusretail-dev-db-credentials"
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "nexusretail_admin"
    password = random_password.db_password.result
  })
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
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az             = false
  publicly_accessible  = false
  skip_final_snapshot  = true

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
  secret_string = "postgresql://${aws_db_instance.main.username}:${random_password.db_password.result}@${aws_db_instance.main.address}:5432/${aws_db_instance.main.db_name}?schema=public"
}