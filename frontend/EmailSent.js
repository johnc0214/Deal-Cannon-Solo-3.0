/**************************************
 * Deal Cannon Starter v2 — EmailSent.gs
 * Thin shell wrapper.
 * Real logic lives in DealCannonCorev2.
 **************************************/

function getEmailsSentState() {
  return DealCannonCorev2.getEmailsSentState();
}

function deleteEmailsSentRows(selectedRows) {
  return DealCannonCorev2.deleteEmailsSentRows(selectedRows);
}

function archiveEmailsSentNow() {
  return DealCannonCorev2.archiveEmailsSentNow();
}