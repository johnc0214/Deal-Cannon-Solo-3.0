/**************************************
 * Deal Cannon 3.0 — EmailScheduler.gs
 * Local scheduler implementation.
 **************************************/

var DC_SCHEDULER_SHEET_NAME = 'Scheduled Emails';
var DC_SCHEDULER_LOG_SHEET_NAME = 'Scheduler Logs';
var DC_SCHEDULER_READY_SHEET_NAME = 'Ready to Email';
var DC_SCHEDULER_TRIGGER_HANDLER = 'processScheduledEmailCampaigns';
var DC_SCHEDULER_LAST_RUN_AT_KEY = 'DC_SCHEDULER_LAST_RUN_AT';
var DC_SCHEDULER_LAST_RUN_STATUS_KEY = 'DC_SCHEDULER_LAST_RUN_STATUS';
var DC_SCHEDULER_LAST_RUN_MESSAGE_KEY = 'DC_SCHEDULER_LAST_RUN_MESSAGE';
var DC_SCHEDULER_PAUSED_KEY = 'DC_SCHEDULER_PAUSED';
var DC_SCHEDULER_MAX_DAILY_SENDS = 100;
var DC_SCHEDULER_TRIGGER_SOON_MS = 60 * 1000;
var DC_SCHEDULER_PROCESSING_TIMEOUT_MINUTES = 15;
var DC_SCHEDULER_REQUIRED_HEADERS = [
  'scheduleId',
  'createdAt',
  'scheduledDate',
  'scheduledHour',
  'offerType',
  'campaignMode',
  'dailyLimit',
  'name',
  'email',
  'propertyAddress',
  'listPrice',
  'status',
  'processedAt',
  'error',
  'sourceReadyRowNumber',
  'leadId',
  'sourceLeadKey',
  'ownerEmail',
  'ownerTimeZone',
  'customerSheetId',
  'scheduledAtIso',
  'scheduledAtMs',
  'attemptCount',
  'lastAttemptAt'
];

function getEmailSchedulerState() {
  try {
    var now = new Date();
    var ctx = dcSchedulerGetCustomerWorkbookContext_();
    var executionEmail = dcSchedulerNormalizeEmail_(ctx.user && ctx.user.email ? ctx.user.email : '');
    var customerSheetId = String(ctx.user && ctx.user.customerSheetId ? ctx.user.customerSheetId : '').trim();
    var sheet = dcSchedulerGetOrCreateSheet_(ctx.ss, DC_SCHEDULER_SHEET_NAME, true);
    var records = dcSchedulerReadRecords_(sheet)
      .filter(function(record) {
        return dcSchedulerRecordMatchesExecution_(record, executionEmail, customerSheetId);
      })
      .sort(function(a, b) {
        return dcSchedulerGetScheduledAtMillis_(a) - dcSchedulerGetScheduledAtMillis_(b);
      });
    var dueInfo = dcSchedulerGetDueInfo_(records, now, executionEmail, customerSheetId);
    var paused = dcSchedulerIsPaused_();
    var lastRunStatus = paused
      ? 'paused'
      : (dcSchedulerGetUserProperty_(DC_SCHEDULER_LAST_RUN_STATUS_KEY) || (records.length ? 'scheduled' : 'idle'));
    var lastRunMessage = paused
      ? 'Scheduler is paused. Resume it to continue daily sends.'
      : (dcSchedulerGetUserProperty_(DC_SCHEDULER_LAST_RUN_MESSAGE_KEY) || '');

    return {
      success: true,
      records: records,
      count: records.length,
      openCount: dueInfo.openCount,
      dueNowCount: dueInfo.dueNowCount,
      failedCount: dueInfo.failedCount,
      staleProcessingCount: dueInfo.staleProcessingCount,
      lastRunAt: dcSchedulerGetUserProperty_(DC_SCHEDULER_LAST_RUN_AT_KEY),
      lastRunStatus: lastRunStatus,
      lastRunMessage: lastRunMessage,
      trigger: dcSchedulerGetTriggerSummary_(records, executionEmail, customerSheetId),
      workbook: {
        customerSheetId: customerSheetId,
        customerSheetName: String(ctx.user && ctx.user.customerSheetName ? ctx.user.customerSheetName : '')
      }
    };
  } catch (err) {
    return {
      success: false,
      message: dcSchedulerErrorMessage_(err),
      records: []
    };
  }
}

function createEmailSchedule(payload) {
  try {
    payload = payload || {};

    var selectedRows = dcSchedulerNormalizeSelectedRows_(payload.selectedRows);
    var dailyLimit = DC_SCHEDULER_MAX_DAILY_SENDS;
    var sendTimeLocal = String(payload.sendTimeLocal || '').trim();
    var scheduledHour = sendTimeLocal && sendTimeLocal.indexOf(':') !== -1
      ? Number(String(sendTimeLocal).split(':')[0] || 0)
      : dcSchedulerExtractScheduledHour_(payload.scheduledHours);
    var startDate = dcSchedulerNormalizeDateString_(payload.startDate, false);
    var offerType = dcSchedulerNormalizeOfferType_(payload.offerType);
    var campaignMode = dcSchedulerNormalizeCampaignMode_(payload.mode);

    if (!selectedRows.length) {
      throw new Error('Select at least one lead before scheduling.');
    }

    if (campaignMode !== 'send') {
      throw new Error('Scheduled draft mode is not supported. Use scheduled sending only.');
    }

    if (!sendTimeLocal) {
      sendTimeLocal = String(scheduledHour).padStart(2, '0') + ':00';
    }
    var ctx = dcSchedulerGetCustomerWorkbookContext_();
    var executionEmail = dcSchedulerNormalizeEmail_(ctx.user && ctx.user.email ? ctx.user.email : '');
    var customerSheetId = String(ctx.user && ctx.user.customerSheetId ? ctx.user.customerSheetId : '').trim();
    var ownerTimeZone = dcSchedulerNormalizeTimeZone_(payload.timeZone || Session.getScriptTimeZone());
    var sheet = dcSchedulerGetOrCreateSheet_(ctx.ss, DC_SCHEDULER_SHEET_NAME, true);
    var existingRecords = dcSchedulerReadRecords_(sheet);
    var scheduleId = dcSchedulerBuildScheduleId_();
    var createdAt = dcSchedulerFormatTimestamp_(new Date());
    var leads = buildScheduledSendingLeadPayloads_({
      selectedRows: selectedRows,
      selectedLeadIds: payload.selectedLeadIds || [],
      offerType: offerType,
      mode: 'send'
    });
    dcSchedulerAssertLeadsNotAlreadyScheduled_(existingRecords, leads, executionEmail, customerSheetId);

    var queuedRows = dcSchedulerBuildQueuedScheduleRows_(leads, {
      scheduleId: scheduleId,
      createdAt: createdAt,
      startDate: startDate,
      scheduledHour: scheduledHour,
      dailyLimit: dailyLimit,
      offerType: offerType,
      campaignMode: 'send',
      ownerEmail: executionEmail,
      ownerTimeZone: ownerTimeZone,
      customerSheetId: customerSheetId,
      existingRecords: existingRecords
    });

    dcSchedulerAppendRows_(sheet, queuedRows);

    var statusUpdates = selectedRows.map(function(sourceRowNumber) {
      return {
        rowNumber: sourceRowNumber,
        status: 'SCHEDULED'
      };
    });

    try {
      dcSchedulerUpdateReadyLeadStatuses_(ctx.ss, statusUpdates);
    } catch (statusErr) {
      try {
        dcSchedulerDeleteRowsForScheduleId_(sheet, scheduleId);
      } catch (rollbackErr) {}

      throw new Error('Could not mark Ready to Email rows as scheduled. Queue rows were rolled back. ' + dcSchedulerErrorMessage_(statusErr));
    }

    dcSchedulerSetPaused_(false);
    var trigger = dcSchedulerSyncSingleTrigger_({
      records: existingRecords.concat(queuedRows),
      executionEmail: executionEmail,
      customerSheetId: customerSheetId,
      forceReinstall: true
    });

    return {
      success: true,
      scheduleId: scheduleId,
      campaignId: scheduleId,
      scheduledCount: queuedRows.length,
      verifiedScheduleCount: queuedRows.length,
      dayCount: dcSchedulerCountDistinctScheduleDates_(queuedRows),
      message: 'Scheduled ' + queuedRows.length + ' lead(s) at up to ' + dailyLimit + ' per day.',
      trigger: trigger,
      warnings: []
    };
  } catch (err) {
    return {
      success: false,
      message: dcSchedulerErrorMessage_(err)
    };
  }
}

function cancelEmailSchedule(scheduleId) {
  try {
    var cleanScheduleId = String(scheduleId || '').trim();
    if (!cleanScheduleId) {
      throw new Error('Schedule ID is required.');
    }

    var schedulerState = getEmailSchedulerState();
    if (!schedulerState || schedulerState.success === false) {
      throw new Error((schedulerState && schedulerState.message) || 'Could not load scheduled rows.');
    }

    var rowsToRestore = [];
    (schedulerState.records || []).forEach(function(record) {
      if (String(record.scheduleId || '') === cleanScheduleId) {
        rowsToRestore.push(Number(record.rowNumber || 0));
      }
    });

    if (!rowsToRestore.length) {
      return {
        success: true,
        message: 'No open scheduled rows were found for that schedule.'
      };
    }

    return restoreScheduledEmailRows(rowsToRestore);
  } catch (err) {
    return {
      success: false,
      message: dcSchedulerErrorMessage_(err)
    };
  }
}

