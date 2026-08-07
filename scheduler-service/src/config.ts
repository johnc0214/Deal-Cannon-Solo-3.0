export type SchedulerServiceConfig = {
  port: number;
  internalSecret: string;
  googleCloudProject: string;
  firestoreDatabaseId: string;
  gmailOauthClientId: string;
  gmailOauthClientSecret: string;
  gmailOauthRedirectUri: string;
  backendServiceAccountEmail: string;
  schedulerServicePublicBaseUrl: string;
  cloudTasksLocation: string;
  cloudTasksQueue: string;
};

function getEnv(name: string, fallback = ''): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : fallback;
}

export function getConfig(): SchedulerServiceConfig {
  return {
    port: Number(getEnv('PORT', '8080')) || 8080,
    internalSecret: getEnv('DEAL_CANNON_INTERNAL_SECRET'),
    googleCloudProject: getEnv('GOOGLE_CLOUD_PROJECT'),
    firestoreDatabaseId: getEnv('FIRESTORE_DATABASE_ID', '(default)'),
    gmailOauthClientId: getEnv('GMAIL_OAUTH_CLIENT_ID'),
    gmailOauthClientSecret: getEnv('GMAIL_OAUTH_CLIENT_SECRET'),
    gmailOauthRedirectUri: getEnv('GMAIL_OAUTH_REDIRECT_URI'),
    backendServiceAccountEmail: getEnv('BACKEND_SERVICE_ACCOUNT_EMAIL'),
    schedulerServicePublicBaseUrl: getEnv('SCHEDULER_SERVICE_PUBLIC_BASE_URL'),
    cloudTasksLocation: getEnv('CLOUD_TASKS_LOCATION'),
    cloudTasksQueue: getEnv('CLOUD_TASKS_QUEUE'),
  };
}
