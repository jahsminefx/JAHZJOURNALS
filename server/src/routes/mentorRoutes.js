const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createGroup,
  getMyGroups,
  inviteStudent,
  addTradeFeedback,
  getStudentTrades
} = require('../controllers/mentorController');

router.post('/groups', protect, createGroup);
router.get('/groups', protect, getMyGroups);
router.post('/groups/:groupId/invite', protect, inviteStudent);
router.post('/trades/:tradeId/feedback', protect, addTradeFeedback);
router.get('/students/:studentId/trades', protect, getStudentTrades);

module.exports = router;
