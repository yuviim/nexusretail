# Look up the current Amazon Linux 2023 AMI dynamically
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

# Your current public IP, so SSH is restricted to just you
variable "my_ip" {
  description = "Your public IP, in CIDR form, for SSH access"
  type        = string
}

# Generate an SSH key pair via Terraform (reproducible, not manually downloaded)
resource "tls_private_key" "test" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "test" {
  key_name   = "nexusretail-dev-key"
  public_key = tls_private_key.test.public_key_openssh
}

# Save the private key locally with correct permissions
resource "local_sensitive_file" "private_key" {
  content         = tls_private_key.test.private_key_pem
  filename        = "${path.module}/nexusretail-dev-key.pem"
  file_permission = "0400"
}

# Security Group — SSH from your IP only, all outbound allowed
resource "aws_security_group" "test" {
  name        = "nexusretail-dev-test-sg"
  description = "Test SG for verifying public/private connectivity"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH from my IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "nexusretail-dev-test-sg"
  }
}

# The test EC2 instance
resource "aws_instance" "test" {
  ami                         = data.aws_ami.amazon_linux.id
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.public_1a.id
  vpc_security_group_ids      = [aws_security_group.test.id]
  key_name                    = aws_key_pair.test.key_name
  associate_public_ip_address = true

  tags = {
    Name = "nexusretail-dev-test-instance"
  }
}

output "test_instance_public_ip" {
  value = aws_instance.test.public_ip
}

output "test_security_group_id" {
  value = aws_security_group.test.id
}