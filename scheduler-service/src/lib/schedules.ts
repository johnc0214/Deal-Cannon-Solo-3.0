import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { FieldValue } from 'firebase-admin/firestore';
import type { SchedulerServiceConfig } from '../config.js';
import { getDb, getStoredGmailConnection, upsertStoredGmailConnection } from './firestore.js';
import { sendGmailMessage } from './gmail.js';
import { enqueueCampaignRunTask } from './tasks.js';
import { buildScheduledDateTime, formatLocalDate, formatLocalHour, toUtcIso } from './time.js';
import { markLeadFailedInWorkbook, moveLeadToEmailSent } from './workbook.js';

const CAMPAIGNS_COLLECTION = 'scheduleCampaigns';
const LEAD_ITEMS_COLLECTION = 'scheduleLeadItems';
const DAILY_CAPACITY_COLLECTION = 'dailyCapacity';
const MAX_DAILY_SEND_LIMIT = 300;
const OPEN_DISPLAY_STATUSES = new Set(['SCHEDULED', 'PROCESSING']);

export type ScheduleLeadRequest = {
  rowNumber: number;
  leadId: string;
  leadKey: string;
  name: string;
  email: string;
  propertyAddress: string;
  listPrice: string;
  status: string;
  subject: string;
  body: string;
  offerType: string;
  campaignMode: 'send';
};

export type CreateScheduleRequest = {
  userEmail: string;
  customerSheetId: string;
  startDate: string;
  sendTimeLocal: string;
  timezone: string;
  dailyLimit: number;
  offerType: string;
  mode: 'send';
  leads: ScheduleLeadRequest[];
};

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function buildCampaignId() {
  return `sched_${randomUUID().replace(/-/g, '')}`;
}

function buildLeadItemId(campaignId: string, leadId: string) {
  return `${campaignId}_${leadId}`;
}

function buildCapacityDocId(userEmail: string, localDate: string) {
  return `${normalizeEmail(userEmail)}_${localDate}`;
}

function asNumber(value: unknown, fallback = 0) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : fallback;
}

function groupCountsByDate(items: Array<{ scheduledDate: string }>) {
  const counts: Record<string, number> = {};

  items.forEach((item) => {
    counts[item.scheduledDate] = (counts[item.scheduledDate] || 0) + 1;
  });

  return counts;
}

async function getExistingReservedCounts(userEmail: string) {
  const snapshot = await getDb()
    .collection(DAILY_CAPACITY_COLLECTION)
    .where('userEmail', '==', normalizeEmail(userEmail))
    .get();

  const counts: Record<string, number> = {};
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    counts[String(data.localDate || '')] = asNumber(data.reservedCount, 0);
  });
  return counts;
}

function planCampaignLeadSchedule(request: CreateScheduleRequest, existingReservedCounts: Record<string, number>) {
  const dailyLimit = Math.min(MAX_DAILY_SEND_LIMIT, Math.max(1, asNumber(request.dailyLimit, 1)));
  const counts = { ...existingReservedCounts };
  const items: Array<Record<string, unknown>> = [];
  const baseTimestamp = Date.now();
  let dateCursor = DateTime.fromISO(request.startDate, { zone: request.timezone }).startOf('day');
  let leadIndex = 0;

  while (leadIndex < request.leads.length) {
    const localDate = formatLocalDate(dateCursor);
    const alreadyReserved = asNumber(counts[localDate], 0);
    const available = Math.min(dailyLimit, Math.max(0, MAX_DAILY_SEND_LIMIT - alreadyReserved));
    const startLeadIndex = leadIndex;

    if (available <= 0) {
      dateCursor = dateCursor.plus({ days: 1 });
      continue;
    }

    for (let slot = 0; slot < available && leadIndex < request.leads.length; slot += 1) {
      const lead = request.leads[leadIndex];
      const scheduledDateTime = buildScheduledDateTime(localDate, request.sendTimeLocal, request.timezone);
      const scheduledAtUtc = toUtcIso(scheduledDateTime);
      const rowNumber = baseTimestamp * 1000 + leadIndex;

      items.push({
        scheduleItemId: buildLeadItemId('pending', lead.leadId),
        rowNumber,
        scheduledDate: localDate,
        scheduledHour: formatLocalHour(scheduledDateTime),
        scheduledAtUtc,
        scheduledAtIso: scheduledDateTime.toISO(),
        sourceReadyRowNumber: lead.rowNumber,
        leadId: lead.leadId,
        leadKey: lead.leadKey,
        name: lead.name,
        email: normalizeEmail(lead.email),
        propertyAddress: lead.propertyAddress,
        listPrice: lead.listPrice,
        subject: lead.subject,
        body: lead.body,
        status: 'PENDING',
        offerType: lead.offerType,
        campaignMode: 'send',
      });

      leadIndex += 1;
    }

    counts[localDate] = alreadyReserved + (leadIndex - startLeadIndex);
    dateCursor = dateCursor.plus({ days: 1 });
  }

  return {
    items,
    dailyCounts: groupCountsByDate(items as Array<{ scheduledDate: string }>),
    nextRunAtUtc: items.length ? String(items[0].scheduledAtUtc || '') : null,
    dayCount: Object.keys(groupCountsByDate(items as Array<{ scheduledDate: string }>)).length,
  };
}

