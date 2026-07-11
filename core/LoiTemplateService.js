/**************************************
 * Deal Cannon Core - LoiTemplateService.js
 * Manages Google Doc master LOI templates, user copies, and variable replacement.
 **************************************/

var CASH_LOI_TEMPLATE_DOC_ID = "1aaoXKSL7uJp1VxrhV781_1UHQPVnj_fUhCtibGOU8lU";
var SELLER_FINANCE_LOI_TEMPLATE_DOC_ID = "1IxVv1dPMO0yEQ8kPXt_XDm7rsr_wg2SKzJBNxXADTPs";
var SUBTO_LOI_TEMPLATE_DOC_ID = "1B0z4WQ-BaGUJyRjNYMfiq3CfcQVYgHUyQuS1DaAko8Q";
var SELLER_FINANCE_LOI_TEMPLATE_PLACEHOLDER = "PASTE_FORMAL_SELLER_FINANCE_LOI_DOC_ID_HERE";

/**
 * Returns the user's selected Drive folder from the workbook setup cells,
 * falling back to saved onboarding values only when the cells are blank.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss Customer spreadsheet
 * @return {GoogleAppsScript.Drive.Folder} Google Drive folder
 */
function getLoiFolderForWorkbook_(ss) {
  var folderId = "";

  if (!folderId && ss) {
    var sheet = ss.getSheetByName("Cash") || ss.getSheetByName("Seller Financing") || ss.getSheetByName("Sub to");
    if (sheet) {
      var url = readSetupValue_(sheet, "loiFolder");
      if (url) {
        try {
          folderId = extractId(url);
        } catch {
          // Ignore malformed workbook folder values and try the saved fallbacks.
        }
      }
    }
  }

  if (!folderId) {
    try {
      if (typeof getUserFolderId === "function") {
        folderId = getUserFolderId();
      }
    } catch {
      // Ignore legacy folder lookup failures and try the current saved settings.
    }
  }

  if (!folderId) {
    try {
      if (typeof getSavedFolderSettingsForCurrentUser_ === "function") {
        folderId = getSavedFolderSettingsForCurrentUser_().loiFolderId;
      }
    } catch {
      // The final missing-folder error below is clearer for users.
    }
  }

  if (!folderId) {
    throw new Error("LOI PDF Folder is not configured. Please complete folder setup or onboarding first.");
  }

  try {
    return DriveApp.getFolderById(folderId);
  } catch {
    throw new Error("Unable to access the configured LOI folder. Confirm that you have permission and are logged in. Folder ID: " + folderId);
  }
}

/**
 * Returns the only Templates-sheet key allowed for LOI PDF generation.
 */
function getLoiTemplateKeyForOfferType_(offerType) {
  if (offerType === "Cash") return "LOI_Cash";
  if (offerType === "SellerFinance") return "LOI_SellerFinance";
  if (offerType === "SubTo") return "LOI_SubTo";
  throw new Error("Unsupported LOI offer type: " + offerType);
}

/**
 * Validates that the template contains all required tokens for the given type.
 * Throws an error if required tokens are missing, reporting exact missing groups.
 */
