/**************************************
 * Deal Cannon Starter v2 — LeadsCampaign.gs
 * Thin shell wrapper.
 * Real logic lives in DealCannonCorev2.
 **************************************/

function getActiveLeads() {
  return DealCannonCorev2.getActiveLeads();
}

function getLeadById(leadId) {
  return DealCannonCorev2.getLeadById(leadId);
}

function updateLead(leadId, updates) {
  return DealCannonCorev2.updateLead(leadId, updates);
}

function bulkUpdateLeads(leadIds, updates) {
  return DealCannonCorev2.bulkUpdateLeads(leadIds, updates);
}

function sendMassEmailCampaign(payload) {
  return DealCannonCorev2.sendMassEmailCampaign(payload);
}