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
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-dev \
    python3-venv \
    python3-pip \
    build-essential \
  && rm -rf /var/lib/apt/lists/*
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip \
  && python -m pip install --no-cache-dir -r backend/requirements.txt
COPY --from=build /app/dist ./dist
COPY --from=build /app/backend ./backend
ENV NODE_ENV=production
ENV PYTHON_CMD=/opt/venv/bin/python
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
