# Scaleway Deployment Guide

This guide explains how to deploy the Swedish Year Planner to Scaleway using Serverless Functions and Object Storage.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Object        │    │   Serverless    │    │   Object        │
│   Storage       │    │   Functions     │    │   Storage       │
│   (Website)     │◄───┤   (API)         │───►│   (Backups)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │
        │                        │
        └────────┬─────────────────┘
                 │
        ┌─────────▼─────────┐
        │      Users        │
        │   (Web Browser)   │
        └───────────────────┘
```

## 🚀 Quick Start

### 1. Prerequisites

- **Scaleway Account**: Sign up at [scaleway.com](https://www.scaleway.com)
- **Terraform**: Install from [terraform.io](https://www.terraform.io/downloads.html)
- **AWS CLI**: For S3 operations (install from [aws.amazon.com/cli](https://aws.amazon.com/cli/))
- **Node.js 18+**: For serverless functions

### 2. Setup Scaleway Credentials

Get your credentials from the Scaleway Console:

```bash
export SCW_ACCESS_KEY="your-access-key"
export SCW_SECRET_KEY="your-secret-key"  
export SCW_DEFAULT_PROJECT_ID="your-project-id"
```

### 3. Configure Deployment

```bash
# Copy configuration templates
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
cp .env.example .env

# Edit terraform/terraform.tfvars with your settings
nano terraform/terraform.tfvars
```

### 4. Deploy

```bash
# Deploy to production
./deploy.sh prod

# Or deploy to staging
./deploy.sh staging
```

## 📋 Detailed Setup

### Step 1: Scaleway Project Setup

1. Create a new project in Scaleway Console
2. Enable the following APIs:
   - Object Storage
   - Serverless Functions
   - IAM (for access management)

### Step 2: Infrastructure Configuration

Edit `terraform/terraform.tfvars`:

```hcl
# Scaleway region and zone
region = "fr-par"
zone   = "fr-par-1"

# Project configuration
project_name = "swedish-year-planner"
environment  = "prod"
```

### Step 3: Deploy Infrastructure

The deployment script will:

1. **Build the serverless function** package
2. **Create infrastructure** with Terraform:
   - Object Storage bucket for website
   - Object Storage bucket for backups  
   - Serverless Function namespace
   - API function with public endpoint
3. **Upload static assets** to Object Storage
4. **Deploy function code** to Serverless Functions

### Step 4: Verify Deployment

After deployment, you'll get:

```
🎉 Deployment completed successfully!

📱 Website URL: https://swedish-year-planner-prod.s3-website.fr-par.scw.cloud
🔗 API URL: https://swedish-year-planner-api-prod.functions.fnc.fr-par.scw.cloud
📦 Bucket: swedish-year-planner-prod
```

## 🔧 Development

### Local Development

```bash
# Start local development server
npm run dev

# Or with Docker
docker-compose up
```

### API Development

```bash
# Test functions locally
cd functions
npm install
npm run dev
```

### Environment Variables

For local development, copy `.env.example` to `.env`:

```bash
cp .env.example .env
# Edit .env with your credentials
```

## 🏗️ Infrastructure Details

### Object Storage

- **Website Bucket**: Hosts static files (HTML, CSS, JS)
- **Backup Bucket**: Stores user data backups
- **CORS Configuration**: Allows frontend API calls

### Serverless Functions

- **Runtime**: Node.js 18
- **Memory**: 256MB (configurable)
- **Timeout**: 30s (configurable)
- **Auto-scaling**: Handled by Scaleway

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/events` | GET/POST | Events management |
| `/api/tasks` | GET/POST | Tasks management |
| `/api/analytics` | GET | Usage analytics |
| `/api/backup` | GET/POST | Data export/import |

## 🔒 Security

### CORS Configuration

The API is configured to allow requests from:
- Your deployed website URL
- `localhost` for development
- Custom domains (if configured)

### Data Isolation

- Each user gets a unique ID
- Data is isolated by user ID
- No cross-user data access possible

### Environment Variables

Sensitive data is stored in environment variables:
- Scaleway credentials
- API endpoints
- Environment configuration

## 📊 Monitoring

### Scaleway Console

Monitor your deployment:

1. **Object Storage**: View bucket usage and requests
2. **Serverless Functions**: Monitor invocations, errors, and logs
3. **IAM**: Manage access permissions

### Logs

Function logs are available in Scaleway Console:
- Real-time log streaming
- Error tracking
- Performance metrics

## 🔄 CI/CD (Optional)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Scaleway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install Terraform
        uses: hashicorp/setup-terraform@v2
      
      - name: Deploy
        env:
          SCW_ACCESS_KEY: ${{ secrets.SCW_ACCESS_KEY }}
          SCW_SECRET_KEY: ${{ secrets.SCW_SECRET_KEY }}
          SCW_DEFAULT_PROJECT_ID: ${{ secrets.SCW_DEFAULT_PROJECT_ID }}
        run: ./deploy.sh prod
```

## 🐛 Troubleshooting

### Common Issues

**1. Terraform Authentication Error**
```bash
# Check credentials
echo $SCW_ACCESS_KEY
echo $SCW_SECRET_KEY
echo $SCW_DEFAULT_PROJECT_ID
```

**2. S3 Upload Fails**
```bash
# Verify AWS CLI configuration
aws configure list --profile scaleway
```

**3. Function Deployment Fails**
```bash
# Check function logs in Scaleway Console
# Verify Node.js version compatibility
```

**4. CORS Errors**
```bash
# Check if API_BASE_URL is correctly set
# Verify CORS configuration in function
```

### Getting Help

- **Scaleway Documentation**: [scaleway.com/docs](https://www.scaleway.com/docs/)
- **Terraform Provider**: [registry.terraform.io/providers/scaleway/scaleway](https://registry.terraform.io/providers/scaleway/scaleway/latest/docs)
- **GitHub Issues**: Report issues in the repository

## 💰 Cost Estimation

### Typical Monthly Costs (EUR)

| Service | Usage | Cost |
|---------|-------|------|
| Object Storage | 1GB storage, 10k requests | ~€0.02 |
| Serverless Functions | 100k invocations, 1s avg | ~€0.40 |
| **Total** | Small personal use | **~€0.42/month** |

### Cost Optimization

- Function cold starts are minimal with Node.js
- Static assets cached by CDN
- Pay-per-use pricing model
- No minimum charges

## 🔮 Advanced Configuration

### Custom Domain

1. Add CNAME record: `yourapp.com` → `bucket-name.s3-website.region.scw.cloud`
2. Configure SSL certificate
3. Update CORS settings

### Database Integration

For production use, consider:
- **Scaleway Database**: PostgreSQL/MySQL
- **Redis**: For caching and sessions
- **Cockpit**: For monitoring and alerting

### Multi-Environment Setup

```bash
# Deploy multiple environments
./deploy.sh dev
./deploy.sh staging  
./deploy.sh prod
```

Each environment gets its own:
- Object Storage buckets
- Function namespace
- Isolated data

---

**Happy deploying! 🇸🇪☁️**