/**************************************
 * Deal Cannon Core - TokenRegistry.js
 * Centralized registry for all outreach, LOI, and scheduler tokens.
 **************************************/

/**
 * Returns a stable list of all available tokens, including:
 * 1. Common email tokens
 * 2. Property/seller/buyer tokens
 * 3. Cash offer tokens
 * 4. Seller finance tokens
 * 5. SubTo tokens
 * 6. Outreach/listing/scheduler tokens
 * 7. Any custom tokens found dynamically in the customer workbook Templates tab
 *
 * @return {Array<String>} Unique list of available tokens in stable order
 */
function getAvailableTemplateTokens_() {
  var predefined = [
    // 1. Common email tokens
    "{{FIRSTNAME}}",
    "{{PROPERTY ADDRESS}}",
    "{{SELLER NAME}}",
    "{{OFFER TYPE}}",
    "{{TODAY}}",
    "{{YOUR NAME}}",
    "{{PHONE}}",
    "{{Today’s Date}}",
    "{{Today's Date}}",
    "{{Payment to the Seller}}",
    
    // 2. Property/seller/buyer tokens
    "{{buyers}}",
    "{{sellerName}}",
    "{{propertyAddress}}",
    "{{description}}",
    "{{propertyType}}",
    "{{The Buyers}}",
    "{{The Sellers}}",
    "{{Property Address}}",
    "{{Additional Description}}",
    "{{Property Type}}",
    "{{Buyer LLC}}",
    
    // 3. Cash offer tokens
    "{{purchasePrice}}",
    "{{financeType}}",
    "{{earnestMoney}}",
    "{{Purchase Price}}",
    "{{Type of Financing}}",
    "{{Earnest Money Deposit}}",
    
    // 4. Seller finance tokens
    "{{offerPrice}}",
    "{{downPayment}}",
    "{{sellerFinancingAmount}}",
    "{{loanLengthYears}}",
    "{{amortizationYears}}",
    "{{interestRate}}",
    "{{monthlyPayment}}",
    "{{paymentToAgent}}",
    "{{totalInterestMade}}",
    "{{closingCosts}}",
    "{{totalToSeller}}",
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
    "{{Total $ to Seller, including Savings on Fees/Commissions}}",
    
    // 5. SubTo tokens
    "{{loanBalance}}",
    "{{paymentToSeller}}",
    "{{Approximate Interest Rate}}",
    "{{Approximate Monthly Payment}}",
    "{{Closing Costs}}",
    "{{Loan Balance}}",
    "{{Payment to Seller}}",
    "{{Approximate Interest rate}}",
    "{{Approximate Monthly payment}}",
    
    // 6. Outreach/listing/scheduler tokens
    "{{Address}}",
    "{{City}}",
    "{{Listing Agent Full Name}}",
    "{{Listing Price}}",
    "{{Buyer Name}}",
    "{{Buyer LLC}}",
    "{{Buyer Phone Number}}",
    "{{Buyer Calendar Link}}"
  ];

  var uniqueTokens = [];
  var seen = {};

  predefined.forEach(function(t) {
    var norm = t.trim().toLowerCase().replace(/\s+/g, " ");
    if (!seen[norm]) {
      seen[norm] = true;
      uniqueTokens.push(t);
    }
  });

  // Try to scan the custom workbook "Templates" sheet to add any custom tokens
  try {
    var ss = getEmailTemplatesWorkbook_();
    var sheet = ss.getSheetByName("Templates");
    if (!sheet) {
      sheet = ss.getSheetByName("Email Templates Config");
    }
    if (sheet) {
      var values = sheet.getDataRange().getDisplayValues();
      for (var i = 1; i < values.length; i++) {
        var subject = String(values[i][1] || "");
        var body = String(values[i][2] || "");
        var foundTokens = extractTokensFromTemplateText_(subject + " " + body);
        foundTokens.forEach(function(t) {
          var norm = t.trim().toLowerCase().replace(/\s+/g, " ");
          if (!seen[norm]) {
            seen[norm] = true;
            uniqueTokens.push(t);
          }
        });
      }
    }
  } catch (e) {
    // Non-fatal, just log and proceed
    console.warn("Could not load custom tokens from workbook Templates sheet: " + e.message);
  }

  return uniqueTokens;
}

/**
 * Extracts every token matching the pattern {{...}} from template text.
 * Spacing, capitalization, punctuation, curly apostrophes, etc. are preserved.
 *
 * @param {String} text Template text to scan
 * @return {Array<String>} Unique list of matching tokens including brackets
 */
