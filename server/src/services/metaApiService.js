const axios = require('axios');
const dns = require('dns');

// Ensure reliable DNS resolution across different OS network configurations
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (e) {
  // Ignore if not permitted
}

const PROVISIONING_API_HOST = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
const DEFAULT_CLIENT_API_HOST = 'https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai';

const accountRegionCache = new Map();

const getMetaApiToken = () => {
  const token = process.env.META_API_TOKEN;
  if (!token || token.trim() === '') {
    throw new Error('MetaApi is not configured on this server (META_API_TOKEN is missing from environment variables).');
  }
  return token.trim();
};

/**
 * Resolve regional or default Client API Base URL for a specific account
 */
const getClientApiBaseUrl = async (cloudAccountId, token) => {
  if (accountRegionCache.has(cloudAccountId)) {
    return accountRegionCache.get(cloudAccountId);
  }

  try {
    const res = await axios.get(`${PROVISIONING_API_HOST}/users/current/accounts/${cloudAccountId}`, {
      headers: { 'auth-token': token },
      timeout: 10000,
    });
    const region = res.data?.region;
    const baseUrl = region
      ? `https://mt-client-api-v1.${region}.agiliumtrade.ai`
      : DEFAULT_CLIENT_API_HOST;
    accountRegionCache.set(cloudAccountId, baseUrl);
    return baseUrl;
  } catch (err) {
    return DEFAULT_CLIENT_API_HOST;
  }
};

/**
 * Check connection status of a MetaApi account
 */
const getAccountConnectionStatus = async (cloudAccountId) => {
  if (!cloudAccountId || cloudAccountId.startsWith('dev_cloud_')) {
    return { state: 'UNKNOWN', connectionStatus: 'DISCONNECTED' };
  }
  const token = getMetaApiToken();
  const res = await axios.get(`${PROVISIONING_API_HOST}/users/current/accounts/${cloudAccountId}`, {
    headers: { 'auth-token': token },
    timeout: 10000,
  });
  return {
    state: res.data?.state,
    connectionStatus: res.data?.connectionStatus,
    region: res.data?.region,
  };
};

/**
 * Provision & Connect Cloud MetaTrader Account (MT4 / MT5) via MetaApi
 */
const provisionCloudAccount = async ({ platform, server, login, password, accountName }) => {
  const token = getMetaApiToken();

  try {
    const response = await axios.post(
      `${PROVISIONING_API_HOST}/users/current/accounts`,
      {
        name: accountName || `JahzJournal_${login}`,
        type: 'cloud',
        login: String(login).trim(),
        password: password,
        server: String(server).trim(),
        platform: platform === 'MT5' ? 'mt5' : 'mt4',
        magic: 0,
      },
      {
        headers: {
          'auth-token': token,
          'Content-Type': 'application/json',
        },
        timeout: 25000,
      }
    );

    const cloudAccountId = response.data.id;

    // Deploy account cloud terminal instance
    await axios.post(
      `${PROVISIONING_API_HOST}/users/current/accounts/${cloudAccountId}/deploy`,
      {},
      {
        headers: { 'auth-token': token },
        timeout: 20000,
      }
    );

    return {
      success: true,
      cloudAccountId: cloudAccountId,
      status: 'CONNECTING',
      mode: 'LIVE_META_API',
    };
  } catch (error) {
    console.error('MetaApi Cloud Provisioning Error:', error.response?.data || error.message);
    const apiError = error.response?.data?.message || error.response?.data?.error || error.message;
    throw new Error(`MetaTrader connection failed: ${apiError}`);
  }
};

/**
 * Fetch Account History Deals / Orders from MetaTrader
 * Groups MT5 entry and exit deals by positionId into complete, normalized trades.
 * NEVER returns synthetic or fake trades.
 */
