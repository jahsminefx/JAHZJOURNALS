const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  requireAdmin,
  getUsers,
  suspendUser,
  getContactMessages,
  resolveContactMessage
} = require('../controllers/adminController');

router.use(protect);
router.use(requireAdmin);

router.get('/users', getUsers);
router.post('/users/:userId/suspend', suspendUser);
router.get('/crm/messages', getContactMessages);
router.post('/crm/messages/:messageId', resolveContactMessage);

module.exports = router;
