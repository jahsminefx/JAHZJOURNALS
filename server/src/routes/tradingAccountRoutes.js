const express = require('express');
const router = express.Router();
const {
  getAccounts,
  createAccount,
  getAccountById,
  updateAccount,
  deleteAccount
} = require('../controllers/tradingAccountController');
const { protect } = require('../middleware/authMiddleware');
const propFirmAccountRoutes = require('./propFirmAccountRoutes');

router.use('/prop-firm', propFirmAccountRoutes);

router.route('/')
  .get(protect, getAccounts)
  .post(protect, createAccount);

router.route('/:id')
  .get(protect, getAccountById)
  .put(protect, updateAccount)
  .delete(protect, deleteAccount);

module.exports = router;
