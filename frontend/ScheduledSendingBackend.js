/**************************************
 * Deal Cannon Starter - ScheduledSendingBackend.gs
 * Thin wrapper over core SchedulerBackendService.
 **************************************/

function getScheduledSendingConnectionState() {
  return DealCannonCorev2.getScheduledSendingConnectionState();
}

function beginScheduledSendingConnect(payload) {
  return DealCannonCorev2.beginScheduledSendingConnect(payload);
}

function disconnectScheduledSendingConnection() {
  return DealCannonCorev2.disconnectScheduledSendingConnection();
}

function previewDailyScheduleCampaign(payload) {
  return DealCannonCorev2.previewDailyScheduleCampaign(payload);
}

function createDailyScheduleCampaign(payload) {
  return DealCannonCorev2.createDailyScheduleCampaign(payload);
}

function getDailyScheduleCampaigns() {
  return DealCannonCorev2.getDailyScheduleCampaigns();
}

function cancelDailyScheduleCampaign(payload) {
  return DealCannonCorev2.cancelDailyScheduleCampaign(payload);
}

function deleteDailyScheduleCampaign(payload) {
  return DealCannonCorev2.deleteDailyScheduleCampaign(payload);
}

function deleteDailyScheduleItems(payload) {
  return DealCannonCorev2.deleteDailyScheduleItems(payload);
}

function runDailyScheduleCampaignNow(payload) {
  return DealCannonCorev2.runDailyScheduleCampaignNow(payload);
}
