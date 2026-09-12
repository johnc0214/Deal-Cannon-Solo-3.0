/**************************************
 * Deal Cannon Provisioner — Code.gs
 * Standalone Apps Script web app.
 *
 * Owns:
 * - Admin Users sheet
 * - Customer workbook creation
 * - Admin writeback
 * - Folder URL storage
 *
 * Core customers do NOT need access to Admin.
 **************************************/

var PROVISIONER_SECRET = "dc_9Kx82mLqPz_2026_private_checkout_secret_7719";

var ADMIN_SPREADSHEET_ID = "14uobOYHr038sQDCmoJ7PNq4dAVvVkXopv2RqVI1hEL0";
var ADMIN_USERS_TAB_NAME = "Users";

// Use the stable Solo 3.0 web app URL so generated links do not break on each versioned deploy.
var DEAL_CANNON_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw70WUXPolZNa5V859H27zyrWILBAPZlT4lrOCvgXhb/exec";
var MASTER_TEMPLATE_SPREADSHEET_ID = "1ZVmXRwx75xe_-npuWgaa20LdCpz8SOq2w_m4kp7RMc0";
/* =========================
   WEB APP ENTRYPOINT
========================== */

function doPost(e) {
  try {
    var body = parseProvisionerBody_(e);
    validateProvisionerSecret_(body);

    var action = String(body.action || "").trim();

    if (action === "getCustomerAccess") {
      var access = getCustomerAccess_(body);
      return jsonResponse_(buildCustomerAccessResponse_(access));
    }

    if (action === "ensureCustomerWorkbook") {
      return jsonResponse_({
        success: true,
        data: ensureCustomerWorkbook_(body)
      });
    }

    if (action === "registerCustomerWorkbook") {
      return jsonResponse_({
        success: true,
        data: registerCustomerWorkbook_(body)
      });
    }

    if (action === "saveFolderSettings") {
      return jsonResponse_({
        success: true,
        data: saveFolderSettings_(body)
      });
    }

    return jsonResponse_({
      success: true,
      data: handlePaymentOrStatusEvent_(body)
    });

  } catch (err) {
    return jsonResponse_({
      success: false,
      message: err && err.message ? err.message : String(err)
    });
  }
}

function doGet() {
  return jsonResponse_({
    success: true,
    service: "Deal Cannon Provisioner",
    message: "Provisioner is online."
  });
}

/* =========================
   CUSTOMER ACCESS
========================== */

function getCustomerAccess_(body) {
  body = body || {};

  var normalizedEmail = normalizeEmail_(body.userEmail || body.email || body.normalizedEmail || "");
  var incomingCustomerSheetId = cleanCustomerSheetIdForResponse_(body.customerSheetId || "");

  if (!normalizedEmail) {
    throw new Error("Missing email for customer access lookup.");
  }

  var existing = findAdminUserByEmail_(normalizedEmail);

  if (!existing || !existing.rowNumber) {
    return {
      approved: false,
      authorized: false,
      email: normalizedEmail,
      userEmail: normalizedEmail,
      normalizedEmail: normalizedEmail,
      fullName: "",
      status: "",
      active: false,
      customerSheetId: "",
      customerSheetName: "",
      folderIdDefault: "",
      loiFolderUrl: "",
      loiFolderId: "",
      archiveFolderUrl: "",
      archiveFolderId: "",
      onboardingCompleteAt: "",
      onboardingRequired: true,
      reason: "ACCESS_DENIED: Your email is not approved."
    };
  }

  var status = String(existing.status || "").trim().toUpperCase();
  var customerSheetId = cleanCustomerSheetIdForResponse_(existing.customerSheetId || "");
  var loiFolderUrl = String(existing.loiFolderUrl || "").trim();
  var archiveFolderUrl = String(existing.archiveFolderUrl || "").trim();
  var isActive = isProvisionerActiveStatus_(status);

  if (incomingCustomerSheetId && customerSheetId && incomingCustomerSheetId !== customerSheetId) {
    return {
      approved: false,
      authorized: false,
      email: existing.email || normalizedEmail,
      userEmail: existing.email || normalizedEmail,
      normalizedEmail: normalizedEmail,
      status: status,
      active: false,
      customerSheetId: "",
      customerSheetName: "",
      onboardingRequired: true,
      reason: "ACCESS_DENIED: Customer workbook mismatch."
    };
  }

  return {
    approved: isActive,
    authorized: isActive,
    email: existing.email || normalizedEmail,
    userEmail: existing.email || normalizedEmail,
    normalizedEmail: normalizedEmail,
    fullName: existing.fullName || "",
    status: status,
    active: isActive,
    customerSheetId: customerSheetId,
    customerSheetName: customerSheetId ? existing.customerSheetName || "" : "",
    folderIdDefault: existing.folderIdDefault || "",
    loiFolderUrl: loiFolderUrl,
    loiFolderId: existing.loiFolderId || "",
    archiveFolderUrl: archiveFolderUrl,
    archiveFolderId: existing.archiveFolderId || "",
    onboardingCompleteAt: existing.onboardingCompleteAt || "",
    onboardingRequired: isActive && (!customerSheetId || !loiFolderUrl || !archiveFolderUrl),
    notes: existing.notes || "",
    stripeCustomerId: existing.stripeCustomerId || "",
    stripeSubscriptionId: existing.stripeSubscriptionId || "",
    stripePriceId: existing.stripePriceId || "",
    stripePaymentStatus: existing.stripePaymentStatus || "",
    lastStripeEventId: existing.lastStripeEventId || "",
    accessRevokedAt: existing.accessRevokedAt || ""
  };
}