function validateLoiTemplateTokens_(type, templateContent) {
  var tokenGroups = {
    Cash: [
      ["Today's Date", "Today's Date"],
      ["The Buyers"],
      ["The Sellers"],
      ["PROPERTY ADDRESS", "Property Address"],
      ["Additional Description"],
      ["Property Type"],
      ["Purchase Price"],
      ["Type of Financing"],
      ["Earnest Money Deposit"]
    ],
    SellerFinance: [
      ["Today's Date", "Today's Date"],
      ["The Buyers"],
      ["The Sellers"],
      ["PROPERTY ADDRESS", "Property Address"],
      ["Additional Description"],
      ["Property Type"],
      ["Offer Price"],
      ["Down Payment"],
      ["Seller Financing amount"],
      ["Length of the Loan in Years (Balance due in full)", "Length of the Loan in Years"],
      ["Amortization terms"],
      ["Interest Rate"],
      ["Monthly Payment", "Approximate Monthly Payment", "Approximate Monthly payment"],
      ["Payment to the Agent"],
      ["Total Interest Made"],
      ["Closing Costs the seller DOESN'T PAY"],
      ["Total $ to Seller, including Savings on Fees/Commissions"]
    ],
    SubTo: [
      ["Today's Date", "Today's Date"],
      ["The Buyers"],
      ["The Sellers"],
      ["PROPERTY ADDRESS", "Property Address"],
      ["Additional Description"],
      ["Property Type"],
      ["Loan Balance", "Approximate Loan Balance"],
      ["Payment to the Seller"],
      ["Approximate Interest rate", "Approximate Interest Rate"],
      ["Approximate Monthly payment", "Approximate Monthly Payment"],
      ["Payment to the Agent"],
      ["Closing Costs"]
    ]
  };

  var groups = tokenGroups[type];
  if (!groups) {
    throw new Error("Unsupported LOI type: " + type);
  }

  var missingGroups = groups.filter(function(group) {
    return !group.some(function(alias) {
      var regex = new RegExp("\\{\\{\\s*" + alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\}\\}", "i");
      return regex.test(templateContent);
    });
  });

  var outreachOnlyTokens = ["{{FIRSTNAME}}", "{{YOUR NAME}}", "{{PHONE}}"];
  var detectedOutreachTokens = outreachOnlyTokens.filter(function(token) {
    var inner = token.replace(/\{\{|\}\}/g, "").trim();
    var regex = new RegExp("\\{\\{\\s*" + inner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\}\\}", "i");
    return regex.test(templateContent);
  });

  if (missingGroups.length > 0) {
    var missingTokens = missingGroups.map(function(group) {
      return "(" + group.join(" | ") + ")";
    });
    var errorMsg = "Template validation failed for type " + type + ". Missing required token groups: " + missingTokens.join(", ");
    if (detectedOutreachTokens.length > 0) {
      errorMsg += ". Detected outreach/email-only tokens: " + detectedOutreachTokens.join(", ") + ". This document may be an email outreach template, not a formal LOI Google Doc.";
    }
    throw new Error(errorMsg);
  }
}

/**
 * Reads the plain-text body of a Google Doc by ID. Returns a string.
 */
function readTemplateContentFromDoc_(docId) {
  assertLoiMasterTemplateConfigured_(docId);

  try {
    var doc = DocumentApp.openById(docId);
    return doc.getBody().getText();
  } catch (err) {
    throw new Error("Failed to open template document ID " + docId + ": " + err.message);
  }
}

function assertLoiMasterTemplateConfigured_(docId) {
  if (docId === SELLER_FINANCE_LOI_TEMPLATE_PLACEHOLDER) {
    throw new Error("Seller Finance LOI master document ID is not configured. Set SELLER_FINANCE_LOI_TEMPLATE_DOC_ID to the formal Seller Finance LOI Google Doc ID.");
  }
}

/**
 * Normalizes LOI_* template keys into one of three standard types.
 */
function getLoiTypeFromKey_(key) {
  var clean = String(key || "").trim();

  if (clean === "LOI_Cash") {
    return "Cash";
  }

  if (clean === "LOI_SellerFinance") {
    return "SellerFinance";
  }

  if (clean === "LOI_SubTo") {
    return "SubTo";
  }

  return null;
}

function getLoiTemplateConfig_(type) {
  if (type === "Cash") {
    return {
      key: getLoiTemplateKeyForOfferType_(type),
      masterId: CASH_LOI_TEMPLATE_DOC_ID,
      docName: "Cash Offer LOI Template",
      desc: "User-editable Cash LOI template Google Doc. Modify formatting and layout directly in Google Docs."
    };
  }

  if (type === "SellerFinance") {
    return {
      key: getLoiTemplateKeyForOfferType_(type),
      masterId: SELLER_FINANCE_LOI_TEMPLATE_DOC_ID,
      docName: "Seller Finance LOI Template",
      desc: "User-editable Seller Finance LOI template Google Doc. Modify formatting and layout directly in Google Docs."
    };
  }

  if (type === "SubTo") {
    return {
      key: getLoiTemplateKeyForOfferType_(type),
      masterId: SUBTO_LOI_TEMPLATE_DOC_ID,
      docName: "Sub To LOI Template",
      desc: "User-editable Subject To LOI template Google Doc. Modify formatting and layout directly in Google Docs."
    };
  }

  throw new Error("Invalid LOI type: " + type);
}

