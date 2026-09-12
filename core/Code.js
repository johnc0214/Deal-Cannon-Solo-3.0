/**************************************
 * Deal Cannon Core v2 ΓÇö Code.gs
 * Public API + LOI generation router.
 *
 * This file belongs in:
 * DealCannonCore v2
 *
 * The Starter shell calls:
 *   DealCannonCorev2.forceAuth()
 *   DealCannonCorev2.generate(type, payload)
 *
 * Core owns:
 *   - customer workbook lookup
 *   - sheet writes
 *   - PDF/doc generation
 *   - Gmail draft creation
 **************************************/


/* =========================
   PUBLIC API ΓÇö AUTH
========================== */

function forceAuth() {
  var email = "";

  try {
    email = Session.getActiveUser().getEmail();
  } catch (err) {
    email = "";
  }

  /*
    These calls intentionally touch the scopes the app needs:
    - Drive
    - Spreadsheet
    - Docs
    - Gmail
    - External request / licensing indirectly through getAppContext
  */
  DriveApp.getRootFolder().getName();

  try {
    requireApprovedUser_();
  } catch (err2) {
    var authMsg = err2 && err2.message ? err2.message : String(err2);
    if (authMsg.indexOf("ONBOARDING_REQUIRED") !== -1) {
      /*
        User IS approved + active - just missing the workbook.
        Return success; workbook creation is a separate onboarding step.
        The auth scopes have already been triggered before this.
      */
      return {
        success: true,
        email: email || "",
        message: "Google account authorized."
      };
    }
    throw err2;
  }

  var testDoc = DocumentApp.create("Deal Cannon Auth Check");
  DriveApp.getFileById(testDoc.getId()).setTrashed(true);

  GmailApp.getDrafts();

  return {
    success: true,
    email: email || "",
    message: "Google account authorized."
  };
}


/* =========================
   PUBLIC API ΓÇö OFFER ROUTER
========================== */

function generate(type, payload) {
  try {
    var offerType = String(type || "").trim();

    if (!offerType) {
      throw new Error("Offer type missing.");
    }

    payload = payload || {};

    if (offerType === "Cash") {
      return dcCoreHandleCashOffer_(payload);
    }

    if (offerType === "LeaseOption") {
      return dcCoreHandleLeaseOptionOffer_(payload);
    }

    if (offerType === "SellerFinance") {
      return dcCoreHandleSellerFinanceOffer_(payload);
    }

    if (offerType === "SubTo") {
      return dcCoreHandleSubToOffer_(payload);
    }

    throw new Error("Invalid offer type: " + offerType);

  } catch (err) {
    return {
      success: false,
      message: dcCoreErrorMessage_(err),
      error: dcCoreErrorMessage_(err)
    };
  }
}

/* =========================
   PUBLIC API - EMAIL TEMPLATES
========================== */

function getEmailTemplates() {
  if (typeof getEmailTemplates_ !== "function") {
    throw new Error("Email template service is unavailable. Core EmailTemplateService is missing.");
  }

  return getEmailTemplates_();
}

function saveEmailTemplates(payload) {
  if (typeof saveEmailTemplates_ !== "function") {
    throw new Error("Email template service is unavailable. Core EmailTemplateService is missing.");
  }

  return saveEmailTemplates_(payload);
}

/* =========================
    CASH OFFER
========================== */

function dcCoreHandleCashOffer_(payload) {
  dcCoreAssertRequired_(payload, ["propertyAddress", "recipientEmail"], "Cash");

  var ctx = openCustomerSpreadsheet_();
  var ss = ctx.ss;

  var sheet = ss.getSheetByName("Cash");
  if (!sheet) {
    throw new Error("Cash sheet not found.");
  }

  var folder = dcCoreGetLoiFolderForSheet_(sheet);
  var offerDate = dcCoreFormatOfferDate_(payload.date);

  sheet.getRange("B4:B11").setValues([
    [payload.propertyAddress || ""],
    [offerDate],
    [payload.sellerName || ""],
    [payload.description || ""],
    [payload.propertyType || ""],
    [safeNumber(payload.purchasePrice)],
    [payload.financeType || ""],
    [safeNumber(payload.earnestMoney)]
  ]);

  SpreadsheetApp.flush();

  var loiData = {
    todaysDate: offerDate,
    buyers: payload.buyers || "",
    sellerName: payload.sellerName || "",
    propertyAddress: payload.propertyAddress || "",
    description: payload.description || "",
    propertyType: payload.propertyType || "",
    purchasePrice: formatCurrency(safeNumber(payload.purchasePrice)),
    financeType: payload.financeType || "",
    earnestMoney: formatCurrency(safeNumber(payload.earnestMoney))
  };

  return dcCoreBuildLoiAndDraft_("Cash", folder, payload, loiData, null);
}