function deleteScheduledEmailRows(selectedRows) {
  try {
    var request = Array.isArray(selectedRows)
      ? { selectedRows: selectedRows }
      : (selectedRows || {});
    var normalizedRows = dcSchedulerNormalizeSelectedRows_(request.selectedRows);
    var allowDeleteWithSourceRows = request.allowDeleteWithSourceRows === true;

    if (!normalizedRows.length) {
      throw new Error('Select at least one scheduled row first.');
    }

    var schedulerState = getEmailSchedulerState();
    if (!schedulerState || schedulerState.success === false) {
      throw new Error((schedulerState && schedulerState.message) || 'Could not load scheduled rows.');
    }
    var recordsByRow = {};
    (schedulerState.records || []).forEach(function(record) {
      recordsByRow[String(record.rowNumber)] = record;
    });

    if (!allowDeleteWithSourceRows) {
      var linkedRows = [];

      normalizedRows.forEach(function(rowNumber) {
        var record = recordsByRow[String(rowNumber)];
        var status = String(record && record.status || '').trim().toUpperCase();
        if (record && record.sourceReadyRowNumber && (status === 'SCHEDULED' || status === 'PROCESSING' || status === 'PENDING')) {
          linkedRows.push(rowNumber);
        }
      });

      if (linkedRows.length) {
        throw new Error(
          'Scheduled row(s) ' + linkedRows.join(', ') +
          ' are still linked to Ready to Email rows. Use Move Back to Active or Archive instead of Delete.'
        );
      }
    }

    var ctx = dcSchedulerGetCustomerWorkbookContext_();
    var executionEmail = dcSchedulerNormalizeEmail_(ctx.user && ctx.user.email ? ctx.user.email : '');
    var customerSheetId = String(ctx.user && ctx.user.customerSheetId ? ctx.user.customerSheetId : '').trim();
    var sheet = dcSchedulerGetOrCreateSheet_(ctx.ss, DC_SCHEDULER_SHEET_NAME, true);
    var deletedCount = dcSchedulerDeleteRowsByNumber_(sheet, normalizedRows);
    var records = dcSchedulerReadRecords_(sheet);
    dcSchedulerSyncSingleTrigger_({
      records: records,
      executionEmail: executionEmail,
      customerSheetId: customerSheetId,
      forceReinstall: true
    });

    return {
      success: true,
      deletedCount: deletedCount,
      message: 'Removed ' + deletedCount + ' scheduled row(s).'
    };
  } catch (err) {
    return {
      success: false,
      message: dcSchedulerErrorMessage_(err)
    };
  }
}

function restoreScheduledEmailRows(selectedRows) {
  try {
    var normalizedRows = dcSchedulerNormalizeSelectedRows_(selectedRows);
    if (!normalizedRows.length) {
      throw new Error('Select at least one scheduled row first.');
    }

    var schedulerState = getEmailSchedulerState();
    if (!schedulerState || schedulerState.success === false) {
      throw new Error((schedulerState && schedulerState.message) || 'Could not load scheduled rows.');
    }
    var dashboardState = getEmailDashboardState();
    if (!dashboardState || dashboardState.success === false) {
      throw new Error((dashboardState && dashboardState.message) || 'Could not load Ready to Email rows.');
    }
    var recordsByRow = {};
    var rowsToDelete = [];
    var readyByRow = {};

    (schedulerState.records || []).forEach(function(record) {
      recordsByRow[String(record.rowNumber)] = record;
    });

    (dashboardState.leads || []).forEach(function(lead) {
      readyByRow[String(lead.rowNumber)] = lead;
    });

    var restoreWarnings = [];
    normalizedRows.forEach(function(rowNumber) {
      var record = recordsByRow[String(rowNumber)];
      if (!record) {
        restoreWarnings.push('Scheduled row ' + rowNumber + ' was not found.');
        return;
      }

      try {
        var sourceLead = readyByRow[String(record.sourceReadyRowNumber || '')];
        if (!sourceLead) {
          restoreWarnings.push('Scheduled row ' + rowNumber + ' could not be matched to a current Ready to Email row.');
          return;
        }

        var updateResult = updateReadyToEmailLead(sourceLead.rowNumber, { status: 'NEW' });
        if (updateResult && updateResult.success === false) {
          throw new Error(updateResult.message || 'Unknown update error.');
        }

        rowsToDelete.push(rowNumber);
      } catch (err) {
        restoreWarnings.push('Scheduled row ' + rowNumber + ': ' + dcSchedulerErrorMessage_(err));
      }
    });

    var deleteResult = rowsToDelete.length
      ? deleteScheduledEmailRows({ selectedRows: rowsToDelete, allowDeleteWithSourceRows: true })
      : { success: true, deletedCount: 0 };
    if (deleteResult && deleteResult.success === false) {
      throw new Error(deleteResult.message || 'Could not remove restored scheduled rows.');
    }
    var deletedCount = Number(deleteResult && deleteResult.deletedCount || rowsToDelete.length);
    var message = 'Moved ' + deletedCount + ' scheduled row(s) back to Active Leads.';

    if (restoreWarnings.length) {
      message += ' Warnings: ' + restoreWarnings.join(' | ');
    }

    return {
      success: true,
      restoredCount: deletedCount,
      warnings: restoreWarnings,
      message: message
    };
  } catch (err) {
    return {
      success: false,
      message: dcSchedulerErrorMessage_(err)
    };
  }
}

function archiveScheduledEmailRows(selectedRows) {
  try {
    var normalizedRows = dcSchedulerNormalizeSelectedRows_(selectedRows);
    if (!normalizedRows.length) {
      throw new Error('Select at least one scheduled row first.');
    }

    var schedulerState = getEmailSchedulerState();
    if (!schedulerState || schedulerState.success === false) {
      throw new Error((schedulerState && schedulerState.message) || 'Could not load scheduled rows.');
    }
    var dashboardState = getEmailDashboardState();
    if (!dashboardState || dashboardState.success === false) {
      throw new Error((dashboardState && dashboardState.message) || 'Could not load Ready to Email rows.');
    }
    var recordsByRow = {};
    var sourceReadyRows = [];
    var schedulerRowsToDelete = [];
    var warnings = [];
    var readyByRow = {};

    (schedulerState.records || []).forEach(function(record) {
      recordsByRow[String(record.rowNumber)] = record;
    });

    (dashboardState.leads || []).forEach(function(lead) {
      readyByRow[String(lead.rowNumber)] = lead;
    });

    normalizedRows.forEach(function(rowNumber) {
      var record = recordsByRow[String(rowNumber)];
      if (!record) {
        warnings.push('Scheduled row ' + rowNumber + ' was not found.');
        return;
      }

      var sourceLead = readyByRow[String(record.sourceReadyRowNumber || '')];
      if (!sourceLead) {
        warnings.push('Scheduled row ' + rowNumber + ' could not be matched to a current Ready to Email row.');
        return;
      }

      sourceReadyRows.push(sourceLead.rowNumber);
      schedulerRowsToDelete.push(rowNumber);
    });

    if (!sourceReadyRows.length) {
      throw new Error(warnings[0] || 'No selected scheduled rows could be matched to Ready to Email rows.');
    }

    var archiveResult = archiveReadyToEmailRows(sourceReadyRows);
    if (!archiveResult || archiveResult.success === false) {
      throw new Error((archiveResult && archiveResult.message) || 'Archive failed.');
    }

    var deleteResult = deleteScheduledEmailRows({ selectedRows: schedulerRowsToDelete, allowDeleteWithSourceRows: true });

    if (deleteResult && deleteResult.success === false) {
      warnings.push(deleteResult.message || 'Scheduled cleanup failed after archive.');
    }

    var message = archiveResult.message || ('Archived ' + sourceReadyRows.length + ' scheduled lead(s).');
    if (warnings.length) {
      message += ' Warnings: ' + warnings.join(' | ');
    }

    return {
      success: true,
      archivedCount: Number(archiveResult.archivedCount || sourceReadyRows.length),
      deletedScheduledCount: Number(deleteResult && deleteResult.deletedCount || schedulerRowsToDelete.length),
      warnings: warnings,
      cleanupSuccess: !deleteResult || deleteResult.success !== false,
      message: message
    };
  } catch (err) {
    return {
      success: false,
      message: dcSchedulerErrorMessage_(err)
    };
  }
}

function runEmailSchedulerNow() {
  if (dcSchedulerIsPaused_()) {
    return {
      success: false,
      paused: true,
      message: 'Scheduler is paused. Resume it before running a manual send.'
    };
  }

  return dcSchedulerRunDueRows_({ manual: true });
}

function reinstallEmailSchedulerTrigger() {
  try {
    var ctx = dcSchedulerGetCustomerWorkbookContext_();
    var executionEmail = dcSchedulerNormalizeEmail_(ctx.user && ctx.user.email ? ctx.user.email : '');
    var customerSheetId = String(ctx.user && ctx.user.customerSheetId ? ctx.user.customerSheetId : '').trim();
    var sheet = dcSchedulerGetOrCreateSheet_(ctx.ss, DC_SCHEDULER_SHEET_NAME, true);
    var records = dcSchedulerReadRecords_(sheet);
    var trigger = dcSchedulerGetTriggerSummary_(records, executionEmail, customerSheetId);

    if (trigger.exists && trigger.paused !== true) {
      dcSchedulerSetPaused_(true);
      dcSchedulerSyncSingleTrigger_({
        records: records,
        executionEmail: executionEmail,
        customerSheetId: customerSheetId,
        forceReinstall: true,
        paused: true
      });
      return {
        success: true,
        action: 'paused',
        message: 'Scheduler paused. No future daily send trigger is active.',
        trigger: dcSchedulerGetTriggerSummary_(records, executionEmail, customerSheetId)
      };
    }

    dcSchedulerSetPaused_(false);
    var synced = dcSchedulerSyncSingleTrigger_({
      records: records,
      executionEmail: executionEmail,
      customerSheetId: customerSheetId,
      forceReinstall: true
    });

    return {
      success: true,
      action: synced.exists ? 'resumed' : 'idle',
      message: synced.exists
        ? 'Scheduler resumed. The next daily send trigger is armed.'
        : 'No pending scheduled rows were found, so no trigger was created.',
      trigger: synced
    };
  } catch (err) {
    return {
      success: false,
      message: dcSchedulerErrorMessage_(err)
    };
  }
}

function processScheduledEmailCampaigns() {
  return dcSchedulerRunDueRows_({ manual: false });
}

