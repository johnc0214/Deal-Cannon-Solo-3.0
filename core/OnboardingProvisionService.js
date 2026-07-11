/**************************************
 * Deal Cannon Core — OnboardingProvisionService.gs
 * Customer workbook provisioning through Provisioner.
 *
 * Provisioner creates the customer workbook as owner/admin.
 * Core does not copy the master template directly anymore.
 **************************************/

var DEAL_CANNON_MASTER_TEMPLATE_SPREADSHEET_ID = "1ZVmXRwx75xe_-npuWgaa20LdCpz8SOq2w_m4kp7RMc0";

var DEAL_CANNON_PROVISIONER_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz4aKahgItLWbHC7_IOwEFyLiDMNZ2w15EjXtlI-Rf9czOW1XAs3AD5sMCrJu4f8oY6/exec";
var DEAL_CANNON_PROVISIONER_SECRET = "dc_9Kx82mLqPz_2026_private_checkout_secret_7719";

/* =========================
   PROTECTED SHEET GUARD
========================== */

function isProtectedCustomerSpreadsheetId_(spreadsheetId) {
  spreadsheetId = String(spreadsheetId || "").trim();

  if (!spreadsheetId) {
    return false;
  }

  return spreadsheetId === DEAL_CANNON_MASTER_TEMPLATE_SPREADSHEET_ID;
}

/* =========================
   WORKBOOK PROVISIONING
========================== */

function ensureCustomerWorkbookForOnboarding_(user) {
  if (!user || !user.email) {
    throw new Error("Missing approved user.");
  }

  var existingSheetId = String(user.customerSheetId || "").trim();

  if (existingSheetId && !isProtectedCustomerSpreadsheetId_(existingSheetId)) {
    try {
      var existing = SpreadsheetApp.openById(existingSheetId);
      existing.getName();

      return {
        spreadsheet: existing,
        spreadsheetId: existing.getId(),
        spreadsheetName: existing.getName(),
        createdNew: false,
        workbookReady: true
      };
    } catch (err) {}
  }

  var result = callDealCannonProvisioner_({
    secret: DEAL_CANNON_PROVISIONER_SECRET,
    action: "ensureCustomerWorkbook",
    email: user.email,
    normalizedEmail: user.email
  });

  var customerSheetId = String(result.customerSheetId || "").trim();

  if (!customerSheetId) {
    throw new Error("Provisioner did not return a customer workbook ID.");
  }

  if (isProtectedCustomerSpreadsheetId_(customerSheetId)) {
    throw new Error("Provisioner returned the master template instead of a customer workbook.");
  }

  var ss;

  try {
    ss = SpreadsheetApp.openById(customerSheetId);
  } catch (err2) {
    throw new Error("Customer workbook was created, but this Google account cannot open it yet. Wait a few seconds and refresh.");
  }

  return {
    spreadsheet: ss,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    createdNew: !!result.workbookCreated,
    workbookReady: true
  };
}

/* =========================
   FOLDER SETTINGS WRITEBACK
========================== */

function saveFolderSettingsWithProvisioner_(user, data) {
  if (!user || !user.email) {
    throw new Error("Missing approved user.");
  }

  data = data || {};

  return callDealCannonProvisioner_({
    secret: DEAL_CANNON_PROVISIONER_SECRET,
    action: "saveFolderSettings",
    email: user.email,
    normalizedEmail: user.email,
    loiFolderUrl: data.loiFolderUrl || "",
    loiFolderId: data.loiFolderId || "",
    archiveFolderUrl: data.archiveFolderUrl || "",
    archiveFolderId: data.archiveFolderId || ""
  });
}

/* =========================
   LEGACY COMPATIBILITY
========================== */

function registerCustomerWorkbookWithProvisioner_(user, data) {
  if (!user || !user.email) {
    throw new Error("Cannot register workbook. Missing user email.");
  }

  data = data || {};

  if (!data.customerSheetId) {
    throw new Error("Cannot register workbook. Missing customerSheetId.");
  }

  return callDealCannonProvisioner_({
    secret: DEAL_CANNON_PROVISIONER_SECRET,
    action: "registerCustomerWorkbook",
    email: user.email,
    normalizedEmail: user.email,
    customerSheetId: data.customerSheetId,
    customerSheetName: data.customerSheetName || ""
  });
}

function buildCustomerWorkbookName_(user) {
  var base = user.fullName || user.email || "Customer";

  base = String(base)
    .trim()
    .replace(/[\\\/:*?"<>|#\[\]]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 90);

  return "Deal Cannon - " + base + " - " + Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );
}

/* =========================
   PROVISIONER CALL HELPER
========================== */

function callDealCannonProvisioner_(payload) {
  if (!DEAL_CANNON_PROVISIONER_WEB_APP_URL) {
    throw new Error("Provisioner web app URL is not configured.");
  }

  if (!DEAL_CANNON_PROVISIONER_SECRET) {
    throw new Error("Provisioner secret is not configured.");
  }

  var response;
  var responseCode;
  var responseText;
  var parsed;

  try {
    response = UrlFetchApp.fetch(DEAL_CANNON_PROVISIONER_WEB_APP_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload || {}),
      muteHttpExceptions: true
    });

    responseCode = response.getResponseCode();
    responseText = response.getContentText();
  } catch (err) {
    throw new Error("Could not contact Deal Cannon provisioner: " + err.message);
  }

  try {
    parsed = JSON.parse(responseText || "{}");
  } catch (parseErr) {
    throw new Error("Provisioner returned an invalid response.");
  }

  if (responseCode < 200 || responseCode >= 300 || !parsed.success) {
    throw new Error(
      parsed && parsed.message
        ? parsed.message
        : "Provisioner rejected the request."
    );
  }

  return parsed.data || {};
}

/* =========================
   DEPRECATED NO-OPS
========================== */

function cleanNewCustomerWorkbookFromCore_(ss) {
  return ss;
}

function clearFolderUrlCellsByLabelsFromCore_(sheet) {
  return sheet;
}

function clearAnyObviousInheritedDriveFolderUrlsFromCore_(sheet) {
  return sheet;
}