function isProvisionerActiveStatus_(status) {
  status = String(status || "").trim().toUpperCase();
  return status === "ACTIVE" || status === "APPROVED" || status === "ENABLED";
}

function buildCustomerAccessResponse_(access) {
  access = access || {};

  var response = {
    success: true,
    data: access
  };

  [
    "approved",
    "authorized",
    "email",
    "userEmail",
    "normalizedEmail",
    "fullName",
    "status",
    "active",
    "customerSheetId",
    "customerSheetName",
    "folderIdDefault",
    "loiFolderUrl",
    "loiFolderId",
    "archiveFolderUrl",
    "archiveFolderId",
    "onboardingCompleteAt",
    "onboardingRequired",
    "reason"
  ].forEach(function(key) {
    if (access[key] !== undefined) {
      response[key] = access[key];
    }
  });

  return response;
}

/* =========================
   CUSTOMER WORKBOOK CREATION
========================== */

function ensureCustomerWorkbook_(body) {
  body = body || {};

  var normalizedEmail = normalizeEmail_(body.email || body.normalizedEmail || "");

  if (!normalizedEmail) {
    throw new Error("Missing email for workbook provisioning.");
  }

  var existing = findAdminUserByEmail_(normalizedEmail);

  if (!existing || !existing.rowNumber) {
    throw new Error("Cannot create workbook. Admin user not found: " + normalizedEmail);
  }

  var status = String(existing.status || "").trim().toUpperCase();

  if (status !== "ACTIVE") {
    throw new Error("Cannot create workbook. Admin user is not ACTIVE.");
  }

  var existingSheetId = cleanCustomerSheetIdForResponse_(existing.customerSheetId || "");

  if (existingSheetId) {
    try {
      var existingSpreadsheet = SpreadsheetApp.openById(existingSheetId);
      var existingName = existingSpreadsheet.getName();
      ensureCustomerWorkbookEditor_(existingSheetId, normalizedEmail);

      return {
        email: existing.email || normalizedEmail,
        normalizedEmail: normalizedEmail,
        status: "ACTIVE",
        customerSheetId: existingSheetId,
        customerSheetName: existing.customerSheetName || existingName,
        workbookCreated: false,
        workbookReady: true
      };
    } catch (err) {
      existingSheetId = "";
    }
  }

  var templateFile = DriveApp.getFileById(MASTER_TEMPLATE_SPREADSHEET_ID);
  templateFile.getName();

  var copyName = buildCustomerWorkbookName_(existing);
  var copyFile = templateFile.makeCopy(copyName);

  ensureCustomerWorkbookEditor_(copyFile.getId(), normalizedEmail);

  var copiedSpreadsheet = SpreadsheetApp.openById(copyFile.getId());

  cleanNewCustomerWorkbook_(copiedSpreadsheet);

  updateAdminUser_(existing.rowNumber, mergeUserRow_(existing, {
    status: "ACTIVE",
    customerSheetId: copiedSpreadsheet.getId(),
    customerSheetName: copiedSpreadsheet.getName(),
    notes: "Customer workbook created by provisioner onboarding."
  }));

  SpreadsheetApp.flush();

  return {
    email: existing.email || normalizedEmail,
    normalizedEmail: normalizedEmail,
    status: "ACTIVE",
    customerSheetId: copiedSpreadsheet.getId(),
    customerSheetName: copiedSpreadsheet.getName(),
    workbookCreated: true,
    workbookReady: true
  };
}

