FROM node:22-alpine AS builder
WORKDIR /app
RUN echo build

FROM node:22-alpine AS runner
WORKDIR /app
USER node
CMD ["node", "server.js"]
