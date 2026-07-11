/**************************************
 * Deal Cannon Core — Templates_SellerFinance.gs
 * Hardcoded Seller Finance LOI template.
 **************************************/

function getSellerFinanceLoiTemplate_() {
  return [
    '<div class="loi-title">LETTER OF INTENT</div>',
    '<div class="loi-subtitle">TO PURCHASE REAL ESTATE</div>',

    '<p>',
      'This Real Estate Letter of Intent (the “Letter of Intent” or “Letter”) is entered on {{todaysDate}} ',
      '(the “Effective Date”) and provides a written expression of the mutual interest between the parties below.',
    '</p>',

    '<p>',
      'The purpose of this letter is to set some of the basic terms and conditions of the proposed purchase by the undersigned ',
      '(the “Buyer") of certain real estate owned by you (the “Seller"). The terms outlined in this Letter will not become binding ',
      'until a more detailed “Purchase Agreement" is negotiated and signed by the parties, as contemplated below by the section of this Letter entitled "Non-Binding."',
    '</p>',

    '<p><strong>The BUYER(S):</strong></p>',
    '<div class="loi-box">{{buyers}}</div>',

    '<p><strong>The SELLER(S):</strong></p>',
    '<div class="loi-box">{{sellerName}}</div>',

    '<p><strong>The PROPERTY ADDRESS:</strong></p>',
    '<div class="loi-box">{{propertyAddress}}</div>',

    '<p>Additional Description:</p>',
    '<p>{{description}}</p>',

    '<p>Property Type: {{propertyType}}</p>',

    '<br>',
    '<br>',

    '<p>',
      'We are writing to express our intent to buy the property described herein (the “Transaction"). This letter of intent outlines ',
      'the options and general terms and conditions of our proposal, which we believe provides a foundation for further discussions. ',
      'Please note this document is non-binding and is intended solely as a preliminary understanding between the Buyer(s) and Seller(s).',
    '</p>',

    '<p>Proposal for a real estate transaction related to the above property</p>',

    '<p>Offer Price: {{offerPrice}}</p>',
    '<p>Down Payment: {{downPayment}}</p>',
    '<p>Seller Financing amount: {{sellerFinancingAmount}}</p>',
    '<p>Length of the Loan in Years (Balance due in full): {{loanLengthYears}}</p>',
    '<p>Amortization terms: {{amortizationYears}}</p>',
    '<p>Interest Rate: {{interestRate}}</p>',
    '<p>Monthly Payment: {{monthlyPayment}}</p>',
    '<p>Payment to the Agent: {{paymentToAgent}}</p>',
    '<p>Total Interest Made: {{totalInterestMade}}</p>',
    '<p>Closing Costs the seller DOESN&apos;T PAY: {{closingCosts}}</p>',
    '<p>Total $ to Seller, including Savings on Fees/Commissions: {{totalToSeller}}</p>',

    '<p>Terms &amp; Conditions:</p>',
    '<p>The Seller will act as the lender, receiving monthly payments for holding the promissory note, and will have no landlord responsibilities or property management obligations.</p>',
    '<p>Closing: On or before 30 days from the Effective Date, or sooner if mutually agreed.</p>',
    '<p>Inspection period: 14 days from the Effective Date.</p>',
    '<p>AS-IS PURCHASE.</p>',
    '<p>Buyer’s choice of escrow and closing agent.</p>',
    '<p>Exact vesting to be determined during escrow.</p>',
    '<p>Buyer shall be responsible for all property expenses, including property taxes, insurance, HOA dues (if any), utilities, maintenance, and repairs.</p>',
    '<p>Buyer reserves the right to assign this agreement to any affiliated entity, partner LLC, or designee.</p>',
    '<p>The seller may leave any unwanted personal property in the home upon closing.</p>',
    '<p>The Seller pays NO closing costs, NO fees, and NO commissions, and closing will occur on the Seller’s preferred timeline.</p>',

    '<br>',

    '<p>',
      '<strong>NON-BINDING</strong> This letter of Intent does not and is not intended to bind the parties contractually and is only an expression ',
      'of the basic conditions to be incorporated into a binding Purchasing Agreement. This Letter does not require either party to negotiate in good faith ',
      'or to proceed to the completion of a binding Purchase Agreement. The parties shall not be contractually bound unless and until they enter a formal, ',
      'written Purchase Agreement, which must be in form and content satisfactory to each party and to each party&apos;s legal counsel, in their sole discretion. ',
      'Neither party may rely on this Letter as creating any legal obligation of any kind.',
    '</p>',

    '<p>If this is something that interests you, please sign below, and we&apos;ll draft an official agreement.</p>',

    '<p>BUYER:</p>',
    '<p>{{buyers}}</p>',

    '<p>Seller Signature:</p>',
    '<p>_________________________________</p>'
  ].join('');
}