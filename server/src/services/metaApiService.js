const axios = require('axios');

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

  try {
    const clientBaseUrl = await getClientApiBaseUrl(cloudAccountId, token);
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    const response = await axios.get(
      `${clientBaseUrl}/users/current/accounts/${cloudAccountId}/history-deals/time/${startTime}/${endTime}`,
      {
        headers: {
          'auth-token': token,
        },
        timeout: 20000,
      }
    );

    return response.data || [];
  } catch (error) {
    console.error('MetaApi Fetch History Error:', error.response?.data || error.message);
    return [];
  }
};

/**
 * Fetch Currently Open / Floating Positions from MetaTrader
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
      `${clientBaseUrl}/users/current/accounts/${cloudAccountId}/open-trades`,
      {
        headers: {
          'auth-token': token,
        },
        timeout: 20000,
      }
    );

    const positions = response.data || [];
    return positions.map((pos) => ({
      ticket: String(pos.id || pos.ticket || ''),
      symbol: pos.symbol,
      type: pos.type === 'POSITION_TYPE_BUY' ? 'BUY' : pos.type === 'POSITION_TYPE_SELL' ? 'SELL' : pos.type,
      lots: pos.volume,
      openPrice: pos.openPrice,
      closePrice: null,
      stopLoss: pos.stopLoss,
      takeProfit: pos.takeProfit,
      profit: pos.profit || 0,
      swap: pos.swap || 0,
      commission: pos.commission || 0,
      openTime: pos.time || pos.openTime,
      closeTime: null,
      isClosed: false,
      comment: pos.comment || 'Open Position (Auto-Synced)',
    }));
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
};