function repairReadyRowsMarkedScheduled() {
  try {
    var dashboardState = getEmailDashboardState();
    if (!dashboardState || dashboardState.success === false) {
      throw new Error((dashboardState && dashboardState.message) || 'Could not load Ready to Email rows.');
    }

    var schedulerState = getEmailSchedulerState();
    if (!schedulerState || schedulerState.success === false) {
      throw new Error((schedulerState && schedulerState.message) || 'Could not load scheduled rows.');
    }

    var scheduledSourceRows = {};
    var scheduledLeadKeys = {};
    (schedulerState.records || []).forEach(function(record) {
      if (dcSchedulerStatusIsOpen_(record.status) && record.sourceReadyRowNumber) {
        scheduledSourceRows[String(record.sourceReadyRowNumber)] = true;
      }

      if (dcSchedulerStatusIsOpen_(record.status)) {
        var leadKey = dcSchedulerGetRecordLeadKey_(record);
        if (leadKey) {
          scheduledLeadKeys[leadKey] = true;
        }
      }
    });

    var repairedRows = [];
    (dashboardState.leads || []).forEach(function(lead) {
      var rowNumber = Number(lead && lead.rowNumber ? lead.rowNumber : 0);
      var status = String(lead && lead.status ? lead.status : '').trim().toUpperCase();

      if (rowNumber > 0 && status === 'SCHEDULED' && !scheduledSourceRows[String(rowNumber)] && !scheduledLeadKeys[dcSchedulerBuildLeadKey_(lead)]) {
        var updateResult = updateReadyToEmailLead(rowNumber, { status: 'NEW' });
        if (!updateResult || updateResult.success !== false) {
          repairedRows.push(rowNumber);
        }
      }
    });

    return {
      success: true,
      repairedCount: repairedRows.length,
      repairedRows: repairedRows,
      message: repairedRows.length
        ? 'Repaired ' + repairedRows.length + ' Ready to Email row(s).'
        : 'No Ready to Email rows needed repair.'
    };
  } catch (err) {
    return {
      success: false,
      message: dcSchedulerErrorMessage_(err)
    };
  }
}

function testCoreLibraryAccess() {
  return getEmailSchedulerState();
}

function debugSoloSchedulerRuntime() {
  return dcSchedulerBuildRuntimeContext_();
}

function debugCustomerSchedulerAuth() {
  return {
    success: true,
    runtime: dcSchedulerBuildRuntimeContext_(),
    gmailConnection: getScheduledSendingConnectionState()
  };
}

function createSchedulerLogsSheet() {
  try {
    var ctx = dcSchedulerGetCustomerWorkbookContext_();
    dcSchedulerGetOrCreateSheet_(ctx.ss, DC_SCHEDULER_LOG_SHEET_NAME, false, ['timestamp', 'manual', 'status', 'processedCount', 'failedCount', 'message']);
    return {
      success: true,
      message: 'Scheduler Logs sheet is ready.'
    };
  } catch (err) {
    return {
      success: false,
      message: dcSchedulerErrorMessage_(err)
    };
  }
}

function debugSchedulerSetup() {
  return {
    success: true,
    runtime: dcSchedulerBuildRuntimeContext_(),
    schedulerState: getEmailSchedulerState(),
    gmailConnection: getScheduledSendingConnectionState()
  };
}

function debugSchedulerRunDryRun() {
  try {
    var schedulerState = getEmailSchedulerState();
    var now = new Date();
    var dueRows = (schedulerState.records || []).filter(function(record) {
      return String(record.status || '').trim().toUpperCase() === 'SCHEDULED' &&
        dcSchedulerGetScheduledAtMillis_(record) <= now.getTime();
    });

    return {
      success: true,
      now: dcSchedulerFormatTimestamp_(now),
      dueCount: dueRows.length,
      dueRows: dueRows.slice(0, 50)
    };
  } catch (err) {
    return {
      success: false,
      message: dcSchedulerErrorMessage_(err)
    };
  }
}

function debugSchedulerUserContext() {
  return dcSchedulerBuildRuntimeContext_();
}

function debugSchedulerFutureDueRows() {
  try {
    var schedulerState = getEmailSchedulerState();
    var now = new Date();
    var futureRows = (schedulerState.records || []).filter(function(record) {
      return String(record.status || '').trim().toUpperCase() === 'SCHEDULED' &&
        dcSchedulerGetScheduledAtMillis_(record) > now.getTime();
    });

    return {
      success: true,
      count: futureRows.length,
      rows: futureRows.slice(0, 50)
    };
  } catch (err) {
    return {
      success: false,
      message: dcSchedulerErrorMessage_(err)
    };
  }
}

function debugSchedulerTriggerContext() {
  return dcSchedulerGetTriggerSummary_();
}

function debugSchedulerAuthorizationContext() {
  return dcSchedulerBuildRuntimeContext_();
}

function debugSchedulerDryRunForCurrentUser() {
  return debugSchedulerRunDryRun();
}

function dcSchedulerGetUserProperties_() {
  return PropertiesService.getUserProperties();
}

function dcSchedulerGetUserProperty_(key) {
  return dcSchedulerGetUserProperties_().getProperty(String(key || '')) || '';
}

function dcSchedulerSetPaused_(paused) {
  var props = dcSchedulerGetUserProperties_();

  if (paused) {
    props.setProperty(DC_SCHEDULER_PAUSED_KEY, 'true');
    return;
  }

  props.deleteProperty(DC_SCHEDULER_PAUSED_KEY);
}

function dcSchedulerIsPaused_() {
  return dcSchedulerGetUserProperty_(DC_SCHEDULER_PAUSED_KEY) === 'true';
}

function dcSchedulerGetSchedulerTriggers_() {
  return ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === DC_SCHEDULER_TRIGGER_HANDLER;
  });
}

function dcSchedulerDeleteSchedulerTriggers_() {
  var deletedCount = 0;

  dcSchedulerGetSchedulerTriggers_().forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
    deletedCount++;
  });

  return deletedCount;
}

function ensureMinuteSchedulerTrigger_(forceReinstall) {
  return dcSchedulerSyncSingleTrigger_({ forceReinstall: forceReinstall === true });
}

function ensureHourlySchedulerTrigger_(forceReinstall) {
  return ensureMinuteSchedulerTrigger_(forceReinstall);
}

function dcSchedulerFindNextRunnableRecord_(records, executionEmail, customerSheetId) {
  var runnable = (records || []).filter(function(record) {
    return dcSchedulerRecordMatchesExecution_(record, executionEmail, customerSheetId) &&
      dcSchedulerStatusCanRun_(record && record.status ? record.status : '');
  }).sort(function(a, b) {
    return dcSchedulerGetScheduledAtMillis_(a) - dcSchedulerGetScheduledAtMillis_(b);
  });

  return runnable.length ? runnable[0] : null;
}

function dcSchedulerSyncSingleTrigger_(options) {
  options = options || {};

  var ctx = options.ctx || dcSchedulerGetCustomerWorkbookContext_();
  var executionEmail = options.executionEmail || dcSchedulerNormalizeEmail_(ctx.user && ctx.user.email ? ctx.user.email : '');
  var customerSheetId = options.customerSheetId || String(ctx.user && ctx.user.customerSheetId ? ctx.user.customerSheetId : '').trim();
  var sheet = options.sheet || dcSchedulerGetOrCreateSheet_(ctx.ss, DC_SCHEDULER_SHEET_NAME, true);
  var records = options.records || dcSchedulerReadRecords_(sheet);
  var paused = options.paused === true || (options.paused !== false && dcSchedulerIsPaused_());
  var nextRecord = paused ? null : dcSchedulerFindNextRunnableRecord_(records, executionEmail, customerSheetId);
  var nextRunAtMs = nextRecord ? dcSchedulerGetScheduledAtMillis_(nextRecord) : 0;
  var triggers = dcSchedulerGetSchedulerTriggers_();
  var shouldCreate = !paused && !!nextRecord;

  if (!shouldCreate || options.forceReinstall === true || triggers.length !== 1) {
    dcSchedulerDeleteSchedulerTriggers_();

    if (shouldCreate) {
      var builder = ScriptApp.newTrigger(DC_SCHEDULER_TRIGGER_HANDLER).timeBased();
      var nextTriggerDate = dcSchedulerBuildNextTriggerDate_(nextRecord, options.afterRun === true);

      builder.at(nextTriggerDate);

      builder.create();
      triggers = dcSchedulerGetSchedulerTriggers_();
    } else {
      triggers = [];
    }
  }

  return dcSchedulerGetTriggerSummary_(records, executionEmail, customerSheetId);
}

