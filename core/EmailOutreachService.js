/**************************************
 * Deal Cannon Core - EmailOutreachService
 * Manual Initial Outreach flow.
 **************************************/

var EMAIL_OUTREACH_RAW_DATA_SHEET = "Raw Data";
var EMAIL_OUTREACH_CLEANER_SHEET = "Cleaner";
var EMAIL_OUTREACH_READY_SHEET = "Ready to Email";
var EMAIL_OUTREACH_SCHEDULED_SHEET = "Scheduled Emails";
var EMAIL_OUTREACH_DNC_SHEET = "DNC List";
var EMAIL_OUTREACH_DNC_SHEET_ALT = "DNC";
var EMAIL_OUTREACH_EMAIL_SENT_SHEET = "Email Sent";
var EMAIL_OUTREACH_EMAIL_SENT_SHEET_ALT = "Emails Sent";
var EMAIL_OUTREACH_ARCHIVE_SHEET = "Archive";
var EMAIL_OUTREACH_PROVIDER_DEAL_CANNON = "deal-cannon";
var EMAIL_OUTREACH_PROVIDER_BREVO = "brevo";
var EMAIL_OUTREACH_LEAD_STATUS_INDEX = 4;
var EMAIL_OUTREACH_LEAD_ID_INDEX = 5;
var EMAIL_OUTREACH_LEAD_COLUMN_COUNT = 6;
var EMAIL_OUTREACH_SCHEDULED_OFFER_TYPE_COLUMN = 7;
var EMAIL_OUTREACH_SCHEDULED_BATCH_LIMIT = 100;
var EMAIL_OUTREACH_STANDARD_HEADERS = [["Name", "Email", "Property Address", "List Price", "Status", "Lead ID"]];

/* =========================
   SHEET HELPERS
========================== */

function emailOutreachGetRawDataSheet_(ss) {
  return ss.getSheetByName(EMAIL_OUTREACH_RAW_DATA_SHEET);
}

function emailOutreachGetOrCreateRawDataSheet_(ss) {
  var sheet = emailOutreachGetRawDataSheet_(ss);
  if (!sheet) {
    sheet = ss.insertSheet(EMAIL_OUTREACH_RAW_DATA_SHEET);
  }
  return sheet;
}

function emailOutreachGetReadySheet_(ss) {
  var sheet = ss.getSheetByName(EMAIL_OUTREACH_READY_SHEET);
  if (sheet) {
    emailOutreachEnsureLeadSheetSchema_(sheet);
  }
  return sheet;
}

function emailOutreachGetOrCreateReadySheet_(ss) {
  var sheet = emailOutreachGetReadySheet_(ss);
  if (!sheet) {
    sheet = ss.insertSheet(EMAIL_OUTREACH_READY_SHEET);
  }
  emailOutreachEnsureLeadSheetSchema_(sheet);
  return sheet;
}

function emailOutreachGetScheduledSheet_(ss) {
  var sheet = ss.getSheetByName(EMAIL_OUTREACH_SCHEDULED_SHEET);
  if (sheet) {
    emailOutreachEnsureScheduledSheetSchema_(sheet);
  }
  return sheet;
}

function emailOutreachGetOrCreateScheduledSheet_(ss) {
  var sheet = emailOutreachGetScheduledSheet_(ss);
  if (!sheet) {
    sheet = ss.insertSheet(EMAIL_OUTREACH_SCHEDULED_SHEET);
  }
  emailOutreachEnsureScheduledSheetSchema_(sheet);
  return sheet;
}

function emailOutreachGetDncSheet_(ss) {
  return ss.getSheetByName(EMAIL_OUTREACH_DNC_SHEET) || ss.getSheetByName(EMAIL_OUTREACH_DNC_SHEET_ALT);
}

function emailOutreachGetOrCreateDncSheet_(ss) {
  var sheet = emailOutreachGetDncSheet_(ss);
  if (!sheet) {
    sheet = ss.insertSheet(EMAIL_OUTREACH_DNC_SHEET);
    sheet.getRange(1, 1, 1, 2).setValues([["Email", "Status"]]);
  }
  return sheet;
}

function emailOutreachGetEmailSentSheet_(ss) {
  var sheet = ss.getSheetByName(EMAIL_OUTREACH_EMAIL_SENT_SHEET) || ss.getSheetByName(EMAIL_OUTREACH_EMAIL_SENT_SHEET_ALT);
  if (sheet) {
    emailOutreachEnsureLeadSheetSchema_(sheet);
  }
  return sheet;
}

function emailOutreachGetOrCreateEmailSentSheet_(ss) {
  var sheet = emailOutreachGetEmailSentSheet_(ss);
  if (!sheet) {
    sheet = ss.insertSheet(EMAIL_OUTREACH_EMAIL_SENT_SHEET);
  }
  emailOutreachEnsureLeadSheetSchema_(sheet);
  return sheet;
}

function emailOutreachGetArchiveSheet_(ss) {
  var sheet = ss.getSheetByName(EMAIL_OUTREACH_ARCHIVE_SHEET);
  if (sheet) {
    emailOutreachEnsureLeadSheetSchema_(sheet);
  }
  return sheet;
}

function emailOutreachGetOrCreateArchiveSheet_(ss) {
  var sheet = emailOutreachGetArchiveSheet_(ss);
  if (!sheet) {
    sheet = ss.insertSheet(EMAIL_OUTREACH_ARCHIVE_SHEET);
  }
  emailOutreachEnsureLeadSheetSchema_(sheet);
  return sheet;
}

function emailOutreachGetOrCreateSheet_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function emailOutreachEnsureSheetSize_(sheet, requiredRows, requiredColumns) {
  requiredRows = Math.max(1, Number(requiredRows || 1));
  requiredColumns = Math.max(1, Number(requiredColumns || 1));

  if (sheet.getMaxRows() < requiredRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  }

  if (sheet.getMaxColumns() < requiredColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
  }
}

function emailOutreachCell_(row, oneBasedColumnIndex) {
  var index = Number(oneBasedColumnIndex || 1) - 1;
  return index >= 0 && index < row.length ? row[index] : "";
}

function emailOutreachBuildLeadId_() {
  return "lead_" + Utilities.getUuid().replace(/-/g, "");
}

function emailOutreachNormalizeLeadStatus_(status, fallback) {
  var value = String(status || "").trim().toUpperCase();
  return value || String(fallback || "NEW").trim().toUpperCase() || "NEW";
}

function emailOutreachNormalizeLeadRowValues_(row, fallbackStatus) {
  row = row || [];

  return [
    String(row[0] || "").trim(),
    String(row[1] || "").trim().toLowerCase(),
    String(row[2] || "").trim(),
    String(row[3] || "").trim(),
    emailOutreachNormalizeLeadStatus_(row[EMAIL_OUTREACH_LEAD_STATUS_INDEX], fallbackStatus),
    String(row[EMAIL_OUTREACH_LEAD_ID_INDEX] || "").trim() || emailOutreachBuildLeadId_()
  ];
}

function emailOutreachEnsureLeadSheetSchema_(sheet) {
  if (!sheet) {
    return null;
  }

  emailOutreachEnsureSheetSize_(sheet, Math.max(1, sheet.getLastRow()), EMAIL_OUTREACH_LEAD_COLUMN_COUNT);
  sheet.getRange(1, 1, 1, EMAIL_OUTREACH_LEAD_COLUMN_COUNT).setValues(EMAIL_OUTREACH_STANDARD_HEADERS);

  if (sheet.getLastRow() <= 1) {
    return sheet;
  }

  var leadIdRange = sheet.getRange(2, EMAIL_OUTREACH_LEAD_ID_INDEX + 1, sheet.getLastRow() - 1, 1);
  var leadIdValues = leadIdRange.getValues();
  var changed = false;

  for (var i = 0; i < leadIdValues.length; i++) {
    if (!String(leadIdValues[i][0] || "").trim()) {
      leadIdValues[i][0] = emailOutreachBuildLeadId_();
      changed = true;
    }
  }

  if (changed) {
    leadIdRange.setValues(leadIdValues);
  }

  return sheet;
}

function emailOutreachEnsureScheduledSheetSchema_(sheet) {
  if (!sheet) {
    return null;
  }

  emailOutreachEnsureLeadSheetSchema_(sheet);
  emailOutreachEnsureSheetSize_(sheet, Math.max(1, sheet.getLastRow()), EMAIL_OUTREACH_SCHEDULED_OFFER_TYPE_COLUMN);
  sheet.getRange(1, EMAIL_OUTREACH_SCHEDULED_OFFER_TYPE_COLUMN).setValue('Offer Type');

  return sheet;
}

function emailOutreachNormalizeLeadKeyPart_(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function emailOutreachBuildLeadKey_(lead) {
  lead = lead || {};

  var email = emailOutreachNormalizeLeadKeyPart_(lead.email);
  if (!email) {
    return "";
  }

  return email + "|" + emailOutreachNormalizeLeadKeyPart_(lead.propertyAddress);
}

function emailOutreachReadLeadRowsFromSheet_(sheet) {
  var leads = [];
  if (!sheet || sheet.getLastRow() <= 1) {
    return leads;
  }

  emailOutreachEnsureLeadSheetSchema_(sheet);

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), EMAIL_OUTREACH_LEAD_COLUMN_COUNT)).getValues();

  for (var i = 0; i < values.length; i++) {
    var row = emailOutreachNormalizeLeadRowValues_(values[i], "NEW");
    leads.push({
      rowNumber: i + 2,
      name: row[0],
      email: row[1],
      propertyAddress: row[2],
      listPrice: row[3],
      status: row[4],
      leadId: row[5]
    });
  }

  return leads;
}

function emailOutreachBuildLeadKeyMap_(leads) {
  var map = {};
  leads = leads || [];

  for (var i = 0; i < leads.length; i++) {
    var key = emailOutreachBuildLeadKey_(leads[i]);
    if (key) {
      map[key] = true;
    }
  }

  return map;
}

function emailOutreachBuildLeadIdMap_(leads) {
  var map = {};
  leads = leads || [];

  for (var i = 0; i < leads.length; i++) {
    var leadId = String(leads[i] && leads[i].leadId || '').trim();
    if (leadId) {
      map[leadId] = true;
    }
  }

  return map;
}

function emailOutreachShouldSkipReadyLeadStatus_(status) {
  var value = String(status || "").trim().toUpperCase();
  return value === "DNC" || value === "INVALID" || value === "DELETED";
}

function emailOutreachShouldSkipRawLeadStatus_(status) {
  var value = String(status || "").trim().toUpperCase();
  return value === "SENT" || value === "DRAFTED" || value === "ARCHIVED" || value === "DELETED" || value === "DNC" || value === "INVALID";
}

/* =========================
   DASHBOARD STATE
========================== */

