/**************************************
 * Deal Cannon Core - ContactDetailsService
 * Workbook-backed CRM pipeline for Contact Details.
 **************************************/

var CONTACT_DETAILS_SHEET_NAME = 'Contact Details';
var CONTACT_NOTES_SHEET_NAME = 'Contact Notes';
var CONTACT_STAGES_SHEET_NAME = 'Contact Pipeline Stages';

var CONTACT_DETAILS_HEADERS = [
  'opportunityId',
  'createdAt',
  'updatedAt',
  'lastNoteAt',
  'stageId',
  'stageName',
  'primaryContactName',
  'primaryEmail',
  'primaryPhone',
  'opportunityName',
  'value',
  'businessName',
  'source'
];

var CONTACT_NOTES_HEADERS = [
  'noteId',
  'opportunityId',
  'createdAt',
  'createdBy',
  'noteText'
];

var CONTACT_STAGES_HEADERS = [
  'stageId',
  'stageName',
  'sortOrder',
  'createdAt',
  'updatedAt',
  'isActive'
];

var CONTACT_DEFAULT_STAGE_NAMES = [
  'New',
  'Contacted',
  'Follow Up',
  'Offer Sent',
  'Closed'
];

function getContactDetailsState() {
  try {
    var ctx = openCustomerSpreadsheet_();
    var sheets = contactDetailsGetSheetsForRead_(ctx.ss);
    var stages = contactDetailsReadStages_(sheets.stagesSheet);
    var opportunities = contactDetailsReadOpportunities_(sheets.detailsSheet);
    var noteInfoByOpportunityId = contactDetailsReadNoteInfoMapFromSheet_(sheets.notesSheet);
    var stageNameById = {};

    stages.forEach(function(stage) {
      stageNameById[stage.stageId] = stage.stageName;
    });

    opportunities = opportunities.map(function(opportunity) {
      var noteInfo = noteInfoByOpportunityId[opportunity.opportunityId] || { noteCount: 0, lastNoteAt: '' };
      opportunity.stageName = stageNameById[opportunity.stageId] || opportunity.stageName || '';
      opportunity.noteCount = noteInfo.noteCount;
      opportunity.lastNoteAt = noteInfo.lastNoteAt || opportunity.lastNoteAt || '';
      return opportunity;
    });

    return {
      success: true,
      stages: stages,
      opportunities: opportunities,
      workbook: {
        customerSheetId: ctx.user && ctx.user.customerSheetId ? ctx.user.customerSheetId : '',
        customerSheetName: ctx.user && ctx.user.customerSheetName ? ctx.user.customerSheetName : ctx.ss.getName()
      }
    };
  } catch (err) {
    return buildFailure('CONTACT_DETAILS_STATE_ERROR', err.message || String(err));
  }
}

function getContactOpportunityWorkspace(opportunityId) {
  try {
    var cleanOpportunityId = contactDetailsRequireId_(opportunityId, 'Opportunity ID');
    var ctx = openCustomerSpreadsheet_();
    var sheets = contactDetailsGetSheetsForRead_(ctx.ss);
    var stages = contactDetailsReadStages_(sheets.stagesSheet);
    var opportunity = contactDetailsFindOpportunityById_(sheets.detailsSheet, cleanOpportunityId);
    var notes = contactDetailsReadNotesForOpportunity_(sheets.notesSheet, cleanOpportunityId);
    var noteInfo = contactDetailsBuildNoteInfoMap_(notes)[cleanOpportunityId] || { noteCount: 0, lastNoteAt: '' };
    var stageNameById = {};

    stages.forEach(function(stage) {
      stageNameById[stage.stageId] = stage.stageName;
    });

    opportunity.stageName = stageNameById[opportunity.stageId] || opportunity.stageName || '';
    opportunity.noteCount = noteInfo.noteCount;
    opportunity.lastNoteAt = noteInfo.lastNoteAt || opportunity.lastNoteAt || '';

    return {
      success: true,
      opportunity: opportunity,
      notes: notes,
      stages: stages
    };
  } catch (err) {
    return buildFailure('CONTACT_WORKSPACE_ERROR', err.message || String(err));
  }
}

