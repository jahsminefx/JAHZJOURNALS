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
  removeCloudAccount,
};
