const nodemailer = require('nodemailer');

const MAX_LEN = { name: 120, email: 254, subject: 200, message: 8000 };

function getTransporter() {
  const host = (process.env.SMTP_HOST || '').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = (process.env.SMTP_USER || '').trim();
  let pass = (process.env.SMTP_PASS || '').trim();
  // Strip accidental wrapping quotes from .env (e.g. SMTP_PASS="abcd")
  if ((pass.startsWith('"') && pass.endsWith('"')) || (pass.startsWith("'") && pass.endsWith("'"))) {
    pass = pass.slice(1, -1);
  }

  if (!host || !user || !pass) {
    return null;
  }

  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * POST /api/contact — landing page contact form (sends email to team inbox)
 */
exports.sendContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Name, email, subject, and message are required.' });
    }

    const nameStr = String(name).trim();
    const emailStr = String(email).trim().toLowerCase();
    const subjectStr = String(subject).trim();
    const messageStr = String(message).trim();

    if (
      nameStr.length > MAX_LEN.name ||
      emailStr.length > MAX_LEN.email ||
      subjectStr.length > MAX_LEN.subject ||
      messageStr.length > MAX_LEN.message
    ) {
      return res.status(400).json({ error: 'One or more fields are too long.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailStr)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    const to = (process.env.CONTACT_TO_EMAIL || 'neurohireofficial@gmail.com').trim();
    const from = (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
    if (!from) {
      return res.status(503).json({
        error: 'Email is not configured. Set SMTP_FROM or SMTP_USER in backend/.env.',
      });
    }

    const transporter = getTransporter();
    if (!transporter) {
      return res.status(503).json({
        error:
          'Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in backend/.env.',
      });
    }

    const text = [
      `New message from NeuroHire landing page`,
      ``,
      `Name: ${nameStr}`,
      `Email: ${emailStr}`,
      `Subject: ${subjectStr}`,
      ``,
      messageStr,
    ].join('\n');

    const html = `
      <h2>New message from NeuroHire landing page</h2>
      <p><strong>Name:</strong> ${escapeHtml(nameStr)}</p>
      <p><strong>Email:</strong> ${escapeHtml(emailStr)}</p>
      <p><strong>Subject:</strong> ${escapeHtml(subjectStr)}</p>
      <hr/>
      <pre style="white-space:pre-wrap;font-family:sans-serif;">${escapeHtml(messageStr)}</pre>
    `;

    await transporter.sendMail({
      from: `"NeuroHire Contact" <${from}>`,
      to,
      replyTo: emailStr,
      subject: `[NeuroHire Contact] ${subjectStr}`,
      text,
      html,
    });

    return res.json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    console.error('Contact form email error:', err);
    if (err && (err.code === 'EAUTH' || err.responseCode === 535)) {
      console.error(
        'Gmail SMTP auth failed (535). Use a 16-char App Password (Google Account → Security → 2-Step Verification → App passwords), not your normal Gmail password. SMTP_USER must match that Gmail account. See SetUp_Guideines/CONTACT_FORM_NODEMAILER.md'
      );
    }
    return res.status(500).json({
      error: 'Failed to send message. Please try again later or email us directly.',
    });
  }
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