function buildStateRecord(item: Record<string, unknown>, campaign: Record<string, unknown> | undefined) {
  const rawStatus = String(item.status || 'PENDING').trim().toUpperCase();
  const displayStatus = rawStatus === 'PENDING'
    ? 'SCHEDULED'
    : rawStatus === 'SENDING'
      ? 'PROCESSING'
      : rawStatus;

  return {
    rowNumber: asNumber(item.rowNumber),
    scheduleId: String(item.campaignId || campaign?.campaignId || ''),
    createdAt: String(item.createdAt || campaign?.createdAt || ''),
    scheduledDate: String(item.scheduledDate || ''),
    scheduledHour: String(item.scheduledHour || ''),
    offerType: String(item.offerType || campaign?.offerType || ''),
    campaignMode: String(item.campaignMode || 'send'),
    dailyLimit: String(item.dailyLimit || campaign?.dailyLimit || ''),
    name: String(item.name || ''),
    email: String(item.email || ''),
    propertyAddress: String(item.propertyAddress || ''),
    listPrice: String(item.listPrice || ''),
    status: displayStatus,
    processedAt: String(item.processedAt || item.sentAt || ''),
    error: String(item.errorMessage || ''),
    sourceReadyRowNumber: asNumber(item.sourceReadyRowNumber),
    leadId: String(item.leadId || ''),
    scheduledAtUtc: String(item.scheduledAtUtc || ''),
  };
}

async function updateCapacityReservations(userEmail: string, timezone: string, countsByDate: Record<string, number>, direction: 1 | -1) {
  const batch = getDb().batch();

  Object.keys(countsByDate).forEach((localDate) => {
    const docRef = getDb().collection(DAILY_CAPACITY_COLLECTION).doc(buildCapacityDocId(userEmail, localDate));
    batch.set(docRef, {
      userEmail: normalizeEmail(userEmail),
      localDate,
      timezone,
      reservedCount: FieldValue.increment(direction * asNumber(countsByDate[localDate], 0)),
      updatedAt: nowIso(),
    }, { merge: true });
  });

  await batch.commit();

  for (const localDate of Object.keys(countsByDate)) {
    const docRef = getDb().collection(DAILY_CAPACITY_COLLECTION).doc(buildCapacityDocId(userEmail, localDate));
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      continue;
    }

    const data = snapshot.data() || {};
    const reservedCount = Math.max(0, asNumber(data.reservedCount, 0));

    await docRef.set({ reservedCount, updatedAt: nowIso() }, { merge: true });
  }
}

async function incrementSentCounts(userEmail: string, timezone: string, countsByDate: Record<string, number>) {
  const batch = getDb().batch();

  Object.keys(countsByDate).forEach((localDate) => {
    const docRef = getDb().collection(DAILY_CAPACITY_COLLECTION).doc(buildCapacityDocId(userEmail, localDate));
    batch.set(docRef, {
      userEmail: normalizeEmail(userEmail),
      localDate,
      timezone,
      sentCount: FieldValue.increment(asNumber(countsByDate[localDate], 0)),
      updatedAt: nowIso(),
    }, { merge: true });
  });

  await batch.commit();
}

