import { NextRequest, NextResponse } from "next/server";
import { Kafka, Partitioners, logLevel } from "kafkajs";
import { jsonDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";

const kafkaBroker = process.env.KAFKA_BROKER || "localhost:9092";

const kafka = new Kafka({
  clientId: "sentinel-dashboard",
  brokers: [kafkaBroker],
  // We keep retries low so it fails fast, but we DO NOT silence errors anymore
  retry: {
    retries: 0 
  }
});

const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userIdentifier = session?.user?.email || (session?.user as any)?.login;

  if (!session || !session.user || !userIdentifier) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { repoId, name: repoName, owner, installationId } = body;

    const jobId = uuid();
    
    try {
      await producer.connect();
      await producer.send({
        topic: "repo-connect",
        messages: [{ value: JSON.stringify({
          jobId, githubId: repoId, owner, repoName, 
          installationId: Number(installationId), 
          userEmail: userIdentifier, type: "full_ingestion", timestamp: Date.now()
        }) }],
      });
      await producer.disconnect();
      console.log(`✅ [Ingestion] Job sent to Kafka: ${repoName}`);
    } catch (kafkaError: any) {
      console.error("❌ Kafka Offline. Aborting.");
      return NextResponse.json({ 
        error: "Ingestion Service Unavailable (Kafka Down)" 
      }, { status: 503 });
    }

    jsonDb.addConnectedRepo({
      id: repoId,
      name: repoName,
      owner,
      installationId,
      connectedBy: userIdentifier,
      status: "INGESTING",
      jobId
    });

    return NextResponse.json({ 
      success: true, 
      status: "ingesting", 
      message: "Ingestion Started" 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}