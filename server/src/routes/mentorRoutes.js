const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireMentorPlan } = require('../middleware/subscriptionGate');
const upload = require('../middleware/uploadMiddleware');
const {
  createGroup,
  updateGroup,
  getMyGroups,
  deleteGroup,
  removeStudent,
  inviteStudent,
  getPublicGroupInfo,
  joinGroup,
  checkoutPaidGroup,
  getPayoutSettings,
  updatePayoutSettings,
  addTradeFeedback,
  getStudentTrades,
  draftMentorSummary,
  sendMentorSummary,
  uploadMentorLogo
} = require('../controllers/mentorController');

router.post('/groups', protect, requireMentorPlan, createGroup);
router.get('/groups', protect, getMyGroups);
router.put('/groups/:groupId', protect, requireMentorPlan, updateGroup);
router.delete('/groups/:groupId', protect, requireMentorPlan, deleteGroup);
router.post('/groups/:groupId/invite', protect, requireMentorPlan, inviteStudent);
router.delete('/groups/:groupId/students/:studentId', protect, requireMentorPlan, removeStudent);
router.get('/groups/:groupId/public-info', getPublicGroupInfo);
router.post('/groups/:groupId/join', protect, joinGroup);
router.post('/groups/:groupId/checkout', protect, checkoutPaidGroup);
router.get('/payout-settings', protect, requireMentorPlan, getPayoutSettings);
router.put('/payout-settings', protect, requireMentorPlan, updatePayoutSettings);
router.post('/upload-logo', protect, requireMentorPlan, upload.single('logo'), uploadMentorLogo);
router.post('/trades/:tradeId/feedback', protect, requireMentorPlan, addTradeFeedback);
router.get('/students/:studentId/trades', protect, getStudentTrades);
router.post('/students/:studentId/draft-summary', protect, requireMentorPlan, draftMentorSummary);
router.post('/students/:studentId/send-summary', protect, requireMentorPlan, sendMentorSummary);

module.exports = router;
