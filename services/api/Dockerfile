# Build stage — installs deps, generates Prisma client, compiles TypeScript
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npx tsc

# Runtime stage — smaller final image, only what's needed to run
FROM node:20-slim
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

EXPOSE 8080
CMD ["node", "dist/index.js"]