function createContactOpportunity(payload) {
  var lock = LockService.getUserLock();

  if (!lock.tryLock(10000)) {
    return buildFailure('CONTACT_CREATE_LOCKED', 'A Contact Details change is already running. Please wait a few seconds and try again.');
  }

  try {
    payload = payload || {};

    var ctx = openCustomerSpreadsheet_();
    var sheets = contactDetailsEnsureSheets_(ctx.ss);
    var stages = contactDetailsReadStages_(sheets.stagesSheet);
    var primaryStage = stages.length ? stages[0] : contactDetailsSeedDefaultStages_(sheets.stagesSheet)[0];
    var now = contactDetailsFormatTimestamp_(new Date());
    var opportunity = contactDetailsBuildOpportunityRecord_({
      opportunityId: contactDetailsBuildId_('opp'),
      createdAt: now,
      updatedAt: now,
      lastNoteAt: '',
      stageId: primaryStage.stageId,
      stageName: primaryStage.stageName,
      primaryContactName: payload.primaryContactName,
      primaryEmail: payload.primaryEmail,
      primaryPhone: payload.primaryPhone,
      opportunityName: payload.opportunityName,
      value: payload.value,
      businessName: payload.businessName,
      source: payload.source
    });

    contactDetailsAssertValidEmailIfProvided_(opportunity.primaryEmail);

    contactDetailsAppendRow_(sheets.detailsSheet, CONTACT_DETAILS_HEADERS, opportunity);

    return {
      success: true,
      opportunity: opportunity,
      message: 'Opportunity created.'
    };
  } catch (err) {
    return buildFailure('CONTACT_CREATE_ERROR', err.message || String(err));
  } finally {
    lock.releaseLock();
  }
}

function updateContactOpportunity(opportunityId, payload) {
  var lock = LockService.getUserLock();

  if (!lock.tryLock(10000)) {
    return buildFailure('CONTACT_UPDATE_LOCKED', 'A Contact Details change is already running. Please wait a few seconds and try again.');
  }

  try {
    var cleanOpportunityId = contactDetailsRequireId_(opportunityId, 'Opportunity ID');
    payload = payload || {};

    var ctx = openCustomerSpreadsheet_();
    var sheets = contactDetailsEnsureSheets_(ctx.ss);
    var existing = contactDetailsFindOpportunityById_(sheets.detailsSheet, cleanOpportunityId);
    var updated = contactDetailsBuildOpportunityRecord_({
      opportunityId: existing.opportunityId,
      createdAt: existing.createdAt,
      updatedAt: contactDetailsFormatTimestamp_(new Date()),
      lastNoteAt: existing.lastNoteAt,
      stageId: existing.stageId,
      stageName: existing.stageName,
      primaryContactName: payload.primaryContactName !== undefined ? payload.primaryContactName : existing.primaryContactName,
      primaryEmail: payload.primaryEmail !== undefined ? payload.primaryEmail : existing.primaryEmail,
      primaryPhone: payload.primaryPhone !== undefined ? payload.primaryPhone : existing.primaryPhone,
      opportunityName: payload.opportunityName !== undefined ? payload.opportunityName : existing.opportunityName,
      value: payload.value !== undefined ? payload.value : existing.value,
      businessName: payload.businessName !== undefined ? payload.businessName : existing.businessName,
      source: payload.source !== undefined ? payload.source : existing.source
    });

    contactDetailsAssertValidEmailIfProvided_(updated.primaryEmail);

    contactDetailsWriteRow_(sheets.detailsSheet, existing.rowNumber, CONTACT_DETAILS_HEADERS, updated);
    updated.rowNumber = existing.rowNumber;

    return {
      success: true,
      opportunity: updated,
      message: 'Opportunity updated.'
    };
  } catch (err) {
    return buildFailure('CONTACT_UPDATE_ERROR', err.message || String(err));
  } finally {
    lock.releaseLock();
  }
}

