/**************************************
 * Deal Cannon Core - EmailTemplateService.gs
 * Customer workbook-backed email and LOI templates.
 **************************************/

var EMAIL_TEMPLATE_KEYS = [
  "InitialOutreach_General",
  "InitialOutreach_Cash",
  "InitialOutreach_SellerFinance",
  "InitialOutreach_SubTo",
  "Cash",
  "SellerFinance",
  "SubTo"
];

var EMAIL_TEMPLATE_DEFAULTS = {
  InitialOutreach_General: {
    subject: "Quick question about {{PROPERTY ADDRESS}}",
    body: "Hi {{FIRSTNAME}},\n\nI saw {{PROPERTY ADDRESS}} and wanted to reach out directly. My name is {{YOUR NAME}}, and I am interested in talking with you about the property.\n\nIf you are open to a quick conversation, you can reach me at {{PHONE}}.\n\nBest,\n{{YOUR NAME}}"
  },
  InitialOutreach_Cash: {
    subject: "Potential Offer for {{PROPERTY ADDRESS}}",
    body: "Hi {{FIRSTNAME}},\n\nI hope your week is going well. I wanted to reach out regarding your listing at {{PROPERTY ADDRESS}}.\n\nWe typically purchase properties that need improvements at the as-is value with a straightforward cash offer and close efficiently.\n\nIf this approach could support your seller's goals, please reach out to me.\n\nCall or text: {{PHONE}}\nOr just reply \"interested,\" and I'll coordinate around your schedule.\n\nThank you again, {{FIRSTNAME}}. I look forward to connecting.\n\nWarm regards,\n{{YOUR NAME}}"
  },
  InitialOutreach_SellerFinance: {
    subject: "Potential Offer for {{Address}}",
    body: [
      "Hey {{Listing Agent Full Name}},",
      "",
      "I hope your week is going well. I wanted to reach out regarding your listing at {{Address}}. We believe it might align well with the type of opportunities we actively pursue.",
      "",
      "We typically structure offers in two different ways, depending on what best serves the seller:",
      "",
      "Option 1: Creative Finance",
      "We can typically offer full price at {{Listing Price}} while covering commission and closing costs in exchange for terms that allow us to cash flow.",
      "",
      "Option 2: Direct Cash",
      "For homes that need improvements, we like to purchase at the as-is value with a straightforward cash offer and close efficiently.",
      "",
      "If either approach could support your seller’s goals, please reach out to {{Buyer Name}}, our account manager, by choosing what works best:",
      "Call or text:  {{Buyer Phone Number}}",
      "Book a quick call: {{Buyer Calendar Link}}",
      "Or just reply “interested,” and I’ll coordinate around your schedule.",
      "",
      "Either way, we want to work with you long term! Please check out our Agent Partnership Program below",
      "",
      "Agent Partnership Program",
      "We work closely with agents who want dependable buyers who actually perform. Our partners receive 3–6% commission on qualified opportunities.",
      "You can confidently tell your seller:",
      "“I have a ready buyer who will honor my full commission and make this process smooth.”",
      "",
      "Why agents continue working with us:",
      "• Reliable communication",
      "• Flexible solutions when traditional buyers fall short",
      "• Clean contracts and professional coordination",
      "• Earnest money included",
      "",
      "Our Closing Process:",
      "Review property details and confirm numbers",
      "Agree on clear terms and provide a straightforward contract",
      "Our transaction team ensures a smooth closing from start to finish",
      "",
      "Thank you again, {{Listing Agent Full Name}}. I look forward to connecting.",
      "Warm regards,",
      "{{Buyer Name}} - {{Buyer Phone Number}}",
      "{{Buyer LLC}}"
    ].join("\n")
  },
  InitialOutreach_SubTo: {
    subject: "Potential Offer for {{Address}}",
    body: [
      "Hey {{Listing Agent Full Name}},",
      "",
      "I hope your week is going well. I wanted to reach out regarding your listing at {{Address}}. We believe it might align well with the type of opportunities we actively pursue.",
      "",
      "We help sellers with low equity by offering creative solutions. In some cases, we can structure terms so they avoid bringing money to closing, while still allowing the agent to earn a commission.",
      "",
      "We typically purchase properties in two primary ways:",
      "",
      "Option 1: Creative Finance",
      "We can typically offer full price at {{Listing Price}} while covering commission and closing costs in exchange for terms that allow us to cash flow.",
      "",
      "Option 2: Direct Cash",
      "For homes that need improvements, we like to purchase at the as-is value with a straightforward cash offer and close efficiently.",
      "If either option could be helpful to your seller, let’s explore it further.",
      "",
      "If either approach could support your seller’s goals, please reach out to {{Buyer Name}}, our account manager, by choosing what works best:",
      "Call or text:  {{Buyer Phone Number}}",
      "Book a quick call: {{Buyer Calendar Link}}",
      "Or just reply “interested,” and I’ll coordinate around your schedule.",
      "",
      "Either way, we want to work with you long term! Please check out our Agent Partnership Program below",
      "",
      "Agent Advantage Program",
      "We prioritize repeat partnerships. When you introduce a property that meets our criteria, we compensate you with a 3–6% buyer’s commission — paid directly by us.",
      "Prospecting for us could lead to smooth commissions using this truth: “I have a serious buyer who's ready to buy and will cover my entire commission so you don't have to.”",
      "",
      "Why agents choose to work with us:",
      "Reliable buyer with defined criteria",
      "Flexible deal structures to keep transactions alive",
      "Smooth closings handled by our team",
      "",
      "OUR STREAMLINED PROCESS",
      "We request the mortgage statement, analyze recently sold comparables, and structure mutually beneficial terms",
      "We issue a straightforward purchase agreement",
      "Our team manages the transaction through closing, including earnest money",
      "",
      "Looking forward to the opportunity to collaborate.",
      "",
      "Thank you again, {{Listing Agent Full Name}}. I look forward to connecting.",
      "Warm regards,",
      "{{Buyer Name}} - {{Buyer Phone Number}}",
      "{{Buyer LLC}}"
    ].join("\n")
  },
  Cash: {
    subject: "Cash offer for {{PROPERTY ADDRESS}}",
    body: "" // Seeded via Google Doc/CASH_LOI_DEFAULT_BODY
  },
  SellerFinance: {
    subject: "Seller finance offer for {{PROPERTY ADDRESS}}",
    body: "" // Seeded via Google Doc/SELLER_FINANCE_LOI_DEFAULT_BODY
  },
  SubTo: {
    subject: "Subject-to offer for {{PROPERTY ADDRESS}}",
    body: "" // Seeded via Google Doc/SUBTO_LOI_DEFAULT_BODY
  }
};

