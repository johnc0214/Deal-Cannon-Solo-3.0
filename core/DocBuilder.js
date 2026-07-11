/**************************************
 * Deal Cannon Core — DocBuilder.gs
 * Creates editable Google Docs from locked core templates.
 **************************************/

function createLoiGoogleDoc_(folder, fileName, type, loiData) {
  var doc = DocumentApp.create(fileName);
  var docId = doc.getId();
  var docFile = DriveApp.getFileById(docId);

  folder.addFile(docFile);

  try {
    DriveApp.getRootFolder().removeFile(docFile);
  } catch (err) {
    // Non-fatal. File is already added to destination folder.
  }

  var body = doc.getBody();
  body.clear();

  applyLoiDocumentStyles_(body);

  if (type === "Cash") {
    buildCashDocBody_(body, loiData);
  } else if (type === "SellerFinance") {
    buildSellerFinanceDocBody_(body, loiData);
  } else if (type === "SubTo") {
    buildSubToDocBody_(body, loiData);
  } else {
    throw new Error("Invalid LOI document type: " + type);
  }

  doc.saveAndClose();

  return {
    docId: docId,
    docFile: docFile,
    docUrl: docFile.getUrl()
  };
}

/* =========================
   BASE STYLES
========================== */

function applyLoiDocumentStyles_(body) {
  body.setMarginTop(36);
  body.setMarginBottom(36);
  body.setMarginLeft(54);
  body.setMarginRight(54);
}

function appendCenteredTitle_(body, text, fontSize) {
  var p = body.appendParagraph(String(text || ""));
  p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  p.setFontSize(fontSize || 16);
  p.setBold(false);
  p.setUnderline(false);
  p.setSpacingAfter(18);

  forceParagraphUnderline_(p, false);

  return p;
}

function appendText_(body, text) {
  var p = body.appendParagraph(String(text || ""));
  p.setFontSize(11);
  p.setBold(false);
  p.setUnderline(false);
  p.setSpacingAfter(8);

  forceParagraphUnderline_(p, false);

  return p;
}

function appendBlank_(body) {
  var p = body.appendParagraph("");
  p.setUnderline(false);
  p.setSpacingAfter(8);
  return p;
}

function appendLabel_(body, text) {
  var p = body.appendParagraph(String(text || ""));
  p.setFontSize(11);
  p.setBold(true);
  p.setUnderline(false);
  p.setSpacingAfter(6);

  forceParagraphUnderline_(p, false);

  return p;
}

function appendValueBox_(body, text) {
  var table = body.appendTable([[String(text || "")]]);
  table.setBorderWidth(1);

  var cell = table.getCell(0, 0);
  cell.setPaddingTop(8);
  cell.setPaddingBottom(8);
  cell.setPaddingLeft(8);
  cell.setPaddingRight(8);

  var p = cell.getChild(0).asParagraph();
  p.setFontSize(11);
  p.setBold(false);
  p.setUnderline(false);
  forceParagraphUnderline_(p, false);

  body.appendParagraph("").setSpacingAfter(6);

  return table;
}

function forceParagraphUnderline_(paragraph, underline) {
  try {
    paragraph.setUnderline(!!underline);

    var text = paragraph.editAsText();
    if (text && text.getText()) {
      text.setUnderline(!!underline);
    }
  } catch (err) {
    // Non-fatal formatting helper.
  }
}

function forceTextRangeBold_(paragraph, start, end, bold) {
  try {
    var text = paragraph.editAsText();
    if (text && text.getText() && start >= 0 && end >= start) {
      text.setBold(start, end, !!bold);
    }
  } catch (err) {
    // Non-fatal formatting helper.
  }
}

/* =========================
   OFFER TERMS BOX HELPERS
========================== */

function appendProposalHeading_(body) {
  var p = body.appendParagraph("Proposal for a real estate transaction related to the above property");
  p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  p.setUnderline(true);
  p.setFontSize(11);
  p.setBold(false);
  p.setSpacingBefore(8);
  p.setSpacingAfter(10);

  try {
    var text = p.editAsText();
    if (text && text.getText()) {
      text.setUnderline(true);
      text.setBold(false);
    }
  } catch (err) {
    // Non-fatal formatting helper.
  }

  return p;
}

