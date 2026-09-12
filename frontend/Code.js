/**************************************
 * Deal Cannon Starter v2 — Code.gs
 * Thin shell wrapper.
 * Real logic lives in DealCannonCorev2.
 **************************************/

function doGet() {
  return HtmlService
    .createTemplateFromFile("index")
    .evaluate()
    .setTitle("Deal Cannon");
}

function include(filename) {
  return HtmlService
    .createTemplateFromFile(filename)
    .evaluate()
    .getContent();
}

/* =========================
   APP CONTEXT / AUTH
========================== */

function getAppContext() {
  return DealCannonCorev2.getAppContext();
}

function getSignedInEmailOnly() {
  var email = "";

  try {
    email = Session.getActiveUser().getEmail();
  } catch (err) {
    email = "";
  }

  return {
    success: true,
    email: email || ""
  };
}

function getCurrentUserContext() {
  var email = "";

  try {
    email = Session.getActiveUser().getEmail();
  } catch (err) {
    email = "";
  }

  var appContext = null;

  try {
    appContext = DealCannonCorev2.getAppContext();
  } catch (err2) {
    appContext = {
      success: false,
      error: err2 && err2.message ? err2.message : String(err2)
    };
  }

  return {
    success: true,
    email: email || "",
    appContext: appContext
  };
}

function getStartupState() {
  var email = "";
  var setupState = null;

  try {
    email = Session.getActiveUser().getEmail();
  } catch (err) {
    email = "";
  }

  try {
    setupState = DealCannonCorev2.getSetupState();
  } catch (setupErr) {
    setupState = {
      success: false,
      message: setupErr && setupErr.message ? setupErr.message : String(setupErr)
    };
  }

  return {
    success: !!(setupState && setupState.success),
    email: email || "",
    setupState: setupState
  };
}

function forceAuth() {
  // Touch trigger scope during the normal auth flow so scheduled sends can be armed later.
  ScriptApp.getProjectTriggers();
  return DealCannonCorev2.forceAuth();
}

/**
 * Opens Google's account/session chooser for this deployed web app.
 */
function getGoogleAccountChooserUrl(emailHint) {
  var webAppUrl = "";

  try {
    webAppUrl = ScriptApp.getService().getUrl();
  } catch (err) {
    webAppUrl = "";
  }

  if (!webAppUrl) {
    throw new Error("WEB_APP_URL_NOT_AVAILABLE: Deploy the web app first, then try again.");
  }

  var returnUrl =
    webAppUrl +
    (webAppUrl.indexOf("?") === -1 ? "?" : "&") +
    "accountSwitch=1&t=" +
    encodeURIComponent(String(new Date().getTime()));

  var url =
    "https://accounts.google.com/AddSession" +
    "?continue=" + encodeURIComponent(returnUrl) +
    "&service=wise" +
    "&prompt=select_account";

  var fallbackUrl =
    "https://accounts.google.com/AccountChooser" +
    "?continue=" + encodeURIComponent(returnUrl) +
    "&service=wise" +
    "&prompt=select_account";

  return {
    success: true,
    url: url,
    fallbackUrl: fallbackUrl,
    returnUrl: returnUrl
  };
}

/* =========================
   OFFER GENERATION
========================== */

function generate(type, payload) {
  return DealCannonCorev2.generate(type, payload);
}

/* =========================
   ANALYSIS SPREADSHEET
========================== */

function generateAnalysisSpreadsheet(analysisPayload) {
  return DealCannonCorev2.generateAnalysisSpreadsheet(analysisPayload);
}

/* =========================
   EMAIL TEMPLATES
========================== */

function getEmailTemplates() {
  return DealCannonCorev2.getEmailTemplates();
}

function saveEmailTemplates(payload) {
  return DealCannonCorev2.saveEmailTemplates(payload);
}

/* =========================
   SETUP / FOLDER SETTINGS
========================== */

function saveOnboardingSettings(loiFolderUrl, archiveFolderUrl) {
  return DealCannonCorev2.saveOnboardingSettings(loiFolderUrl, archiveFolderUrl);
}

function getSetupState() {
  return DealCannonCorev2.getSetupState();
}

function saveUserFolderFromUrl(folderUrl) {
  return DealCannonCorev2.saveUserFolderFromUrl(folderUrl);
}

function getSetupStateForOfferType(offerType) {
  return DealCannonCorev2.getSetupStateForOfferType(offerType);
}

function saveUserFolderForOfferType(offerType, folderUrl, archiveFolderUrl) {
  return DealCannonCorev2.saveUserFolderForOfferType(offerType, folderUrl, archiveFolderUrl);
}

function clearUserFolderForOfferType(offerType) {
  return DealCannonCorev2.clearUserFolderForOfferType(offerType);
}

function clearUserFolder() {
  return DealCannonCorev2.clearUserFolder();
}

/* =========================
   DIAGNOSTICS
   Safe manual tests only.
========================== */

/**
 * Run this manually from the Starter editor.
 * Then open Executions → this run → Logs.
 */
function debugDealCannonRouting() {
  var email = "";

  try {
    email = Session.getActiveUser().getEmail();
  } catch (err) {
    email = "";
  }

  var serviceUrl = "";

  try {
    serviceUrl = ScriptApp.getService().getUrl();
  } catch (err2) {
    serviceUrl = "";
  }

  var appContext = null;
  var setupState = null;
  try {
    appContext = DealCannonCorev2.getAppContext();
  } catch (ctxErr) {
    appContext = {
      success: false,
      error: ctxErr && ctxErr.message ? ctxErr.message : String(ctxErr)
    };
  }

  try {
    setupState = DealCannonCorev2.getSetupState();
  } catch (setupErr) {
    setupState = {
      success: false,
      error: setupErr && setupErr.message ? setupErr.message : String(setupErr)
    };
  }

  var result = {
    success: true,
    starterProjectName: "Deal Cannon Solo 3.0",
    activeUserEmail: email || "",
    starterWebAppUrl: serviceUrl || "",
    appContext: appContext,
    setupState: setupState
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

/**
 * Diagnostic utility for the custom Google Doc LOI templates system.
 */
function debugLoiTemplateSetup() {
  var result;
  try {
    result = DealCannonCorev2.debugLoiTemplateSetup();
  } catch (err) {
    result = {
      success: false,
      error: err && err.message ? err.message : String(err)
    };
  }
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