function dcSchedulerRunDueRows_(options) {
  options = options || {};

  var lock = LockService.getUserLock();
  var acquired = false;
  var now = new Date();
  var ctx = null;
  var sheet = null;
  var executionEmail = '';
  var customerSheetId = '';
  var claimedRowNumbers = [];
  var shouldSyncTrigger = false;

  try {
    if (!lock.tryLock(options.manual ? 2000 : 1)) {
      var busyMessage = 'Scheduler skipped because another run is already in progress for this user.';

      try {
        ctx = dcSchedulerGetCustomerWorkbookContext_();
        dcSchedulerSetLastRun_('warning', busyMessage, now);
        dcSchedulerAppendLog_(ctx.ss, now, options.manual, 'warning', 0, 0, busyMessage);
      } catch (ignoreErr) {
        dcSchedulerSetLastRun_('warning', busyMessage, now);
      }

      return {
        success: true,
        manual: !!options.manual,
        skipped: true,
        dueCount: 0,
        processedCount: 0,
        failedCount: 0,
        message: busyMessage
      };
    }

    acquired = true;

    ctx = dcSchedulerGetCustomerWorkbookContext_();
    executionEmail = dcSchedulerNormalizeEmail_(ctx.user && ctx.user.email ? ctx.user.email : '');
    customerSheetId = String(ctx.user && ctx.user.customerSheetId ? ctx.user.customerSheetId : '').trim();
    sheet = dcSchedulerGetOrCreateSheet_(ctx.ss, DC_SCHEDULER_SHEET_NAME, true);
    shouldSyncTrigger = true;

    if (dcSchedulerIsPaused_()) {
      return {
        success: false,
        paused: true,
        skipped: true,
        dueCount: 0,
        processedCount: 0,
        failedCount: 0,
        message: 'Scheduler is paused. Resume it to continue daily sends.'
      };
    }

    var records = dcSchedulerReadRecords_(sheet);
    var recoveredProcessingCount = dcSchedulerRecoverStaleProcessingRows_(sheet, records, now, executionEmail, customerSheetId);

    if (recoveredProcessingCount) {
      records = dcSchedulerReadRecords_(sheet);
    }

    var dueRows = dcSchedulerGetDueRows_(records, now, executionEmail, customerSheetId);

    if (!dueRows.length) {
      var noOpMessage = 'Scheduler found no due rows for ' + dcSchedulerFormatTimestamp_(now) + '.';
      if (recoveredProcessingCount) {
        noOpMessage += ' Failed ' + recoveredProcessingCount + ' stale processing row(s) for manual review.';
      }
      dcSchedulerSetLastRun_('success', noOpMessage, now);
      dcSchedulerAppendLog_(ctx.ss, now, options.manual, 'success', 0, 0, noOpMessage);

      return {
        success: true,
        manual: !!options.manual,
        dueCount: 0,
        processedCount: 0,
        failedCount: 0,
        message: noOpMessage
      };
    }

    // Fail fast before rows are claimed so we do not strand them in PROCESSING.
    dcSchedulerGetReadyLeadLookup_();

    var claimedAt = dcSchedulerFormatTimestamp_(now);
    dcSchedulerUpdateRows_(sheet, dueRows.map(function(record) {
      var attemptCount = Number(record && record.attemptCount || 0) + 1;

      return {
        rowNumber: record.rowNumber,
        fields: {
          status: 'PROCESSING',
          error: '',
          processedAt: '',
          lastAttemptAt: claimedAt,
          attemptCount: String(attemptCount)
        }
      };
    }));

    claimedRowNumbers = dueRows.map(function(record) {
      return record.rowNumber;
    });

    var groupedRows = dcSchedulerGroupDueRows_(dueRows);
    var processedCount = 0;
    var failedCount = 0;
    var deferredCount = 0;
    var errorMessages = [];
    var completedScheduledRows = [];

    Object.keys(groupedRows).forEach(function(groupKey) {
      var group = groupedRows[groupKey];
      var readyLookup = dcSchedulerGetReadyLeadLookup_();
      var readyRows = [];
      var runnableRows = [];
      var prepFailureUpdates = [];
      var sourceLinkUpdates = [];

      group.records.forEach(function(record) {
        try {
          var sourceLead = dcSchedulerResolveCurrentSourceLead_(record, readyLookup);
          if (!sourceLead) {
            throw new Error('Scheduled row could not be matched to a current Ready to Email row.');
          }

          record.sourceReadyRowNumber = Number(sourceLead.rowNumber || 0);
          record.sourceLeadKey = dcSchedulerBuildLeadKey_(sourceLead);
          record.resolvedSourceReadyRowNumber = record.sourceReadyRowNumber;

          if (Number(record.rowNumber || 0) > 1) {
            sourceLinkUpdates.push({
              rowNumber: record.rowNumber,
              fields: {
                sourceReadyRowNumber: String(record.sourceReadyRowNumber),
                sourceLeadKey: String(record.sourceLeadKey || '')
              }
            });
          }

          readyRows.push(record.sourceReadyRowNumber);
          runnableRows.push(record);
        } catch (err) {
          var prepError = dcSchedulerErrorMessage_(err);
          failedCount++;
          errorMessages.push('Ready row ' + (record.sourceReadyRowNumber || record.rowNumber) + ': ' + prepError);
          prepFailureUpdates.push({
            rowNumber: record.rowNumber,
            fields: {
              status: 'FAILED',
              error: prepError,
              processedAt: dcSchedulerFormatTimestamp_(new Date())
            }
          });
        }
      });

      if (prepFailureUpdates.length) {
        dcSchedulerUpdateRows_(sheet, prepFailureUpdates);
      }

      if (sourceLinkUpdates.length) {
        dcSchedulerUpdateRows_(sheet, sourceLinkUpdates);
      }

      if (!readyRows.length) {
        return;
      }

      try {
        var result = runMassEmailCampaignSelected({
          offerType: group.offerType,
          mode: group.campaignMode,
          selectedRows: readyRows
        });

        var outcomeSets = dcSchedulerBuildCampaignOutcomeSets_(result);
        var failureMessagesByRow = dcSchedulerBuildFailureMessageMap_(result);
        var finalStatus = group.campaignMode === 'send' ? 'SENT' : 'DRAFTED';
        var completedAt = dcSchedulerFormatTimestamp_(new Date());
        var rowUpdates = [];

        if (!outcomeSets.hasDetailedOutcomes) {
          if (!result || result.success === false) {
            throw new Error((result && result.message) || 'Campaign run returned an unknown error.');
          }

          dcSchedulerUpdateRows_(sheet, runnableRows.map(function(record) {
            completedScheduledRows.push(record.rowNumber);
            processedCount++;

            return {
              rowNumber: record.rowNumber,
              fields: {
                status: finalStatus,
                error: '',
                processedAt: completedAt,
                sourceReadyRowNumber: String(record.resolvedSourceReadyRowNumber || record.sourceReadyRowNumber || ''),
                sourceLeadKey: String(record.sourceLeadKey || dcSchedulerGetRecordLeadKey_(record) || '')
              }
            };
          }));

          return;
        }

        runnableRows.forEach(function(record) {
          var sourceRowNumber = Number(record.resolvedSourceReadyRowNumber || record.sourceReadyRowNumber || 0);
          var blockedMessage = String(result && result.quotaMessage || '').trim();
          var skippedMessage = failureMessagesByRow[sourceRowNumber] || 'Ready to Email row was skipped during campaign processing.';
          var failureMessage = failureMessagesByRow[sourceRowNumber] || ((result && result.message) || 'Campaign run failed for this scheduled row.');

          if (outcomeSets.processed[sourceRowNumber]) {
            completedScheduledRows.push(record.rowNumber);
            processedCount++;
            rowUpdates.push({
              rowNumber: record.rowNumber,
              fields: {
                status: finalStatus,
                error: '',
                processedAt: completedAt,
                sourceReadyRowNumber: String(sourceRowNumber || ''),
                sourceLeadKey: String(record.sourceLeadKey || dcSchedulerGetRecordLeadKey_(record) || '')
              }
            });
            return;
          }

          if (outcomeSets.blocked[sourceRowNumber]) {
            deferredCount++;
            var deferredFields = dcSchedulerBuildDeferredScheduleFields_(record);
            rowUpdates.push({
              rowNumber: record.rowNumber,
              fields: {
                status: 'SCHEDULED',
                error: blockedMessage ? ('Deferred after quota stop: ' + blockedMessage) : 'Deferred after quota stop.',
                processedAt: completedAt,
                scheduledDate: deferredFields.scheduledDate,
                scheduledHour: deferredFields.scheduledHour,
                scheduledAtIso: deferredFields.scheduledAtIso,
                scheduledAtMs: deferredFields.scheduledAtMs,
                sourceReadyRowNumber: String(sourceRowNumber || ''),
                sourceLeadKey: String(record.sourceLeadKey || dcSchedulerGetRecordLeadKey_(record) || '')
              }
            });
            return;
          }

          if (outcomeSets.failed[sourceRowNumber]) {
            failedCount++;
            rowUpdates.push({
              rowNumber: record.rowNumber,
              fields: {
                status: 'FAILED',
                error: failureMessage,
                processedAt: completedAt,
                sourceReadyRowNumber: String(sourceRowNumber || ''),
                sourceLeadKey: String(record.sourceLeadKey || dcSchedulerGetRecordLeadKey_(record) || '')
              }
            });
            return;
          }

          if (outcomeSets.skipped[sourceRowNumber]) {
            failedCount++;
            rowUpdates.push({
              rowNumber: record.rowNumber,
              fields: {
                status: 'FAILED',
                error: skippedMessage,
                processedAt: completedAt,
                sourceReadyRowNumber: String(sourceRowNumber || ''),
                sourceLeadKey: String(record.sourceLeadKey || dcSchedulerGetRecordLeadKey_(record) || '')
              }
            });
            return;
          }

          failedCount++;
          rowUpdates.push({
            rowNumber: record.rowNumber,
            fields: {
              status: 'FAILED',
              error: (result && result.message) || 'Campaign run ended without a clear row outcome.',
              processedAt: completedAt,
              sourceReadyRowNumber: String(sourceRowNumber || ''),
              sourceLeadKey: String(record.sourceLeadKey || dcSchedulerGetRecordLeadKey_(record) || '')
            }
          });
        });

        if (rowUpdates.length) {
          dcSchedulerUpdateRows_(sheet, rowUpdates);
        }
      } catch (err) {
        var groupError = dcSchedulerErrorMessage_(err);
        failedCount += runnableRows.length;
        errorMessages.push(group.offerType + ' / ' + group.campaignMode + ': ' + groupError);
        var failedAt = dcSchedulerFormatTimestamp_(new Date());

        runnableRows.forEach(function(record) {
          try {
            if (record.resolvedSourceReadyRowNumber) {
              updateReadyToEmailLead(record.resolvedSourceReadyRowNumber, { status: 'FAILED' });
            }
          } catch (ignoreErr) {}
        });

        dcSchedulerUpdateRows_(sheet, runnableRows.map(function(record) {
          return {
            rowNumber: record.rowNumber,
            fields: {
              status: 'FAILED',
              error: groupError,
              processedAt: failedAt,
              sourceReadyRowNumber: String(record.resolvedSourceReadyRowNumber || record.sourceReadyRowNumber || ''),
              sourceLeadKey: String(record.sourceLeadKey || dcSchedulerGetRecordLeadKey_(record) || '')
            }
          };
        }));
      }
    });

    if (completedScheduledRows.length) {
      try {
        dcSchedulerDeleteRowsByNumber_(sheet, completedScheduledRows);
      } catch (cleanupErr) {
        errorMessages.push('Completed scheduled rows could not be cleaned up automatically: ' + dcSchedulerErrorMessage_(cleanupErr));
      }
    }

    var message =
      'Scheduler processed ' + processedCount + ' row(s)' +
      (failedCount ? ' and failed ' + failedCount + ' row(s).' : '.');

    if (deferredCount) {
      message += ' Deferred ' + deferredCount + ' row(s) to the next day after a quota stop.';
    }

    if (recoveredProcessingCount) {
      message += ' Failed ' + recoveredProcessingCount + ' stale processing row(s) for manual review.';
    }

    if (errorMessages.length) {
      message += ' ' + errorMessages.join(' | ');
    }

    dcSchedulerSetLastRun_(failedCount || recoveredProcessingCount ? 'warning' : 'success', message, now);
    dcSchedulerAppendLog_(ctx.ss, now, options.manual, failedCount || recoveredProcessingCount ? 'warning' : 'success', processedCount, failedCount, message);

    return {
      success: true,
      manual: !!options.manual,
      dueCount: dueRows.length,
      processedCount: processedCount,
      failedCount: failedCount,
      message: message
    };
  } catch (err) {
    var failureMessage = dcSchedulerErrorMessage_(err);

    if (sheet && claimedRowNumbers.length) {
      try {
        dcSchedulerFailClaimedRows_(sheet, claimedRowNumbers, failureMessage);
      } catch (rollbackErr) {
        failureMessage += ' Rollback warning: ' + dcSchedulerErrorMessage_(rollbackErr);
      }
    }

    dcSchedulerSetLastRun_('error', failureMessage, now);

    if (ctx && ctx.ss) {
      dcSchedulerAppendLog_(ctx.ss, now, options.manual, 'error', 0, claimedRowNumbers.length || 0, failureMessage);
    }

    return {
      success: false,
      manual: !!options.manual,
      message: failureMessage
    };
  } finally {
    if (shouldSyncTrigger && sheet && ctx && !dcSchedulerIsPaused_()) {
      try {
        dcSchedulerSyncSingleTrigger_({
          ctx: ctx,
          sheet: sheet,
          executionEmail: executionEmail,
          customerSheetId: customerSheetId,
          forceReinstall: true,
          afterRun: true
        });
      } catch (ignoreSyncErr) {}
    }

    if (acquired) {
      lock.releaseLock();
    }
  }
}