function isMasterLoiTemplateDocId_(docId) {
  var id = String(docId || "").trim();
  return id === CASH_LOI_TEMPLATE_DOC_ID ||
    id === SELLER_FINANCE_LOI_TEMPLATE_DOC_ID ||
    id === SUBTO_LOI_TEMPLATE_DOC_ID;
}

function getRequiredLoiTokensForOfferType_(type) {
  if (type === "SellerFinance") {
    return [
      "{{Today’s Date}}",
      "{{The Buyers}}",
      "{{The Sellers}}",
      "{{PROPERTY ADDRESS}}",
      "{{Additional Description}}",
      "{{Property Type}}",
      "{{Offer Price}}",
      "{{Down Payment}}",
      "{{Seller Financing amount}}",
      "{{Length of the Loan in Years (Balance due in full)}}",
      "{{Amortization terms}}",
      "{{Interest Rate}}",
      "{{Monthly Payment}}",
      "{{Payment to the Agent}}",
      "{{Total Interest Made}}",
      "{{Closing Costs the seller DOESN'T PAY}}",
      "{{Total $ to Seller, including Savings on Fees/Commissions}}"
    ];
  }

  if (type === "Cash") {
    return [
      "{{Today’s Date}}",
      "{{The Buyers}}",
      "{{The Sellers}}",
      "{{PROPERTY ADDRESS}}",
      "{{Purchase Price}}",
      "{{Type of Financing}}",
      "{{Earnest Money Deposit}}"
    ];
  }

  if (type === "SubTo") {
    return [
      "{{Today’s Date}}",
      "{{The Buyers}}",
      "{{The Sellers}}",
      "{{PROPERTY ADDRESS}}",
      "{{Loan Balance}}",
      "{{Payment to the Seller}}",
      "{{Approximate Interest rate}}",
      "{{Approximate Monthly payment}}",
      "{{Payment to the Agent}}",
      "{{Closing Costs}}"
    ];
  }

  throw new Error("Unsupported LOI offer type: " + type);
}

function isValidLoiTemplateDocForType_(docId, type) {
  if (!docId || isMasterLoiTemplateDocId_(docId)) {
    return false;
  }

  try {
    var doc = DocumentApp.openById(docId);
    var text = doc.getBody().getText();
    validateLoiTemplateTokens_(type, text);
    return true;
  } catch (err) {
    if (err.message && err.message.indexOf("Template validation failed") !== -1) {
      throw err;
    }
    return false;
  }
}

// Added strict validation to ensure only LOI_* keys are used for LOI generation
function validateLoiTemplateKey_(key) {
  if (!key.startsWith("LOI_")) {
    throw new Error("LOI_TEMPLATE_ROUTING_ERROR: Attempted to use non-LOI template key: " + key);
  }
}

/**
 * Automatically repairs and deduplicates LOI template rows in the Templates sheet.
 * Normalizes all legacy keys to standard keys: LOI_Cash, LOI_SellerFinance, LOI_SubTo.
 * Eliminates duplicate rows by keeping only the valid, openable document row if one exists.
 */
