
# Build de React
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

COPY . .

# Configuración pública de Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_STORE_SLUG
ARG VITE_APP_NAME
ARG VITE_RECAPTCHA_SITE_KEY
ARG VITE_WHATSAPP_SALES_NUMBER
ARG VITE_SOCIAL_INSTAGRAM
ARG VITE_SOCIAL_FACEBOOK
ARG VITE_SOCIAL_WHATSAPP
ARG VITE_APP_URL

RUN yarn build

# Servidor web liviano
FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
