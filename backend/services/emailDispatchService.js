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
    throw err;
  }
}

module.exports = {
  dispatchEmailBatch,
  N8N_EMAIL_WEBHOOK_URL,
};
