import { Kafka, logLevel } from "kafkajs";

const brokers = process.env.KAFKA_BROKERS!.split(",")
if (brokers.length === 0) {
  throw new Error("KAFKA_BROKER is not set");
}

export const kafka = new Kafka({
  clientId: "sentinel-analyzer",
  brokers: brokers,
  logLevel: logLevel.ERROR,
  retry: { retries: 3 },
});

export const consumer = kafka.consumer({
  groupId: "sentinel-analyzer-DEV-TEST-1",
});
