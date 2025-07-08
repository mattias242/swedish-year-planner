# Dockerfile for local development
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# For local development with Express
COPY local-server.js ./

# Start command
CMD ["node", "local-server.js"]