/* =========================
   LEASE OPTION OFFER
========================= */

function dcCoreHandleLeaseOptionOffer_(payload) {
  dcCoreAssertRequired_(payload, ["propertyAddress", "recipientEmail"], "Lease Option");

  var ctx = openCustomerSpreadsheet_();
  var ss = ctx.ss;

  if (typeof getLoiFolderForWorkbook_ !== "function") {
    throw new Error("Lease Option LOI folder service is unavailable.");
  }

  var folder = getLoiFolderForWorkbook_(ss);
  var offerDate = dcCoreFormatOfferDate_(payload.date);

  var loiData = {
    todaysDate: offerDate,
    buyers: payload.buyers || "",
    marketingCompany: payload.marketingCompany || payload.buyers || "",
    sellerName: payload.sellerName || "",
    propertyAddress: payload.propertyAddress || "",
    description: payload.description || "",
    propertyType: payload.propertyType || "",
    optionPurchasePrice: formatCurrency(safeNumber(payload.optionPurchasePrice)),
    lengthOfOptionYears: payload.lengthOfOptionYears ? String(payload.lengthOfOptionYears) : "",
    monthlyLeasePayment: formatCurrency(safeNumber(payload.monthlyLeasePayment)),
    paymentToAgent: formatCurrency(safeNumber(payload.paymentToAgent)),
    totalToSeller: formatCurrency(safeNumber(payload.totalToSeller))
  };

  return dcCoreBuildLoiAndDraft_("LeaseOption", folder, payload, loiData, null);
}


/* =========================
   SELLER FINANCE OFFER
========================== */

function dcCoreHandleSellerFinanceOffer_(payload) {
  dcCoreAssertRequired_(payload, ["propertyAddress", "recipientEmail"], "Seller Finance");

  var ctx = openCustomerSpreadsheet_();
  var ss = ctx.ss;

  var sheet = ss.getSheetByName("Seller Financing");
  if (!sheet) {
    throw new Error("Seller Financing sheet not found.");
  }

  var folder = dcCoreGetLoiFolderForSheet_(sheet);
  var offerDate = dcCoreFormatOfferDate_(payload.date);

  var offer = safeNumber(payload.offerPrice);
  var down = safeNumber(payload.downPayment);
  var downPct = safeNumber(payload.downPaymentPercent);

  if (offer > 0 && down <= 0 && downPct > 0) {
    down = offer * (downPct / 100);
  }

  if (offer > 0 && down > 0 && downPct <= 0) {
    downPct = (down / offer) * 100;
  }

  var principal = safeNumber(payload.sellerFinancingAmount);
  if (principal <= 0) {
    principal = Math.max(0, offer - down);
  }

  var ratePct = safeNumber(payload.interestRate);
  var rateDec = ratePct / 100;
  var loanYears = safeNumber(payload.loanLengthYears);
  var amortYears = safeNumber(payload.amortizationYears);
  var percentToAgent = safeNumber(payload.percentToAgent);
  var paymentToAgent = safeNumber(payload.paymentToAgent);

  if (paymentToAgent <= 0 && offer > 0 && percentToAgent > 0) {
    paymentToAgent = offer * (percentToAgent / 100);
  }

  sheet.getRange("B1:B12").setValues([
    [payload.propertyAddress || ""],
    [offerDate],
    [payload.sellerName || ""],
    [payload.description || ""],
    [payload.propertyType || ""],
    [offer],
    [down],
    [downPct / 100],
    [principal],
    [rateDec],
    [loanYears],
    [payload.amortizationYears || ""]
  ]);

  var amort = dcCoreCalcSellerFinanceAmort_(principal, rateDec, amortYears, loanYears, down);

  sheet.getRange("B13:B18").setValues([
    [amort.monthlyPayment],
    [amort.interestEarned],
    [paymentToAgent],
    [percentToAgent / 100],
    [safeNumber(payload.closingCosts)],
    [amort.totalToSeller]
  ]);

  SpreadsheetApp.flush();

  var sellerFinanceDisplayValues = sheet.getRange("B9:B18").getDisplayValues();
  var computed = {
    sellerFinancingAmount: sellerFinanceDisplayValues[0][0],
    monthlyPayment: sellerFinanceDisplayValues[4][0],
    totalInterestMade: sellerFinanceDisplayValues[5][0],
    paymentToAgent: sellerFinanceDisplayValues[6][0],
    totalToSeller: sellerFinanceDisplayValues[9][0]
  };

  var loiData = {
    todaysDate: offerDate,
    buyers: payload.buyers || "",
    sellerName: payload.sellerName || "",
    propertyAddress: payload.propertyAddress || "",
    description: payload.description || "",
    propertyType: payload.propertyType || "",

    offerPrice: formatCurrency(offer),
    downPayment: formatCurrency(down),
    sellerFinancingAmount: computed.sellerFinancingAmount,
    loanLengthYears: loanYears ? String(loanYears) : "",
    amortizationYears: payload.amortizationYears || "",
    interestRate: ratePct ? ratePct.toFixed(2) + "%" : "",
    monthlyPayment: computed.monthlyPayment,
    paymentToAgent: computed.paymentToAgent,
    totalInterestMade: computed.totalInterestMade,
    closingCosts: formatCurrency(safeNumber(payload.closingCosts)),
    totalToSeller: computed.totalToSeller
  };

  return dcCoreBuildLoiAndDraft_("SellerFinance", folder, payload, loiData, computed);
}


