FROM node:22-alpine AS builder
USER node
RUN echo build

FROM node:22-alpine
COPY --from=builder /app /app
CMD ["node", "dist/main.js"]
