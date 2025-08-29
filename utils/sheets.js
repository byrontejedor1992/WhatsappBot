import { google } from 'googleapis';
import logger from './logger.js';

let sheetsClient;

function getCredentialsFromEnv() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!b64) throw new Error('Env GOOGLE_SERVICE_ACCOUNT (base64) is missing');
  const jsonString = Buffer.from(b64, 'base64').toString('utf-8');
  return JSON.parse(jsonString);
}

export async function getSheets() {
  if (sheetsClient) return sheetsClient;
  const creds = getCredentialsFromEnv();
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const auth = new google.auth.JWT(creds.client_email, null, creds.private_key, scopes);
  await auth.authorize();
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

export async function appendReservationRow({ sheetId, sheetTab, row }) {
  const sheets = await getSheets();
  const range = `${sheetTab}!A:Z`;
  const values = [[
    row.fecha || '',
    row.hora || '',
    row.nombre || '',
    row.personas || '',
    row.telefono || '',
    row.origen || 'WhatsApp',
    row.estado || 'Confirmada',
    row.notas || ''
  ]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values }
  });
  logger.info({ row }, 'Reserva añadida a Google Sheets');
}
