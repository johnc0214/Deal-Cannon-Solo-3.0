/**************************************
 * Deal Cannon Core - ConfigService.gs
 * Workbook-backed onboarding folder settings with Admin fallback.
 *
 * Operational folder URLs are stored in the customer workbook setup cells.
 * Deal Cannon Admin -> Users remains a provisioning fallback.
 **************************************/

var DEAL_CANNON_ADMIN_SPREADSHEET_ID = "14uobOYHr038sQDCmoJ7PNq4dAVvVkXopv2RqVI1hEL0";
var DEAL_CANNON_ADMIN_USERS_TAB_NAME = "Users";
var DEAL_CANNON_ACTIVE_STATUS_VALUE = "ACTIVE";
var DEAL_CANNON_ROOT_FOLDER_NAME = "Deal Cannon";
var DEAL_CANNON_LOI_FOLDER_NAME = "LOI Documents";
var DEAL_CANNON_ARCHIVE_FOLDER_NAME = "Archived Leads";

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

    return {
      success: true,
      needsFolderSetup: !state.onboardingComplete,
      folderId: state.loiFolderId || null,
      archiveFolderId: state.archiveFolderId || null,
      folderUrl: state.loiFolderUrl || "",
      loiFolderUrl: state.loiFolderUrl || "",
      archiveFolderUrl: state.archiveFolderUrl || "",
      loiFolderName: state.loiFolderName || "",
      archiveFolderName: state.archiveFolderName || "",
      storageAutoCreated: !!state.storageAutoCreated,
      storageRepaired: !!state.storageRepaired,
      onboardingComplete: !!state.onboardingComplete,
      workbookReady: !!state.workbookReady,
      customerSheetId: state.customerSheetId || "",
      customerSheetName: state.customerSheetName || "",
      message: state.onboardingComplete
        ? "Deal Cannon Drive folders are ready."
        : state.workbookReady
          ? "Creating Deal Cannon Drive folders."
          : "Creating customer workbook."
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
      message: getConfigErrorMessage_(err)
    };
  }
}

function getOnboardingState() {
  var user = requireActiveUser_();

  var workbook = ensureCustomerWorkbookForOnboarding_(user);

  var access = getCustomerAccessFromProvisioner_(user.email);

  var customerSheetId = String(access.customerSheetId || workbook.spreadsheetId || "").trim();
  var customerSheetName = String(access.customerSheetName || workbook.spreadsheetName || "").trim();

  var storage = ensureDriveStorageForUser_(user, workbook, access);

  return {
    success: true,
    onboardingComplete: !!(customerSheetId && storage.loiFolderUrl && storage.archiveFolderUrl),
    workbookReady: !!customerSheetId,
    customerSheetId: customerSheetId,
    customerSheetName: customerSheetName,
    loiFolderUrl: storage.loiFolderUrl,
    archiveFolderUrl: storage.archiveFolderUrl,
    loiFolderId: storage.loiFolderId,
    archiveFolderId: storage.archiveFolderId,
    loiFolderName: storage.loiFolderName,
    archiveFolderName: storage.archiveFolderName,
    storageAutoCreated: !!storage.storageAutoCreated,
    storageRepaired: !!storage.storageRepaired
  };
}

/* =========================
   SAVE ONBOARDING SETTINGS
========================== */

