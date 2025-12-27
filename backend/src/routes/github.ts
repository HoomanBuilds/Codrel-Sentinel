import { Router, Request, Response } from "express";
import { githubService } from "../services/github";

const router : Router = Router();

router.get("/install", (req: Request, res: Response) => {
  try {
    const state = req.query.state as string | undefined;
    const installUrl = githubService.getInstallUrl(state);
    res.redirect(installUrl);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/callback", async (req: Request, res: Response) => {
  try {
    const installationId = Number(req.query.installation_id);

    if (!installationId) {
      return res.redirect('/?error=missing_installation');
    }

    await githubService.getInstallation(installationId);
    res.redirect(`/?installation_id=${installationId}`);
  } catch (error: any) {
    console.error("GitHub callback error:", error);
    res.redirect('/?error=callback_failed');
  }
});

router.get("/installations", async (_req: Request, res: Response) => {
  try {
    const installations = await githubService.listInstallations();
    res.json({ installations });
  } catch (error: any) {
    console.error("List installations error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/repos", async (_req: Request, res: Response) => {
  try {
    const installations = await githubService.listInstallations();
    
    const allRepos: any[] = [];
    
    for (const installation of installations) {
      try {
        const repos = await githubService.listInstallationRepos(installation.id);
        allRepos.push(
          ...repos.map((repo: any) => ({
            ...repo,
            installation: {
              id: installation.id,
              account: installation.account,
            },
          }))
        );
      } catch (err) {
        console.error(`Failed to fetch repos for installation ${installation.id}:`, err);
      }
    }

    res.json({ 
      totalCount: allRepos.length,
      repositories: allRepos 
    });
  } catch (error: any) {
    console.error("List all repos error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/token", async (req: Request, res: Response) => {
  try {
    const { installationId } = req.body;

    if (!installationId) {
      return res.status(400).json({ error: "Missing installationId" });
    }

    const credential = await githubService.getInstallationToken(Number(installationId));

    res.json({
      accessToken: credential.accessToken,
      expiresAt: credential.expiresAt,
      installationId: credential.installationId,
    });
  } catch (error: any) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/installations/:installationId/repos", async (req: Request, res: Response) => {
  try {
    const installationId = Number(req.params.installationId);

    if (!installationId) {
      return res.status(400).json({ error: "Invalid installationId" });
    }

    const repositories = await githubService.listInstallationRepos(installationId);

    res.json({ repositories });
  } catch (error: any) {
    console.error("List repos error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get(
  "/installations/:installationId/repos/:owner/:repo/contents",
  async (req: Request, res: Response) => {
    try {
      const { installationId, owner, repo } = req.params;
      const path = (req.query.path as string) || "";

      const contents = await githubService.getRepoContents(
        Number(installationId),
        owner,
        repo,
        path
      );

      res.json({ contents });
    } catch (error: any) {
      console.error("Get contents error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
