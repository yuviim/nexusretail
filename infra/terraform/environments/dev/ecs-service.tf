resource "aws_ecs_service" "app" {
  name            = "nexusretail-dev-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.private_1a.id, aws_subnet.private_1b.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name    = "nexusretail-api"
    container_port     = 8080
  }

  depends_on = [aws_lb_listener.http]

  tags = {
    Name = "nexusretail-dev-api-service"
  }
}