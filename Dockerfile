FROM node:20-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY config/ ./config/
COPY front/ ./front/
COPY backend/ ./backend/
RUN npm ci
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update \
  && apt-get install -y python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY backend/requirements.txt ./backend/requirements.txt
RUN python3 -m pip install --no-cache-dir -r backend/requirements.txt
COPY --from=build /app/dist ./dist
COPY --from=build /app/backend ./backend
ENV NODE_ENV=production
ENV PYTHON_CMD=python3
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
