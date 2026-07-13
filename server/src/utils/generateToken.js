const jwt = require('jsonwebtoken');
const { getAuthCookieOptions } = require('./cookieOptions');

const generateToken = (res, userId, tokenVersion = 0) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  const token = jwt.sign({ userId, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  res.cookie('jwt', token, {
    ...getAuthCookieOptions(),
  });

  return token;
};

module.exports = generateToken;
