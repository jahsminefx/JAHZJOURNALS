const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { encryptCredential, decryptCredential } = require('../utils/cryptoUtils');
const { provisionCloudAccount, removeCloudAccount } = require('../services/metaApiService');

/**
 * Connect Trading Account via MetaTrader Investor (Viewer) Password Cloud Sync
 * POST /api/accounts/:id/cloud-sync/connect
 */
const connectCloudSync = async (req, res) => {
  try {
    const accountId = req.params.id;
    const { platform, server, login, investorPassword } = req.body;

    if (!platform || !server || !login || !investorPassword) {
      return res.status(400).json({ message: 'Platform, broker server, account login, and investor password are required.' });
    }

    // Verify account ownership
    const account = await prisma.tradingAccount.findFirst({
      where: { id: accountId, userId: req.user.id },
    });

    if (!account) {
      return res.status(404).json({ message: 'Trading account not found.' });
    }

    const cleanServer = String(server).trim();
    const cleanLogin = String(login).trim();
    const cleanPassword = String(investorPassword).trim();
    const cleanPlatform = String(platform).toUpperCase().trim();

    // Provision cloud account instance
    const provisionResult = await provisionCloudAccount({
      platform: cleanPlatform,
      server: cleanServer,
      login: cleanLogin,
      password: cleanPassword,
      accountName: `${account.name} (JahzJournal)`,
    });

    // Encrypt password for secure storage
    const encryptedPassword = encryptCredential(cleanPassword);

    const updatedAccount = await prisma.tradingAccount.update({
      where: { id: accountId },
      data: {
        platform: cleanPlatform,
        brokerName: cleanServer.split('-')[0] || cleanServer,
        cloudSyncEnabled: true,
        cloudSyncStatus: provisionResult.status || 'CONNECTED',
        cloudServer: cleanServer,
        cloudLogin: cleanLogin,
        cloudInvestorPassword: encryptedPassword,
        cloudAccountId: provisionResult.cloudAccountId,
        cloudLastSyncedAt: new Date(),
        cloudError: null,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Cloud MT5 sync connected successfully for ${cleanServer} (${cleanLogin}).`,
      cloudSyncStatus: updatedAccount.cloudSyncStatus,
      cloudServer: updatedAccount.cloudServer,
      cloudLogin: updatedAccount.cloudLogin,
    });
  } catch (error) {
    console.error('Error connecting Cloud MT Sync:', error);
    return res.status(500).json({
      message: error.message || 'Failed to connect Cloud MT Sync. Please check your broker server and investor password.',
    });
  }
};

/**
 * Disconnect Cloud MetaTrader Sync
 * DELETE /api/accounts/:id/cloud-sync/disconnect
 */
const disconnectCloudSync = async (req, res) => {
  try {
    const accountId = req.params.id;

    const account = await prisma.tradingAccount.findFirst({
      where: { id: accountId, userId: req.user.id },
    });

    if (!account) {
      return res.status(404).json({ message: 'Trading account not found.' });
    }

    if (account.cloudAccountId) {
      await removeCloudAccount(account.cloudAccountId);
    }

    const updatedAccount = await prisma.tradingAccount.update({
      where: { id: accountId },
      data: {
        cloudSyncEnabled: false,
        cloudSyncStatus: 'DISCONNECTED',
        cloudAccountId: null,
        cloudServer: null,
        cloudLogin: null,
        cloudInvestorPassword: null,
        cloudError: null,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Cloud MetaTrader Sync disconnected successfully.',
      cloudSyncStatus: updatedAccount.cloudSyncStatus,
    });
  } catch (error) {
    console.error('Error disconnecting Cloud MT Sync:', error);
    return res.status(500).json({ message: 'Could not disconnect Cloud MetaTrader Sync.' });
  }
};

/**
 * Get Cloud Sync Status for Account
 * GET /api/accounts/:id/cloud-sync/status
 */
const getCloudSyncStatus = async (req, res) => {
  try {
    const accountId = req.params.id;

    const account = await prisma.tradingAccount.findFirst({
      where: { id: accountId, userId: req.user.id },
      select: {
        id: true,
        name: true,
        cloudSyncEnabled: true,
        cloudSyncStatus: true,
        cloudServer: true,
        cloudLogin: true,
        cloudLastSyncedAt: true,
        cloudError: true,
      },
    });

    if (!account) {
      return res.status(404).json({ message: 'Trading account not found.' });
    }

    return res.status(200).json(account);
  } catch (error) {
    console.error('Error getting cloud sync status:', error);
    return res.status(500).json({ message: 'Failed to retrieve cloud sync status.' });
  }
};

module.exports = {
  connectCloudSync,
  disconnectCloudSync,
  getCloudSyncStatus,
};