/* ==========================================
   LOI HARDCODED TEMPLATE FALLBACKS
   ========================================== */

var SELLER_FINANCE_LOI_DEFAULT_BODY = [
  "LETTER OF INTENT",
  "TO PURCHASE REAL ESTATE",
  "",
  "This Real Estate Letter of Intent (the ΓÇ£Letter of IntentΓÇ¥ or ΓÇ£LetterΓÇ¥) is entered on {{TodayΓÇÖs Date}} (the ΓÇ£Effective DateΓÇ¥) and provides a written expression of the mutual interest between the parties below.",
  "",
  "The purpose of this letter is to set some of the basic terms and conditions of the proposed purchase by the undersigned (the ΓÇ£Buyer\") of certain real estate owned by you (the ΓÇ£Seller\"). The terms outlined in this Letter will not become binding until a more detailed ΓÇ£Purchase Agreement\" is negotiated and signed by the parties, as contemplated below by the section of this Letter entitled \"Non-Binding.\"",
  "",
  "The BUYER(S):",
  "{{The Buyers}}",
  "",
  "The SELLER(S):",
  "{{The Sellers}}",
  "",
  "The PROPERTY ADDRESS:",
  "{{PROPERTY ADDRESS}}",
  "",
  "Additional Description:",
  "{{Additional Description}}",
  "",
  "Property Type: {{Property Type}}",
  "",
  "We are writing to express our intent to buy the property described herein (the ΓÇ£Transaction\"). This letter of intent outlines the options and general terms and conditions of our proposal, which we believe provides a foundation for further discussions. Please note this document is non-binding and is intended solely as a preliminary understanding between the Buyer(s) and Seller(s).",
  "",
  "Proposal for a real estate transaction related to the above property",
  "",
  "Offer Price: {{Offer Price}}",
  "Down Payment: {{Down Payment}}",
  "Seller Financing amount: {{Seller Financing amount}}",
  "Length of the Loan in Years (Balance due in full): {{Length of the Loan in Years (Balance due in full)}}",
  "Amortization terms: {{Amortization terms}}",
  "Interest Rate: {{Interest Rate}}",
  "Monthly Payment: {{Monthly Payment}}",
  "Payment to the Agent: {{Payment to the Agent}}",
  "Total Interest Made: {{Total Interest Made}}",
  "Closing Costs the seller DOESN'T PAY: {{Closing Costs the seller DOESN'T PAY}}",
  "Total $ to Seller, including Savings on Fees/Commissions: {{Total $ to Seller, including Savings on Fees/Commissions}}",
  "Terms & Conditions:",
  "* The Seller will act as the lender, receiving monthly payments for holding the promissory note, and will have no landlord responsibilities or property management obligations.",
  "* Closing: On or before 30 days from the Effective Date, or sooner if mutually agreed.",
  "* Inspection period: 14 days from the Effective Date.",
  "* AS-IS PURCHASE.",
  "* BuyerΓÇÖs choice of escrow and closing agent.",
  "* Exact vesting to be determined during escrow.",
  "* Buyer shall be responsible for all property expenses, including property taxes, insurance, HOA dues (if any), utilities, maintenance, and repairs.",
  "* Buyer reserves the right to assign this agreement to any affiliated entity, partner LLC, or designee",
  "* The seller may leave any unwanted personal property in the home upon closing.",
  "* The Seller pays NO closing costs, NO fees, and NO commissions, and closing will occur on the SellerΓÇÖs preferred timeline.",
  "",
  "NON-BINDING This letter of Intent does not and is not intended to bind the parties contractually and is only an expression of the basic conditions to be incorporated into a binding Purchasing Agreement. This Letter does not require either party to negotiate in good faith or to proceed to the completion of a binding Purchase Agreement. The parties shall not be contractually bound unless and until they enter a formal, written Purchase Agreement, which must be in form and content satisfactory to each party and to each party's legal counsel, in their sole discretion. Neither party may rely on this Letter as creating any legal obligation of any kind.",
  "",
  "If this is something that interests you, please sign below, and we'll draft an official agreement.",
  "BUYER:",
  "{{The Buyers}}",
  "",
  "Seller Signature:",
  "_________________________________"
].join("\n");

