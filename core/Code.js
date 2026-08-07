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
    /*
      Still return the actual licensing error to the UI.
      The auth scopes have already been triggered before this.
    */
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
   PUBLIC API - SCHEDULED SENDING
========================== */

function getScheduledSendingConnectionState(payload) {
  if (typeof getScheduledSendingConnectionState_ !== 'function') {
    throw new Error('Scheduled sending service is unavailable. Core SchedulerBackendService is missing.');
  }

  return getScheduledSendingConnectionState_(payload);
}

function beginScheduledSendingConnect(payload) {
  if (typeof beginScheduledSendingConnect_ !== 'function') {
    throw new Error('Scheduled sending service is unavailable. Core SchedulerBackendService is missing.');
  }

  return beginScheduledSendingConnect_(payload);
}

function disconnectScheduledSendingConnection(payload) {
  if (typeof disconnectScheduledSendingConnection_ !== 'function') {
    throw new Error('Scheduled sending service is unavailable. Core SchedulerBackendService is missing.');
  }

  return disconnectScheduledSendingConnection_(payload);
}

function previewDailyScheduleCampaign(payload) {
  if (typeof previewDailyScheduleCampaign_ !== 'function') {
    throw new Error('Scheduled sending service is unavailable. Core SchedulerBackendService is missing.');
  }

  return previewDailyScheduleCampaign_(payload);
}

function createDailyScheduleCampaign(payload) {
  if (typeof createDailyScheduleCampaign_ !== 'function') {
    throw new Error('Scheduled sending service is unavailable. Core SchedulerBackendService is missing.');
  }

  return createDailyScheduleCampaign_(payload);
}

function getDailyScheduleCampaigns(payload) {
  if (typeof getDailyScheduleCampaigns_ !== 'function') {
    throw new Error('Scheduled sending service is unavailable. Core SchedulerBackendService is missing.');
  }

  return getDailyScheduleCampaigns_(payload);
}

function cancelDailyScheduleCampaign(payload) {
  if (typeof cancelDailyScheduleCampaign_ !== 'function') {
    throw new Error('Scheduled sending service is unavailable. Core SchedulerBackendService is missing.');
  }

  return cancelDailyScheduleCampaign_(payload);
}

function deleteDailyScheduleCampaign(payload) {
  if (typeof deleteDailyScheduleCampaign_ !== 'function') {
    throw new Error('Scheduled sending service is unavailable. Core SchedulerBackendService is missing.');
  }

  return deleteDailyScheduleCampaign_(payload);
}

function deleteDailyScheduleItems(payload) {
  if (typeof deleteDailyScheduleItems_ !== 'function') {
    throw new Error('Scheduled sending service is unavailable. Core SchedulerBackendService is missing.');
  }

  return deleteDailyScheduleItems_(payload);
}

function runDailyScheduleCampaignNow(payload) {
  if (typeof runDailyScheduleCampaignNow_ !== 'function') {
    throw new Error('Scheduled sending service is unavailable. Core SchedulerBackendService is missing.');
  }

  return runDailyScheduleCampaignNow_(payload);
}

function buildScheduledSendingLeadPayloads(payload) {
  if (typeof buildScheduledSendingLeadPayloads_ !== 'function') {
    throw new Error('Scheduled sending lead builder is unavailable. Core EmailOutreachService is missing.');
  }

  return buildScheduledSendingLeadPayloads_(payload);
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
