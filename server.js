import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger.js';
import { handleIncomingMessage } from './utils/flowEngine.js';

dotenv.config();
const app = express();

app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// Basic rate limit (per IP) to protect webhook from abuse
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60
});
app.use('/webhook', limiter);

// Health & meta endpoints
app.get('/', (req, res) => res.send('OK - Restaurant WhatsApp Bot'));
app.get('/healthz', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'verify_token_example';

// Webhook verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    logger.info('Webhook verificado correctamente');
    return res.status(200).send(challenge);
  }
  logger.warn({ mode, token }, 'Fallo la verificacion del webhook');
  res.sendStatus(403);
});

function normalizeIncoming(body) {
  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];
    if (!msg) return null;
    const from = msg.from;

    let input = '';

    if (msg.type === 'text') {
      input = msg.text?.body || '';
    } else if (msg.type === 'interactive') {
      const interactive = msg.interactive;
      if (interactive?.type === 'button_reply') {
        input = interactive.button_reply?.id || interactive.button_reply?.title || '';
      } else if (interactive?.type === 'list_reply') {
        input = interactive.list_reply?.id || interactive.list_reply?.title || '';
      }
    } else if (msg.button) { // legacy
      input = msg.button?.text || msg.button?.payload || '';
    } else if (msg.type === 'button') {
      input = msg.button?.text || '';
    }

    return { from, input };
  } catch (e) {
    logger.error(e, 'normalizeIncoming error');
    return null;
  }
}

// Webhook receiver (POST)
app.post('/webhook', async (req, res) => {
  try {
    const incoming = normalizeIncoming(req.body);
    if (incoming?.from) {
      await handleIncomingMessage(incoming.from, incoming.input);
    }
    res.sendStatus(200);
  } catch (err) {
    logger.error({ err }, 'Webhook error');
    res.sendStatus(500);
  }
});

// Simple manual test endpoint: /test/send?to=593xxxxxxxxx&msg=Hola
import { sendText } from './utils/whatsapp.js';
app.get('/test/send', async (req, res) => {
  if (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID) {
    return res.status(400).json({ error: 'Configura WHATSAPP_TOKEN y PHONE_NUMBER_ID' });
  }
  const to = req.query.to;
  const msg = req.query.msg || 'Hola desde el bot Restaurante Demo';
  if (!to) return res.status(400).json({ error: 'Falta parametro ?to' });
  await sendText(to, msg);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
