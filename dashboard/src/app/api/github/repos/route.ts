// import { NextRequest, NextResponse } from "next/server";
// import { github } from "@/lib/github";
// import { repositories } from "@/lib/schema";
// import { eq } from "drizzle-orm";
// import { db } from "@/lib/db";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";

// export const dynamic = "force-dynamic";

// export async function GET(req: NextRequest) {
//   const session = await getServerSession(authOptions);
//   const token = (session?.user as any)?.githubAccessToken;

//   if (!token) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   const { searchParams } = new URL(req.url);
//   const installationId = searchParams.get("installationId");

//   if (!installationId) {
//     return NextResponse.json(
//       { error: "Missing installationId" },
//       { status: 400 }
//     );
//   }

//   try {
//     const rawRepos = await github.listUserRepos(
//       token,
//       Number(installationId)
//     );

//     const connectedRepos = await db
//       .select({
//         id: repositories.id,
//         status: repositories.status,
//       })
//       .from(repositories)
//       .where(eq(repositories.installationId, installationId));

//     const repoMap = new Map(
//       connectedRepos.map((r) => [r.id, r.status])
//     );

//     const enhancedRepos = rawRepos.map((repo: any) => {
//       const repoId = `${repo.owner.login}/${repo.name}`;
//       const status = repoMap.get(repoId);

//       return {
//         ...repo,
//         status: status ?? "DISCONNECTED",
//         isConnected: Boolean(status),
//       };
//     });

//     return NextResponse.json({
//       count: enhancedRepos.length,
//       repositories: enhancedRepos,
//     });
//   } catch {
//     return NextResponse.json({ repositories: [] });
//   }
// }
