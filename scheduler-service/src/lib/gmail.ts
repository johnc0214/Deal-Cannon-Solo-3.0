import { google } from 'googleapis';
import type { SchedulerServiceConfig } from '../config.js';
import type { StoredGmailConnection } from './firestore.js';
import { createOAuthClient } from './oauth.js';

function encodeMessage(raw: string) {
  return Buffer.from(raw, 'utf8').toString('base64url');
}

function buildRawMimeMessage(to: string, subject: string, body: string) {
  return [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');
}

export async function sendGmailMessage(
  config: SchedulerServiceConfig,
  connection: StoredGmailConnection,
  to: string,
  subject: string,
  body: string,
) {
  if (!connection.refreshToken) {
    throw new Error('No Gmail refresh token is stored for this user.');
  }

  const oauthClient = createOAuthClient(config);
  oauthClient.setCredentials({ refresh_token: connection.refreshToken });

  const gmail = google.gmail({ version: 'v1', auth: oauthClient });
  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodeMessage(buildRawMimeMessage(to, subject, body)),
    },
  });

  return {
    providerMessageId: String(response.data.id || '').trim(),
  };
}