function registerCustomerWorkbook_(body) {
  body = body || {};

  var normalizedEmail = normalizeEmail_(body.email || body.normalizedEmail || "");
  var customerSheetId = String(body.customerSheetId || "").trim();
  var customerSheetName = String(body.customerSheetName || "").trim();

  if (!normalizedEmail) {
    throw new Error("Missing email for workbook registration.");
  }

  if (!customerSheetId) {
    throw new Error("Missing customerSheetId for workbook registration.");
  }

  if (customerSheetId === MASTER_TEMPLATE_SPREADSHEET_ID) {
    throw new Error("Cannot register the master template as a customer workbook.");
  }

  var existing = findAdminUserByEmail_(normalizedEmail);

  if (!existing || !existing.rowNumber) {
    throw new Error("Cannot register workbook. Admin user not found: " + normalizedEmail);
  }

  var status = String(existing.status || "").trim().toUpperCase();

  if (status !== "ACTIVE") {
    throw new Error("Cannot register workbook. Admin user is not ACTIVE.");
  }

  ensureCustomerWorkbookEditor_(customerSheetId, normalizedEmail);

  updateAdminUser_(existing.rowNumber, mergeUserRow_(existing, {
    status: "ACTIVE",
    customerSheetId: customerSheetId,
    customerSheetName: customerSheetName || existing.customerSheetName || "",
    notes: "Customer workbook registered by web app onboarding."
  }));

  return {
    email: existing.email || normalizedEmail,
    normalizedEmail: normalizedEmail,
    status: "ACTIVE",
    customerSheetId: customerSheetId,
    customerSheetName: customerSheetName || existing.customerSheetName || "",
    registeredWorkbook: true
  };
}

/* =========================
   FOLDER SETTINGS
========================== */

function saveFolderSettings_(body) {
  body = body || {};

  var normalizedEmail = normalizeEmail_(body.email || body.normalizedEmail || "");

  if (!normalizedEmail) {
    throw new Error("Missing email for folder settings.");
  }

  var existing = findAdminUserByEmail_(normalizedEmail);

  if (!existing || !existing.rowNumber) {
    throw new Error("Cannot save folder settings. Admin user not found: " + normalizedEmail);
  }

  var status = String(existing.status || "").trim().toUpperCase();

  if (status !== "ACTIVE") {
    throw new Error("Cannot save folder settings. Admin user is not ACTIVE.");
  }

  var loiFolderUrl = String(body.loiFolderUrl || "").trim();
  var loiFolderId = String(body.loiFolderId || "").trim();
  var archiveFolderUrl = String(body.archiveFolderUrl || "").trim();
  var archiveFolderId = String(body.archiveFolderId || "").trim();

  if (!loiFolderUrl || !loiFolderId) {
    throw new Error("Missing LOI folder URL or ID.");
  }

  if (!archiveFolderUrl || !archiveFolderId) {
    throw new Error("Missing Archive folder URL or ID.");
  }

  var customerSheetId = cleanCustomerSheetIdForResponse_(existing.customerSheetId || "");
  if (customerSheetId) {
    ensureCustomerWorkbookEditor_(customerSheetId, normalizedEmail);
  }

  var now = formatProvisionerDateTime_(new Date());

  updateAdminUser_(existing.rowNumber, mergeUserRow_(existing, {
    status: "ACTIVE",
    folderIdDefault: loiFolderId,
    loiFolderUrl: loiFolderUrl,
    loiFolderId: loiFolderId,
    archiveFolderUrl: archiveFolderUrl,
    archiveFolderId: archiveFolderId,
    onboardingCompleteAt: now,
    notes: "Folder settings saved by web app onboarding."
  }));

  return {
    email: existing.email || normalizedEmail,
    normalizedEmail: normalizedEmail,
    status: "ACTIVE",
    customerSheetId: cleanCustomerSheetIdForResponse_(existing.customerSheetId || ""),
    customerSheetName: existing.customerSheetName || "",
    folderIdDefault: loiFolderId,
    loiFolderUrl: loiFolderUrl,
    loiFolderId: loiFolderId,
    archiveFolderUrl: archiveFolderUrl,
    archiveFolderId: archiveFolderId,
    onboardingCompleteAt: now,
    onboardingComplete: true
  };
}

