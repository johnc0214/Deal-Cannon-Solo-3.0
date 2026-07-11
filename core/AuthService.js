/**************************************
 * Deal Cannon Core — AuthService.gs
 * Provisioner-backed license validation + customer workbook context.
 **************************************/

var DEAL_CANNON_AUTH_PROVISIONER_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz4aKahgItLWbHC7_IOwEFyLiDMNZ2w15EjXtlI-Rf9czOW1XAs3AD5sMCrJu4f8oY6/exec";
var DEAL_CANNON_AUTH_PROVISIONER_SECRET = "dc_9Kx82mLqPz_2026_private_checkout_secret_7719";

function normalizeEmail_(email) {
  return String(email || "").trim().toLowerCase();
}

function getLoggedInEmail_() {
  var activeEmail = "";
  try {
    activeEmail = Session.getActiveUser().getEmail();
  } catch (e) {}

  var effectiveEmail = "";
  try {
    effectiveEmail = Session.getEffectiveUser().getEmail();
  } catch (e) {}

  var email = normalizeEmail_(activeEmail || effectiveEmail);

  if (!email) {
    throw new Error("Unable to detect your Google email. Redeploy the web app as user accessing the web app.");
  }

  return email;
}

/* =========================
   PROVISIONER ACCESS LOOKUP
========================== */

function getApprovedUserRecord_() {
  const email = getLoggedInEmail_();
  console.log(`Resolving user for email: ${email}`);

  const access = getCustomerAccessFromProvisioner_(email);

  if (!access || !access.approved) {
    throw new Error((access && access.reason) || "ACCESS_DENIED: Your email is not approved.");
  }

  const status = String(access.status || "").trim().toUpperCase();

  if (status !== getActiveStatusValue_()) {
    throw new Error("ACCESS_DENIED: Your account is not active.");
  }

  const customerSheetId = String(access.customerSheetId || "").trim();

  if (!customerSheetId) {
    throw new Error("ONBOARDING_REQUIRED: Customer workbook has not been created yet.");
  }

  return {
    email: normalizeEmail_(access.email || email),
    normalizedEmail: normalizeEmail_(access.normalizedEmail || access.email || email),
    fullName: String(access.fullName || "").trim(),
    status: status,
    customerSheetId: customerSheetId,
    customerSheetName: customerSheetId ? String(access.customerSheetName || "").trim() : "",
    folderIdDefault: String(access.folderIdDefault || "").trim(),
    loiFolderUrl: String(access.loiFolderUrl || "").trim(),
    loiFolderId: String(access.loiFolderId || "").trim(),
    archiveFolderUrl: String(access.archiveFolderUrl || "").trim(),
    archiveFolderId: String(access.archiveFolderId || "").trim(),
    onboardingCompleteAt: String(access.onboardingCompleteAt || "").trim(),
    onboardingRequired: !customerSheetId || !String(access.loiFolderUrl || "").trim() || !String(access.archiveFolderUrl || "").trim()
  };
}

function requireApprovedUser_() {
  const email = getLoggedInEmail_();
  console.log(`Resolving user for email: ${email}`);

  const access = getCustomerAccessFromProvisioner_(email);

  if (!access || !access.approved) {
    throw new Error((access && access.reason) || "ACCESS_DENIED: Your email is not approved.");
  }

  const status = String(access.status || "").trim().toUpperCase();

  if (status !== getActiveStatusValue_()) {
    throw new Error("ACCESS_DENIED: Your account is not active.");
  }

  const customerSheetId = String(access.customerSheetId || "").trim();

  if (!customerSheetId) {
    throw new Error("ONBOARDING_REQUIRED: Customer workbook has not been created yet.");
  }

  return {
    email: normalizeEmail_(access.email || email),
    normalizedEmail: normalizeEmail_(access.normalizedEmail || access.email || email),
    fullName: String(access.fullName || "").trim(),
    status: status,
    customerSheetId: customerSheetId,
    customerSheetName: customerSheetId ? String(access.customerSheetName || "").trim() : "",
    folderIdDefault: String(access.folderIdDefault || "").trim(),
    loiFolderUrl: String(access.loiFolderUrl || "").trim(),
    loiFolderId: String(access.loiFolderId || "").trim(),
    archiveFolderUrl: String(access.archiveFolderUrl || "").trim(),
    archiveFolderId: String(access.archiveFolderId || "").trim(),
    onboardingCompleteAt: String(access.onboardingCompleteAt || "").trim(),
    onboardingRequired: !customerSheetId || !String(access.loiFolderUrl || "").trim() || !String(access.archiveFolderUrl || "").trim()
  };
}

