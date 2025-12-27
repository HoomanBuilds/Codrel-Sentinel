import { Router } from "express";
import { handleGitHubWebhook, handleDatadogWebhook, handleCIWebhook } from "./handlers/index.js";

const router : Router = Router();

router.post("/github", handleGitHubWebhook);
router.post("/datadog", handleDatadogWebhook);
router.post("/ci", handleCIWebhook);

export { router as webhookRouter };
