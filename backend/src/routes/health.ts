import { Router } from 'express';

export const healthRouter : Router = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'codrel-sentinel',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});
