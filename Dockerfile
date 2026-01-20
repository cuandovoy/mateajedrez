# Stage 1: Build
FROM node:20-alpine AS builder

# Install yarn globally
RUN apk add --no-cache yarn

WORKDIR /app

# Copy package files first for better caching
COPY package.json yarn.lock ./

# Install dependencies
# Usamos --network-timeout para evitar timeouts en conexiones lentas
RUN yarn install --frozen-lockfile --network-timeout 1000000 || \
    (echo "Warning: frozen-lockfile failed, trying without it" && yarn install --network-timeout 1000000)

# Copy source code
COPY . .

# Build the application
RUN yarn build

# Stage 2: Production
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
