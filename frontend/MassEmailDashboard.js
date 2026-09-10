/**************************************
 * Deal Cannon Starter v2 — MassEmailDashboard.gs
 * Thin shell wrapper.
 * Real dashboard/mass email logic lives in DealCannonCorev2.
 **************************************/

var DEAL_CANNON_NIGHTLY_SCHEDULE_TRIGGER_HANDLER = 'runNightlyScheduledEmailTrigger';
var DEAL_CANNON_NIGHTLY_SCHEDULE_TRIGGER_HOUR = 22;

/* =========================
   DASHBOARD STATE
========================== */

function dcGetEmailDashboardStateCompat_() {
  if (DealCannonCorev2 && typeof DealCannonCorev2.getEmailDashboardState === 'function') {
    return DealCannonCorev2.getEmailDashboardState();
  }

  if (DealCannonCorev2 && typeof DealCannonCorev2.getActiveLeads === 'function') {
    var result = DealCannonCorev2.getActiveLeads();
    if (!result || result.success === false) {
      return result;
    }

    var leads = result.leads || [];
    return {
      success: true,
      rawLeadCount: 0,
      readyLeadCount: Number(result.count || leads.length || 0),
      hasReadyData: leads.length > 0,
      leads: leads,
      sourceTab: leads.length ? 'Ready to Email' : ''
    };
  }

  return {
    success: false,
    message: 'Core library is missing getEmailDashboardState. Push the Deal Cannon 3.0 core/frontend Apps Script projects and refresh.'
  };
}

function getEmailDashboardState() {
  return dcGetEmailDashboardStateCompat_();
}

function getDashboardBootstrapState() {
  return DealCannonCorev2.getDashboardBootstrapState();
}

function getRawDataUploadState() {
  return DealCannonCorev2.getRawDataUploadState();
}

function getEmailsSentState() {
  return DealCannonCorev2.getEmailsSentState();
}

function getScheduledEmailsState() {
  return DealCannonCorev2.getScheduledEmailsState();
}

function scheduleSelectedReadyToEmailRows(selectedRows, offerType) {
  ensureNightlyScheduledEmailTrigger_();

  var result = DealCannonCorev2.scheduleSelectedReadyToEmailRows(selectedRows, offerType);

  if (result && result.success) {
    result.triggerHour = DEAL_CANNON_NIGHTLY_SCHEDULE_TRIGGER_HOUR;
    result.message = (result.message || 'Scheduled emails queued.') + ' Nightly sending is armed for around 10 PM Eastern.';
  }

  return result;
}

function restoreScheduledEmailRows(selectedRows) {
  return DealCannonCorev2.restoreScheduledEmailRows(selectedRows);
}

function deleteScheduledEmailRows(selectedRows) {
  return DealCannonCorev2.deleteScheduledEmailRows(selectedRows);
}

function ensureNightlyScheduledEmailTrigger() {
  return ensureNightlyScheduledEmailTrigger_();
}

function runNightlyScheduledEmailTrigger() {
  var result = DealCannonCorev2.runScheduledEmailsDailyBatch();
  Logger.log(JSON.stringify(result || {}, null, 2));
  return result;
}

function ensureNightlyScheduledEmailTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();

  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === DEAL_CANNON_NIGHTLY_SCHEDULE_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger(DEAL_CANNON_NIGHTLY_SCHEDULE_TRIGGER_HANDLER)
    .timeBased()
    .atHour(DEAL_CANNON_NIGHTLY_SCHEDULE_TRIGGER_HOUR)
    .everyDays(1)
    .create();

  return {
    success: true,
    handler: DEAL_CANNON_NIGHTLY_SCHEDULE_TRIGGER_HANDLER,
    hour: DEAL_CANNON_NIGHTLY_SCHEDULE_TRIGGER_HOUR,
    message: 'Nightly scheduled email trigger is set for around 10 PM Eastern.'
  };
}

function getDncListState() {
  return DealCannonCorev2.getDncListState();
}

/* =========================
   OUTREACH INFO
========================== */

function getOutreachInfo() {
  return DealCannonCorev2.getOutreachInfo();
}

function saveOutreachInfo(payload) {
  return DealCannonCorev2.saveOutreachInfo(payload);
}

/* =========================
   MASS EMAIL ACTIONS
========================== */

function runMassEmailCampaignSelected(payload) {
  return DealCannonCorev2.runMassEmailCampaignSelected(payload);
}

function runMassEmailCampaign(payload) {
  return DealCannonCorev2.runMassEmailCampaign(payload);
}

/* =========================
   READY TO EMAIL ROW ACTIONS
========================== */

function deleteReadyToEmailRows(selectedRows) {
  return DealCannonCorev2.deleteReadyToEmailRows(selectedRows);
}

function updateReadyToEmailLead(rowNumber, updates) {
  return DealCannonCorev2.updateReadyToEmailLead(rowNumber, updates);
}

function archiveReadyToEmailRows(selectedRows) {
  return DealCannonCorev2.archiveReadyToEmailRows(selectedRows);
}

/* =========================
   DNC ACTIONS
========================== */

function appendDncEmails(rawText) {
  return DealCannonCorev2.appendDncEmails(rawText);
}

function deleteDncRows(selectedRows) {
  return DealCannonCorev2.deleteDncRows(selectedRows);
}

/* =========================
   EMAIL SENT ACTIONS
========================== */

function deleteEmailsSentRows(selectedRows) {
  return DealCannonCorev2.deleteEmailsSentRows(selectedRows);
}

function archiveEmailsSentNow() {
  return DealCannonCorev2.archiveEmailsSentNow();
}
