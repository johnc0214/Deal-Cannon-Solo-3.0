/**************************************
 * Deal Cannon Starter v2 — Code.gs
 * Thin shell wrapper.
 * Real logic lives in DealCannonCorev2.
 **************************************/

function doGet() {
  return HtmlService
    .createTemplateFromFile("index")
    .evaluate()
    .setTitle("Deal Cannon");
}

function include(filename) {
  return HtmlService
    .createTemplateFromFile(filename)
    .evaluate()
    .getContent();
}

/* =========================
   APP CONTEXT / AUTH
========================== */

function getAppContext() {
  return DealCannonCorev2.getAppContext();
}

function getSignedInEmailOnly() {
  var email = "";

  try {
    email = Session.getActiveUser().getEmail();
  } catch (err) {
    email = "";
  }

  return {
    success: true,
    email: email || ""
  };
}

function getCurrentUserContext() {
  var email = "";

  try {
    email = Session.getActiveUser().getEmail();
  } catch (err) {
    email = "";
  }

  var appContext = null;

  try {
    appContext = DealCannonCorev2.getAppContext();
  } catch (err2) {
    appContext = {
      success: false,
      error: err2 && err2.message ? err2.message : String(err2)
    };
  }

  return {
    success: true,
    email: email || "",
    appContext: appContext
  };
}

function forceAuth() {
  return DealCannonCorev2.forceAuth();
}

/**
 * Opens Google's account/session chooser for this deployed web app.
 */
function getGoogleAccountChooserUrl(emailHint) {
  var webAppUrl = "";

  try {
    webAppUrl = ScriptApp.getService().getUrl();
  } catch (err) {
    webAppUrl = "";
  }

  if (!webAppUrl) {
    throw new Error("WEB_APP_URL_NOT_AVAILABLE: Deploy the web app first, then try again.");
  }

  var returnUrl =
    webAppUrl +
    (webAppUrl.indexOf("?") === -1 ? "?" : "&") +
    "accountSwitch=1&t=" +
    encodeURIComponent(String(new Date().getTime()));

  var url =
    "https://accounts.google.com/AddSession" +
    "?continue=" + encodeURIComponent(returnUrl) +
    "&service=wise" +
    "&prompt=select_account";

  var fallbackUrl =
    "https://accounts.google.com/AccountChooser" +
    "?continue=" + encodeURIComponent(returnUrl) +
    "&service=wise" +
    "&prompt=select_account";

  return {
    success: true,
    url: url,
    fallbackUrl: fallbackUrl,
    returnUrl: returnUrl
  };
}

/* =========================
   OFFER GENERATION
========================== */

function generate(type, payload) {
  return DealCannonCorev2.generate(type, payload);
}

/* =========================
   EMAIL TEMPLATES
========================== */

function getEmailTemplates() {
  return DealCannonCorev2.getEmailTemplates();
}

function saveEmailTemplates(payload) {
  return DealCannonCorev2.saveEmailTemplates(payload);
}

/* =========================
   SETUP / FOLDER SETTINGS
========================== */

function saveOnboardingSettings(loiFolderUrl, archiveFolderUrl) {
  return DealCannonCorev2.saveOnboardingSettings(loiFolderUrl, archiveFolderUrl);
}

function getSetupState() {
  return DealCannonCorev2.getSetupState();
}

function saveUserFolderFromUrl(folderUrl) {
  return DealCannonCorev2.saveUserFolderFromUrl(folderUrl);
}

function getSetupStateForOfferType(offerType) {
  return DealCannonCorev2.getSetupStateForOfferType(offerType);
}

function saveUserFolderForOfferType(offerType, folderUrl, archiveFolderUrl) {
  return DealCannonCorev2.saveUserFolderForOfferType(offerType, folderUrl, archiveFolderUrl);
}

function clearUserFolderForOfferType(offerType) {
  return DealCannonCorev2.clearUserFolderForOfferType(offerType);
}

function clearUserFolder() {
  return DealCannonCorev2.clearUserFolder();
}

/* =========================
   DIAGNOSTICS
   Safe manual tests only.
========================== */

/**
 * Run this manually from the Starter editor.
 * Then open Executions → this run → Logs.
 */