function repairAndDeduplicateLoiTemplates_(ss) {
  var sheet = ss.getSheetByName("Templates");
  if (!sheet) {
    sheet = ensureEmailTemplatesSheet_();
  }

  var range = sheet.getDataRange();
  var displayValues = range.getDisplayValues();

  var loiKeysCollected = {
    Cash: [],
    SellerFinance: [],
    SubTo: []
  };

  // Group existing rows by their normalized LOI type
  for (var i = 1; i < displayValues.length; i++) {
    var rawKey = String(displayValues[i][0]).trim();

    // Skip non-LOI_* rows (e.g., email/outreach templates)
    if (!rawKey.startsWith("LOI_")) {
      continue;
    }

    var loiType = getLoiTypeFromKey_(rawKey);

    if (loiType) {
      validateLoiTemplateKey_(rawKey); // Ensure only LOI_* keys are processed
      loiKeysCollected[loiType].push({
        rowNumber: i + 1,
        key: rawKey,
        name: String(displayValues[i][1] || ""),
        url: String(displayValues[i][4] || "").trim()
      });
    }
  }

  var types = ["Cash", "SellerFinance", "SubTo"];
  var rowsToDelete = [];
  var repairedUrls = {};

  types.forEach(function(type) {
    var cfg = getLoiTemplateConfig_(type);
    var key = cfg.key;
    var candidates = loiKeysCollected[type];
    var bestCandidate = null;

    // Find a valid user-owned copy. Master seed Doc IDs are not editable user templates.
    for (var c = 0; c < candidates.length; c++) {
      var candidate = candidates[c];
      if (candidate.url) {
        try {
          var docId = extractId(candidate.url);
          if (isValidLoiTemplateDocForType_(docId, type)) {
            bestCandidate = candidate;
            break;
          }
        } catch {
          // Document missing or inaccessible, skip as best candidate
        }
      }
    }

    if (bestCandidate) {
      repairedUrls[type] = bestCandidate.url;

      var rowNum = bestCandidate.rowNumber;
      sheet.getRange(rowNum, 1, 1, 4).setValues([[key, cfg.docName, cfg.desc, "LOI"]]);
      if (bestCandidate.url) {
        sheet.getRange(rowNum, 5).setValue(bestCandidate.url);
      }

      // Mark all other duplicate rows of this type for deletion
      candidates.forEach(function(cand) {
        if (cand.rowNumber !== bestCandidate.rowNumber) {
          rowsToDelete.push(cand.rowNumber);
        }
      });
    } else {
      candidates.forEach(function(cand) {
        rowsToDelete.push(cand.rowNumber);
      });
    }
  });

  // Delete duplicates in reverse order to keep row numbers correct
  rowsToDelete.sort(function(a, b) { return b - a; });
  rowsToDelete.forEach(function(rowNum) {
    try {
      sheet.deleteRow(rowNum);
    } catch (e) {
      console.error("repairAndDeduplicateLoiTemplates_: Failed to delete row " + rowNum + ": " + e.message);
    }
  });

  SpreadsheetApp.flush();
  return repairedUrls;
}

/**
 * Ensures all three LOI templates exist in the "Deal Cannon LOI Templates" folder
 * and are recorded in the customer workbook Templates tab.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss Customer spreadsheet
 * @param {GoogleAppsScript.Drive.Folder} folder User's parent LOI folder
 */
function ensureUserLoiTemplates_(ss, folder) {
  var repairedUrls = repairAndDeduplicateLoiTemplates_(ss, folder);
  var types = ["Cash", "SellerFinance", "SubTo"];

  types.forEach(function(type) {
    try {
      var url = repairedUrls[type] || "";
      var docId = "";
      if (url) {
        try {
          docId = extractId(url);
        } catch {
          // Invalid saved URLs are treated as missing and reseeded below.
        }
      }

      var docValid = false;
      if (docId) {
        try {
          docValid = isValidLoiTemplateDocForType_(docId, type);
        } catch {
          // missing, inaccessible, or wrong template doc
        }
      }

      if (!docValid) {
        seedUserLoiTemplateCopy_(ss, type, folder);
      }
    } catch (e) {
      console.error("ensureUserLoiTemplates_: Failed for type " + type + ": " + e.message);
    }
  });
}

/**
 * Gets or seeds a user's copied Google Doc LOI template for the given offer type.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss Customer spreadsheet
 * @param {String} type Offer type (Cash, SellerFinance, SubTo)
 * @param {GoogleAppsScript.Drive.Folder} folder User's parent LOI folder
 * @return {GoogleAppsScript.Document.Document} Copied Google Doc template
 */
function getUserLoiTemplateForType_(ss, type, folder) {
  var key = getLoiTemplateKeyForOfferType_(type);
  var sheet = ss.getSheetByName("Templates");
  if (!sheet) {
    sheet = ensureEmailTemplatesSheet_();
  }

  // Pre-normalize, repair, and seed missing templates
  ensureUserLoiTemplates_(ss, folder);

  var values = sheet.getDataRange().getDisplayValues();
  var docUrl = "";

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) {
      docUrl = String(values[i][4] || "").trim();
      break;
    }
  }

  var docId;
  if (docUrl) {
    try {
      docId = extractId(docUrl);
      if (!isValidLoiTemplateDocForType_(docId, type)) {
        throw new Error("The " + key + " Google Doc is not a valid formal LOI template for " + type + ". It will be reseeded by the repair flow.");
      }
      var tempDoc = DocumentApp.openById(docId);
      tempDoc.getName();
      return tempDoc;
    } catch (err) {
      console.warn("getUserLoiTemplateForType_: Reseeding " + key + " because the saved Google Doc is invalid or inaccessible. " + (err.message || String(err)));
    }
  }

  try {
    docId = seedUserLoiTemplateCopy_(ss, type, folder);
  } catch (seedErr) {
    throw new Error("Could not seed a valid formal " + type + " LOI template for key " + key + ". " + seedErr.message);
  }

  if (!isValidLoiTemplateDocForType_(docId, type)) {
    throw new Error("Could not seed a valid formal " + type + " LOI template for key " + key + ". Check the Core master template document (ID: " + getLoiTemplateConfig_(type).masterId + ").");
  }

  var seededDoc = DocumentApp.openById(docId);
  seededDoc.getName();
  return seededDoc;
}

