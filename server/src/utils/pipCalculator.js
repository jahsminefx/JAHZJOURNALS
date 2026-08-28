/**
 * Automatically calculate pips for a trade based on instrument, entry price, exit price, and direction.
 * Supports Forex (EURUSD, etc.), JPY pairs, Metal (Gold/Silver), Crypto, and Indices.
 * 
 * @param {Object} params
 * @param {string} params.pair Instrument symbol (e.g. 'EURUSD', 'USDJPY', 'XAUUSD', 'BTCUSD')
 * @param {string} params.direction 'BUY' or 'SELL'
 * @param {number|string} params.entryPrice Entry price
 * @param {number|string} params.exitPrice Exit price
 * @param {number|string} [params.pips] Pre-existing pips value if explicitly provided
 * @returns {number|null} Calculated or provided pips rounded to 1 decimal place, or null if invalid
 */
const calculatePips = ({ pair, direction, entryPrice, exitPrice, pips } = {}) => {
  if (pips !== undefined && pips !== null && pips !== '' && !isNaN(Number(pips))) {
    return Math.round(Number(pips) * 10) / 10;
  }

  const entry = Number(entryPrice);
  const exit = Number(exitPrice);

  if (!entry || !exit || isNaN(entry) || isNaN(exit) || !pair || !direction) {
    return null;
  }

  const pairStr = String(pair).toUpperCase().trim();
  let pipSize = 0.0001; // Default Forex pip size

  if (pairStr.includes('JPY')) {
    pipSize = 0.01;
  } else if (pairStr.startsWith('XAU') || pairStr.includes('GOLD')) {
    pipSize = 0.1;
  } else if (pairStr.startsWith('XAG') || pairStr.includes('SILVER')) {
    pipSize = 0.01;
  } else if (
    pairStr.includes('BTC') ||
    pairStr.includes('ETH') ||
    pairStr.includes('US30') ||
    pairStr.includes('NAS100') ||
    pairStr.includes('SPX') ||
    pairStr.includes('GER30') ||
    pairStr.includes('DE30') ||
    pairStr.includes('UK100') ||
    pairStr.includes('US500')
  ) {
    pipSize = 1.0;
  }

  const diff = String(direction).toUpperCase().trim() === 'BUY' ? exit - entry : entry - exit;
  const calculatedPips = diff / pipSize;

  return Math.round(calculatedPips * 10) / 10;
};

module.exports = {
  calculatePips,
};
