# VUUSH API — Railway / Docker
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
EXPOSE 3000
# Migrate must succeed, then start the API
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
