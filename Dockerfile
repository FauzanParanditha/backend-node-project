# Use official Node.js base image
FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy manifest secara eksplisit (lebih deterministik daripada package*.json)
COPY package.json package-lock.json ./

# Validasi lockfile (akan fail cepat kalau lockfile corrupt / kepotong / conflict)
RUN node -e "JSON.parse(require('fs').readFileSync('package-lock.json','utf8')); console.log('package-lock.json OK')"

# Install dependencies
RUN npm ci --omit=dev

# Copy the rest of the application
COPY . .

EXPOSE 5001
CMD ["node", "src/index.js"]