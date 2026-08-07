import { Router } from 'express';
import type { SchedulerServiceConfig } from '../config.js';
import { buildOAuthSuccessRedirect, exchangeGoogleCode, verifyOAuthState } from '../lib/oauth.js';
import { getStoredGmailConnection, markGmailConnectionError, upsertStoredGmailConnection } from '../lib/firestore.js';

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

export function createOAuthRouter(config: SchedulerServiceConfig) {
  const router = Router();

  router.get('/oauth/google/callback', async (req, res, next) => {
    let statePayload: { userEmail: string; customerSheetId: string; returnUrl: string; createdAt: string } | null = null;

    try {
      const code = String(req.query.code || '').trim();
      const state = String(req.query.state || '').trim();
      const oauthError = String(req.query.error || '').trim();

      statePayload = verifyOAuthState(state, config.internalSecret);

      if (oauthError) {
        await markGmailConnectionError(statePayload.userEmail, statePayload.customerSheetId, `Google OAuth error: ${oauthError}`);
        res.redirect(buildOAuthSuccessRedirect(statePayload.returnUrl, {
          gmailConnect: 'error',
          gmailMessage: 'Google Gmail authorization was cancelled or rejected.',
        }));
        return;
      }

      if (!code) {
        await markGmailConnectionError(statePayload.userEmail, statePayload.customerSheetId, 'Google OAuth callback did not include an authorization code.');
        res.redirect(buildOAuthSuccessRedirect(statePayload.returnUrl, {
          gmailConnect: 'error',
          gmailMessage: 'Google Gmail authorization did not return a code.',
        }));
        return;
      }

      const exchangeResult = await exchangeGoogleCode(config, code);
      const approvedUserEmail = normalizeEmail(statePayload.userEmail);
      const connectedEmail = normalizeEmail(exchangeResult.connectedEmail || '');
      const emailDomain = connectedEmail.split('@')[1] || '';

      if (!connectedEmail) {
        throw new Error('Google did not return the connected email address.');
      }

      if (connectedEmail !== approvedUserEmail) {
        throw new Error('The connected Gmail account must exactly match your Deal Cannon login email.');
      }

      if (!exchangeResult.hostedDomain) {
        throw new Error('Scheduled sending requires a Google Workspace account with a hosted domain.');
      }

      if (emailDomain === 'gmail.com') {
        throw new Error('Scheduled sending does not support gmail.com accounts. Use your Google Workspace account.');
      }

      const existing = await getStoredGmailConnection(approvedUserEmail);
      const refreshToken = exchangeResult.tokens.refresh_token || existing?.refreshToken || null;

      await upsertStoredGmailConnection(approvedUserEmail, {
        customerSheetId: statePayload.customerSheetId,
        connectedEmail,
        hostedDomain: exchangeResult.hostedDomain,
        refreshToken,
        refreshTokenStored: !!refreshToken,
        scopes: String(exchangeResult.tokens.scope || '').split(' ').filter(Boolean),
        status: 'CONNECTED',
        lastConnectedAt: new Date().toISOString(),
        lastDisconnectedAt: null,
        lastErrorMessage: null,
      });

      res.redirect(buildOAuthSuccessRedirect(statePayload.returnUrl, {
        gmailConnect: 'connected',
        gmailMessage: 'Scheduled sending Gmail access connected successfully.',
        gmailEmail: connectedEmail,
      }));
    } catch (err) {
      if (statePayload) {
        const message = err instanceof Error ? err.message : 'Gmail scheduled sending authorization failed.';

        try {
          await markGmailConnectionError(statePayload.userEmail, statePayload.customerSheetId, message);
          res.redirect(buildOAuthSuccessRedirect(statePayload.returnUrl, {
            gmailConnect: 'error',
            gmailMessage: message,
          }));
          return;
        } catch (_redirectErr) {}
      }

      next(err);
    }
  });

  return router;
}
