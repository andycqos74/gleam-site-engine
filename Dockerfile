# Site engine with in-place editing. One image runs any site: THEME picks the design and content model from
# /app/themes (built in: qos, starter; mount your own at /app/themes/<name>), and each container keeps its own
# content (database + uploaded photos) in its /data volume.

FROM node:22-bookworm-slim AS deps
# Compilers in case better-sqlite3 has no prebuilt binary for this platform; they stay out of the final image.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# `docker build --target test .` runs the automated tests.
FROM deps AS test
RUN npm ci
COPY . .
RUN npm test

FROM node:22-bookworm-slim AS final
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    THEME=qos \
    TZ=Europe/London
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
COPY themes ./themes
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:8080/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "src/server.js"]