var CASH_LOI_DEFAULT_BODY = [
  "LETTER OF INTENT",
  "TO PURCHASE REAL ESTATE",
  "",
  "This Real Estate Letter of Intent (the ΓÇ£Letter of IntentΓÇ¥ or ΓÇ£LetterΓÇ¥) is entered on {{TodayΓÇÖs Date}} (the ΓÇ£Effective DateΓÇ¥) and provides a written expression of the mutual interest between the below parties.",
  "",
  "The purpose of this letter is to set some of the basic terms and conditions of the proposed purchase by the undersigned (the ΓÇ£Buyer\") of certain real estate owned by you (the ΓÇ£Seller\"). The terms set forth in this Letter will not become binding until a more detailed ΓÇ£Purchase Agreement\" is negotiated and signed by the parties, as contemplated below by the section of this Letter entitled \"Non-Binding.\"",
  "",
  "The BUYER(S):",
  "{{The Buyers}}",
  "",
  "The SELLER(S):",
  "{{The Sellers}}",
  "",
  "The PROPERTY ADDRESS:",
  "{{PROPERTY ADDRESS}}",
  "",
  "Additional Description:",
  "{{Additional Description}}",
  "",
  "Property Type: {{Property Type}}",
  "",
  "We are writing to express our intent to buy the property described herein (the ΓÇ£Transaction\"). This letter of intent outlines the options and general terms and conditions of our proposal, which we believe provides a foundation for further discussions. Please note this document is non-binding and is intended solely as a preliminary understanding between the Buyer(s) and Seller(s).",
  "",
  "Proposal for a real estate transaction related to the above property",
  "",
  "Offer Price: {{Purchase Price}}",
  "Type of Financing: {{Type of Financing}}",
  "Earnest Money Deposit: {{Earnest Money Deposit}}",
  "Terms & Conditions:",
  "* CLOSING: On or Before 30 Days",
  "* 14 DAY Inspection from Effective Date",
  "* AS IS PURCHASE",
  "* BuyerΓÇÖs choice of Escrow",
  "* Exact Vesting to be determined during Escrow",
  "* Buyer is responsible for Taxes, HOA, Insurance (if any), and all other payments related to the house.",
  "* The seller may leave any unwanted items in the home upon closing",
  "* To summarize, we are providing a solution for your client to smoothly transition without any financial obligation by taking on full responsibility of the home and paying your commissions.",
  "",
  "NON-BINDING This letter of Intent does not and is not intended to contractually bind the parties and is only an expression of the basic conditions to be incorporated into a binding Purchasing Agreement. This Letter does not require either party to negotiate in good faith or to proceed to the completion of a binding Purchase Agreement. The parties shall not be contractually bound unless and until they enter a formal, written Purchase Agreement, which must be in form and content satisfactory to each party and to each party's legal counsel, in their sole discretion. Neither party may rely on this Letter as creating any legal obligation of any kind.",
  "",
  "If this is something that interests you, please sign below, and we'll draft an official agreement.",
  "BUYER: {{The Buyers}}",
  "Seller Signature:",
  "_____________________________________________________"
].join("\n");

