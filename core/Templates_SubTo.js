/**************************************
 * Deal Cannon Core — Templates_SubTo.gs
 * Hardcoded Subject To LOI template.
 **************************************/

function getSubToLoiTemplate_() {
  return [
    '<div class="loi-title">LETTER OF INTENT</div>',
    '<div class="loi-subtitle">TO PURCHASE REAL ESTATE</div>',

    '<p>',
      'This Real Estate Letter of Intent (the “Letter of Intent” or “Letter”) is entered on {{todaysDate}} ',
      '(the “Effective Date”) and provides a written expression of the mutual interest between the below parties.',
    '</p>',

    '<p>',
      'The purpose of this letter is to set some of the basic terms and conditions of the proposed purchase by the undersigned ',
      '(the “Buyer") of certain real estate owned by you (the “Seller"). The terms set forth in this Letter will not become binding ',
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

    '<p>Approximate Loan Balance: {{loanBalance}}</p>',
    '<p>Payment to the Seller: {{paymentToSeller}}</p>',
    '<p>Approximate Interest rate: {{interestRate}}</p>',
    '<p>Approximate Monthly Payment: {{monthlyPayment}}</p>',
    '<p>Payment to the Agent: {{paymentToAgent}}</p>',
    '<p>Closing Costs the seller DOESN&apos;T PAY: {{closingCosts}}</p>',

    '<p>Terms &amp; Conditions:</p>',
    '<p>The buyer takes over the house with existing mortgage payments. This offer is not for an assumption.</p>',
    '<p>Seller will receive the remaining equity on a Promissory Note with Monthly Payments.</p>',
    '<p>CLOSING: On or Before 30 Days</p>',
    '<p>14 DAY Inspection from Effective Date</p>',
    '<p>AS IS PURCHASE</p>',
    '<p>Buyer’s choice of Escrow</p>',
    '<p>Exact Vesting to be determined during Escrow</p>',
    '<p>Buyer is responsible for Taxes, HOA, Insurance (if any), and all other payments related to the house.</p>',
    '<p>The seller may leave any unwanted items in the home upon closing</p>',

    '<p>',
      'To summarize, we are providing a solution for your client to smoothly transition without any financial obligation by taking on ',
      'full responsibility of the home and paying your commissions.',
    '</p>',

    '<br>',

    '<p>',
      '<strong>NON-BINDING</strong> This letter of Intent does not and is not intended to contractually bind the parties and is only an expression ',
      'of the basic conditions to be incorporated into a binding Purchasing Agreement. This Letter does not require either party to negotiate in good faith ',
      'or to proceed to the completion of a binding Purchase Agreement. The parties shall not be contractually bound unless and until they enter a formal, ',
      'written Purchase Agreement, which must be in form and content satisfactory to each party and to each party&apos;s legal counsel, in their sole discretion. ',
      'Neither party may rely on this Letter as creating any legal obligation of any kind.',
    '</p>',

    '<p>If this is something that interests you, please sign below, and we&apos;ll draft an official agreement.</p>',

    '<p>BUYER: {{buyers}}</p>',

    '<p>Seller Signature:</p>',
    '<p>_____________________________________________________</p>'
  ].join('');
}