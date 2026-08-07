/**************************************
 * Deal Cannon 3.0 - ContactDetails.gs
 * Thin shell wrapper for Contact Details CRM.
 **************************************/

function getContactDetailsState() {
  return DealCannonCorev2.getContactDetailsState();
}

function getContactOpportunityWorkspace(opportunityId) {
  return DealCannonCorev2.getContactOpportunityWorkspace(opportunityId);
}

function createContactOpportunity(payload) {
  return DealCannonCorev2.createContactOpportunity(payload);
}

function updateContactOpportunity(opportunityId, payload) {
  return DealCannonCorev2.updateContactOpportunity(opportunityId, payload);
}

function moveContactOpportunityStage(opportunityId, stageId) {
  return DealCannonCorev2.moveContactOpportunityStage(opportunityId, stageId);
}

function addContactOpportunityNote(opportunityId, noteText) {
  return DealCannonCorev2.addContactOpportunityNote(opportunityId, noteText);
}

function createContactPipelineStage(stageName) {
  return DealCannonCorev2.createContactPipelineStage(stageName);
}

function renameContactPipelineStage(stageId, stageName) {
  return DealCannonCorev2.renameContactPipelineStage(stageId, stageName);
}

function reorderContactPipelineStages(stageIds) {
  return DealCannonCorev2.reorderContactPipelineStages(stageIds);
}