/* =========================
   SUBTO OFFER
========================== */

function dcCoreHandleSubToOffer_(payload) {
  dcCoreAssertRequired_(payload, ["propertyAddress", "recipientEmail"], "SubTo");

  var ctx = openCustomerSpreadsheet_();
  var ss = ctx.ss;

  var sheet = ss.getSheetByName("Sub to");
  if (!sheet) {
    throw new Error("Sub to sheet not found.");
  }

  var folder = dcCoreGetLoiFolderForSheet_(sheet);
  var offerDate = dcCoreFormatOfferDate_(payload.date);

  sheet.getRange("B4:B7").setValues([
    [payload.propertyAddress || ""],
    [offerDate],
    [payload.sellerName || ""],
    [payload.description || ""]
  ]);

  if (payload.propertyType !== undefined) {
    sheet.getRange("B8:B10").setValues([
      [payload.propertyType || ""],
      [safeNumber(payload.loanBalance)],
      [safeNumber(payload.paymentToSeller)]
    ]);
  } else {
    sheet.getRange("B9:B10").setValues([
      [safeNumber(payload.loanBalance)],
      [safeNumber(payload.paymentToSeller)]
    ]);
  }

  sheet.getRange("B12:B14").setValues([
    [safeNumber(payload.interestRate) / 100],
    [safeNumber(payload.monthlyPayment)],
    [safeNumber(payload.closingCosts)]
  ]);

  SpreadsheetApp.flush();

  var subToDisplayValues = sheet.getRange("B8:B14").getDisplayValues();
  var computed = {
    buyers: payload.buyers || "",
    propertyType: subToDisplayValues[0][0],
    loanBalance: subToDisplayValues[1][0],
    paymentToSeller: subToDisplayValues[2][0],
    paymentToAgent: subToDisplayValues[3][0],
    interestRate: subToDisplayValues[4][0],
    monthlyPayment: subToDisplayValues[5][0],
    closingCosts: subToDisplayValues[6][0]
  };

  var loiData = {
    todaysDate: offerDate,
    buyers: payload.buyers || "",
    sellerName: payload.sellerName || "",
    propertyAddress: payload.propertyAddress || "",
    description: payload.description || "",
    propertyType: computed.propertyType || payload.propertyType || "",

    loanBalance: computed.loanBalance,
    paymentToSeller: computed.paymentToSeller,
    interestRate: computed.interestRate,
    monthlyPayment: computed.monthlyPayment,
    paymentToAgent: computed.paymentToAgent,
    closingCosts: computed.closingCosts
  };

  return dcCoreBuildLoiAndDraft_("SubTo", folder, payload, loiData, computed);
}