/**
 * Seeds a new copy of a master LOI Google Doc into the user's "Deal Cannon LOI Templates" folder.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss Customer spreadsheet
 * @param {String} type Offer type (Cash, SellerFinance, SubTo)
 * @param {GoogleAppsScript.Drive.Folder} folder User's parent LOI folder
 * @return {String} File ID of the newly copied user LOI template doc
 */
function seedUserLoiTemplateCopy_(ss, type, folder) {
  var cfg = getLoiTemplateConfig_(type);
  var masterId = cfg.masterId;
  var docName = cfg.docName;
  var key = cfg.key;

  assertLoiMasterTemplateConfigured_(masterId);

  // Retrieve or create Deal Cannon LOI Templates subfolder
  var subfolder;
  var folders = folder.getFoldersByName("Deal Cannon LOI Templates");
  if (folders.hasNext()) {
    subfolder = folders.next();
  } else {
    subfolder = folder.createFolder("Deal Cannon LOI Templates");
  }

  // Copy the master doc file
  var masterFile = DriveApp.getFileById(masterId);
  var copiedFile = masterFile.makeCopy(docName, subfolder);
  var copiedId = copiedFile.getId();
  var copiedUrl = "https://docs.google.com/document/d/" + copiedId + "/edit";

  var copiedDoc = DocumentApp.openById(copiedId);
  var copiedText = copiedDoc.getBody().getText();

  try {
    validateLoiTemplateTokens_(type, copiedText);
  } catch (err) {
    var detailMsg = "LOI template seeding failed. Doc ID: " + copiedId + ", Template Key: " + key + ", Offer Type: " + type + ". " + err.message;
    throw new Error(detailMsg);
  }

  // Attempt to extract tokens from the document
  var tokensStr = "";
  try {
    var tokensList = extractTokensFromTemplateText_(copiedText);
    tokensStr = tokensList.join(", ");
  } catch (e) {
    console.warn("seedUserLoiTemplateCopy_: Could not extract tokens from doc: " + e.message);
  }

  var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  var sheet = ss.getSheetByName("Templates");
  if (!sheet) {
    sheet = ensureEmailTemplatesSheet_();
  }

  var values = sheet.getDataRange().getDisplayValues();
  var rowNumber = -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) {
      rowNumber = i + 1;
      break;
    }
  }

  if (rowNumber === -1) {
    sheet.appendRow([key, docName, cfg.desc, "LOI", copiedUrl, tokensStr, nowStr]);
  } else {
    sheet.getRange(rowNumber, 1, 1, 7).setValues([[key, docName, cfg.desc, "LOI", copiedUrl, tokensStr, nowStr]]);
  }

  SpreadsheetApp.flush();
  return copiedId;
}

/**
 * Replaces bracketed tokens inside a Google Doc (including body, header, and footer sections).
 *
 * @param {GoogleAppsScript.Document.Document} doc Document to modify
 * @param {Object} tokenMap Variable mapping from Token Registry
 */
function replaceDocTokensFromTokenMap_(doc, tokenMap) {
  var sortedTokens = Object.keys(tokenMap || {}).sort(function(a, b) {
    return b.length - a.length;
  });

  var sections = [doc.getBody()];

  try {
    var header = doc.getHeader();
    if (header) sections.push(header);
  } catch {
    // Some Google Docs do not expose a header section.
  }

  try {
    var footer = doc.getFooter();
    if (footer) sections.push(footer);
  } catch {
    // Some Google Docs do not expose a footer section.
  }

  sections.forEach(function(section) {
    sortedTokens.forEach(function(token) {
      var val = tokenMap[token];
      if (val === undefined || val === null) {
        val = "";
      }
      var escapedToken = token.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      section.replaceText(escapedToken, String(val));
    });
  });
}

