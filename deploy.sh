#!/bin/bash

# Swedish Year Planner - Scaleway Deployment Script
set -e

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading configuration from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (can be overridden by .env file)
ENVIRONMENT=${ENVIRONMENT:-${1:-prod}}
REGION=${REGION:-${2:-fr-par}}
PROJECT_NAME="swedish-year-planner"

# Use environment variables from .env if available
SCW_ACCESS_KEY=${SCW_ACCESS_KEY:-""}
SCW_SECRET_KEY=${SCW_SECRET_KEY:-""}
BUCKET_NAME=${BUCKET_NAME:-"${PROJECT_NAME}-${ENVIRONMENT}"}
NAMESPACE_ID=${NAMESPACE_ID:-""}
FUNCTION_ID=${FUNCTION_ID:-""}

echo -e "${BLUE}🇸🇪 Swedish Year Planner - Scaleway Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${REGION}${NC}"
echo ""

# Check required tools
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed. Please install it first.${NC}"
        exit 1
    fi
}

echo -e "${YELLOW}🔧 Checking required tools...${NC}"
check_tool "scw"
check_tool "node"
check_tool "npm"
check_tool "zip"
echo -e "${GREEN}✅ All required tools are available${NC}"

# Check Scaleway CLI configuration
echo -e "${YELLOW}🔑 Checking Scaleway CLI configuration...${NC}"
if ! scw config get default-project-id &> /dev/null; then
    echo -e "${RED}❌ Scaleway CLI not configured. Please run:${NC}"
    echo "scw init"
    exit 1
fi

# Get current config
SCW_PROJECT_ID=$(scw config get default-project-id)
SCW_REGION=$(scw config get default-region || echo $REGION)

echo -e "${GREEN}✅ Scaleway CLI configured${NC}"
echo -e "${BLUE}Project ID: ${SCW_PROJECT_ID}${NC}"
echo -e "${BLUE}Region: ${SCW_REGION}${NC}"

# Build function package
echo -e "${YELLOW}📦 Building function package...${NC}"
cd functions
npm install --production
zip -r function.zip . -x node_modules/.bin/\* \*.log
cd ..

# Create Object Storage buckets
echo -e "${YELLOW}☁️  Creating Object Storage buckets...${NC}"
BUCKET_NAME="${PROJECT_NAME}-${ENVIRONMENT}"
BACKUP_BUCKET_NAME="${PROJECT_NAME}-backups-${ENVIRONMENT}"

# Create website bucket
scw object bucket create name=${BUCKET_NAME} region=${SCW_REGION} || echo "Bucket ${BUCKET_NAME} may already exist"

# Configure bucket for website hosting
scw object bucket website set bucket=${BUCKET_NAME} index-document=index.html error-document=error.html region=${SCW_REGION}

# Set bucket CORS for API access
echo -e "${YELLOW}🔧 Configuring CORS for bucket...${NC}"
cat > cors-config.json << EOF
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "HEAD", "POST", "PUT", "DELETE"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

scw object bucket cors set ${BUCKET_NAME} cors-config.json region=${SCW_REGION}
rm cors-config.json

# Create backup bucket
scw object bucket create name=${BACKUP_BUCKET_NAME} region=${SCW_REGION} || echo "Backup bucket may already exist"

# Create Function Namespace
echo -e "${YELLOW}⚡ Creating Function Namespace...${NC}"
NAMESPACE_NAME="${PROJECT_NAME}-${ENVIRONMENT}"

# Check if namespace exists
NAMESPACE_ID=$(scw function namespace list name=${NAMESPACE_NAME} -o json | jq -r '.[0].id // empty' 2>/dev/null || echo "")

if [ -z "$NAMESPACE_ID" ]; then
    echo -e "${YELLOW}Creating new namespace: ${NAMESPACE_NAME}${NC}"
    NAMESPACE_ID=$(scw function namespace create name=${NAMESPACE_NAME} region=${SCW_REGION} -o json | jq -r '.id')
else
    echo -e "${GREEN}Using existing namespace: ${NAMESPACE_NAME} (${NAMESPACE_ID})${NC}"
fi

# Create/Update Function
echo -e "${YELLOW}🚀 Deploying serverless function...${NC}"
FUNCTION_NAME="api"

# Check if function exists
FUNCTION_ID=$(scw function function list namespace-id=${NAMESPACE_ID} name=${FUNCTION_NAME} -o json | jq -r '.[0].id // empty' 2>/dev/null || echo "")

