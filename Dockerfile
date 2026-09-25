# Stage 1: Build
# node:20 no cumple el engines.node ">=22" de package.json (yarn install
# fallaba con "The engine node is incompatible" antes de este fix — bug
# preexistente, no introducido por el trabajo de SEO). Además el script de
# sitemap (scripts/generate-sitemap.ts) corre TypeScript nativo en Node, que
# requiere Node >=22.6.
FROM node:22-alpine AS builder

# Install yarn globally
RUN apk add --no-cache yarn

WORKDIR /app

# Accept build arguments for environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_NAME
ARG VITE_APP_URL
# Slug de organización (ver PublicStoreWrapper.tsx) y dominio canónico del
# sitio (ver src/lib/siteUrl.ts) — antes no estaban declarados como ARG/ENV
# acá, así que un `docker build --build-arg VITE_STORE_SLUG=...` los ignoraba
# silenciosamente y la tienda pública quedaba sin organización resuelta en
# builds que solo usaran este Dockerfile. También los necesita
# scripts/generate-sitemap.ts (hook "prebuild") para generar sitemap.xml.
ARG VITE_STORE_SLUG
ARG VITE_SITE_URL

# Set environment variables for the build process
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_STORE_SLUG=$VITE_STORE_SLUG
ENV VITE_SITE_URL=$VITE_SITE_URL

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
