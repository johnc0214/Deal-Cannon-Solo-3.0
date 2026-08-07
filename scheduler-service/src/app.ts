import express from 'express';
import { getConfig } from './config.js';
import { requireInternalSecret } from './lib/http.js';
import { createHealthRouter } from './routes/health.js';
import { createInternalRouter } from './routes/internal.js';
import { createOAuthRouter } from './routes/oauth.js';

export function createApp() {
  const config = getConfig();
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(createHealthRouter());
  app.use(createOAuthRouter(config));

  app.use(requireInternalSecret(config.internalSecret));
  app.use(createInternalRouter(config));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'Unexpected scheduler service error.';

    res.status(400).json({
      success: false,
      message,
    });
  });

  return { app, config };
}
