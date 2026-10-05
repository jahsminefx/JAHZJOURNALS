const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const { syncAccountTrades } = require('../controllers/mtCloudSyncController');

async function main() {
  console.log('=== FIXING LIVE ACCOUNT ON DOKKU ===');

  const liveAccount = await prisma.tradingAccount.findFirst({
    where: { cloudLogin: '464337' },
  });

  if (!liveAccount) {
    console.error('Account with login 464337 not found in DB!');
    return;
  }

  console.log('Found account:', liveAccount.name, liveAccount.id, 'Current cloudAccountId:', liveAccount.cloudAccountId);

  const token = process.env.META_API_TOKEN;

  // Check state of the working terminal (118e349d-8531-4796-a33e-c34aa3c7a5e0)
  const workingId = '118e349d-8531-4796-a33e-c34aa3c7a5e0';
  const badId = 'bc0e81c5-e729-4068-8441-bd0c97140a26';

  try {
    const res = await axios.get(
      `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${workingId}`,
      { headers: { 'auth-token': token } }
    );
    console.log('Working terminal status in MetaApi:', res.data.connectionStatus, res.data.state);
  } catch (err) {
    console.error('Error checking working terminal:', err.response?.data || err.message);
  }

  // Update DB to use the working terminal ID
  await prisma.tradingAccount.update({
    where: { id: liveAccount.id },
    data: {
      cloudAccountId: workingId,
      cloudSyncEnabled: true,
      cloudSyncStatus: 'CONNECTED',
      cloudError: null,
    },
  });
  console.log('Updated account cloudAccountId to working terminal:', workingId);

  // Delete the disconnected terminal from MetaApi to free up slots
  try {
    await axios.delete(
      `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${badId}`,
      { headers: { 'auth-token': token } }
    );
    console.log('Deleted disconnected terminal', badId, 'from MetaApi.');
  } catch (err) {
    console.log('Could not delete badId (may already be gone):', err.message);
  }

  // Now trigger syncAccountTrades!
  console.log('Running syncAccountTrades now...');
  const syncResult = await syncAccountTrades(liveAccount.id);
  console.log('syncResult:', syncResult);

  const totalTrades = await prisma.trade.count({ where: { tradingAccountId: liveAccount.id } });
  console.log(`Total trades in DB now for ${liveAccount.name}: ${totalTrades}`);

  const updatedAccount = await prisma.tradingAccount.findUnique({
    where: { id: liveAccount.id },
    select: { currentBalance: true, cloudSyncStatus: true, cloudLastSyncedAt: true },
  });
  console.log('Updated Account State:', updatedAccount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
