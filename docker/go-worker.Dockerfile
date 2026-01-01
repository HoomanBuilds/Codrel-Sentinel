FROM golang:1.24-bookworm AS build
WORKDIR /app

RUN apt-get update && apt-get install -y \
    librdkafka-dev \
    pkg-config \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o worker

FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    librdkafka1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/worker ./worker

CMD ["./worker"]