function getEmailDashboardState() {
  try {
    requireApprovedUser_();
    var ss = getCustomerWorkbook_();
    var rawSheet = emailOutreachGetRawDataSheet_(ss);
    var readySheet = emailOutreachGetReadySheet_(ss);

    var rawLeadCount = rawSheet ? Math.max(0, rawSheet.getLastRow() - 1) : 0;
    var leads = emailOutreachReadReadyLeads_(readySheet);

    return {
      success: true,
      rawLeadCount: rawLeadCount,
      readyLeadCount: leads.length,
      hasReadyData: leads.length > 0,
      leads: leads,
      sourceTab: leads.length > 0 ? EMAIL_OUTREACH_READY_SHEET : ""
    };
  } catch (err) {
    return buildFailure("DASHBOARD_STATE_ERROR", err.message || String(err));
  }
}

function getDashboardBootstrapState() {
  try {
    var ctx = openCustomerSpreadsheet_();
    var ss = ctx.ss;
    var rawSheet = emailOutreachGetRawDataSheet_(ss);
    var readySheet = emailOutreachGetReadySheet_(ss);
    var leads = emailOutreachReadReadyLeads_(readySheet);
    var outreachInfo = emailOutreachGetSavedOutreachInfo_(ss);

    return {
      success: true,
      account: {
        email: ctx.user && ctx.user.email ? ctx.user.email : '',
        fullName: ctx.user && ctx.user.fullName ? ctx.user.fullName : ''
      },
      dashboard: {
        success: true,
        rawLeadCount: rawSheet ? Math.max(0, rawSheet.getLastRow() - 1) : 0,
        readyLeadCount: leads.length,
        hasReadyData: leads.length > 0,
        leads: leads,
        sourceTab: leads.length > 0 ? EMAIL_OUTREACH_READY_SHEET : ''
      },
      outreach: {
        success: true,
        data: outreachInfo
      }
    };
  } catch (err) {
    return buildFailure('DASHBOARD_BOOTSTRAP_ERROR', err.message || String(err));
  }
}

function getEmailUploadRuntimeVersion() {
  return {
    success: true,
    version: "V8",
    runtime: "APPS_SCRIPT_V8"
  };
}

function getRawDataUploadState() {
  try {
    requireApprovedUser_();
    var ss = getCustomerWorkbook_();
    var sheet = emailOutreachGetRawDataSheet_(ss);
    var leadCount = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;

    return {
      success: true,
      leadCount: leadCount,
      rawLeadCount: leadCount
    };
  } catch (err) {
    return buildFailure("RAW_DATA_STATE_ERROR", err.message || String(err));
  }
}

function emailOutreachReadReadyLeads_(sheet) {
  var allLeads = emailOutreachReadLeadRowsFromSheet_(sheet);
  var leads = [];

  for (var i = 0; i < allLeads.length; i++) {
    if (emailOutreachShouldSkipReadyLeadStatus_(allLeads[i].status)) {
      continue;
    }
    leads.push(allLeads[i]);
  }

  return leads;
}

function emailOutreachBuildReadyLeadsFromRows_(readyRows) {
  var leads = [];

  for (var i = 0; i < (readyRows || []).length; i++) {
    var row = emailOutreachNormalizeLeadRowValues_(readyRows[i], "NEW");
    var status = row[EMAIL_OUTREACH_LEAD_STATUS_INDEX];

    if (emailOutreachShouldSkipReadyLeadStatus_(status)) {
      continue;
    }

    leads.push({
      rowNumber: i + 2,
      name: row[0],
      email: row[1],
      propertyAddress: row[2],
      listPrice: row[3],
      status: status,
      leadId: row[EMAIL_OUTREACH_LEAD_ID_INDEX]
    });
  }

  return leads;
}

/* =========================
   CSV UPLOAD
========================== */

function dcUploadLeadsCsvV2(fileObject) {
  try {
    requireApprovedUser_();

    if (!fileObject || (!fileObject.bytesBase64 && !fileObject.content)) {
      throw new Error("No file data was received.");
    }

    var ss = getCustomerWorkbook_();
    var rawSheet = emailOutreachGetOrCreateRawDataSheet_(ss);

    var csvText = "";
    if (fileObject.bytesBase64) {
      csvText = Utilities.newBlob(
        Utilities.base64Decode(String(fileObject.bytesBase64)),
        fileObject.mimeType || "text/csv",
        fileObject.fileName || "upload.csv"
      ).getDataAsString("UTF-8");
    } else {
      csvText = String(fileObject.content || "");
    }

    if (csvText && csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1);
    }

    var rows = Utilities.parseCsv(csvText);
    if (!rows || !rows.length) {
      throw new Error("The CSV appears to be empty.");
    }

    rows = emailOutreachNormalizeRowLengths_(rows);
    var existingLastRow = rawSheet.getLastRow();
    var appendedLeadCount = Math.max(0, rows.length - 1);

    if (existingLastRow < 1) {
      emailOutreachEnsureSheetSize_(rawSheet, rows.length, rows[0].length);
      rawSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    } else {
      var existingHeader = rawSheet.getRange(1, 1, 1, Math.max(rawSheet.getLastColumn(), 1)).getValues()[0];
      if (!emailOutreachHeadersMatch_(existingHeader, rows[0])) {
        throw new Error("This CSV does not match the existing Raw Data columns. Use the same export format for each upload in this workbook.");
      }

      var rowsToAppend = emailOutreachNormalizeRowsToColumnCount_(rows.slice(1), Math.max(rawSheet.getLastColumn(), rows[0].length));
      appendedLeadCount = rowsToAppend.length;

      if (rowsToAppend.length) {
        emailOutreachEnsureSheetSize_(rawSheet, existingLastRow + rowsToAppend.length, rowsToAppend[0].length);
        rawSheet.getRange(existingLastRow + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
      }
    }

    var priorRawLeadCount = Math.max(0, existingLastRow - 1);
    var rawLeadCount = existingLastRow < 1
      ? appendedLeadCount
      : priorRawLeadCount + appendedLeadCount;
    var rowCount = rawLeadCount + 1;

    return {
      success: true,
      message: existingLastRow < 1
        ? "Uploaded " + appendedLeadCount + " lead(s) to Raw Data."
        : "Added " + appendedLeadCount + " lead(s) to Raw Data. Existing dashboard leads were kept in place until you run Clean the Data.",
      sheetName: rawSheet.getName(),
      rowCount: rowCount,
      columnCount: rows[0].length,
      leadCount: appendedLeadCount,
      rawLeadCount: rawLeadCount,
      fileName: fileObject.fileName || ""
    };
  } catch (err) {
    return buildFailure("CSV_UPLOAD_ERROR", err.message || String(err));
  }
}

function emailOutreachNormalizeRowLengths_(rows) {
  var maxColumns = 0;
  for (var i = 0; i < rows.length; i++) {
    maxColumns = Math.max(maxColumns, rows[i].length);
  }

  return rows.map(function(row) {
    var copy = row.slice();
    while (copy.length < maxColumns) {
      copy.push("");
    }
    return copy;
  });
}

function emailOutreachNormalizeRowsToColumnCount_(rows, columnCount) {
  columnCount = Math.max(1, Number(columnCount || 1));

  return (rows || []).map(function(row) {
    var copy = (row || []).slice(0, columnCount);
    while (copy.length < columnCount) {
      copy.push("");
    }
    return copy;
  });
}

function emailOutreachNormalizeHeaderRow_(headers) {
  var normalized = (headers || []).map(function(header) {
    return emailOutreachNormalizeHeader_(header);
  });

  while (normalized.length && !normalized[normalized.length - 1]) {
    normalized.pop();
  }

  return normalized;
}

function emailOutreachHeadersMatch_(existingHeaders, incomingHeaders) {
  var existing = emailOutreachNormalizeHeaderRow_(existingHeaders);
  var incoming = emailOutreachNormalizeHeaderRow_(incomingHeaders);

  if (existing.length !== incoming.length) {
    return false;
  }

  for (var i = 0; i < existing.length; i++) {
    if (existing[i] !== incoming[i]) {
      return false;
    }
  }

  return true;
}

/* =========================
   CLEAN DATA
========================== */

function runEmailCleanFlow(providerType) {
  try {
    requireApprovedUser_();
    var ss = getCustomerWorkbook_();
    var rawSheet = emailOutreachGetRawDataSheet_(ss);

    if (!rawSheet || rawSheet.getLastRow() < 1 || rawSheet.getLastColumn() < 1) {
      return buildFailure("NO_RAW_DATA", "No data in Raw Data tab to clean.");
    }

    var lastRow = rawSheet.getLastRow();
    var lastColumn = rawSheet.getLastColumn();
    var rawValues = rawSheet.getRange(1, 1, lastRow, lastColumn).getValues();
    var provider = emailOutreachNormalizeProvider_(providerType);
    var cleanerResult = provider === EMAIL_OUTREACH_PROVIDER_BREVO
      ? emailOutreachRunBrevoCleaner_(ss, rawValues)
      : emailOutreachRunDealCannonCleaner_(ss, rawValues);

    var dncEmails = emailOutreachLoadDncEmailMap_(ss);
    var readyResult = emailOutreachBuildReadyToEmail_(ss, rawValues, dncEmails);

    return {
      success: true,
      message: "Cleaned " + readyResult.readyLeadCount + " lead(s). Removed " + readyResult.dncRemovedCount + " DNC, skipped " + readyResult.skippedInvalidCount + " invalid.",
      providerType: provider,
      outputSheetName: cleanerResult.outputSheetName,
      rawLeadCount: Math.max(0, rawValues.length - 1),
      cleanerLeadCount: cleanerResult.rowCount,
      cleanedLeadCount: readyResult.readyLeadCount,
      readyLeadCount: readyResult.readyLeadCount,
      dncRemovedCount: readyResult.dncRemovedCount,
      skippedDncCount: readyResult.dncRemovedCount,
      skippedInvalidCount: readyResult.skippedInvalidCount,
      leads: readyResult.leads
    };
  } catch (err) {
    return buildFailure("CLEAN_FLOW_ERROR", err.message || String(err));
  }
}

function emailOutreachRunDealCannonCleaner_(ss, rawValues) {
  var sheet = emailOutreachGetOrCreateSheet_(ss, EMAIL_OUTREACH_CLEANER_SHEET);
  var outputRows = rawValues.map(function(row) {
    var output = new Array(11).fill("");
    output[0] = emailOutreachCell_(row, 48);
    output[1] = emailOutreachCell_(row, 2);
    output[2] = emailOutreachCell_(row, 3);
    output[3] = emailOutreachCell_(row, 51);
    output[4] = emailOutreachCell_(row, 45);
    output[8] = emailOutreachCell_(row, 52);
    output[10] = emailOutreachCell_(row, 46);
    return output;
  });

  sheet.clearContents();
  emailOutreachEnsureSheetSize_(sheet, outputRows.length, 11);
  sheet.getRange(1, 1, outputRows.length, 11).setValues(outputRows);

  return {
    outputSheetName: EMAIL_OUTREACH_CLEANER_SHEET,
    rowCount: Math.max(0, outputRows.length - 1)
  };
}