function moveContactOpportunityStage(opportunityId, stageId) {
  var lock = LockService.getUserLock();

  if (!lock.tryLock(10000)) {
    return buildFailure('CONTACT_MOVE_LOCKED', 'A Contact Details change is already running. Please wait a few seconds and try again.');
  }

  try {
    var cleanOpportunityId = contactDetailsRequireId_(opportunityId, 'Opportunity ID');
    var cleanStageId = contactDetailsRequireId_(stageId, 'Stage ID');
    var ctx = openCustomerSpreadsheet_();
    var sheets = contactDetailsEnsureSheets_(ctx.ss);
    var opportunity = contactDetailsFindOpportunityById_(sheets.detailsSheet, cleanOpportunityId);
    var stage = contactDetailsFindStageById_(sheets.stagesSheet, cleanStageId);
    var updated = contactDetailsBuildOpportunityRecord_({
      opportunityId: opportunity.opportunityId,
      createdAt: opportunity.createdAt,
      updatedAt: contactDetailsFormatTimestamp_(new Date()),
      lastNoteAt: opportunity.lastNoteAt,
      stageId: stage.stageId,
      stageName: stage.stageName,
      primaryContactName: opportunity.primaryContactName,
      primaryEmail: opportunity.primaryEmail,
      primaryPhone: opportunity.primaryPhone,
      opportunityName: opportunity.opportunityName,
      value: opportunity.value,
      businessName: opportunity.businessName,
      source: opportunity.source
    });

    contactDetailsWriteRow_(sheets.detailsSheet, opportunity.rowNumber, CONTACT_DETAILS_HEADERS, updated);
    updated.rowNumber = opportunity.rowNumber;

    return {
      success: true,
      opportunity: updated,
      message: 'Opportunity moved to ' + stage.stageName + '.'
    };
  } catch (err) {
    return buildFailure('CONTACT_MOVE_ERROR', err.message || String(err));
  } finally {
    lock.releaseLock();
  }
}

function addContactOpportunityNote(opportunityId, noteText) {
  var lock = LockService.getUserLock();

  if (!lock.tryLock(10000)) {
    return buildFailure('CONTACT_NOTE_LOCKED', 'A Contact Details change is already running. Please wait a few seconds and try again.');
  }

  try {
    var cleanOpportunityId = contactDetailsRequireId_(opportunityId, 'Opportunity ID');
    var cleanNoteText = contactDetailsNormalizeMultilineValue_(noteText);

    if (!cleanNoteText) {
      return buildFailure('CONTACT_NOTE_EMPTY', 'Enter a note before saving.');
    }

    var ctx = openCustomerSpreadsheet_();
    var sheets = contactDetailsEnsureSheets_(ctx.ss);
    var opportunity = contactDetailsFindOpportunityById_(sheets.detailsSheet, cleanOpportunityId);
    var now = contactDetailsFormatTimestamp_(new Date());
    var createdBy = '';

    try {
      createdBy = getLoggedInEmail_();
    } catch (ignoreErr) {
      createdBy = '';
    }

    var note = {
      noteId: contactDetailsBuildId_('note'),
      opportunityId: cleanOpportunityId,
      createdAt: now,
      createdBy: createdBy || '',
      noteText: cleanNoteText
    };

    contactDetailsAppendRow_(sheets.notesSheet, CONTACT_NOTES_HEADERS, note);

    opportunity.updatedAt = now;
    opportunity.lastNoteAt = now;
    contactDetailsWriteRow_(sheets.detailsSheet, opportunity.rowNumber, CONTACT_DETAILS_HEADERS, opportunity);

    return {
      success: true,
      note: note,
      message: 'Note added.'
    };
  } catch (err) {
    return buildFailure('CONTACT_NOTE_ERROR', err.message || String(err));
  } finally {
    lock.releaseLock();
  }
}

function createContactPipelineStage(stageName) {
  var lock = LockService.getUserLock();

  if (!lock.tryLock(10000)) {
    return buildFailure('CONTACT_STAGE_CREATE_LOCKED', 'A Contact Details change is already running. Please wait a few seconds and try again.');
  }

  try {
    var ctx = openCustomerSpreadsheet_();
    var sheets = contactDetailsEnsureSheets_(ctx.ss);
    var stages = contactDetailsReadStages_(sheets.stagesSheet);
    var now = contactDetailsFormatTimestamp_(new Date());
    var nextSortOrder = stages.length
      ? Math.max.apply(null, stages.map(function(stage) { return Number(stage.sortOrder || 0); })) + 1
      : 1;
    var stage = {
      stageId: contactDetailsBuildId_('stage'),
      stageName: contactDetailsNormalizeStageName_(stageName, 'New Stage'),
      sortOrder: String(nextSortOrder),
      createdAt: now,
      updatedAt: now,
      isActive: 'TRUE'
    };

    contactDetailsAppendRow_(sheets.stagesSheet, CONTACT_STAGES_HEADERS, stage);

    return {
      success: true,
      stage: contactDetailsBuildStageRecord_(stage),
      message: 'Stage created.'
    };
  } catch (err) {
    return buildFailure('CONTACT_STAGE_CREATE_ERROR', err.message || String(err));
  } finally {
    lock.releaseLock();
  }
}

