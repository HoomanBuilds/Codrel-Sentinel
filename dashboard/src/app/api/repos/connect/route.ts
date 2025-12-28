import { NextRequest, NextResponse } from "next/server";
import { Kafka, Partitioners } from "kafkajs";
import { jsonDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

const kafka = new Kafka({
  clientId: "sentinel-dashboard",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
});
const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoId, repoName, owner, installationId, htmlUrl } = body;

    if (!repoId || !installationId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`🔌 Connecting Repo: ${owner}/${repoName}`);
    jsonDb.addConnectedRepo({
      id: repoId,
      name: repoName,
      owner,
      htmlUrl,
      installationId
    });

    await producer.connect();
    
    const jobId = uuid();
    const payload = {
      jobId,
      githubId: repoId,
      owner,
      repoName,
      installationId: Number(installationId),
      type: "full_ingestion",
      timestamp: Date.now()
    };

    await producer.send({
      topic: "repo-connect",
      messages: [{ value: JSON.stringify(payload) }],
    });

    await producer.disconnect();

    return NextResponse.json({ 
      success: true, 
      message: "Ingestion Started", 
      jobId 
    });

  } catch (error: any) {
    console.error("Connect Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}