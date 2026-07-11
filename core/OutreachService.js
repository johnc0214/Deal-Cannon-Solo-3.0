/**************************************
 * Deal Cannon — OutreachService.gs
 * Core backend logic.
 *
 * Writes buyer outreach info into the authorized
 * customer workbook, not SpreadsheetApp.getActive().
 **************************************/

var OUTREACH_SERVICE_SELLER_FINANCING_SHEET = "Seller Financing";
var OUTREACH_SERVICE_SUB_TO_SHEET = "Sub to";

var OUTREACH_SERVICE_SELLER_FINANCING_CELLS = {
  buyerName: "B24",
  buyerPhoneNumber: "B25",
  buyerCalendarLink: "B26",
  buyerLlc: "B27"
};

var OUTREACH_SERVICE_SUB_TO_CELLS = {
  buyerName: "B20",
  buyerPhoneNumber: "B21",
  buyerCalendarLink: "B22",
  buyerLlc: "B23"
};

/* =========================
   PUBLIC API
========================== */

function getOutreachInfo() {
  try {
    var ctx = outreachGetCustomerSpreadsheetContext_();
    var ss = ctx.ss;

    var sellerFinanceSheet = ss.getSheetByName(OUTREACH_SERVICE_SELLER_FINANCING_SHEET);
    var subToSheet = ss.getSheetByName(OUTREACH_SERVICE_SUB_TO_SHEET);

    if (!sellerFinanceSheet) {
      throw new Error("Seller Financing sheet not found in the assigned customer workbook.");
    }

    if (!subToSheet) {
      throw new Error("Sub to sheet not found in the assigned customer workbook.");
    }

    var sellerFinanceData = outreachReadBlock_(
      sellerFinanceSheet,
      OUTREACH_SERVICE_SELLER_FINANCING_CELLS
    );

    var subToData = outreachReadBlock_(
      subToSheet,
      OUTREACH_SERVICE_SUB_TO_CELLS
    );

    /*
      Seller Financing is the primary display source.
      If it is blank but Sub to has values, fall back to Sub to.
    */
    var data = outreachHasAnyValue_(sellerFinanceData)
      ? sellerFinanceData
      : subToData;

    return {
      success: true,
      message: "Outreach info loaded.",
      data: {
        buyerName: data.buyerName || "",
        buyerPhoneNumber: data.buyerPhoneNumber || "",
        buyerCalendarLink: data.buyerCalendarLink || "",
        buyerLlc: data.buyerLlc || ""
      },
      workbook: {
        customerSheetId: ctx.user && ctx.user.customerSheetId ? ctx.user.customerSheetId : "",
        customerSheetName: ctx.user && ctx.user.customerSheetName ? ctx.user.customerSheetName : ss.getName()
      }
    };

  } catch (err) {
    return outreachFailure_("Could not load outreach info.", err);
  }
}

function saveOutreachInfo(payload) {
  try {
    payload = payload || {};

    var buyerName = outreachNormalizeValue_(payload.buyerName);
    var buyerPhoneNumber = outreachNormalizeValue_(payload.buyerPhoneNumber);
    var buyerCalendarLink = outreachNormalizeValue_(payload.buyerCalendarLink);
    var buyerLlc = outreachNormalizeValue_(payload.buyerLlc);

    var ctx = outreachGetCustomerSpreadsheetContext_();
    var ss = ctx.ss;

    var sellerFinanceSheet = ss.getSheetByName(OUTREACH_SERVICE_SELLER_FINANCING_SHEET);
    var subToSheet = ss.getSheetByName(OUTREACH_SERVICE_SUB_TO_SHEET);

    if (!sellerFinanceSheet) {
      throw new Error("Seller Financing sheet not found in the assigned customer workbook.");
    }

    if (!subToSheet) {
      throw new Error("Sub to sheet not found in the assigned customer workbook.");
    }

    var data = {
      buyerName: buyerName,
      buyerPhoneNumber: buyerPhoneNumber,
      buyerCalendarLink: buyerCalendarLink,
      buyerLlc: buyerLlc
    };

    outreachWriteBlock_(
      sellerFinanceSheet,
      OUTREACH_SERVICE_SELLER_FINANCING_CELLS,
      data
    );

    outreachWriteBlock_(
      subToSheet,
      OUTREACH_SERVICE_SUB_TO_CELLS,
      data
    );

    SpreadsheetApp.flush();

    return {
      success: true,
      message: "Outreach info saved successfully.",
      data: data,
      workbook: {
        customerSheetId: ctx.user && ctx.user.customerSheetId ? ctx.user.customerSheetId : "",
        customerSheetName: ctx.user && ctx.user.customerSheetName ? ctx.user.customerSheetName : ss.getName()
      }
    };

  } catch (err) {
    return outreachFailure_("Could not save outreach info.", err);
  }
}

