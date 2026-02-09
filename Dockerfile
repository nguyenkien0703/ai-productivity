FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS production

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++
COPY --from=builder /app/dist ./dist
COPY server.js ./
COPY server/ ./server/
COPY shared/ ./shared/

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3004

EXPOSE 3004

CMD ["node", "server.js"]
