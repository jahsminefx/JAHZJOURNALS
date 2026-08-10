const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireMentorPlan } = require('../middleware/subscriptionGate');
const {
  createGroup,
  getMyGroups,
  inviteStudent,
  addTradeFeedback,
  getStudentTrades,
  draftMentorSummary,
  sendMentorSummary
} = require('../controllers/mentorController');

router.post('/groups', protect, requireMentorPlan, createGroup);
router.get('/groups', protect, getMyGroups);
router.post('/groups/:groupId/invite', protect, requireMentorPlan, inviteStudent);
router.post('/trades/:tradeId/feedback', protect, requireMentorPlan, addTradeFeedback);
router.get('/students/:studentId/trades', protect, getStudentTrades);
router.post('/students/:studentId/draft-summary', protect, requireMentorPlan, draftMentorSummary);
router.post('/students/:studentId/send-summary', protect, requireMentorPlan, sendMentorSummary);

module.exports = router;
