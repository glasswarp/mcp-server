FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Policy markdown loaded at runtime by dist/best-practices.js (must match SKILL/docs).
COPY --from=build /app/src/ways-to-run-agents-policy.md ./dist/ways-to-run-agents-policy.md
EXPOSE 8787
CMD ["node", "dist/index.js"]
