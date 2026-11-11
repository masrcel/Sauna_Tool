FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache openssl
COPY --from=builder /app/dist /usr/share/nginx/html
# Template wird beim Start mit ${DOMAIN} gerendert -> /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY ssl-init.sh /docker-entrypoint.d/15-ssl-init.sh
RUN chmod +x /docker-entrypoint.d/15-ssl-init.sh
EXPOSE 80 443
