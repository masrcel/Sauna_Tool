# Build-Kontext ist das Projekt-Root (siehe docker-compose.yml), damit der gemeinsame
# package-lock.json der npm-Workspaces genutzt wird. npm ci installiert exakt die
# gelockten Versionen und bricht ab, wenn Lockfile und package.json nicht zusammenpassen.
# Basis-Images per Tag + Digest gepinnt: Updates nur bewusst durch Ändern dieser Zeilen.
FROM node:24.22.3-alpine3.24@sha256:98e4e60b35fd50143e1838da2957488c25aa3a3efbd48bb679923f77d6d3d873 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace=frontend --no-audit --no-fund
COPY frontend/ frontend/
RUN npm run build --workspace=frontend

FROM nginx:1.30.6-alpine3.24@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311
RUN apk add --no-cache openssl
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
# Template wird beim Start mit ${DOMAIN} gerendert -> /etc/nginx/conf.d/default.conf
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY frontend/ssl-init.sh /docker-entrypoint.d/15-ssl-init.sh
RUN chmod +x /docker-entrypoint.d/15-ssl-init.sh
EXPOSE 80 443
