# Stage 1: Build
FROM node:20-alpine AS builder
# Stage 1: Build
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy dependency graphs
COPY package.json package-lock.json tsconfig.json ./

# Install ALL dependencies (termasuk devDependencies untuk build types)
RUN npm ci

# Copy all source code
COPY . .

# Compile TypeScript to dist/
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

# Install ONLY production dependencies to minimize runtime image size
# Copy dependency graphs
COPY package.json package-lock.json tsconfig.json ./

# Install ALL dependencies (termasuk devDependencies untuk build types)
RUN npm ci

# Copy all source code
COPY . .

# Compile TypeScript to dist/
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

# Install ONLY production dependencies to minimize runtime image size
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Copy public static assets if your app serves them (e.g., swagger docs, images)
COPY --from=builder /app/public ./public

EXPOSE 5001

CMD ["node", "dist/index.js"]

CMD ["node", "dist/index.js"]