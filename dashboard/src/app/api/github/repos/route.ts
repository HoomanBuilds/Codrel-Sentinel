import { NextRequest, NextResponse } from "next/server";
import { github } from "@/lib/github";
import { jsonDb } from "@/lib/db";

// Force dynamic to prevent Next.js from caching the empty list
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get("installationId");

  if (!installationId) {
    return NextResponse.json({ error: "Missing installationId" }, { status: 400 });
  }

  try {
    // 1. Fetch from GitHub
    console.log(`📥 Fetching repos for Installation ID: ${installationId}`);
    const rawRepos = await github.listRepos(Number(installationId));

    // 2. Fetch Local DB Status
    const connectedRepos = jsonDb.getConnectedRepos() || [];
    const connectedIds = new Set(connectedRepos.map((r: any) => r.id));

    // 3. Mark connected repos
    const enhancedRepos = rawRepos.map((repo: any) => ({
      ...repo,
      isConnected: connectedIds.has(repo.id)
    }));

    return NextResponse.json({ 
      count: enhancedRepos.length,
      repositories: enhancedRepos 
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ repositories: [] }); 
  }
}