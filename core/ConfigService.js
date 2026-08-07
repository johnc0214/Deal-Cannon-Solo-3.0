/**************************************
 * Deal Cannon Core — ConfigService.gs
 * Workbook-backed onboarding folder settings with Admin fallback.
 *
 * Operational folder URLs are stored in the customer workbook setup cells.
 * Deal Cannon Admin → Users remains a provisioning fallback.
 **************************************/

var DEAL_CANNON_ADMIN_SPREADSHEET_ID = "14uobOYHr038sQDCmoJ7PNq4dAVvVkXopv2RqVI1hEL0";
var DEAL_CANNON_ADMIN_USERS_TAB_NAME = "Users";
var DEAL_CANNON_ACTIVE_STATUS_VALUE = "ACTIVE";

var DEAL_CANNON_OFFER_SHEETS = [
  "Cash",
  "Seller Financing",
  "Sub to"
];

var DEAL_CANNON_LABELS = {
  loiFolder: "LOI PDF Folder ->",
  archiveFolder: "Archive->"
};

var DEAL_CANNON_SETUP_CELLS = {
  "Cash": {
    loiFolder: "B13",
    archiveFolder: "B15"
  },
  "Seller Financing": {
    loiFolder: "B20",
    archiveFolder: "B22"
  },
  "Sub to": {
    loiFolder: "B16",
    archiveFolder: "B18"
  }
};

/* =========================
   ADMIN CONFIG
========================== */

function getAdminSpreadsheetId_() {
  return DEAL_CANNON_ADMIN_SPREADSHEET_ID;
}

function getAdminUsersTabName_() {
  return DEAL_CANNON_ADMIN_USERS_TAB_NAME;
}

function getActiveStatusValue_() {
  return DEAL_CANNON_ACTIVE_STATUS_VALUE;
}

/* =========================
   LEGACY COMPAT
========================== */

function getUserFolderId() {
  try {
    var state = getOnboardingState();
    return state.loiFolderId || "";
  } catch (err) {
    return "";
  }
}

function hasUserFolder() {
  return !!getUserFolderId();
}

/* =========================
   WORKBOOK CONTEXT
========================== */

function getCustomerWorkbook_() {
  var ctx = openCustomerSpreadsheet_();
  return ctx.ss;
}

/* =========================
   ONBOARDING STATE
========================== */

function getSetupState() {
  try {
    var state = getOnboardingState();
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

    var message = state.onboardingComplete
      ? "Onboarding complete."
      : (state.workbookReady
          ? "Workbook connected. Save your folder settings."
          : "Creating customer workbook.");

    return {
      success: true,
      needsFolderSetup: !state.onboardingComplete,
      folderId: state.loiFolderId || null,
      archiveFolderId: state.archiveFolderId || null,
      folderUrl: state.loiFolderUrl || "",
      loiFolderUrl: state.loiFolderUrl || "",
      archiveFolderUrl: state.archiveFolderUrl || "",
      onboardingComplete: !!state.onboardingComplete,
      workbookReady: !!state.workbookReady,
      customerSheetId: state.customerSheetId || "",
      customerSheetName: state.customerSheetName || "",
      gmailConnected: gmailConnection.gmailConnected === true,
      gmailConnectedEmail: gmailConnection.gmailConnectedEmail || "",
      gmailStatus: gmailConnection.gmailStatus || "DISCONNECTED",
      gmailHostedDomain: gmailConnection.gmailHostedDomain || "",
      gmailRefreshTokenStored: gmailConnection.refreshTokenStored === true,
      schedulerBackendAvailable: gmailConnection.backendAvailable === true,
      gmailMessage: gmailConnection.message || "",
      message: message
    };
  } catch (err) {
    return {
      success: false,
      needsFolderSetup: true,
      onboardingComplete: false,
      workbookReady: false,
      folderUrl: "",
      loiFolderUrl: "",
      archiveFolderUrl: "",
      customerSheetId: "",
      customerSheetName: "",
      gmailConnected: false,
      gmailConnectedEmail: "",
      gmailStatus: "ERROR",
      gmailHostedDomain: "",
      gmailRefreshTokenStored: false,
      schedulerBackendAvailable: false,
      gmailMessage: "",
      message: getConfigErrorMessage_(err)
    };
  }
}

