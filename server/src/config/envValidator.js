const fs = require('fs');
const path = require('path');

/**
 * Validates the presence of required production environment variables.
 * Should be called synchronously at the absolute start of the server process.
 * Halts deployment if critical infrastructure secrets are missing.
 */
function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') {
    return; // Soft validation for development environments
  }

  const criticalVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'CLIENT_URL',
    'REDIS_URL',
    'PAYSTACK_SECRET_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];

  const missingVars = criticalVars.filter((key) => !process.env[key] || process.env[key].trim() === '');

  // Check if both CREDENTIAL_ENCRYPTION_KEY and JWT_SECRET are missing
  if (!process.env.CREDENTIAL_ENCRYPTION_KEY && !process.env.JWT_SECRET) {
    missingVars.push('CREDENTIAL_ENCRYPTION_KEY (or JWT_SECRET)');
  }

  if (missingVars.length > 0) {
    console.error(`\n[CRITICAL FAILURE] Missing required production environment variables:`);
    missingVars.forEach((v) => console.error(` ❌ ${v}`));
    console.error(`\nThe server cannot start in production without these secrets.`);
    console.error(`Please update the Dokku configuration (dokku config:set appname KEY=VALUE).\n`);
    process.exit(1);
  }

  // Security warning if credential encryption key is not isolated from JWT secret
  if (!process.env.CREDENTIAL_ENCRYPTION_KEY && process.env.JWT_SECRET) {
    console.warn(`[SECURITY WARNING] CREDENTIAL_ENCRYPTION_KEY is not set. Falling back to JWT_SECRET for credential encryption. Please set CREDENTIAL_ENCRYPTION_KEY to isolate database encryption keys from session signing keys.`);
  }

  // Soft Warnings for non-critical but required AI infrastructure
  const missingAI = !process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY;
  if (missingAI) {
    console.warn(`[WARNING] Neither OPENROUTER_API_KEY nor OPENAI_API_KEY supplied. AI Hub features will fail gracefully.`);
  }

  const missingBrevo = !process.env.BREVO_API_KEY && (process.env.EMAIL_PROVIDER || 'brevo') === 'brevo';
  if (missingBrevo) {
    console.warn(`[WARNING] BREVO_API_KEY is not supplied. Transactional emails will operate in mock mode.`);
  }

  if (!process.env.BREVO_WEBHOOK_SECRET) {
    console.warn(`[WARNING] BREVO_WEBHOOK_SECRET is not configured. Brevo webhook requests will fail closed.`);
  }
}

module.exports = { validateProductionEnv };
