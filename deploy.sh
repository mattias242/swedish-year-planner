#!/bin/bash

# Swedish Year Planner - Simplified Scaleway Deployment Script
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

# Handle help flag
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Swedish Year Planner - Deployment Script"
    echo ""
    echo "Usage: $0 [ENVIRONMENT] [REGION] [OPTIONS]"
    echo ""
    echo "Arguments:"
    echo "  ENVIRONMENT    Deployment environment (default: prod)"
    echo "  REGION         Scaleway region (default: fr-par)"
    echo ""
    echo "Options:"
    echo "  --local        Run local development server instead of deploying"
    echo "  --test         Run tests before deployment"
    echo "  --skip-tests   Skip running tests before deployment"
    echo ""
    echo "Examples:"
    echo "  $0                    # Deploy to prod in fr-par (with tests)"
    echo "  $0 staging           # Deploy to staging in fr-par (with tests)"
    echo "  $0 prod nl-ams       # Deploy to prod in nl-ams (with tests)"
    echo "  $0 --local           # Start local development server"
    echo "  $0 --test            # Run tests only"
    echo "  $0 --skip-tests      # Deploy without running tests"
    echo ""
    exit 0
fi

# Handle local development mode
if [ "$1" = "--local" ]; then
    printf "${BLUE}🇸🇪 Swedish Year Planner - Local Development Mode${NC}\n"
    printf "${YELLOW}Starting local development server...${NC}\n"
    
    cd functions
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        printf "${YELLOW}Installing dependencies...${NC}\n"
        npm install
    fi
    
    # Start local server with file storage
    printf "${GREEN}✅ Starting server on http://localhost:3000${NC}\n"
    printf "${BLUE}Storage type: local (JSON files in ./data)${NC}\n"
    printf "${BLUE}Press Ctrl+C to stop${NC}\n"
    echo ""
    
    STORAGE_TYPE=local NODE_ENV=development npm run dev:local
    exit 0
fi

# Handle test mode
if [ "$1" = "--test" ]; then
    printf "${BLUE}🇸🇪 Swedish Year Planner - Test Mode${NC}\n"
    printf "${YELLOW}Running tests...${NC}\n"
    
    cd functions
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        printf "${YELLOW}Installing dependencies...${NC}\n"
        npm install
    fi
    
    # Run tests
    npm test
    exit $?
fi

printf "${BLUE}🇸🇪 Swedish Year Planner - Scaleway Deployment${NC}\n"
printf "${BLUE}Environment: ${ENVIRONMENT}${NC}\n"
printf "${BLUE}Region: ${REGION}${NC}\n"
printf "\n"

# Check required tools
check_tool() {
    if ! command -v $1 &> /dev/null; then
        printf "${RED}❌ $1 is not installed. Please install it first.${NC}\n"
        exit 1
    fi
}

printf "${YELLOW}🔧 Checking required tools...${NC}\n"
check_tool "scw"
check_tool "node"
check_tool "npm"
check_tool "zip"
printf "${GREEN}✅ All required tools are available${NC}\n"

# Check Scaleway CLI configuration
printf "${YELLOW}🔑 Checking Scaleway CLI configuration...${NC}\n"
if ! scw config get default-project-id &> /dev/null; then
    printf "${RED}❌ Scaleway CLI not configured. Please run:${NC}\n"
    echo "scw init"
    exit 1
fi

# Get current config
SCW_PROJECT_ID=$(scw config get default-project-id)
SCW_REGION=$(scw config get default-region || echo $REGION)

printf "${GREEN}✅ Scaleway CLI configured${NC}\n"
printf "${BLUE}Project ID: ${SCW_PROJECT_ID}${NC}\n"
printf "${BLUE}Region: ${SCW_REGION}${NC}\n"

# Run tests before deployment (optional)
if [ "$1" != "--skip-tests" ]; then
    printf "${YELLOW}🧪 Running tests before deployment...${NC}\n"
    cd functions
    
    # Install all dependencies for testing
    npm install
    
    # Run tests
    npm test
    if [ $? -ne 0 ]; then
        printf "${RED}❌ Tests failed. Deployment aborted.${NC}\n"
        printf "${YELLOW}Run with --skip-tests to bypass this check${NC}\n"
        exit 1
    fi
    
    printf "${GREEN}✅ All tests passed${NC}\n"
    cd ..
fi

# Build function package
printf "${YELLOW}📦 Building function package...${NC}\n"
cd functions

# Clean previous builds
rm -f function.zip

# Install dependencies
npm ci --omit=dev

# Create function package with correct structure
zip -r function.zip . -x "node_modules/.bin/*" "*.log" ".DS_Store"

# Move zip to parent directory for deployment
mv function.zip ../

cd ..

