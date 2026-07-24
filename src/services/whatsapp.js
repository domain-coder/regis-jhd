const fs = require('fs');
const { EventEmitter } = require('events');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const env = require('../config/env');

const logger = pino({ level: 'warn' });
const emitter = new EventEmitter();

let sock = null;
let readyPromise = null;

function connect() {
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    fs.mkdirSync(env.wa.authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(env.wa.authDir);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false });
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        const jid = msg.key.remoteJid || '';
        if (!jid.endsWith('@s.whatsapp.net')) continue; // abaikan grup/broadcast
        const noHp = jid.split('@')[0];
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          '';
        if (text) emitter.emit('pesanMasuk', { noHp, text });
      }
    });

    return new Promise((resolve) => {
      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
          console.log('[WA] Terhubung ke WhatsApp.');
          resolve();
        }

        if (connection === 'close') {
          const statusCode = new Boom(lastDisconnect?.error).output?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;
          console.log(`[WA] Koneksi terputus (kode ${statusCode}).`);
          if (!loggedOut) {
            console.log('[WA] Mencoba sambung ulang...');
            readyPromise = null;
            connect();
          } else {
            console.log(
              '[WA] Sesi logout dari HP. Hapus folder data/wa-auth/ lalu restart untuk pairing ulang.'
            );
          }
        }
      });

      if (!state.creds.registered && env.wa.phoneNumber) {
        setTimeout(async () => {
          try {
            const code = await sock.requestPairingCode(env.wa.phoneNumber);
            console.log('==============================================');
            console.log(`KODE PAIRING WHATSAPP: ${code}`);
            console.log(`Buka WhatsApp di HP nomor ${env.wa.phoneNumber}`);
            console.log('-> Pengaturan -> Perangkat Tertaut -> Tautkan dengan nomor telepon');
            console.log('Masukkan kode di atas (berlaku beberapa menit saja).');
            console.log('==============================================');
          } catch (err) {
            console.error('[WA] Gagal minta kode pairing:', err.message);
          }
        }, 3000);
      }
    });
  })();

  return readyPromise;
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

async function sendQr(noHp, caption, qrImageBase64) {
  await withTimeout(connect(), 30000, 'WhatsApp belum terhubung (timeout 30 detik).');
  const jid = `${noHp}@s.whatsapp.net`;
  const base64Data = qrImageBase64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  await sock.sendMessage(jid, { image: buffer, caption });
}

async function kirimTeks(noHp, teks) {
  await withTimeout(connect(), 30000, 'WhatsApp belum terhubung (timeout 30 detik).');
  const jid = `${noHp}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text: teks });
}

module.exports = { connect, sendQr, kirimTeks, on: emitter.on.bind(emitter) };
