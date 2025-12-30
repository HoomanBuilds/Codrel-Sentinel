import { App } from "octokit";

const sentinelApp = new App({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: (process.env.GITHUB_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
});

export const github = {
  getAllInstallationsWithRepos: async () => {
    try {
      const installations = await sentinelApp.octokit.paginate("GET /app/installations");

      const data = await Promise.all(
        installations.map(async (inst: any) => {
          try {
            const installOctokit = await sentinelApp.getInstallationOctokit(inst.id);
            
            const { data: repos } = await installOctokit.request("GET /installation/repositories");
            
            return {
              ...inst,
              repositories: repos.repositories
            };
          } catch (err) {
            console.error(`Failed to load repos for ${inst.account.login}`, err);
            return { ...inst, repositories: [] };
          }
        })
      );

      return data;
    } catch (error) {
      console.error("Critical Error fetching all installations:", error);
      return [];
    }
  },
};


export async function getRepoInstallationToken(
  installationId: number
): Promise<string> {
  const auth : any = await sentinelApp.octokit.auth({
    type: "installation",
    installationId,
  });

  return auth.token;
}