function debugDealCannonRouting() {
  var email = "";

  try {
    email = Session.getActiveUser().getEmail();
  } catch (err) {
    email = "";
  }

  var serviceUrl = "";

  try {
    serviceUrl = ScriptApp.getService().getUrl();
  } catch (err2) {
    serviceUrl = "";
  }

  var appContext = null;
  var setupState = null;
  var schedulerState = null;

  try {
    appContext = DealCannonCorev2.getAppContext();
  } catch (ctxErr) {
    appContext = {
      success: false,
      error: ctxErr && ctxErr.message ? ctxErr.message : String(ctxErr)
    };
  }

  try {
    setupState = DealCannonCorev2.getSetupState();
  } catch (setupErr) {
    setupState = {
      success: false,
      error: setupErr && setupErr.message ? setupErr.message : String(setupErr)
    };
  }

  try {
    schedulerState = getEmailSchedulerState();
  } catch (schedErr) {
    schedulerState = {
      success: false,
      error: schedErr && schedErr.message ? schedErr.message : String(schedErr)
    };
  }

  var result = {
    success: true,
    starterProjectName: "Deal Cannon Solo 3.0",
    activeUserEmail: email || "",
    starterWebAppUrl: serviceUrl || "",
    appContext: appContext,
    setupState: setupState,
    schedulerState: schedulerState
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

/**
 * Run this manually to confirm the scheduler can see the queue.
 */
function debugSchedulerState() {
  var result;

  try {
    result = getEmailSchedulerState();
  } catch (err) {
    result = {
      success: false,
      error: err && err.message ? err.message : String(err)
    };
  }

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

/**
 * Diagnostic utility for the custom Google Doc LOI templates system.
 */
function debugLoiTemplateSetup() {
  var result;
  try {
    result = DealCannonCorev2.debugLoiTemplateSetup();
  } catch (err) {
    result = {
      success: false,
      error: err && err.message ? err.message : String(err)
    };
  }
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
/* ========================
   CONTRACTS WORKFLOW
   ======================== */

// Contract templates - questions and field mappings
const CONTRACT_TEMPLATES = {
  trec: {
    name: "TREC/Residential Contract",
    questions: ["Buyer name", "Seller name", "Property address", "Purchase price", "Earnest money", "Option period (days)", "Option fee", "Closing date", "Financing type (cash/fha/va/conv)", "Title company", "Who pays closing costs (buyer/seller/split)", "Special provisions", "Additional required fields"],
    fillFields: ["buyerName", "sellerName", "propertyAddress", "purchasePrice", "earnestMoney", "optionPeriod", "optionFee", "closingDate", "financingType", "titleCompany", "closingCosts", "specialProvisions", "additionalFields"]
  },
  cash: {
    name: "Cash Purchase Agreement",
    questions: ["Buyer name", "Seller name", "Property address", "Purchase price", "Earnest money amount", "Closing date", "Financing type (cash)", "Title company", "Who pays closing costs", "Special provisions", "Property condition disclosures"],
    fillFields: ["buyerName", "sellerName", "propertyAddress", "purchasePrice", "earnestMoney", "closingDate", "financingType", "titleCompany", "closingCosts", "specialProvisions", "propertyCondition"]
  },
  seller_finance: {
    name: "Seller Financing Agreement",
    questions: ["Buyer name", "Seller name", "Property address", "Purchase price", "Down payment amount", "Interest rate", "Loan term (years)", "Monthly payment amount", "Balloon payment date (if any)", "Closing date", "Title company", "Who pays closing costs", "Prepayment penalty terms", "Special provisions"],
    fillFields: ["buyerName", "sellerName", "propertyAddress", "purchasePrice", "downPayment", "interestRate", "loanTermYears", "monthlyPayment", "balloonPaymentDate", "closingDate", "titleCompany", "closingCosts", "prepaymentPenalty", "specialProvisions"]
  },
  subto: {
    name: "Subject To Agreement",
    questions: ["Buyer name", "Seller name", "Property address", "Existing mortgage balance", "Interest rate on existing loan", "Monthly payment (if any)", "Closing date", "Title company", "Assumption terms", "Who pays closing costs", "Special provisions", "Occupancy terms"],
    fillFields: ["buyerName", "sellerName", "propertyAddress", "existingMortgageBalance", "interestRate", "monthlyPayment", "closingDate", "titleCompany", "assumptionTerms", "closingCosts", "specialProvisions", "occupancyTerms"]
  },
  lease_option: {
    name: "Lease Option Agreement",
    questions: ["Buyer/Lessee name", "Seller/Lessor name", "Property address", "Option fee amount", "Option period (days/months)", "Monthly rent amount", "Lease term (years)", "Purchase price", "Closing date (if exercising option)", "Title company", "Who pays closing costs", "Maintenance responsibility", "Special provisions", "Option exercise terms"],
    fillFields: ["buyerLesseeName", "sellerLessorName", "propertyAddress", "optionFeeAmount", "optionPeriod", "monthlyRent", "leaseTermYears", "purchasePrice", "closingDate", "titleCompany", "closingCosts", "maintenance responsibility", "specialProvisions", "optionExerciseTerms"]
  }
};

// Show questions for selected contract type
function showContractQuestions(contractType) {
  const template = CONTRACT_TEMPLATES[contractType];
  if (!template) {
    document.getElementById('contract_questions_container').innerHTML = '<p style="color: var(--danger);">Unknown contract type selected.</p>';
    return;
  }

  let html = '<p><strong>' + template.name + '</strong></p>';
  html += '<p>Answer the following questions to complete the contract:</p>';
  html += '<div class="question-list" style="max-height: 400px; overflow-y: auto; padding-right: 12px;">';

  template.questions.forEach((question, index) => {
    html += '<div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">';
    html += '<label style="display: block; font-size: 14px; margin-bottom: 6px; color: var(--text);;">' + question + '</label>';
    html += '<input type="text" class="input-style" style="width: 100%; background-color: var(--input-bg); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; margin-bottom: 4px;" id="contract_question_' + index + '" placeholder="Enter ' + question.toLowerCase() + '">';
    html += '</div>';
  });

  html += '</div>';
  html += '<div style="margin-top: 12px; display: flex; justify-content: flex-end;">';
  html += '<button type="button" class="offer-btn offer-btn-primary" onclick="generateContractFromAnswers(\'' + contractType + '\')">Generate Contract</button>';
  html += '</div>';

  document.getElementById('contract_questions_container').innerHTML = html;
}

// Generate contract from answers
function generateContractFromAnswers(contractType) {
  const template = CONTRACT_TEMPLATES[contractType];
  if (!template) {
    alert('Please select a valid contract type first.');
    return;
  }

  // Collect answers
  const answers = {};
  template.questions.forEach((question, index) => {
    const input = document.getElementById('contract_question_' + index);
    answers[template.fillFields[index]] = input ? input.value.trim() : '';
  });

  // Show loading state
  const questionsContainer = document.getElementById('contract_questions_container');
  questionsContainer.innerHTML = '<p style="color: var(--muted);">Generating contract...</p>';

  // Call the generate function (DealCannonCorev2)
  generate('contract', {
    contractType: contractType,
    answers: answers,
    timestamp: new Date().toISOString()
  });
}

// Start the contract workflow
function startContractWorkflow() {
  const contractType = document.getElementById('contract_type').value;
  if (!contractType) {
    alert('Please select a contract type first.');
    return;
  }
  showContractQuestions(contractType);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  // Contract tab is already in the HTML, just ensure questions container is ready
});

/* ========================
   DOCUSEAL INTEGRATION
   ======================== */

/**
 * Submit contract data to DocuSeal for fillable fields and signature workflow.
 * DocuSeal is a self-hosted document automation platform.
 * 
 * @param {Object} params - Contract parameters
 * @param {string} params.contractType - Type of contract (trec, cash, seller_finance, subto, lease_option)
 * @param {Object} params.answers - Answers to contract questions mapped to fill field names
 * @param {string} params.timestamp - ISO timestamp
 * @returns {Promise<Object>} Result with docuSealId, viewUrl, signUrl, status
 */
async function submitToDocuSeal(params) {
  const { contractType, answers, timestamp } = params;
  
  // In production, this would call your self-hosted DocuSeal API
  // For now, we'll simulate the DocuSeal workflow
  
  // Build the completed contract document
  const contractData = {
    contractType: contractType,
    generatedAt: timestamp,
    ...answers
  };
  
  // TODO: Replace with actual DocuSeal API endpoint
  // const docuSealApiUrl = 'https://docuSeal.yourdomain.com/api/v1/documents';
  
  // Simulated DocuSeal response
  const simulatedResponse = {
    docuSealId: 'ds_' + Date.now(),
    viewUrl: '#',
    signUrl: '#',
    status: 'pending',
    message: 'Contract submitted to DocuSeal for fillable fields and signature workflow'
  };
  
  return simulatedResponse;
}

/* ========================
   CONTRACT GENERATION & SIGNING WORKFLOW
   ======================== */

async function generateContract(type, payload) {
  const contractType = payload.contractType;
  const answers = payload.answers;
  const timestamp = payload.timestamp;
  
  if (!contractType || !answers) {
    alert('Invalid contract generation request.');
    return;
  }
  
  const template = CONTRACT_TEMPLATES[contractType];
  if (!template) {
    alert('Unknown contract type: ' + contractType);
    return;
  }
  
  // Show generating state
  const questionsContainer = document.getElementById('contract_questions_container');
  questionsContainer.innerHTML = '<p style="color: var(--muted);">Generating contract document...</p>';
  
  try {
    // Submit to DocuSeal for fillable fields and signature setup
    const docuSealResult = await submitToDocuSeal({
      contractType: contractType,
      answers: answers,
      timestamp: timestamp
    });
    
    // Build the completed contract HTML
    let contractHtml = '<h2>Completed Contract</h2>';
    contractHtml += '<p><strong>Contract Type:</strong> ' + template.name + '</p>';
    contractHtml += '<p><strong>Generated:</strong> ' + new Date(timestamp).toLocaleString() + '</p>';
    contractHtml += '<hr style="margin: 16px 0;">';
    
    // Add each answer to the contract
    template.fillFields.forEach((field, index) => {
      const value = answers[field] || '';
      if (value) {
        contractHtml += '<p><strong>' + 
          field.replace(/([A-Z])/g, ' $1').replace(/^./, function(match) { return match.toUpperCase(); }) + 
          ':</strong> ' + value + '</p>';
      }
    });
    
    contractHtml += '<hr style="margin: 16px 0;">';
    contractHtml += '<p><em>This contract was generated via Deal Cannon and is ready for review and signing.</em></p>';
    
    // Display the completed contract and DocuSeal links
    questionsContainer.innerHTML = `
      ${contractHtml}
      <hr style="margin: 16px 0;">
      <h3>DocuSeal Signature Workflow</h3>
      <p>Contract submitted to DocuSeal for fillable fields and electronic signatures.</p>
      ${docuSealResult.status === 'pending' ? `
        <button class="offer-btn offer-btn-secondary" 
                onclick="openDocuSealView('${docuSealResult.docuSealId}')">
          View Document in DocuSeal
        </button>
        <button class="offer-btn offer-btn-primary" 
                onclick="openDocuSealSign('${docuSealResult.docuSealId}')">
          Start Electronic Signature
        </button>
      ` : ''}
    `;
    
    // Log the generation
    console.log('Contract generated:', { contractType, fieldCount: Object.keys(answers).length, docuSealId: docuSealResult.docuSealId });
    
  } catch (error) {
    console.error('Contract generation error:', error);
    questionsContainer.innerHTML = '<p style="color: var(--danger);">Error generating contract: ' + (error.message || 'Unknown error') + '</p>';
  }
}

/**
 * Open DocuSeal document view window
 * @param {string} docuSealId - The DocuSeal document ID
 */
function openDocuSealView(docuSealId) {
  // In production, this would open the actual DocuSeal view URL
  // window.open(docuSealViewUrl.replace('{id}', docuSealId), '_blank');
  alert('DocuSeal View: Document ID ' + docuSealId + '\n\n(Opening DocuSeal view in production would redirect to your self-hosted DocuSeal instance.)');
}

/**
 * Open DocuSeal signing window
 * @param {string} docuSealId - The DocuSeal document ID
 */
function openDocuSealSign(docuSealId) {
  // In production, this would open the actual DocuSeal signing URL
  // window.open(docuSealSignUrl.replace('{id}', docuSealId), '_blank');
  alert('DocuSeal Signing: Document ID ' + docuSealId + '\n\n(Opening DocuSeal signing workflow in production would redirect to your self-hosted DocuSeal instance for electronic signatures.)');
}

/* Keep existing generate function wrapper */
EOF
echo "DocuSeal integration appended successfully"
