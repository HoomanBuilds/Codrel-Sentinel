import { Kafka, logLevel } from "kafkajs";

export const kafka = new Kafka({
  clientId: "sentinel-analyzer",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
  logLevel : logLevel.ERROR,
  retry: { retries: 3 },
});

export const consumer = kafka.consumer({
  groupId: "sentinel-analyzer-DEV-TEST-1",
});