function renameContactPipelineStage(stageId, stageName) {
  var lock = LockService.getUserLock();

  if (!lock.tryLock(10000)) {
    return buildFailure('CONTACT_STAGE_RENAME_LOCKED', 'A Contact Details change is already running. Please wait a few seconds and try again.');
  }

  try {
    var cleanStageId = contactDetailsRequireId_(stageId, 'Stage ID');
    var cleanStageName = contactDetailsNormalizeStageName_(stageName);

    var ctx = openCustomerSpreadsheet_();
    var sheets = contactDetailsEnsureSheets_(ctx.ss);
    var stage = contactDetailsFindStageById_(sheets.stagesSheet, cleanStageId);
    var now = contactDetailsFormatTimestamp_(new Date());

    stage.stageName = cleanStageName;
    stage.updatedAt = now;
    contactDetailsWriteRow_(sheets.stagesSheet, stage.rowNumber, CONTACT_STAGES_HEADERS, stage);

    return {
      success: true,
      stage: contactDetailsBuildStageRecord_(stage),
      message: 'Stage renamed.'
    };
  } catch (err) {
    return buildFailure('CONTACT_STAGE_RENAME_ERROR', err.message || String(err));
  } finally {
    lock.releaseLock();
  }
}

function reorderContactPipelineStages(stageIds) {
  var lock = LockService.getUserLock();

  if (!lock.tryLock(10000)) {
    return buildFailure('CONTACT_STAGE_REORDER_LOCKED', 'A Contact Details change is already running. Please wait a few seconds and try again.');
  }

  try {
    var orderedIds = contactDetailsNormalizeStageIdList_(stageIds);
    var ctx = openCustomerSpreadsheet_();
    var sheets = contactDetailsEnsureSheets_(ctx.ss);
    var stages = contactDetailsReadStages_(sheets.stagesSheet);
    var stagesById = {};
    var seen = {};
    var now = contactDetailsFormatTimestamp_(new Date());
    var orderedStages = [];

    stages.forEach(function(stage) {
      stagesById[stage.stageId] = stage;
    });

    if (orderedIds.length !== stages.length) {
      throw new Error('Stage reorder request is out of date. Refresh Contact Details and try again.');
    }

    orderedIds.forEach(function(stageId, index) {
      var stage = stagesById[stageId];

      if (!stage) {
        throw new Error('Stage reorder request included an unknown stage. Refresh Contact Details and try again.');
      }

      if (seen[stageId]) {
        throw new Error('Stage reorder request included a duplicate stage. Refresh Contact Details and try again.');
      }

      seen[stageId] = true;
      stage.sortOrder = String(index + 1);
      stage.updatedAt = now;
      contactDetailsWriteRow_(sheets.stagesSheet, stage.rowNumber, CONTACT_STAGES_HEADERS, stage);
      orderedStages.push(contactDetailsBuildStageRecord_(stage));
    });

    return {
      success: true,
      stages: orderedStages,
      message: 'Stage order updated.'
    };
  } catch (err) {
    return buildFailure('CONTACT_STAGE_REORDER_ERROR', err.message || String(err));
  } finally {
    lock.releaseLock();
  }
}

function contactDetailsEnsureSheets_(ss) {
  var detailsSheet = contactDetailsEnsureSheet_(ss, CONTACT_DETAILS_SHEET_NAME, CONTACT_DETAILS_HEADERS);
  var notesSheet = contactDetailsEnsureSheet_(ss, CONTACT_NOTES_SHEET_NAME, CONTACT_NOTES_HEADERS);
  var stagesSheet = contactDetailsEnsureSheet_(ss, CONTACT_STAGES_SHEET_NAME, CONTACT_STAGES_HEADERS);

  if (stagesSheet.getLastRow() <= 1) {
    contactDetailsSeedDefaultStages_(stagesSheet);
  }

  return {
    detailsSheet: detailsSheet,
    notesSheet: notesSheet,
    stagesSheet: stagesSheet
  };
}

function contactDetailsGetSheetsForRead_(ss) {
  var detailsSheet = ss.getSheetByName(CONTACT_DETAILS_SHEET_NAME);
  var notesSheet = ss.getSheetByName(CONTACT_NOTES_SHEET_NAME);
  var stagesSheet = ss.getSheetByName(CONTACT_STAGES_SHEET_NAME);

  if (!detailsSheet || !notesSheet || !stagesSheet || stagesSheet.getLastRow() <= 1) {
    return contactDetailsEnsureSheets_(ss);
  }

  return {
    detailsSheet: detailsSheet,
    notesSheet: notesSheet,
    stagesSheet: stagesSheet
  };
}

