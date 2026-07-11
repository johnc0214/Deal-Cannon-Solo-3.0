/**************************************
 * Deal Cannon Core — Utils.gs
 * Shared helpers.
 **************************************/

/* =========================
   DRIVE ID EXTRACTION
========================== */

function extractId(input) {
  if (!input) {
    throw new Error("INVALID_DRIVE_ID");
  }

  var str = String(input).trim();

  /*
    Supports:
    - https://drive.google.com/drive/folders/FOLDER_ID
    - https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
    - https://docs.google.com/document/d/DOC_ID/edit
    - raw Drive IDs
  */
  var patterns = [
    /\/folders\/([a-zA-Z0-9_-]{20,})/,
    /\/d\/([a-zA-Z0-9_-]{20,})/,
    /id=([a-zA-Z0-9_-]{20,})/,
    /^([a-zA-Z0-9_-]{20,})$/
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = str.match(patterns[i]);
    if (match && match[1]) {
      return match[1];
    }
  }

  var fallback = str.match(/[a-zA-Z0-9_-]{25,}/);

  if (!fallback) {
    throw new Error("INVALID_DRIVE_ID");
  }

  return fallback[0];
}


/* =========================
   SAFE TYPE HELPERS
========================== */

function safeNumber(value, defaultValue) {
  if (defaultValue === undefined) {
    defaultValue = 0;
  }

  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === "number") {
    return isNaN(value) ? defaultValue : value;
  }

  var str = String(value).trim();

  if (!str) {
    return defaultValue;
  }

  str = str.replace(/,/g, "");

  var isPercent = str.indexOf("%") !== -1;

  str = str.replace(/[^0-9.\-]/g, "");

  if (!str || str === "-" || str === "." || str === "-.") {
    return defaultValue;
  }

  var num = parseFloat(str);

  if (isNaN(num)) {
    return defaultValue;
  }

  return num;
}

function safeString(value, defaultValue) {
  if (defaultValue === undefined) {
    defaultValue = "";
  }

  if (value === undefined || value === null) {
    return defaultValue;
  }

  return String(value).trim();
}

function safeUpper(value, defaultValue) {
  return safeString(value, defaultValue || "").toUpperCase();
}

function safeLower(value, defaultValue) {
  return safeString(value, defaultValue || "").toLowerCase();
}


/* =========================
   VALIDATION
========================== */

function assertRequired(obj, fields, contextLabel) {
  obj = obj || {};
  fields = fields || [];

  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    var v = obj[field];

    if (
      v === undefined ||
      v === null ||
      (typeof v === "string" && v.trim() === "")
    ) {
      throw new Error(
        "VALIDATION_ERROR: Missing '" + field + "' in " + (contextLabel || "request")
      );
    }
  }
}

function isValidEmail_(email) {
  var value = safeString(email);

  if (!value) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function assertValidEmail_(email, label) {
  if (!isValidEmail_(email)) {
    throw new Error((label || "Email") + " is invalid.");
  }

  return safeString(email);
}


/* =========================
   RESPONSE BUILDERS
========================== */

function buildSuccess(data) {
  return {
    success: true,
    data: data || null
  };
}

function buildFailure(code, message, details) {
  return {
    success: false,
    error: {
      code: code || "SERVER_ERROR",
      message: message || "An unexpected error occurred.",
      details: details || null
    },
    message: message || "An unexpected error occurred."
  };
}


/* =========================
   FORMATTING
========================== */

function formatCurrency(value) {
  var num = safeNumber(value, 0);

  return "$" + num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPercent(value) {
  var num = safeNumber(value, 0);

  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + "%";
}

function formatPlainNumber(value) {
  var num = safeNumber(value, 0);

  return num.toLocaleString("en-US", {
    maximumFractionDigits: 2
  });
}


/* =========================
   DATE HELPERS
========================== */

function formatDateTime_(date) {
  var d = date || new Date();

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );
}

function formatDateOnly_(date) {
  var d = date || new Date();

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );
}


/* =========================
   STRING HELPERS
========================== */

function escapeRegExp_(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncateString_(value, maxLength) {
  var text = safeString(value);
  var max = Number(maxLength || 0);

  if (!max || text.length <= max) {
    return text;
  }

  return text.slice(0, max);
}