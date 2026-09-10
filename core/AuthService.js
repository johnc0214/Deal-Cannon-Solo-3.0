/**************************************
 * Deal Cannon Core — AuthService.gs
 * Provisioner-backed license validation + customer workbook context.
 **************************************/

var DEAL_CANNON_AUTH_PROVISIONER_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz4aKahgItLWbHC7_IOwEFyLiDMNZ2w15EjXtlI-Rf9czOW1XAs3AD5sMCrJu4f8oY6/exec";
var DEAL_CANNON_AUTH_PROVISIONER_SECRET = "dc_9Kx82mLqPz_2026_private_checkout_secret_7719";
var DEAL_CANNON_AUTH_CACHE_TTL_SECONDS = 60;

var dealCannonApprovedUserExecutionCache_ = {};
var dealCannonProvisionerAccessExecutionCache_ = {};

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
  return requireApprovedUser_();
}

function buildApprovedUserFromAccess_(email, access) {
  if (!access || !access.approved) {
    throw new Error((access && access.reason) || "ACCESS_DENIED: Your email is not approved.");
  }

  var status = String(access.status || "").trim().toUpperCase();

  if (status !== getActiveStatusValue_() && status !== "APPROVED" && status !== "ENABLED") {
    throw new Error("ACCESS_DENIED: Your account is not active.");
  }

  var rawCustomerSheetId = String(access.customerSheetId || "").trim();
  var customerSheetId = (!rawCustomerSheetId || (typeof isProtectedCustomerSpreadsheetId_ === "function" && isProtectedCustomerSpreadsheetId_(rawCustomerSheetId))) ? "" : rawCustomerSheetId;

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

function requireApprovedUser_(options) {
  options = options || {};

  var email = getLoggedInEmail_();
  var cacheKey = normalizeEmail_(email);

  console.log(`Resolving user for email: ${email}`);

  if (!options.forceRefresh && dealCannonApprovedUserExecutionCache_[cacheKey]) {
    return dealCannonApprovedUserExecutionCache_[cacheKey];
  }

  var access = getCustomerAccessFromProvisioner_(email, options);
  var user = buildApprovedUserFromAccess_(email, access);

  dealCannonApprovedUserExecutionCache_[cacheKey] = user;

  return user;
}

function getProvisionerAccessCacheKey_(email) {
  return "dc:auth:access:" + normalizeEmail_(email);
}

function getCachedProvisionerAccess_(email) {
  var cacheKey = getProvisionerAccessCacheKey_(email);
  var executionValue = dealCannonProvisionerAccessExecutionCache_[cacheKey];

  if (executionValue) {
    return executionValue;
  }

  try {
    var cachedText = CacheService.getUserCache().get(cacheKey);
    if (!cachedText) {
      return null;
    }

    var parsed = JSON.parse(cachedText);
    dealCannonProvisionerAccessExecutionCache_[cacheKey] = parsed;
    return parsed;
  } catch (err) {
    return null;
  }
}

function cacheProvisionerAccess_(email, access) {
  var cacheKey = getProvisionerAccessCacheKey_(email);

  dealCannonProvisionerAccessExecutionCache_[cacheKey] = access;

  try {
    CacheService
      .getUserCache()
      .put(cacheKey, JSON.stringify(access || {}), DEAL_CANNON_AUTH_CACHE_TTL_SECONDS);
  } catch (err) {}
}

function getCustomerAccessFromProvisioner_(email, options) {
  options = options || {};

  var normalizedEmail = normalizeEmail_(email);

  if (!DEAL_CANNON_AUTH_PROVISIONER_WEB_APP_URL) {
    throw new Error("Provisioner web app URL is not configured.");
  }

  if (!normalizedEmail) {
    throw new Error("Missing email for customer access lookup.");
  }

  if (!options.forceRefresh) {
    var cached = getCachedProvisionerAccess_(normalizedEmail);
    if (cached) {
      return cached;
    }
  }

  var payload = {
    secret: DEAL_CANNON_AUTH_PROVISIONER_SECRET,
    action: "getCustomerAccess",
    email: normalizedEmail
  };

  var access = callAuthProvisioner_(payload);

  cacheProvisionerAccess_(normalizedEmail, access);

  return access;
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
    var gmailConnection = typeof getScheduledSendingConnectionSummary_ === "function"
      ? getScheduledSendingConnectionSummary_()
      : {
          gmailConnected: false,
          gmailConnectedEmail: "",
          gmailStatus: "DISCONNECTED",
          gmailHostedDomain: "",
          refreshTokenStored: false,
          message: "Scheduled sending Gmail connection is not available.",
          backendAvailable: false
        };

    return {
      success: true,
      onboardingRequired: !!user.onboardingRequired,
      workbookReady: !!user.customerSheetId,
      schedulerBackendAvailable: gmailConnection.backendAvailable === true,
      gmailConnection: gmailConnection,
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
      schedulerBackendAvailable: false,
      gmailConnection: {
        gmailConnected: false,
        gmailConnectedEmail: "",
        gmailStatus: "ERROR",
        gmailHostedDomain: "",
        refreshTokenStored: false,
        message: err && err.message ? err.message : String(err),
        backendAvailable: false
      },
      message: err && err.message ? err.message : String(err)
    };
  }
}

function findWorkbookFolderUrl_(ss) {
  var user = requireApprovedUser_();
  return user.loiFolderUrl || "";
}
