const nodemailer = require('nodemailer');

/**
 * Email transporter configuration
 * Uses SMTP settings from environment variables
 */
let transporter = null;
let smtpReady = false;

const getTransporter = () => {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        console.warn('[Email] SMTP not configured — emails will be logged to console instead of sent.');
        console.warn('[Email] Missing:', !host ? 'SMTP_HOST' : '', !user ? 'SMTP_USER' : '', !pass ? 'SMTP_PASS' : '');
        return null;
    }

    console.log(`[Email] Configuring SMTP: host=${host}, port=${port}, user=${user}`);

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
    });

    // Verify connection on startup (non-blocking)
    transporter.verify()
        .then(() => {
            smtpReady = true;
            console.log('[Email] SMTP connection verified ✓');
        })
        .catch((err) => {
            console.error('[Email] SMTP connection FAILED:', err.message);
            console.error('[Email] Full error:', JSON.stringify({ code: err.code, command: err.command, response: err.response }));
        });

    return transporter;
};

// Initialize transporter on module load so we see logs at startup
if (process.env.SMTP_HOST) {
    getTransporter();
}

/**
 * Send an email. Falls back to console.log when SMTP is not configured.
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - Plain text body (auto-generated from html if omitted)
 */
const sendEmail = async ({ to, subject, html, text }) => {
    // Use SMTP_USER as fallback sender — Brevo requires the "from" to be a verified sender
    const from = process.env.EMAIL_FROM || `Cradema <${process.env.SMTP_USER || 'noreply@cradema.com'}>`;
    const transport = getTransporter();

    if (!transport) {
        // Fallback — log to console when SMTP is not configured
        console.log(`[Email-Preview] To: ${to} | Subject: ${subject}`);
        return { preview: true };
    }

    try {
        console.log(`[Email] Sending to ${to}: "${subject}" from "${from}"...`);
        const info = await transport.sendMail({
            from,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        });
        console.log(`[Email] ✓ Sent to ${to}: ${subject} (messageId: ${info.messageId})`);
        return info;
    } catch (error) {
        console.error(`[Email] ✗ Failed to send to ${to}: ${error.message}`);
        console.error(`[Email] Error details:`, JSON.stringify({ code: error.code, command: error.command, response: error.response, responseCode: error.responseCode }));
        // Don't throw — email failures should not break the main flow
        return { error: error.message };
    }
};

module.exports = { sendEmail, getTransporter };

