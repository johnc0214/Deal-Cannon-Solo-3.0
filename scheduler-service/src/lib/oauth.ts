import crypto from 'node:crypto';
import { google } from 'googleapis';
import type { SchedulerServiceConfig } from '../config.js';

const GMAIL_CONNECT_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send',
];

export type OAuthStatePayload = {
  userEmail: string;
  customerSheetId: string;
  returnUrl: string;
  createdAt: string;
};

type IdTokenClaims = {
  email?: string;
  hd?: string;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

export function createOAuthClient(config: SchedulerServiceConfig) {
  return new google.auth.OAuth2(
    config.gmailOauthClientId,
    config.gmailOauthClientSecret,
    config.gmailOauthRedirectUri,
  );
}

export function signOAuthState(payload: OAuthStatePayload, secret: string) {
  const payloadText = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(payloadText);
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyOAuthState(state: string, secret: string): OAuthStatePayload {
  const parts = String(state || '').split('.');

  if (parts.length !== 2) {
    throw new Error('OAuth state is invalid.');
  }

  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');

  if (providedSignature.length !== expectedSignature.length) {
    throw new Error('OAuth state signature is invalid.');
  }

  if (!crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) {
    throw new Error('OAuth state signature is invalid.');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as OAuthStatePayload;
  const createdAtMs = new Date(payload.createdAt).getTime();

  if (!createdAtMs || Number.isNaN(createdAtMs)) {
    throw new Error('OAuth state timestamp is invalid.');
  }

  if (Date.now() - createdAtMs > 1000 * 60 * 20) {
    throw new Error('OAuth state expired. Start Gmail connect again.');
  }

  return payload;
}

export function buildGoogleAuthUrl(config: SchedulerServiceConfig, state: string) {
  const oauthClient = createOAuthClient(config);

  return oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: GMAIL_CONNECT_SCOPES,
    state,
  });
}

export async function exchangeGoogleCode(config: SchedulerServiceConfig, code: string) {
  const oauthClient = createOAuthClient(config);
  const { tokens } = await oauthClient.getToken(code);

  oauthClient.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: oauthClient });
  const userInfoResponse = await oauth2.userinfo.get();
  const userInfo = userInfoResponse.data || {};
  const idTokenClaims = decodeIdTokenClaims(tokens.id_token);

  return {
    tokens,
    connectedEmail: normalizeEmail(String(userInfo.email || idTokenClaims.email || '')),
    hostedDomain: String(idTokenClaims.hd || '').trim() || null,
  };
}

export function buildOAuthSuccessRedirect(returnUrl: string, params: Record<string, string>) {
  const url = new URL(returnUrl);

  Object.keys(params).forEach((key) => {
    url.searchParams.set(key, params[key]);
  });

  return url.toString();
}

function decodeIdTokenClaims(idToken: string | null | undefined): IdTokenClaims {
  const raw = String(idToken || '').trim();

  if (!raw) {
    return {};
  }

  const parts = raw.split('.');
  if (parts.length < 2) {
    return {};
  }

  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as IdTokenClaims;
  } catch (_err) {
    return {};
  }
}
