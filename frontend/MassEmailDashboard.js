/**************************************
 * Deal Cannon Starter v2 — MassEmailDashboard.gs
 * Thin shell wrapper.
 * Real dashboard/mass email logic lives in DealCannonCorev2.
 **************************************/

/* =========================
   DASHBOARD STATE
========================== */

function getEmailDashboardState() {
  return DealCannonCorev2.getEmailDashboardState();
}

function getEmailSchedulerState() {
  return DealCannonCorev2.getEmailSchedulerState();
}

function getRawDataUploadState() {
  return DealCannonCorev2.getRawDataUploadState();
}

function getEmailsSentState() {
  return DealCannonCorev2.getEmailsSentState();
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
   SCHEDULED EMAIL ACTIONS
========================== */

function createEmailSchedule(payload) {
  return DealCannonCorev2.createEmailSchedule(payload);
}

function cancelEmailSchedule(scheduleId) {
  return DealCannonCorev2.cancelEmailSchedule(scheduleId);
}

function deleteScheduledEmailRows(selectedRows) {
  return DealCannonCorev2.deleteScheduledEmailRows(selectedRows);
}

function restoreScheduledEmailRows(selectedRows) {
  return DealCannonCorev2.restoreScheduledEmailRows(selectedRows);
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