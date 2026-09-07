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
  disconnectCloudSync,
  getCloudSyncStatus,
} = require('../controllers/mtCloudSyncController');
const { protect } = require('../middleware/authMiddleware');
const { checkAccountLimit } = require('../middleware/subscriptionGate');
const propFirmAccountRoutes = require('./propFirmAccountRoutes');

router.use('/prop-firm', propFirmAccountRoutes);

router.post('/:id/sync-token', protect, generateSyncToken);
router.delete('/:id/sync-token', protect, revokeSyncToken);

router.post('/:id/cloud-sync/connect', protect, connectCloudSync);
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
