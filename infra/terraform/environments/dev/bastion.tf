# Reuse the existing test key pair and SG pattern — bastion in public subnet
resource "aws_instance" "bastion" {
  ami                         = data.aws_ami.amazon_linux.id
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.public_1a.id
  vpc_security_group_ids      = [aws_security_group.test.id]
  key_name                    = aws_key_pair.test.key_name
  associate_public_ip_address = true

  tags = {
    Name = "nexusretail-dev-bastion"
  }
}

# Allow the bastion's SG to reach RDS on 5432
resource "aws_security_group_rule" "rds_from_bastion" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.test.id
}

output "bastion_public_ip" {
  value = aws_instance.bastion.public_ip
}
resource "aws_eip" "bastion" {
  instance = aws_instance.bastion.id
  domain   = "vpc"

  tags = {
    Name = "nexusretail-dev-bastion-eip"
  }
}

output "bastion_elastic_ip" {
  value = aws_eip.bastion.public_ip
}