const parseDurationMs = (value, fallbackMs) => {
  if (!value) return fallbackMs;
  const match = String(value).trim().match(/^(\d+)([smhd])?$/i);
  if (!match) return fallbackMs;

  const amount = Number.parseInt(match[1], 10);
  const unit = (match[2] || 'd').toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
};

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.COOKIE_SAME_SITE || 'lax',
});

const getAuthCookieOptions = () => ({
  ...getCookieOptions(),
  maxAge: parseDurationMs(process.env.JWT_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000),
});

const getClearCookieOptions = () => ({
  ...getCookieOptions(),
  expires: new Date(0),
});

module.exports = {
  getAuthCookieOptions,
  getClearCookieOptions,
};