var SUBTO_LOI_DEFAULT_BODY = [
  "LETTER OF INTENT",
  "TO PURCHASE REAL ESTATE",
  "",
  "This Real Estate Letter of Intent (the ΓÇ£Letter of IntentΓÇ¥ or ΓÇ£LetterΓÇ¥) is entered on {{TodayΓÇÖs Date}} (the ΓÇ£Effective DateΓÇ¥) and provides a written expression of the mutual interest between the below parties.",
  "",
  "The purpose of this letter is to set some of the basic terms and conditions of the proposed purchase by the undersigned (the ΓÇ£Buyer\") of certain real estate owned by you (the ΓÇ£Seller\"). The terms set forth in this Letter will not become binding until a more detailed ΓÇ£Purchase Agreement\" is negotiated and signed by the parties, as contemplated below by the section of this Letter entitled \"Non-Binding.\"",
  "",
  "The BUYER(S):",
  "{{The Buyers}}",
  "",
  "The SELLER(S):",
  "{{The Sellers}}",
  "",
  "The PROPERTY ADDRESS:",
  "{{PROPERTY ADDRESS}}",
  "",
  "Additional Description:",
  "{{Additional Description}}",
  "",
  "Property Type: {{Property Type}}",
  "",
  "We are writing to express our intent to buy the property described herein (the ΓÇ£Transaction\"). This letter of intent outlines the options and general terms and conditions of our proposal, which we believe provides a foundation for further discussions. Please note this document is non-binding and is intended solely as a preliminary understanding between the Buyer(s) and Seller(s).",
  "",
  "Proposal for a real estate transaction related to the above property",
  "",
  "Approximate Loan Balance: {{Loan Balance}}",
  "Payment to the Seller: {{Payment to the Seller}}",
  "Approximate Interest rate: {{Approximate Interest rate}}",
  "Approximate Monthly Payment: {{Approximate Monthly payment}}",
  "Payment to the Agent: {{Payment to the Agent}}",
  "Closing Costs the seller DOESN'T PAY: {{Closing Costs}}",
  "Terms & Conditions:",
  "* The buyer takes over the house with existing mortgage payments. This offer is not for an assumption",
  "* Seller will receive the remaining equity on a Promissory Note with Monthly Payments",
  "* CLOSING: On or Before 30 Days",
  "* 14 DAY Inspection from Effective Date",
  "* AS IS PURCHASE",
  "* BuyerΓÇÖs choice of Escrow",
  "* Exact Vesting to be determined during Escrow",
  "* Buyer is responsible for Taxes, HOA, Insurance (if any), and all other payments related to the house.",
  "* The seller may leave any unwanted items in the home upon closing",
  "* To summarize, we are providing a solution for your client to smoothly transition without any financial obligation by taking on full responsibility of the home and paying your commissions.",
  "",
  "NON-BINDING This letter of Intent does not and is not intended to contractually bind the parties and is only an expression of the basic conditions to be incorporated into a binding Purchasing Agreement. This Letter does not require either party to negotiate in good faith or to proceed to the completion of a binding Purchase Agreement. The parties shall not be contractually bound unless and until they enter a formal, written Purchase Agreement, which must be in form and content satisfactory to each party and to each party's legal counsel, in their sole discretion. Neither party may rely on this Letter as creating any legal obligation of any kind.",
  "",
  "If this is something that interests you, please sign below, and we'll draft an official agreement.",
  "BUYER: {{The Buyers}}",
  "Seller Signature:",
  "_____________________________________________________"
].join("\n");

/* ==========================================
   CORE LOGIC & HELPERS
   ========================================== */