/* =========================
   PAYMENT / STATUS EVENTS
========================== */

function handlePaymentOrStatusEvent_(body) {
  body = body || {};

  var eventType = String(body.eventType || body.type || "").trim();
  var eventId = String(body.eventId || body.id || "").trim();

  var email = normalizeEmail_(body.email || body.customerEmail || body.buyerEmail || "");
  var fullName = String(body.fullName || body.name || body.customerName || "").trim();

  var stripeCustomerId = String(body.stripeCustomerId || body.customer || "").trim();
  var stripeSubscriptionId = String(body.stripeSubscriptionId || body.subscription || "").trim();
  var stripePriceId = String(body.stripePriceId || body.priceId || "").trim();
  var stripePaymentStatus = String(body.stripePaymentStatus || body.paymentStatus || "").trim();

  if (isCancellationEvent_(eventType)) {
    return updateCustomerAccessStatusSmart_({
      email: email,
      status: "INACTIVE",
      notes: "Subscription canceled. Access set to inactive.",
      stripeCustomerId: stripeCustomerId,
      stripeSubscriptionId: stripeSubscriptionId,
      stripePriceId: stripePriceId,
      stripePaymentStatus: stripePaymentStatus || "canceled",
      lastStripeEventId: eventId
    });
  }

  if (isPastDueEvent_(eventType)) {
    return updateCustomerAccessStatusSmart_({
      email: email,
      status: "PAST_DUE",
      notes: "Payment failed or subscription past due.",
      stripeCustomerId: stripeCustomerId,
      stripeSubscriptionId: stripeSubscriptionId,
      stripePriceId: stripePriceId,
      stripePaymentStatus: stripePaymentStatus || "past_due",
      lastStripeEventId: eventId
    });
  }

  if (isInactiveEvent_(eventType)) {
    return updateCustomerAccessStatusSmart_({
      email: email,
      status: "INACTIVE",
      notes: "Access made inactive by payment automation.",
      stripeCustomerId: stripeCustomerId,
      stripeSubscriptionId: stripeSubscriptionId,
      stripePriceId: stripePriceId,
      stripePaymentStatus: stripePaymentStatus || "inactive",
      lastStripeEventId: eventId
    });
  }

  return activatePaidCustomer_(email, fullName, {
    eventType: eventType,
    eventId: eventId,
    stripeCustomerId: stripeCustomerId,
    stripeSubscriptionId: stripeSubscriptionId,
    stripePriceId: stripePriceId,
    stripePaymentStatus: stripePaymentStatus || "paid"
  });
}