function contactDetailsEnsureSheet_(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  contactDetailsEnsureHeaders_(sheet, headers);
  sheet.setFrozenRows(1);
  return sheet;
}

function contactDetailsEnsureHeaders_(sheet, headers) {
  headers = headers || [];
  var existing = [];
  var lastColumn = Math.max(sheet.getLastColumn(), 0);

  if (lastColumn > 0) {
    existing = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(value) {
      return String(value || '').trim();
    });
  }

  if (!existing.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  var changed = false;

  headers.forEach(function(header) {
    if (existing.indexOf(header) === -1) {
      existing.push(header);
      changed = true;
    }
  });

  if (changed) {
    sheet.getRange(1, 1, 1, existing.length).setValues([existing]);
  }
}

function contactDetailsSeedDefaultStages_(sheet) {
  var now = contactDetailsFormatTimestamp_(new Date());
  var rows = CONTACT_DEFAULT_STAGE_NAMES.map(function(stageName, index) {
    return [
      contactDetailsBuildId_('stage'),
      stageName,
      String(index + 1),
      now,
      now,
      'TRUE'
    ];
  });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  return contactDetailsReadStages_(sheet);
}

function contactDetailsReadRecords_(sheet, headers) {
  if (!sheet || sheet.getLastRow() <= 1) {
    return [];
  }

  headers = headers || [];
  var existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0].map(function(value) {
    return String(value || '').trim();
  });
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), headers.length)).getValues();
  var headerIndexes = {};

  existingHeaders.forEach(function(header, index) {
    if (header && headerIndexes[header] === undefined) {
      headerIndexes[header] = index;
    }
  });

  return values.map(function(rowValues, index) {
    var record = {
      rowNumber: index + 2
    };

    headers.forEach(function(header) {
      var headerIndex = headerIndexes[header];
      record[header] = headerIndex !== undefined ? String(rowValues[headerIndex] || '') : '';
    });

    return record;
  }).filter(function(record) {
    return contactDetailsHasPrimaryId_(record);
  });
}

function contactDetailsHasPrimaryId_(record) {
  if (!record) {
    return false;
  }

  if (record.opportunityId !== undefined) {
    return !!String(record.opportunityId || '').trim();
  }

  if (record.noteId !== undefined) {
    return !!String(record.noteId || '').trim();
  }

  if (record.stageId !== undefined) {
    return !!String(record.stageId || '').trim();
  }

  return false;
}

function contactDetailsReadOpportunities_(sheet) {
  return contactDetailsReadRecords_(sheet, CONTACT_DETAILS_HEADERS).map(function(record) {
    return contactDetailsBuildOpportunityRecord_(record, record.rowNumber);
  }).sort(function(a, b) {
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
}

function contactDetailsReadNotes_(sheet) {
  return contactDetailsReadRecords_(sheet, CONTACT_NOTES_HEADERS).map(function(record) {
    return contactDetailsBuildNoteRecord_(record, record.rowNumber);
  }).sort(function(a, b) {
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}

function contactDetailsReadNotesForOpportunity_(sheet, opportunityId) {
  var cleanOpportunityId = String(opportunityId || '').trim();

  if (!sheet || sheet.getLastRow() <= 1 || !cleanOpportunityId) {
    return [];
  }

  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), CONTACT_NOTES_HEADERS.length)).getValues()[0].map(function(value) {
    return String(value || '').trim();
  });
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), CONTACT_NOTES_HEADERS.length)).getValues();
  var headerIndexes = {};
  var notes = [];

  headers.forEach(function(header, index) {
    if (header && headerIndexes[header] === undefined) {
      headerIndexes[header] = index;
    }
  });

  var opportunityIdIndex = headerIndexes.opportunityId;
  if (opportunityIdIndex === undefined) {
    return notes;
  }

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][opportunityIdIndex] || '').trim() !== cleanOpportunityId) {
      continue;
    }

    var record = { rowNumber: i + 2 };

    CONTACT_NOTES_HEADERS.forEach(function(header) {
      var headerIndex = headerIndexes[header];
      record[header] = headerIndex !== undefined ? String(values[i][headerIndex] || '') : '';
    });

    if (contactDetailsHasPrimaryId_(record)) {
      notes.push(contactDetailsBuildNoteRecord_(record, record.rowNumber));
    }
  }

  notes.sort(function(a, b) {
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });

  return notes;
}