/**
 * Builds an LOI PDF from the user's editable Google Doc template.
 *
 * @param {String} type Offer type (Cash, SellerFinance, SubTo)
 * @param {Object} payload Inputs from UI/triggers
 * @param {Object} loiData Stored LOI fields
 * @param {Object} computed Amortization results
 * @param {GoogleAppsScript.Drive.Folder} folder Destination LOI folder
 * @return {Object} File identifiers and URLs
 */
function buildLoiFromUserTemplate_(type, payload, loiData, computed, folder) {
  var ss = getCustomerWorkbook_();
  var userTemplateDoc = getUserLoiTemplateForType_(ss, type, folder);
  var userTemplateFile = DriveApp.getFileById(userTemplateDoc.getId());

  var propertyAddress = String(payload.propertyAddress || payload.address || loiData.propertyAddress || "Property").trim();
  var safeProperty = dcCoreSafeFilePart_(propertyAddress);
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
  var finalDocName = type + " LOI - " + safeProperty + " - " + timestamp;

  // 1. Copy the user's custom template
  var newLoiFile = userTemplateFile.makeCopy(finalDocName, folder);
  var newLoiId = newLoiFile.getId();
  var newLoiDoc = DocumentApp.openById(newLoiId);

  // 2. Build complete token map using the registry
  var offerDate = payload.date || loiData.todaysDate || "";
  var tokenMap = buildTokenMapForPayload_(payload, loiData, computed, offerDate, type);

  // 3. Perform string replacements in copy
  replaceDocTokensFromTokenMap_(newLoiDoc, tokenMap);
  newLoiDoc.saveAndClose();
  Utilities.sleep(1500);

  // 4. Export the refreshed Google Doc as PDF after Drive has committed changes
  var refreshedLoiFile = DriveApp.getFileById(newLoiId);
  var pdfBlob = refreshedLoiFile.getAs(MimeType.PDF);
  pdfBlob.setName(finalDocName + ".pdf");
  var pdfFile = folder.createFile(pdfBlob);

  return {
    docId: newLoiId,
    docUrl: "https://docs.google.com/document/d/" + newLoiId + "/edit",
    pdfId: pdfFile.getId(),
    pdfUrl: pdfFile.getUrl(),
    pdfFile: pdfFile
  };
}

/**
 * Diagnostics/auditing routine for the LOI template seeding system.
 *
 * @return {Object} Diagnostic report data
 */
