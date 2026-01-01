import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { repoFileEvents } from "@/lib/schema";


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const { owner, repo } = await params; 
    const fullRepoName = `${owner}/${repo}`;

    let githubData = null;
    let readmeContent = "No README found.";

    try {
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
           // "Authorization": `Bearer ${process.env.GITHUB_TOKEN}` 
        }
      });
      
      if (repoRes.ok) {
        githubData = await repoRes.json();
        
        const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
          headers: { "Accept": "application/vnd.github.raw" }
        });
        if (readmeRes.ok) {
          readmeContent = await readmeRes.text();
        }
      }
    } catch (e) {
      console.warn("Failed to fetch GitHub metadata:", e);
    }

    const rawEvents = await db
      .select()
      .from(repoFileEvents)
      .where(
        and(
          or(eq(repoFileEvents.repo, fullRepoName), eq(repoFileEvents.repo, repo))
        )
      )
      .orderBy(desc(repoFileEvents.createdAt)); 

    const aggregationMap = new Map<string, {
      date: string;
      fullDate: string;
      rejected: number;
      reverted: number;
      crashes: number;
      architecture: number;
      botActivity: number,
      archFiles: string[]; 
    }>();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      
      aggregationMap.set(key, {
        date: key,
        fullDate: d.toISOString(),
        rejected: 0,
        reverted: 0,
        crashes: 0,
        botActivity: 0,
        architecture: 0,
        archFiles: [],
      });
    }

    rawEvents.forEach((event) => {
      const d = new Date(event.createdAt);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      
      if (aggregationMap.has(key)) {
        const entry = aggregationMap.get(key)!;
        
        if (event.eventType === "rejected_pr") entry.rejected++;
        if (event.eventType === "reverted_pr") entry.reverted++;
        if (event.eventType === "workflow_crash") entry.crashes++;
        if (event.eventType === "sentinel_response") entry.botActivity++;
        if (event.eventType === "architecture") {
          entry.architecture++;
          if (!entry.archFiles.includes(event.filePath)) {
            entry.archFiles.push(event.filePath);
          }
        }
      }
    });

    const graphData = Array.from(aggregationMap.values()).sort(
      (a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()
    );

    return NextResponse.json({
      events: rawEvents,
      graphData: graphData,
      meta: {
        name: githubData?.name || repo,
        description: githubData?.description || "No description provided",
        stars: githubData?.stargazers_count || 0,
        watchers: githubData?.subscribers_count || 0,
        forks: githubData?.forks_count || 0,
        language: githubData?.language || "Unknown",
        visibility: githubData?.visibility || "public",
        readme: readmeContent
      }
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}