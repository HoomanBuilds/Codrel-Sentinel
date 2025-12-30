import { NextRequest, NextResponse } from "next/server";
import { Kafka } from "kafkajs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRepoInstallationToken } from "@/lib/github";
import { repositories } from "@/lib/schema";

const kafka = new Kafka({
  clientId: "sentinel-dashboard",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
  retry: { retries: 3 },
});

const producer = kafka.producer();
let producerReady = false;

async function ensureProducer() {
  if (!producerReady) {
    await producer.connect();
    producerReady = true;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userIdentifier = session?.user?.email || (session?.user as any)?.login;

  if (!session || !userIdentifier) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { owner, name: repoName, installationId } = body;

  if (!owner || !repoName || !installationId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const repoId = `${owner}/${repoName}`;

  const accessToken = await getRepoInstallationToken(Number(installationId));

  const kafkaPayload = {
    type: "connection",
    repo: repoId,
    access_token: accessToken,
  };

  try {
    await ensureProducer();

    await db
      .insert(repositories)
      .values({
        id: repoId,
        name: repoName,
        owner,
        fullName: repoId,
        installationId: String(installationId),
        connectedBy: userIdentifier,
        status: "QUEUED",
      })
      .onConflictDoUpdate({
        target: repositories.id,
        set: {
          status: "QUEUED",
          updatedAt: new Date(),
        },
      });

    await producer.send({
      topic: "repo.analysis.request",
      messages: [
        {
          key: repoId,
          value: JSON.stringify(kafkaPayload),
        },
      ],
    });
  } catch(err) {
    console.log(err)
    return NextResponse.json(
      { error: "Ingestion Service Unavailable" },
      { status: 503 }
    );
  }

  return NextResponse.json({
    success: true,
    status: "queued",
    repo: repoId,
  });
}
