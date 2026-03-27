# Stage 1: Build
FROM node:20-alpine AS builder

# Install yarn globally
RUN apk add --no-cache yarn

WORKDIR /app

# Accept build arguments for environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_NAME
ARG VITE_APP_URL

# Set environment variables for the build process
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_URL=$VITE_APP_URL

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

# Copy nginx configuration template
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Expose port 80
EXPOSE 80

# At startup: substitute SUPABASE_FUNCTIONS_URL into the nginx config, then start nginx.
# Only ${SUPABASE_FUNCTIONS_URL} is expanded; all nginx $variables are left untouched.
CMD ["/bin/sh", "-c", "envsubst '${SUPABASE_FUNCTIONS_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
