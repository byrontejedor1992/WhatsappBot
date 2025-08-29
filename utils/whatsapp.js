import axios from 'axios';
import logger from './logger.js';
import dotenv from 'dotenv';
dotenv.config();

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

async function callGraphAPI(payload, attempt = 1) {
  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
  try {
    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  } catch (err) {
    const retriable = [408, 429, 500, 502, 503, 504];
    const status = err?.response?.status;
    logger.error({ status, data: err?.response?.data }, 'Graph API error');
    if (retriable.includes(status) && attempt < 3) {
      const delay = 500 * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
      return callGraphAPI(payload, attempt + 1);
    }
    throw err;
  }
}

export async function sendText(to, text) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text }
  };
  await callGraphAPI(payload);
}

export async function sendMenuButtons(to) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: '¿Qué te gustaría hacer?' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: '1', title: 'Reservar mesa' } },
          { type: 'reply', reply: { id: '2', title: 'Ver menú' } },
          { type: 'reply', reply: { id: '3', title: 'Promociones' } },
          { type: 'reply', reply: { id: '4', title: 'Ubicación' } }
        ]
      }
    }
  };
  await callGraphAPI(payload);
}