const fetchAccountHistory = async (cloudAccountId, daysBack = 90) => {
  if (!cloudAccountId || cloudAccountId.startsWith('dev_cloud_')) {
    console.warn(`[MetaApi] Skipping fetchAccountHistory: Invalid or legacy cloudAccountId (${cloudAccountId})`);
    return [];
  }

  let token;
  try {
    token = getMetaApiToken();
  } catch (err) {
    console.error('[MetaApi] Cannot fetch history:', err.message);
    return [];
  }

  const queryRange = async (days) => {
    const clientBaseUrl = await getClientApiBaseUrl(cloudAccountId, token);
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const response = await axios.get(
      `${clientBaseUrl}/users/current/accounts/${cloudAccountId}/history-deals/time/${startTime}/${endTime}`,
      {
        headers: {
          'auth-token': token,
        },
        timeout: 45000,
      }
    );
    return response.data || [];
  };

  try {
    let rawDeals;
    try {
      rawDeals = await queryRange(daysBack);
    } catch (firstErr) {
      if (firstErr.code === 'ECONNABORTED' || firstErr.message?.includes('timeout') || firstErr.response?.data?.error === 'TimeoutError') {
        console.warn(`[MetaApi] ${daysBack}-day history query timed out. Retrying with 30-day window...`);
        rawDeals = await queryRange(30);
      } else {
        throw firstErr;
      }
    }

    if (!Array.isArray(rawDeals) || rawDeals.length === 0) {
      return [];
    }

    // Group MT5 deals by positionId to reconstruct full trade lifecycles (Entry + Exit)
    const positionsMap = new Map();
    for (const deal of rawDeals) {
      // Ignore balance deposit/withdrawal events
      if (deal.type === 'DEAL_TYPE_BALANCE' || !deal.symbol) {
        continue;
      }

      const positionId = String(deal.positionId || deal.orderId || deal.id || '').trim();
      if (!positionId) continue;

      if (!positionsMap.has(positionId)) {
        positionsMap.set(positionId, {
          inDeals: [],
          outDeals: [],
        });
      }

      const record = positionsMap.get(positionId);
      if (deal.entryType === 'DEAL_ENTRY_IN') {
        record.inDeals.push(deal);
      } else if (deal.entryType === 'DEAL_ENTRY_OUT') {
        record.outDeals.push(deal);
      } else {
        // Fallback for MT4 or non-standard deals
        if (deal.closePrice || deal.profit) {
          record.outDeals.push(deal);
        } else {
          record.inDeals.push(deal);
        }
      }
    }

    const completedTrades = [];
    for (const [positionId, { inDeals, outDeals }] of positionsMap.entries()) {
      if (inDeals.length === 0 && outDeals.length === 0) continue;

      // Primary entry details
      const entryDeal = inDeals[0] || outDeals[0];
      // Primary exit details
      const exitDeal = outDeals[outDeals.length - 1];

      const symbol = entryDeal.symbol;
      const rawDirection = String(entryDeal.type || '').toUpperCase();
      const direction = rawDirection.includes('BUY') ? 'BUY' : 'SELL';

      const entryPrice = entryDeal.price || entryDeal.openPrice;
      const exitPrice = exitDeal ? (exitDeal.price || exitDeal.closePrice) : null;

      const stopLoss = entryDeal.stopLoss || (exitDeal && exitDeal.stopLoss) || null;
      const takeProfit = entryDeal.takeProfit || (exitDeal && exitDeal.takeProfit) || null;
      const lots = entryDeal.volume || entryDeal.lots;

      // Net profit = sum of profit from exit deals + commissions + swaps across all deals
      const grossProfit = outDeals.reduce((sum, d) => sum + (Number(d.profit) || 0), 0);
      const totalCommission = [...inDeals, ...outDeals].reduce((sum, d) => sum + (Number(d.commission) || 0), 0);
      const totalSwap = [...inDeals, ...outDeals].reduce((sum, d) => sum + (Number(d.swap) || 0), 0);
      const netProfit = grossProfit + totalCommission + totalSwap;

      const entryTime = entryDeal.time ? new Date(entryDeal.time) : new Date();
      const exitTime = exitDeal && exitDeal.time ? new Date(exitDeal.time) : null;
      const isClosed = Boolean(exitDeal && exitPrice !== null);

      completedTrades.push({
        ticket: positionId,
        symbol,
        type: direction,
        openPrice: entryPrice,
        closePrice: exitPrice,
        stopLoss,
        takeProfit,
        lots,
        profit: isClosed ? netProfit : null,
        swap: totalSwap,
        commission: totalCommission,
        openTime: entryTime.toISOString(),
        closeTime: exitTime ? exitTime.toISOString() : null,
        isClosed,
        comment: (exitDeal && (exitDeal.comment || exitDeal.brokerComment)) || entryDeal.comment || 'MetaTrader Cloud Sync',
      });
    }

    return completedTrades;
  } catch (error) {
    console.error('MetaApi Fetch History Error:', error.response?.data || error.message);
    return [];
  }
};