function getOnboardingState() {
  var user = requireApprovedUser_();

  var workbook = ensureCustomerWorkbookForOnboarding_(user);

  var customerSheetId = String(user.customerSheetId || workbook.spreadsheetId || "").trim();
  var customerSheetName = String(user.customerSheetName || workbook.spreadsheetName || "").trim();

  var loiFolderUrl = String(user.loiFolderUrl || "").trim();
  var archiveFolderUrl = String(user.archiveFolderUrl || "").trim();

  var loiFolderId = String(user.loiFolderId || "").trim();
  var archiveFolderId = String(user.archiveFolderId || "").trim();

  if (!loiFolderId && loiFolderUrl) {
    try {
      loiFolderId = extractId(loiFolderUrl);
    } catch (e) {
      loiFolderId = "";
    }
  }

  if (!archiveFolderId && archiveFolderUrl) {
    try {
      archiveFolderId = extractId(archiveFolderUrl);
    } catch (e2) {
      archiveFolderId = "";
    }
  }

  return {
    success: true,
    onboardingComplete: !!(customerSheetId && loiFolderUrl && archiveFolderUrl),
    workbookReady: !!customerSheetId,
    customerSheetId: customerSheetId,
    customerSheetName: customerSheetName,
    loiFolderUrl: loiFolderUrl,
    archiveFolderUrl: archiveFolderUrl,
    loiFolderId: loiFolderId,
    archiveFolderId: archiveFolderId
  };
}

/* =========================
   SAVE ONBOARDING SETTINGS
========================== */

function saveOnboardingSettings(loiFolderUrl, archiveFolderUrl) {
  try {
    var user = requireApprovedUser_();

    var workbook = ensureCustomerWorkbookForOnboarding_(user);

    var loiUrl = cleanDriveFolderUrl_(loiFolderUrl);
    var archiveUrl = cleanDriveFolderUrl_(archiveFolderUrl);

    if (!loiUrl) {
      throw new Error("Please enter your LOI Documents Folder URL.");
    }

    if (!archiveUrl) {
      throw new Error("Please enter your Archive Folder URL.");
    }

    var loiFolder = validateFolderUrlAndGetDetails_(loiUrl, "LOI Documents Folder");
    var archiveFolder = validateFolderUrlAndGetDetails_(archiveUrl, "Archived Leads Folder");

    var saved = saveFolderSettingsWithProvisioner_(user, {
      loiFolderUrl: loiUrl,
      loiFolderId: loiFolder.id,
      archiveFolderUrl: archiveUrl,
      archiveFolderId: archiveFolder.id
    });

    syncFolderSettingsToCustomerWorkbook_(saved.customerSheetId || workbook.spreadsheetId, loiUrl, archiveUrl);

    return {
      success: true,
      folderId: loiFolder.id,
      loiFolderId: loiFolder.id,
      archiveFolderId: archiveFolder.id,
      loiFolderName: loiFolder.name,
      archiveFolderName: archiveFolder.name,
      folderUrl: loiUrl,
      loiFolderUrl: loiUrl,
      archiveFolderUrl: archiveUrl,
      onboardingComplete: true,
      workbookReady: true,
      workbookCreated: !!workbook.createdNew,
      customerSheetId: saved.customerSheetId || workbook.spreadsheetId,
      customerSheetName: saved.customerSheetName || workbook.spreadsheetName,
      message: "Folder settings saved."
    };
  } catch (err) {
    return {
      success: false,
      onboardingComplete: false,
      workbookReady: false,
      message: getConfigErrorMessage_(err)
    };
  }
}

/* =========================
   SINGLE FOLDER LEGACY SAVE
========================== */