# Deploy function (using existing namespace and function IDs)
if [ -n "$NAMESPACE_ID" ] && [ -n "$FUNCTION_ID" ]; then
    printf "${YELLOW}🚀 Updating existing function...${NC}\n"
    scw function deploy namespace-id=$NAMESPACE_ID name=api runtime=node20 zip-file=function.zip
    
    # Set environment variables if we have credentials
    if [ -n "$SCW_ACCESS_KEY" ] && [ -n "$SCW_SECRET_KEY" ]; then
        printf "${YELLOW}🔧 Setting environment variables for Object Storage...${NC}\n"
        scw function function update \
            function-id=$FUNCTION_ID \
            environment-variables.SCW_ACCESS_KEY="$SCW_ACCESS_KEY" \
            environment-variables.SCW_SECRET_KEY="$SCW_SECRET_KEY" \
            environment-variables.BUCKET_NAME="$BUCKET_NAME" \
            region=$SCW_REGION
        printf "${GREEN}✅ Object Storage enabled${NC}\n"
    else
        printf "${YELLOW}⚠️  No Object Storage credentials - using in-memory fallback${NC}\n"
    fi
else
    printf "${RED}❌ NAMESPACE_ID and FUNCTION_ID required in .env file${NC}\n"
    printf "${YELLOW}Please add these to your .env file:${NC}\n"
    echo "NAMESPACE_ID=252e6879-01b4-452a-83cf-95d61195ad79"
    echo "FUNCTION_ID=dc67de62-a37a-4b18-b01f-5bba61945af0"
    exit 1
fi

# Get function endpoint
FUNCTION_ENDPOINT=$(scw function function get function-id=$FUNCTION_ID region=$SCW_REGION -o json | jq -r '.domain_name')
API_URL="https://${FUNCTION_ENDPOINT}"

# Update frontend configuration
printf "${YELLOW}⚙️  Updating frontend configuration...${NC}\n"
cat > config.js << EOF
// Scaleway deployment configuration
window.APP_CONFIG = {
    API_BASE_URL: '${API_URL}',
    ENVIRONMENT: '${ENVIRONMENT}',
    VERSION: '1.0.0',
    ENABLE_CLOUD_STORAGE: true
};
EOF

# Test deployment with static files (if AWS CLI is available)
if command -v aws &> /dev/null; then
    printf "${YELLOW}📤 Uploading static files to Object Storage...${NC}\n"
    
    # Upload files using AWS CLI for S3-compatible storage
    aws s3 cp index.html s3://$BUCKET_NAME/ --endpoint-url=https://s3.$SCW_REGION.scw.cloud
    aws s3 cp styles.css s3://$BUCKET_NAME/ --endpoint-url=https://s3.$SCW_REGION.scw.cloud
    aws s3 cp script.js s3://$BUCKET_NAME/ --endpoint-url=https://s3.$SCW_REGION.scw.cloud
    aws s3 cp config.js s3://$BUCKET_NAME/ --endpoint-url=https://s3.$SCW_REGION.scw.cloud
    aws s3 cp error.html s3://$BUCKET_NAME/ --endpoint-url=https://s3.$SCW_REGION.scw.cloud 2>/dev/null || echo "error.html not found, skipping"
    
    printf "${GREEN}✅ Static files uploaded${NC}\n"
    
    # Get website URL
    WEBSITE_URL="https://${BUCKET_NAME}.s3-website.${SCW_REGION}.scw.cloud"
else
    printf "${YELLOW}⚠️  AWS CLI not found - static files not uploaded${NC}\n"
    WEBSITE_URL="Not available (AWS CLI required)"
fi

# Test API endpoint
printf "${YELLOW}🧪 Testing API endpoint...${NC}\n"
if curl -s "${API_URL}/api/health" > /dev/null; then
    printf "${GREEN}✅ API endpoint is responding${NC}\n"
else
    printf "${YELLOW}⚠️  API endpoint may not be ready yet${NC}\n"
fi

# Cleanup
rm -f config.js

echo ""
printf "${GREEN}🎉 Deployment completed successfully!${NC}\n"
echo ""
printf "${BLUE}📱 Website URL: ${WEBSITE_URL}${NC}\n"
printf "${BLUE}🔗 API URL: ${API_URL}${NC}\n"
printf "${BLUE}📦 Bucket: ${BUCKET_NAME}${NC}\n"
printf "${BLUE}⚡ Function ID: ${FUNCTION_ID}${NC}\n"
echo ""
printf "${YELLOW}Next steps:${NC}\n"
echo "1. Visit the API URL to test the health endpoint"
echo "2. The app now uses Object Storage if credentials are configured"
echo "3. Check function logs: scw function function logs function-id=${FUNCTION_ID}"
echo ""
printf "${GREEN}Happy planning! 🇸🇪✨${NC}\n"

# Save deployment info
cat > deployment-info.json << EOF
{
  "environment": "${ENVIRONMENT}",
  "region": "${SCW_REGION}",
  "project_id": "${SCW_PROJECT_ID}",
  "website_url": "${WEBSITE_URL}",
  "api_url": "${API_URL}",
  "bucket_name": "${BUCKET_NAME}",
  "namespace_id": "${NAMESPACE_ID}",
  "function_id": "${FUNCTION_ID}",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "object_storage_enabled": $([ -n "$SCW_ACCESS_KEY" ] && echo "true" || echo "false")
}
EOF

printf "${BLUE}📋 Deployment info saved to deployment-info.json${NC}\n"