function activatePaidCustomer_(email, fullName, meta) {
  meta = meta || {};

  var normalizedEmail = normalizeEmail_(email);

  if (!normalizedEmail) {
    throw new Error("Missing customer email for active provisioning event.");
  }

  var existing = findAdminUserByEmail_(normalizedEmail);
  var existingSheetId = existing ? cleanCustomerSheetIdForResponse_(existing.customerSheetId || "") : "";

  if (existingSheetId) {
    ensureCustomerWorkbookEditor_(existingSheetId, normalizedEmail);
  }

  var rowData = mergeUserRow_(existing || {}, {
    email: email || normalizedEmail,
    normalizedEmail: normalizedEmail,
    fullName: fullName || (existing && existing.fullName) || "",
    status: "ACTIVE",
    customerSheetId: existingSheetId,
    customerSheetName: existingSheetId ? (existing.customerSheetName || "") : "",
    notes: existingSheetId
      ? "Reactivated by provisioner. Existing workbook preserved."
      : "Paid customer logged by payment automation. Awaiting web app onboarding.",
    stripeCustomerId: meta.stripeCustomerId || (existing && existing.stripeCustomerId) || "",
    stripeSubscriptionId: meta.stripeSubscriptionId || (existing && existing.stripeSubscriptionId) || "",
    stripePriceId: meta.stripePriceId || (existing && existing.stripePriceId) || "",
    stripePaymentStatus: meta.stripePaymentStatus || "paid",
    lastStripeEventId: meta.eventId || (existing && existing.lastStripeEventId) || "",
    accessRevokedAt: ""
  });

  if (existing && existing.rowNumber) {
    updateAdminUser_(existing.rowNumber, rowData);
  } else {
    appendAdminUser_(rowData);
  }

  return {
    email: email || normalizedEmail,
    normalizedEmail: normalizedEmail,
    status: "ACTIVE",
    customerSheetId: rowData.customerSheetId,
    customerSheetName: rowData.customerSheetName,
    onboardingRequired: !rowData.customerSheetId || !rowData.loiFolderUrl || !rowData.archiveFolderUrl,
    webAppUrl: DEAL_CANNON_WEB_APP_URL
  };
}

function updateCustomerAccessStatusSmart_(data) {
  data = data || {};

  var normalizedEmail = normalizeEmail_(data.email || "");
  var stripeCustomerId = String(data.stripeCustomerId || "").trim();
  var stripeSubscriptionId = String(data.stripeSubscriptionId || "").trim();

  if (!normalizedEmail && !stripeCustomerId && !stripeSubscriptionId) {
    throw new Error("Missing email, stripeCustomerId, or stripeSubscriptionId for status update.");
  }

  var existing = normalizedEmail ? findAdminUserByEmail_(normalizedEmail) : null;

  if (!existing && (stripeCustomerId || stripeSubscriptionId)) {
    existing = findAdminUserByStripeRefs_(stripeCustomerId, stripeSubscriptionId);
  }

  var newStatus = String(data.status || "INACTIVE").trim().toUpperCase();
  var revokedAt = newStatus === "ACTIVE" ? "" : formatProvisionerDateTime_(new Date());

  if (!existing || !existing.rowNumber) {
    appendAdminUser_({
      email: normalizedEmail || "",
      normalizedEmail: normalizedEmail || "",
      fullName: "",
      status: newStatus,
      customerSheetId: "",
      customerSheetName: "",
      folderIdDefault: "",
      loiFolderUrl: "",
      loiFolderId: "",
      archiveFolderUrl: "",
      archiveFolderId: "",
      onboardingCompleteAt: "",
      notes: data.notes || "Status update received before provisioning.",
      stripeCustomerId: stripeCustomerId,
      stripeSubscriptionId: stripeSubscriptionId,
      stripePriceId: data.stripePriceId || "",
      stripePaymentStatus: data.stripePaymentStatus || "",
      lastStripeEventId: data.lastStripeEventId || "",
      accessRevokedAt: revokedAt
    });

    return {
      email: normalizedEmail || "",
      normalizedEmail: normalizedEmail || "",
      status: newStatus,
      customerSheetId: "",
      createdStatusOnlyRow: true
    };
  }

  updateAdminUser_(existing.rowNumber, mergeUserRow_(existing, {
    email: normalizedEmail || existing.email || "",
    normalizedEmail: normalizedEmail || existing.normalizedEmail || "",
    status: newStatus,
    customerSheetId: cleanCustomerSheetIdForResponse_(existing.customerSheetId || ""),
    customerSheetName: cleanCustomerSheetIdForResponse_(existing.customerSheetId || "") ? existing.customerSheetName || "" : "",
    notes: data.notes || "",
    stripeCustomerId: stripeCustomerId || existing.stripeCustomerId || "",
    stripeSubscriptionId: stripeSubscriptionId || existing.stripeSubscriptionId || "",
    stripePriceId: data.stripePriceId || existing.stripePriceId || "",
    stripePaymentStatus: data.stripePaymentStatus || "",
    lastStripeEventId: data.lastStripeEventId || "",
    accessRevokedAt: revokedAt
  }));

  return {
    email: normalizedEmail || existing.email || "",
    normalizedEmail: normalizedEmail || existing.normalizedEmail || "",
    status: newStatus,
    customerSheetId: cleanCustomerSheetIdForResponse_(existing.customerSheetId || ""),
    updatedExistingUser: true
  };
}

