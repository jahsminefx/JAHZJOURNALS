const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Security Exception] CREDENTIAL_ENCRYPTION_KEY or JWT_SECRET must be configured in production');
    }
    // Safe fallback strictly in development/test environments
    return crypto.createHash('sha256').update('jahzjournals_dev_only_key_not_for_prod').digest();
  }
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a text string (e.g., Investor Password)
 * Returns format: iv:authTag:encryptedData
 */
const encryptCredential = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
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
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    
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
  getEncryptionKey,
};
