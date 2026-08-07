import type { Request, Response, NextFunction } from 'express';

export function requireInternalSecret(expectedSecret: string) {
  return function internalSecretMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!expectedSecret) {
      next();
      return;
    }

    const providedSecret = String(req.header('X-Deal-Cannon-Internal-Secret') || '').trim();

    if (!providedSecret || providedSecret !== expectedSecret) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized internal scheduler request.',
      });
      return;
    }

    next();
  };
}

export function notImplemented(res: Response, capability: string) {
  res.status(501).json({
    success: false,
    message: `${capability} is not implemented yet.`,
    capability,
  });
}