function saveOnboardingSettings(loiFolderUrl, archiveFolderUrl) {
  try {
    var user = requireActiveUser_();

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
    var user = requireActiveUser_();

    var workbook = ensureCustomerWorkbookForOnboarding_(user);

    var loiUrl = cleanDriveFolderUrl_(folderUrl);

    if (!loiUrl) {
      throw new Error("Please enter your LOI Documents Folder URL.");
    }

    var loiFolder = validateFolderUrlAndGetDetails_(loiUrl, "LOI Documents Folder");

    var access = getCustomerAccessFromProvisioner_(user.email);
    var existingArchive = getValidSavedDriveFolder_(access.archiveFolderUrl, access.archiveFolderId, "Archived Leads Folder");
    var existingArchiveUrl = existingArchive ? existingArchive.url : "";
    var existingArchiveId = existingArchive ? existingArchive.id : "";

    if (!existingArchiveUrl) {
      existingArchiveUrl = loiUrl;
      existingArchiveId = loiFolder.id;
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
    var user = requireActiveUser_();

    var workbook = ensureCustomerWorkbookForOnboarding_(user);

    var archiveUrl = cleanDriveFolderUrl_(archiveFolderUrl);

    if (!archiveUrl) {
      throw new Error("Please enter your Archive Folder URL.");
    }

    var archiveFolder = validateFolderUrlAndGetDetails_(archiveUrl, "Archived Leads Folder");

    var access = getCustomerAccessFromProvisioner_(user.email);
    var existingLoi = getValidSavedDriveFolder_(access.loiFolderUrl, access.loiFolderId, "LOI Documents Folder");
    var existingLoiUrl = existingLoi ? existingLoi.url : "";
    var existingLoiId = existingLoi ? existingLoi.id : "";

    if (!existingLoiUrl) {
      throw new Error("Save your LOI Documents Folder first.");
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
  var access = getCustomerAccessFromProvisioner_(getLoggedInEmail_());

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

function clearUserFolderForOfferType(_offerType) {
  return clearUserFolder();
}

function clearUserFolder() {
  try {
    var user = requireActiveUser_();
    var workbook = ensureCustomerWorkbookForOnboarding_(user);

    var saved = saveFolderSettingsWithProvisioner_(user, {
      loiFolderUrl: "",
      loiFolderId: "",
      archiveFolderUrl: "",
      archiveFolderId: ""
    });

    syncFolderSettingsToCustomerWorkbook_(saved.customerSheetId || workbook.spreadsheetId, "", "");

    return {
      success: true,
      message: "Folder settings cleared."
    };
  } catch (err) {
    return {
      success: false,
      message: getConfigErrorMessage_(err)
    };
  }
}

/* =========================
   LEGACY SHEET CELL API
   Reads workbook cells first. Admin is fallback only.
========================== */

function readSetupValue_(sheet, key) {
  var cachedSettings = null;

  if (!sheet) {
    try {
      cachedSettings = getSavedFolderSettingsForCurrentUser_();
      return key === "archiveFolder"
        ? cachedSettings.archiveFolderUrl
        : cachedSettings.loiFolderUrl;
    } catch (errNoSheet) {
      return "";
    }
  }

  var sheetName = sheet.getName();
  var cellConfig = DEAL_CANNON_SETUP_CELLS[sheetName];

  if (cellConfig && cellConfig[key]) {
    var directValue = cleanDriveFolderUrlWithoutDriveLookup_(sheet.getRange(cellConfig[key]).getDisplayValue());
    if (directValue) {
      return directValue;
    }
  }

  var label = key === "archiveFolder"
    ? DEAL_CANNON_LABELS.archiveFolder
    : DEAL_CANNON_LABELS.loiFolder;

  var labeledValue = cleanDriveFolderUrlWithoutDriveLookup_(readValueNextToLabel_(sheet, label));
  if (labeledValue) {
    return labeledValue;
  }

  try {
    if (!cachedSettings) {
      cachedSettings = getSavedFolderSettingsForCurrentUser_();
    }

    if (key === "archiveFolder" && cachedSettings.archiveFolderUrl) {
      return cachedSettings.archiveFolderUrl;
    }

    if (key !== "archiveFolder" && cachedSettings.loiFolderUrl) {
      return cachedSettings.loiFolderUrl;
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
   AUTO DRIVE STORAGE
========================== */

function ensureDriveStorageForUser_(user, workbook, access) {
  access = access || {};
  workbook = workbook || {};

  var existingLoi = getValidSavedDriveFolder_(access.loiFolderUrl, access.loiFolderId, "LOI Documents Folder");
  var existingArchive = getValidSavedDriveFolder_(access.archiveFolderUrl, access.archiveFolderId, "Archived Leads Folder");

  var createdAny = false;

  if (!existingLoi || !existingArchive) {
    var defaults = ensureDefaultDriveStorageFolders_();

    if (!existingLoi) {
      existingLoi = defaults.loi;
      createdAny = true;
    }

    if (!existingArchive) {
      existingArchive = defaults.archive;
      createdAny = true;
    }
  }

  var savedUrlChanged =
    String(access.loiFolderUrl || "").trim() !== existingLoi.url ||
    String(access.archiveFolderUrl || "").trim() !== existingArchive.url ||
    String(access.loiFolderId || "").trim() !== existingLoi.id ||
    String(access.archiveFolderId || "").trim() !== existingArchive.id;

  if (savedUrlChanged) {
    var saved = saveFolderSettingsWithProvisioner_(user, {
      loiFolderUrl: existingLoi.url,
      loiFolderId: existingLoi.id,
      archiveFolderUrl: existingArchive.url,
      archiveFolderId: existingArchive.id
    });

    if (saved && saved.customerSheetId) {
      workbook.spreadsheetId = saved.customerSheetId;
    }
  }

  if (createdAny || savedUrlChanged) {
    syncFolderSettingsToCustomerWorkbook_(workbook.spreadsheetId, existingLoi.url, existingArchive.url);
  }

  return {
    loiFolderUrl: existingLoi.url,
    loiFolderId: existingLoi.id,
    loiFolderName: existingLoi.name,
    archiveFolderUrl: existingArchive.url,
    archiveFolderId: existingArchive.id,
    archiveFolderName: existingArchive.name,
    storageAutoCreated: createdAny,
    storageRepaired: savedUrlChanged
  };
}

function getValidSavedDriveFolder_(folderUrl, folderId, label) {
  var url = String(folderUrl || "").trim();
  var id = String(folderId || "").trim();

  if (url && !isDriveFolderUrl_(url)) {
    return null;
  }

  try {
    return getDriveFolderDetailsFromUrlOrId_(url || id, label);
  } catch (err) {
    return null;
  }
}

function ensureDefaultDriveStorageFolders_() {
  var root = getOrCreateDriveFolderByName_(DriveApp.getRootFolder(), DEAL_CANNON_ROOT_FOLDER_NAME);
  var loi = getOrCreateDriveFolderByName_(root, DEAL_CANNON_LOI_FOLDER_NAME);
  var archive = getOrCreateDriveFolderByName_(root, DEAL_CANNON_ARCHIVE_FOLDER_NAME);

  return {
    root: getDriveFolderDetails_(root),
    loi: getDriveFolderDetails_(loi),
    archive: getDriveFolderDetails_(archive)
  };
}

function getOrCreateDriveFolderByName_(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parentFolder.createFolder(folderName);
}

function getDriveFolderDetails_(folder) {
  return {
    id: folder.getId(),
    name: folder.getName(),
    url: folder.getUrl()
  };
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

  if (isDriveFolderUrl_(text)) {
    var matches = text.match(/https:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]{20,})(?:\?[^ \n\r\t]*)?/g);
    return matches && matches.length ? matches[matches.length - 1] : "";
  }

  if (isRawDriveId_(text)) {
    return getDriveFolderDetailsFromUrlOrId_(text, "Drive folder").url;
  }

  return "";
}

function validateFolderUrlAndGetId_(folderUrl) {
  return validateFolderUrlAndGetDetails_(folderUrl, "Drive folder").id;
}

function validateFolderUrlAndGetDetails_(folderUrl, label) {
  return getDriveFolderDetailsFromUrlOrId_(folderUrl, label);
}

function getDriveFolderDetailsFromUrlOrId_(folderUrl, label) {
  label = label || "Drive folder";

  var cleanUrl = cleanDriveFolderUrlWithoutDriveLookup_(folderUrl);

  if (!cleanUrl) {
    throw new Error(label + " URL is invalid. Paste a Google Drive folder URL.");
  }

  var folderId = "";

  try {
    folderId = getStrictDriveFolderId_(cleanUrl);
  } catch (err) {
    throw new Error(label + " URL is invalid. Paste a Google Drive folder URL.");
  }

  try {
    var folder = DriveApp.getFolderById(folderId);
    var name = folder.getName();

    return {
      id: folderId,
      name: name,
      url: folder.getUrl()
    };
  } catch (err2) {
    throw new Error(
      "Cannot access " + label + ". Make sure the selected Google account owns or has access to this Drive folder."
    );
  }
}

function cleanDriveFolderUrlWithoutDriveLookup_(value) {
  var text = String(value || "").trim();

  if (!text) {
    return "";
  }

  if (isDriveFolderUrl_(text)) {
    var matches = text.match(/https:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9_-]{20,}(?:\?[^ \n\r\t]*)?/g);
    return matches && matches.length ? matches[matches.length - 1] : "";
  }

  if (isRawDriveId_(text)) {
    return text;
  }

  return "";
}

function isDriveFolderUrl_(value) {
  return /^https:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9_-]{20,}(?:\?[^ \n\r\t]*)?$/.test(String(value || "").trim());
}

function isRawDriveId_(value) {
  return /^[a-zA-Z0-9_-]{20,}$/.test(String(value || "").trim());
}

function getStrictDriveFolderId_(value) {
  var text = String(value || "").trim();

  if (isDriveFolderUrl_(text)) {
    var match = text.match(/^https:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]{20,})(?:\?[^ \n\r\t]*)?$/);
    if (match && match[1]) {
      return match[1];
    }
  }

  if (isRawDriveId_(text)) {
    return text;
  }

  throw new Error("INVALID_DRIVE_FOLDER_ID");
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