if [ -z "$FUNCTION_ID" ]; then
    echo -e "${YELLOW}Creating new function: ${FUNCTION_NAME}${NC}"
    FUNCTION_ID=$(scw function function create \
        namespace-id=${NAMESPACE_ID} \
        name=${FUNCTION_NAME} \
        runtime=node18 \
        handler=index.handler \
        privacy=public \
        zip-file=functions/function.zip \
        region=${SCW_REGION} \
        -o json | jq -r '.id')
else
    echo -e "${YELLOW}Updating existing function: ${FUNCTION_NAME} (${FUNCTION_ID})${NC}"
    scw function function update \
        function-id=${FUNCTION_ID} \
        zip-file=functions/function.zip \
        region=${SCW_REGION}
fi

# Wait for function to be ready
echo -e "${YELLOW}⏳ Waiting for function to be ready...${NC}"
while true; do
    STATUS=$(scw function function get function-id=${FUNCTION_ID} region=${SCW_REGION} -o json | jq -r '.status')
    if [ "$STATUS" = "ready" ]; then
        break
    fi
    echo -e "${YELLOW}Function status: ${STATUS}, waiting...${NC}"
    sleep 5
done

# Get function endpoint
FUNCTION_ENDPOINT=$(scw function function get function-id=${FUNCTION_ID} region=${SCW_REGION} -o json | jq -r '.domain_name')
API_URL="https://${FUNCTION_ENDPOINT}"

# Update frontend configuration
echo -e "${YELLOW}⚙️  Updating frontend configuration...${NC}"
cat > config.js << EOF
// Scaleway deployment configuration
window.APP_CONFIG = {
    API_BASE_URL: '${API_URL}',
    ENVIRONMENT: '${ENVIRONMENT}',
    VERSION: '1.0.0'
};
EOF

# Upload static files to Object Storage
echo -e "${YELLOW}📤 Uploading static files to Object Storage...${NC}"

# Upload HTML files
scw object object put bucket=${BUCKET_NAME} key=index.html file=index.html region=${SCW_REGION} content-type=text/html cache-control="public, max-age=300"

# Upload CSS files
scw object object put bucket=${BUCKET_NAME} key=styles.css file=styles.css region=${SCW_REGION} content-type=text/css cache-control="public, max-age=31536000"

# Upload JS files
scw object object put bucket=${BUCKET_NAME} key=script.js file=script.js region=${SCW_REGION} content-type=application/javascript cache-control="public, max-age=31536000"

# Upload config file
scw object object put bucket=${BUCKET_NAME} key=config.js file=config.js region=${SCW_REGION} content-type=application/javascript cache-control="public, max-age=300"

# Create error page
cat > error.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Error - Swedish Year Planner</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #667eea; }
    </style>
</head>
<body>
    <h1>🇸🇪 Swedish Year Planner</h1>
    <h2>Oops! Page not found</h2>
    <p><a href="/">Return to Year Planner</a></p>
</body>
</html>
EOF

scw object object put bucket=${BUCKET_NAME} key=error.html file=error.html region=${SCW_REGION} content-type=text/html

# Get website URL
WEBSITE_URL="https://${BUCKET_NAME}.s3-website.${SCW_REGION}.scw.cloud"

# Test API endpoint
echo -e "${YELLOW}🧪 Testing API endpoint...${NC}"
if curl -s "${API_URL}/api/health" > /dev/null; then
    echo -e "${GREEN}✅ API endpoint is responding${NC}"
else
    echo -e "${YELLOW}⚠️  API endpoint may not be ready yet${NC}"
fi

# Cleanup
rm -f config.js error.html

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📱 Website URL: ${WEBSITE_URL}${NC}"
echo -e "${BLUE}🔗 API URL: ${API_URL}${NC}"
echo -e "${BLUE}📦 Bucket: ${BUCKET_NAME}${NC}"
echo -e "${BLUE}⚡ Function ID: ${FUNCTION_ID}${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Visit the website URL to test your deployment"
echo "2. The app now uses serverless functions for data persistence"
echo "3. Monitor your function logs: scw function log list function-id=${FUNCTION_ID}"
echo ""
echo -e "${GREEN}Happy planning! 🇸🇪✨${NC}"

# Save deployment info
cat > deployment-info.json << EOF
{
  "environment": "${ENVIRONMENT}",
  "region": "${SCW_REGION}",
  "project_id": "${SCW_PROJECT_ID}",
  "website_url": "${WEBSITE_URL}",
  "api_url": "${API_URL}",
  "bucket_name": "${BUCKET_NAME}",
  "backup_bucket_name": "${BACKUP_BUCKET_NAME}",
  "namespace_id": "${NAMESPACE_ID}",
  "function_id": "${FUNCTION_ID}",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo -e "${BLUE}📋 Deployment info saved to deployment-info.json${NC}"