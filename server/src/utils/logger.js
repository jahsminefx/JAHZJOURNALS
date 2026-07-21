// utils/logger.js

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'apikey', 'jwt', 'cookie', 'authorization'];

const redact = (data) => {
  if (!data) return data;
  if (typeof data !== 'object') return data;
  
  const redacted = Array.isArray(data) ? [...data] : { ...data };
  
  for (const key in redacted) {
    if (Object.prototype.hasOwnProperty.call(redacted, key)) {
       const lowerKey = key.toLowerCase();
       const isSensitive = SENSITIVE_KEYS.some(sk => lowerKey.includes(sk));
       
       if (isSensitive) {
         redacted[key] = '[REDACTED]';
       } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
         redacted[key] = redact(redacted[key]);
       }
    }
  }
  return redacted;
};

const formatMessage = (level, message, meta = {}) => {
  const isProd = process.env.NODE_ENV === 'production';
  
  if (isProd) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...redact(meta)
    });
  } else {
    // Development formatting
    const metaStr = Object.keys(meta).length ? JSON.stringify(redact(meta)) : '';
    return `[${new Date().toISOString()}] [${level}] ${message} ${metaStr}`;
  }
};

const logger = {
  info: (msg, meta) => console.log(formatMessage('INFO', msg, meta)),
  warn: (msg, meta) => console.warn(formatMessage('WARN', msg, meta)),
  error: (msg, meta) => console.error(formatMessage('ERROR', msg, meta)),
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== 'production') {
       console.log(formatMessage('DEBUG', msg, meta));
    }
  }
};

module.exports = logger;
