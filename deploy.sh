#!/bin/bash

# Swedish Year Planner - Scaleway Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-prod}
REGION=${2:-fr-par}
PROJECT_NAME="swedish-year-planner"

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
check_tool "terraform"
check_tool "aws" # For S3 operations
echo -e "${GREEN}✅ All required tools are available${NC}"

# Check environment variables
if [ -z "$SCW_ACCESS_KEY" ] || [ -z "$SCW_SECRET_KEY" ] || [ -z "$SCW_DEFAULT_PROJECT_ID" ]; then
    echo -e "${RED}❌ Missing Scaleway credentials. Please set:${NC}"
    echo "export SCW_ACCESS_KEY=\"your-access-key\""
    echo "export SCW_SECRET_KEY=\"your-secret-key\""
    echo "export SCW_DEFAULT_PROJECT_ID=\"your-project-id\""
    exit 1
fi

# Build function package
echo -e "${YELLOW}📦 Building function package...${NC}"
cd functions
npm install --production
zip -r function.zip . -x node_modules/.bin/\* \*.log
cd ..

# Create placeholder zip for terraform
echo -e "${YELLOW}🏗️  Creating Terraform placeholder...${NC}"
echo "placeholder" > terraform/placeholder.zip

# Initialize and apply Terraform
echo -e "${YELLOW}🏗️  Deploying infrastructure with Terraform...${NC}"
cd terraform

if [ ! -f "terraform.tfvars" ]; then
    echo -e "${YELLOW}⚠️  Creating terraform.tfvars from example...${NC}"
    cp terraform.tfvars.example terraform.tfvars
    echo -e "${YELLOW}📝 Please edit terraform.tfvars with your configuration${NC}"
fi

terraform init
terraform plan -var="environment=${ENVIRONMENT}" -var="region=${REGION}"
terraform apply -var="environment=${ENVIRONMENT}" -var="region=${REGION}" -auto-approve

# Get outputs
BUCKET_NAME=$(terraform output -raw bucket_name)
API_FUNCTION_ID=$(terraform output -raw function_id)
WEBSITE_URL=$(terraform output -raw website_url)
API_URL=$(terraform output -raw api_url)

cd ..

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

# Update script.js to use API if available
echo -e "${YELLOW}🔧 Updating frontend to use serverless API...${NC}"
sed -i.bak 's/localStorage\.getItem/this.getFromStorage/g' script.js
sed -i.bak 's/localStorage\.setItem/this.saveToStorage/g' script.js

# Add API integration to script.js
cat >> script.js << 'EOF'

// API Integration for Scaleway deployment
class APIClient {
    constructor() {
        this.baseURL = window.APP_CONFIG?.API_BASE_URL || '';
        this.userId = this.getUserId();
    }

    getUserId() {
        let userId = localStorage.getItem('user_id');
        if (!userId) {
            userId = 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
            localStorage.setItem('user_id', userId);
        }
        return userId;
    }