function appendOfferTermsBox_(body, rows, terms) {
  var tableData = [];

  rows.forEach(function(row) {
    tableData.push([String(row.label || "") + ": " + String(row.value || "")]);
  });

  tableData.push(["Terms & Conditions:"]);

  var table = body.appendTable(tableData);
  table.setBorderWidth(1);

  for (var r = 0; r < table.getNumRows(); r++) {
    var cell = table.getCell(r, 0);

    cell.setPaddingTop(5);
    cell.setPaddingBottom(5);
    cell.setPaddingLeft(7);
    cell.setPaddingRight(7);

    var paragraph = cell.getChild(0).asParagraph();
    paragraph.setFontSize(10);
    paragraph.setBold(false);
    paragraph.setUnderline(false);
    forceParagraphUnderline_(paragraph, false);

    if (r < rows.length) {
      boldLabelInParagraph_(paragraph, rows[r].label + ":");
    }
  }

  var termsCell = table.getCell(rows.length, 0);
  var termsHeader = termsCell.getChild(0).asParagraph();
  termsHeader.setBold(true);
  termsHeader.setFontSize(10);
  termsHeader.setUnderline(false);
  forceParagraphUnderline_(termsHeader, false);

  terms.forEach(function(term) {
    var listItem = termsCell.appendListItem(String(term || ""));
    listItem.setGlyphType(DocumentApp.GlyphType.BULLET);
    listItem.setFontSize(10);
    listItem.setBold(false);
    listItem.setUnderline(false);

    try {
      var itemText = listItem.editAsText();
      if (itemText && itemText.getText()) {
        itemText.setUnderline(false);
        itemText.setBold(false);
      }
    } catch (err) {
      // Non-fatal formatting helper.
    }
  });

  body.appendParagraph("").setSpacingAfter(8);

  return table;
}

function boldLabelInParagraph_(paragraph, label) {
  var text = paragraph.editAsText();
  var full = text.getText();
  var end = String(label || "").length - 1;

  if (full.indexOf(label) === 0 && end >= 0) {
    text.setBold(0, end, true);
    text.setUnderline(false);
  }
}

/* =========================
   CASH DOC BODY
========================== */

function buildCashDocBody_(body, d) {
  appendCenteredTitle_(body, "LETTER OF INTENT", 16);
  appendCenteredTitle_(body, "TO PURCHASE REAL ESTATE", 14);

  appendText_(
    body,
    'This Real Estate Letter of Intent (the “Letter of Intent” or “Letter”) is entered on ' +
      d.todaysDate +
      ' (the “Effective Date”) and provides a written expression of the mutual interest between the below parties.'
  );

  appendText_(
    body,
    'The purpose of this letter is to set some of the basic terms and conditions of the proposed purchase by the undersigned (the “Buyer") of certain real estate owned by you (the “Seller"). The terms set forth in this Letter will not become binding until a more detailed “Purchase Agreement" is negotiated and signed by the parties, as contemplated below by the section of this Letter entitled "Non-Binding."'
  );

  appendLabel_(body, "The BUYER(S):");
  appendValueBox_(body, d.buyers);

  appendLabel_(body, "The SELLER(S):");
  appendValueBox_(body, d.sellerName);

  appendLabel_(body, "The PROPERTY ADDRESS:");
  appendValueBox_(body, d.propertyAddress);

  appendText_(body, "Additional Description:");
  appendValueBox_(body, d.description);

  appendText_(body, "Property Type: " + d.propertyType);

  appendBlank_(body);
  appendBlank_(body);

  appendText_(
    body,
    'We are writing to express our intent to buy the property described herein (the “Transaction"). This letter of intent outlines the options and general terms and conditions of our proposal, which we believe provides a foundation for further discussions. Please note this document is non-binding and is intended solely as a preliminary understanding between the Buyer(s) and Seller(s).'
  );

  appendProposalHeading_(body);

  appendOfferTermsBox_(
    body,
    [
      { label: "Offer Price", value: d.purchasePrice },
      { label: "Type of Financing", value: d.financeType },
      { label: "Earnest Money Deposit", value: d.earnestMoney }
    ],
    [
      "CLOSING: On or Before 30 Days",
      "14 DAY Inspection from Effective Date",
      "AS IS PURCHASE",
      "Buyer’s choice of Escrow",
      "Exact Vesting to be determined during Escrow",
      "Buyer is responsible for Taxes, HOA, Insurance (if any), and all other payments related to the house.",
      "The seller may leave any unwanted items in the home upon closing",
      "To summarize, we are providing a solution for your client to smoothly transition without any financial obligation by taking on full responsibility of the home and paying your commissions."
    ]
  );

  appendBlank_(body);

  appendText_(
    body,
    "NON-BINDING This letter of Intent does not and is not intended to contractually bind the parties and is only an expression of the basic conditions to be incorporated into a binding Purchasing Agreement. This Letter does not require either party to negotiate in good faith or to proceed to the completion of a binding Purchase Agreement. The parties shall not be contractually bound unless and until they enter a formal, written Purchase Agreement, which must be in form and content satisfactory to each party and to each party's legal counsel, in their sole discretion. Neither party may rely on this Letter as creating any legal obligation of any kind."
  );

  appendText_(body, "If this is something that interests you, please sign below, and we'll draft an official agreement.");
  appendText_(body, "BUYER: " + d.buyers);
  appendText_(body, "Seller Signature:");
  appendText_(body, "_____________________________________________________");
}