/* =========================
   ADMIN SHEET
========================== */

function getAdminSheet_() {
  var ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(ADMIN_USERS_TAB_NAME);

  if (!sheet) {
    throw new Error("Admin Users tab not found.");
  }

  ensureAdminHeaders_(sheet);

  return sheet;
}

function getRequiredAdminHeaders_() {
  return [
    "email",
    "normalizedEmail",
    "fullName",
    "status",
    "customerSheetId",
    "customerSheetName",
    "folderIdDefault",
    "loiFolderUrl",
    "loiFolderId",
    "archiveFolderUrl",
    "archiveFolderId",
    "onboardingCompleteAt",
    "notes",
    "stripeCustomerId",
    "stripeSubscriptionId",
    "stripePriceId",
    "stripePaymentStatus",
    "lastStripeEventId",
    "accessRevokedAt",
    "createdAt",
    "updatedAt"
  ];
}

function ensureAdminHeaders_(sheet) {
  var required = getRequiredAdminHeaders_();

  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, required.length).setValues([required]);
    return;
  }

  var lastColumn = Math.max(sheet.getLastColumn(), required.length);
  var existing = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];

  var cleanExisting = existing.map(function(h) {
    return String(h || "").trim();
  });

  var changed = false;

  required.forEach(function(header) {
    if (cleanExisting.indexOf(header) === -1) {
      cleanExisting.push(header);
      changed = true;
    }
  });

  while (cleanExisting.length && cleanExisting[cleanExisting.length - 1] === "") {
    cleanExisting.pop();
  }

  if (changed || cleanExisting.length < required.length) {
    sheet.getRange(1, 1, 1, cleanExisting.length).setValues([cleanExisting]);
  }
}

function getAdminData_() {
  var sheet = getAdminSheet_();
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();

  if (lastRow < 1 || lastColumn < 1) {
    return {
      sheet: sheet,
      headers: [],
      headerMap: {},
      rows: []
    };
  }

  var values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
  var headers = values[0].map(function(h) {
    return String(h || "").trim();
  });

  return {
    sheet: sheet,
    headers: headers,
    headerMap: buildHeaderMap_(headers),
    rows: values.slice(1)
  };
}

function buildHeaderMap_(headers) {
  var map = {};

  headers.forEach(function(header, index) {
    var key = normalizeHeader_(header);

    if (key) {
      map[key] = index;
    }
  });

  return map;
}

function normalizeHeader_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getRowValue_(row, headerMap, headerName) {
  var index = headerMap[normalizeHeader_(headerName)];

  if (index === undefined || index === null || index < 0) {
    return "";
  }

  return row[index] || "";
}

function rowToAdminUser_(row, rowNumber, headers, headerMap) {
  var obj = {
    rowNumber: rowNumber
  };

  getRequiredAdminHeaders_().forEach(function(header) {
    obj[header] = getRowValue_(row, headerMap, header);
  });

  obj.email = obj.email || "";
  obj.normalizedEmail = normalizeEmail_(obj.normalizedEmail || obj.email || "");
  obj.fullName = obj.fullName || "";
  obj.status = String(obj.status || "").trim().toUpperCase();

  return obj;
}

