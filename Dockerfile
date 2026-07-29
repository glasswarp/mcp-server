# Glama / local Install Server — MCP over stdio (bridge to hosted endpoint).
# Fly production HTTP image: Dockerfile.http (see fly.toml).
FROM node:22-alpine
WORKDIR /app

COPY packages/mcp/package.json packages/mcp/package-lock.json ./
RUN npm ci --omit=dev

COPY packages/mcp/bin ./bin
COPY packages/mcp/README.md packages/mcp/LICENSE ./

ENV NODE_ENV=production
# Optional at runtime: GLASSWARP_API_KEY / GLASSWARP_MCP_URL
ENTRYPOINT ["node", "bin/glasswarp-mcp.js"]
