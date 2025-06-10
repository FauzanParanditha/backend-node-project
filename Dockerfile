# Use official Node.js base image
FROM node:20-alpine AS base

# Install OS dependencies
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the application
COPY . .

# Optional: if you use .env or .key in production, mount them via volume instead of copy
# COPY .env .env
# COPY .key .key

# Expose the app port (update if your app uses a different port)
EXPOSE 5001

# Start the app
CMD ["node", "src/index.js"]