async function refreshCampaignAggregate(campaignId: string) {
  const itemsSnapshot = await getDb().collection(LEAD_ITEMS_COLLECTION).where('campaignId', '==', campaignId).get();
  const items = itemsSnapshot.docs.map((doc) => doc.data() as Record<string, unknown>);
  const remainingLeadCount = items.filter((item) => String(item.status || '') === 'PENDING').length;
  const sentCount = items.filter((item) => String(item.status || '') === 'SENT').length;
  const failedCount = items.filter((item) => String(item.status || '') === 'FAILED').length;
  const cancelledCount = items.filter((item) => String(item.status || '') === 'CANCELLED').length;
  const nextPendingItem = items
    .filter((item) => String(item.status || '') === 'PENDING')
    .sort((a, b) => String(a.scheduledAtUtc || '').localeCompare(String(b.scheduledAtUtc || '')))[0];

  const patch: Record<string, unknown> = {
    remainingLeadCount,
    sentCount,
    failedCount,
    cancelledCount,
    nextRunAtUtc: nextPendingItem ? String(nextPendingItem.scheduledAtUtc || '') : null,
    updatedAt: nowIso(),
  };

  if (!nextPendingItem && remainingLeadCount === 0) {
    patch.status = sentCount > 0 ? 'COMPLETED' : 'CANCELLED';
    patch.completedAt = nowIso();
  }

  await getDb().collection(CAMPAIGNS_COLLECTION).doc(campaignId).set(patch, { merge: true });
  return patch;
}

async function queueNextRunIfNeeded(config: SchedulerServiceConfig, campaignId: string) {
  const campaignSnapshot = await getDb().collection(CAMPAIGNS_COLLECTION).doc(campaignId).get();
  if (!campaignSnapshot.exists) {
    return { queued: false, reason: 'Campaign not found.' };
  }

  const campaign = campaignSnapshot.data() as Record<string, unknown>;
  const nextRunAtUtc = String(campaign.nextRunAtUtc || '').trim();
  const status = String(campaign.status || '').trim().toUpperCase();

  if (!nextRunAtUtc || status !== 'ACTIVE') {
    return { queued: false, reason: 'Campaign has no next run to queue.' };
  }

  return enqueueCampaignRunTask(
    config,
    String(campaign.campaignId || campaignId),
    String(campaign.userEmail || ''),
    String(campaign.customerSheetId || ''),
    Math.floor(new Date(nextRunAtUtc).getTime() / 1000),
  );
}

export async function previewScheduleCampaign(request: CreateScheduleRequest) {
  const existingReservedCounts = await getExistingReservedCounts(request.userEmail);
  const planned = planCampaignLeadSchedule(request, existingReservedCounts);

  return {
    success: true,
    scheduledCount: request.leads.length,
    dayCount: planned.dayCount,
    nextRunAtUtc: planned.nextRunAtUtc,
    preview: planned.items.map((item) => ({
      rowNumber: asNumber(item.rowNumber),
      scheduledDate: String(item.scheduledDate || ''),
      scheduledHour: String(item.scheduledHour || ''),
      name: String(item.name || ''),
      email: String(item.email || ''),
      propertyAddress: String(item.propertyAddress || ''),
      status: 'SCHEDULED',
    })),
  };
}

