# IAM role that lets ECS pull images and write logs on the task's behalf
resource "aws_iam_role" "ecs_execution_role" {
  name = "nexusretail-dev-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

# Attach AWS's managed policy covering ECR pull + CloudWatch Logs write
resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional policy — lets the execution role read the DATABASE_URL secret
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "nexusretail-dev-ecs-secrets-access"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.database_url.arn]
    }]
  })
}

# CloudWatch Log Group — where your container's stdout/stderr will go
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/nexusretail-dev-api"
  retention_in_days = 7
}

# Task Definition — the container "recipe"
resource "aws_ecs_task_definition" "app" {
  family                   = "nexusretail-dev-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc" # required for Fargate
  cpu                      = "256"    # 0.25 vCPU
  memory                   = "512"    # 512 MB
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "nexusretail-api"
      image     = "${var.ecr_repo_uri}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.database_url.arn
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = "eu-central-1"
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "nexusretail-dev-api-task"
  }
}

variable "ecr_repo_uri" {
  description = "ECR repository URI for the placeholder API image"
  type        = string
}