function debugLoiTemplateSetup() {
  var result = {
    effectiveUserEmail: "",
    customerWorkbookId: "",
    selectedLoiFolderUrl: "",
    selectedLoiFolderId: "",
    folderOpensSuccessfully: false,
    subfolderExistsBefore: false,
    repairAttempted: true,
    subfolderExistsAfter: false,
    rowsBefore: [],
    rowsAfter: [],
    copiedTemplatesCreated: 0,
    copiedTemplatesSkipped: 0,
    finalLoiTemplates: {},
    errors: []
  };

  try {
    result.effectiveUserEmail = Session.getEffectiveUser().getEmail();
  } catch (e) {
    result.errors.push("Failed to get effective user email: " + e.message);
  }

  var ss = null;
  try {
    ss = getEmailTemplatesWorkbook_();
    result.customerWorkbookId = ss.getId();
  } catch (e) {
    result.errors.push("Failed to open customer workbook: " + e.message);
  }

  var folder = null;
  try {
    var folderUrl = "";
    if (ss) {
      var sheet = ss.getSheetByName("Cash") || ss.getSheetByName("Seller Financing") || ss.getSheetByName("Sub to");
      if (sheet) {
        folderUrl = readSetupValue_(sheet, "loiFolder");
      }
    }
    if (!folderUrl) {
      folderUrl = getLoiFolderUrlForCurrentUser_();
    }
    result.selectedLoiFolderUrl = folderUrl;
    if (folderUrl) {
      var folderId = extractId(folderUrl);
      result.selectedLoiFolderId = folderId;
      folder = DriveApp.getFolderById(folderId);
      folder.getName();
      result.folderOpensSuccessfully = true;
    }
  } catch (e) {
    result.errors.push("Failed to open selected LOI folder: " + e.message);
  }

  if (folder) {
    try {
      var foldersBefore = folder.getFoldersByName("Deal Cannon LOI Templates");
      if (foldersBefore.hasNext()) {
        result.subfolderExistsBefore = true;
      }
    } catch (e) {
      result.errors.push("Failed to check LOI Templates subfolder before repair: " + e.message);
    }
  }

  if (ss) {
    try {
      var templateSheetBefore = ss.getSheetByName("Templates");
      if (templateSheetBefore) {
        var templateValuesBefore = templateSheetBefore.getDataRange().getDisplayValues();
        for (var beforeIndex = 1; beforeIndex < templateValuesBefore.length; beforeIndex++) {
          var beforeKey = String(templateValuesBefore[beforeIndex][0]).trim();
          if (beforeKey.indexOf("LOI_") === 0) {
            result.rowsBefore.push(beforeKey);
          }
        }
      }
    } catch (e) {
      result.errors.push("Failed to read Templates rows before repair: " + e.message);
    }
  }

  // Calculate created vs skipped before we run repair
  if (ss && folder) {
    try {
      var types = ["Cash", "SellerFinance", "SubTo"];
      var templateSheetForCounts = ss.getSheetByName("Templates");
      var templateValuesForCounts = templateSheetForCounts ? templateSheetForCounts.getDataRange().getDisplayValues() : [];

      // Pre-load existing valid LOI rows
      var validTypesMap = {};
      for (var countIndex = 1; countIndex < templateValuesForCounts.length; countIndex++) {
        var rawKey = String(templateValuesForCounts[countIndex][0]).trim();
        var url = String(templateValuesForCounts[countIndex][4] || "").trim();
        var loiType = getLoiTypeFromKey_(rawKey);
        if (loiType && url) {
          try {
            var candidateDocId = extractId(url);
            if (isValidLoiTemplateDocForType_(candidateDocId, loiType)) {
              validTypesMap[loiType] = true;
            }
          } catch {
            // Invalid or inaccessible saved template docs count as needing creation.
          }
        }
      }

      types.forEach(function(t) {
        if (validTypesMap[t]) {
          result.copiedTemplatesSkipped++;
        } else {
          result.copiedTemplatesCreated++;
        }
      });
    } catch (e) {
      result.errors.push("Failed to calculate created/skipped states: " + e.message);
    }
  }

  // Run the ensure/repair path!
  if (ss && folder) {
    try {
      ensureUserLoiTemplates_(ss, folder);
    } catch (e) {
      result.errors.push("ensureUserLoiTemplates_ failed: " + e.message);
    }
  }

  if (folder) {
    try {
      var foldersAfter = folder.getFoldersByName("Deal Cannon LOI Templates");
      if (foldersAfter.hasNext()) {
        result.subfolderExistsAfter = true;
      }
    } catch (e) {
      result.errors.push("Failed to check LOI Templates subfolder after repair: " + e.message);
    }
  }

  if (ss) {
    try {
      var templateSheetAfter = ss.getSheetByName("Templates");
      if (templateSheetAfter) {
        var templateValuesAfter = templateSheetAfter.getDataRange().getDisplayValues();
        for (var afterIndex = 1; afterIndex < templateValuesAfter.length; afterIndex++) {
          var afterKey = String(templateValuesAfter[afterIndex][0]).trim();
          if (afterKey.indexOf("LOI_") === 0) {
            result.rowsAfter.push(afterKey);

            // Collect final prefix-free clean LOI template URLs
            if (templateValuesAfter[afterIndex][4]) {
              var keyPart = afterKey.indexOf("LOI_") === 0 ? afterKey.substring(4) : afterKey;
              var normalizedPart = normalizeTemplateKey_(keyPart);
              if (normalizedPart) {
                result.finalLoiTemplates[normalizedPart] = String(templateValuesAfter[afterIndex][4]).trim();
              }
            }
          }
        }
      }
    } catch (e) {
      result.errors.push("Failed to read Templates rows after repair: " + e.message);
    }
  }

  console.log("=== debugLoiTemplateSetup RESULT ===");
  console.log(JSON.stringify(result, null, 2));
  return result;
}
