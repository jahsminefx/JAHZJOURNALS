const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { syncAccountTrades, syncAllCloudAccounts } = require('../controllers/mtCloudSyncController');
const { fetchAccountHistory, fetchOpenPositions } = require('../services/metaApiService');
const axios = require('axios');

async function main() {
  console.log('=== DEBUGGING LIVE CLOUD SYNC ON DOKKU ===');
  console.log('Time:', new Date().toISOString());
  console.log('META_API_TOKEN set:', !!process.env.META_API_TOKEN);

  const accounts = await prisma.tradingAccount.findMany({
    select: {
      id: true,
      name: true,
      userId: true,
      cloudSyncEnabled: true,
      cloudSyncStatus: true,
      cloudAccountId: true,
      cloudLogin: true,
      cloudServer: true,
      cloudError: true,
      cloudLastSyncedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  console.log('\n--- RECENT TRADING ACCOUNTS (Top 10) ---');
  console.log(JSON.stringify(accounts, null, 2));

  const cloudAccounts = accounts.filter(a => a.cloudSyncEnabled || a.cloudAccountId);
  console.log(`\nFound ${cloudAccounts.length} account(s) with cloud sync.`);

  for (const acc of cloudAccounts) {
    console.log(`\n--- Inspecting Account: ${acc.name} (${acc.id}) ---`);
    console.log(`Cloud Account ID: ${acc.cloudAccountId}`);
    console.log(`Server: ${acc.cloudServer}, Login: ${acc.cloudLogin}`);

    if (acc.cloudAccountId && !acc.cloudAccountId.startsWith('dev_cloud_')) {
      try {
        const token = process.env.META_API_TOKEN;
        const res = await axios.get(
          `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${acc.cloudAccountId}`,
          { headers: { 'auth-token': token }, timeout: 10000 }
        );
        console.log('MetaApi Account Status:', {
          id: res.data.id || res.data._id,
          state: res.data.state,
          connectionStatus: res.data.connectionStatus,
          region: res.data.region,
          server: res.data.server,
          login: res.data.login,
        });
      } catch (metaErr) {
        console.error('MetaApi Inspection Error:', metaErr.response?.data || metaErr.message);
      }
    }

    console.log('\nRunning syncAccountTrades...');
    try {
      const syncResult = await syncAccountTrades(acc.id);
      console.log('syncResult:', syncResult);
    } catch (syncErr) {
      console.error('syncAccountTrades Error:', syncErr.message, syncErr.stack);
    }

    const tradeCount = await prisma.trade.count({ where: { tradingAccountId: acc.id } });
    console.log(`Trades in DB for this account: ${tradeCount}`);
  }

  console.log('\n=== RUNNING syncAllCloudAccounts ===');
  const allResult = await syncAllCloudAccounts();
  console.log('syncAllCloudAccounts result:', allResult);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
