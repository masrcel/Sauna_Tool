FROM node:20-alpine
RUN apk add --no-cache netcat-openbsd
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]
