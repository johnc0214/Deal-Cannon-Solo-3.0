/**************************************
 * Deal Cannon Core - DebugService.js
 * Manual debug and validation functions for Apps Script environment.
 * Do not expose these to the customer-facing user interface.
 **************************************/

/**
 * Validates the template database status, user credentials, workbook IDs, and headers.
 * Prints output to Logger.log() and returns structured JSON.
 */
function debugTemplateSetup() {
  var result = {
    effectiveUserEmail: "",
    approvedUserLookup: null,
    customerWorkbookId: "",
    customerWorkbookOpenSuccess: false,
    templatesTabExists: false,
    templatesHeaders: [],
    templateKeysFound: [],
    availableTokenCount: 0,
    availableTokens: []
  };
  
  try {
    result.effectiveUserEmail = Session.getEffectiveUser().getEmail();
  } catch (e) {
    result.effectiveUserEmail = "error: " + e.message;
  }

  try {
    if (typeof requireApprovedUser_ === "function") {
      var user = requireApprovedUser_();
      result.approvedUserLookup = user;
      if (user && user.customerSheetId) {
        result.customerWorkbookId = user.customerSheetId;
      }
    }
  } catch (e) {
    result.approvedUserLookup = "error: " + e.message;
  }

  if (!result.customerWorkbookId) {
    try {
      result.customerWorkbookId = PropertiesService.getScriptProperties().getProperty("customerSheetId") || "";
    } catch (e) {}
  }

  if (result.customerWorkbookId) {
    try {
      var ss = SpreadsheetApp.openById(result.customerWorkbookId);
      if (ss) {
        result.customerWorkbookOpenSuccess = true;
        var sheet = ss.getSheetByName("Templates");
        if (!sheet) {
          sheet = ss.getSheetByName("Email Templates Config");
        }
        if (sheet) {
          result.templatesTabExists = true;
          var lastCol = sheet.getLastColumn();
          if (lastCol > 0) {
            result.templatesHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
          }
          var values = sheet.getDataRange().getDisplayValues();
          for (var i = 1; i < values.length; i++) {
            var key = String(values[i][0]).trim();
            if (key) {
              result.templateKeysFound.push(key);
            }
          }
        }
      }
    } catch (e) {
      result.customerWorkbookOpenSuccess = "error: " + e.message;
    }
  }

  try {
    if (typeof getAvailableTemplateTokens_ === "function") {
      result.availableTokens = getAvailableTemplateTokens_();
      result.availableTokenCount = result.availableTokens.length;
    }
  } catch (e) {
    result.availableTokens = "error: " + e.message;
  }

  Logger.log("TEMPLATE SETUP DEBUG STATE:\n" + JSON.stringify(result, null, 2));
  return result;
}

/**
 * Tests access to all 5 seed documents and lists mapped key actions.
 */
