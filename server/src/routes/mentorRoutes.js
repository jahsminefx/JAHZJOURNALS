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
  getStudentEnrolledCohorts,
  leaveCohort,
  inviteStudent,
  getGroupInvitations,
  resendInvitation,
  revokeInvitation,
  getInvitationDetails,
  acceptInvitation,
  getPublicGroupInfo,
  joinGroup,
  checkoutPaidGroup,
  verifyCohortEnrollment,
  getStudentTrades,
  addTradeFeedback,
  replyToTradeFeedback,
  toggleFeedbackResolved,
  deleteTradeFeedback,
  createAssignment,
  getGroupAssignments,
  submitAssignment,
  reviewAssignmentSubmission,
  draftMentorSummary,
  sendMentorSummary,
  getCoachingSummaries,
  getCohortAnalytics,
  getPayoutSettings,
  updatePayoutSettings,
  uploadMentorLogo
} = require('../controllers/mentorController');

// --- Cohort Management (Mentor Workspace) ---
router.post('/groups', protect, requireMentorPlan, createGroup);
router.get('/groups', protect, requireMentorPlan, getMyGroups);
router.put('/groups/:groupId', protect, requireMentorPlan, updateGroup);
router.delete('/groups/:groupId', protect, requireMentorPlan, deleteGroup);
router.delete('/groups/:groupId/students/:studentId', protect, requireMentorPlan, removeStudent);
router.get('/groups/:groupId/analytics', protect, requireMentorPlan, getCohortAnalytics);

// --- Student Cohort Hub (Student-Facing) ---
router.get('/my-cohorts', protect, getStudentEnrolledCohorts);
router.post('/cohorts/:groupId/leave', protect, leaveCohort);

// --- Invitations ---
router.post('/groups/:groupId/invite', protect, requireMentorPlan, inviteStudent);
router.get('/groups/:groupId/invitations', protect, requireMentorPlan, getGroupInvitations);
router.post('/invitations/:invitationId/resend', protect, requireMentorPlan, resendInvitation);
router.post('/invitations/:invitationId/revoke', protect, requireMentorPlan, revokeInvitation);
router.get('/invitations/details/:token', getInvitationDetails);
router.post('/invitations/:token/accept', protect, acceptInvitation);

// --- Public Info & Enrollment ---
router.get('/groups/:groupId/public-info', getPublicGroupInfo);
router.post('/groups/:groupId/join', protect, joinGroup);
router.post('/groups/:groupId/checkout', protect, checkoutPaidGroup);
router.post('/groups/:groupId/verify-enrollment', protect, verifyCohortEnrollment);
router.post('/cohorts/:groupId/verify-enrollment', protect, verifyCohortEnrollment);

// --- Student Journal Review (Protected by requireMentorPlan & Privacy Scoping) ---
router.get('/students/:studentId/trades', protect, requireMentorPlan, getStudentTrades);

// --- Feedback Workflow (Two-Way) ---
router.post('/trades/:tradeId/feedback', protect, requireMentorPlan, addTradeFeedback);
router.post('/trades/:tradeId/feedback/:feedbackId/reply', protect, replyToTradeFeedback);
router.put('/trades/:tradeId/feedback/:feedbackId/resolve', protect, requireMentorPlan, toggleFeedbackResolved);
router.delete('/trades/:tradeId/feedback/:feedbackId', protect, requireMentorPlan, deleteTradeFeedback);

// --- Assignments & Tasks ---
router.post('/groups/:groupId/assignments', protect, requireMentorPlan, createAssignment);
router.get('/groups/:groupId/assignments', protect, getGroupAssignments);
router.post('/assignments/:assignmentId/submit', protect, submitAssignment);
router.post('/assignments/submissions/:submissionId/review', protect, requireMentorPlan, reviewAssignmentSubmission);

// --- Independent Coaching Summaries ---
router.post('/students/:studentId/draft-summary', protect, requireMentorPlan, draftMentorSummary);
router.post('/students/:studentId/send-summary', protect, requireMentorPlan, sendMentorSummary);
router.get('/students/:studentId/coaching-summaries', protect, getCoachingSummaries);

const {
  createTradeShare,
  updateTradeShare,
  deleteTradeShare,
  getMentorTradeShares,
  createAnnouncement,
  getMentorAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
  getStudentFeed,
  getTradeShareDetail,
  logSharedTradeToStudentJournal,
  markFeedItemRead,
  getMyStudentReviews,
  getMyAcademiesOverview,
  getDirectChatThreads,
  getDirectMessages,
  sendDirectMessage
} = require('../controllers/cohortSharingController');

// --- Payout & Branding Settings ---
router.get('/payout-settings', protect, requireMentorPlan, getPayoutSettings);
router.put('/payout-settings', protect, requireMentorPlan, updatePayoutSettings);
router.post('/upload-logo', protect, requireMentorPlan, upload.single('logo'), uploadMentorLogo);

// --- Mentor-to-Cohort Trade Sharing & Announcements (Mentor Workspace) ---
router.post('/cohort-trade-shares', protect, requireMentorPlan, createTradeShare);
router.get('/cohort-trade-shares', protect, requireMentorPlan, getMentorTradeShares);
router.put('/cohort-trade-shares/:id', protect, requireMentorPlan, updateTradeShare);
router.delete('/cohort-trade-shares/:id', protect, requireMentorPlan, deleteTradeShare);

router.post('/cohort-announcements', protect, requireMentorPlan, createAnnouncement);
router.get('/cohort-announcements', protect, requireMentorPlan, getMentorAnnouncements);
router.put('/cohort-announcements/:id', protect, requireMentorPlan, updateAnnouncement);
router.delete('/cohort-announcements/:id', protect, requireMentorPlan, deleteAnnouncement);

// --- Student Academy Hub & Centralized Feeds ---
router.get('/student-feed', protect, getStudentFeed);
router.get('/cohort-trade-shares/:id', protect, getTradeShareDetail);
router.post('/cohort-trade-shares/:id/log-to-journal', protect, logSharedTradeToStudentJournal);
router.post('/feed/:itemType/:itemId/read', protect, markFeedItemRead);
router.get('/my-reviews', protect, getMyStudentReviews);
router.get('/my-academies-overview', protect, getMyAcademiesOverview);

// --- Direct 1-on-1 Mentor <-> Student Coaching Chat ---
router.get('/chat/threads', protect, getDirectChatThreads);
router.get('/groups/:groupId/students/:studentId/messages', protect, getDirectMessages);
router.post('/groups/:groupId/students/:studentId/messages', protect, sendDirectMessage);

module.exports = router;