/**
 * Fetch Currently Open / Floating Positions from MetaTrader
 * Queries GET /users/current/accounts/:id/positions
 * NEVER returns synthetic or fake trades.
 */
const fetchOpenPositions = async (cloudAccountId) => {
  if (!cloudAccountId || cloudAccountId.startsWith('dev_cloud_')) {
    console.warn(`[MetaApi] Skipping fetchOpenPositions: Invalid or legacy cloudAccountId (${cloudAccountId})`);
    return [];
  }

  let token;
  try {
    token = getMetaApiToken();
  } catch (err) {
    console.error('[MetaApi] Cannot fetch open positions:', err.message);
    return [];
  }

  try {
    const clientBaseUrl = await getClientApiBaseUrl(cloudAccountId, token);
    const response = await axios.get(
      `${clientBaseUrl}/users/current/accounts/${cloudAccountId}/positions`,
      {
        headers: {
          'auth-token': token,
        },
        timeout: 20000,
      }
    );

    const positions = response.data || [];
    return positions.map((pos) => {
      const rawType = String(pos.type || '').toUpperCase();
      const direction = rawType.includes('BUY') ? 'BUY' : 'SELL';
      const realizedSwap = Number(pos.realizedSwap) || 0;
      const unrealizedSwap = Number(pos.unrealizedSwap) || 0;
      const realizedComm = Number(pos.realizedCommission) || 0;
      const unrealizedComm = Number(pos.unrealizedCommission) || 0;

      return {
        ticket: String(pos.id || pos.ticket || ''),
        symbol: pos.symbol,
        type: direction,
        lots: pos.volume,
        openPrice: pos.openPrice,
        closePrice: null,
        stopLoss: pos.stopLoss || null,
        takeProfit: pos.takeProfit || null,
        profit: pos.profit || 0,
        swap: realizedSwap + unrealizedSwap,
        commission: realizedComm + unrealizedComm,
        openTime: pos.time || new Date().toISOString(),
        closeTime: null,
        isClosed: false,
        comment: pos.comment || 'Live Open Position',
      };
    });
  } catch (error) {
    console.error('MetaApi Fetch Open Positions Error:', error.response?.data || error.message);
    return [];
  }
};

/**
 * Remove Cloud MetaTrader Account Connection
 */
const removeCloudAccount = async (cloudAccountId) => {
  if (!cloudAccountId || cloudAccountId.startsWith('dev_cloud_')) {
    return { success: true };
  }

  let token;
  try {
    token = getMetaApiToken();
  } catch (err) {
    return { success: true };
  }

  try {
    await axios.delete(
      `${PROVISIONING_API_HOST}/users/current/accounts/${cloudAccountId}`,
      {
        headers: { 'auth-token': token },
        timeout: 15000,
      }
    );
    accountRegionCache.delete(cloudAccountId);
  } catch (error) {
    console.error('MetaApi Cloud Removal Error:', error.response?.data || error.message);
  }

  return { success: true };
};

module.exports = {
  provisionCloudAccount,
  fetchAccountHistory,
  fetchOpenPositions,
  removeCloudAccount,
  getAccountConnectionStatus,
};