function debugSeedTemplateDocs() {
  var docIds = [
    "1B0z4WQ-BaGUJyRjNYMfiq3CfcQVYgHUyQuS1DaAko8Q",
    "1qQvtcyYQH3MPpAUvF6humT52AvgiWN0Ak6jpRDXW4nw",
    "1aaoXKSL7uJp1VxrhV781_1UHQPVnj_fUhCtibGOU8lU",
    "1IxVv1dPMO0yEQ8kPXt_XDm7rsr_wg2SKzJBNxXADTPs",
    "1w2x3_MqqtrqYcHx6BIYimrTxDwWgsWgkKg1aCbww93U"
  ];

  var sheetKeys = {};
  try {
    var ss = getEmailTemplatesWorkbook_();
    var sheet = ss.getSheetByName("Templates");
    if (!sheet) {
      sheet = ss.getSheetByName("Email Templates Config");
    }
    if (sheet) {
      var values = sheet.getDataRange().getDisplayValues();
      for (var i = 1; i < values.length; i++) {
        var rawKey = String(values[i][0]).trim();
        var subject = String(values[i][1] || "").trim();
        var body = String(values[i][2] || "").trim();
        if (rawKey && (subject || body)) {
          sheetKeys[rawKey] = true;
        }
      }
    }
  } catch (e) {
    Logger.log("Could not inspect existing Templates tab: " + e.message);
  }

  var report = [];

  for (var i = 0; i < docIds.length; i++) {
    var docId = docIds[i];
    var url = "https://docs.google.com/document/d/" + docId + "/edit?tab=t.0";
    var docInfo = {
      docId: docId,
      sourceUrl: url,
      openSuccess: false,
      documentTitle: "",
      mappedTemplateKey: "",
      bodyCharacterCount: 0,
      extractedTokens: [],
      seedingAction: "fail", // seed, skip, fail
      exactError: ""
    };

    try {
      var doc = DocumentApp.openById(docId);
      docInfo.openSuccess = true;
      docInfo.documentTitle = doc.getName();
      var bodyText = doc.getBody().getText();
      docInfo.bodyCharacterCount = bodyText.length;
      
      if (typeof mapDocToTemplateKey_ === "function") {
        docInfo.mappedTemplateKey = mapDocToTemplateKey_(docInfo.documentTitle);
      } else {
        docInfo.mappedTemplateKey = "[mapDocToTemplateKey_ function missing]";
      }
      
      if (typeof extractTokensFromTemplateText_ === "function") {
        docInfo.extractedTokens = extractTokensFromTemplateText_(bodyText);
      }

      if (docInfo.mappedTemplateKey) {
        if (sheetKeys[docInfo.mappedTemplateKey]) {
          docInfo.seedingAction = "skip";
        } else {
          docInfo.seedingAction = "seed";
        }
      } else {
        docInfo.seedingAction = "fail (no mapped template key)";
      }
    } catch (err) {
      docInfo.openSuccess = false;
      docInfo.exactError = err.message || String(err);
      docInfo.seedingAction = "fail";
    }

    report.push(docInfo);
  }

  Logger.log("SEED TEMPLATE DOCS REPORT:\n" + JSON.stringify(report, null, 2));
  return report;
}

/**
 * Scans all Templates rows and lists extracted tokens alongside merged registry tokens.
 */
function debugExtractTemplateTokens() {
  var result = {
    success: false,
    groupedTokens: {},
    availableTokens: [],
    message: ""
  };

  try {
    var ss = getEmailTemplatesWorkbook_();
    var sheet = ss.getSheetByName("Templates");
    if (!sheet) {
      sheet = ss.getSheetByName("Email Templates Config");
    }
    if (!sheet) {
      throw new Error("Templates tab not found in workbook.");
    }

    var values = sheet.getDataRange().getDisplayValues();
    var allExtracted = {};

    for (var i = 1; i < values.length; i++) {
      var key = String(values[i][0]).trim();
      var subject = String(values[i][1] || "");
      var body = String(values[i][2] || "");
      if (key) {
        var combinedText = subject + " " + body;
        var tokens = [];
        if (typeof extractTokensFromTemplateText_ === "function") {
          tokens = extractTokensFromTemplateText_(combinedText);
        }
        result.groupedTokens[key] = tokens;
        
        tokens.forEach(function(tok) {
          allExtracted[tok] = true;
        });
      }
    }

    if (typeof getAvailableTemplateTokens_ === "function") {
      result.availableTokens = getAvailableTemplateTokens_();
    } else {
      result.availableTokens = Object.keys(allExtracted);
    }

    result.success = true;
  } catch (e) {
    result.success = false;
    result.message = e.message;
  }

  Logger.log("EXTRACT TEMPLATE TOKENS REPORT:\n" + JSON.stringify(result, null, 2));
  return result;
}

/**
 * Preview template subject, body, and extracted tokens by offer key.
 */
