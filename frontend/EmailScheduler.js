/**************************************
 * Deal Cannon Starter v2 — EmailScheduler.gs
 * Thin shell wrapper.
 * Real scheduler logic lives in DealCannonCorev2.
 **************************************/

function getEmailSchedulerState() {
  return DealCannonCorev2.getEmailSchedulerState();
}

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

function runEmailSchedulerNow() {
  return DealCannonCorev2.runEmailSchedulerNow();
}

function reinstallEmailSchedulerTrigger() {
  return DealCannonCorev2.reinstallEmailSchedulerTrigger();
}

function processScheduledEmailCampaigns() {
  console.log("Trigger processScheduledEmailCampaigns started.");

  try {
    const activeUserEmail = Session.getActiveUser().getEmail();
    const effectiveUserEmail = Session.getEffectiveUser().getEmail();
    console.log(`Active User: ${activeUserEmail}, Effective User: ${effectiveUserEmail}`);

    DealCannonCorev2.processScheduledEmailCampaigns();
  } catch (error) {
    console.error("Error in processScheduledEmailCampaigns:", error.message, error.stack);
    throw error;
  } finally {
    console.log("Trigger processScheduledEmailCampaigns completed.");
  }
}

function repairReadyRowsMarkedScheduled() {
  return DealCannonCorev2.repairReadyRowsMarkedScheduled();
}

function testCoreLibraryAccess() {
  return DealCannonCorev2.getEmailSchedulerState();
}

function debugSoloSchedulerRuntime() {
  const triggers = ScriptApp.getProjectTriggers();

  return {
    activeUserEmail: Session.getActiveUser().getEmail(),
    effectiveUserEmail: Session.getEffectiveUser().getEmail(),
    triggerCount: triggers.length,
    triggerHandlerFunctions: triggers.map(trigger => trigger.getHandlerFunction()),
    emailSchedulerState: DealCannonCorev2.getEmailSchedulerState()
  };
}

function debugCustomerSchedulerAuth() {
  return DealCannonCorev2.debugCustomerSchedulerAuth();
}

function createSchedulerLogsSheet() {
  return DealCannonCorev2.createSchedulerLogsSheet();
}

function debugSchedulerSetup() {
  return DealCannonCorev2.debugSchedulerSetup();
}

function debugSchedulerRunDryRun() {
  return DealCannonCorev2.debugSchedulerRunDryRun();
}

function debugSchedulerUserContext() {
  return DealCannonCorev2.debugSchedulerUserContext();
}

function debugSchedulerFutureDueRows() {
  return DealCannonCorev2.debugSchedulerFutureDueRows();
}

function debugSchedulerTriggerContext() {
  return DealCannonCorev2.debugSchedulerTriggerContext();
}

function debugSchedulerAuthorizationContext() {
  return DealCannonCorev2.debugSchedulerAuthorizationContext();
}

function debugSchedulerDryRunForCurrentUser() {
  return DealCannonCorev2.debugSchedulerDryRunForCurrentUser();
}
