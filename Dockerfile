# Repo-root Dockerfile so Railway works even if Root Directory is not set.
# Builds the VUUSH API from /platform

FROM node:22-alpine AS build
WORKDIR /app
COPY platform/package.json platform/package-lock.json ./
RUN npm ci
COPY platform/ .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY platform/package.json platform/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY platform/drizzle ./drizzle
EXPOSE 3000
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
