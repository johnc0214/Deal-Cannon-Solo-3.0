import { Router } from 'express';
import { z } from 'zod';
import type { SchedulerServiceConfig } from '../config.js';
import { getStoredGmailConnection, upsertStoredGmailConnection } from '../lib/firestore.js';
import { buildGoogleAuthUrl, signOAuthState } from '../lib/oauth.js';
import { cancelScheduleCampaign, createScheduleCampaign, deleteScheduleItems, getSchedulerState, previewScheduleCampaign, runDueCampaigns, runSingleCampaignNow } from '../lib/schedules.js';
import { notImplemented } from '../lib/http.js';

const leadSchema = z.object({
  rowNumber: z.number().int().positive(),
  leadId: z.string().min(1),
  leadKey: z.string().default(''),
  name: z.string().default(''),
  email: z.string().email(),
  propertyAddress: z.string().default(''),
  listPrice: z.string().default(''),
  status: z.string().default('NEW'),
  subject: z.string().min(1),
  body: z.string().min(1),
  offerType: z.string().min(1),
  campaignMode: z.literal('send').default('send'),
});

const scheduleRequestSchema = z.object({
  userEmail: z.string().email(),
  customerSheetId: z.string().min(1),
  selectedRows: z.array(z.number().int().positive()).default([]),
  selectedLeadIds: z.array(z.string().min(1)).default([]),
  startDate: z.string().min(1),
  sendTimeLocal: z.string().min(1),
  timezone: z.string().min(1),
  dailyLimit: z.number().int().positive().max(300),
  offerType: z.string().min(1),
  mode: z.literal('send'),
  leads: z.array(leadSchema).min(1),
});

const campaignActionSchema = z.object({
  campaignId: z.string().min(1).optional().default(''),
  userEmail: z.string().email(),
  customerSheetId: z.string().min(1),
  selectedRows: z.array(z.number().int().positive()).default([]),
});

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

export function createInternalRouter(config: SchedulerServiceConfig) {
  const router = Router();

  router.post('/internal/oauth/google/start', (req, res) => {
    const body = z.object({
      userEmail: z.string().email(),
      customerSheetId: z.string().min(1),
      returnUrl: z.string().optional().default(''),
    }).parse(req.body || {});

    const state = signOAuthState({
      userEmail: normalizeEmail(body.userEmail),
      customerSheetId: String(body.customerSheetId || '').trim(),
      returnUrl: String(body.returnUrl || '').trim(),
      createdAt: new Date().toISOString(),
    }, config.internalSecret);

    const authUrl = buildGoogleAuthUrl(config, state);

    res.json({
      success: true,
      authUrl,
      message: 'Open the Google OAuth URL to connect Gmail scheduled sending.',
    });
  });

  router.post('/internal/gmail-connection/status', async (req, res, next) => {
    const body = z.object({
      userEmail: z.string().email(),
      customerSheetId: z.string().min(1),
    }).parse(req.body || {});

    try {
      const record = await getStoredGmailConnection(body.userEmail);

      res.json({
        success: true,
        gmailConnected: !!(record && record.status === 'CONNECTED' && record.refreshTokenStored && record.connectedEmail),
        gmailConnectedEmail: record?.connectedEmail || '',
        gmailStatus: record?.status || 'DISCONNECTED',
        gmailHostedDomain: record?.hostedDomain || '',
        refreshTokenStored: !!record?.refreshTokenStored,
        message: record && record.status === 'CONNECTED'
          ? 'Scheduled sending Gmail account is connected.'
          : 'Scheduled sending Gmail account is not connected yet.',
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/internal/gmail-connection/disconnect', async (req, res, next) => {
    const body = z.object({
      userEmail: z.string().email(),
      customerSheetId: z.string().min(1),
    }).parse(req.body || {});

    try {
      await upsertStoredGmailConnection(body.userEmail, {
        customerSheetId: String(body.customerSheetId || '').trim(),
        connectedEmail: null,
        hostedDomain: null,
        refreshToken: null,
        refreshTokenStored: false,
        scopes: [],
        status: 'DISCONNECTED',
        lastDisconnectedAt: new Date().toISOString(),
        lastErrorMessage: null,
      });

      res.json({
        success: true,
        gmailConnected: false,
        gmailStatus: 'DISCONNECTED',
        message: 'Scheduled sending Gmail account disconnected.',
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/internal/schedules/preview', async (req, res, next) => {
    const body = scheduleRequestSchema.parse(req.body || {});

    try {
      res.json(await previewScheduleCampaign(body));
    } catch (err) {
      next(err);
    }
  });

  router.post('/internal/schedules', async (req, res, next) => {
    const body = scheduleRequestSchema.parse(req.body || {});

    try {
      res.json(await createScheduleCampaign(config, body));
    } catch (err) {
      next(err);
    }
  });

  router.get('/internal/schedules', async (req, res, next) => {
    const query = z.object({
      userEmail: z.string().email(),
      customerSheetId: z.string().min(1),
    }).parse(req.query);

    try {
      res.json(await getSchedulerState(query.userEmail, query.customerSheetId));
    } catch (err) {
      next(err);
    }
  });

  router.post('/internal/schedules/cancel', async (req, res, next) => {
    const body = campaignActionSchema.parse(req.body || {});

    try {
      if (!body.campaignId) {
        throw new Error('Campaign ID is required to cancel a scheduled campaign.');
      }

      res.json(await cancelScheduleCampaign(config, body.userEmail, body.customerSheetId, body.campaignId));
    } catch (err) {
      next(err);
    }
  });

  router.post('/internal/schedules/delete', async (req, res, next) => {
    const body = campaignActionSchema.parse(req.body || {});

    try {
      res.json(await deleteScheduleItems(body.userEmail, body.customerSheetId, body.selectedRows));
    } catch (err) {
      next(err);
    }
  });

  router.post('/internal/schedules/run-now', async (req, res, next) => {
    const body = campaignActionSchema.parse(req.body || {});

    try {
      if (body.campaignId) {
        res.json(await runSingleCampaignNow(config, body.campaignId, body.userEmail, body.customerSheetId));
        return;
      }

      res.json(await runDueCampaigns(config, body.userEmail, body.customerSheetId));
    } catch (err) {
      next(err);
    }
  });

  router.post('/internal/schedules/run-worker', async (req, res, next) => {
    const body = z.object({
      campaignId: z.string().min(1),
      userEmail: z.string().email(),
      customerSheetId: z.string().min(1),
    }).parse(req.body || {});

    try {
      res.json(await runSingleCampaignNow(config, body.campaignId, body.userEmail, body.customerSheetId));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
