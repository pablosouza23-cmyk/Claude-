# Servidor PARTYVERSE (multiplayer + arquivos do cliente). Node 22 (SQLite embutido).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DB_PATH=/data/partyverse.db
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "--no-warnings", "dist/server/main.js"]
