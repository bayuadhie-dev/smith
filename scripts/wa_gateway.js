/**
 * Self-Hosted local WhatsApp Gateway Microservice
 * Path: /home/superadmin/Documents/SourceCode/scripts/wa_gateway.js
 * Exposes: POST http://localhost:8000/send-message
 */
// Load environment variables from backend/.env
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = 8000;

// Security Configurations
const SECRET_TOKEN = process.env.WA_SECRET_TOKEN || 'local-wa-secret-token';
if (!process.env.WA_SECRET_TOKEN) {
    console.warn('⚠️  WARNING: WA_SECRET_TOKEN is not defined in your .env file. Using default fallback token.');
}

app.use(express.json());

// 1. IP Security Middleware: Strict localhost whitelist
app.use((req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    
    // Whitelist only loopback addresses
    const allowedIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    const isLocal = allowedIps.includes(clientIp);
                    
    if (!isLocal) {
        console.warn(`[Blocked] Unauthorized access attempt from remote IP: ${clientIp}`);
        return res.status(403).json({ success: false, message: 'Forbidden: Access restricted to localhost' });
    }

    // 2. Token Security: X-API-Key Header verification
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== SECRET_TOKEN) {
        console.warn(`[Blocked] Invalid or missing API key from IP: ${clientIp}`);
        return res.status(401).json({ success: false, message: 'Unauthorized: Invalid API key' });
    }

    next();
});

// 3. Rate Limiter Middleware: Max 10 requests per minute
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 10, // Limit each IP to 10 requests per windowMs
    message: { success: false, message: 'Too many requests. Rate limit is 10 messages per minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Initialize WhatsApp Client with Memory Optimization
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth' // Persistent auth folder
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Extremely reduces RAM footprint (forces single OS process)
            '--disable-gpu',
            '--disable-extensions'
        ]
    }
});

// QR Code Generation
client.on('qr', (qr) => {
    console.log('\n======================================================================');
    console.log('SCAN THIS QR CODE WITH YOUR WHATSAPP TO LOGIN:');
    console.log('======================================================================\n');
    qrcode.generate(qr, { small: true });
    console.log('\n======================================================================\n');
});

client.on('ready', async () => {
    console.log('✓ WhatsApp Client is READY and connected!');
    
    // Print joined groups and their IDs for easy copying
    try {
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        if (groups.length > 0) {
            console.log('\n=========================================');
            console.log('  LIST GRUP WHATSAPP ANDA & GROUP ID:');
            console.log('=========================================');
            groups.forEach(g => {
                console.log(`Nama Grup : ${g.name}`);
                console.log(`Group ID  : ${g.id._serialized}`);
                console.log('-----------------------------------------');
            });
            console.log('=========================================\n');
        } else {
            console.log('No joined groups found.');
        }
    } catch (err) {
        console.error('Error fetching chats list:', err);
    }
});

client.on('auth_failure', (msg) => {
    console.error('✗ Authentication failure:', msg);
});

client.on('disconnected', (reason) => {
    console.warn('! WhatsApp Client was disconnected:', reason);
});

// Initialize Client
console.log('Starting WhatsApp Client...');
client.initialize();

// REST API endpoint to send message
app.post('/send-message', apiLimiter, async (req, res) => {
    try {
        const { to, message } = req.body;

        if (!to || !message) {
            return res.status(400).json({ success: false, message: 'Missing fields: to and message are required' });
        }

        let cleanNumber = to.trim();
        
        // If it's a group ID, send as-is; otherwise clean and format as standard chat ID
        if (cleanNumber.endsWith('@g.us')) {
            console.log(`Sending message to WhatsApp Group JID: ${cleanNumber}`);
        } else {
            cleanNumber = cleanNumber.replace(/[^0-9]/g, '');
            if (!cleanNumber.endsWith('@c.us')) {
                cleanNumber = `${cleanNumber}@c.us`;
            }
            console.log(`Sending message to Chat JID: ${cleanNumber}`);
        }

        const response = await client.sendMessage(cleanNumber, message);
        
        return res.json({ 
            success: true, 
            message: 'Message sent successfully', 
            id: response.id.id 
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
        if (client) {
            console.log('Destroying WhatsApp client session...');
            await client.destroy();
            console.log('WhatsApp client destroyed.');
        }
    } catch (e) {
        console.error('Error during client destroy:', e);
    }
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
