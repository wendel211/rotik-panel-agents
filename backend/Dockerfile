FROM node:22-alpine AS dependencies
WORKDIR /workspace/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /workspace/backend/dist ./dist
COPY --chown=node:node backend/scripts ./scripts
COPY --chown=node:node db/init ./db/init

USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3333}/health" > /dev/null || exit 1

CMD ["sh", "-c", "npm run db:deploy && npm start"]
