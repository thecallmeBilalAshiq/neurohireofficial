const axios = require('axios');

const N8N_EMAIL_WEBHOOK_URL =
  process.env.N8N_EMAIL_WEBHOOK_URL || 'http://localhost:5678/webhook/send-interview-emails';

/**
 * n8n Webhook with responseMode "lastNode" often returns HTTP 500 because the SMTP
 * "Send email" node output is not JSON the webhook response extractor can use
 * ("No item to return was found"). Emails may still have been sent; we treat that as success.
 */
function isN8nLastNodeResponseBug(err) {
  const status = err.response?.status;
  const msg = err.response?.data?.message || err.response?.data?.error?.message || '';
  return (
    status === 500 &&
    typeof msg === 'string' &&
    msg.toLowerCase().includes('no item to return')
  );
}

async function sendDirectSmtp(to, subject, body) {
  try {
    const nodemailer = require('nodemailer');
    const host = (process.env.SMTP_HOST || '').trim();
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = (process.env.SMTP_USER || '').trim();
    let pass = (process.env.SMTP_PASS || '').trim();
    if ((pass.startsWith('"') && pass.endsWith('"')) || (pass.startsWith("'") && pass.endsWith("'"))) {
      pass = pass.slice(1, -1);
    }
    const from = (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();

    if (!host || !user || !pass || !from) {
      console.warn('[emailDispatch] Direct SMTP credentials not fully configured in backend/.env');
      return false;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    const htmlBody = body.replace(/\n/g, '<br/>');

    await transporter.sendMail({
      from: `"NeuroHire" <${from}>`,
      to,
      subject,
      text: body,
      html: `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #333;">${htmlBody}</div>`,
    });
    return true;
  } catch (err) {
    console.error(`[emailDispatch] Failed to send email to ${to} via SMTP:`, err.message);
    return false;
  }
}

/**
 * Queue emails through n8n (same webhook shape as sendInterviewEmails).
 * Payload is JSON `{ emails, totalCount, jobInfo, sentAt }`. In n8n, the Webhook
 * exposes that object as `item.json.body` — use `body.emails` or the Code node in docs/n8n-neurohire-send-interview-emails.json.
 */
async function dispatchEmailBatch(emails, jobInfo = {}) {
  if (!emails || !emails.length) return { sentCount: 0 };
  const payload = {
    emails,
    totalCount: emails.length,
    jobInfo,
    sentAt: new Date().toISOString(),
  };
  try {
    const res = await axios.post(N8N_EMAIL_WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
    });
    return { sentCount: emails.length, n8nResponse: res.data };
  } catch (err) {
    if (isN8nLastNodeResponseBug(err)) {
      console.warn(
        '[emailDispatch] n8n returned 500 (lastNode response extraction). Treating as OK; add a Code/Respond node after Send email in n8n to fix the webhook response.',
        err.response?.data?.message
      );
      return {
        sentCount: emails.length,
        n8nResponse: err.response?.data,
        assumedSuccessDueToN8nResponseBug: true,
      };
    }
    
    console.warn('[emailDispatch] n8n email webhook call failed. Falling back to direct SMTP sending. Error:', err.message);
    try {
      let sentCount = 0;
      for (const emailObj of emails) {
        const ok = await sendDirectSmtp(emailObj.to, emailObj.subject, emailObj.body);
        if (ok) sentCount++;
      }
      if (sentCount > 0) {
        console.log(`[emailDispatch] Successfully sent ${sentCount} email(s) directly via SMTP fallback.`);
        return {
          sentCount,
          fallbackSmtp: true,
          message: 'n8n webhook failed; emails dispatched via direct SMTP fallback.'
        };
      }
    } catch (smtpErr) {
      console.error('[emailDispatch] Direct SMTP fallback failed:', smtpErr.message);
    }
    throw err;
  }
}

module.exports = {
  dispatchEmailBatch,
  N8N_EMAIL_WEBHOOK_URL,
};
