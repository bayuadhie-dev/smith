/**
 * Self-Hosted local WhatsApp Gateway Microservice (whatsapp-web.js)
 * Path: /home/superadmin/Documents/SourceCode/scripts/wa_gateway.js
 * Exposes: POST http://localhost:8000/send-message
 */
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

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

// Initialize Client with system Chromium
let isReady = false;
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: path.resolve(__dirname, './.wwebjs_auth')
    }),
    puppeteer: {
        executablePath: '/usr/bin/chromium',
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('\n======================================================================');
    console.log('SCAN THIS QR CODE WITH YOUR WHATSAPP TO LOGIN:');
    console.log('======================================================================\n');
    qrcode.generate(qr, { small: true });
    console.log('\n======================================================================\n');
});

client.on('ready', () => {
    isReady = true;
    console.log('✓ WhatsApp Client is READY and connected!');
});

client.on('disconnected', (reason) => {
    isReady = false;
    console.warn(`! WhatsApp connection closed: ${reason}`);
});

console.log('Starting WhatsApp Client...');
client.initialize();

// REST API endpoint to send message
app.post('/send-message', apiLimiter, async (req, res) => {
    try {
        if (!isReady) {
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
            let cleanNumber = jid.replace(/[^0-9]/g, '');
            if (cleanNumber.startsWith('0')) {
                cleanNumber = '62' + cleanNumber.substring(1);
            }
            
            if (!cleanNumber.endsWith('@c.us')) {
                jid = `${cleanNumber}@c.us`;
            } else {
                jid = cleanNumber;
            }
            console.log(`Sending to Personal JID: ${jid}`);
        }

        const sentMessage = await client.sendMessage(jid, message);
        return res.json({
            success: true,
            message: 'Message sent successfully',
            id: sentMessage.id.id
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
        await client.destroy();
        console.log('WhatsApp client destroyed.');
    } catch (e) {
        console.error('Error during client destroy:', e);
    }
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