function dcSchedulerBuildRuntimeContext_() {
  var activeUserEmail = '';
  var effectiveUserEmail = '';
  var appContext = null;

  try {
    activeUserEmail = Session.getActiveUser().getEmail();
  } catch (err) {
    activeUserEmail = '';
  }

  try {
    effectiveUserEmail = Session.getEffectiveUser().getEmail();
  } catch (err2) {
    effectiveUserEmail = '';
  }

  try {
    appContext = DealCannonCorev2.getAppContext();
  } catch (err3) {
    appContext = {
      success: false,
      message: dcSchedulerErrorMessage_(err3)
    };
  }

  return {
    success: true,
    activeUserEmail: activeUserEmail,
    effectiveUserEmail: effectiveUserEmail,
    appContext: appContext,
    trigger: dcSchedulerGetTriggerSummary_(),
    lastRunAt: dcSchedulerGetScriptProperty_(DC_SCHEDULER_LAST_RUN_AT_KEY),
    lastRunStatus: dcSchedulerGetScriptProperty_(DC_SCHEDULER_LAST_RUN_STATUS_KEY),
    lastRunMessage: dcSchedulerGetScriptProperty_(DC_SCHEDULER_LAST_RUN_MESSAGE_KEY)
  };
}

function dcSchedulerGetCustomerWorkbookContext_() {
  var appContext = DealCannonCorev2.getAppContext();

  if (!appContext || appContext.success === false || !appContext.user || !appContext.user.customerSheetId) {
    throw new Error((appContext && appContext.message) || 'Customer workbook is not available for scheduling.');
  }

  var workbookId = String(appContext.user.customerSheetId || '').trim();
  if (!workbookId) {
    throw new Error('Customer workbook ID is missing.');
  }

  return {
    user: appContext.user,
    ss: SpreadsheetApp.openById(workbookId)
  };
}

function dcSchedulerGetOrCreateSheet_(ss, sheetName, hidden, requiredHeaders) {
  var sheet = ss.getSheetByName(sheetName);
  var headerList = requiredHeaders || DC_SCHEDULER_REQUIRED_HEADERS;

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  if (sheetName === DC_SCHEDULER_SHEET_NAME && dcSchedulerAreHeadersCanonical_(headerList, DC_SCHEDULER_REQUIRED_HEADERS)) {
    dcSchedulerNormalizeSchedulerSheet_(sheet);
  } else {
    dcSchedulerEnsureHeaderMap_(sheet, headerList);
  }

  sheet.setFrozenRows(1);

  if (hidden) {
    try {
      sheet.hideSheet();
    } catch (ignoreErr) {}
  }

  return sheet;
}

function dcSchedulerGetReadySheet_(ss) {
  var sheet = ss.getSheetByName(DC_SCHEDULER_READY_SHEET_NAME);

  if (!sheet) {
    throw new Error('Ready to Email tab not found.');
  }

  return sheet;
}

function dcSchedulerUpdateReadyLeadStatuses_(ss, statusUpdates) {
  statusUpdates = Array.isArray(statusUpdates) ? statusUpdates : [];
  if (!statusUpdates.length) {
    return;
  }

  var sheet = dcSchedulerGetReadySheet_(ss);
  var updatesByRow = {};
  var rowNumbers = [];

  statusUpdates.forEach(function(item) {
    if (!item) {
      return;
    }

    var rowNumber = Number(item.rowNumber || 0);
    if (rowNumber <= 1) {
      return;
    }

    if (!updatesByRow[rowNumber]) {
      rowNumbers.push(rowNumber);
    }

    updatesByRow[rowNumber] = String(item.status || 'NEW').trim().toUpperCase() || 'NEW';
  });

  if (!rowNumbers.length) {
    return;
  }

  rowNumbers.sort(function(a, b) {
    return a - b;
  });

  var minRow = rowNumbers[0];
  var maxRow = rowNumbers[rowNumbers.length - 1];
  var lastRow = sheet.getLastRow();

  if (maxRow > lastRow) {
    throw new Error('Ready to Email row ' + maxRow + ' was not found. Refresh the dashboard and try again.');
  }

  var statusValues = sheet.getRange(minRow, 5, maxRow - minRow + 1, 1).getValues();

  rowNumbers.forEach(function(rowNumber) {
    statusValues[rowNumber - minRow][0] = updatesByRow[rowNumber];
  });

  sheet.getRange(minRow, 5, statusValues.length, 1).setValues(statusValues);
}

function dcSchedulerEnsureHeaderMap_(sheet, requiredHeaders) {
  requiredHeaders = requiredHeaders || DC_SCHEDULER_REQUIRED_HEADERS;
  var lastColumn = Math.max(sheet.getLastColumn(), 0);
  var headers = [];

  if (lastColumn > 0) {
    headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  }

  headers = headers.map(function(value) {
    return String(value || '').trim();
  });

  if (!headers.length) {
    headers = requiredHeaders.slice();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    var changed = false;

    requiredHeaders.forEach(function(header) {
      if (headers.indexOf(header) === -1) {
        headers.push(header);
        changed = true;
      }
    });

    if (changed) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  var headerMap = {};
  headers.forEach(function(header, index) {
    if (header) {
      headerMap[header] = index + 1;
    }
  });

  return headerMap;
}

function dcSchedulerNormalizeSchedulerSheet_(sheet) {
  var canonicalHeaders = DC_SCHEDULER_REQUIRED_HEADERS.slice();
  var lastRow = Math.max(sheet.getLastRow(), 0);
  var lastColumn = Math.max(sheet.getLastColumn(), 0);
  var headers = [];

  if (lastColumn > 0) {
    headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(value) {
      return String(value || '').trim();
    });
  }

  if (!lastRow || !lastColumn) {
    sheet.getRange(1, 1, 1, canonicalHeaders.length).setValues([canonicalHeaders]);
    return;
  }

  if (dcSchedulerHeadersAreCanonical_(headers, canonicalHeaders)) {
    return;
  }

  var values = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues()
    : [];
  var normalizedRows = [];

  values.forEach(function(rowValues, index) {
    var record = dcSchedulerBuildRecordFromSheetRow_(headers, rowValues, index + 2);
    if (!String(record.scheduleId || '').trim()) {
      return;
    }

    normalizedRows.push(dcSchedulerBuildRowValuesFromRecord_(record, canonicalHeaders));
  });

  sheet.clearContents();
  sheet.getRange(1, 1, 1, canonicalHeaders.length).setValues([canonicalHeaders]);

  if (normalizedRows.length) {
    sheet.getRange(2, 1, normalizedRows.length, canonicalHeaders.length).setValues(normalizedRows);
  }
}

function dcSchedulerHeadersAreCanonical_(headers, canonicalHeaders) {
  canonicalHeaders = canonicalHeaders || DC_SCHEDULER_REQUIRED_HEADERS;
  headers = Array.isArray(headers) ? headers : [];

  if (headers.length !== canonicalHeaders.length) {
    return false;
  }

  var seen = {};
  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i] || '').trim();
    if (!header || seen[header] || header !== canonicalHeaders[i]) {
      return false;
    }
    seen[header] = true;
  }

  return true;
}

function dcSchedulerAreHeadersCanonical_(headers, canonicalHeaders) {
  headers = Array.isArray(headers) ? headers : [];
  canonicalHeaders = Array.isArray(canonicalHeaders) ? canonicalHeaders : [];

  if (headers.length !== canonicalHeaders.length) {
    return false;
  }

  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').trim() !== String(canonicalHeaders[i] || '').trim()) {
      return false;
    }
  }

  return true;
}

function dcSchedulerBuildRecordFromSheetRow_(headers, rowValues, rowNumber) {
  headers = Array.isArray(headers) ? headers : [];
  rowValues = Array.isArray(rowValues) ? rowValues : [];
  var record = { rowNumber: Number(rowNumber || 0) };
  var headerMap = {};

  headers.forEach(function(header, index) {
    var cleanHeader = String(header || '').trim();
    if (cleanHeader && headerMap[cleanHeader] === undefined) {
      headerMap[cleanHeader] = index;
    }
  });

  DC_SCHEDULER_REQUIRED_HEADERS.forEach(function(header, index) {
    var namedValue = headerMap[header] !== undefined ? rowValues[headerMap[header]] : '';
    var legacyValue = rowValues[index];
    var value = namedValue;

    if (!String(value || '').trim() && String(legacyValue || '').trim()) {
      value = legacyValue;
    }

    record[header] = value || '';
  });

  record.scheduledHour = Number(record.scheduledHour || 0);
  record.dailyLimit = Number(record.dailyLimit || 0);
  record.sourceReadyRowNumber = Number(record.sourceReadyRowNumber || 0);
  record.scheduledAtMs = Number(record.scheduledAtMs || 0);
  record.attemptCount = Number(record.attemptCount || 0);

  return record;
}

function dcSchedulerBuildRowValuesFromRecord_(record, headers) {
  record = record || {};
  headers = headers || DC_SCHEDULER_REQUIRED_HEADERS;

  return headers.map(function(header) {
    if (header === 'scheduledHour') {
      return String(record.scheduledHour || '');
    }

    if (header === 'dailyLimit') {
      return String(record.dailyLimit || '');
    }

    if (header === 'sourceReadyRowNumber') {
      return String(record.sourceReadyRowNumber || '');
    }

    if (header === 'scheduledAtMs') {
      return String(record.scheduledAtMs || '');
    }

    if (header === 'attemptCount') {
      return String(record.attemptCount || '');
    }

    return String(record[header] || '');
  });
}