/* =========================
   DOC / PDF / GMAIL
========================== */

function dcCoreBuildLoiAndDraft_(type, folder, payload, loiData, computed) {
  payload = dcCoreMergeSavedOutreachInfoIntoPayload_(payload);

  var key = getLoiTemplateKeyForOfferType_(type);
  validateLoiTemplateKey_(key); // Ensure only LOI_* keys are used

  var propertyAddress = String(payload.propertyAddress || "Property").trim();
  var safeProperty = dcCoreSafeFilePart_(propertyAddress);
  var timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyyMMdd-HHmmss"
  );

  var fileName = "LOI for " + safeProperty + " - " + timestamp;
  var offerDate = loiData && loiData.todaysDate ? loiData.todaysDate : payload.date;

  // Build centralized token map for all alias mappings
  var tokenMap = buildTokenMapForPayload_(payload, loiData, computed, offerDate, type);

  // Generate the custom Google Doc from the user's template copy and convert it to a PDF in the parent folder
  var loiBuildResult = buildLoiFromUserTemplate_(type, payload, loiData, computed, folder);
  var pdfBlob = loiBuildResult.pdfFile.getBlob();

  var template = getEmailTemplateForType_(type);
  var emailSubject = replaceAllTemplateTokens_(template.subject, tokenMap);
  var emailBody = replaceAllTemplateTokens_(template.body, tokenMap);

  GmailApp.createDraft(
    String(payload.recipientEmail || "").trim(),
    emailSubject,
    emailBody,
    {
      attachments: [pdfBlob]
    }
  );

  return {
    success: true,
    message: "LOI generated and Gmail draft created.",
    data: computed || null,
    docId: loiBuildResult.docId,
    docUrl: loiBuildResult.docUrl,
    pdfId: loiBuildResult.pdfId,
    pdfUrl: loiBuildResult.pdfUrl
  };
}

function dcCoreMergeSavedOutreachInfoIntoPayload_(payload) {
  var merged = {};
  var key;

  payload = payload || {};

  for (key in payload) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      merged[key] = payload[key];
    }
  }

  if (typeof getOutreachInfo !== "function") {
    return merged;
  }

  try {
    var outreachResult = getOutreachInfo();
    var data = outreachResult && outreachResult.success && outreachResult.data
      ? outreachResult.data
      : null;

    if (!data) {
      return merged;
    }

    if (!String(merged.buyerName || "").trim()) {
      merged.buyerName = String(data.buyerName || "").trim();
    }

    if (!String(merged.buyerLlc || "").trim()) {
      merged.buyerLlc = String(data.buyerLlc || "").trim();
    }

    if (!String(merged.buyerPhoneNumber || merged.buyerPhone || merged.phone || "").trim()) {
      var buyerPhoneNumber = String(data.buyerPhoneNumber || "").trim();
      merged.buyerPhoneNumber = buyerPhoneNumber;
      merged.buyerPhone = buyerPhoneNumber;
      merged.phone = buyerPhoneNumber;
    }

    if (!String(merged.buyerCalendarLink || "").trim()) {
      merged.buyerCalendarLink = String(data.buyerCalendarLink || "").trim();
    }
  } catch (err) {
    // Keep offer generation working even if outreach info cannot be loaded.
  }

  return merged;
}

/* =========================
   FOLDER RESOLUTION
========================== */

