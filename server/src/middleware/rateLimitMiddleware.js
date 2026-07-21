const rateLimit = require('express-rate-limit');

// Global API Limiter (Standard routes)
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV !== 'production' ? 5000 : 300,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict Limiter for Authentication (Login/Register/Reset)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV !== 'production' ? 5000 : 20,
  message: { message: 'Too many authentication attempts, please try again after an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict Limiter for AI endpoints (Generation processes)
const aiFeaturesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV !== 'production' ? 5000 : 10,
  message: { message: 'AI generation requests are rate limited to prevent network abuse. Wait 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  globalApiLimiter,
  authLimiter,
  aiFeaturesLimiter
};