/* =========================
   CUSTOMER WORKBOOK CONTEXT
========================== */

function outreachGetCustomerSpreadsheetContext_() {
  /*
    Primary path for split architecture:
    AuthService.openCustomerSpreadsheet_() validates the active Google user
    through Admin/Provisioner, then opens the assigned customerSheetId.
  */
  if (typeof openCustomerSpreadsheet_ === "function") {
    var ctx = openCustomerSpreadsheet_();

    if (!ctx || !ctx.ss) {
      throw new Error("Customer workbook context was empty.");
    }

    return {
      ss: ctx.ss,
      user: ctx.user || {}
    };
  }

  /*
    Compatibility fallback if this file is ever used in a context where
    ConfigService exposes getCustomerWorkbook_ but AuthService helper is absent.
  */
  if (typeof getCustomerWorkbook_ === "function") {
    var ssFromConfig = getCustomerWorkbook_();

    if (!ssFromConfig) {
      throw new Error("Customer workbook could not be opened.");
    }

    return {
      ss: ssFromConfig,
      user: {}
    };
  }

  /*
    Last-resort fallback for legacy/container-bound debugging only.
    The production Core library should not reach this path.
  */
  var active = SpreadsheetApp.getActiveSpreadsheet();

  if (!active) {
    throw new Error("No active spreadsheet is available and customer workbook routing is missing.");
  }

  return {
    ss: active,
    user: {}
  };
}

/* =========================
   INTERNAL HELPERS
========================== */

function outreachReadBlock_(sheet, cells) {
  return {
    buyerName: sheet.getRange(cells.buyerName).getDisplayValue(),
    buyerPhoneNumber: sheet.getRange(cells.buyerPhoneNumber).getDisplayValue(),
    buyerCalendarLink: sheet.getRange(cells.buyerCalendarLink).getDisplayValue(),
    buyerLlc: sheet.getRange(cells.buyerLlc).getDisplayValue()
  };
}

function outreachWriteBlock_(sheet, cells, data) {
  var targetRanges = [
    sheet.getRange(cells.buyerName),
    sheet.getRange(cells.buyerPhoneNumber),
    sheet.getRange(cells.buyerCalendarLink),
    sheet.getRange(cells.buyerLlc)
  ];

  targetRanges.forEach(function (range) {
    range.setNumberFormat("@");
  });

  sheet.getRange(cells.buyerName).setValue(data.buyerName || "");
  sheet.getRange(cells.buyerPhoneNumber).setValue(data.buyerPhoneNumber || "");
  sheet.getRange(cells.buyerCalendarLink).setValue(data.buyerCalendarLink || "");
  sheet.getRange(cells.buyerLlc).setValue(data.buyerLlc || "");
}

function outreachNormalizeValue_(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function outreachHasAnyValue_(data) {
  data = data || {};

  return !!(
    String(data.buyerName || "").trim() ||
    String(data.buyerPhoneNumber || "").trim() ||
    String(data.buyerCalendarLink || "").trim() ||
    String(data.buyerLlc || "").trim()
  );
}

function outreachFailure_(fallbackMessage, err) {
  var rawMessage = err && err.message ? err.message : String(err || "");
  var message = rawMessage || fallbackMessage || "Outreach service failed.";

  if (message.indexOf("WORKBOOK_ACCESS_DENIED") !== -1) {
    message = "Your account is active, but this Google account cannot access the assigned Deal Cannon workbook.";
  }

  if (message.indexOf("ONBOARDING_REQUIRED") !== -1) {
    message = "Customer workbook setup is incomplete. Check the Admin Users row and customerSheetId.";
  }

  return {
    success: false,
    message: message
  };
}