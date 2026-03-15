const nodemailer = require('nodemailer');

/**
 * Email transporter configuration
 * Uses SMTP settings from environment variables
 */
let transporter = null;

const getTransporter = () => {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        console.warn('[Email] SMTP not configured — emails will be logged to console instead of sent.');
        return null;
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false }
    });

    // Verify connection on startup
    transporter.verify()
        .then(() => console.log('[Email] SMTP connection verified ✓'))
        .catch((err) => console.error('[Email] SMTP connection failed:', err.message));

    return transporter;
};

/**
 * Send an email. Falls back to console.log when SMTP is not configured.
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - Plain text body (auto-generated from html if omitted)
 */
const sendEmail = async ({ to, subject, html, text }) => {
    const from = process.env.EMAIL_FROM || 'Cradema <noreply@cradema.com>';
    const transport = getTransporter();

    if (!transport) {
        // Fallback — log to console when SMTP is not configured
        console.log(`[Email-Preview] To: ${to} | Subject: ${subject}`);
        return { preview: true };
    }

    try {
        const info = await transport.sendMail({
            from,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        });
        console.log(`[Email] Sent to ${to}: ${subject} (messageId: ${info.messageId})`);
        return info;
    } catch (error) {
        console.error(`[Email] Failed to send to ${to}: ${error.message}`);
        // Don't throw — email failures should not break the main flow
        return { error: error.message };
    }
};

module.exports = { sendEmail, getTransporter };