function findAdminUserByEmail_(email) {
  var normalizedEmail = normalizeEmail_(email);
  var data = getAdminData_();

  for (var i = 0; i < data.rows.length; i++) {
    var obj = rowToAdminUser_(data.rows[i], i + 2, data.headers, data.headerMap);

    if (
      normalizeEmail_(obj.normalizedEmail) === normalizedEmail ||
      normalizeEmail_(obj.email) === normalizedEmail
    ) {
      return obj;
    }
  }

  return null;
}

function findAdminUserByStripeRefs_(stripeCustomerId, stripeSubscriptionId) {
  stripeCustomerId = String(stripeCustomerId || "").trim();
  stripeSubscriptionId = String(stripeSubscriptionId || "").trim();

  if (!stripeCustomerId && !stripeSubscriptionId) {
    return null;
  }

  var data = getAdminData_();

  for (var i = 0; i < data.rows.length; i++) {
    var obj = rowToAdminUser_(data.rows[i], i + 2, data.headers, data.headerMap);

    if (
      (stripeCustomerId && String(obj.stripeCustomerId || "").trim() === stripeCustomerId) ||
      (stripeSubscriptionId && String(obj.stripeSubscriptionId || "").trim() === stripeSubscriptionId)
    ) {
      return obj;
    }
  }

  return null;
}

function appendAdminUser_(data) {
  var sheet = getAdminSheet_();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var row = buildAdminRow_(headers, data, true);

  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);

  SpreadsheetApp.flush();

  return data;
}

function updateAdminUser_(rowNumber, data) {
  var sheet = getAdminSheet_();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var row = buildAdminRow_(headers, data, false);

  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);

  SpreadsheetApp.flush();

  return data;
}

function buildAdminRow_(headers, data, isNew) {
  data = data || {};

  var now = formatProvisionerDateTime_(new Date());

  if (isNew && !data.createdAt) {
    data.createdAt = now;
  }

  data.updatedAt = now;

  return headers.map(function(header) {
    var key = String(header || "").trim();

    if (!key) {
      return "";
    }

    if (data[key] !== undefined && data[key] !== null) {
      return data[key];
    }

    return "";
  });
}

function mergeUserRow_(existing, updates) {
  existing = existing || {};
  updates = updates || {};

  var merged = {};

  getRequiredAdminHeaders_().forEach(function(header) {
    merged[header] = existing[header] || "";
  });

  Object.keys(updates).forEach(function(key) {
    merged[key] = updates[key];
  });

  if (!merged.normalizedEmail) {
    merged.normalizedEmail = normalizeEmail_(merged.email || "");
  }

  return merged;
}

function ensureCustomerWorkbookEditor_(customerSheetId, userEmail) {
  customerSheetId = cleanCustomerSheetIdForResponse_(customerSheetId || "");
  userEmail = normalizeEmail_(userEmail || "");

  if (!customerSheetId) {
    return false;
  }

  if (customerSheetId === ADMIN_SPREADSHEET_ID) {
    throw new Error("Refusing to share the private Admin spreadsheet.");
  }

  var editors = [];
  var seen = {};

  [userEmail].forEach(function(email) {
    var normalized = normalizeEmail_(email || "");
    if (!normalized || seen[normalized]) {
      return;
    }
    seen[normalized] = true;
    editors.push(normalized);
  });

  if (!editors.length) {
    return false;
  }

  try {
    var file = DriveApp.getFileById(customerSheetId);
    editors.forEach(function(email) {
      file.addEditor(email);
      console.log("Customer workbook editor ensured for " + email + " on " + customerSheetId + ".");
    });
    return true;
  } catch (err) {
    console.log("Could not ensure customer workbook editor for " + editors.join(", ") + ": " + (err && err.message ? err.message : String(err)));
    throw err;
  }
}

/* =========================
   WORKBOOK CLEANUP
========================== */

function cleanNewCustomerWorkbook_(ss) {
  var sheets = ss.getSheets();

  sheets.forEach(function(sheet) {
    clearKnownFolderCells_(sheet);
  });

  syncMasterTemplatesSheet_(ss);

  SpreadsheetApp.flush();
}