export async function createScheduleCampaign(config: SchedulerServiceConfig, request: CreateScheduleRequest) {
  const connection = await getStoredGmailConnection(request.userEmail);

  if (!connection || connection.status !== 'CONNECTED' || !connection.refreshTokenStored || !connection.connectedEmail) {
    throw new Error('Connect Gmail for scheduled sending before creating a schedule.');
  }

  const existingItemsSnapshot = await getDb().collection(LEAD_ITEMS_COLLECTION).where('userEmail', '==', normalizeEmail(request.userEmail)).get();
  const alreadyScheduledLeadIds = new Set(
    existingItemsSnapshot.docs
      .map((doc) => doc.data() as Record<string, unknown>)
      .filter((item) => String(item.customerSheetId || '') === request.customerSheetId)
      .filter((item) => String(item.status || '') === 'PENDING' || String(item.status || '') === 'SENDING')
      .map((item) => String(item.leadId || '').trim())
      .filter(Boolean),
  );

  const duplicateLead = request.leads.find((lead) => alreadyScheduledLeadIds.has(String(lead.leadId || '').trim()));
  if (duplicateLead) {
    throw new Error(`Lead ${duplicateLead.name || duplicateLead.email || duplicateLead.leadId} is already scheduled.`);
  }

  const existingReservedCounts = await getExistingReservedCounts(request.userEmail);
  const planned = planCampaignLeadSchedule(request, existingReservedCounts);
  const campaignId = buildCampaignId();
  const timestamp = nowIso();
  const items = planned.items.map((item) => ({
    ...item,
    scheduleItemId: buildLeadItemId(campaignId, String(item.leadId || '')),
    campaignId,
    dailyLimit: request.dailyLimit,
    userEmail: normalizeEmail(request.userEmail),
    customerSheetId: request.customerSheetId,
    timezone: request.timezone,
    createdAt: timestamp,
    updatedAt: timestamp,
    sentAt: null,
    processedAt: '',
    errorCode: '',
    errorMessage: '',
    providerMessageId: '',
    attemptCount: 0,
  }));

  const campaign = {
    campaignId,
    userEmail: normalizeEmail(request.userEmail),
    customerSheetId: request.customerSheetId,
    connectedSenderEmail: connection.connectedEmail,
    timezone: request.timezone,
    startDate: request.startDate,
    sendTimeLocal: request.sendTimeLocal,
    dailyLimit: request.dailyLimit,
    offerType: request.offerType,
    status: 'ACTIVE',
    remainingLeadCount: items.length,
    sentCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    nextRunAtUtc: planned.nextRunAtUtc,
    lastRunAt: null,
    lastRunStatus: null,
    lastErrorMessage: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };

  const batch = getDb().batch();
  batch.set(getDb().collection(CAMPAIGNS_COLLECTION).doc(campaignId), campaign);
  items.forEach((item) => {
    batch.set(getDb().collection(LEAD_ITEMS_COLLECTION).doc(String(item.scheduleItemId || '')), item);
  });
  await batch.commit();
  await updateCapacityReservations(request.userEmail, request.timezone, planned.dailyCounts, 1);
  const queueResult = await queueNextRunIfNeeded(config, campaignId);

  return {
    success: true,
    campaignId,
    scheduleId: campaignId,
    scheduledCount: items.length,
    dayCount: planned.dayCount,
    nextRunAtUtc: planned.nextRunAtUtc,
    taskQueued: queueResult.queued === true,
    message: `Scheduled ${items.length} lead(s) across ${planned.dayCount} day(s).`,
  };
}

export async function getSchedulerState(userEmail: string, customerSheetId: string) {
  const [campaignsSnapshot, itemsSnapshot] = await Promise.all([
    getDb().collection(CAMPAIGNS_COLLECTION).where('userEmail', '==', normalizeEmail(userEmail)).get(),
    getDb().collection(LEAD_ITEMS_COLLECTION).where('userEmail', '==', normalizeEmail(userEmail)).get(),
  ]);

  const campaigns = campaignsSnapshot.docs
    .map((doc) => doc.data() as Record<string, unknown>)
    .filter((campaign) => String(campaign.customerSheetId || '') === customerSheetId);
  const campaignsById = new Map(campaigns.map((campaign) => [String(campaign.campaignId || ''), campaign]));

  const records = itemsSnapshot.docs
    .map((doc) => doc.data() as Record<string, unknown>)
    .filter((item) => String(item.customerSheetId || '') === customerSheetId)
    .filter((item) => String(item.status || '') !== 'SENT')
    .filter((item) => String(item.status || '') !== 'DELETED')
    .sort((a, b) => String(a.scheduledAtUtc || '').localeCompare(String(b.scheduledAtUtc || '')))
    .map((item) => buildStateRecord(item, campaignsById.get(String(item.campaignId || ''))));

  const dueNowCount = records.filter((record) => String(record.status || '') === 'SCHEDULED' && new Date(String(record.scheduledAtUtc || '')).getTime() <= Date.now()).length;
  const openCount = records.filter((record) => OPEN_DISPLAY_STATUSES.has(String(record.status || ''))).length;
  const failedCount = records.filter((record) => String(record.status || '') === 'FAILED').length;
  const latestCampaign = campaigns.sort((a, b) => String(b.lastRunAt || '').localeCompare(String(a.lastRunAt || '')))[0];

  return {
    success: true,
    records,
    count: records.length,
    openCount,
    dueNowCount,
    failedCount,
    staleProcessingCount: 0,
    lastRunAt: String(latestCampaign?.lastRunAt || ''),
    lastRunStatus: String(latestCampaign?.lastRunStatus || ''),
    lastRunMessage: String(latestCampaign?.lastErrorMessage || ''),
    trigger: {
      success: true,
      exists: true,
      triggerCount: 0,
      handlerFunction: 'backend',
      pollingMinutes: 0,
      allHandlerFunctions: ['backend'],
    },
    workbook: {
      customerSheetId,
      customerSheetName: '',
    },
  };
}