function emailOutreachRunBrevoCleaner_(ss, rawValues) {
  var sheet = emailOutreachGetOrCreateSheet_(ss, EMAIL_OUTREACH_CLEANER_SHEET);
  var outputRows = rawValues.map(function(row) {
    var output = new Array(5).fill("");
    output[1] = emailOutreachCell_(row, 51);
    output[2] = emailOutreachCell_(row, 48);
    output[3] = emailOutreachCell_(row, 45);
    output[4] = emailOutreachCell_(row, 2);
    return output;
  });

  sheet.clearContents();
  emailOutreachEnsureSheetSize_(sheet, outputRows.length, 5);
  sheet.getRange(1, 1, outputRows.length, 5).setValues(outputRows);

  try {
    sheet.autoResizeColumns(1, 5);
  } catch (e) {}

  return {
    outputSheetName: EMAIL_OUTREACH_CLEANER_SHEET,
    rowCount: Math.max(0, outputRows.length - 1)
  };
}

function emailOutreachBuildReadyToEmail_(ss, rawValues, dncEmails) {
  var readySheet = emailOutreachGetOrCreateReadySheet_(ss);
  var existingReadyLeads = emailOutreachReadLeadRowsFromSheet_(readySheet);
  var emailSentLeadMap = emailOutreachBuildLeadKeyMap_(emailOutreachReadLeadRowsFromSheet_(emailOutreachGetEmailSentSheet_(ss)));
  var archiveLeadMap = emailOutreachBuildLeadKeyMap_(emailOutreachReadLeadRowsFromSheet_(emailOutreachGetArchiveSheet_(ss)));
  var headers = rawValues.length ? rawValues[0] : [];
  var colMap = emailOutreachBuildLeadColMap_(headers);
  var readyRows = [];
  var readyRowIndexByKey = {};
  var dncRemovedCount = 0;
  var skippedInvalidCount = 0;

  for (var existingIndex = 0; existingIndex < existingReadyLeads.length; existingIndex++) {
    var existingLead = existingReadyLeads[existingIndex];
    var existingKey = emailOutreachBuildLeadKey_(existingLead);

    if (!existingKey ||
        emailOutreachShouldSkipReadyLeadStatus_(existingLead.status) ||
        dncEmails[existingLead.email] ||
        emailSentLeadMap[existingKey] ||
        archiveLeadMap[existingKey] ||
        readyRowIndexByKey[existingKey] !== undefined) {
      continue;
    }

    readyRowIndexByKey[existingKey] = readyRows.length;
    readyRows.push([
      existingLead.name,
      existingLead.email,
      existingLead.propertyAddress,
      existingLead.listPrice,
      existingLead.status || "NEW",
      existingLead.leadId || emailOutreachBuildLeadId_()
    ]);
  }

  for (var i = 1; i < rawValues.length; i++) {
    var lead = emailOutreachReadLeadFromRawRow_(rawValues[i], colMap);

    if (!emailOutreachIsValidEmail_(lead.email)) {
      skippedInvalidCount++;
      continue;
    }

    if (dncEmails[lead.email]) {
      dncRemovedCount++;
      continue;
    }

    if (emailOutreachShouldSkipRawLeadStatus_(lead.status)) {
      skippedInvalidCount++;
      continue;
    }

    var leadKey = emailOutreachBuildLeadKey_(lead);
    if (!leadKey) {
      skippedInvalidCount++;
      continue;
    }

    if (emailSentLeadMap[leadKey] || archiveLeadMap[leadKey]) {
      continue;
    }

    var existingReadyIndex = readyRowIndexByKey[leadKey];
    if (existingReadyIndex !== undefined) {
      readyRows[existingReadyIndex][0] = lead.name;
      readyRows[existingReadyIndex][1] = lead.email;
      readyRows[existingReadyIndex][2] = lead.propertyAddress;
      readyRows[existingReadyIndex][3] = lead.listPrice;

      if (!String(readyRows[existingReadyIndex][4] || "").trim()) {
        readyRows[existingReadyIndex][4] = lead.status || "NEW";
      }
      if (!String(readyRows[existingReadyIndex][5] || "").trim()) {
        readyRows[existingReadyIndex][5] = emailOutreachBuildLeadId_();
      }
      continue;
    }

    readyRowIndexByKey[leadKey] = readyRows.length;
    readyRows.push([lead.name, lead.email, lead.propertyAddress, lead.listPrice, lead.status || "NEW", emailOutreachBuildLeadId_()]);
  }

  readySheet.clearContents();
  emailOutreachEnsureSheetSize_(readySheet, Math.max(1, readyRows.length + 1), EMAIL_OUTREACH_LEAD_COLUMN_COUNT);
  readySheet.getRange(1, 1, 1, EMAIL_OUTREACH_LEAD_COLUMN_COUNT).setValues(EMAIL_OUTREACH_STANDARD_HEADERS);

  if (readyRows.length) {
    readySheet.getRange(2, 1, readyRows.length, EMAIL_OUTREACH_LEAD_COLUMN_COUNT).setValues(readyRows);
  }

  var leads = emailOutreachBuildReadyLeadsFromRows_(readyRows);

  return {
    readyLeadCount: leads.length,
    dncRemovedCount: dncRemovedCount,
    skippedInvalidCount: skippedInvalidCount,
    leads: leads
  };
}

function emailOutreachNormalizeProvider_(providerType) {
  var value = String(providerType || "").trim().toLowerCase();
  return value === EMAIL_OUTREACH_PROVIDER_BREVO ? EMAIL_OUTREACH_PROVIDER_BREVO : EMAIL_OUTREACH_PROVIDER_DEAL_CANNON;
}

function emailOutreachNormalizeOfferType_(offerType) {
  var value = String(offerType || '').trim();
  var compact = value.toLowerCase().replace(/[\s_-]+/g, '');

  if (value === 'Cash' || compact === 'cash') {
    return 'Cash';
  }

  if (value === 'LeaseOption' || compact === 'leaseoption') {
    return 'LeaseOption';
  }

  if (value === 'SellerFinance' || value === 'Seller Financing' || compact === 'sellerfinance' || compact === 'sellerfinancing') {
    return 'SellerFinance';
  }

  if (value === 'SubTo' || value === 'Subject To' || compact === 'subto' || compact === 'subjectto') {
    return 'SubTo';
  }

  return 'SubTo';
}

/* =========================
   LEAD MAPPING
========================== */

function emailOutreachNormalizeHeader_(header) {
  return String(header || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function emailOutreachBuildLeadColMap_(headers) {
  var colMap = {};
  for (var i = 0; i < headers.length; i++) {
    var h = emailOutreachNormalizeHeader_(headers[i]);

    if (h === "name" || h === "full name" || h === "agent name" || h === "listing agent full" || h === "listing agent full name" || h === "owner name") {
      colMap.name = i;
    } else if (h === "first name" || h === "listing agent first" || h === "agent first name") {
      colMap.firstName = i;
    } else if (h === "last name" || h === "listing agent last" || h === "agent last name") {
      colMap.lastName = i;
    } else if (h === "email" || h === "e-mail" || h === "email address" || h === "contact email" || h === "primary email" || h === "listing agent email" || h === "agent email" || h === "realtor email") {
      colMap.email = i;
    } else if (h === "property address" || h === "address" || h === "property" || h === "street address" || h === "property street") {
      colMap.propertyAddress = i;
    } else if (h === "city" || h === "property city") {
      colMap.city = i;
    } else if (h === "state" || h === "property state") {
      colMap.state = i;
    } else if (h === "zip" || h === "zipcode" || h === "zip code" || h === "property zip") {
      colMap.zip = i;
    } else if (h === "list price" || h === "price" || h === "asking price" || h === "listing price") {
      colMap.listPrice = i;
    } else if (h === "status" || h === "listing status") {
      colMap.status = i;
    }
  }
  return colMap;
}

function emailOutreachReadLeadFromRawRow_(row, colMap) {
  var name = colMap.name !== undefined ? String(row[colMap.name] || "").trim() : "";
  if (!name && (colMap.firstName !== undefined || colMap.lastName !== undefined)) {
    name = [
      colMap.firstName !== undefined ? String(row[colMap.firstName] || "").trim() : "",
      colMap.lastName !== undefined ? String(row[colMap.lastName] || "").trim() : ""
    ].filter(function(part) { return !!part; }).join(" ");
  }
  if (!name) {
    name = String(emailOutreachCell_(row, 48) || "").trim();
  }

  var email = colMap.email !== undefined ? String(row[colMap.email] || "").trim().toLowerCase() : "";
  if (!emailOutreachIsValidEmail_(email)) {
    email = String(emailOutreachCell_(row, 51) || "").trim().toLowerCase();
  }
  if (!emailOutreachIsValidEmail_(email)) {
    email = String(emailOutreachCell_(row, 52) || "").trim().toLowerCase();
  }

  var propertyAddress = colMap.propertyAddress !== undefined ? String(row[colMap.propertyAddress] || "").trim() : "";
  if (!propertyAddress) {
    propertyAddress = String(emailOutreachCell_(row, 2) || "").trim();
  }

  var cityStateZip = [
    colMap.city !== undefined ? String(row[colMap.city] || "").trim() : "",
    colMap.state !== undefined ? String(row[colMap.state] || "").trim() : "",
    colMap.zip !== undefined ? String(row[colMap.zip] || "").trim() : ""
  ].filter(function(part) { return !!part; }).join(", ");

  if (propertyAddress && cityStateZip && propertyAddress.indexOf(cityStateZip) === -1) {
    propertyAddress = propertyAddress + ", " + cityStateZip;
  }

  var listPrice = colMap.listPrice !== undefined ? String(row[colMap.listPrice] || "").trim() : "";
  if (!listPrice) {
    listPrice = String(emailOutreachCell_(row, 3) || emailOutreachCell_(row, 46) || "").trim();
  }

  var status = colMap.status !== undefined ? String(row[colMap.status] || "").trim().toUpperCase() : "";
  if (!status) {
    status = "NEW";
  }

  return {
    name: emailOutreachCapCell_(name),
    email: emailOutreachCapCell_(email),
    propertyAddress: emailOutreachCapCell_(propertyAddress),
    listPrice: emailOutreachCapCell_(listPrice),
    status: emailOutreachCapCell_(status)
  };
}

function emailOutreachIsValidEmail_(email) {
  var value = String(email || "").trim().toLowerCase();
  if (!value || value === "email" || value === "e-mail") {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function emailOutreachCapCell_(value) {
  if (value === null || value === undefined) {
    return "";
  }
  var text = String(value);
  return text.length > 49000 ? text.substring(0, 49000) : text;
}

/* =========================
   DNC LIST
========================== */

function appendDncEmails(rawText) {
  try {
    requireApprovedUser_();
    var ss = getCustomerWorkbook_();
    var sheet = emailOutreachGetOrCreateDncSheet_(ss);
    var incomingEmails = emailOutreachExtractEmails_(rawText);

    if (!incomingEmails.length) {
      return buildFailure("NO_DNC_EMAILS", "Paste at least one valid email first.");
    }

    var existingEmails = emailOutreachLoadDncEmailMapFromSheet_(sheet);
    var rowsToAppend = [];
    var addedCount = 0;
    var skippedCount = 0;

    for (var i = 0; i < incomingEmails.length; i++) {
      var email = incomingEmails[i];
      if (existingEmails[email]) {
        skippedCount++;
        continue;
      }
      rowsToAppend.push([email, "DNC"]);
      existingEmails[email] = true;
      addedCount++;
    }

    if (rowsToAppend.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, 2).setValues(rowsToAppend);
    }

    return {
      success: true,
      message: "Added " + addedCount + " email(s) to DNC. Skipped " + skippedCount + ".",
      addedCount: addedCount,
      skippedCount: skippedCount,
      totalCount: Math.max(0, sheet.getLastRow() - 1)
    };
  } catch (err) {
    return buildFailure("DNC_APPEND_ERROR", err.message || String(err));
  }
}

function getDncListState() {
  try {
    requireApprovedUser_();
    var ss = getCustomerWorkbook_();
    var sheet = emailOutreachGetDncSheet_(ss);
    var emails = [];

    if (sheet && sheet.getLastRow() > 1) {
      var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), 2)).getValues();
      for (var i = 0; i < data.length; i++) {
        var email = String(data[i][0] || "").trim().toLowerCase();
        if (!email) {
          continue;
        }
        emails.push({
          rowNumber: i + 2,
          email: email,
          status: String(data[i][1] || "DNC").trim() || "DNC"
        });
      }
    }

    return {
      success: true,
      count: emails.length,
      emails: emails
    };
  } catch (err) {
    return buildFailure("DNC_STATE_ERROR", err.message || String(err));
  }
}

