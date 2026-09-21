const axios = require('axios');

const META_API_TOKEN = process.env.META_API_TOKEN;

/**
 * Provision & Connect Cloud MetaTrader Account (MT4 / MT5)
 */
const provisionCloudAccount = async ({ platform, server, login, password, accountName }) => {
  if (META_API_TOKEN) {
    try {
      const response = await axios.post(
        'https://mt-provisioning-api-v1.agium.biz/users/current/accounts',
        {
          name: accountName || `JahzJournal_${login}`,
          type: 'cloud',
          login: String(login),
          password: password,
          server: server,
          platform: platform === 'MT5' ? 'mt5' : 'mt4',
          magic: 0,
        },
        {
          headers: {
            'auth-token': META_API_TOKEN,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const cloudAccountId = response.data.id;

      // Deploy account cloud terminal instance
      await axios.post(
        `https://mt-provisioning-api-v1.agium.biz/users/current/accounts/${cloudAccountId}/deploy`,
        {},
        { headers: { 'auth-token': META_API_TOKEN } }
      );

      return {
        success: true,
        cloudAccountId: cloudAccountId,
        status: 'CONNECTING',
        mode: 'LIVE_META_API',
      };
    } catch (error) {
      console.error('MetaApi Cloud Provisioning Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Broker server connection failed. Please verify your broker server name, login number, and investor password.');
    }
  }

  // Development Fallback Mode (Simulates seamless cloud provisioning for testing)
  console.log(`[Dev Mode] Cloud MT Sync provisioned for Server: ${server}, Login: ${login}`);
  return {
    success: true,
    cloudAccountId: `dev_cloud_${login}_${Date.now()}`,
    status: 'CONNECTED',
    mode: 'DEV_MOCK_SYNC',
  };
};

/**
 * Fetch Account History Deals / Orders from MetaTrader
 */
const fetchAccountHistory = async (cloudAccountId, daysBack = 90) => {
  if (META_API_TOKEN && cloudAccountId && !cloudAccountId.startsWith('dev_cloud_')) {
    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

      const response = await axios.get(
        `https://mt-client-api-v1.agium.biz/users/current/accounts/${cloudAccountId}/history-deals/time/${startTime}/${endTime}`,
        {
          headers: {
            'auth-token': META_API_TOKEN,
          },
        }
      );

      return response.data || [];
    } catch (error) {
      console.error('MetaApi Fetch History Error:', error.response?.data || error.message);
      return [];
    }
  }

  // Dev Mock History Generator (Returns sample historical trades for testing)
  const now = Date.now();
  const sampleTrades = [
    {
      ticket: `MT5_${Math.floor(100000 + Math.random() * 900000)}`,
      symbol: 'EURUSD',
      type: 'BUY',
      lots: 0.50,
      openPrice: 1.0850,
      closePrice: 1.0895,
      stopLoss: 1.0820,
      takeProfit: 1.0910,
      profit: 225.00,
      swap: -2.10,
      commission: -3.50,
      openTime: new Date(now - 86400000 * 3).toISOString(),
      closeTime: new Date(now - 86400000 * 3 + 7200000).toISOString(),
      isClosed: true,
      comment: 'MT5 Cloud Auto-Sync Trade',
    },
    {
      ticket: `MT5_${Math.floor(100000 + Math.random() * 900000)}`,
      symbol: 'XAUUSD',
      type: 'SELL',
      lots: 0.20,
      openPrice: 2650.50,
      closePrice: 2638.00,
      stopLoss: 2660.00,
      takeProfit: 2630.00,
      profit: 250.00,
      swap: 0.00,
      commission: -4.00,
      openTime: new Date(now - 86400000 * 2).toISOString(),
      closeTime: new Date(now - 86400000 * 2 + 14400000).toISOString(),
      isClosed: true,
      comment: 'MT5 Cloud Auto-Sync Trade',
    },
    {
      ticket: `MT5_${Math.floor(100000 + Math.random() * 900000)}`,
      symbol: 'GBPUSD',
      type: 'BUY',
      lots: 0.30,
      openPrice: 1.3120,
      closePrice: 1.3090,
      stopLoss: 1.3080,
      takeProfit: 1.3200,
      profit: -90.00,
      swap: -1.20,
      commission: -3.00,
      openTime: new Date(now - 86400000 * 1).toISOString(),
      closeTime: new Date(now - 86400000 * 1 + 3600000).toISOString(),
      isClosed: true,
      comment: 'MT5 Cloud Auto-Sync Trade',
    },
  ];

  return sampleTrades;
};

/**
 * Fetch Currently Open / Floating Positions from MetaTrader
 * These are live trades that haven't been closed yet
 */
const fetchOpenPositions = async (cloudAccountId) => {
  if (META_API_TOKEN && cloudAccountId && !cloudAccountId.startsWith('dev_cloud_')) {
    try {
      const response = await axios.get(
        `https://mt-client-api-v1.agium.biz/users/current/accounts/${cloudAccountId}/open-trades`,
        {
          headers: {
            'auth-token': META_API_TOKEN,
          },
        }
      );

      // Normalize open positions to look like deal history items
      const positions = response.data || [];
      return positions.map(pos => ({
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
  }

  // Dev Mock: Return one open position for testing
  return [
    {
      ticket: `MT5_OPEN_${Math.floor(100000 + Math.random() * 900000)}`,
      symbol: 'USDJPY',
      type: 'BUY',
      lots: 0.10,
      openPrice: 149.250,
      closePrice: null,
      stopLoss: 148.800,
      takeProfit: 150.000,
      profit: 15.00,
      swap: 0,
      commission: -1.50,
      openTime: new Date(Date.now() - 3600000).toISOString(),
      closeTime: null,
      isClosed: false,
      comment: 'Open Position (Auto-Synced)',
    },
  ];
};

/**
 * Remove Cloud MetaTrader Account Connection
 */
const removeCloudAccount = async (cloudAccountId) => {
  if (META_API_TOKEN && cloudAccountId && !cloudAccountId.startsWith('dev_cloud_')) {
    try {
      await axios.delete(
        `https://mt-provisioning-api-v1.agium.biz/users/current/accounts/${cloudAccountId}`,
        { headers: { 'auth-token': META_API_TOKEN } }
      );
    } catch (error) {
      console.error('MetaApi Cloud Removal Error:', error.response?.data || error.message);
    }
  }
  return { success: true };
};

module.exports = {
  provisionCloudAccount,
  fetchAccountHistory,
  fetchOpenPositions,
  removeCloudAccount,
};
