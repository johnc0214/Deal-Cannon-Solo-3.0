/**************************************
 * Deal Cannon Starter v2 — EmailUpload.gs
 * Thin shell wrapper.
 * Real logic lives in DealCannonCorev2.
 **************************************/

function testEmailUploadRuntimeVersion() {
  return DealCannonCorev2.getEmailUploadRuntimeVersion();
}

function uploadLeadsCsv(fileObject) {
  return DealCannonCorev2.dcUploadLeadsCsvV2(fileObject);
}

function dcUploadLeadsCsvFromDashboardV2(fileObject) {
  return DealCannonCorev2.dcUploadLeadsCsvV2(fileObject);
}

function getRawDataUploadState() {
  return DealCannonCorev2.getRawDataUploadState();
}