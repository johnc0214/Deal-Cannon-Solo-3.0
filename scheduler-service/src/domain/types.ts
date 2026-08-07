export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type LeadItemStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

export type GmailConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED' | 'ERROR';

export type ScheduleCampaign = {
  campaignId: string;
  userEmail: string;
  customerSheetId: string;
  connectedSenderEmail: string;
  timezone: string;
  startDate: string;
  sendTimeLocal: string;
  dailyLimit: number;
  status: CampaignStatus;
  remainingLeadCount: number;
  sentCount: number;
  failedCount: number;
  cancelledCount: number;
  nextRunAtUtc: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type ScheduleLeadItem = {
  campaignId: string;
  leadId: string;
  userEmail: string;
  customerSheetId: string;
  sourceReadyRowNumber: number | null;
  leadKey: string;
  recipientEmail: string;
  offerType: string;
  subject: string;
  body: string;
  status: LeadItemStatus;
  attemptCount: number;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  lastAttemptAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type DailyCapacityRecord = {
  userEmail: string;
  localDate: string;
  timezone: string;
  reservedCount: number;
  sentCount: number;
  updatedAt: string;
};

export type GmailConnection = {
  userEmail: string;
  connectedEmail: string | null;
  status: GmailConnectionStatus;
  hostedDomain: string | null;
  refreshTokenStored: boolean;
  lastConnectedAt: string | null;
  lastErrorMessage: string | null;
};
