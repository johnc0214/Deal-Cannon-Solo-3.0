import { Router } from 'express';

export function createHealthRouter() {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      success: true,
      service: 'deal-cannon-scheduler-service',
      status: 'ok',
    });
  });

  return router;
}
