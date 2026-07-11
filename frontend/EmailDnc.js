/**************************************
 * Deal Cannon Starter v2 — EmailDnc.gs
 * Thin shell wrapper.
 * Real logic lives in DealCannonCorev2.
 **************************************/

function appendDncEmails(rawText) {
  return DealCannonCorev2.appendDncEmails(rawText);
}

function getDncListState() {
  return DealCannonCorev2.getDncListState();
}

function deleteDncRows(selectedRows) {
  return DealCannonCorev2.deleteDncRows(selectedRows);
}