import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const GMAIL_CONNECTIONS_COLLECTION = 'gmailConnections';

export type StoredGmailConnection = {
  userEmail: string;
  customerSheetId: string;
  connectedEmail: string | null;
  status: 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED' | 'ERROR';
  hostedDomain: string | null;
  refreshToken: string | null;
  refreshTokenStored: boolean;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastErrorMessage: string | null;
};

function ensureApp() {
  if (!getApps().length) {
    initializeApp();
  }
}

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

export function getDb() {
  ensureApp();
  return getFirestore();
}

export function getGmailConnectionDocId(userEmail: string) {
  const normalizedEmail = normalizeEmail(userEmail);

  if (!normalizedEmail) {
    throw new Error('User email is required for Gmail connection state.');
  }

  return normalizedEmail;
}

export async function getStoredGmailConnection(userEmail: string): Promise<StoredGmailConnection | null> {
  const snapshot = await getDb()
    .collection(GMAIL_CONNECTIONS_COLLECTION)
    .doc(getGmailConnectionDocId(userEmail))
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as StoredGmailConnection;
}

export async function upsertStoredGmailConnection(
  userEmail: string,
  updates: Partial<StoredGmailConnection>,
): Promise<StoredGmailConnection> {
  const docRef = getDb().collection(GMAIL_CONNECTIONS_COLLECTION).doc(getGmailConnectionDocId(userEmail));
  const existing = await docRef.get();
  const existingData = existing.exists ? (existing.data() as StoredGmailConnection) : null;
  const timestamp = nowIso();

  const record: StoredGmailConnection = {
    userEmail: normalizeEmail(userEmail),
    customerSheetId: String(updates.customerSheetId || existingData?.customerSheetId || '').trim(),
    connectedEmail: updates.connectedEmail !== undefined ? updates.connectedEmail : (existingData?.connectedEmail || null),
    status: updates.status || existingData?.status || 'DISCONNECTED',
    hostedDomain: updates.hostedDomain !== undefined ? updates.hostedDomain : (existingData?.hostedDomain || null),
    refreshToken: updates.refreshToken !== undefined ? updates.refreshToken : (existingData?.refreshToken || null),
    refreshTokenStored: updates.refreshTokenStored !== undefined ? updates.refreshTokenStored : !!(existingData?.refreshTokenStored),
    scopes: updates.scopes || existingData?.scopes || [],
    createdAt: existingData?.createdAt || timestamp,
    updatedAt: timestamp,
    lastConnectedAt: updates.lastConnectedAt !== undefined ? updates.lastConnectedAt : (existingData?.lastConnectedAt || null),
    lastDisconnectedAt: updates.lastDisconnectedAt !== undefined ? updates.lastDisconnectedAt : (existingData?.lastDisconnectedAt || null),
    lastErrorMessage: updates.lastErrorMessage !== undefined ? updates.lastErrorMessage : (existingData?.lastErrorMessage || null),
  };

  await docRef.set(record, { merge: true });
  return record;
}

export async function markGmailConnectionError(userEmail: string, customerSheetId: string, message: string) {
  return upsertStoredGmailConnection(userEmail, {
    customerSheetId,
    status: 'ERROR',
    lastErrorMessage: String(message || 'Unknown Gmail connection error.'),
  });
}
