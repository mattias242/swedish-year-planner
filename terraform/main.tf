terraform {
  required_version = ">= 1.0"
  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.0"
    }
  }
}

# Configure the Scaleway Provider
provider "scaleway" {
  zone   = var.zone
  region = var.region
}

# Variables
variable "zone" {
  description = "The Scaleway zone"
  type        = string
  default     = "fr-par-1"
}

variable "region" {
  description = "The Scaleway region"
  type        = string
  default     = "fr-par"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "swedish-year-planner"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# Object Storage Bucket for static assets
resource "scaleway_object_bucket" "website" {
  name   = "${var.project_name}-${var.environment}"
  region = var.region
  
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "POST", "PUT", "DELETE"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }

  website {
    index_document = "index.html"
    error_document = "error.html"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Object Storage Bucket for backups
resource "scaleway_object_bucket" "backups" {
  name   = "${var.project_name}-backups-${var.environment}"
  region = var.region
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "backups"
    ManagedBy   = "terraform"
  }
}

# Function Namespace
resource "scaleway_function_namespace" "main" {
  name        = "${var.project_name}-${var.environment}"
  description = "Swedish Year Planner Functions"
  
  environment_variables = {
    NODE_ENV     = var.environment
    FRONTEND_URL = "https://${scaleway_object_bucket.website.name}.s3-website.${var.region}.scw.cloud"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Main API Function
resource "scaleway_function" "api" {
  name         = "api"
  namespace_id = scaleway_function_namespace.main.id
  runtime      = "node18"
  handler      = "index.handler"
  privacy      = "public"
  description  = "Main API function for Swedish Year Planner"
  
  # Will be updated via deployment script
  zip_file = "placeholder.zip"

  deploy = true
  
  environment_variables = {
    NODE_ENV = var.environment
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Function    = "api"
    ManagedBy   = "terraform"
  }
}

# Function Domain
resource "scaleway_function_domain" "api" {
  function_id = scaleway_function.api.id
  hostname    = "${var.project_name}-api-${var.environment}.functions.fnc.fr-par.scw.cloud"
}

# Container Registry Namespace for future use
resource "scaleway_container_registry_namespace" "main" {
  name        = "${var.project_name}-${var.environment}"
  description = "Container registry for Swedish Year Planner"
  is_public   = false

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Outputs
output "website_url" {
  description = "Website URL"
  value       = "https://${scaleway_object_bucket.website.name}.s3-website.${var.region}.scw.cloud"
}

output "api_url" {
  description = "API URL"
  value       = "https://${scaleway_function_domain.api.hostname}"
}

output "bucket_name" {
  description = "S3 bucket name for website"
  value       = scaleway_object_bucket.website.name
}

output "backup_bucket_name" {
  description = "S3 bucket name for backups"
  value       = scaleway_object_bucket.backups.name
}

output "function_namespace_id" {
  description = "Function namespace ID"
  value       = scaleway_function_namespace.main.id
}

output "function_id" {
  description = "API function ID"
  value       = scaleway_function.api.id
}