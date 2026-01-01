# node-worker.Dockerfile (analyzer)

FROM node:20-bookworm
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=development

CMD ["pnpm","dev"]
