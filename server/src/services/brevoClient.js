const crypto = require('crypto');

let Brevo;
try {
  Brevo = require('@getbrevo/brevo');
} catch (e) {
  Brevo = null;
}

/**
 * Safely hashes an email address for delivery logging without exposing PII/tokens
 */
const hashRecipient = (email) => {
  if (!email) return 'unknown';
  const cleanEmail = email.trim().toLowerCase();
  const parts = cleanEmail.split('@');
  if (parts.length === 2) {
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length > 2 ? name.substring(0, 2) + '***' : name + '***';
    return `${maskedName}@${domain}`;
  }
  return crypto.createHash('sha256').update(cleanEmail).digest('hex').substring(0, 10);
};

/**
 * Transmit transactional email via official Brevo SDK with retries and structured logging
 */
const sendBrevoEmail = async ({ to, subject, html, text, replyTo, templateId, params }) => {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[Brevo Log] (Not Configured - Mock Delivery) To: ${hashRecipient(to)} | Subject: "${subject}"`);
    }
    return {
      success: false,
      provider: 'brevo',
      messageId: null,
      errorCode: 'BREVO_NOT_CONFIGURED',
      error: 'Brevo API key is missing from environment variables.',
    };
  }

  if (!Brevo) {
    console.error('[Brevo Error] @getbrevo/brevo package is not installed');
    return {
      success: false,
      provider: 'brevo',
      messageId: null,
      errorCode: 'BREVO_SDK_MISSING',
      error: '@getbrevo/brevo package missing',
    };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@jahzjournal.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'JAHZJOURNALS';
  const replyToEmail = replyTo || process.env.BREVO_REPLY_TO_EMAIL || process.env.ADMIN_EMAIL || null;

  const maxRetries = 2;
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    try {
      attempt++;
      let messageId = null;

      if (Brevo.BrevoClient) {
        // Brevo SDK v2 API
        const client = new Brevo.BrevoClient({ apiKey });
        const emailData = {
          sender: { email: senderEmail, name: senderName },
          to: [{ email: to }],
          subject,
        };

        if (replyToEmail && replyToEmail.trim() !== '') {
          emailData.replyTo = { email: replyToEmail.trim() };
        }

        if (templateId) {
          emailData.templateId = templateId;
          if (params) emailData.params = params;
        } else {
          emailData.htmlContent = html || `<p>${text}</p>`;
          emailData.textContent = text || '';
        }

        const res = await client.transactionalEmails.sendTransacEmail(emailData);
        messageId = res?.messageId || res?.body?.messageId || 'sent';

      } else if (Brevo.TransactionalEmailsApi) {
        // Brevo SDK v1 API
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.authentications['apiKey'].apiKey = apiKey;
        const sendSmtpEmail = new Brevo.SendSmtpEmail();
        sendSmtpEmail.sender = { email: senderEmail, name: senderName };
        sendSmtpEmail.to = [{ email: to }];
        sendSmtpEmail.subject = subject;

        if (replyToEmail && replyToEmail.trim() !== '') {
          sendSmtpEmail.replyTo = { email: replyToEmail.trim() };
        }

        if (templateId) {
          sendSmtpEmail.templateId = templateId;
          if (params) sendSmtpEmail.params = params;
        } else {
          sendSmtpEmail.htmlContent = html || `<p>${text}</p>`;
          sendSmtpEmail.textContent = text || '';
        }

        const res = await apiInstance.sendTransacEmail(sendSmtpEmail);
        messageId = res?.body?.messageId || res?.messageId || 'sent';
      }

      console.log(`[Brevo Success] Type: "${subject}" | Recipient: ${hashRecipient(to)} | MessageID: ${messageId}`);

      return {
        success: true,
        provider: 'brevo',
        messageId,
        errorCode: null,
      };
    } catch (err) {
      lastError = err;
      
      // Native HTTPS REST API fallback
      try {
        const https = require('https');
        const emailPayload = {
          sender: { email: senderEmail, name: senderName },
          to: [{ email: to }],
          subject,
          htmlContent: html || `<p>${text}</p>`,
          textContent: text || ''
        };
        if (replyToEmail && replyToEmail.trim() !== '') {
          emailPayload.replyTo = { email: replyToEmail.trim() };
        }

        const restResult = await new Promise((resolve, reject) => {
          const payloadStr = JSON.stringify(emailPayload);
          const req = https.request('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'api-key': apiKey,
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payloadStr)
            }
          }, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
              try {
                const parsed = JSON.parse(responseBody);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  resolve({ messageId: parsed.messageId || 'sent' });
                } else {
                  reject(new Error(parsed.message || `Status ${res.statusCode}`));
                }
              } catch (e) {
                reject(new Error('Invalid JSON response from Brevo REST API'));
              }
            });
          });
          req.on('error', reject);
          req.write(payloadStr);
          req.end();
        });

        console.log(`[Brevo Success REST] Type: "${subject}" | Recipient: ${hashRecipient(to)} | MessageID: ${restResult.messageId}`);
        return {
          success: true,
          provider: 'brevo',
          messageId: restResult.messageId,
          errorCode: null,
        };
      } catch (restErr) {
        console.error(`[Brevo REST Fallback Error]:`, restErr.message);
      }

      const status = err.status || err.response?.status;
      
      // Do not retry 400 bad requests or invalid recipients
      if (status && status >= 400 && status < 500 && status !== 429) {
        break;
      }

      if (attempt <= maxRetries) {
        const backoffMs = attempt * 1000;
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }
  }

  const errorMessage = lastError?.response?.body?.message || lastError?.message || 'Unknown Brevo API error';
  console.error(`[Brevo Delivery Failed] Recipient: ${hashRecipient(to)} | Error: ${errorMessage}`);

  return {
    success: false,
    provider: 'brevo',
    messageId: null,
    errorCode: 'BREVO_API_ERROR',
    error: errorMessage,
  };
};

module.exports = {
  sendBrevoEmail,
  hashRecipient,
};