function deleteDncRows(selectedRows) {
  try {
    requireApprovedUser_();
    var ss = getCustomerWorkbook_();
    var sheet = emailOutreachGetDncSheet_(ss);

    if (!sheet) {
      return buildFailure("NO_DNC_SHEET", "DNC List tab not found.");
    }

    selectedRows = emailOutreachNormalizeSelectedRows_(selectedRows);
    var deleteBlocks = emailOutreachBuildDescendingDeleteBlocks_(selectedRows);
    for (var i = 0; i < deleteBlocks.length; i++) {
      sheet.deleteRows(deleteBlocks[i].startRow, deleteBlocks[i].count);
    }

    return {
      success: true,
      message: "Deleted " + selectedRows.length + " DNC row(s)."
    };
  } catch (err) {
    return buildFailure("DNC_DELETE_ERROR", err.message || String(err));
  }
}

function emailOutreachExtractEmails_(rawText) {
  var text = String(rawText || "").toLowerCase();
  var matches = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || [];
  var seen = {};
  var emails = [];

  for (var i = 0; i < matches.length; i++) {
    var email = String(matches[i] || "").trim().toLowerCase();
    if (!email || seen[email]) {
      continue;
    }
    seen[email] = true;
    emails.push(email);
  }

  return emails;
}

function emailOutreachLoadDncEmailMap_(ss) {
  var sheet = emailOutreachGetDncSheet_(ss);
  return emailOutreachLoadDncEmailMapFromSheet_(sheet);
}

function emailOutreachLoadDncEmailMapFromSheet_(sheet) {
  var emails = {};
  if (!sheet || sheet.getLastRow() <= 1) {
    return emails;
  }

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var email = String(values[i][0] || "").trim().toLowerCase();
    if (email) {
      emails[email] = true;
    }
  }
  return emails;
}

/* =========================
   READY TO EMAIL
========================== */

function deleteReadyToEmailRows(selectedRows) {
  try {
    requireApprovedUser_();
    var ss = getCustomerWorkbook_();
    var sheet = emailOutreachGetReadySheet_(ss);

    if (!sheet) {
      return buildFailure("NO_READY_SHEET", "Ready to Email tab not found.");
    }

    selectedRows = emailOutreachNormalizeSelectedRows_(selectedRows);
    var deletePayload = emailOutreachReadSelectedRows_(sheet, selectedRows, EMAIL_OUTREACH_LEAD_COLUMN_COUNT);
    var deleteBlocks = emailOutreachBuildDescendingDeleteBlocks_(selectedRows);

    if (deletePayload.rows.length) {
      emailOutreachAppendRowsToArchiveTab_(ss, deletePayload.rows, "DELETED");
    }

    for (var i = 0; i < deleteBlocks.length; i++) {
      sheet.deleteRows(deleteBlocks[i].startRow, deleteBlocks[i].count);
    }

    return {
      success: true,
      message: "Deleted " + selectedRows.length + " lead(s) from Ready to Email."
    };
  } catch (err) {
    return buildFailure("READY_DELETE_ERROR", err.message || String(err));
  }
}

function updateReadyToEmailLead(rowNumber, updates) {
  try {
    requireApprovedUser_();
    var ss = getCustomerWorkbook_();
    var sheet = emailOutreachGetReadySheet_(ss);
    rowNumber = Number(rowNumber || 0);
    updates = updates || {};

    if (!sheet || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
      return buildFailure("INVALID_ROW", "Row " + rowNumber + " not found in Ready to Email.");
    }

    var fields = [updates.name, updates.email, updates.propertyAddress, updates.listPrice, updates.status, updates.leadId];
    var range = sheet.getRange(rowNumber, 1, 1, EMAIL_OUTREACH_LEAD_COLUMN_COUNT);
    var values = range.getValues();

    for (var i = 0; i < fields.length; i++) {
      if (fields[i] !== undefined) {
        values[0][i] = fields[i];
      }
    }

    range.setValues(values);

    return {
      success: true,
      message: "Updated lead in row " + rowNumber + "."
    };
  } catch (err) {
    return buildFailure("READY_UPDATE_ERROR", err.message || String(err));
  }
}

function archiveReadyToEmailRows(selectedRows) {
  try {
    requireApprovedUser_();
    var lock = LockService.getUserLock();

    if (!lock.tryLock(10000)) {
      return buildFailure("READY_ARCHIVE_LOCKED", "An archive operation is already running for this account. Please wait a few seconds and try again.");
    }

    try {
      var ss = getCustomerWorkbook_();
      var sheet = emailOutreachGetReadySheet_(ss);

      if (!sheet) {
        return buildFailure("NO_READY_SHEET", "Ready to Email tab not found.");
      }

      selectedRows = emailOutreachNormalizeSelectedRows_(selectedRows).reverse();

      if (!selectedRows.length) {
        return buildFailure("NO_SELECTION", "Select at least one lead first.");
      }

      var archivePayload = emailOutreachReadSelectedRows_(sheet, selectedRows, EMAIL_OUTREACH_LEAD_COLUMN_COUNT);
      if (!archivePayload.rows.length) {
        return buildFailure("NO_ARCHIVE_ROWS", "No archiveable rows were found in Ready to Email.");
      }

      var archiveResult = emailOutreachArchiveRows_(ss, sheet, archivePayload.rowNumbers, archivePayload.rows, "Ready to Email", "Ready to Email");
      if (!archiveResult.success) {
        return buildFailure("READY_ARCHIVE_ERROR", archiveResult.message || "Archive failed.", archiveResult);
      }

      return {
        success: true,
        archivedCount: archivePayload.rows.length,
        archiveFileId: archiveResult.archiveFileId,
        archiveFileUrl: archiveResult.archiveFileUrl,
        archiveFileName: archiveResult.archiveFileName,
        message: "Archived " + archivePayload.rows.length + " lead(s) and saved a copy to your Archived Leads folder."
      };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return buildFailure("READY_ARCHIVE_ERROR", err.message || String(err));
  }
}

/* =========================
   EMAIL SENT
========================== */

function getEmailsSentState() {
  try {
    requireApprovedUser_();
    var ss = getCustomerWorkbook_();
    var sheet = emailOutreachGetEmailSentSheet_(ss);
    var records = [];

    if (sheet && sheet.getLastRow() > 1) {
      emailOutreachEnsureLeadSheetSchema_(sheet);
      var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), EMAIL_OUTREACH_LEAD_COLUMN_COUNT)).getValues();
      for (var i = 0; i < values.length; i++) {
        var row = emailOutreachNormalizeLeadRowValues_(values[i], "SENT");
        records.push({
          rowNumber: i + 2,
          name: row[0],
          email: row[1],
          propertyAddress: row[2],
          listPrice: row[3],
          status: row[4],
          leadId: row[5]
        });
      }
    }

    return {
      success: true,
      records: records
    };
  } catch (err) {
    return buildFailure("EMAIL_SENT_STATE_ERROR", err.message || String(err));
  }
}

function getScheduledEmailsState() {
  try {
    requireApprovedUser_();
    var ss = getCustomerWorkbook_();
    var sheet = emailOutreachGetOrCreateScheduledSheet_(ss);
    var records = emailOutreachReadScheduledLeadRows_(sheet);

    return {
      success: true,
      records: records
    };
  } catch (err) {
    return buildFailure("SCHEDULED_EMAILS_STATE_ERROR", err.message || String(err));
  }
}

function emailOutreachNormalizeScheduledDisplayRow_(row) {
  row = row || [];

  var standardRow = emailOutreachNormalizeLeadRowValues_(row, "SCHEDULED");
  if (emailOutreachIsValidEmail_(standardRow[1])) {
    return standardRow;
  }

  var legacyName = String(row[7] || "").trim();
  var legacyEmail = String(row[8] || "").trim().toLowerCase();
  var legacyPropertyAddress = String(row[9] || "").trim();
  var legacyListPrice = String(row[10] || "").trim();
  var legacyStatus = emailOutreachNormalizeLeadStatus_(row[11], "SCHEDULED");
  var legacyLeadId = String(row[15] || "").trim() || emailOutreachBuildLeadId_();

  if (emailOutreachIsValidEmail_(legacyEmail)) {
    return [
      legacyName,
      legacyEmail,
      legacyPropertyAddress,
      legacyListPrice,
      legacyStatus,
      legacyLeadId
    ];
  }

  return standardRow;
}

function emailOutreachGetScheduledOfferTypeFromRow_(row) {
  row = row || [];
  var standardRow = emailOutreachNormalizeLeadRowValues_(row, 'SCHEDULED');

  if (emailOutreachIsValidEmail_(standardRow[1])) {
    return emailOutreachNormalizeOfferType_(row[EMAIL_OUTREACH_SCHEDULED_OFFER_TYPE_COLUMN - 1]);
  }

  return emailOutreachNormalizeOfferType_(row[4]);
}

