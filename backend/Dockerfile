# Build-Kontext ist das Projekt-Root (siehe docker-compose.yml), damit der gemeinsame
# package-lock.json der npm-Workspaces genutzt wird. npm ci installiert exakt die
# gelockten Versionen und bricht ab, wenn Lockfile und package.json nicht zusammenpassen.
# Basis-Image per Tag + Digest gepinnt: Updates nur bewusst durch Ändern dieser Zeile.
FROM node:24.22.3-alpine3.24@sha256:98e4e60b35fd50143e1838da2957488c25aa3a3efbd48bb679923f77d6d3d873
RUN apk add --no-cache netcat-openbsd
WORKDIR /app

# Erst nur die Manifeste kopieren (besseres Layer-Caching). Alle Workspace-package.json
# werden gebraucht, weil npm ci den kompletten Lockfile gegen sie prüft.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# Dev-Abhängigkeiten bleiben drin: tsx wird beim Start für die Migration gebraucht
RUN npm ci --workspace=backend --no-audit --no-fund

COPY backend/ backend/
RUN npm run build --workspace=backend

WORKDIR /app/backend
RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]
