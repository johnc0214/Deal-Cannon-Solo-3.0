import { CloudTasksClient } from '@google-cloud/tasks';
import type { SchedulerServiceConfig } from '../config.js';

function canScheduleTasks(config: SchedulerServiceConfig) {
  return !!(config.googleCloudProject && config.cloudTasksLocation && config.cloudTasksQueue && config.schedulerServicePublicBaseUrl && config.internalSecret);
}

function buildQueuePath(config: SchedulerServiceConfig) {
  const client = new CloudTasksClient();
  return {
    client,
    queuePath: client.queuePath(config.googleCloudProject, config.cloudTasksLocation, config.cloudTasksQueue),
  };
}

export async function enqueueCampaignRunTask(
  config: SchedulerServiceConfig,
  campaignId: string,
  userEmail: string,
  customerSheetId: string,
  scheduleTimeSeconds: number,
) {
  if (!canScheduleTasks(config)) {
    return { queued: false, reason: 'Cloud Tasks is not configured.' };
  }

  const { client, queuePath } = buildQueuePath(config);
  const url = `${config.schedulerServicePublicBaseUrl.replace(/\/+$/, '')}/internal/schedules/run-worker`;
  const taskName = `${queuePath}/tasks/${campaignId}-${scheduleTimeSeconds}`.replace(/[^A-Za-z0-9_\/-]/g, '-');

  await client.createTask({
    parent: queuePath,
    task: {
      name: taskName,
      scheduleTime: { seconds: scheduleTimeSeconds },
      httpRequest: {
        httpMethod: 'POST',
        url,
        headers: {
          'Content-Type': 'application/json',
          'X-Deal-Cannon-Internal-Secret': config.internalSecret,
        },
        body: Buffer.from(JSON.stringify({ campaignId, userEmail, customerSheetId }), 'utf8').toString('base64'),
      },
    },
  });

  return { queued: true };
}
