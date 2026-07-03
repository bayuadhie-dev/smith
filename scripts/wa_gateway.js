/**
 * Self-Hosted local WhatsApp Gateway Microservice
 * Path: /home/superadmin/Documents/SourceCode/scripts/wa_gateway.js
 * Exposes: POST http://localhost:8000/send-message
 */
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = 8000;

// Security Configurations
const SECRET_TOKEN = 'local-wa-secret-token'; // Fallback matching default setting

app.use(express.json());

// Request Security Middleware: Restrict to localhost & Verify X-API-Key
app.use((req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    
    // Check if request is from localhost (IPv4 127.0.0.1 or IPv6 ::1 or ::ffff:127.0.0.1)
    const isLocal = clientIp === '127.0.0.1' || 
                    clientIp === '::1' || 
                    clientIp === '::ffff:127.0.0.1' || 
                    clientIp.includes('127.0.0.1');
                    
    if (!isLocal) {
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

client.on('ready', () => {
    console.log('✓ WhatsApp Client is READY and connected!');
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
app.post('/send-message', async (req, res) => {
    try {
        const { to, message } = req.body;

        if (!to || !message) {
            return res.status(400).json({ success: false, message: 'Missing fields: to and message are required' });
        }

        // Clean phone number format: remove +, spaces, and ensure ends with @c.us
        let cleanNumber = to.replace(/[^0-9]/g, '');
        if (!cleanNumber.endsWith('@c.us')) {
            cleanNumber = `${cleanNumber}@c.us`;
        }

        console.log(`Sending message to ${cleanNumber}...`);
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
