import { NextResponse } from "next/server";
import { github } from "@/lib/github";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db"; 
import { repositories } from "@/lib/schema";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUserLogin = (session.user as any).login || session.user.name;

  try {
    const allData = await github.getAllInstallationsWithRepos();

    const myData = allData.filter((inst: any) => 
      inst.account.login.toLowerCase() === currentUserLogin.toLowerCase()
    );

    const repoIds: string[] = [];
    myData.forEach((inst: any) => {
      if (inst.repositories) {
        inst.repositories.forEach((repo: any) => {
          repoIds.push(repo.full_name);
        });
      }
    });

    let dbStatuses: any[] = [];
    if (repoIds.length > 0) {
      dbStatuses = await db
        .select({
          id: repositories.id,
          status: repositories.status,
        })
        .from(repositories)
        .where(inArray(repositories.id, repoIds));
    }

    const statusMap = new Map();
    dbStatuses.forEach((row) => {
      statusMap.set(row.id, row.status);
    });

    myData.forEach((inst: any) => {
      if (inst.repositories) {
        inst.repositories.forEach((repo: any) => {
          const currentStatus = statusMap.get(repo.full_name);
          if (currentStatus) {
            repo.status = currentStatus;
          }
        });
      }
    });

    return NextResponse.json({
      count: myData.length,
      installations: myData,
    });
  } catch (error: any) {
    console.error("API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}