function saveUserFolderFromUrl(folderUrl) {
  try {
    var user = requireApprovedUser_();

    var workbook = ensureCustomerWorkbookForOnboarding_(user);

    var loiUrl = cleanDriveFolderUrl_(folderUrl);

    if (!loiUrl) {
      throw new Error("Please enter your LOI Documents Folder URL.");
    }

    var loiFolder = validateFolderUrlAndGetDetails_(loiUrl, "LOI Documents Folder");

    var access = getCustomerAccessFromProvisioner_(user.email);
    var existingArchiveUrl = String(access.archiveFolderUrl || "").trim();
    var existingArchiveId = String(access.archiveFolderId || "").trim();

    if (!existingArchiveUrl) {
      existingArchiveUrl = loiUrl;
      existingArchiveId = loiFolder.id;
    }

    if (!existingArchiveId && existingArchiveUrl) {
      existingArchiveId = extractId(existingArchiveUrl);
    }

    var saved = saveFolderSettingsWithProvisioner_(user, {
      loiFolderUrl: loiUrl,
      loiFolderId: loiFolder.id,
      archiveFolderUrl: existingArchiveUrl,
      archiveFolderId: existingArchiveId
    });

    syncFolderSettingsToCustomerWorkbook_(saved.customerSheetId || workbook.spreadsheetId, loiUrl, existingArchiveUrl);

    return {
      success: true,
      folderId: loiFolder.id,
      loiFolderId: loiFolder.id,
      archiveFolderId: existingArchiveId,
      folderUrl: loiUrl,
      loiFolderUrl: loiUrl,
      archiveFolderUrl: existingArchiveUrl,
      customerSheetId: saved.customerSheetId || workbook.spreadsheetId,
      customerSheetName: saved.customerSheetName || workbook.spreadsheetName,
      workbookCreated: !!workbook.createdNew,
      workbookReady: true,
      onboardingComplete: !!existingArchiveUrl,
      message: "LOI folder saved."
    };
  } catch (err) {
    return {
      success: false,
      message: getConfigErrorMessage_(err)
    };
  }
}

function saveArchiveFolderFromUrl(archiveFolderUrl) {
  try {
    var user = requireApprovedUser_();

    var workbook = ensureCustomerWorkbookForOnboarding_(user);

    var archiveUrl = cleanDriveFolderUrl_(archiveFolderUrl);

    if (!archiveUrl) {
      throw new Error("Please enter your Archive Folder URL.");
    }

    var archiveFolder = validateFolderUrlAndGetDetails_(archiveUrl, "Archived Leads Folder");

    var access = getCustomerAccessFromProvisioner_(user.email);
    var existingLoiUrl = String(access.loiFolderUrl || "").trim();
    var existingLoiId = String(access.loiFolderId || "").trim();

    if (!existingLoiUrl) {
      throw new Error("Save your LOI Documents Folder first.");
    }

    if (!existingLoiId) {
      existingLoiId = extractId(existingLoiUrl);
    }

    var saved = saveFolderSettingsWithProvisioner_(user, {
      loiFolderUrl: existingLoiUrl,
      loiFolderId: existingLoiId,
      archiveFolderUrl: archiveUrl,
      archiveFolderId: archiveFolder.id
    });

    syncFolderSettingsToCustomerWorkbook_(saved.customerSheetId || workbook.spreadsheetId, existingLoiUrl, archiveUrl);

    return {
      success: true,
      archiveFolderId: archiveFolder.id,
      archiveFolderName: archiveFolder.name,
      archiveFolderUrl: archiveUrl,
      customerSheetId: saved.customerSheetId || workbook.spreadsheetId,
      customerSheetName: saved.customerSheetName || workbook.spreadsheetName,
      message: "Archive folder saved successfully."
    };
  } catch (err) {
    return {
      success: false,
      message: getConfigErrorMessage_(err)
    };
  }
}

/* =========================
   FOLDER GETTERS FOR GENERATION
========================== */

function getSavedFolderSettingsForCurrentUser_() {
  var user = requireApprovedUser_();
  var access = getCustomerAccessFromProvisioner_(user.email);

  return {
    loiFolderUrl: String(access.loiFolderUrl || "").trim(),
    loiFolderId: String(access.loiFolderId || "").trim(),
    archiveFolderUrl: String(access.archiveFolderUrl || "").trim(),
    archiveFolderId: String(access.archiveFolderId || "").trim()
  };
}

function getLoiFolderUrlForCurrentUser_() {
  return getSavedFolderSettingsForCurrentUser_().loiFolderUrl || "";
}

function getArchiveFolderUrlForCurrentUser_() {
  return getSavedFolderSettingsForCurrentUser_().archiveFolderUrl || "";
}

/* =========================
   PER-OFFER HELPERS
========================== */