function dcSchedulerReadRecords_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastColumn = Math.max(sheet.getLastColumn(), 0);

  if (lastRow <= 1 || lastColumn <= 0) {
    return [];
  }

  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(value) {
    return String(value || '').trim();
  });
  var values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();

  return values
    .map(function(rowValues, index) {
      return dcSchedulerBuildRecordFromSheetRow_(headers, rowValues, index + 2);
    })
    .filter(function(record) {
      return !!String(record.scheduleId || '').trim();
    });
}

function dcSchedulerAppendRows_(sheet, rows) {
  if (!rows || !rows.length) {
    return;
  }

  var normalizedRows = rows.map(function(row) {
    if (Array.isArray(row)) {
      return row;
    }

    return dcSchedulerBuildRowValuesFromRecord_(row, DC_SCHEDULER_REQUIRED_HEADERS);
  });
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, normalizedRows.length, normalizedRows[0].length).setValues(normalizedRows);
}

function dcSchedulerCountRowsForScheduleId_(sheet, scheduleId) {
  var targetId = String(scheduleId || '').trim();
  if (!targetId) {
    return 0;
  }

  return dcSchedulerReadRecords_(sheet).filter(function(record) {
    return String(record.scheduleId || '').trim() === targetId;
  }).length;
}

function dcSchedulerDeleteRowsForScheduleId_(sheet, scheduleId) {
  var targetId = String(scheduleId || '').trim();
  if (!targetId) {
    return 0;
  }

  var rowNumbers = dcSchedulerReadRecords_(sheet).filter(function(record) {
    return String(record.scheduleId || '').trim() === targetId;
  }).map(function(record) {
    return record.rowNumber;
  });

  return dcSchedulerDeleteRowsByNumber_(sheet, rowNumbers);
}

function dcSchedulerDeleteRowsByNumber_(sheet, rowNumbers) {
  var uniqueRows = dcSchedulerNormalizeSelectedRows_(rowNumbers).sort(function(a, b) {
    return b - a;
  });

  var groups = [];
  var currentGroup = null;

  uniqueRows.forEach(function(rowNumber) {
    if (rowNumber <= 1) {
      return;
    }

    if (!currentGroup) {
      currentGroup = { start: rowNumber, count: 1 };
      return;
    }

    if (rowNumber === currentGroup.start - currentGroup.count) {
      currentGroup.count++;
      return;
    }

    groups.push(currentGroup);
    currentGroup = { start: rowNumber, count: 1 };
  });

  if (currentGroup) {
    groups.push(currentGroup);
  }

  groups.forEach(function(group) {
    var firstRow = group.start - group.count + 1;
    if (firstRow > 1 && firstRow <= sheet.getLastRow()) {
      sheet.deleteRows(firstRow, group.count);
    }
  });

  return uniqueRows.length;
}

function dcSchedulerUpdateRows_(sheet, rowUpdates) {
  rowUpdates = Array.isArray(rowUpdates) ? rowUpdates : [];
  if (!rowUpdates.length) {
    return;
  }

  var headerMap = dcSchedulerEnsureHeaderMap_(sheet);
  var lastColumn = Math.max(sheet.getLastColumn(), 0);
  if (lastColumn <= 0) {
    return;
  }

  var updatesByRow = {};
  var rowNumbers = [];

  rowUpdates.forEach(function(item) {
    if (!item) {
      return;
    }

    var rowNumber = Number(item.rowNumber || 0);
    if (rowNumber <= 1) {
      return;
    }

    if (!updatesByRow[rowNumber]) {
      updatesByRow[rowNumber] = {};
      rowNumbers.push(rowNumber);
    }

    Object.keys(item.fields || {}).forEach(function(field) {
      updatesByRow[rowNumber][field] = item.fields[field];
    });
  });

  if (!rowNumbers.length) {
    return;
  }

  rowNumbers.sort(function(a, b) {
    return a - b;
  });

  var minRow = rowNumbers[0];
  var maxRow = rowNumbers[rowNumbers.length - 1];
  var values = sheet.getRange(minRow, 1, maxRow - minRow + 1, lastColumn).getValues();

  rowNumbers.forEach(function(rowNumber) {
    var rowValues = values[rowNumber - minRow];
    var updates = updatesByRow[rowNumber];

    Object.keys(updates).forEach(function(field) {
      if (!headerMap[field]) {
        return;
      }

      rowValues[headerMap[field] - 1] = updates[field];
    });
  });

  sheet.getRange(minRow, 1, values.length, lastColumn).setValues(values);
}

function dcSchedulerUpdateRecordFields_(sheet, rowNumber, updates) {
  dcSchedulerUpdateRows_(sheet, [{
    rowNumber: rowNumber,
    fields: updates || {}
  }]);
}

function dcSchedulerRecoverStaleProcessingRows_(sheet, records, now, executionEmail, customerSheetId) {
  now = now || new Date();
  var recoveredAt = dcSchedulerFormatTimestamp_(now);
  var recoveredUpdates = [];

  records.forEach(function(record) {
    if (!dcSchedulerRecordMatchesExecution_(record, executionEmail, customerSheetId)) {
      return;
    }

    if (!dcSchedulerIsStaleProcessing_(record, now)) {
      return;
    }

    record.status = 'FAILED';
    record.error = 'Recovered stale PROCESSING state after timeout. Manual review required to avoid duplicate sending.';
    record.processedAt = recoveredAt;
    recoveredUpdates.push({
      rowNumber: record.rowNumber,
      fields: {
        status: 'FAILED',
        error: record.error,
        processedAt: recoveredAt
      }
    });
  });

  if (recoveredUpdates.length) {
    dcSchedulerUpdateRows_(sheet, recoveredUpdates);
  }

  return recoveredUpdates.length;
}

function dcSchedulerGetDueRows_(records, now, executionEmail, customerSheetId) {
  var nowMs = (now || new Date()).getTime();

  return records.filter(function(record) {
    if (!dcSchedulerRecordMatchesExecution_(record, executionEmail, customerSheetId)) {
      return false;
    }

    if (!dcSchedulerRecordCanRun_(record, now)) {
      return false;
    }

    var scheduledAtMs = dcSchedulerGetScheduledAtMillis_(record);
    if (!scheduledAtMs) {
      return false;
    }

    return scheduledAtMs <= nowMs;
  }).sort(function(a, b) {
    return dcSchedulerGetScheduledAtMillis_(a) - dcSchedulerGetScheduledAtMillis_(b);
  }).slice(0, DC_SCHEDULER_MAX_DAILY_SENDS);
}

function dcSchedulerGetDueInfo_(records, now, executionEmail, customerSheetId) {
  var dueRows = dcSchedulerGetDueRows_(records, now, executionEmail, customerSheetId);
  var openCount = 0;
  var failedCount = 0;
  var staleProcessingCount = 0;

  records.forEach(function(record) {
    if (!dcSchedulerRecordMatchesExecution_(record, executionEmail, customerSheetId)) {
      return;
    }

    if (dcSchedulerStatusIsOpen_(record.status)) {
      openCount++;
    }
    if (String(record.status || '').trim().toUpperCase() === 'FAILED') {
      failedCount++;
    }
    if (dcSchedulerIsStaleProcessing_(record, now)) {
      staleProcessingCount++;
    }
  });

  return {
    dueNowCount: dueRows.length,
    openCount: openCount,
    failedCount: failedCount,
    staleProcessingCount: staleProcessingCount
  };
}

function dcSchedulerGroupDueRows_(records) {
  var grouped = {};

  records.forEach(function(record) {
    var offerType = dcSchedulerNormalizeOfferType_(record.offerType);
    var campaignMode = dcSchedulerNormalizeCampaignMode_(record.campaignMode);
    var key = offerType + '|' + campaignMode;

    if (!grouped[key]) {
      grouped[key] = {
        offerType: offerType,
        campaignMode: campaignMode,
        records: []
      };
    }

    grouped[key].records.push(record);
  });

  return grouped;
}

function dcSchedulerGetTriggerSummary_(records, executionEmail, customerSheetId) {
  var triggers = ScriptApp.getProjectTriggers();
  var schedulerTriggers = dcSchedulerGetSchedulerTriggers_();
  var nextRecord = dcSchedulerFindNextRunnableRecord_(records || [], executionEmail || '', customerSheetId || '');

  return {
    success: true,
    exists: schedulerTriggers.length > 0,
    triggerCount: schedulerTriggers.length,
    handlerFunction: DC_SCHEDULER_TRIGGER_HANDLER,
    pollingMinutes: 0,
    paused: dcSchedulerIsPaused_(),
    nextRunAt: nextRecord ? String(nextRecord.scheduledAtIso || '') : '',
    allHandlerFunctions: triggers.map(function(trigger) {
      return trigger.getHandlerFunction();
    })
  };
}

function dcSchedulerAppendLog_(ss, timestamp, manual, status, processedCount, failedCount, message) {
  try {
    var headers = ['timestamp', 'manual', 'status', 'processedCount', 'failedCount', 'message'];
    var sheet = dcSchedulerGetOrCreateSheet_(ss, DC_SCHEDULER_LOG_SHEET_NAME, false, headers);

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    sheet.appendRow([
      dcSchedulerFormatTimestamp_(timestamp),
      manual ? 'TRUE' : 'FALSE',
      status,
      processedCount,
      failedCount,
      message
    ]);
  } catch (ignoreErr) {}
}

function dcSchedulerSetLastRun_(status, message, timestamp) {
  var props = dcSchedulerGetUserProperties_();
  props.setProperty(DC_SCHEDULER_LAST_RUN_AT_KEY, dcSchedulerFormatTimestamp_(timestamp || new Date()));
  props.setProperty(DC_SCHEDULER_LAST_RUN_STATUS_KEY, String(status || ''));
  props.setProperty(DC_SCHEDULER_LAST_RUN_MESSAGE_KEY, String(message || ''));
}

function dcSchedulerGetScriptProperty_(key) {
  return dcSchedulerGetUserProperty_(key);
}

