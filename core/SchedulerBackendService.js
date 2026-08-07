/**************************************
 * Deal Cannon Core - SchedulerBackendService.gs
 * Cloud Run adapter for scheduled sending.
 **************************************/

var DEAL_CANNON_SCHEDULER_SERVICE_BASE_URL = '';
var DEAL_CANNON_SCHEDULER_SERVICE_SECRET_PROPERTY_KEY = 'DEAL_CANNON_SCHEDULER_SERVICE_INTERNAL_SECRET';
var DEAL_CANNON_SCHEDULER_SERVICE_TIMEOUT_MS = 30000;

function dcSchedulerBuildLocalConnectionState_() {
  var user = requireApprovedUser_();
  var email = String(user && user.email || '').trim().toLowerCase();
  var domain = email.indexOf('@') !== -1 ? email.split('@')[1] : '';

  return {
    success: true,
    gmailConnected: !!email,
    gmailConnectedEmail: email,
    gmailStatus: email ? 'CONNECTED' : 'DISCONNECTED',
    gmailHostedDomain: domain,
    refreshTokenStored: true,
    message: 'Scheduled sending uses the same signed-in Google account that opened Deal Cannon.',
    backendAvailable: false,
    localAccountOnly: true
  };
}

function getScheduledSendingConnectionState_() {
  try {
    return dcSchedulerBuildLocalConnectionState_();
  } catch (err) {
    return buildFailure('SCHEDULER_BACKEND_CONNECTION_STATE_ERROR', err.message || String(err));
  }
}

function disconnectScheduledSendingConnection_() {
  try {
    var state = dcSchedulerBuildLocalConnectionState_();

    return {
      success: true,
      gmailConnected: state.gmailConnected,
      gmailConnectedEmail: state.gmailConnectedEmail,
      gmailStatus: state.gmailStatus,
      message: 'Scheduled sending always uses the signed-in Google account. There is no separate scheduler Gmail connection to disconnect.'
    };
  } catch (err) {
    return buildFailure('SCHEDULER_BACKEND_DISCONNECT_ERROR', err.message || String(err));
  }
}

function getScheduledSendingConnectionSummary_() {
  var state = getScheduledSendingConnectionState_();

  if (!state || state.success === false) {
    return {
      gmailConnected: false,
      gmailConnectedEmail: '',
      gmailStatus: 'ERROR',
      gmailHostedDomain: '',
      refreshTokenStored: false,
      message: state && state.message ? state.message : 'Scheduled sending Gmail connection is unavailable.',
      backendAvailable: false
    };
  }

  return {
    gmailConnected: state.gmailConnected === true,
    gmailConnectedEmail: String(state.gmailConnectedEmail || ''),
    gmailStatus: String(state.gmailStatus || (state.gmailConnected ? 'CONNECTED' : 'DISCONNECTED')),
    gmailHostedDomain: String(state.gmailHostedDomain || ''),
    refreshTokenStored: state.refreshTokenStored === true,
    message: String(state.message || ''),
    backendAvailable: state.backendAvailable === true,
    localAccountOnly: state.localAccountOnly === true
  };
}

function beginScheduledSendingConnect_(_payload) {
  try {
    var state = dcSchedulerBuildLocalConnectionState_();

    return {
      success: true,
      gmailConnected: state.gmailConnected,
      gmailConnectedEmail: state.gmailConnectedEmail,
      message: 'No separate Gmail connect step is required. Scheduled sending uses your signed-in Google account.'
    };
  } catch (err) {
    return buildFailure('SCHEDULER_BACKEND_CONNECT_START_ERROR', err.message || String(err));
  }
}

function previewDailyScheduleCampaign_(payload) {
  try {
    var request = dcSchedulerBackendBuildCampaignRequest_(payload);
    return dcSchedulerBackendRequest_('/internal/schedules/preview', 'post', request);
  } catch (err) {
    return buildFailure('SCHEDULER_BACKEND_PREVIEW_ERROR', err.message || String(err));
  }
}

function createDailyScheduleCampaign_(payload) {
  try {
    var request = dcSchedulerBackendBuildCampaignRequest_(payload);
    return dcSchedulerBackendRequest_('/internal/schedules', 'post', request);
  } catch (err) {
    return buildFailure('SCHEDULER_BACKEND_CREATE_ERROR', err.message || String(err));
  }
}

function getDailyScheduleCampaigns_() {
  try {
    var user = requireApprovedUser_();
    var result = dcSchedulerBackendRequest_('/internal/schedules?userEmail=' + encodeURIComponent(user.email) + '&customerSheetId=' + encodeURIComponent(user.customerSheetId || ''), 'get');

    if (result && result.success !== false) {
      result.workbook = result.workbook || {};
      result.workbook.customerSheetId = result.workbook.customerSheetId || user.customerSheetId || '';
      result.workbook.customerSheetName = result.workbook.customerSheetName || user.customerSheetName || '';
    }

    return result;
  } catch (err) {
    return buildFailure('SCHEDULER_BACKEND_LIST_ERROR', err.message || String(err));
  }
}