    async request(endpoint, options = {}) {
        if (!this.baseURL) return null;
        
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': this.userId,
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn('API request failed, falling back to local storage:', error);
            return null;
        }
    }

    async saveEvents(events) {
        return await this.request('/api/events', {
            method: 'POST',
            body: JSON.stringify(events)
        });
    }

    async loadEvents() {
        return await this.request('/api/events');
    }

    async saveTasks(tasks) {
        return await this.request('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(tasks)
        });
    }

    async loadTasks() {
        return await this.request('/api/tasks');
    }

    async getAnalytics() {
        return await this.request('/api/analytics');
    }

    async exportData() {
        return await this.request('/api/backup');
    }

    async importData(data) {
        return await this.request('/api/backup', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
}

// Extend YearPlanner with API integration
if (typeof YearPlanner !== 'undefined') {
    const originalClass = YearPlanner;
    
    YearPlanner = class extends originalClass {
        constructor() {
            super();
            this.api = new APIClient();
            this.loadFromAPI();
        }

        async loadFromAPI() {
            try {
                const [events, tasks] = await Promise.all([
                    this.api.loadEvents(),
                    this.api.loadTasks()
                ]);
                
                if (events) {
                    this.events = events;
                    localStorage.setItem('events', JSON.stringify(events));
                }
                if (tasks) {
                    this.tasks = tasks;
                    localStorage.setItem('tasks', JSON.stringify(tasks));
                }
                
                // Re-render if data was loaded from API
                if (events || tasks) {
                    this.renderEvents();
                    this.renderTasks();
                    this.renderTimeline();
                    this.renderUnfinishedTasks();
                    this.renderFutureOverview();
                    this.renderDashboard();
                }
            } catch (error) {
                console.warn('Failed to load from API:', error);
            }
        }

        saveToStorage() {
            // Save to localStorage (existing functionality)
            localStorage.setItem('events', JSON.stringify(this.events));
            localStorage.setItem('tasks', JSON.stringify(this.tasks));
            
            // Also save to API
            this.api.saveEvents(this.events);
            this.api.saveTasks(this.tasks);
        }
    };
}
EOF

# Deploy static assets to Object Storage
echo -e "${YELLOW}☁️  Deploying static assets to Object Storage...${NC}"

# Configure AWS CLI for Scaleway S3
aws configure set aws_access_key_id $SCW_ACCESS_KEY --profile scaleway
aws configure set aws_secret_access_key $SCW_SECRET_KEY --profile scaleway
aws configure set region $REGION --profile scaleway

# Upload static files
aws s3 sync . s3://$BUCKET_NAME \
    --profile scaleway \
    --endpoint-url https://s3.${REGION}.scw.cloud \
    --exclude "*.sh" \
    --exclude "*.md" \
    --exclude ".git/*" \
    --exclude "node_modules/*" \
    --exclude "terraform/*" \
    --exclude "functions/*" \
    --exclude "*.zip" \
    --exclude "*.bak" \
    --exclude ".claude/*" \
    --cache-control "public, max-age=31536000" \
    --content-type "text/html" \
    --exclude "*" \
    --include "*.html"

aws s3 sync . s3://$BUCKET_NAME \
    --profile scaleway \
    --endpoint-url https://s3.${REGION}.scw.cloud \
    --exclude "*" \
    --include "*.css" \
    --cache-control "public, max-age=31536000" \
    --content-type "text/css"

aws s3 sync . s3://$BUCKET_NAME \
    --profile scaleway \
    --endpoint-url https://s3.${REGION}.scw.cloud \
    --exclude "*" \
    --include "*.js" \
    --cache-control "public, max-age=31536000" \
    --content-type "application/javascript"

# Update function with actual code
echo -e "${YELLOW}🚀 Updating serverless function...${NC}"
aws s3 cp functions/function.zip s3://$BUCKET_NAME/function.zip \
    --profile scaleway \
    --endpoint-url https://s3.${REGION}.scw.cloud

# Deploy function (you'll need the Scaleway CLI for this)
if command -v scw &> /dev/null; then
    echo -e "${YELLOW}📡 Updating function code...${NC}"
    scw function deploy $API_FUNCTION_ID --zip-file functions/function.zip
else
    echo -e "${YELLOW}⚠️  Scaleway CLI not found. Please update function manually:${NC}"
    echo "Function ID: $API_FUNCTION_ID"
    echo "Zip file: functions/function.zip"
fi

# Cleanup
rm -f script.js.bak
rm -f config.js
rm -f terraform/placeholder.zip

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📱 Website URL: ${WEBSITE_URL}${NC}"
echo -e "${BLUE}🔗 API URL: ${API_URL}${NC}"
echo -e "${BLUE}📦 Bucket: ${BUCKET_NAME}${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Visit the website URL to test your deployment"
echo "2. The app now uses serverless functions for data persistence"
echo "3. Monitor your function logs in the Scaleway console"
echo ""
echo -e "${GREEN}Happy planning! 🇸🇪✨${NC}"