function getOfferSheetName_(offerType) {
  var type = String(offerType || "").trim();

  if (type === "Cash") return "Cash";
  if (type === "SellerFinance") return "Seller Financing";
  if (type === "SubTo") return "Sub to";

  throw new Error("Invalid offer type: " + type);
}

function getSetupStateForOfferType(offerType) {
  try {
    var state = getOnboardingState();

    return {
      success: true,
      offerType: offerType,
      needsFolderSetup: !state.onboardingComplete,
      folderId: state.loiFolderId || null,
      archiveFolderId: state.archiveFolderId || null,
      folderUrl: state.loiFolderUrl || "",
      loiFolderUrl: state.loiFolderUrl || "",
      archiveFolderUrl: state.archiveFolderUrl || "",
      onboardingComplete: !!state.onboardingComplete
    };
  } catch (err) {
    return {
      success: false,
      offerType: offerType,
      message: getConfigErrorMessage_(err)
    };
  }
}

function saveUserFolderForOfferType(offerType, folderUrl, archiveFolderUrl) {
  return saveOnboardingSettings(folderUrl, archiveFolderUrl || folderUrl);
}

/* =========================
   LEGACY SHEET CELL API
   Reads workbook cells first. Admin is fallback only.
========================== */

function readSetupValue_(sheet, key) {
  if (!sheet) {
    try {
      var settingsWithoutSheet = getSavedFolderSettingsForCurrentUser_();
      return key === "archiveFolder"
        ? settingsWithoutSheet.archiveFolderUrl
        : settingsWithoutSheet.loiFolderUrl;
    } catch (errNoSheet) {
      return "";
    }
  }

  var sheetName = sheet.getName();
  var cellConfig = DEAL_CANNON_SETUP_CELLS[sheetName];

  if (cellConfig && cellConfig[key]) {
    var directValue = String(sheet.getRange(cellConfig[key]).getDisplayValue() || "").trim();
    if (directValue) {
      return directValue;
    }
  }

  var label = key === "archiveFolder"
    ? DEAL_CANNON_LABELS.archiveFolder
    : DEAL_CANNON_LABELS.loiFolder;

  var labeledValue = readValueNextToLabel_(sheet, label);
  if (labeledValue) {
    return labeledValue;
  }

  try {
    var settings = getSavedFolderSettingsForCurrentUser_();

    if (key === "archiveFolder" && settings.archiveFolderUrl) {
      return settings.archiveFolderUrl;
    }

    if (key !== "archiveFolder" && settings.loiFolderUrl) {
      return settings.loiFolderUrl;
    }
  } catch (err) {}

  return "";
}

function writeSetupValue_(sheet, key, value) {
  if (!sheet) {
    return;
  }

  var sheetName = sheet.getName();
  var cellConfig = DEAL_CANNON_SETUP_CELLS[sheetName];

  if (cellConfig && cellConfig[key]) {
    sheet.getRange(cellConfig[key]).setValue(value || "");
    return;
  }

  var label = key === "archiveFolder"
    ? DEAL_CANNON_LABELS.archiveFolder
    : DEAL_CANNON_LABELS.loiFolder;

  writeValueNextToLabel_(sheet, label, value);
}

function syncFolderSettingsToCustomerWorkbook_(spreadsheetId, loiFolderUrl, archiveFolderUrl) {
  if (!spreadsheetId) {
    return;
  }

  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheets = getDealCannonOfferSheets_(ss);

  sheets.forEach(function(sheet) {
    writeSetupValue_(sheet, "loiFolder", loiFolderUrl || "");
    writeSetupValue_(sheet, "archiveFolder", archiveFolderUrl || "");
  });

  SpreadsheetApp.flush();
}

/* =========================
   SHEET HELPERS
========================== */

function getDealCannonOfferSheets_(ss) {
  return DEAL_CANNON_OFFER_SHEETS.map(function(name) {
    var sheet = ss.getSheetByName(name);

    if (!sheet) {
      throw new Error("Missing required sheet tab: " + name);
    }

    return sheet;
  });
}

function readValueNextToLabel_(sheet, label) {
  var row = findLabelRow_(sheet, label);

  if (!row) {
    return "";
  }

  return String(sheet.getRange(row, 2).getDisplayValue() || "").trim();
}

function writeValueNextToLabel_(sheet, label, value) {
  var row = findLabelRow_(sheet, label);

  if (!row) {
    return;
  }

  sheet.getRange(row, 2).setValue(value || "");
}