function cancelDailyScheduleCampaign_(payload) {
  try {
    var user = requireApprovedUser_();
    payload = payload || {};

    return dcSchedulerBackendRequest_('/internal/schedules/cancel', 'post', {
      campaignId: String(payload.campaignId || '').trim(),
      userEmail: user.email,
      customerSheetId: user.customerSheetId || ''
    });
  } catch (err) {
    return buildFailure('SCHEDULER_BACKEND_CANCEL_ERROR', err.message || String(err));
  }
}

function deleteDailyScheduleCampaign_(payload) {
  try {
    var user = requireApprovedUser_();
    payload = payload || {};

    return dcSchedulerBackendRequest_('/internal/schedules/delete', 'post', {
      userEmail: user.email,
      customerSheetId: user.customerSheetId || '',
      campaignId: String(payload.campaignId || '').trim(),
      selectedRows: payload.selectedRows || []
    });
  } catch (err) {
    return buildFailure('SCHEDULER_BACKEND_DELETE_ERROR', err.message || String(err));
  }
}

function deleteDailyScheduleItems_(payload) {
  return deleteDailyScheduleCampaign_(payload || {});
}

function runDailyScheduleCampaignNow_(payload) {
  try {
    var user = requireApprovedUser_();
    payload = payload || {};

    return dcSchedulerBackendRequest_('/internal/schedules/run-now', 'post', {
      campaignId: String(payload.campaignId || '').trim(),
      userEmail: user.email,
      customerSheetId: user.customerSheetId || ''
    });
  } catch (err) {
    return buildFailure('SCHEDULER_BACKEND_RUN_NOW_ERROR', err.message || String(err));
  }
}

function dcSchedulerBackendBuildCampaignRequest_(payload) {
  var user = requireApprovedUser_();
  payload = payload || {};
  var selectedRows = payload.selectedRows || [];
  var selectedLeadIds = payload.selectedLeadIds || [];
  var scheduledHours = payload.scheduledHours || [];
  var sendTimeLocal = String(payload.sendTimeLocal || '').trim();

  if (!sendTimeLocal && scheduledHours.length) {
    var hour = Number(scheduledHours[0] || 0);
    if (!isNaN(hour) && hour >= 0 && hour <= 23) {
      sendTimeLocal = String(hour).padStart(2, '0') + ':00';
    }
  }

  var leads = typeof buildScheduledSendingLeadPayloads_ === 'function'
    ? buildScheduledSendingLeadPayloads_({
        selectedRows: selectedRows,
        selectedLeadIds: selectedLeadIds,
        offerType: payload.offerType || ''
      })
    : [];

  if (!selectedLeadIds.length && leads.length) {
    selectedLeadIds = leads.map(function(lead) {
      return String(lead.leadId || '');
    }).filter(function(leadId) {
      return !!leadId;
    });
  }

  return {
    userEmail: user.email,
    customerSheetId: user.customerSheetId || '',
    selectedRows: selectedRows,
    selectedLeadIds: selectedLeadIds,
    startDate: payload.startDate || '',
    sendTimeLocal: sendTimeLocal,
    timezone: payload.timezone || '',
    dailyLimit: payload.dailyLimit || 0,
    offerType: payload.offerType || '',
    mode: 'send',
    leads: leads
  };
}

function dcSchedulerBackendRequest_(path, method, payload) {
  var baseUrl = dcSchedulerBackendGetBaseUrl_();
  var secret = dcSchedulerBackendGetInternalSecret_();
  var cleanPath = String(path || '').trim();

  if (!cleanPath) {
    throw new Error('Scheduler backend path is required.');
  }

  var url = baseUrl + cleanPath;
  var upperMethod = String(method || 'get').toUpperCase();
  var options = {
    method: upperMethod,
    muteHttpExceptions: true,
    headers: {
      'X-Deal-Cannon-Internal-Secret': secret
    }
  };

  if (upperMethod !== 'GET') {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload || {});
  }

  var response;

  try {
    response = UrlFetchApp.fetch(url, options);
  } catch (err) {
    throw new Error('Could not reach scheduler backend: ' + (err && err.message ? err.message : String(err)));
  }

  var code = response.getResponseCode();
  var text = response.getContentText();
  var parsed = {};

  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (parseErr) {
    throw new Error('Scheduler backend returned invalid JSON.');
  }

  if (code < 200 || code >= 300) {
    throw new Error(parsed && parsed.message ? parsed.message : ('Scheduler backend request failed with status ' + code + '.'));
  }

  return parsed;
}

function dcSchedulerBackendGetBaseUrl_() {
  var baseUrl = String(DEAL_CANNON_SCHEDULER_SERVICE_BASE_URL || '').trim();

  if (!baseUrl) {
    baseUrl = String(PropertiesService.getScriptProperties().getProperty('DEAL_CANNON_SCHEDULER_SERVICE_BASE_URL') || '').trim();
  }

  if (!baseUrl) {
    throw new Error('Scheduler backend base URL is not configured.');
  }

  return baseUrl.replace(/\/+$/, '');
}

function dcSchedulerBackendGetInternalSecret_() {
  var secret = String(PropertiesService.getScriptProperties().getProperty(DEAL_CANNON_SCHEDULER_SERVICE_SECRET_PROPERTY_KEY) || '').trim();

  if (!secret) {
    throw new Error('Scheduler backend internal secret is not configured.');
  }

  return secret;
}

function dcSchedulerBackendGetReturnUrl_() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (err) {
    return '';
  }
}