function getCustomerAccessFromProvisioner_(email) {
  if (!DEAL_CANNON_AUTH_PROVISIONER_WEB_APP_URL) {
    throw new Error("Provisioner web app URL is not configured.");
  }

  var payload = {
    secret: DEAL_CANNON_AUTH_PROVISIONER_SECRET,
    action: "getCustomerAccess",
    email: normalizeEmail_(email)
  };

  return callAuthProvisioner_(payload);
}

function callAuthProvisioner_(payload) {
  var response;
  var responseCode;
  var responseText;
  var parsed;

  try {
    response = UrlFetchApp.fetch(DEAL_CANNON_AUTH_PROVISIONER_WEB_APP_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload || {}),
      muteHttpExceptions: true
    });

    responseCode = response.getResponseCode();
    responseText = response.getContentText();
  } catch (err) {
    throw new Error("Could not contact Deal Cannon licensing service: " + err.message);
  }

  try {
    parsed = JSON.parse(responseText || "{}");
  } catch (parseErr) {
    throw new Error("Deal Cannon licensing service returned an invalid response.");
  }

  if (responseCode < 200 || responseCode >= 300 || !parsed.success) {
    throw new Error(
      parsed && parsed.message
        ? parsed.message
        : "Deal Cannon licensing service rejected the request."
    );
  }

  return parsed.data || {};
}

/* =========================
   CUSTOMER WORKBOOK CONTEXT
========================== */

function openCustomerSpreadsheet_() {
  var user = requireApprovedUser_();

  if (!user.customerSheetId) {
    throw new Error("ONBOARDING_REQUIRED: Customer workbook has not been created yet.");
  }

  if (typeof isProtectedCustomerSpreadsheetId_ === "function" && isProtectedCustomerSpreadsheetId_(user.customerSheetId)) {
    throw new Error("ONBOARDING_REQUIRED: Customer workbook must be created from the onboarding flow.");
  }

  var ss;

  try {
    ss = SpreadsheetApp.openById(user.customerSheetId);
  } catch (err) {
    throw new Error("WORKBOOK_ACCESS_DENIED: Your account is active, but this Google account cannot access the assigned Deal Cannon workbook.");
  }

  return {
    user: user,
    ss: ss
  };
}

/* =========================
   APP CONTEXT
========================== */

function getAppContext() {
  try {
    var user = requireApprovedUser_();

    return {
      success: true,
      onboardingRequired: !!user.onboardingRequired,
      workbookReady: !!user.customerSheetId,
      user: {
        email: user.email,
        normalizedEmail: user.normalizedEmail,
        fullName: user.fullName,
        status: user.status,
        customerSheetId: user.customerSheetId,
        customerSheetName: user.customerSheetName,
        folderIdDefault: user.folderIdDefault,
        loiFolderUrl: user.loiFolderUrl,
        loiFolderId: user.loiFolderId,
        archiveFolderUrl: user.archiveFolderUrl,
        archiveFolderId: user.archiveFolderId,
        onboardingCompleteAt: user.onboardingCompleteAt
      }
    };
  } catch (err) {
    return {
      success: false,
      onboardingRequired: true,
      workbookReady: false,
      message: err && err.message ? err.message : String(err)
    };
  }
}

function findWorkbookFolderUrl_(ss) {
  var user = requireApprovedUser_();
  return user.loiFolderUrl || "";
}