function emailOutreachReadScheduledLeadRows_(sheet) {
  var records = [];

  if (!sheet || sheet.getLastRow() <= 1) {
    return records;
  }

  emailOutreachEnsureScheduledSheetSchema_(sheet);

  var values = sheet.getRange(
    2,
    1,
    sheet.getLastRow() - 1,
    Math.max(sheet.getLastColumn(), EMAIL_OUTREACH_SCHEDULED_OFFER_TYPE_COLUMN)
  ).getValues();

  for (var i = 0; i < values.length; i++) {
    var row = emailOutreachNormalizeScheduledDisplayRow_(values[i]);
    records.push({
      rowNumber: i + 2,
      name: row[0],
      email: row[1],
      propertyAddress: row[2],
      listPrice: row[3],
      status: row[4],
      leadId: row[5],
      offerType: emailOutreachGetScheduledOfferTypeFromRow_(values[i])
    });
  }

  return records;
}

function scheduleSelectedReadyToEmailRows(selectedRows, offerType) {
  try {
    requireApprovedUser_();
    var ss = getCustomerWorkbook_();
    var readySheet = emailOutreachGetReadySheet_(ss);
    var scheduledSheet = emailOutreachGetOrCreateScheduledSheet_(ss);
    var normalizedOfferType = emailOutreachNormalizeOfferType_(offerType);

    if (!readySheet) {
      return buildFailure("NO_READY_SHEET", "Ready to Email tab not found.");
    }

    selectedRows = emailOutreachNormalizeSelectedRows_(selectedRows);

    if (!selectedRows.length) {
      return buildFailure("NO_SELECTION", "Select at least one lead first.");
    }

    var movePayload = emailOutreachReadSelectedRows_(readySheet, selectedRows, EMAIL_OUTREACH_LEAD_COLUMN_COUNT);
    if (!movePayload.rows.length) {
      return buildFailure("NO_SCHEDULE_ROWS", "No selected Ready to Email rows were found.");
    }

    var scheduledRows = movePayload.rows.map(function(row) {
      var normalized = emailOutreachNormalizeLeadRowValues_(row, "SCHEDULED");
      normalized[EMAIL_OUTREACH_LEAD_STATUS_INDEX] = "SCHEDULED";
      normalized.push(normalizedOfferType);
      return normalized;
    });

    scheduledSheet.getRange(
      scheduledSheet.getLastRow() + 1,
      1,
      scheduledRows.length,
      EMAIL_OUTREACH_SCHEDULED_OFFER_TYPE_COLUMN
    ).setValues(scheduledRows);

    var deleteBlocks = emailOutreachBuildDescendingDeleteBlocks_(selectedRows);
    for (var i = 0; i < deleteBlocks.length; i++) {
      readySheet.deleteRows(deleteBlocks[i].startRow, deleteBlocks[i].count);
    }

    SpreadsheetApp.flush();

    return {
      success: true,
      scheduledCount: scheduledRows.length,
      message: "Moved " + scheduledRows.length + " lead(s) into Scheduled Emails."
    };
  } catch (err) {
    return buildFailure("SCHEDULE_EMAILS_ERROR", err.message || String(err));
  }
}

