# # Stage 1: Builder
# FROM node:20-alpine AS builder

# WORKDIR /usr/src/app

# COPY package*.json ./

# RUN yarn install --legacy-peer-deps

# COPY . .

# RUN yarn build

# # Stage 2: Puppeteer base for Chromium + runtime
# FROM ghcr.io/puppeteer/puppeteer:latest as production

# WORKDIR /app

# # Switch to root to install packages
# USER root

# # Install FFmpeg
# RUN apt-get update && \
#     apt-get install -y ffmpeg && \
#     apt-get clean && \
#     rm -rf /var/lib/apt/lists/*

# # Switch back to the default non-root user provided by the puppeteer image
# USER pptruser

# COPY --from=builder /usr/src/app/dist ./dist
# COPY --from=builder /usr/src/app/package*.json ./
# COPY --from=builder /usr/src/app/node_modules ./node_modules
# COPY --from=builder /usr/src/app/tsconfig*.json ./
# COPY --from=builder /usr/src/app/public ./public

# CMD ["node", "dist/main"]

# Builder stage
FROM node:18 AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

# Production stage
FROM node:18 AS production

# We don't need the standalone Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Install Chrome dependencies and FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/tsconfig*.json ./
COPY --from=builder /usr/src/app/public ./public
COPY key.json /key.json

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

USER node

CMD ["npm", "start"]