function dcCoreGetLoiFolderForSheet_(sheet) {
  var folderUrl = "";

  if (typeof readSetupValue_ === "function") {
    folderUrl = readSetupValue_(sheet, "loiFolder");
  }

  if (!folderUrl) {
    var cellConfig = (typeof DEAL_CANNON_SETUP_CELLS !== "undefined")
      ? DEAL_CANNON_SETUP_CELLS[sheet.getName()]
      : null;

    if (cellConfig && cellConfig.loiFolder) {
      folderUrl = String(sheet.getRange(cellConfig.loiFolder).getDisplayValue() || "").trim();
    }
  }

  if (!folderUrl) {
    folderUrl = String(sheet.getRange("B13").getDisplayValue() || "").trim();
  }

  if (!folderUrl) {
    throw new Error("No LOI PDF Folder saved. Paste your Google Drive folder URL and click Save Folder first.");
  }

  var folderId = extractId(folderUrl);
  var folder = DriveApp.getFolderById(folderId);

  folder.getName();

  return folder;
}


/* =========================
   DATE / GREETING HELPERS
========================== */

function dcCoreFormatOfferDate_(dateStr) {
  if (!dateStr) {
    return Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "MMMM d, yyyy"
    );
  }

  var parts = String(dateStr).split("-");

  if (parts.length !== 3) {
    return Utilities.formatDate(
      new Date(dateStr),
      Session.getScriptTimeZone(),
      "MMMM d, yyyy"
    );
  }

  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  var d = parseInt(parts[2], 10);

  var localNoon = new Date(y, m - 1, d, 12, 0, 0);

  return Utilities.formatDate(
    localNoon,
    Session.getScriptTimeZone(),
    "MMMM d, yyyy"
  );
}

function dcCoreGetTimeOfDayGreeting_() {
  var now = new Date();
  var hour = parseInt(
    Utilities.formatDate(now, Session.getScriptTimeZone(), "H"),
    10
  );

  if (hour < 12) {
    return "Good morning,";
  }

  if (hour < 17) {
    return "Good afternoon,";
  }

  return "Good evening,";
}


/* =========================
   SELLER FINANCE MATH
========================== */

function dcCoreCalcSellerFinanceAmort_(principal, annualRateDec, amortYears, loanYears, downPayment) {
  var p = Math.max(0, safeNumber(principal));
  var r = Math.max(0, safeNumber(annualRateDec));
  var amortY = Math.max(0, safeNumber(amortYears));
  var loanY = Math.max(0, safeNumber(loanYears));
  var down = Math.max(0, safeNumber(downPayment));

  if (p <= 0 || amortY <= 0 || loanY <= 0) {
    return {
      monthlyPayment: 0,
      interestEarned: 0,
      totalToSeller: down,
      balloonBalance: 0
    };
  }

  var i = r / 12;
  var n = Math.round(amortY * 12);
  var k = Math.round(loanY * 12);

  if (n <= 0) n = 1;
  if (k <= 0) k = 1;
  if (k > n) k = n;

  var monthlyPayment;

  if (i === 0) {
    monthlyPayment = p / n;
  } else {
    monthlyPayment = p * i / (1 - Math.pow(1 + i, -n));
  }

  var balloonBalance;

  if (i === 0) {
    balloonBalance = p - monthlyPayment * k;
  } else {
    balloonBalance =
      p * Math.pow(1 + i, k) -
      monthlyPayment * ((Math.pow(1 + i, k) - 1) / i);
  }

  if (balloonBalance < 0) {
    balloonBalance = 0;
  }

  var totalPaidOverLoanTerm = monthlyPayment * k + balloonBalance;
  var interestEarned = totalPaidOverLoanTerm - p;
  var totalToSeller = totalPaidOverLoanTerm + down;

  return {
    monthlyPayment: monthlyPayment,
    interestEarned: interestEarned,
    totalToSeller: totalToSeller,
    balloonBalance: balloonBalance
  };
}


/* =========================
   VALIDATION / UTIL
========================== */

function dcCoreAssertRequired_(obj, fields, contextLabel) {
  obj = obj || {};
  fields = fields || [];

  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    var value = obj[field];

    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    ) {
      throw new Error("Missing required field '" + field + "' in " + contextLabel + ".");
    }
  }
}