function contactDetailsReadNoteInfoMapFromSheet_(sheet) {
  if (!sheet || sheet.getLastRow() <= 1) {
    return {};
  }

  var lastColumn = Math.max(sheet.getLastColumn(), CONTACT_NOTES_HEADERS.length);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) {
    return String(value || '').trim();
  });
  var opportunityIdIndex = headers.indexOf('opportunityId');
  var createdAtIndex = headers.indexOf('createdAt');
  var rowCount = sheet.getLastRow() - 1;
  var map = {};
  var opportunityIds;
  var createdAts;
  var i;
  var opportunityId;
  var createdAt;

  if (opportunityIdIndex === -1) {
    return map;
  }

  opportunityIds = sheet.getRange(2, opportunityIdIndex + 1, rowCount, 1).getValues();
  createdAts = createdAtIndex === -1
    ? []
    : sheet.getRange(2, createdAtIndex + 1, rowCount, 1).getValues();

  for (i = 0; i < rowCount; i++) {
    opportunityId = String(opportunityIds[i] && opportunityIds[i][0] || '').trim();
    createdAt = String(createdAts[i] && createdAts[i][0] || '').trim();

    if (!opportunityId) {
      continue;
    }

    if (!map[opportunityId]) {
      map[opportunityId] = {
        noteCount: 0,
        lastNoteAt: ''
      };
    }

    map[opportunityId].noteCount++;

    if (createdAt && (!map[opportunityId].lastNoteAt || createdAt > map[opportunityId].lastNoteAt)) {
      map[opportunityId].lastNoteAt = createdAt;
    }
  }

  return map;
}

function contactDetailsReadStages_(sheet) {
  return contactDetailsReadRecords_(sheet, CONTACT_STAGES_HEADERS).map(function(record) {
    return contactDetailsBuildStageRecord_(record, record.rowNumber);
  }).filter(function(stage) {
    return String(stage.isActive || '').toUpperCase() !== 'FALSE';
  }).sort(function(a, b) {
    var aOrder = Number(a.sortOrder || 0);
    var bOrder = Number(b.sortOrder || 0);
    return aOrder - bOrder;
  });
}

function contactDetailsBuildOpportunityRecord_(record, rowNumber) {
  record = record || {};
  var email = contactDetailsNormalizeSingleLineValue_(record.primaryEmail).toLowerCase();

  return {
    rowNumber: Number(rowNumber || record.rowNumber || 0),
    opportunityId: contactDetailsRequireId_(record.opportunityId, 'Opportunity ID'),
    createdAt: contactDetailsNormalizeSingleLineValue_(record.createdAt),
    updatedAt: contactDetailsNormalizeSingleLineValue_(record.updatedAt),
    lastNoteAt: contactDetailsNormalizeSingleLineValue_(record.lastNoteAt),
    stageId: contactDetailsRequireId_(record.stageId, 'Stage ID'),
    stageName: contactDetailsNormalizeStageName_(record.stageName, 'New'),
    primaryContactName: contactDetailsNormalizeSingleLineValue_(record.primaryContactName),
    primaryEmail: email,
    primaryPhone: contactDetailsNormalizeSingleLineValue_(record.primaryPhone),
    opportunityName: contactDetailsNormalizeSingleLineValue_(record.opportunityName),
    value: contactDetailsNormalizeSingleLineValue_(record.value),
    businessName: contactDetailsNormalizeSingleLineValue_(record.businessName),
    source: contactDetailsNormalizeSingleLineValue_(record.source)
  };
}

function contactDetailsAssertValidEmailIfProvided_(email) {
  var cleanEmail = contactDetailsNormalizeSingleLineValue_(email).toLowerCase();

  if (!cleanEmail) {
    return;
  }

  if (typeof isValidEmail_ === 'function' && !isValidEmail_(cleanEmail)) {
    throw new Error('Primary email is invalid.');
  }
}

