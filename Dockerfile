FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server.js db.js ./

ENV NODE_ENV=production
ENV PORT=3004

EXPOSE 3004

CMD ["node", "server.js"]