function dcCoreSafeFilePart_(value) {
  var text = String(value || "Property")
    .trim()
    .replace(/[\\\/:*?"<>|#\[\]]/g, "")
    .replace(/\s+/g, " ");

  if (!text) {
    text = "Property";
  }

  return text.slice(0, 120);
}

function dcCoreErrorMessage_(err) {
  var msg = err && err.message ? err.message : String(err || "Unknown error.");

  if (msg.indexOf("ONBOARDING_REQUIRED") !== -1) {
    return "Customer workbook has not been created yet. Save your LOI folder first.";
  }

  if (msg.indexOf("WORKBOOK_ACCESS_DENIED") !== -1) {
    return "This Google account cannot access the assigned Deal Cannon workbook.";
  }

  if (msg.indexOf("No item with the given ID could be found") !== -1) {
    return "Google could not find that Drive item for this account. Confirm you are using the correct Google account and folder URL.";
  }

  if (msg.indexOf("Access denied") !== -1 || msg.indexOf("Permission denied") !== -1) {
    return "This Google account does not have permission to access the required Drive item.";
  }

  return msg;
}


/* =========================
   ANALYSIS SPREADSHEET
========================== */

function generateAnalysisSpreadsheet(analysisPayload) {
  try {
    analysisPayload = analysisPayload || {};

    var ctx = openCustomerSpreadsheet_();
    var ss = ctx.ss;

    var folderUrl = "";
    if (typeof readSetupValue_ === "function") {
      folderUrl = readSetupValue_(ss.getSheetByName("Cash"), "loiFolder");
    }
    if (!folderUrl) {
      try {
        var cashSheet = ss.getSheetByName("Cash");
        if (cashSheet) {
          folderUrl = String(cashSheet.getRange("B13").getDisplayValue() || "").trim();
        }
      } catch (e) {}
    }

    var folder = null;
    if (folderUrl) {
      var folderId = extractId(folderUrl);
      if (folderId) {
        folder = DriveApp.getFolderById(folderId);
      }
    }

    var address = String(analysisPayload.address || "Analysis").trim();
    var safeAddress = address.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "analysis";
    var contextType = String(analysisPayload.contextType || "analysis").toLowerCase().replace(/[^a-z0-9]+/g, "_");
    var spreadsheetName = "Deal Cannon " + contextType + " - " + address;

    var spreadsheet = SpreadsheetApp.create(spreadsheetName);
    var spreadsheetId = spreadsheet.getId();

    if (folder) {
      var file = DriveApp.getFileById(spreadsheetId);
      file.moveTo(folder);
    }

    var metrics = analysisPayload.metrics || [];
    var inputs = analysisPayload.inputs || [];
    var summaryData = analysisPayload.summaryData || {};
    var rehabData = analysisPayload.rehabData || null;
    var comparablesData = analysisPayload.comparablesData || null;
    var contextTitle = analysisPayload.contextTitle || "Analysis";
    var generatedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM d, yyyy 'at' h:mm a");

    /* --- Executive Summary tab --- */
    var summarySheet = spreadsheet.getSheets()[0];
    summarySheet.setName("Executive Summary");
    var summaryRows = [
      [summaryData.headline || (contextTitle + " Summary")],
      ["Generated", generatedAt],
      ["Property", address],
      [],
      ["Overview"],
      [summaryData.overview || ""],
      [],
      ["Key Metrics", "Value"]
    ];
    metrics.forEach(function(item) {
      summaryRows.push([item.label, item.displayValue]);
    });
    summaryRows.push([], ["Strengths"]);
    (summaryData.wins || []).forEach(function(item) {
      summaryRows.push([item]);
    });
    summaryRows.push([], ["Risks"]);
    (summaryData.risks || []).forEach(function(item) {
      summaryRows.push([item]);
    });
    summaryRows.push([], ["Next Steps"]);
    (summaryData.nextSteps || []).forEach(function(item) {
      summaryRows.push([item]);
    });
    summarySheet.getRange(1, 1, summaryRows.length, 2).setValues(summaryRows);
    summarySheet.getRange(1, 1, 1, 2).setFontWeight("bold").setFontSize(14);
    summarySheet.getRange(5, 1, 1, 2).setFontWeight("bold");
    summarySheet.getRange(8, 1, 1, 2).setFontWeight("bold");

    /* --- Analysis tab --- */
    var analysisSheet = spreadsheet.insertSheet("Analysis");
    var analysisRows = [["Metric", "Value"]];
    metrics.forEach(function(item) {
      analysisRows.push([item.label, item.displayValue]);
    });
    analysisSheet.getRange(1, 1, analysisRows.length, 2).setValues(analysisRows);
    analysisSheet.getRange(1, 1, 1, 2).setFontWeight("bold");

    /* --- Inputs tab --- */
    var inputsSheet = spreadsheet.insertSheet("Inputs");
    var inputsRows = [["Input", "Value"]];
    inputs.forEach(function(item) {
      inputsRows.push([item.label, item.displayValue]);
    });
    inputsSheet.getRange(1, 1, inputsRows.length, 2).setValues(inputsRows);
    inputsSheet.getRange(1, 1, 1, 2).setFontWeight("bold");

    /* --- Rehab tab --- */
    var rehabSheet = spreadsheet.insertSheet("Rehab");
    var rehabRows;
    if (rehabData) {
      rehabRows = [
        ["Property Address", rehabData.propertyAddress || ""],
        ["Condition Summary", rehabData.conditionSummary || ""],
        ["Recommended Budget", formatCurrency(rehabData.recommendedBudget, 0)],
        [],
        ["Item", "Scope of Work", "Estimated Cost Low", "Estimated Cost High"]
      ];
      (rehabData.lineItems || []).forEach(function(item) {
        rehabRows.push([
          item.item,
          item.scopeOfWork || "",
          formatCurrency(item.estimatedCostLow, 0),
          formatCurrency(item.estimatedCostHigh, 0)
        ]);
      });
    } else {
      rehabRows = [["No rehab summary is available for this analysis."]];
    }
    rehabSheet.getRange(1, 1, rehabRows.length, rehabRows[0].length).setValues(rehabRows);
    rehabSheet.getRange(1, 1, 1, Math.min(rehabRows[0].length, 2)).setFontWeight("bold");

    /* --- Comparables tab --- */
    var compsSheet = spreadsheet.insertSheet("Comparables");
    var compsRows;
    if (comparablesData) {
      compsRows = [
        ["Property Address", comparablesData.propertyAddress || ""],
        ["Summary", comparablesData.marketSummary || ""],
        ["Recommended Value", formatCurrency(comparablesData.recommendedValue, 0)],
        ["Average PPSF", formatCurrency(comparablesData.averagePricePerSqft, 2)],
        [],
        ["Address", "Distance (mi)", "Sale Date", "Beds", "Baths", "Sqft", "Sold Price", "Price/Sqft", "Reason"]
      ];
      (comparablesData.bestComparables || []).forEach(function(row) {
        compsRows.push([
          row.address,
          row.distanceMiles,
          row.saleDate,
          row.beds,
          row.baths,
          row.sqft,
          formatCurrency(row.soldPrice, 0),
          formatCurrency(row.pricePerSqft, 2),
          row.selectionReason || ""
        ]);
      });
      if (comparablesData.warnings && comparablesData.warnings.length) {
        compsRows.push([], ["Warnings"]);
        comparablesData.warnings.forEach(function(warning) {
          compsRows.push([warning]);
        });
      }
    } else {
      compsRows = [["No comparable summary is available for this analysis."]];
    }
    compsSheet.getRange(1, 1, compsRows.length, compsRows[0].length).setValues(compsRows);
    compsSheet.getRange(1, 1, 1, Math.min(compsRows[0].length, 2)).setFontWeight("bold");

    /* --- Auto-resize columns --- */
    [summarySheet, analysisSheet, inputsSheet, rehabSheet, compsSheet].forEach(function(sheet) {
      for (var c = 1; c <= sheet.getLastColumn(); c++) {
        sheet.autoResizeColumn(c);
      }
    });

    SpreadsheetApp.flush();

    var spreadsheetUrl = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/edit";

    return {
      success: true,
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: spreadsheetUrl,
      fileName: spreadsheetName
    };

  } catch (err) {
    return {
      success: false,
      message: dcCoreErrorMessage_(err),
      error: dcCoreErrorMessage_(err)
    };
  }
}

function formatCurrency(value, decimals) {
  var n = Number(value || 0);
  var d = decimals !== undefined ? decimals : 2;
  try {
    return "$" + n.toLocaleString("en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  } catch (e) {
    return "$" + n.toFixed(d);
  }
}
