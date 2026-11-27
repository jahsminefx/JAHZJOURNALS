const express = require('express');
const router = express.Router();
const {
  getAccounts,
  createAccount,
  getAccountById,
  updateAccount,
  deleteAccount
} = require('../controllers/tradingAccountController');
const {
  generateSyncToken,
  revokeSyncToken,
} = require('../controllers/mtSyncController');
const {
  connectCloudSync,
  autoConnectCloudSync,
  syncCloudTradesNow,
  disconnectCloudSync,
  getCloudSyncStatus,
} = require('../controllers/mtCloudSyncController');
const { protect } = require('../middleware/authMiddleware');
const { checkAccountLimit, checkMt5SyncAllowed } = require('../middleware/subscriptionGate');
const { requireAccountTransactionsEnabled } = require('../config/featureFlags');
const {
  getTransactionsFeatureStatus,
  getGlobalTransactions,
} = require('../controllers/accountTransactionController');
const accountTransactionRoutes = require('./accountTransactionRoutes');
const propFirmAccountRoutes = require('./propFirmAccountRoutes');

router.use('/prop-firm', propFirmAccountRoutes);

// Account Transactions global endpoints (must be registered before '/:id')
router.get('/transactions/status', protect, getTransactionsFeatureStatus);
router.get('/transactions', protect, requireAccountTransactionsEnabled, getGlobalTransactions);

// 1-Click Auto-Connect & Auto-Create Trading Account directly from MetaTrader
router.post('/cloud-sync/auto-connect', protect, checkAccountLimit, checkMt5SyncAllowed, autoConnectCloudSync);

router.use('/:accountId/transactions', accountTransactionRoutes);

router.post('/:id/sync-token', protect, checkMt5SyncAllowed, generateSyncToken);
router.delete('/:id/sync-token', protect, revokeSyncToken);

router.post('/:id/cloud-sync/connect', protect, checkMt5SyncAllowed, connectCloudSync);
router.post('/:id/cloud-sync/sync-now', protect, checkMt5SyncAllowed, syncCloudTradesNow);
router.delete('/:id/cloud-sync/disconnect', protect, disconnectCloudSync);
router.get('/:id/cloud-sync/status', protect, getCloudSyncStatus);

router.route('/')
  .get(protect, getAccounts)
  .post(protect, checkAccountLimit, createAccount);

router.route('/:id')
  .get(protect, getAccountById)
  .put(protect, updateAccount)
  .delete(protect, deleteAccount);

module.exports = router;