/* =========================
   SELLER FINANCE DOC BODY
========================== */

function buildSellerFinanceDocBody_(body, d) {
  appendCenteredTitle_(body, "LETTER OF INTENT", 16);
  appendCenteredTitle_(body, "TO PURCHASE REAL ESTATE", 14);

  appendText_(
    body,
    'This Real Estate Letter of Intent (the “Letter of Intent” or “Letter”) is entered on ' +
      d.todaysDate +
      ' (the “Effective Date”) and provides a written expression of the mutual interest between the parties below.'
  );

  appendText_(
    body,
    'The purpose of this letter is to set some of the basic terms and conditions of the proposed purchase by the undersigned (the “Buyer") of certain real estate owned by you (the “Seller"). The terms outlined in this Letter will not become binding until a more detailed “Purchase Agreement" is negotiated and signed by the parties, as contemplated below by the section of this Letter entitled "Non-Binding."'
  );

  appendLabel_(body, "The BUYER(S):");
  appendValueBox_(body, d.buyers);

  appendLabel_(body, "The SELLER(S):");
  appendValueBox_(body, d.sellerName);

  appendLabel_(body, "The PROPERTY ADDRESS:");
  appendValueBox_(body, d.propertyAddress);

  appendText_(body, "Additional Description:");
  appendValueBox_(body, d.description);

  appendText_(body, "Property Type: " + d.propertyType);

  appendBlank_(body);
  appendBlank_(body);

  appendText_(
    body,
    'We are writing to express our intent to buy the property described herein (the “Transaction"). This letter of intent outlines the options and general terms and conditions of our proposal, which we believe provides a foundation for further discussions. Please note this document is non-binding and is intended solely as a preliminary understanding between the Buyer(s) and Seller(s).'
  );

  appendProposalHeading_(body);

  appendOfferTermsBox_(
    body,
    [
      { label: "Offer Price", value: d.offerPrice },
      { label: "Down Payment", value: d.downPayment },
      { label: "Seller Financing amount", value: d.sellerFinancingAmount },
      { label: "Length of the Loan in Years (Balance due in full)", value: d.loanLengthYears },
      { label: "Amortization terms", value: d.amortizationYears },
      { label: "Interest Rate", value: d.interestRate },
      { label: "Monthly Payment", value: d.monthlyPayment },
      { label: "Payment to the Agent", value: d.paymentToAgent },
      { label: "Total Interest Made", value: d.totalInterestMade },
      { label: "Closing Costs the seller DOESN'T PAY", value: d.closingCosts },
      { label: "Total $ to Seller, including Savings on Fees/Commissions", value: d.totalToSeller }
    ],
    [
      "The Seller will act as the lender, receiving monthly payments for holding the promissory note, and will have no landlord responsibilities or property management obligations.",
      "Closing: On or before 30 days from the Effective Date, or sooner if mutually agreed.",
      "Inspection period: 14 days from the Effective Date.",
      "AS-IS PURCHASE.",
      "Buyer’s choice of escrow and closing agent.",
      "Exact vesting to be determined during escrow.",
      "Buyer shall be responsible for all property expenses, including property taxes, insurance, HOA dues (if any), utilities, maintenance, and repairs.",
      "Buyer reserves the right to assign this agreement to any affiliated entity, partner LLC, or designee",
      "The seller may leave any unwanted personal property in the home upon closing.",
      "The Seller pays NO closing costs, NO fees, and NO commissions, and closing will occur on the Seller’s preferred timeline."
    ]
  );

  appendBlank_(body);

  appendText_(
    body,
    "NON-BINDING This letter of Intent does not and is not intended to bind the parties contractually and is only an expression of the basic conditions to be incorporated into a binding Purchasing Agreement. This Letter does not require either party to negotiate in good faith or to proceed to the completion of a binding Purchase Agreement. The parties shall not be contractually bound unless and until they enter a formal, written Purchase Agreement, which must be in form and content satisfactory to each party and to each party's legal counsel, in their sole discretion. Neither party may rely on this Letter as creating any legal obligation of any kind."
  );

  appendText_(body, "If this is something that interests you, please sign below, and we'll draft an official agreement.");
  appendText_(body, "BUYER:");
  appendText_(body, d.buyers);
  appendText_(body, "Seller Signature:");
  appendText_(body, "_________________________________");
}