async function getItemsByRowNumbers(userEmail: string, customerSheetId: string, rowNumbers: number[]) {
  const snapshot = await getDb().collection(LEAD_ITEMS_COLLECTION).where('userEmail', '==', normalizeEmail(userEmail)).get();
  const rowSet = new Set(rowNumbers.map((value) => asNumber(value)).filter((value) => value > 0));

  return snapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
    .filter((item) => String(item.data.customerSheetId || '') === customerSheetId)
    .filter((item) => rowSet.has(asNumber(item.data.rowNumber)));
}

export async function deleteScheduleItems(userEmail: string, customerSheetId: string, rowNumbers: number[]) {
  const items = await getItemsByRowNumbers(userEmail, customerSheetId, rowNumbers);
  const batch = getDb().batch();
  const capacityRelease: Record<string, number> = {};
  const campaignIds = new Set<string>();

  items.forEach((item) => {
    const status = String(item.data.status || '');
    if (status === 'SENT') {
      return;
    }

    if (status === 'PENDING') {
      const localDate = String(item.data.scheduledDate || '').trim();
      if (localDate) {
        capacityRelease[localDate] = (capacityRelease[localDate] || 0) + 1;
      }
    }

    campaignIds.add(String(item.data.campaignId || ''));
    batch.delete(getDb().collection(LEAD_ITEMS_COLLECTION).doc(item.id));
  });

  await batch.commit();
  if (Object.keys(capacityRelease).length) {
    const timezone = items.length ? String(items[0].data.timezone || 'UTC') : 'UTC';
    await updateCapacityReservations(userEmail, timezone, capacityRelease, -1);
  }

  for (const campaignId of campaignIds) {
    await refreshCampaignAggregate(campaignId);
  }

  return {
    success: true,
    deletedCount: items.filter((item) => String(item.data.status || '') !== 'SENT').length,
    message: `Removed ${items.length} scheduled row(s).`,
  };
}

export async function cancelScheduleCampaign(config: SchedulerServiceConfig, userEmail: string, customerSheetId: string, campaignId: string) {
  const snapshot = await getDb().collection(LEAD_ITEMS_COLLECTION).where('campaignId', '==', campaignId).get();
  const items = snapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
    .filter((item) => normalizeEmail(String(item.data.userEmail || '')) === normalizeEmail(userEmail))
    .filter((item) => String(item.data.customerSheetId || '') === customerSheetId);

  const batch = getDb().batch();
  const capacityRelease: Record<string, number> = {};

  items.forEach((item) => {
    const status = String(item.data.status || '');
    if (status === 'SENT' || status === 'CANCELLED') {
      return;
    }

    if (status === 'PENDING') {
      const localDate = String(item.data.scheduledDate || '').trim();
      if (localDate) {
        capacityRelease[localDate] = (capacityRelease[localDate] || 0) + 1;
      }
    }

    batch.set(getDb().collection(LEAD_ITEMS_COLLECTION).doc(item.id), {
      status: 'CANCELLED',
      updatedAt: nowIso(),
      processedAt: nowIso(),
    }, { merge: true });
  });

  batch.set(getDb().collection(CAMPAIGNS_COLLECTION).doc(campaignId), {
    status: 'CANCELLED',
    updatedAt: nowIso(),
    lastRunStatus: 'cancelled',
    lastErrorMessage: 'Campaign cancelled by user.',
  }, { merge: true });
  await batch.commit();

  if (Object.keys(capacityRelease).length) {
    const timezone = items.length ? String(items[0].data.timezone || 'UTC') : 'UTC';
    await updateCapacityReservations(userEmail, timezone, capacityRelease, -1);
  }

  await refreshCampaignAggregate(campaignId);
  await queueNextRunIfNeeded(config, campaignId);

  return {
    success: true,
    message: 'Scheduled campaign cancelled.',
  };
}

