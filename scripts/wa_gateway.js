/**
 * Self-Hosted local WhatsApp Gateway Microservice (Baileys)
 * Path: /home/superadmin/Documents/SourceCode/scripts/wa_gateway.js
 * Exposes: POST http://localhost:8000/send-message
 */
// Filter ALL output streams to strip any accidental session/key dumps from libraries
const SENSITIVE_PATTERN = /privKey|rootKey|chainKey|SessionEntry|registrationId|ephemeralKeyPair|preKeyId|baseKey|remoteIdentityKey/i;

const wrapLogFn = (original) => (...args) => {
    const str = args.map(a => {
        try {
            return typeof a === 'string' ? a : JSON.stringify(a);
        } catch (e) {
            return '';
        }
    }).join(' ');
    if (SENSITIVE_PATTERN.test(str)) return;
    original(...args);
};

console.log = wrapLogFn(console.log.bind(console));
console.error = wrapLogFn(console.error.bind(console));
console.warn = wrapLogFn(console.warn.bind(console));
console.info = wrapLogFn(console.info.bind(console));

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...rest) => {
    const str = chunk.toString();
    if (SENSITIVE_PATTERN.test(str)) return true;
    return originalStdoutWrite(chunk, ...rest);
};
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const express = require('express');
const rateLimit = require('express-rate-limit');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = 8000;

// Security Configurations
const SECRET_TOKEN = process.env.WA_SECRET_TOKEN;
if (!SECRET_TOKEN) {
    console.error('✗ ERROR: WA_SECRET_TOKEN is not defined in your .env file!');
    process.exit(1);
}

app.use(express.json());

// 1. IP Security Middleware: Strict localhost whitelist
app.use((req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    const allowedIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    if (!allowedIps.includes(clientIp)) {
        console.warn(`[Blocked] Unauthorized access attempt from remote IP: ${clientIp}`);
        return res.status(403).json({ success: false, message: 'Forbidden: Access restricted to localhost' });
    }
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== SECRET_TOKEN) {
        console.warn(`[Blocked] Invalid or missing API key from IP: ${clientIp}`);
        return res.status(401).json({ success: false, message: 'Unauthorized: Invalid API key' });
    }
    next();
});

// 2. Rate Limiter Middleware
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many requests. Rate limit is 10 messages per minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

let sock = null;
let isReady = false;

async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./.baileys_auth');

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'fatal' }),
        printQRInTerminal: false // kita handle manual biar konsisten sama style lama
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n======================================================================');
            console.log('SCAN THIS QR CODE WITH YOUR WHATSAPP TO LOGIN:');
            console.log('======================================================================\n');
            qrcode.generate(qr, { small: true });
            console.log('\n======================================================================\n');
        }

        if (connection === 'close') {
            isReady = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.warn(`! WhatsApp connection closed. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) {
                startWhatsApp();
            } else {
                console.error('✗ Logged out. Delete .baileys_auth folder and restart to re-scan QR.');
            }
        } else if (connection === 'open') {
            isReady = true;
            console.log('✓ WhatsApp Client is READY and connected!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', () => {
        // placeholder kalau nanti mau handle pesan masuk
    });
    
    sock.ev.on('messages.update', (updates) => {
        for (const { key, update } of updates) {
            if (update.status !== undefined) {
                // 0=ERROR, 1=PENDING, 2=SERVER_ACK, 3=DELIVERY_ACK, 4=READ, 5=PLAYED
                const statusLabels = { 0: 'ERROR', 1: 'PENDING', 2: 'SERVER_ACK', 3: 'DELIVERED', 4: 'READ', 5: 'PLAYED' };
                console.log(`[STATUS UPDATE] ${key.id} → ${statusLabels[update.status] || update.status}`);
            }
        }
    });
}

console.log('Starting WhatsApp Client...');
startWhatsApp();

// REST API endpoint to send message
app.post('/send-message', apiLimiter, async (req, res) => {
    try {
        if (!isReady || !sock) {
            return res.status(503).json({ success: false, message: 'WhatsApp client is not ready yet' });
        }

        const { to, message } = req.body;
        if (!to || !message) {
            return res.status(400).json({ success: false, message: 'Missing fields: to and message are required' });
        }

        let jid = to.trim();

        // 1. If it's already a group JID, send directly
        if (jid.endsWith('@g.us')) {
            console.log(`Sending to Group JID: ${jid}`);
        }
        // 2. Otherwise format as personal JID
        else {
            // Remove non-digit characters
            let cleanNumber = jid.replace(/[^0-9]/g, '');
            
            // Convert Indonesian local format (08xxx) to international (628xxx)
            if (cleanNumber.startsWith('0')) {
                cleanNumber = '62' + cleanNumber.substring(1);
            }
            
            try {
                // Query server for the correct JID (handles new privacy JIDs / @lid formats)
                const [result] = await sock.onWhatsApp(cleanNumber);
                if (result && result.exists) {
                    jid = result.jid;
                    console.log(`Resolved JID via onWhatsApp: ${jid}`);
                } else {
                    jid = `${cleanNumber}@s.whatsapp.net`;
                    console.log(`onWhatsApp returned no result, using fallback: ${jid}`);
                }
            } catch (e) {
                jid = `${cleanNumber}@s.whatsapp.net`;
                console.log(`Error resolving JID via onWhatsApp, using fallback: ${jid}`);
            }
        }

        const sent = await sock.sendMessage(jid, { text: message });
        return res.json({
            success: true,
            message: 'Message sent successfully',
            id: sent.key.id
        });
    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

// Start Express Server
const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`✓ WA Gateway API running locally on http://127.0.0.1:${PORT}`);
});

// Graceful Shutdown Handler
const shutdown = async () => {
    console.log('\nGracefully shutting down WA Gateway...');
    server.close();
    try {
        if (sock) {
            console.log('Closing WhatsApp socket...');
            sock.end(undefined);
        }
    } catch (e) {
        console.error('Error during socket close:', e);
    }
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
