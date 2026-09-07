const crypto = require('crypto');

// Secret key for credential encryption (uses process.env.CREDENTIAL_ENCRYPTION_KEY or fallback hash)
const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = crypto
  .createHash('sha256')
  .update(process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_SECRET || 'jahzjournals_default_secret_key_2026')
  .digest();

/**
 * Encrypt a text string (e.g., Investor Password)
 * Returns format: iv:authTag:encryptedData
 */
const encryptCredential = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypt an encrypted credential string
 */
const decryptCredential = (encryptedText) => {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt credential:', error.message);
    return null;
  }
};

module.exports = {
  encryptCredential,
  decryptCredential,
};
