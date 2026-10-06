FROM node:22-alpine AS builder
WORKDIR /app
RUN echo build

FROM node:22-alpine AS runner
WORKDIR /app
  user 1000:1000
CMD ["node", "server.js"]