function contactDetailsBuildNoteRecord_(record, rowNumber) {
  record = record || {};

  return {
    rowNumber: Number(rowNumber || record.rowNumber || 0),
    noteId: contactDetailsRequireId_(record.noteId, 'Note ID'),
    opportunityId: contactDetailsRequireId_(record.opportunityId, 'Opportunity ID'),
    createdAt: contactDetailsNormalizeSingleLineValue_(record.createdAt),
    createdBy: contactDetailsNormalizeSingleLineValue_(record.createdBy),
    noteText: contactDetailsNormalizeMultilineValue_(record.noteText)
  };
}

function contactDetailsBuildStageRecord_(record, rowNumber) {
  record = record || {};

  return {
    rowNumber: Number(rowNumber || record.rowNumber || 0),
    stageId: contactDetailsRequireId_(record.stageId, 'Stage ID'),
    stageName: contactDetailsNormalizeStageName_(record.stageName, 'Stage'),
    sortOrder: String(record.sortOrder || '0'),
    createdAt: contactDetailsNormalizeSingleLineValue_(record.createdAt),
    updatedAt: contactDetailsNormalizeSingleLineValue_(record.updatedAt),
    isActive: contactDetailsNormalizeSingleLineValue_(record.isActive || 'TRUE')
  };
}

function contactDetailsBuildNoteInfoMap_(notes) {
  var map = {};

  (notes || []).forEach(function(note) {
    var opportunityId = note.opportunityId;

    if (!map[opportunityId]) {
      map[opportunityId] = {
        noteCount: 0,
        lastNoteAt: ''
      };
    }

    map[opportunityId].noteCount++;

    if (!map[opportunityId].lastNoteAt || String(note.createdAt || '') > String(map[opportunityId].lastNoteAt || '')) {
      map[opportunityId].lastNoteAt = note.createdAt;
    }
  });

  return map;
}

function contactDetailsFindOpportunityById_(sheet, opportunityId) {
  var cleanOpportunityId = contactDetailsRequireId_(opportunityId, 'Opportunity ID');
  var opportunities = contactDetailsReadOpportunities_(sheet);

  for (var i = 0; i < opportunities.length; i++) {
    if (opportunities[i].opportunityId === cleanOpportunityId) {
      return opportunities[i];
    }
  }

  throw new Error('Opportunity not found. Refresh Contact Details and try again.');
}

function contactDetailsFindStageById_(sheet, stageId) {
  var cleanStageId = contactDetailsRequireId_(stageId, 'Stage ID');
  var stages = contactDetailsReadStages_(sheet);

  for (var i = 0; i < stages.length; i++) {
    if (stages[i].stageId === cleanStageId) {
      return stages[i];
    }
  }

  throw new Error('Stage not found. Refresh Contact Details and try again.');
}

function contactDetailsAppendRow_(sheet, headers, record) {
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([
    contactDetailsBuildRowValues_(headers, record)
  ]);
}

function contactDetailsWriteRow_(sheet, rowNumber, headers, record) {
  rowNumber = Number(rowNumber || 0);

  if (rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    throw new Error('The target row could not be found. Refresh Contact Details and try again.');
  }

  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([
    contactDetailsBuildRowValues_(headers, record)
  ]);
}

function contactDetailsBuildRowValues_(headers, record) {
  record = record || {};

  return headers.map(function(header) {
    return String(record[header] || '');
  });
}

function contactDetailsBuildId_(prefix) {
  return String(prefix || 'item') + '_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
}

function contactDetailsFormatTimestamp_(date) {
  if (typeof formatDateTime_ === 'function') {
    return formatDateTime_(date || new Date());
  }

  return Utilities.formatDate(date || new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function contactDetailsNormalizeSingleLineValue_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .substring(0, 49000);
}

function contactDetailsNormalizeMultilineValue_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .substring(0, 49000);
}

function contactDetailsNormalizeStageName_(value, fallback) {
  var clean = contactDetailsNormalizeSingleLineValue_(value);

  if (!clean) {
    clean = String(fallback || '').trim();
  }

  if (!clean) {
    throw new Error('Stage name is required.');
  }

  return clean.substring(0, 120);
}

function contactDetailsNormalizeStageIdList_(stageIds) {
  if (!Array.isArray(stageIds) || !stageIds.length) {
    throw new Error('Stage order is required.');
  }

  return stageIds.map(function(stageId) {
    return contactDetailsRequireId_(stageId, 'Stage ID');
  });
}

function contactDetailsRequireId_(value, label) {
  var clean = contactDetailsNormalizeSingleLineValue_(value);

  if (!clean) {
    throw new Error((label || 'ID') + ' is required.');
  }

  return clean;
}
