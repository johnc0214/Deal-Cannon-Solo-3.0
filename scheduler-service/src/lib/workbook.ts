import { google } from 'googleapis';

const READY_SHEET_NAME = 'Ready to Email';
const EMAIL_SENT_SHEET_NAME = 'Email Sent';
const LEAD_COLUMN_COUNT = 6;
const LEAD_ID_INDEX = 5;
const STATUS_INDEX = 4;

export type WorkbookLeadRow = {
  rowNumber: number;
  values: string[];
};

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

function normalizeLeadRow(row: unknown[]) {
  const copy = Array.isArray(row) ? row.slice(0, LEAD_COLUMN_COUNT) : [];

  while (copy.length < LEAD_COLUMN_COUNT) {
    copy.push('');
  }

  return copy.map((value) => String(value ?? '').trim());
}

async function readLeadRows(spreadsheetId: string, sheetName: string) {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:F`,
  });

  const rows = response.data.values || [];
  return rows.map((row) => normalizeLeadRow(row));
}

async function appendLeadRow(spreadsheetId: string, sheetName: string, row: string[]) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:F`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [row],
    },
  });
}

async function deleteSheetRow(spreadsheetId: string, sheetId: number, zeroBasedRowIndex: number) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: zeroBasedRowIndex,
              endIndex: zeroBasedRowIndex + 1,
            },
          },
        },
      ],
    },
  });
}

async function updateStatusCell(spreadsheetId: string, sheetName: string, rowNumber: number, status: string) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!E${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[status]],
    },
  });
}

async function getSpreadsheetSheetIdByName(spreadsheetId: string, sheetName: string) {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  });

  const matchingSheet = (response.data.sheets || []).find((sheet) => String(sheet.properties?.title || '') === sheetName);

  if (!matchingSheet || matchingSheet.properties?.sheetId === undefined) {
    throw new Error(`Workbook sheet ${sheetName} was not found.`);
  }

  return Number(matchingSheet.properties.sheetId);
}

export async function moveLeadToEmailSent(spreadsheetId: string, leadId: string, fallbackRowNumber: number | null, sentRow: string[]) {
  const readyRows = await readLeadRows(spreadsheetId, READY_SHEET_NAME);
  let readyRowNumber = 0;

  for (let index = 1; index < readyRows.length; index += 1) {
    const row = readyRows[index];
    if (String(row[LEAD_ID_INDEX] || '').trim() === String(leadId || '').trim()) {
      readyRowNumber = index + 1;
      break;
    }
  }

  if (!readyRowNumber && fallbackRowNumber && fallbackRowNumber >= 2 && fallbackRowNumber <= readyRows.length) {
    readyRowNumber = fallbackRowNumber;
  }

  if (!readyRowNumber) {
    throw new Error(`Ready to Email lead ${leadId} was not found during workbook sync.`);
  }

  await appendLeadRow(spreadsheetId, EMAIL_SENT_SHEET_NAME, normalizeLeadRow(sentRow));
  const readySheetId = await getSpreadsheetSheetIdByName(spreadsheetId, READY_SHEET_NAME);
  await deleteSheetRow(spreadsheetId, readySheetId, readyRowNumber - 1);
}

export async function markLeadFailedInWorkbook(spreadsheetId: string, leadId: string, fallbackRowNumber: number | null) {
  const readyRows = await readLeadRows(spreadsheetId, READY_SHEET_NAME);
  let readyRowNumber = 0;

  for (let index = 1; index < readyRows.length; index += 1) {
    const row = readyRows[index];
    if (String(row[LEAD_ID_INDEX] || '').trim() === String(leadId || '').trim()) {
      readyRowNumber = index + 1;
      break;
    }
  }

  if (!readyRowNumber && fallbackRowNumber && fallbackRowNumber >= 2 && fallbackRowNumber <= readyRows.length) {
    readyRowNumber = fallbackRowNumber;
  }

  if (!readyRowNumber) {
    return;
  }

  await updateStatusCell(spreadsheetId, READY_SHEET_NAME, readyRowNumber, 'FAILED');
}
