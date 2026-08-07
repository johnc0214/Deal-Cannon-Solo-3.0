/**************************************
 * Deal Cannon Starter v2 — MassEmailDashboard.gs
 * Thin shell wrapper.
 * Real dashboard/mass email logic lives in DealCannonCorev2.
 **************************************/

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