function restoreScheduledEmailRows(selectedRows) {
  try {
    requireApprovedUser_();
    var lock = LockService.getUserLock();

    if (!lock.tryLock(10000)) {
      return buildFailure('SCHEDULED_RESTORE_LOCKED', 'A scheduled email change is already running for this account. Please wait a few seconds and try again.');
    }

    try {
      var ss = getCustomerWorkbook_();
      var scheduledSheet = emailOutreachGetScheduledSheet_(ss);
      var readySheet = emailOutreachGetOrCreateReadySheet_(ss);

      if (!scheduledSheet) {
        return buildFailure('NO_SCHEDULED_SHEET', 'Scheduled Emails tab not found.');
      }

      selectedRows = emailOutreachNormalizeSelectedRows_(selectedRows);

      if (!selectedRows.length) {
        return buildFailure('NO_SELECTION', 'Select at least one scheduled email first.');
      }

      var restorePayload = emailOutreachReadSelectedRows_(
        scheduledSheet,
        selectedRows,
        Math.max(scheduledSheet.getLastColumn(), EMAIL_OUTREACH_SCHEDULED_OFFER_TYPE_COLUMN)
      );

      if (!restorePayload.rows.length) {
        return buildFailure('NO_SCHEDULED_ROWS', 'No selected Scheduled Emails rows were found.');
      }

      var existingReadyLeads = emailOutreachReadLeadRowsFromSheet_(readySheet);
      var existingLeadIdMap = emailOutreachBuildLeadIdMap_(existingReadyLeads);
      var existingLeadKeyMap = emailOutreachBuildLeadKeyMap_(existingReadyLeads);
      var rowsToRestore = [];
      var restoredCount = 0;
      var duplicateCount = 0;

      for (var i = 0; i < restorePayload.rows.length; i++) {
        var normalizedRow = emailOutreachNormalizeScheduledDisplayRow_(restorePayload.rows[i]);
        var lead = {
          name: normalizedRow[0],
          email: normalizedRow[1],
          propertyAddress: normalizedRow[2],
          listPrice: normalizedRow[3],
          status: normalizedRow[4],
          leadId: normalizedRow[5]
        };
        var leadId = String(lead.leadId || '').trim() || emailOutreachBuildLeadId_();
        var leadKey = emailOutreachBuildLeadKey_(lead);

        if ((leadId && existingLeadIdMap[leadId]) || (leadKey && existingLeadKeyMap[leadKey])) {
          duplicateCount++;
          continue;
        }

        rowsToRestore.push([
          lead.name,
          lead.email,
          lead.propertyAddress,
          lead.listPrice,
          'NEW',
          leadId
        ]);

        if (leadId) {
          existingLeadIdMap[leadId] = true;
        }

        if (leadKey) {
          existingLeadKeyMap[leadKey] = true;
        }

        restoredCount++;
      }

      if (rowsToRestore.length) {
        readySheet.getRange(readySheet.getLastRow() + 1, 1, rowsToRestore.length, EMAIL_OUTREACH_LEAD_COLUMN_COUNT).setValues(rowsToRestore);
      }

      var deleteBlocks = emailOutreachBuildDescendingDeleteBlocks_(
        emailOutreachNormalizeSelectedRows_(restorePayload.rowNumbers)
      );
      for (var j = 0; j < deleteBlocks.length; j++) {
        scheduledSheet.deleteRows(deleteBlocks[j].startRow, deleteBlocks[j].count);
      }

      SpreadsheetApp.flush();

      var message = 'Moved ' + restoredCount + ' scheduled lead(s) back to Active Leads.';

      if (duplicateCount) {
        message += ' Removed ' + duplicateCount + ' duplicate scheduled row(s) that were already active.';
      }

      return {
        success: true,
        restoredCount: restoredCount,
        duplicateCount: duplicateCount,
        message: message
      };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return buildFailure('SCHEDULED_RESTORE_ERROR', err.message || String(err));
  }
}

function deleteScheduledEmailRows(selectedRows) {
  try {
    requireApprovedUser_();
    var lock = LockService.getUserLock();

    if (!lock.tryLock(10000)) {
      return buildFailure('SCHEDULED_DELETE_LOCKED', 'A scheduled email change is already running for this account. Please wait a few seconds and try again.');
    }

    try {
      var ss = getCustomerWorkbook_();
      var scheduledSheet = emailOutreachGetScheduledSheet_(ss);

      if (!scheduledSheet) {
        return buildFailure('NO_SCHEDULED_SHEET', 'Scheduled Emails tab not found.');
      }

      selectedRows = emailOutreachNormalizeSelectedRows_(selectedRows);

      if (!selectedRows.length) {
        return buildFailure('NO_SELECTION', 'Select at least one scheduled email first.');
      }

      var deletePayload = emailOutreachReadSelectedRows_(
        scheduledSheet,
        selectedRows,
        Math.max(scheduledSheet.getLastColumn(), EMAIL_OUTREACH_SCHEDULED_OFFER_TYPE_COLUMN)
      );

      if (!deletePayload.rows.length) {
        return buildFailure('NO_SCHEDULED_ROWS', 'No selected Scheduled Emails rows were found.');
      }

      var deleteBlocks = emailOutreachBuildDescendingDeleteBlocks_(
        emailOutreachNormalizeSelectedRows_(deletePayload.rowNumbers)
      );
      for (var i = 0; i < deleteBlocks.length; i++) {
        scheduledSheet.deleteRows(deleteBlocks[i].startRow, deleteBlocks[i].count);
      }

      SpreadsheetApp.flush();

      return {
        success: true,
        deletedCount: deletePayload.rowNumbers.length,
        message: 'Deleted ' + deletePayload.rowNumbers.length + ' scheduled email row(s).'
      };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return buildFailure('SCHEDULED_DELETE_ERROR', err.message || String(err));
  }
}

function runScheduledEmailsDailyBatch() {
  try {
    requireApprovedUser_();
    var lock = LockService.getUserLock();

    if (!lock.tryLock(10000)) {
      return buildFailure('SCHEDULED_BATCH_LOCKED', 'A scheduled email batch is already running for this account.');
    }

    try {
      var ss = getCustomerWorkbook_();
      var scheduledSheet = emailOutreachGetScheduledSheet_(ss);

      if (!scheduledSheet || scheduledSheet.getLastRow() <= 1) {
        return {
          success: true,
          processedCount: 0,
          failedCount: 0,
          remainingCount: 0,
          message: 'No scheduled emails were queued for this account.'
        };
      }

      var scheduledRecords = emailOutreachReadScheduledLeadRows_(scheduledSheet);
      var runnableRecords = scheduledRecords.filter(function(record) {
        return String(record.status || '').trim().toUpperCase() === 'SCHEDULED';
      }).slice(0, EMAIL_OUTREACH_SCHEDULED_BATCH_LIMIT);

      if (!runnableRecords.length) {
        return {
          success: true,
          processedCount: 0,
          failedCount: 0,
          remainingCount: 0,
          message: 'No scheduled emails were ready to send tonight.'
        };
      }

      var dncEmails = emailOutreachLoadDncEmailMap_(ss);
      var outreachInfo = emailOutreachGetSavedOutreachInfo_(ss);
      var emailSentSheet = emailOutreachGetOrCreateEmailSentSheet_(ss);
      var processedRows = [];
      var processedScheduledRows = [];
      var failedCount = 0;
      var blockedCount = 0;
      var remainingDailyQuota = MailApp.getRemainingDailyQuota();
      var quotaStopped = false;

      for (var i = 0; i < runnableRecords.length; i++) {
        var record = runnableRecords[i];
        var email = String(record.email || '').trim().toLowerCase();

        if (!emailOutreachIsValidEmail_(email)) {
          failedCount++;
          emailOutreachMarkReadyLeadStatus_(scheduledSheet, record.rowNumber, 'FAILED');
          continue;
        }

        if (dncEmails[email]) {
          failedCount++;
          emailOutreachMarkReadyLeadStatus_(scheduledSheet, record.rowNumber, 'DNC');
          continue;
        }

        if (remainingDailyQuota !== null && remainingDailyQuota <= 0) {
          quotaStopped = true;
          blockedCount = runnableRecords.length - i;
          break;
        }

        try {
          var rendered = emailOutreachRenderCampaignEmail_(record.offerType || 'SubTo', record, outreachInfo);
          GmailApp.sendEmail(email, rendered.subject, rendered.body);

          if (remainingDailyQuota !== null) {
            remainingDailyQuota = Math.max(0, remainingDailyQuota - 1);
          }

          processedRows.push([
            record.name,
            email,
            record.propertyAddress,
            record.listPrice,
            'SENT',
            record.leadId || emailOutreachBuildLeadId_()
          ]);
          processedScheduledRows.push(record.rowNumber);
          emailOutreachMaybePauseForSendThrottle_(processedRows.length);
        } catch (mailErr) {
          var mailMessage = mailErr && mailErr.message ? mailErr.message : String(mailErr);

          if (emailOutreachIsQuotaError_(mailMessage)) {
            quotaStopped = true;
            blockedCount = runnableRecords.length - i;
            break;
          }

          failedCount++;
          emailOutreachMarkReadyLeadStatus_(scheduledSheet, record.rowNumber, 'FAILED');
        }
      }

      var finalizeResult = emailOutreachFinalizeScheduledBatchRows_(scheduledSheet, emailSentSheet, processedScheduledRows, processedRows);
      var remainingCount = emailOutreachReadScheduledLeadRows_(scheduledSheet).filter(function(record) {
        return String(record.status || '').trim().toUpperCase() === 'SCHEDULED';
      }).length;
      var message = 'Nightly scheduled batch sent ' + processedRows.length + ' email(s).';

      if (failedCount) {
        message += ' ' + failedCount + ' row(s) were marked failed.';
      }

      if (blockedCount) {
        message += ' ' + blockedCount + ' row(s) remain queued for tomorrow after quota stopped the batch.';
      }

      if (!finalizeResult.success) {
        message += ' ' + (finalizeResult.message || 'Sent rows could not be fully cleaned up from Scheduled Emails.');
      }

      return {
        success: finalizeResult.success,
        partialSuccess: processedRows.length > 0 && (!finalizeResult.success || failedCount > 0 || blockedCount > 0),
        processedCount: processedRows.length,
        failedCount: failedCount,
        blockedCount: blockedCount,
        quotaStopped: quotaStopped,
        remainingCount: remainingCount,
        message: message
      };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return buildFailure('SCHEDULED_BATCH_ERROR', err.message || String(err));
  }
}

function deleteEmailsSentRows(selectedRows) {
  try {
    requireApprovedUser_();
    var ss = getCustomerWorkbook_();
    var sheet = emailOutreachGetEmailSentSheet_(ss);

    if (!sheet) {
      return buildFailure("NO_EMAIL_SENT_SHEET", "Email Sent tab not found.");
    }

    selectedRows = emailOutreachNormalizeSelectedRows_(selectedRows);
    var deleteBlocks = emailOutreachBuildDescendingDeleteBlocks_(selectedRows);
    for (var i = 0; i < deleteBlocks.length; i++) {
      sheet.deleteRows(deleteBlocks[i].startRow, deleteBlocks[i].count);
    }

    return {
      success: true,
      message: "Deleted " + selectedRows.length + " Email Sent row(s)."
    };
  } catch (err) {
    return buildFailure("EMAIL_SENT_DELETE_ERROR", err.message || String(err));
  }
}

function archiveEmailsSentNow() {
  try {
    requireApprovedUser_();
    var lock = LockService.getUserLock();

    if (!lock.tryLock(10000)) {
      return buildFailure("EMAIL_SENT_ARCHIVE_LOCKED", "An archive operation is already running for this account. Please wait a few seconds and try again.");
    }

    try {
      var ss = getCustomerWorkbook_();
      var sheet = emailOutreachGetEmailSentSheet_(ss);

      if (!sheet || sheet.getLastRow() <= 1) {
        return buildFailure("NO_EMAIL_SENT", "No Email Sent records to archive.");
      }

      var rowCount = Math.max(0, sheet.getLastRow() - 1);
      var selectedRows = [];
      for (var row = 2; row <= sheet.getLastRow(); row++) {
        selectedRows.push(row);
      }

      var archivePayload = emailOutreachReadSelectedRows_(sheet, selectedRows, EMAIL_OUTREACH_LEAD_COLUMN_COUNT);
      if (!archivePayload.rows.length) {
        return buildFailure("NO_EMAIL_SENT", "No Email Sent records to archive.");
      }

      var archiveResult = emailOutreachArchiveRows_(ss, sheet, archivePayload.rowNumbers, archivePayload.rows, "Email Sent", "Emails Sent");
      if (!archiveResult.success) {
        return buildFailure("EMAIL_SENT_ARCHIVE_ERROR", archiveResult.message || "Archive failed.", archiveResult);
      }

      return {
        success: true,
        archivedCount: rowCount,
        archiveFileId: archiveResult.archiveFileId,
        archiveFileUrl: archiveResult.archiveFileUrl,
        archiveFileName: archiveResult.archiveFileName,
        message: "Archived " + rowCount + " Email Sent record(s) and saved a copy to your Archived Leads folder."
      };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return buildFailure("EMAIL_SENT_ARCHIVE_ERROR", err.message || String(err));
  }
}

/* =========================
   MANUAL EMAIL CAMPAIGN
========================== */

function runMassEmailCampaign(payload) {
  try {
    requireApprovedUser_();
    var ss = getCustomerWorkbook_();
    var readySheet = emailOutreachGetReadySheet_(ss);

    if (!readySheet || readySheet.getLastRow() <= 1) {
      return buildFailure("NO_READY_LEADS", "No leads in Ready to Email to campaign.");
    }

    var selectedRows = [];
    for (var row = 2; row <= readySheet.getLastRow(); row++) {
      selectedRows.push(row);
    }

    payload = payload || {};
    payload.selectedRows = selectedRows;
    return runMassEmailCampaignSelected(payload);
  } catch (err) {
    return buildFailure("CAMPAIGN_ERROR", err.message || String(err));
  }
}

function runMassEmailCampaignSelected(payload) {
  try {
    requireApprovedUser_();
    var lock = LockService.getUserLock();

    if (!lock.tryLock(10000)) {
      return buildFailure("CAMPAIGN_LOCKED", "A campaign is already running for this account. Please wait a few seconds and try again.");
    }

    try {
      var ss = getCustomerWorkbook_();
      var readySheet = emailOutreachGetReadySheet_(ss);

      if (!readySheet) {
        return buildFailure("NO_READY_SHEET", "Ready to Email tab not found.");
      }

      payload = payload || {};
      var selectedRows = emailOutreachNormalizeSelectedRows_(payload.selectedRows || []).reverse();
      if (!selectedRows.length) {
        return buildFailure("NO_SELECTION", "No leads selected.");
      }

      var totalSelectedCount = selectedRows.length;
      var offerType = payload.offerType || "SubTo";
      var mode = String(payload.mode || "draft").toLowerCase() === "send" ? "send" : "draft";
      var outreachInfo = emailOutreachGetSavedOutreachInfo_(ss);
      var emailSentSheet = emailOutreachGetOrCreateEmailSentSheet_(ss);
      var processedRows = [];
      var processedReadyRows = [];
      var processedStatuses = [];
      var processedCount = 0;
      var skippedCount = 0;
      var failedCount = 0;
      var blockedCount = 0;
      var failures = [];
      var failureDetails = [];
      var skippedDetails = [];
      var processedRowNumbers = [];
      var failedRowNumbers = [];
      var blockedRowNumbers = [];
      var skippedRowNumbers = [];
      var quotaStopped = false;
      var quotaMessage = "";
      var remainingDailyQuota = mode === "send" ? MailApp.getRemainingDailyQuota() : null;

        for (var i = 0; i < selectedRows.length; i++) {
          var rowNumber = selectedRows[i];
          if (rowNumber < 2 || rowNumber > readySheet.getLastRow()) {
            skippedCount++;
            skippedRowNumbers.push(rowNumber);
            skippedDetails.push({
              rowNumber: rowNumber,
              message: "Ready to Email row was not found."
            });
            continue;
          }

        var row = readySheet.getRange(rowNumber, 1, 1, EMAIL_OUTREACH_LEAD_COLUMN_COUNT).getValues()[0];
        var normalizedRow = emailOutreachNormalizeLeadRowValues_(row, "NEW");
        var lead = {
          name: normalizedRow[0],
          email: normalizedRow[1],
          propertyAddress: normalizedRow[2],
          listPrice: normalizedRow[3],
          status: normalizedRow[4],
          leadId: normalizedRow[5]
        };

        if (!emailOutreachIsValidEmail_(lead.email)) {
          skippedCount++;
          skippedRowNumbers.push(rowNumber);
          skippedDetails.push({
            rowNumber: rowNumber,
            email: lead.email,
            message: "Lead has an invalid email address."
          });
          continue;
        }

        if (lead.status === "SENT" || lead.status === "DRAFTED" || lead.status === "ARCHIVED" || lead.status === "DELETED" || lead.status === "DNC" || lead.status === "INVALID") {
          skippedCount++;
          skippedRowNumbers.push(rowNumber);
          skippedDetails.push({
            rowNumber: rowNumber,
            email: lead.email,
            message: "Lead status " + lead.status + " cannot be campaigned."
          });
          continue;
        }

        if (mode === "send" && remainingDailyQuota !== null && remainingDailyQuota <= 0) {
          quotaStopped = true;
          blockedCount = totalSelectedCount - i;
          quotaMessage = "Gmail daily sending quota appears to be exhausted for this account.";
          blockedRowNumbers = selectedRows.slice(i);
          break;
        }

        var rendered = emailOutreachRenderCampaignEmail_(offerType, lead, outreachInfo);
        var targetStatus = mode === "send" ? "SENT" : "DRAFTED";

        try {
          if (mode === "send") {
            GmailApp.sendEmail(lead.email, rendered.subject, rendered.body);
            if (remainingDailyQuota !== null) {
              remainingDailyQuota = Math.max(0, remainingDailyQuota - 1);
            }
            emailOutreachMaybePauseForSendThrottle_(processedCount + 1);
          } else {
            GmailApp.createDraft(lead.email, rendered.subject, rendered.body);
          }

          processedRows.push([lead.name, lead.email, lead.propertyAddress, lead.listPrice, targetStatus, lead.leadId]);
          processedReadyRows.push(rowNumber);
          processedStatuses.push(targetStatus);
          processedRowNumbers.push(rowNumber);
          processedCount++;
        } catch (mailErr) {
          var mailMessage = mailErr && mailErr.message ? mailErr.message : String(mailErr);

          if (mode === "send" && emailOutreachIsQuotaError_(mailMessage)) {
            quotaStopped = true;
            blockedCount = totalSelectedCount - i;
            quotaMessage = mailMessage;
            blockedRowNumbers = selectedRows.slice(i);

            if (failures.length < 5) {
              failures.push({
                rowNumber: rowNumber,
                email: lead.email,
                message: mailMessage
              });
            }
            break;
          }

          failedCount++;
          failedRowNumbers.push(rowNumber);
          emailOutreachMarkReadyLeadStatus_(readySheet, rowNumber, "FAILED");
          failureDetails.push({
            rowNumber: rowNumber,
            email: lead.email,
            message: mailMessage
          });

          if (failures.length < 5) {
            failures.push({
              rowNumber: rowNumber,
              email: lead.email,
              message: mailMessage
            });
          }
        }
      }

      var finalizeResult = emailOutreachFinalizeCampaignRows_(readySheet, emailSentSheet, processedReadyRows, processedRows, processedStatuses);
      var unsentCount = failedCount + blockedCount;
      var responseSuccess = failedCount === 0 && !quotaStopped && finalizeResult.success;

      return {
        success: responseSuccess,
        partialSuccess: processedCount > 0 && (!responseSuccess || unsentCount > 0),
        message: emailOutreachBuildCampaignResultMessage_({
          processedCount: processedCount,
          skippedCount: skippedCount,
          failedCount: failedCount,
          blockedCount: blockedCount,
          unsentCount: unsentCount,
          mode: mode,
          failures: failures,
          quotaStopped: quotaStopped,
          quotaMessage: quotaMessage,
          finalizeResult: finalizeResult
        }),
        processedCount: processedCount,
        skippedCount: skippedCount,
        failedCount: failedCount,
        blockedCount: blockedCount,
        unsentCount: unsentCount,
        quotaStopped: quotaStopped,
        remainingDailyQuota: remainingDailyQuota,
        failures: failures,
        failureDetails: failureDetails,
        skippedDetails: skippedDetails,
        processedRowNumbers: processedRowNumbers,
        failedRowNumbers: failedRowNumbers,
        blockedRowNumbers: blockedRowNumbers,
        skippedRowNumbers: skippedRowNumbers
      };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return buildFailure("CAMPAIGN_SELECTED_ERROR", err.message || String(err));
  }
}

function emailOutreachRenderCampaignEmail_(offerType, lead, outreachInfo) {
  var templateType = typeof getInitialOutreachTemplateKeyForOfferType_ === "function"
    ? getInitialOutreachTemplateKeyForOfferType_(offerType)
    : offerType;
  var template = typeof getEmailTemplateForType_ === "function"
    ? getEmailTemplateForType_(templateType)
    : {
      subject: "Potential Offer for {{PROPERTY ADDRESS}}",
      body: "Hi {{FIRSTNAME}},\n\nI wanted to reach out about {{PROPERTY ADDRESS}}.\n\nBest,\n{{YOUR NAME}}"
    };

  var campaignPayload = {
    sellerName: lead.name,
    name: lead.name,
    propertyAddress: lead.propertyAddress,
    listingPrice: lead.listPrice,
    recipientEmail: lead.email,
    buyers: outreachInfo.buyerName || outreachInfo.buyerLlc || "",
    buyerName: outreachInfo.buyerName || "",
    buyerLlc: outreachInfo.buyerLlc || "",
    buyerPhone: outreachInfo.buyerPhoneNumber || "",
    phone: outreachInfo.buyerPhoneNumber || "",
    buyerCalendarLink: outreachInfo.buyerCalendarLink || ""
  };

  var tokenMap = typeof buildTokenMapForPayload_ === "function"
    ? buildTokenMapForPayload_(campaignPayload, {}, {}, new Date(), offerType)
    : {};

  return {
    subject: typeof replaceAllTemplateTokens_ === "function" ? replaceAllTemplateTokens_(template.subject, tokenMap) : String(template.subject || ""),
    body: emailOutreachCleanRenderedBody_(typeof replaceAllTemplateTokens_ === "function" ? replaceAllTemplateTokens_(template.body, tokenMap) : String(template.body || ""))
  };
}

function emailOutreachCleanRenderedBody_(body) {
  return String(body || "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function emailOutreachBuildCampaignResultMessage_(summary) {
  summary = summary || {};

  var processedCount = Number(summary.processedCount || 0);
  var skippedCount = Number(summary.skippedCount || 0);
  var failedCount = Number(summary.failedCount || 0);
  var blockedCount = Number(summary.blockedCount || 0);
  var unsentCount = Number(summary.unsentCount || 0);
  var mode = summary.mode || "draft";
  var failures = summary.failures || [];
  var quotaStopped = !!summary.quotaStopped;
  var quotaMessage = String(summary.quotaMessage || "").trim();
  var finalizeResult = summary.finalizeResult || { success: true };
  var action = mode === "send" ? "sent" : "drafted";
  var notAction = mode === "send" ? "send" : "draft";
  var message = "Campaign complete: " + processedCount + " " + action + ", " + skippedCount + " skipped";

  if (failedCount > 0) {
    message += ", " + failedCount + " failed";
  }

  if (blockedCount > 0) {
    message += ", " + blockedCount + " blocked";
  }

  message += ".";

  if (unsentCount > 0) {
    message += " " + unsentCount + " email(s) did not " + notAction + ".";
  }

  if (quotaStopped) {
    message += " Gmail stopped the campaign before all selected emails could be processed.";
    if (quotaMessage) {
      message += " " + quotaMessage;
    }
  }

  if (!finalizeResult.success) {
    message += " " + (finalizeResult.message || "Sent rows could not be fully moved to Email Sent.");
  }

  if (failures.length) {
    message += " First issue: row " + failures[0].rowNumber + " (" + failures[0].email + ") - " + failures[0].message;
  }

  return message;
}

function emailOutreachGetSavedOutreachInfo_(ss) {
  var data = {
    buyerName: "",
    buyerPhoneNumber: "",
    buyerCalendarLink: "",
    buyerLlc: ""
  };

  var sf = ss.getSheetByName("Seller Financing");
  if (sf) {
    data.buyerName = String(sf.getRange("B24").getDisplayValue() || "").trim();
    data.buyerPhoneNumber = String(sf.getRange("B25").getDisplayValue() || "").trim();
    data.buyerCalendarLink = String(sf.getRange("B26").getDisplayValue() || "").trim();
    data.buyerLlc = String(sf.getRange("B27").getDisplayValue() || "").trim();
  }

  if (!data.buyerName && !data.buyerPhoneNumber && !data.buyerCalendarLink && !data.buyerLlc) {
    var subTo = ss.getSheetByName("Sub to");
    if (subTo) {
      data.buyerName = String(subTo.getRange("B20").getDisplayValue() || "").trim();
      data.buyerPhoneNumber = String(subTo.getRange("B21").getDisplayValue() || "").trim();
      data.buyerCalendarLink = String(subTo.getRange("B22").getDisplayValue() || "").trim();
      data.buyerLlc = String(subTo.getRange("B23").getDisplayValue() || "").trim();
    }
  }

  return data;
}

/* =========================
   COMMON HELPERS
========================== */

function emailOutreachNormalizeSelectedRows_(selectedRows) {
  selectedRows = selectedRows || [];
  var rowMap = {};
  var rows = [];

  for (var i = 0; i < selectedRows.length; i++) {
    var row = Number(selectedRows[i] || 0);
    if (row >= 2 && !rowMap[row]) {
      rowMap[row] = true;
      rows.push(row);
    }
  }

  rows.sort(function(a, b) { return b - a; });
  return rows;
}

function emailOutreachReadSelectedRows_(sheet, selectedRows, columnCount) {
  selectedRows = selectedRows || [];
  columnCount = Math.max(1, Number(columnCount || EMAIL_OUTREACH_LEAD_COLUMN_COUNT));

  if (!sheet || !selectedRows.length) {
    return {
      rowNumbers: [],
      rows: []
    };
  }

  var sortedRows = selectedRows.slice().sort(function(a, b) { return a - b; });
  var minRow = sortedRows[0];
  var maxRow = sortedRows[sortedRows.length - 1];
  var rowLookup = {};
  var rows = [];
  var rowNumbers = [];

  sortedRows.forEach(function(rowNumber) {
    rowLookup[rowNumber] = true;
  });

  var values = sheet.getRange(minRow, 1, maxRow - minRow + 1, columnCount).getValues();

  for (var i = 0; i < values.length; i++) {
    var rowNumber = minRow + i;
    if (!rowLookup[rowNumber]) {
      continue;
    }

    rowNumbers.push(rowNumber);
    rows.push(values[i].slice(0, columnCount));
  }

  return {
    rowNumbers: rowNumbers,
    rows: rows
  };
}

function emailOutreachFinalizeCampaignRows_(readySheet, emailSentSheet, processedReadyRows, processedRows, processedStatuses) {
  processedReadyRows = processedReadyRows || [];
  processedRows = processedRows || [];
  processedStatuses = processedStatuses || [];

  if (!processedRows.length) {
    return {
      success: true,
      movedCount: 0
    };
  }

  try {
    emailSentSheet.getRange(emailSentSheet.getLastRow() + 1, 1, processedRows.length, EMAIL_OUTREACH_LEAD_COLUMN_COUNT).setValues(processedRows);

    var deleteBlocks = emailOutreachBuildDescendingDeleteBlocks_(
      emailOutreachNormalizeSelectedRows_(processedReadyRows)
    );

    for (var i = 0; i < deleteBlocks.length; i++) {
      readySheet.deleteRows(deleteBlocks[i].startRow, deleteBlocks[i].count);
    }

    SpreadsheetApp.flush();

    return {
      success: true,
      movedCount: processedRows.length
    };
  } catch (err) {
    for (var j = 0; j < processedReadyRows.length; j++) {
      emailOutreachMarkReadyLeadStatus_(readySheet, processedReadyRows[j], processedStatuses[j] || "SENT");
    }

    SpreadsheetApp.flush();

    return {
      success: false,
      movedCount: 0,
      message: "Emails were created successfully, but Ready to Email could not be fully moved into Email Sent automatically. The processed rows were marked in place instead.",
      error: err && err.message ? err.message : String(err)
    };
  }
}

function emailOutreachFinalizeScheduledBatchRows_(scheduledSheet, emailSentSheet, processedScheduledRows, processedRows) {
  processedScheduledRows = processedScheduledRows || [];
  processedRows = processedRows || [];

  if (!processedRows.length) {
    return {
      success: true,
      movedCount: 0
    };
  }

  try {
    emailSentSheet.getRange(emailSentSheet.getLastRow() + 1, 1, processedRows.length, EMAIL_OUTREACH_LEAD_COLUMN_COUNT).setValues(processedRows);

    var deleteBlocks = emailOutreachBuildDescendingDeleteBlocks_(
      emailOutreachNormalizeSelectedRows_(processedScheduledRows)
    );

    for (var i = 0; i < deleteBlocks.length; i++) {
      scheduledSheet.deleteRows(deleteBlocks[i].startRow, deleteBlocks[i].count);
    }

    SpreadsheetApp.flush();

    return {
      success: true,
      movedCount: processedRows.length
    };
  } catch (err) {
    for (var j = 0; j < processedScheduledRows.length; j++) {
      emailOutreachMarkReadyLeadStatus_(scheduledSheet, processedScheduledRows[j], 'SENT');
    }

    SpreadsheetApp.flush();

    return {
      success: false,
      movedCount: 0,
      message: 'Emails were sent successfully, but Scheduled Emails could not be fully cleaned up automatically. The processed rows were marked SENT in place instead.',
      error: err && err.message ? err.message : String(err)
    };
  }
}

function emailOutreachMarkReadyLeadStatus_(readySheet, rowNumber, status) {
  if (!readySheet) {
    return;
  }

  rowNumber = Number(rowNumber || 0);

  if (rowNumber < 2 || rowNumber > readySheet.getLastRow()) {
    return;
  }

  readySheet.getRange(rowNumber, 5).setValue(status || "FAILED");
}

function emailOutreachIsQuotaError_(message) {
  var text = String(message || "").toLowerCase();

  return text.indexOf("quota") !== -1 ||
    text.indexOf("limit exceeded") !== -1 ||
    text.indexOf("service invoked too many times") !== -1 ||
    text.indexOf("too many times in a short time") !== -1 ||
    text.indexOf("daily sending quota") !== -1 ||
    text.indexOf("gmail") !== -1 && text.indexOf("rate") !== -1;
}

function emailOutreachMaybePauseForSendThrottle_(processedCount) {
  processedCount = Number(processedCount || 0);

  if (processedCount > 0 && processedCount % 20 === 0) {
    Utilities.sleep(500);
  }
}

function emailOutreachBuildDescendingDeleteBlocks_(selectedRows) {
  var rows = selectedRows || [];
  var blocks = [];

  if (!rows.length) {
    return blocks;
  }

  var highestRow = rows[0];
  var lowestRow = rows[0];

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];

    if (row === lowestRow - 1) {
      lowestRow = row;
      continue;
    }

    blocks.push({
      startRow: lowestRow,
      count: highestRow - lowestRow + 1
    });

    highestRow = row;
    lowestRow = row;
  }

  blocks.push({
    startRow: lowestRow,
    count: highestRow - lowestRow + 1
  });

  blocks.sort(function(a, b) {
    return b.startRow - a.startRow;
  });

  return blocks;
}

function emailOutreachArchiveRows_(ss, sourceSheet, sourceRowNumbers, sourceRows, sourceLabel, archiveSheetName) {
  sourceRowNumbers = sourceRowNumbers || [];
  sourceRows = sourceRows || [];

  if (!ss || !sourceSheet || !sourceRowNumbers.length || !sourceRows.length) {
    return {
      success: false,
      message: "No rows were available to archive."
    };
  }

  var archiveFolder = emailOutreachGetArchiveFolder_();
  var archiveFile = emailOutreachCreateArchiveSpreadsheet_(archiveFolder, archiveSheetName, sourceRows);
  var archiveSheet = emailOutreachGetOrCreateArchiveSheet_(ss);

  archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, sourceRows.length, EMAIL_OUTREACH_LEAD_COLUMN_COUNT).setValues(sourceRows);

  var deleteBlocks = emailOutreachBuildDescendingDeleteBlocks_(emailOutreachNormalizeSelectedRows_(sourceRowNumbers));
  for (var i = 0; i < deleteBlocks.length; i++) {
    sourceSheet.deleteRows(deleteBlocks[i].startRow, deleteBlocks[i].count);
  }

  SpreadsheetApp.flush();

  return {
    success: true,
    archiveFileId: archiveFile.id,
    archiveFileUrl: archiveFile.url,
    archiveFileName: archiveFile.name,
    sourceLabel: sourceLabel || "Archive"
  };
}

function emailOutreachAppendRowsToArchiveTab_(ss, rows, statusOverride) {
  rows = rows || [];
  if (!ss || !rows.length) {
    return;
  }

  var archiveSheet = emailOutreachGetOrCreateArchiveSheet_(ss);
  var rowsToAppend = rows.map(function(row) {
    var copy = emailOutreachNormalizeLeadRowValues_(row, statusOverride !== undefined ? statusOverride : "ARCHIVED");
    if (statusOverride !== undefined) {
      copy[EMAIL_OUTREACH_LEAD_STATUS_INDEX] = emailOutreachNormalizeLeadStatus_(statusOverride, statusOverride);
    }
    return copy;
  });

  archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToAppend.length, EMAIL_OUTREACH_LEAD_COLUMN_COUNT).setValues(rowsToAppend);
}

function emailOutreachGetArchiveFolder_() {
  if (typeof getArchiveFolderUrlForCurrentUser_ !== "function") {
    throw new Error("Archive folder settings are unavailable.");
  }

  var archiveFolderUrl = String(getArchiveFolderUrlForCurrentUser_() || "").trim();
  if (!archiveFolderUrl) {
    throw new Error("Archive folder is not configured. Complete onboarding folder setup first.");
  }

  if (typeof validateFolderUrlAndGetDetails_ !== "function") {
    throw new Error("Archive folder validation is unavailable.");
  }

  var details = validateFolderUrlAndGetDetails_(archiveFolderUrl, "Archived Leads Folder");
  return DriveApp.getFolderById(details.id);
}

function emailOutreachCreateArchiveSpreadsheet_(folder, archiveSheetName, rows) {
  rows = rows || [];
  rows = rows.map(function(row) {
    return emailOutreachNormalizeLeadRowValues_(row, "ARCHIVED");
  });

  var fileName = emailOutreachBuildArchiveFileName_(archiveSheetName, rows.length);
  var archiveSpreadsheet = SpreadsheetApp.create(fileName);
  var archiveSheet = archiveSpreadsheet.getSheets()[0];
  archiveSheet.setName(String(archiveSheetName || "Archive").substring(0, 99));
  archiveSheet.getRange(1, 1, 1, EMAIL_OUTREACH_LEAD_COLUMN_COUNT).setValues(EMAIL_OUTREACH_STANDARD_HEADERS);

  if (rows.length) {
    archiveSheet.getRange(2, 1, rows.length, EMAIL_OUTREACH_LEAD_COLUMN_COUNT).setValues(rows);
  }

  try {
    archiveSheet.autoResizeColumns(1, EMAIL_OUTREACH_LEAD_COLUMN_COUNT);
  } catch (e) {}

  var file = DriveApp.getFileById(archiveSpreadsheet.getId());
  file.moveTo(folder);

  return {
    id: archiveSpreadsheet.getId(),
    url: archiveSpreadsheet.getUrl(),
    name: archiveSpreadsheet.getName()
  };
}

function emailOutreachBuildArchiveFileName_(archiveSheetName, rowCount) {
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  return "Archived Leads - " + String(archiveSheetName || "Archive") + " - " + rowCount + " row(s) - " + timestamp;
}

/* =========================
   LEGACY LEAD API COMPAT
========================== */

function emailOutreachResolveLeadReference_(leadRef, leads) {
  var cleanLeadId = String(leadRef || "").trim();
  var rowNumber = Number(leadRef || 0);
  var resolvedLead = null;

  leads = leads || [];

  for (var i = 0; i < leads.length; i++) {
    if ((cleanLeadId && String(leads[i].leadId || "") === cleanLeadId) || Number(leads[i].rowNumber || 0) === rowNumber) {
      resolvedLead = leads[i];
      break;
    }
  }

  return {
    lead: resolvedLead,
    rowNumber: resolvedLead ? Number(resolvedLead.rowNumber || 0) : rowNumber,
    leadId: cleanLeadId
  };
}

function getActiveLeads() {
  var state = getEmailDashboardState();
  if (!state || state.success === false) {
    return state;
  }

  return {
    success: true,
    leads: state.leads || [],
    count: Number(state.readyLeadCount || 0)
  };
}

function getLeadById(leadId) {
  var state = getEmailDashboardState();
  if (!state || state.success === false) {
    return state;
  }

  var leads = state.leads || [];
  var resolved = emailOutreachResolveLeadReference_(leadId, leads);

  if (resolved.lead) {
    return {
      success: true,
      lead: resolved.lead
    };
  }

  return buildFailure("LEAD_NOT_FOUND", "Lead " + (resolved.leadId || resolved.rowNumber) + " was not found in Ready to Email.");
}

function updateLead(leadId, updates) {
  var state = getEmailDashboardState();
  if (!state || state.success === false) {
    return state;
  }

  var resolved = emailOutreachResolveLeadReference_(leadId, state.leads || []);
  if (!resolved.rowNumber || resolved.rowNumber < 2) {
    return buildFailure("LEAD_NOT_FOUND", "Lead " + (resolved.leadId || leadId) + " was not found in Ready to Email.");
  }

  return updateReadyToEmailLead(resolved.rowNumber, updates);
}

function bulkUpdateLeads(leadIds, updates) {
  leadIds = leadIds || [];
  var state = getEmailDashboardState();
  if (!state || state.success === false) {
    return state;
  }

  var leads = state.leads || [];
  var seenRows = {};
  var normalizedRows = [];
  var updatedCount = 0;
  var failures = [];

  for (var i = 0; i < leadIds.length; i++) {
    var resolved = emailOutreachResolveLeadReference_(leadIds[i], leads);
    var rowNumber = Number(resolved.rowNumber || 0);

    if (rowNumber >= 2 && !seenRows[rowNumber]) {
      seenRows[rowNumber] = true;
      normalizedRows.push(rowNumber);
      continue;
    }

    if (rowNumber >= 2) {
      continue;
    }

    failures.push({
      rowNumber: rowNumber,
      message: "Lead " + (resolved.leadId || leadIds[i]) + " was not found in Ready to Email."
    });
  }

  normalizedRows.sort(function(a, b) {
    return b - a;
  });

  for (var j = 0; j < normalizedRows.length; j++) {
    var result = updateReadyToEmailLead(normalizedRows[j], updates || {});
    if (!result || result.success === false) {
      failures.push({
        rowNumber: normalizedRows[j],
        message: result && result.message ? result.message : "Update failed."
      });
      continue;
    }
    updatedCount++;
  }

  return {
    success: failures.length === 0,
    updatedCount: updatedCount,
    failures: failures,
    message: failures.length
      ? "Updated " + updatedCount + " lead(s). " + failures.length + " failed."
      : "Updated " + updatedCount + " lead(s)."
  };
}

function sendMassEmailCampaign(payload) {
  payload = payload || {};
  if (payload.selectedRows && payload.selectedRows.length) {
    return runMassEmailCampaignSelected(payload);
  }
  return runMassEmailCampaign(payload);
}
