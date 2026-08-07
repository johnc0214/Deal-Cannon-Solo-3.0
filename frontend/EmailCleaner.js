/**************************************
 * Deal Cannon Starter v2 — EmailCleaner.gs
 * Thin shell wrapper.
 * Real logic lives in DealCannonCorev2.
 **************************************/

function runEmailCleanFlow(providerType) {
  return DealCannonCorev2.runEmailCleanFlow(providerType);
}

function getEmailDashboardState() {
  return dcGetEmailDashboardStateCompat_();
}
