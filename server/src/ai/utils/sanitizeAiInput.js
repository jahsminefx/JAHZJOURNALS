const sanitizeAiInput = (input) => {
  if (typeof input !== 'string') return input;

  // Basic sanitization: strip urls, email addresses
  let sanitized = input;

  // Strip emails
  sanitized = sanitized.replace(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})/g, '[REDACTED_EMAIL]');

  // Strip basic long URLs to prevent huge prompt tokens or injection
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[URL]');

  return sanitized.trim();
};

const redactSensitiveData = (tradeObj) => {
  if (!tradeObj) return tradeObj;

  const safeTrade = { ...tradeObj };
  // Redact personal identities if they exist on nested objects
  if (safeTrade.tradingAccount) {
    delete safeTrade.tradingAccount.userId;
    delete safeTrade.tradingAccount.user;
  }

  // Sanitize notes
  if (safeTrade.notesBefore) safeTrade.notesBefore = sanitizeAiInput(safeTrade.notesBefore);
  if (safeTrade.notesAfter) safeTrade.notesAfter = sanitizeAiInput(safeTrade.notesAfter);

  return safeTrade;
};

module.exports = {
  sanitizeAiInput,
  redactSensitiveData,
};
