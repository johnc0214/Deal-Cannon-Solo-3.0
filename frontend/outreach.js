/**************************************
 * Deal Cannon — outreach.gs
 * Thin shell wrapper.
 * Real logic lives in DealCannonCorev2.
 **************************************/

function getOutreachInfo() {
  return DealCannonCorev2.getOutreachInfo();
}

function saveOutreachInfo(payload) {
  return DealCannonCorev2.saveOutreachInfo(payload);
}