function dcSchedulerBuildCampaignOutcomeSets_(result) {
  var processed = dcSchedulerBuildNumberSet_((result && result.processedRowNumbers) || []);
  var failed = dcSchedulerBuildNumberSet_((result && result.failedRowNumbers) || []);
  var blocked = dcSchedulerBuildNumberSet_((result && result.blockedRowNumbers) || []);
  var skipped = dcSchedulerBuildNumberSet_((result && result.skippedRowNumbers) || []);

  return {
    processed: processed,
    failed: failed,
    blocked: blocked,
    skipped: skipped,
    hasDetailedOutcomes: !!(
      Object.keys(processed).length ||
      Object.keys(failed).length ||
      Object.keys(blocked).length ||
      Object.keys(skipped).length
    )
  };
}

function dcSchedulerBuildFailureMessageMap_(result) {
  var map = {};

  ((result && result.failureDetails) || []).forEach(function(item) {
    var rowNumber = Number(item && item.rowNumber || 0);
    if (rowNumber > 0) {
      map[rowNumber] = String(item && item.message || 'Campaign run failed for this lead.');
    }
  });

  ((result && result.skippedDetails) || []).forEach(function(item) {
    var rowNumber = Number(item && item.rowNumber || 0);
    if (rowNumber > 0 && !map[rowNumber]) {
      map[rowNumber] = String(item && item.message || 'Ready to Email row was skipped during campaign processing.');
    }
  });

  return map;
}

function dcSchedulerBuildNumberSet_(values) {
  var set = {};

  (values || []).forEach(function(value) {
    var rowNumber = Number(value || 0);
    if (rowNumber > 0) {
      set[rowNumber] = true;
    }
  });

  return set;
}

function dcSchedulerNormalizeSelectedRows_(selectedRows) {
  if (!selectedRows || !selectedRows.length) {
    return [];
  }

  var seen = {};
  var normalized = [];

  selectedRows.forEach(function(value) {
    var rowNumber = Number(value || 0);
    if (rowNumber > 0 && !seen[rowNumber]) {
      seen[rowNumber] = true;
      normalized.push(rowNumber);
    }
  });

  return normalized.sort(function(a, b) {
    return a - b;
  });
}

function dcSchedulerNormalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function dcSchedulerNormalizeTimeZone_(value) {
  return String(value || '').trim();
}

function dcSchedulerNormalizeScheduleEntries_(entries, selectedRows) {
  entries = Array.isArray(entries) ? entries : [];
  var normalizedRows = dcSchedulerNormalizeSelectedRows_(selectedRows);
  var normalizedEntries = [];

  entries.forEach(function(entry) {
    if (!entry) {
      return;
    }

    var sourceRowNumber = Number(entry.sourceRowNumber || entry.sourceReadyRowNumber || 0);
    var scheduledDate = dcSchedulerNormalizeDateString_(entry.scheduledDate, true);
    var scheduledHour = dcSchedulerExtractScheduledHour_(entry.scheduledHour);
    var scheduledAtIso = String(entry.scheduledAtIso || '').trim();
    var scheduledAtMs = Number(entry.scheduledAtMs || 0);

    if (sourceRowNumber <= 1) {
      throw new Error('Schedule entry source row is invalid.');
    }

    if (!scheduledAtIso || !isFinite(scheduledAtMs) || scheduledAtMs <= 0) {
      throw new Error('Schedule entry timestamp is invalid.');
    }

    normalizedEntries.push({
      sourceRowNumber: sourceRowNumber,
      scheduledDate: scheduledDate,
      scheduledHour: scheduledHour,
      scheduledAtIso: scheduledAtIso,
      scheduledAtMs: scheduledAtMs,
      timeZone: dcSchedulerNormalizeTimeZone_(entry.timeZone)
    });
  });

  if (normalizedEntries.length !== normalizedRows.length) {
    throw new Error('Schedule entry count did not match the selected leads.');
  }

  for (var i = 0; i < normalizedRows.length; i++) {
    if (normalizedEntries[i].sourceRowNumber !== normalizedRows[i]) {
      throw new Error('Schedule entry order did not match the selected leads.');
    }
  }

  return normalizedEntries;
}

function dcSchedulerNormalizeLeadKeyPart_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function dcSchedulerBuildLeadKey_(lead) {
  lead = lead || {};

  return [
    dcSchedulerNormalizeLeadKeyPart_(lead.email),
    dcSchedulerNormalizeLeadKeyPart_(lead.propertyAddress),
    dcSchedulerNormalizeLeadKeyPart_(lead.name),
    dcSchedulerNormalizeLeadKeyPart_(lead.listPrice)
  ].join('|');
}

function dcSchedulerGetRecordLeadKey_(record) {
  return String(record && record.sourceLeadKey || '').trim() || dcSchedulerBuildLeadKey_(record || {});
}

function dcSchedulerRecordMatchesExecution_(record, executionEmail, customerSheetId) {
  var recordOwnerEmail = dcSchedulerNormalizeEmail_(record && record.ownerEmail ? record.ownerEmail : '');
  var recordCustomerSheetId = String(record && record.customerSheetId ? record.customerSheetId : '').trim();

  if (recordOwnerEmail && executionEmail && recordOwnerEmail !== executionEmail) {
    return false;
  }

  if (recordCustomerSheetId && customerSheetId && recordCustomerSheetId !== customerSheetId) {
    return false;
  }

  return true;
}

function dcSchedulerGetScheduledAtMillis_(record) {
  var scheduledAtMs = Number(record && record.scheduledAtMs || 0);
  if (isFinite(scheduledAtMs) && scheduledAtMs > 0) {
    return scheduledAtMs;
  }

  var scheduledDate = String(record && record.scheduledDate ? record.scheduledDate : '').trim();
  var scheduledHour = Number(record && record.scheduledHour || 0);

  if (!scheduledDate || !isFinite(scheduledHour)) {
    return 0;
  }

  var parts = scheduledDate.split('-');
  if (parts.length !== 3) {
    return 0;
  }

  return new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
    scheduledHour,
    0,
    0,
    0
  ).getTime();
}

function dcSchedulerBuildNextTriggerDate_(record, afterRun) {
  var now = new Date();
  var scheduledAtMs = dcSchedulerGetScheduledAtMillis_(record);
  var scheduledHour = Number(record && record.scheduledHour || 0);

  if (scheduledAtMs > (now.getTime() + DC_SCHEDULER_TRIGGER_SOON_MS)) {
    return new Date(scheduledAtMs);
  }

  if (!afterRun && scheduledAtMs > now.getTime()) {
    return new Date(scheduledAtMs);
  }

  var nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, scheduledHour, 0, 0, 0);
  return nextDate;
}

function dcSchedulerBuildDeferredScheduleFields_(record) {
  var currentScheduledAtMs = dcSchedulerGetScheduledAtMillis_(record);
  var nextScheduledAtMs = currentScheduledAtMs > 0
    ? currentScheduledAtMs + (24 * 60 * 60 * 1000)
    : (new Date().getTime() + (24 * 60 * 60 * 1000));
  var nextDate = new Date(nextScheduledAtMs);

  return {
    scheduledDate: dcSchedulerAddDays_(String(record && record.scheduledDate ? record.scheduledDate : dcSchedulerFormatDate_(new Date())), 1),
    scheduledHour: String(record && record.scheduledHour !== undefined ? record.scheduledHour : nextDate.getHours()),
    scheduledAtIso: nextDate.toISOString(),
    scheduledAtMs: String(nextScheduledAtMs)
  };
}

function dcSchedulerFailClaimedRows_(sheet, claimedRowNumbers, errorMessage) {
  var claimedSet = dcSchedulerBuildNumberSet_(claimedRowNumbers);
  var failedAt = dcSchedulerFormatTimestamp_(new Date());
  var updates = [];

  dcSchedulerReadRecords_(sheet).forEach(function(record) {
    if (!claimedSet[Number(record.rowNumber || 0)]) {
      return;
    }

    if (String(record.status || '').trim().toUpperCase() !== 'PROCESSING') {
      return;
    }

    updates.push({
      rowNumber: record.rowNumber,
      fields: {
        status: 'FAILED',
        error: errorMessage,
        processedAt: failedAt
      }
    });
  });

  if (updates.length) {
    dcSchedulerUpdateRows_(sheet, updates);
  }
}

function dcSchedulerBuildReadyLeadLookup_(leads) {
  var byRow = {};
  var byLeadId = {};
  var byKey = {};
  var allLeads = [];

  (leads || []).forEach(function(lead) {
    var rowNumber = Number(lead && lead.rowNumber || 0);
    if (rowNumber > 0) {
      byRow[rowNumber] = lead;
    }

    var leadId = String(lead && lead.leadId || '').trim();
    if (leadId) {
      byLeadId[leadId] = lead;
    }

    var leadKey = dcSchedulerBuildLeadKey_(lead);
    if (leadKey) {
      if (!byKey[leadKey]) {
        byKey[leadKey] = [];
      }
      byKey[leadKey].push(lead);
    }

    allLeads.push(lead);
  });

  return {
    byRow: byRow,
    byLeadId: byLeadId,
    byKey: byKey,
    leads: allLeads
  };
}

function dcSchedulerGetReadyLeadLookup_() {
  var dashboardState = getEmailDashboardState();
  if (!dashboardState || dashboardState.success === false) {
    throw new Error((dashboardState && dashboardState.message) || 'Could not load Ready to Email rows.');
  }

  return dcSchedulerBuildReadyLeadLookup_(dashboardState.leads || []);
}

function dcSchedulerResolveCurrentSourceLead_(record, readyLookup) {
  readyLookup = readyLookup || dcSchedulerGetReadyLeadLookup_();
  var recordLeadId = String(record && record.leadId || '').trim();
  var recordLeadKey = dcSchedulerGetRecordLeadKey_(record);
  var sourceRowNumber = Number(record && record.sourceReadyRowNumber || 0);
  var lead = sourceRowNumber > 0 ? readyLookup.byRow[sourceRowNumber] : null;

  if (recordLeadId && readyLookup.byLeadId[recordLeadId]) {
    return readyLookup.byLeadId[recordLeadId];
  }

  if (lead) {
    if (!recordLeadKey || dcSchedulerBuildLeadKey_(lead) === recordLeadKey) {
      return lead;
    }
  }

  if (recordLeadKey && readyLookup.byKey[recordLeadKey] && readyLookup.byKey[recordLeadKey].length === 1) {
    return readyLookup.byKey[recordLeadKey][0];
  }

  for (var i = 0; i < readyLookup.leads.length; i++) {
    if (dcSchedulerBuildLeadKey_(readyLookup.leads[i]) === recordLeadKey) {
      return readyLookup.leads[i];
    }
  }

  return null;
}

