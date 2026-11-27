const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect } = require('../middleware/authMiddleware');
const { requireAccountTransactionsEnabled } = require('../config/featureFlags');
const {
  getAccountTransactions,
  postAccountTransaction,
  putAccountTransaction,
  postArchiveAccountTransaction,
  postConfirmSyncedPayout,
} = require('../controllers/accountTransactionController');

router.use(protect, requireAccountTransactionsEnabled);

router.route('/')
  .get(getAccountTransactions)
  .post(postAccountTransaction);

router.route('/:transactionId')
  .put(putAccountTransaction)
  .delete(postArchiveAccountTransaction);

router.post('/:transactionId/archive', postArchiveAccountTransaction);
router.post('/:transactionId/confirm-payout', postConfirmSyncedPayout);

module.exports = router;