function debugEmailTemplateForType(type) {
  var result = {
    typeInput: type,
    selectedTemplateKey: "",
    subjectPreview: "",
    bodyPreview: "",
    extractedTokens: [],
    error: ""
  };

  try {
    if (typeof getEmailTemplateForType_ === "function") {
      var template = getEmailTemplateForType_(type);
      result.selectedTemplateKey = template.key;
      result.subjectPreview = template.subject;
      result.bodyPreview = template.body;
      
      if (typeof extractTokensFromTemplateText_ === "function") {
        result.extractedTokens = extractTokensFromTemplateText_(template.subject + " " + template.body);
      }
    } else {
      throw new Error("getEmailTemplateForType_ is not defined");
    }
  } catch (e) {
    result.error = e.message;
  }

  Logger.log("EMAIL TEMPLATE PREVIEW FOR TYPE " + type + ":\n" + JSON.stringify(result, null, 2));
  return result;
}

/**
 * Validates alias substitutions and traces any unreplaced token leftovers using mock payloads.
 */
function debugTemplateTokenReplacement() {
  var types = ["Cash", "LeaseOption", "SellerFinance", "SubTo"];
  var results = {};

  var fakePayload = {
    propertyAddress: "123 Main St, Austin, TX 78701",
    date: "2026-05-18",
    sellerName: "John Smith",
    buyers: "Alex Cannon",
    marketingCompany: "Crystal Estate Holdings LLC",
    yourName: "Alex Cannon",
    phone: "(555) 012-3456",
    description: "Beautiful 3 bed 2 bath house",
    propertyType: "Single Family",
    financeType: "Cash",
    purchasePrice: "350000",
    optionPurchasePrice: "375000",
    lengthOfOptionYears: "1",
    monthlyLeasePayment: "2350",
    earnestMoney: "5000",
    offerPrice: "350000",
    downPayment: "70000",
    downPaymentPercent: "20",
    sellerFinancingAmount: "280000",
    interestRate: "6",
    loanLengthYears: "10",
    amortizationYears: "30",
    percentToAgent: "3",
    paymentToAgent: "10500",
    closingCosts: "1500",
    totalToSeller: "420000",
    loanBalance: "310000",
    monthlyPayment: "1678.71",
    paymentToSeller: "40000",
    recipientEmail: "seller@example.com"
  };

  types.forEach(function(type) {
    try {
      var template = getEmailTemplateForType_(type);
      var offerDate = fakePayload.date;
      
      var computed = {};
      if (type === "SellerFinance") {
        computed = {
          monthlyPayment: "$1,678.71",
          totalInterestMade: "$203,535.60",
          paymentToAgent: "$10,500.00",
          totalToSeller: "$553,535.60",
          sellerFinancingAmount: "$280,000.00"
        };
      } else if (type === "LeaseOption") {
        computed = {
          monthlyPayment: "$2,350.00",
          paymentToAgent: "$10,500.00",
          totalToSeller: "$420,000.00"
        };
      } else if (type === "SubTo") {
        computed = {
          propertyType: "Single Family",
          loanBalance: "$310,000.00",
          paymentToSeller: "$40,000.00",
          paymentToAgent: "$10,500.00",
          interestRate: "6.00%",
          monthlyPayment: "$1,678.71",
          closingCosts: "$1,500.00"
        };
      }

      var tokenMap = buildTokenMapForPayload_(fakePayload, {}, computed, offerDate, type);
      var afterSubject = replaceAllTemplateTokens_(template.subject, tokenMap);
      var afterBody = replaceAllTemplateTokens_(template.body, tokenMap);

      var combinedAfter = afterSubject + " " + afterBody;
      var unresolved = [];
      var regex = /\{\{\s*([^{}]+?)\s*\}\}/g;
      var match;
      var seen = {};
      while ((match = regex.exec(combinedAfter)) !== null) {
        var t = match[0];
        if (!seen[t]) {
          seen[t] = true;
          unresolved.push(t);
        }
      }

      results[type] = {
        beforeSubject: template.subject,
        afterSubject: afterSubject,
        beforeBody: template.body,
        afterBody: afterBody,
        unresolvedTokens: unresolved
      };
    } catch (e) {
      results[type] = {
        error: e.message
      };
    }
  });

  Logger.log("TEMPLATE TOKEN REPLACEMENT REPORT:\n" + JSON.stringify(results, null, 2));
  return results;
}
