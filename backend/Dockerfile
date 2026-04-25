FROM node:bookworm-slim

WORKDIR /app

# Minimal runtime dependency: Python interpreter for plugins.py + train.py.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

ENV NODE_ENV=production
ENV PYTHON_EXECUTABLE=python3
ENV PYTHON_PIPELINE_DIR=/app/python_pipeline
ENV PYTHON_SCRIPT_TIMEOUT_MS=120000

EXPOSE 5000

CMD ["npm", "start"]
