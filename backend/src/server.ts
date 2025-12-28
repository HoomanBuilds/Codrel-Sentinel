import 'dotenv/config';
import express from 'express';

import path from 'path';
import { fileURLToPath } from 'url';
import { mcpRouter } from './routes/mcp.js';
import { healthRouter } from './routes/health.js';
import { repoRouter } from './routes/repo.js';
import { agentRouter } from './routes/agent.js';
import { webhookRouter } from './webhooks/index.js';
import { voiceRouter } from './routes/voice.js';
import githubRouter from './routes/github.js';
import { initDatadog } from './services/datadog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

initDatadog();

app.use('/mcp', mcpRouter);
app.use('/repo', repoRouter);
app.use('/agent', agentRouter);
app.use('/tts', voiceRouter);
app.use('/webhooks', webhookRouter);
app.use('/github', githubRouter);
app.use('/health', healthRouter);


app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Sentinel Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n[Sentinel] Running on port ${PORT}`);
});