/* =========================
   SUB TO DOC BODY
========================== */

function buildSubToDocBody_(body, d) {
  appendCenteredTitle_(body, "LETTER OF INTENT", 16);
  appendCenteredTitle_(body, "TO PURCHASE REAL ESTATE", 14);

  appendText_(
    body,
    'This Real Estate Letter of Intent (the “Letter of Intent” or “Letter”) is entered on ' +
      d.todaysDate +
      ' (the “Effective Date”) and provides a written expression of the mutual interest between the below parties.'
  );

  appendText_(
    body,
    'The purpose of this letter is to set some of the basic terms and conditions of the proposed purchase by the undersigned (the “Buyer") of certain real estate owned by you (the “Seller"). The terms set forth in this Letter will not become binding until a more detailed “Purchase Agreement" is negotiated and signed by the parties, as contemplated below by the section of this Letter entitled "Non-Binding."'
  );

  appendLabel_(body, "The BUYER(S):");
  appendValueBox_(body, d.buyers);

  appendLabel_(body, "The SELLER(S):");
  appendValueBox_(body, d.sellerName);

  appendLabel_(body, "The PROPERTY ADDRESS:");
  appendValueBox_(body, d.propertyAddress);

  appendText_(body, "Additional Description:");
  appendValueBox_(body, d.description);

  appendText_(body, "Property Type: " + d.propertyType);

  appendBlank_(body);
  appendBlank_(body);

  appendText_(
    body,
    'We are writing to express our intent to buy the property described herein (the “Transaction"). This letter of intent outlines the options and general terms and conditions of our proposal, which we believe provides a foundation for further discussions. Please note this document is non-binding and is intended solely as a preliminary understanding between the Buyer(s) and Seller(s).'
  );

  appendProposalHeading_(body);

  appendOfferTermsBox_(
    body,
    [
      { label: "Approximate Loan Balance", value: d.loanBalance },
      { label: "Payment to the Seller", value: d.paymentToSeller },
      { label: "Approximate Interest rate", value: d.interestRate },
      { label: "Approximate Monthly Payment", value: d.monthlyPayment },
      { label: "Payment to the Agent", value: d.paymentToAgent },
      { label: "Closing Costs the seller DOESN'T PAY", value: d.closingCosts }
    ],
    [
      "The buyer takes over the house with existing mortgage payments. This offer is not for an assumption",
      "Seller will receive the remaining equity on a Promissory Note with Monthly Payments",
      "CLOSING: On or Before 30 Days",
      "14 DAY Inspection from Effective Date",
      "AS IS PURCHASE",
      "Buyer’s choice of Escrow",
      "Exact Vesting to be determined during Escrow",
      "Buyer is responsible for Taxes, HOA, Insurance (if any), and all other payments related to the house.",
      "The seller may leave any unwanted items in the home upon closing",
      "To summarize, we are providing a solution for your client to smoothly transition without any financial obligation by taking on full responsibility of the home and paying your commissions."
    ]
  );

  appendBlank_(body);

  appendText_(
    body,
    "NON-BINDING This letter of Intent does not and is not intended to contractually bind the parties and is only an expression of the basic conditions to be incorporated into a binding Purchasing Agreement. This Letter does not require either party to negotiate in good faith or to proceed to the completion of a binding Purchase Agreement. The parties shall not be contractually bound unless and until they enter a formal, written Purchase Agreement, which must be in form and content satisfactory to each party and to each party's legal counsel, in their sole discretion. Neither party may rely on this Letter as creating any legal obligation of any kind."
  );

  appendText_(body, "If this is something that interests you, please sign below, and we'll draft an official agreement.");
  appendText_(body, "BUYER: " + d.buyers);
  appendText_(body, "Seller Signature:");
  appendText_(body, "_____________________________________________________");
}