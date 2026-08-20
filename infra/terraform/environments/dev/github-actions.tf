resource "aws_iam_user" "github_actions" {
  name = "nexusretail-dev-github-actions"
}

resource "aws_iam_user_policy" "github_actions_deploy" {
  name = "nexusretail-dev-github-actions-deploy"
  user = aws_iam_user.github_actions.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "arn:aws:ecr:eu-central-1:102268067799:repository/nexusretail-dev-api"
      },
      {
        Sid    = "ECSDeploy"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition"
        ]
        Resource = "*"
      },
      {
        Sid    = "PassECSRoles"
        Effect = "Allow"
        Action = ["iam:PassRole"]
        Resource = [
          aws_iam_role.ecs_execution_role.arn,
          aws_iam_role.ecs_task_role.arn
        ]
      }
    ]
  })
}

resource "aws_iam_access_key" "github_actions" {
  user = aws_iam_user.github_actions.name
}

output "github_actions_access_key_id" {
  value = aws_iam_access_key.github_actions.id
}

output "github_actions_secret_access_key" {
  value     = aws_iam_access_key.github_actions.secret
  sensitive = true
}