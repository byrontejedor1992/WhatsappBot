import fs from 'fs';
import { sendText, sendMenuButtons } from './whatsapp.js';
import { appendReservationRow } from './sheets.js';
import { getSession, setSession, clearSession } from './sessionStore.js';
import logger from './logger.js';

const flow = JSON.parse(fs.readFileSync('flow_restaurant.json', 'utf-8'));

function replaceVars(text, ctx) {
  if (!text) return '';
  return text.replace('{name}', ctx.name||'')
             .replace('{people}', ctx.people||'')
             .replace('{date}', ctx.date||'')
             .replace('{time}', ctx.time||'');
}

function classify(input, expect, ctx) {
  const t = (input || '').trim().toLowerCase();
  if (expect === 'choice_1_4') {
    if (['1','2','3','4'].includes(t)) return t;
    return 'invalid';
  }
  if (expect === 'keyword') {
    if (['reservar','volver','menú','menu','fin'].includes(t)) return t;
    return '*';
  }
  if (expect === 'number_1_10') {
    const n = parseInt(t, 10);
    if (!isNaN(n) && n >= 1 && n <= 10) { ctx.people = String(n); return 'valid'; }
    return 'invalid';
  }
  if (expect === 'date_iso') {
    const m = t.match(/^\d{4}-\d{2}-\d{2}$/);
    if (m) { ctx.date = t; return 'valid'; }
    return 'invalid';
  }
  if (expect === 'choice_time') {
    if (['13:00','15:00','19:00','21:00'].includes(t)) { ctx.time = t; return t; }
    return 'invalid';
  }
  if (expect === 'text') {
    if (t.length >= 2) { ctx.name = input.trim(); return 'valid'; }
    return 'invalid';
  }
  if (expect === 'yes_no') {
    if (t === 'sí' || t === 'si') return 'sí';
    if (t === 'no') return 'no';
    return 'invalid';
  }
  return 'invalid';
}

async function saveReservation(ctx, from) {
  const sheetId = process.env.SHEET_ID;
  const sheetTab = process.env.SHEET_TAB || 'Reservas';
  if (!sheetId) {
    logger.warn('SHEET_ID missing, reservation not saved');
    return;
  }
  await appendReservationRow({
    sheetId,
    sheetTab,
    row: {
      fecha: ctx.date,
      hora: ctx.time,
      nombre: ctx.name,
      personas: ctx.people,
      telefono: from,
      estado: 'Confirmada',
      notas: ''
    }
  });
}

export async function handleIncomingMessage(from, inputTextOrButtonId) {
  logger.info(`Mensaje entrante de: ${from}. Input: ${inputTextOrButtonId}`);
  let session = getSession(from);
  if (!session) {
    session = { state: flow.start_state, ctx: {} };
    setSession(from, session);
    const msg = flow.states[flow.start_state].message;
    await sendText(from, msg);
    await sendMenuButtons(from);
    return;
  }

  const node = flow.states[session.state] || flow.states[flow.start_state];

  const cls = classify(inputTextOrButtonId, node.expect, session.ctx);
  const nextState = node.transitions[cls] || node.transitions['*'] || node.transitions['invalid'] || session.state;
  session.state = nextState;
  setSession(from, session);

  const nextNode = flow.states[nextState];
  if (!nextNode) {
    session.state = flow.start_state;
    setSession(from, session);
    await sendText(from, flow.states[flow.start_state].message);
    await sendMenuButtons(from);
    return;
  }

  if (nextState === 'confirmed') {
    await saveReservation(session.ctx, from);
  }

  const message = replaceVars(nextNode.message, session.ctx);
  await sendText(from, message);

  if (nextState === 'welcome') {
    await sendMenuButtons(from);
  }
}