function extractTokensFromTemplateText_(text) {
  if (!text) return [];
  
  var regex = /\{\{\s*([^{}]+?)\s*\}\}/g;
  var tokens = [];
  var seen = {};
  var match;
  
  while ((match = regex.exec(text)) !== null) {
    var rawToken = match[0]; // e.g. "{{PROPERTY ADDRESS}}"
    var innerContent = match[1]; // e.g. "PROPERTY ADDRESS"
    var norm = innerContent.trim().toLowerCase().replace(/\s+/g, " ");
    
    if (!seen[norm]) {
      seen[norm] = true;
      tokens.push(rawToken);
    }
  }
  
  return tokens;
}

/**
 * Maps all standard tokens and their spaced/capitalization aliases to their resolved values.
 *
 * @param {Object} payload Inputs from UI/triggers
 * @param {Object} loiData Stored LOI fields
 * @param {Object} computed Amortization results
 * @param {String} offerDate Selected or fallback offer date
 * @param {String} type Offer type (Cash, SellerFinance, SubTo)
 * @return {Object} Dictionary mapping token strings to resolved values
 */
function buildTokenMapForPayload_(payload, loiData, computed, offerDate, type) {
  payload = payload || {};
  loiData = loiData || {};
  computed = computed || {};

  var sellerName = String(payload.sellerName || payload.seller || payload.name || loiData.sellerName || "").trim();
  
  // Safeguard getFirstNameFromSeller_ if called globally
  var firstName = "";
  if (typeof getFirstNameFromSeller_ === "function") {
    firstName = getFirstNameFromSeller_(sellerName);
  } else {
    firstName = sellerName.split(/\s+/)[0] || "";
  }

  var propertyAddress = String(payload.propertyAddress || payload.address || loiData.propertyAddress || "").trim();
  var buyers = String(payload.buyers || loiData.buyers || payload.yourName || payload.buyerName || payload.senderName || "").trim();
  
  var today = "";
  if (offerDate && typeof formatEmailTemplateDate_ === "function") {
    today = formatEmailTemplateDate_(offerDate);
  } else if (loiData.todaysDate) {
    today = loiData.todaysDate;
  } else {
    today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy");
  }
    
  var offerType = "";
  if (typeof formatOfferTypeLabel_ === "function") {
    offerType = formatOfferTypeLabel_(type);
  } else {
    offerType = String(type || "").trim();
  }

  var phone = String(payload.phone || payload.buyerPhone || payload.phoneNumber || "").trim();

  var closingCostsValue = String(payload.closingCosts || computed.closingCosts || loiData.closingCosts || "").trim();
  var totalToSellerValue = String(computed.totalToSeller || loiData.totalToSeller || "").trim();
  var purchasePriceValue = String(payload.purchasePrice || payload.offerPrice || loiData.purchasePrice || loiData.offerPrice || "").trim();
  var downPaymentValue = String(payload.downPayment || loiData.downPayment || "").trim();
  var sfAmtValue = String(payload.sellerFinancingAmount || computed.sellerFinancingAmount || loiData.sellerFinancingAmount || "").trim();
  var loanYearsValue = String(payload.loanLengthYears || loiData.loanLengthYears || "").trim();
  var amortYearsValue = String(payload.amortizationYears || loiData.amortizationYears || "").trim();
  var interestRateValue = String(payload.interestRate || computed.interestRate || loiData.interestRate || "").trim();
  var monthlyPaymentValue = String(payload.monthlyPayment || computed.monthlyPayment || loiData.monthlyPayment || "").trim();
  var paymentToAgentValue = String(payload.paymentToAgent || computed.paymentToAgent || loiData.paymentToAgent || "").trim();
  var totalInterestValue = String(computed.totalInterestMade || loiData.totalInterestMade || "").trim();
  var loanBalanceValue = String(payload.loanBalance || computed.loanBalance || loiData.loanBalance || "").trim();
  var paymentToSellerValue = String(payload.paymentToSeller || computed.paymentToSeller || loiData.paymentToSeller || "").trim();
  var earnestMoneyValue = String(payload.earnestMoney || loiData.earnestMoney || "").trim();
  var financeTypeValue = String(payload.financeType || loiData.financeType || "").trim();
  var descriptionValue = String(payload.description || loiData.description || "").trim();
  var propertyTypeValue = String(payload.propertyType || computed.propertyType || loiData.propertyType || "").trim();

  var listingAgentName = String(payload.listingAgentFullName || sellerName || "").trim();
  var listingPrice = String(payload.listingPrice || purchasePriceValue || "").trim();
  var calendarLink = String(payload.buyerCalendarLink || "").trim();
  var city = String(payload.city || "").trim();

  var map = {
    // Common email tokens
    "{{FIRSTNAME}}": firstName,
    "{{PROPERTY ADDRESS}}": propertyAddress,
    "{{SELLER NAME}}": sellerName,
    "{{OFFER TYPE}}": offerType,
    "{{TODAY}}": today,
    "{{YOUR NAME}}": buyers,
    "{{PHONE}}": phone,

    // Today's Date curly and straight apostrophe aliases
    "{{Today’s Date}}": today,
    "{{Today's Date}}": today,

    // Property/seller/buyer tokens
    "{{buyers}}": buyers,
    "{{sellerName}}": sellerName,
    "{{propertyAddress}}": propertyAddress,
    "{{description}}": descriptionValue,
    "{{propertyType}}": propertyTypeValue,
    "{{The Buyers}}": buyers,
    "{{The Sellers}}": sellerName,
    "{{Property Address}}": propertyAddress,
    "{{Additional Description}}": descriptionValue,
    "{{Property Type}}": propertyTypeValue,
    "{{Buyer LLC}}": buyers,
    "{{Buyer Name}}": buyers,

    // Cash offer tokens
    "{{purchasePrice}}": purchasePriceValue,
    "{{financeType}}": financeTypeValue,
    "{{earnestMoney}}": earnestMoneyValue,
    "{{Purchase Price}}": purchasePriceValue,
    "{{Type of Financing}}": financeTypeValue,
    "{{Earnest Money Deposit}}": earnestMoneyValue,

    // Seller finance tokens
    "{{offerPrice}}": purchasePriceValue,
    "{{downPayment}}": downPaymentValue,
    "{{sellerFinancingAmount}}": sfAmtValue,
    "{{loanLengthYears}}": loanYearsValue,
    "{{amortizationYears}}": amortYearsValue,
    "{{interestRate}}": interestRateValue,
    "{{monthlyPayment}}": monthlyPaymentValue,
    "{{paymentToAgent}}": paymentToAgentValue,
    "{{totalInterestMade}}": totalInterestValue,
    "{{closingCosts}}": closingCostsValue,
    "{{totalToSeller}}": totalToSellerValue,
    "{{Offer Price}}": purchasePriceValue,
    "{{Down Payment}}": downPaymentValue,
    "{{Seller Financing amount}}": sfAmtValue,
    "{{Length of the Loan in Years (Balance due in full)}}": loanYearsValue,
    "{{Length of the Loan in Years}}": loanYearsValue,
    "{{Amortization terms}}": amortYearsValue,
    "{{Interest Rate}}": interestRateValue,
    "{{Monthly Payment}}": monthlyPaymentValue,
    "{{Payment to the Agent}}": paymentToAgentValue,
    "{{Total Interest Made}}": totalInterestValue,
    "{{Closing Costs the seller DOESN'T PAY}}": closingCostsValue,
    "{{Total $ to Seller, including Savings on Fees/Commissions}}": totalToSellerValue,

    // SubTo tokens
    "{{loanBalance}}": loanBalanceValue,
    "{{paymentToSeller}}": paymentToSellerValue,
    "{{Approximate Interest Rate}}": interestRateValue,
    "{{Approximate Monthly Payment}}": monthlyPaymentValue,
    "{{Closing Costs}}": closingCostsValue,
    "{{Loan Balance}}": loanBalanceValue,
    "{{Approximate Loan Balance}}": loanBalanceValue,
    "{{Payment to Seller}}": paymentToSellerValue,
    "{{Payment to the Seller}}": paymentToSellerValue,
    "{{Approximate Interest rate}}": interestRateValue,
    "{{Approximate Monthly payment}}": monthlyPaymentValue,

    // Outreach/listing/scheduler tokens
    "{{Address}}": propertyAddress,
    "{{City}}": city,
    "{{Listing Agent Full Name}}": listingAgentName,
    "{{Listing Price}}": listingPrice,
    "{{Buyer Name}}": buyers,
    "{{Buyer Phone Number}}": phone,
    "{{Buyer Calendar Link}}": calendarLink
  };

  return map;
}

/**
 * Replaces all occurrences of template tokens in string with mapped values.
 *
 * @param {String} text Text containing tokens
 * @param {Object} tokenMap Mapped values
 * @return {String} Fully replaced text
 */
function replaceAllTemplateTokens_(text, tokenMap) {
  if (!text) return "";
  var output = String(text);
  
  // Sort tokens by length in descending order to avoid substring mismatch errors
  var sortedTokens = Object.keys(tokenMap || {}).sort(function(a, b) {
    return b.length - a.length;
  });

  sortedTokens.forEach(function(token) {
    var replacement = tokenMap[token];
    if (replacement === undefined || replacement === null) {
      replacement = "";
    }
    output = output.split(token).join(String(replacement));
  });

  return output;
}
