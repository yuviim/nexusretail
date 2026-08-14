# ECS Cluster — logical grouping, no servers to manage with Fargate
resource "aws_ecs_cluster" "main" {
  name = "nexusretail-dev-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "nexusretail-dev-cluster"
  }
}

# Security Group for the ALB — public-facing, allows HTTP from anywhere
resource "aws_security_group" "alb" {
  name        = "nexusretail-dev-alb-sg"
  description = "ALB security group - allows public HTTP"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "nexusretail-dev-alb-sg"
  }
}

# Security Group for ECS tasks — only allows traffic FROM the ALB
resource "aws_security_group" "ecs_tasks" {
  name        = "nexusretail-dev-ecs-tasks-sg"
  description = "ECS tasks security group - allows traffic only from ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "App port from ALB only"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "nexusretail-dev-ecs-tasks-sg"
  }
}