function dcSchedulerNormalizeDailyLimit_(value) {
  return Math.min(DC_SCHEDULER_MAX_DAILY_SENDS, dcSchedulerNormalizePositiveInt_(value || DC_SCHEDULER_MAX_DAILY_SENDS, 'Daily limit'));
}

function dcSchedulerCountDistinctScheduleDates_(records) {
  var seen = {};

  (records || []).forEach(function(record) {
    var scheduledDate = String(record && record.scheduledDate || '').trim();
    if (scheduledDate) {
      seen[scheduledDate] = true;
    }
  });

  return Object.keys(seen).length;
}

function dcSchedulerBuildScheduledAtMs_(scheduledDate, scheduledHour) {
  var parts = String(scheduledDate || '').split('-');

  if (parts.length !== 3) {
    throw new Error('Scheduled date is invalid.');
  }

  return new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
    Number(scheduledHour || 0),
    0,
    0,
    0
  ).getTime();
}

function dcSchedulerBuildOpenScheduleCountsByDate_(records, executionEmail, customerSheetId) {
  var counts = {};

  (records || []).forEach(function(record) {
    if (!dcSchedulerRecordMatchesExecution_(record, executionEmail, customerSheetId)) {
      return;
    }

    if (!dcSchedulerStatusIsOpen_(record && record.status ? record.status : '')) {
      return;
    }

    var scheduledDate = String(record && record.scheduledDate || '').trim();
    if (!scheduledDate) {
      return;
    }

    counts[scheduledDate] = (counts[scheduledDate] || 0) + 1;
  });

  return counts;
}

function dcSchedulerAssertLeadsNotAlreadyScheduled_(existingRecords, leads, executionEmail, customerSheetId) {
  var openLeadIds = {};
  var openLeadKeys = {};
  var openSourceRows = {};

  (existingRecords || []).forEach(function(record) {
    if (!dcSchedulerRecordMatchesExecution_(record, executionEmail, customerSheetId)) {
      return;
    }

    if (!dcSchedulerStatusIsOpen_(record && record.status ? record.status : '')) {
      return;
    }

    var leadId = String(record && record.leadId || '').trim();
    if (leadId) {
      openLeadIds[leadId] = true;
    }

    var leadKey = dcSchedulerGetRecordLeadKey_(record);
    if (leadKey) {
      openLeadKeys[leadKey] = true;
    }

    var sourceReadyRowNumber = Number(record && record.sourceReadyRowNumber || 0);
    if (sourceReadyRowNumber > 0) {
      openSourceRows[sourceReadyRowNumber] = true;
    }
  });

  (leads || []).forEach(function(lead) {
    var leadId = String(lead && lead.leadId || '').trim();
    var leadKey = String(lead && lead.leadKey || dcSchedulerBuildLeadKey_(lead) || '');
    var rowNumber = Number(lead && lead.rowNumber || 0);

    if ((leadId && openLeadIds[leadId]) || (leadKey && openLeadKeys[leadKey]) || (rowNumber > 0 && openSourceRows[rowNumber])) {
      throw new Error('Lead ' + (lead.name || lead.email || leadId) + ' is already in the scheduled queue.');
    }
  });
}

function dcSchedulerBuildQueuedScheduleRows_(leads, options) {
  options = options || {};

  var scheduleId = String(options.scheduleId || '').trim();
  var createdAt = String(options.createdAt || dcSchedulerFormatTimestamp_(new Date())).trim();
  var startDate = dcSchedulerNormalizeDateString_(options.startDate, true);
  var scheduledHour = dcSchedulerExtractScheduledHour_(options.scheduledHour);
  var dailyLimit = dcSchedulerNormalizeDailyLimit_(options.dailyLimit);
  var existingCounts = dcSchedulerBuildOpenScheduleCountsByDate_(options.existingRecords || [], options.ownerEmail || '', options.customerSheetId || '');
  var dateCursor = startDate;

  return (leads || []).map(function(lead) {
    while ((existingCounts[dateCursor] || 0) >= dailyLimit) {
      dateCursor = dcSchedulerAddDays_(dateCursor, 1);
    }

    var scheduledAtMs = dcSchedulerBuildScheduledAtMs_(dateCursor, scheduledHour);
    var row = {
      scheduleId: scheduleId,
      createdAt: createdAt,
      scheduledDate: dateCursor,
      scheduledHour: String(scheduledHour),
      offerType: String(options.offerType || ''),
      campaignMode: String(options.campaignMode || 'send'),
      dailyLimit: String(dailyLimit),
      name: String(lead && lead.name || ''),
      email: String(lead && lead.email || ''),
      propertyAddress: String(lead && lead.propertyAddress || ''),
      listPrice: String(lead && lead.listPrice || ''),
      status: 'SCHEDULED',
      processedAt: '',
      error: '',
      sourceReadyRowNumber: String(lead && lead.rowNumber || ''),
      leadId: String(lead && lead.leadId || ''),
      sourceLeadKey: String(lead && lead.leadKey || dcSchedulerBuildLeadKey_(lead) || ''),
      ownerEmail: String(options.ownerEmail || ''),
      ownerTimeZone: String(options.ownerTimeZone || ''),
      customerSheetId: String(options.customerSheetId || ''),
      scheduledAtIso: new Date(scheduledAtMs).toISOString(),
      scheduledAtMs: String(scheduledAtMs),
      attemptCount: '0',
      lastAttemptAt: ''
    };

    existingCounts[dateCursor] = (existingCounts[dateCursor] || 0) + 1;
    return row;
  });
}

function dcSchedulerNormalizePositiveInt_(value, label) {
  var normalized = Number(value || 0);
  if (!isFinite(normalized) || normalized <= 0 || Math.floor(normalized) !== normalized) {
    throw new Error(label + ' must be a whole number greater than zero.');
  }
  return normalized;
}

function dcSchedulerExtractScheduledHour_(scheduledHours) {
  var value = Array.isArray(scheduledHours) && scheduledHours.length
    ? scheduledHours[0]
    : scheduledHours;

  var hour = Number(value);
  if (!isFinite(hour) || hour < 0 || hour > 23 || Math.floor(hour) !== hour) {
    throw new Error('Scheduled hour must be between 0 and 23.');
  }

  return hour;
}

function dcSchedulerNormalizeDateString_(value, allowPast) {
  var text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error('Start date must use YYYY-MM-DD format.');
  }

  if (!allowPast && text < dcSchedulerFormatDate_(new Date())) {
    throw new Error('Start date cannot be in the past.');
  }

  return text;
}

function dcSchedulerNormalizeOfferType_(value) {
  var normalized = String(value || '').trim();
  var compact = normalized.toLowerCase().replace(/[\s_-]+/g, '');

  if (compact === 'sellerfinance' || compact === 'sellerfinancing') {
    return 'SellerFinance';
  }
  if (compact === 'leaseoption') {
    return 'LeaseOption';
  }
  if (compact === 'subto' || compact === 'subjectto') {
    return 'SubTo';
  }
  if (normalized === 'Seller Finance') {
    return 'SellerFinance';
  }
  if (normalized !== 'Cash' && normalized !== 'SellerFinance' && normalized !== 'SubTo' && normalized !== 'LeaseOption') {
    return 'SubTo';
  }
  return normalized;
}

function dcSchedulerNormalizeCampaignMode_(value) {
  var normalized = String(value || '').trim().toLowerCase();
  return normalized === 'send' ? 'send' : 'draft';
}

function dcSchedulerIsActiveLeadStatus_(status) {
  var value = String(status || '').trim().toUpperCase();
  return value !== 'SCHEDULED' &&
    value !== 'DRAFTED' &&
    value !== 'SENT' &&
    value !== 'ARCHIVED' &&
    value !== 'DELETED' &&
    value !== 'SKIPPED_DNC' &&
    value !== 'FAILED';
}

function dcSchedulerStatusIsOpen_(status) {
  var value = String(status || '').trim().toUpperCase();
  return value === 'SCHEDULED' || value === 'QUEUED' || value === 'DRAFTING' || value === 'PROCESSING';
}

function dcSchedulerStatusCanRun_(status) {
  var value = String(status || '').trim().toUpperCase();
  return value === 'SCHEDULED' || value === 'QUEUED' || value === 'DRAFTING';
}

function dcSchedulerRecordCanRun_(record, now) {
  var value = String(record && record.status ? record.status : '').trim().toUpperCase();

  if (value === 'PROCESSING') {
    return dcSchedulerIsStaleProcessing_(record, now || new Date());
  }

  return dcSchedulerStatusCanRun_(value);
}

function dcSchedulerBuildScheduleId_() {
  return 'sched_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '_' + Utilities.getUuid().slice(0, 8);
}

function dcSchedulerAddDays_(dateString, daysToAdd) {
  var parts = String(dateString || '').split('-');
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
  date.setDate(date.getDate() + Number(daysToAdd || 0));
  return dcSchedulerFormatDate_(date);
}

function dcSchedulerFormatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function dcSchedulerFormatTimestamp_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function dcSchedulerParseTimestamp_(value) {
  var text = String(value || '').trim();
  var match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/);

  if (!match) {
    return null;
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 0),
    Number(match[5] || 0),
    Number(match[6] || 0)
  );
}

function dcSchedulerIsStaleProcessing_(record, now) {
  var status = String(record && record.status ? record.status : '').trim().toUpperCase();
  if (status !== 'PROCESSING') {
    return false;
  }

  var attemptedAt = dcSchedulerParseTimestamp_(record && record.lastAttemptAt ? record.lastAttemptAt : '') ||
    dcSchedulerParseTimestamp_(record && record.processedAt ? record.processedAt : '');
  if (!attemptedAt) {
      return true;
  }

  return ((now || new Date()).getTime() - attemptedAt.getTime()) >= (DC_SCHEDULER_PROCESSING_TIMEOUT_MINUTES * 60 * 1000);
}

function dcSchedulerFormatHourLabel_(hour) {
  var value = Number(hour || 0);
  var suffix = value >= 12 ? 'PM' : 'AM';
  var displayHour = value % 12;
  if (displayHour === 0) {
    displayHour = 12;
  }
  return displayHour + ':00 ' + suffix;
}

function dcSchedulerErrorMessage_(err) {
  if (!err) {
    return 'Unknown scheduler error.';
  }
  return err && err.message ? err.message : String(err);
}