function normalizeTemplateKey_(key) {
  var normalized = String(key || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  
  if (normalized === "initialoutreach" || normalized === "initial" || normalized === "initialoutreachgeneral") return "InitialOutreach_General";
  if (normalized === "initialoutreachcash" || normalized === "initialcash") return "InitialOutreach_Cash";
  if (normalized === "initialoutreachsellerfinance" || normalized === "initialoutreachsellerfinancing") return "InitialOutreach_SellerFinance";
  if (normalized === "initialoutreachsubto" || normalized === "initialoutreachsubjectto") return "InitialOutreach_SubTo";
  
  if (normalized === "cash" || normalized === "cashoffer") return "Cash";
  if (normalized === "sellerfinance" || normalized === "sellerfinancing" || normalized === "sellerfinanceoffer") return "SellerFinance";
  if (normalized === "subto" || normalized === "subjectto" || normalized === "subtooffer") return "SubTo";
  
  return String(key || "").trim();
}

/**
 * Dynamically maps a Google Doc title to one of the 7 template keys.
 */
function mapDocToTemplateKey_(title) {
  var t = String(title || "").trim().toLowerCase();
  
  var isOutreach = (t.indexOf("outreach") !== -1 || t.indexOf("initial") !== -1 || t.indexOf("email") !== -1);
  
  if (t.indexOf("seller finance") !== -1 || t.indexOf("sellerfinance") !== -1 || t.indexOf("seller financing") !== -1 || t.indexOf("sellerfinancing") !== -1 || t.indexOf("sf") !== -1) {
    return isOutreach ? "InitialOutreach_SellerFinance" : "SellerFinance";
  }
  
  if (t.indexOf("subto") !== -1 || t.indexOf("sub to") !== -1 || t.indexOf("subject to") !== -1 || t.indexOf("subject-to") !== -1 || t.indexOf("sub") !== -1) {
    return isOutreach ? "InitialOutreach_SubTo" : "SubTo";
  }
  
  if (t.indexOf("cash") !== -1) {
    return isOutreach ? "InitialOutreach_Cash" : "Cash";
  }
  
  if (isOutreach) {
    return "InitialOutreach_General";
  }
  
  return null;
}

/**
 * Ensures the workbook sheet named "Templates" exists,
 * migrating any old sheet and setting headers, then seeding defaults.
 */
function ensureEmailTemplatesSheet_() {
  var ss = getEmailTemplatesWorkbook_();
  var sheet = ss.getSheetByName("Templates");

  if (!sheet) {
    var oldSheet = ss.getSheetByName("Email Templates Config");
    if (oldSheet) {
      sheet = oldSheet;
      try {
        sheet.setName("Templates");
      } catch (e) {
        console.warn("Could not rename Email Templates Config sheet to Templates: " + e.message);
      }
    } else {
      sheet = ss.insertSheet("Templates");
    }
  }

  var headers = ["Template Key", "Subject", "Body", "Template Type", "Source Doc URL", "Tokens", "Updated At"];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    var firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    if (String(firstRow[0]).trim() !== "Template Key") {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  seedDefaultTemplates_(sheet);

  return sheet;
}

/**
 * Seeds missing rows from Google Docs or fallback values, mapping dynamically by title.
 */
function seedDefaultTemplates_(sheet) {
  var values = sheet.getDataRange().getDisplayValues();
  var existingKeys = {};
  for (var i = 1; i < values.length; i++) {
    var rawKey = String(values[i][0]).trim();
    var subject = String(values[i][1] || "").trim();
    var body = String(values[i][2] || "").trim();
    if (rawKey && (subject || body)) {
      existingKeys[rawKey] = {
        row: i + 1,
        subject: subject,
        body: body
      };
    }
  }

  var requiredKeys = [
    "InitialOutreach_General",
    "InitialOutreach_Cash",
    "InitialOutreach_SellerFinance",
    "InitialOutreach_SubTo",
    "Cash",
    "SellerFinance",
    "SubTo"
  ];

  var missingOrBlankKeys = [];
  requiredKeys.forEach(function(key) {
    if (!existingKeys[key]) {
      missingOrBlankKeys.push(key);
    }
  });

  if (missingOrBlankKeys.length === 0) {
    // All templates are already seeded and present! No need to open Google Docs.
    return;
  }

  var docMappings = {}; 
  var docErrors = [];
  var docMapList = [];
  var activeUserEmail = "";
  try {
    activeUserEmail = Session.getEffectiveUser().getEmail();
  } catch (e) {}

  // RULE: If any non-header rows exist in the Templates tab, skip opening Google Docs entirely.
  var hasExistingRows = (values.length > 1);

  if (!hasExistingRows) {
    var docIds = [
      "1B0z4WQ-BaGUJyRjNYMfiq3CfcQVYgHUyQuS1DaAko8Q",
      "1qQvtcyYQH3MPpAUvF6humT52AvgiWN0Ak6jpRDXW4nw",
      "1aaoXKSL7uJp1VxrhV781_1UHQPVnj_fUhCtibGOU8lU",
      "1IxVv1dPMO0yEQ8kPXt_XDm7rsr_wg2SKzJBNxXADTPs",
      "1w2x3_MqqtrqYcHx6BIYimrTxDwWgsWgkKg1aCbww93U"
    ];

    // Attempt to load and map all 5 Google Docs
    for (var d = 0; d < docIds.length; d++) {
      var docId = docIds[d];
      var docUrl = "https://docs.google.com/document/d/" + docId + "/edit?tab=t.0";
      try {
        var doc = DocumentApp.openById(docId);
        var title = doc.getName();
        var bodyText = doc.getBody().getText();
        var templateKey = mapDocToTemplateKey_(title);
        
        if (templateKey) {
          docMappings[templateKey] = {
            title: title,
            id: docId,
            url: docUrl,
            body: bodyText
          };
          docMapList.push(title + " | " + docId + " | " + templateKey);
        } else {
          docMapList.push(title + " | " + docId + " | [UNRESOLVED]");
        }
      } catch (err) {
        docErrors.push({
          id: docId,
          url: docUrl,
          error: err.message || String(err)
        });
      }
    }

    if (docMapList.length > 0) {
      console.log("Doc Title | Doc ID | Template Key\n" + docMapList.join("\n"));
    }

    if (docErrors.length > 0) {
      docErrors.forEach(function(errObj) {
        console.warn("Non-fatal: Google Doc failed to open during template seeding. Doc ID: " + errObj.id + ", Error: " + errObj.error + ". Falling back to built-in defaults.");
      });
    }
  } else {
    console.log("Templates tab already has existing rows. Skipping Google Doc seeding completely and using built-in defaults for missing keys.");
  }

  var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  var rowAdded = false;

  requiredKeys.forEach(function(key) {
    if (!existingKeys[key]) {
      var type = (key.indexOf("InitialOutreach") === 0) ? "Email" : "LOI";
      var subject = "";
      var body = "";
      var docUrl = "";

      if (docMappings[key]) {
        var mappedDoc = docMappings[key];
        body = mappedDoc.body;
        docUrl = mappedDoc.url;
        
        if (key === "Cash") subject = "Cash offer for {{PROPERTY ADDRESS}}";
        else if (key === "SellerFinance") subject = "Seller finance offer for {{PROPERTY ADDRESS}}";
        else if (key === "SubTo") subject = "Subject-to offer for {{PROPERTY ADDRESS}}";
        else if (key === "InitialOutreach_SellerFinance") subject = "Potential Offer for {{PROPERTY ADDRESS}}";
        else if (key === "InitialOutreach_SubTo") subject = "Potential Offer for {{PROPERTY ADDRESS}}";
      } else {
        var defaults = EMAIL_TEMPLATE_DEFAULTS[key] || { subject: "", body: "" };
        subject = defaults.subject;
        body = defaults.body;
        if (key === "Cash") {
          body = CASH_LOI_DEFAULT_BODY;
        } else if (key === "SellerFinance") {
          body = SELLER_FINANCE_LOI_DEFAULT_BODY;
        } else if (key === "SubTo") {
          body = SUBTO_LOI_DEFAULT_BODY;
        }
      }

      var tokensList = extractTokensFromTemplateText_(subject + " " + body).join(", ");
      sheet.appendRow([key, subject, body, type, docUrl, tokensList, nowStr]);
      rowAdded = true;
    }
  });

  if (rowAdded) {
    SpreadsheetApp.flush();
  }
}

/**
 * Loads all merged templates and available tokens.
 */
function getEmailTemplates_() {
  try {
    var sheet = ensureEmailTemplatesSheet_();
    var ss = getEmailTemplatesWorkbook_();

    // Dynamically ensure LOI template copies exist
    var loiTemplates = {};
    try {
      if (typeof getLoiFolderForWorkbook_ === "function" && typeof ensureUserLoiTemplates_ === "function") {
        var folder = getLoiFolderForWorkbook_(ss);
        ensureUserLoiTemplates_(ss, folder);
      }
    } catch (folderErr) {
      console.warn("getEmailTemplates_: Unable to auto-seed LOI template copies (" + folderErr.message + "). This is normal if onboarding folder is not yet set up.");
    }

    var values = sheet.getDataRange().getDisplayValues();
    var overridesByKey = {};
    
    for (var i = 1; i < values.length; i++) {
      var key = String(values[i][0]).trim();
      if (key) {
        overridesByKey[key] = {
          subject: String(values[i][1] || ""),
          body: String(values[i][2] || "")
        };
        // Record LOI template custom Google Doc URLs for the frontend with automatic normalization
        if (key.indexOf("LOI_") === 0 && values[i][4]) {
          var keyPart = key.substring(4);
          var normalizedPart = normalizeTemplateKey_(keyPart);
          if (normalizedPart) {
            loiTemplates[normalizedPart] = String(values[i][4]).trim();
            // Preserve prefixed key for backward compatibility
            loiTemplates["LOI_" + normalizedPart] = String(values[i][4]).trim();
          }
        }
      }
    }

    var mergedTemplates = {};
    
    EMAIL_TEMPLATE_KEYS.forEach(function(key) {
      var defaults = EMAIL_TEMPLATE_DEFAULTS[key] || { subject: "", body: "" };
      var override = overridesByKey[key];
      
      var subject = (override && override.subject.trim() !== "") ? override.subject : defaults.subject;
      var body = (override && override.body.trim() !== "") ? override.body : defaults.body;

      if (key === "Cash" && (!override || override.body.trim() === "")) {
        body = CASH_LOI_DEFAULT_BODY;
      } else if (key === "SellerFinance" && (!override || override.body.trim() === "")) {
        body = SELLER_FINANCE_LOI_DEFAULT_BODY;
      } else if (key === "SubTo" && (!override || override.body.trim() === "")) {
        body = SUBTO_LOI_DEFAULT_BODY;
      }

      mergedTemplates[key] = {
        key: key,
        subject: String(subject || ""),
        body: String(body || "")
      };
    });

    // Client side backward compatibility mappings
    mergedTemplates["InitialOutreach"] = mergedTemplates["InitialOutreach_General"];
    mergedTemplates["Cash"] = mergedTemplates["Cash"];
    mergedTemplates["SellerFinance"] = mergedTemplates["SellerFinance"];
    mergedTemplates["SubTo"] = mergedTemplates["SubTo"];

    return {
      success: true,
      templates: mergedTemplates,
      loiTemplates: loiTemplates,
      availableTokens: getAvailableTemplateTokens_()
    };

  } catch (fatalErr) {
    return {
      success: false,
      message: fatalErr.message || String(fatalErr)
    };
  }
}

/**
 * Saves updated templates to the Templates tab, recalculating Tokens and stamps Updated At.
 */
function saveEmailTemplates_(payload) {
  payload = payload || {};
  var incomingTemplates = payload.templates || payload;

  try {
    var sheet = ensureEmailTemplatesSheet_();
    var values = sheet.getDataRange().getDisplayValues();
    
    var rowByKey = {};
    var sourceDocUrlByKey = {};
    var typeByKey = {};
    
    for (var i = 1; i < values.length; i++) {
      var key = String(values[i][0]).trim();
      if (key) {
        rowByKey[key] = i + 1;
        sourceDocUrlByKey[key] = String(values[i][4] || "").trim();
        typeByKey[key] = String(values[i][3] || "").trim();
      }
    }

    var keysToSave = [
      "InitialOutreach_General",
      "InitialOutreach_Cash",
      "InitialOutreach_SellerFinance",
      "InitialOutreach_SubTo",
      "Cash",
      "SellerFinance",
      "SubTo"
    ];

    // Backward-compatible mapping for legacy InitialOutreach key
    if (incomingTemplates["InitialOutreach"] && !incomingTemplates["InitialOutreach_General"]) {
      incomingTemplates["InitialOutreach_General"] = incomingTemplates["InitialOutreach"];
    }

    var savedCount = 0;
    var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    keysToSave.forEach(function(targetKey) {
      var template = incomingTemplates[targetKey];
      if (!template) return;

      var subject = String(template.subject || "").trim();
      var body = String(template.body || "").trim();
      var type = typeByKey[targetKey] || ((targetKey.indexOf("InitialOutreach") === 0) ? "Email" : "LOI");
      var docUrl = sourceDocUrlByKey[targetKey] || "";
      var tokensList = extractTokensFromTemplateText_(subject + " " + body).join(", ");

      var rowNumber = rowByKey[targetKey];
      if (!rowNumber) {
        sheet.appendRow([targetKey, subject, body, type, docUrl, tokensList, nowStr]);
      } else {
        sheet.getRange(rowNumber, 1, 1, 7).setValues([[targetKey, subject, body, type, docUrl, tokensList, nowStr]]);
      }
      savedCount++;
    });

    SpreadsheetApp.flush();

    var templatesResult = getEmailTemplates_();

    return {
      success: true,
      savedCount: savedCount,
      templates: templatesResult.templates,
      availableTokens: templatesResult.availableTokens
    };

  } catch (err) {
    return {
      success: false,
      message: err.message || String(err)
    };
  }
}

/**
 * Helper to retrieve the correct outreach template key based on offer type.
 * Normalizes offer type inputs:
 *  Subject To, SubTo, subto => InitialOutreach_SubTo
 *  Seller Finance, SellerFinance, seller_finance => InitialOutreach_SellerFinance
 *
 * @param {String} offerType The offer type string
 * @return {String} Normalized outreach template key
 */
function getInitialOutreachTemplateKeyForOfferType_(offerType) {
  var normalized = String(offerType || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "subto" || normalized === "subjectto") {
    return "InitialOutreach_SubTo";
  }
  if (normalized === "sellerfinance" || normalized === "sellerfinancing") {
    return "InitialOutreach_SellerFinance";
  }
  if (normalized === "cash" || normalized === "cashoffer") {
    return "InitialOutreach_Cash";
  }
  return "InitialOutreach_General";
}

function getEmailTemplateForType_(type) {
  var normKey = normalizeTemplateKey_(type);
  var templatesResult = getEmailTemplates_();
  
  if (templatesResult.success && templatesResult.templates && templatesResult.templates[normKey]) {
    var t = templatesResult.templates[normKey];
    if (t.subject.trim() || t.body.trim()) {
      return {
        key: t.key,
        subject: String(t.subject || ""),
        body: String(t.body || "")
      };
    }
  }
  
  var defaults = EMAIL_TEMPLATE_DEFAULTS[normKey] || EMAIL_TEMPLATE_DEFAULTS["InitialOutreach_General"];
  var body = defaults.body;
  if (normKey === "Cash") body = CASH_LOI_DEFAULT_BODY;
  else if (normKey === "SellerFinance") body = SELLER_FINANCE_LOI_DEFAULT_BODY;
  else if (normKey === "SubTo") body = SUBTO_LOI_DEFAULT_BODY;
  
  return {
    key: normKey,
    subject: String(defaults.subject || ""),
    body: String(body || "")
  };
}

/**
 * Backward-compatible wrapper for token replacements using the new Token Registry.
 */
function replaceEmailTokens_(text, payload, offerDate, type) {
  var tokenMap = buildTokenMapForPayload_(payload, {}, {}, offerDate, type);
  return replaceAllTemplateTokens_(text, tokenMap);
}

function getFirstNameFromSeller_(sellerName) {
  var cleaned = String(sellerName || "").trim();
  if (!cleaned) return "";
  return cleaned.split(/\s+/)[0] || "";
}

function formatOfferTypeLabel_(type) {
  var normalized = String(type || "").trim().toLowerCase().replace(/[\s_-]+/g, "");

  if (normalized === "cash") {
    return "Cash";
  }
  if (normalized === "sellerfinance" || normalized === "sellerfinancing") {
    return "Seller Finance";
  }
  if (normalized === "subto" || normalized === "subjectto") {
    return "Subject To";
  }
  if (normalized.indexOf("initial") !== -1) {
    return "Initial Outreach";
  }
  return String(type || "").trim();
}

/**
 * Securely opens the customer workbook. Catch access errors to format our diagnostic message.
 */
function getEmailTemplatesWorkbook_() {
  var activeUserEmail = "";
  var customerSheetId = "";
  try {
    activeUserEmail = Session.getActiveUser().getEmail();
  } catch (e) {}
  try {
    customerSheetId = PropertiesService.getScriptProperties().getProperty("customerSheetId");
  } catch (e) {}

  try {
    if (typeof requireApprovedUser_ === "function") {
      var user = requireApprovedUser_();
      if (user) {
        if (user.email) activeUserEmail = user.email;
        if (user.customerSheetId) customerSheetId = user.customerSheetId;
      }
    }
  } catch (e) {}

  if (!customerSheetId) {
    throw new Error("ONBOARDING_REQUIRED: Customer workbook has not been created yet.");
  }

  try {
    var ss;
    if (typeof openCustomerSpreadsheet_ === "function") {
      var ctx = openCustomerSpreadsheet_();
      if (ctx && ctx.ss) {
        ss = ctx.ss;
      }
    }
    if (!ss) {
      ss = SpreadsheetApp.openById(customerSheetId);
    }
    if (!ss) {
      throw new Error("SpreadsheetApp.openById returned null");
    }
    return ss;
  } catch (err) {
    throw new Error("Customer workbook access failed. Make sure the assigned customer workbook is shared with this Google account: " + activeUserEmail + ". Workbook ID: " + customerSheetId + ".");
  }
}

function formatEmailTemplateDate_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "MM/dd/yyyy");
  }
  return String(value || "").trim();
}