async function runCampaignDispatch(config: SchedulerServiceConfig, campaignId: string) {
  const campaignSnapshot = await getDb().collection(CAMPAIGNS_COLLECTION).doc(campaignId).get();
  if (!campaignSnapshot.exists) {
    return { success: false, processedCount: 0, failedCount: 0, message: 'Campaign not found.' };
  }

  const campaign = campaignSnapshot.data() as Record<string, unknown>;
  if (String(campaign.status || '').toUpperCase() !== 'ACTIVE') {
    return { success: true, processedCount: 0, failedCount: 0, message: 'Campaign is not active.' };
  }

  const connection = await getStoredGmailConnection(String(campaign.userEmail || ''));
  if (!connection || !connection.refreshTokenStored || String(connection.status || '').toUpperCase() !== 'CONNECTED') {
    await upsertStoredGmailConnection(String(campaign.userEmail || ''), {
      customerSheetId: String(campaign.customerSheetId || ''),
      status: 'ERROR',
      lastErrorMessage: 'Stored Gmail connection is not available for scheduled sending.',
    });

    await getDb().collection(CAMPAIGNS_COLLECTION).doc(campaignId).set({
      lastRunAt: nowIso(),
      lastRunStatus: 'error',
      lastErrorMessage: 'Stored Gmail connection is not available for scheduled sending.',
      updatedAt: nowIso(),
    }, { merge: true });

    return { success: false, processedCount: 0, failedCount: 0, message: 'Stored Gmail connection is not available.' };
  }

  const itemsSnapshot = await getDb().collection(LEAD_ITEMS_COLLECTION).where('campaignId', '==', campaignId).get();
  const now = DateTime.utc();
  const dueItems = itemsSnapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
    .filter((item) => String(item.data.status || '') === 'PENDING')
    .filter((item) => DateTime.fromISO(String(item.data.scheduledAtUtc || '')).toUTC() <= now)
    .sort((a, b) => String(a.data.scheduledAtUtc || '').localeCompare(String(b.data.scheduledAtUtc || '')));

  if (!dueItems.length) {
    await getDb().collection(CAMPAIGNS_COLLECTION).doc(campaignId).set({
      lastRunAt: nowIso(),
      lastRunStatus: 'success',
      lastErrorMessage: 'No due scheduled leads were ready to send.',
      updatedAt: nowIso(),
    }, { merge: true });

    return { success: true, processedCount: 0, failedCount: 0, message: 'No due scheduled leads were ready to send.' };
  }

  let processedCount = 0;
  let failedCount = 0;
  const sentCountsByDate: Record<string, number> = {};

  for (const item of dueItems) {
    const leadId = String(item.data.leadId || '');
    const leadSentRow = [
      String(item.data.name || ''),
      String(item.data.email || ''),
      String(item.data.propertyAddress || ''),
      String(item.data.listPrice || ''),
      'SENT',
      leadId,
    ];

    try {
      const sendResult = await sendGmailMessage(
        config,
        connection,
        String(item.data.email || ''),
        String(item.data.subject || ''),
        String(item.data.body || ''),
      );

      await moveLeadToEmailSent(
        String(item.data.customerSheetId || ''),
        leadId,
        asNumber(item.data.sourceReadyRowNumber, 0),
        leadSentRow,
      );

      await getDb().collection(LEAD_ITEMS_COLLECTION).doc(item.id).set({
        status: 'SENT',
        providerMessageId: sendResult.providerMessageId,
        sentAt: nowIso(),
        processedAt: nowIso(),
        attemptCount: asNumber(item.data.attemptCount, 0) + 1,
        updatedAt: nowIso(),
        errorMessage: '',
        errorCode: '',
      }, { merge: true });

      processedCount += 1;
      var localDate = String(item.data.scheduledDate || '').trim();
      if (localDate) {
        sentCountsByDate[localDate] = (sentCountsByDate[localDate] || 0) + 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scheduled send failed.';
      await markLeadFailedInWorkbook(String(item.data.customerSheetId || ''), leadId, asNumber(item.data.sourceReadyRowNumber, 0));
      await getDb().collection(LEAD_ITEMS_COLLECTION).doc(item.id).set({
        status: 'FAILED',
        errorMessage: message,
        errorCode: 'SEND_FAILED',
        processedAt: nowIso(),
        attemptCount: asNumber(item.data.attemptCount, 0) + 1,
        updatedAt: nowIso(),
      }, { merge: true });
      failedCount += 1;
    }
  }

  if (Object.keys(sentCountsByDate).length) {
    await incrementSentCounts(
      String(campaign.userEmail || ''),
      String(campaign.timezone || 'UTC'),
      sentCountsByDate,
    );
  }

  const aggregate = await refreshCampaignAggregate(campaignId);
  await getDb().collection(CAMPAIGNS_COLLECTION).doc(campaignId).set({
    lastRunAt: nowIso(),
    lastRunStatus: failedCount > 0 ? 'warning' : 'success',
    lastErrorMessage: failedCount > 0
      ? `Processed ${processedCount} lead(s), failed ${failedCount} lead(s).`
      : `Processed ${processedCount} lead(s).`,
    updatedAt: nowIso(),
  }, { merge: true });

  if (aggregate.nextRunAtUtc) {
    await queueNextRunIfNeeded(config, campaignId);
  }

  return {
    success: failedCount === 0,
    processedCount,
    failedCount,
    message: failedCount > 0
      ? `Processed ${processedCount} lead(s), failed ${failedCount} lead(s).`
      : `Processed ${processedCount} lead(s).`,
  };
}

export async function runDueCampaigns(config: SchedulerServiceConfig, userEmail: string, customerSheetId: string) {
  const snapshot = await getDb().collection(CAMPAIGNS_COLLECTION).where('userEmail', '==', normalizeEmail(userEmail)).get();
  const campaigns = snapshot.docs
    .map((doc) => doc.data() as Record<string, unknown>)
    .filter((campaign) => String(campaign.customerSheetId || '') === customerSheetId)
    .filter((campaign) => String(campaign.status || '').toUpperCase() === 'ACTIVE')
    .filter((campaign) => {
      const nextRunAtUtc = String(campaign.nextRunAtUtc || '').trim();
      return nextRunAtUtc && new Date(nextRunAtUtc).getTime() <= Date.now();
    })
    .sort((a, b) => String(a.nextRunAtUtc || '').localeCompare(String(b.nextRunAtUtc || '')));

  let processedCount = 0;
  let failedCount = 0;

  for (const campaign of campaigns) {
    const result = await runCampaignDispatch(config, String(campaign.campaignId || ''));
    processedCount += asNumber(result.processedCount, 0);
    failedCount += asNumber(result.failedCount, 0);
  }

  return {
    success: failedCount === 0,
    processedCount,
    failedCount,
    dueCount: campaigns.length,
    message: campaigns.length
      ? `Scheduler processed ${processedCount} scheduled lead(s).`
      : 'No due scheduled campaigns were ready to run.',
  };
}

export async function runSingleCampaignNow(config: SchedulerServiceConfig, campaignId: string, userEmail: string, customerSheetId: string) {
  const campaignSnapshot = await getDb().collection(CAMPAIGNS_COLLECTION).doc(campaignId).get();
  if (!campaignSnapshot.exists) {
    throw new Error('Scheduled campaign was not found.');
  }

  const campaign = campaignSnapshot.data() as Record<string, unknown>;
  if (normalizeEmail(String(campaign.userEmail || '')) !== normalizeEmail(userEmail) || String(campaign.customerSheetId || '') !== customerSheetId) {
    throw new Error('Scheduled campaign does not belong to this user/workbook.');
  }

  return runCampaignDispatch(config, campaignId);
}