function findLabelRow_(sheet, label) {
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var values = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();

  var targetLoose = normalizeSheetLabelLoose_(label);
  var targetTight = normalizeSheetLabelTight_(label);

  for (var i = 0; i < values.length; i++) {
    var currentLoose = normalizeSheetLabelLoose_(values[i][0]);
    var currentTight = normalizeSheetLabelTight_(values[i][0]);

    if (currentLoose === targetLoose || currentTight === targetTight) {
      return i + 1;
    }
  }

  for (var j = 0; j < values.length; j++) {
    var currentLoose2 = normalizeSheetLabelLoose_(values[j][0]);
    var currentTight2 = normalizeSheetLabelTight_(values[j][0]);

    if (
      currentLoose2.indexOf(targetLoose) !== -1 ||
      targetLoose.indexOf(currentLoose2) !== -1 ||
      currentTight2.indexOf(targetTight) !== -1 ||
      targetTight.indexOf(currentTight2) !== -1
    ) {
      return j + 1;
    }
  }

  return 0;
}

function normalizeSheetLabelLoose_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[→]/g, "->")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*>\s*/g, "->")
    .trim();
}

function normalizeSheetLabelTight_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\u00a0/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[→]/g, "->")
    .replace(/\s*-\s*>\s*/g, "->")
    .replace(/[^a-z0-9>_-]/g, "");
}

function firstNonEmpty_(arr) {
  for (var i = 0; i < arr.length; i++) {
    if (String(arr[i] || "").trim() !== "") {
      return String(arr[i]).trim();
    }
  }

  return "";
}

/* =========================
   DRIVE URL HELPERS
========================== */

function cleanDriveFolderUrl_(value) {
  var text = String(value || "").trim();

  if (!text) {
    return "";
  }

  var matches = text.match(/https:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9_-]+(?:\?[^ \n\r\t]*)?/g);

  if (matches && matches.length) {
    return matches[matches.length - 1];
  }

  return text;
}

function validateFolderUrlAndGetId_(folderUrl) {
  return validateFolderUrlAndGetDetails_(folderUrl, "Drive folder").id;
}

function validateFolderUrlAndGetDetails_(folderUrl, label) {
  var cleanUrl = cleanDriveFolderUrl_(folderUrl);

  if (!cleanUrl) {
    throw new Error(label + " URL is blank.");
  }

  var folderId = "";

  try {
    folderId = extractId(cleanUrl);
  } catch (err) {
    throw new Error(label + " URL is invalid. Paste a Google Drive folder URL.");
  }

  try {
    var folder = DriveApp.getFolderById(folderId);
    var name = folder.getName();

    return {
      id: folderId,
      name: name,
      url: cleanUrl
    };
  } catch (err2) {
    throw new Error(
      "Cannot access " + label + ". Make sure the selected Google account owns or has access to this Drive folder."
    );
  }
}

/* =========================
   ERROR HELPERS
========================== */

function getConfigErrorMessage_(err) {
  var msg = err && err.message ? err.message : String(err || "Unknown error.");

  if (msg.indexOf("ACCESS_DENIED") !== -1) {
    return msg;
  }

  if (msg.indexOf("ONBOARDING_REQUIRED") !== -1) {
    return "Customer workbook has not been created yet. Refresh and try again.";
  }

  if (msg.indexOf("WORKBOOK_ACCESS_DENIED") !== -1) {
    return "Your account is active, but this Google account cannot access the assigned Deal Cannon workbook.";
  }

  if (msg.indexOf("Unable to detect your Google email") !== -1) {
    return "Unable to detect your Google email. Redeploy the web app as user accessing the web app.";
  }

  if (msg.indexOf("Missing required sheet tab") !== -1) {
    return msg;
  }

  if (msg.indexOf("Cannot access") !== -1) {
    return msg;
  }

  if (msg.indexOf("You do not have permission") !== -1) {
    return "This Google account does not have permission to access the assigned customer workbook or Drive folder.";
  }

  if (msg.indexOf("No item with the given ID could be found") !== -1) {
    return "Google could not find that Drive item for this account. Use the same Google account that owns or has access to the folder, then paste a valid Drive folder URL.";
  }

  return msg;
}