function clearKnownFolderCells_(sheet) {
  var name = sheet.getName();

  var cells = [];

  if (name === "Cash") {
    cells = ["B13", "B15"];
  } else if (name === "Seller Financing") {
    cells = ["B20", "B22"];
  } else if (name === "Sub to") {
    cells = ["B16", "B18"];
  }

  cells.forEach(function(a1) {
    try {
      sheet.getRange(a1).setValue("");
    } catch (err) {}
  });
}

function syncMasterTemplatesSheet_(targetSpreadsheet) {
  try {
    var masterSpreadsheet = SpreadsheetApp.openById(MASTER_TEMPLATE_SPREADSHEET_ID);
    var sourceSheet = masterSpreadsheet.getSheetByName('Templates') || masterSpreadsheet.getSheetByName('Email Templates Config');

    if (!sourceSheet) {
      return;
    }

    var targetSheet = targetSpreadsheet.getSheetByName('Templates') || targetSpreadsheet.getSheetByName('Email Templates Config');

    if (!targetSheet) {
      targetSheet = targetSpreadsheet.insertSheet('Templates');
    }

    if (targetSheet.getName() !== 'Templates') {
      try {
        targetSheet.setName('Templates');
      } catch (renameErr) {}
    }

    var values = sourceSheet.getDataRange().getValues();

    if (!values.length || !values[0].length) {
      return;
    }

    ensureProvisionerSheetSize_(targetSheet, values.length, values[0].length);
    targetSheet.clearContents();
    targetSheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  } catch (err) {
    console.log('Could not sync master template sheet to new customer workbook: ' + (err && err.message ? err.message : String(err)));
  }
}

function ensureProvisionerSheetSize_(sheet, requiredRows, requiredColumns) {
  requiredRows = Math.max(1, Number(requiredRows || 1));
  requiredColumns = Math.max(1, Number(requiredColumns || 1));

  if (sheet.getMaxRows() < requiredRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  }

  if (sheet.getMaxColumns() < requiredColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
  }
}

/* =========================
   HELPERS
========================== */

function parseProvisionerBody_(e) {
  if (!e) {
    return {};
  }

  if (e.postData && e.postData.contents) {
    var text = String(e.postData.contents || "").trim();

    if (text) {
      try {
        return JSON.parse(text);
      } catch (err) {}
    }
  }

  return e.parameter || {};
}

function validateProvisionerSecret_(body) {
  var incoming = String((body || {}).secret || "").trim();

  if (!incoming || incoming !== PROVISIONER_SECRET) {
    throw new Error("INVALID_SECRET");
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeEmail_(email) {
  return String(email || "").trim().toLowerCase();
}

function cleanCustomerSheetIdForResponse_(customerSheetId) {
  customerSheetId = String(customerSheetId || "").trim();

  if (!customerSheetId) {
    return "";
  }

  if (customerSheetId === MASTER_TEMPLATE_SPREADSHEET_ID) {
    return "";
  }

  return customerSheetId;
}

function buildCustomerWorkbookName_(user) {
  user = user || {};

  var base = user.fullName || user.email || user.normalizedEmail || "Customer";

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

function formatProvisionerDateTime_(date) {
  return Utilities.formatDate(
    date || new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );
}

function isCancellationEvent_(eventType) {
  var type = String(eventType || "").toLowerCase();

  return (
    type.indexOf("cancel") !== -1 ||
    type === "customer.subscription.deleted"
  );
}

function isPastDueEvent_(eventType) {
  var type = String(eventType || "").toLowerCase();

  return (
    type.indexOf("payment_failed") !== -1 ||
    type.indexOf("past_due") !== -1 ||
    type === "invoice.payment_failed"
  );
}

function isInactiveEvent_(eventType) {
  var type = String(eventType || "").toLowerCase();

  return (
    type.indexOf("inactive") !== -1 ||
    type.indexOf("expired") !== -1
  );
}
function testJohnEnsureCustomerWorkbook() {
  var result = ensureCustomerWorkbook_({
    email: "john@crystalestates.org",
    normalizedEmail: "john@crystalestates.org"
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testJohnGetCustomerAccess() {
  var result = getCustomerAccess_({
    email: "john@crystalestates.org",
    normalizedEmail: "john@crystalestates.org"
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
