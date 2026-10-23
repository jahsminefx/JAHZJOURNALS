const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const {
  getDashboardMetrics,
  getUsers,
  updateUserRole,
  getSystemHealth,
  getAuditLogs,
  testAdminEmail
} = require('../controllers/adminController');

const {
  getSubscriptions,
  getSubscriptionMetrics,
  getSubscriptionDetails,
  updateSubscription,
  updateUserSubscriptionDirect,
  getAdminPayments,
  syncAdminPaystack,
} = require('../controllers/adminSubscriptionController');

const {
  getPromotions,
  getPromotionMetrics,
  getPromotion,
  createPromotion,
  updatePromotion,
  deletePromotion,
  grantPromotion,
  getGranteesByPromotion,
  awardBadge,
  revokeBadge,
  sweepExpiredPromotions
} = require('../controllers/adminPromotionController');


const {
  getAiDashboardMetrics,
  getAiRequests,
  getAiFeatureAnalytics,
  getAiConfig,
  updateAiConfig,
  getAiHealth
} = require('../controllers/adminAiController');

const {
  getSupportDashboard,
  getSupportTickets,
  updateSupportTicket,
  getBugReports,
  updateBugReport,
  getFeatureRequests,
  updateFeatureRequest,
  getInternalUserTimeline,
  createInternalNote
} = require('../controllers/adminCustomerSuccessController');

const {
  getContactMessages,
  getContactThread,
  replyToMessage,
  updateMessageStatus,
  updateMessagePriority,
  updateMessageCategory,
  assignMessage,
  bulkAction
} = require('../controllers/communications/adminContactController');

const {
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} = require('../controllers/communications/adminAnnouncementController');

const {
  getAdminNotifications,
  sendNotification
} = require('../controllers/communications/adminNotificationController');

const {
  getPlatformConfig,
  updatePlatformConfig,
  getPlatformDashboard,
  exportConfig,
  getConfigHistory
} = require('../controllers/adminPlatformController');

const {
  getSystemMetrics,
  getErrorLogs
} = require('../controllers/adminInfrastructureController');

const {
  getExecutiveSummary,
  getTradingIntelligence,
  getAiIntelligence
} = require('../controllers/adminBusinessController');

const {
  getBlogMetrics,
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  updateArticleStatus,
  toggleFeatured,
  deleteArticle,
  uploadCoverImage,
  previewDraft,
  remindUnreadArticles,
} = require('../controllers/adminBlogController');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// ALL admin routes require authentication AND high-level roles
router.use(protect);
router.use(authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'));

// Blog Management (Super Admin & Admin)
router.get('/blog/metrics', authorize('SUPER_ADMIN', 'ADMIN'), getBlogMetrics);
router.get('/blog/articles', authorize('SUPER_ADMIN', 'ADMIN'), getArticles);
router.get('/blog/articles/:id', authorize('SUPER_ADMIN', 'ADMIN'), getArticleById);
router.post('/blog/articles', authorize('SUPER_ADMIN', 'ADMIN'), createArticle);
router.put('/blog/articles/:id', authorize('SUPER_ADMIN', 'ADMIN'), updateArticle);
router.patch('/blog/articles/:id/status', authorize('SUPER_ADMIN', 'ADMIN'), updateArticleStatus);
router.patch('/blog/articles/:id/featured', authorize('SUPER_ADMIN', 'ADMIN'), toggleFeatured);
router.delete('/blog/articles/:id', authorize('SUPER_ADMIN'), deleteArticle);
router.post('/blog/upload-image', authorize('SUPER_ADMIN', 'ADMIN'), upload.single('image'), uploadCoverImage);
router.get('/blog/preview/:id', authorize('SUPER_ADMIN', 'ADMIN'), previewDraft);
router.post('/blog/remind-unread', authorize('SUPER_ADMIN', 'ADMIN'), remindUnreadArticles);

// Analytics & Dashboard
router.get('/dashboard', authorize('SUPER_ADMIN', 'ADMIN'), getDashboardMetrics);

// User Management
router.get('/users', authorize('SUPER_ADMIN', 'ADMIN'), getUsers);
router.patch('/users/:id/role', authorize('SUPER_ADMIN'), updateUserRole);
router.patch('/users/:id/subscription', authorize('SUPER_ADMIN', 'ADMIN'), updateUserSubscriptionDirect);

// System Health & Email Testing
router.get('/health', authorize('SUPER_ADMIN', 'ADMIN'), getSystemHealth);
router.post('/email/test', authorize('SUPER_ADMIN', 'ADMIN'), testAdminEmail);

// Audit Logs
router.get('/audit', authorize('SUPER_ADMIN', 'ADMIN'), getAuditLogs);

// Subscription Management
router.get('/subscriptions', authorize('SUPER_ADMIN', 'ADMIN'), getSubscriptions);
router.get('/subscriptions/metrics', authorize('SUPER_ADMIN', 'ADMIN'), getSubscriptionMetrics);
router.get('/subscriptions/payments', authorize('SUPER_ADMIN', 'ADMIN'), getAdminPayments);
router.post('/subscriptions/sync-paystack', authorize('SUPER_ADMIN', 'ADMIN'), syncAdminPaystack);
router.post('/subscriptions/sweep-expired', authorize('SUPER_ADMIN'), sweepExpiredPromotions);
router.get('/subscriptions/:id', authorize('SUPER_ADMIN', 'ADMIN'), getSubscriptionDetails);
router.put('/subscriptions/:id', authorize('SUPER_ADMIN', 'ADMIN'), updateSubscription);

// Promotion Management
router.get('/promotions', authorize('SUPER_ADMIN', 'ADMIN'), getPromotions);
router.get('/promotions/metrics', authorize('SUPER_ADMIN', 'ADMIN'), getPromotionMetrics);
router.post('/promotions/sweep-expired', authorize('SUPER_ADMIN'), sweepExpiredPromotions);
router.post('/promotions', authorize('SUPER_ADMIN'), createPromotion);
router.get('/promotions/:id', authorize('SUPER_ADMIN', 'ADMIN'), getPromotion);
router.put('/promotions/:id', authorize('SUPER_ADMIN'), updatePromotion);
router.delete('/promotions/:id', authorize('SUPER_ADMIN'), deletePromotion);
router.post('/promotions/grant', authorize('SUPER_ADMIN'), grantPromotion);
router.get('/promotions/:id/grantees', authorize('SUPER_ADMIN', 'ADMIN'), getGranteesByPromotion);
router.post('/badges/award', authorize('SUPER_ADMIN'), awardBadge);
router.post('/badges/revoke', authorize('SUPER_ADMIN'), revokeBadge);

// AI Console Operations Center
router.get('/ai/dashboard', authorize('SUPER_ADMIN', 'ADMIN'), getAiDashboardMetrics);
router.get('/ai/requests', authorize('SUPER_ADMIN', 'ADMIN'), getAiRequests);
router.get('/ai/analytics', authorize('SUPER_ADMIN', 'ADMIN'), getAiFeatureAnalytics);
router.get('/ai/config', authorize('SUPER_ADMIN', 'ADMIN'), getAiConfig);
router.put('/ai/config', authorize('SUPER_ADMIN'), updateAiConfig);
router.get('/ai/health', authorize('SUPER_ADMIN', 'ADMIN'), getAiHealth);

// Customer Success Center
router.get('/support/dashboard', getSupportDashboard);
router.get('/support/tickets', getSupportTickets);
router.put('/support/tickets/:id', updateSupportTicket);
router.get('/support/bugs', getBugReports);
router.put('/support/bugs/:id', updateBugReport);
router.get('/support/features', getFeatureRequests);
router.put('/support/features/:id', updateFeatureRequest);
router.get('/support/timeline', getInternalUserTimeline);
router.post('/support/notes', createInternalNote);

// Platform Configuration Engine (SUPER ADMIN ONLY)
router.get('/platform/dashboard', authorize('SUPER_ADMIN'), getPlatformDashboard);
router.get('/platform/config', authorize('SUPER_ADMIN'), getPlatformConfig);
router.put('/platform/config', authorize('SUPER_ADMIN'), updatePlatformConfig);
router.get('/platform/config/export', authorize('SUPER_ADMIN'), exportConfig);
router.get('/platform/config/history', authorize('SUPER_ADMIN'), getConfigHistory);

// Infrastructure Operations Hub (SUPER ADMIN ONLY)
router.get('/infrastructure/metrics', authorize('SUPER_ADMIN'), getSystemMetrics);
router.get('/infrastructure/logs', authorize('SUPER_ADMIN'), getErrorLogs);

// Business Intelligence & Executive Analytics (CEO Dashboard)
router.get('/business/executive', authorize('SUPER_ADMIN', 'ADMIN'), getExecutiveSummary);
router.get('/business/trading', authorize('SUPER_ADMIN', 'ADMIN'), getTradingIntelligence);
router.get('/business/ai', authorize('SUPER_ADMIN', 'ADMIN'), getAiIntelligence);

const {
  getCampaigns,
  createCampaign,
  sendCampaign,
  deleteCampaign
} = require('../controllers/communications/adminEmailCampaignController');

const {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate
} = require('../controllers/communications/adminTemplateController');

const {
  getAnalytics
} = require('../controllers/communications/adminCommunicationsAnalyticsController');

const {
  getSettings,
  updateSettings,
  testBrevoConnection
} = require('../controllers/communications/adminCommunicationSettingsController');

// Communications Hub
// Contacts
router.get('/communications/contact', authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getContactMessages);
router.get('/communications/contact/:id', authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getContactThread);
router.post('/communications/contact/:id/reply', authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), replyToMessage);
router.patch('/communications/contact/:id/status', authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), updateMessageStatus);
router.patch('/communications/contact/:id/priority', authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), updateMessagePriority);
router.patch('/communications/contact/:id/category', authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), updateMessageCategory);
router.patch('/communications/contact/:id/assign', authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), assignMessage);
router.post('/communications/contact/bulk', authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), bulkAction);

// Email Campaigns
router.get('/communications/emails', authorize('SUPER_ADMIN', 'ADMIN'), getCampaigns);
router.post('/communications/emails', authorize('SUPER_ADMIN', 'ADMIN'), createCampaign);
router.post('/communications/emails/:id/send', authorize('SUPER_ADMIN'), sendCampaign);
router.delete('/communications/emails/:id', authorize('SUPER_ADMIN'), deleteCampaign);

// Message Templates
router.get('/communications/templates', authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getTemplates);
router.post('/communications/templates', authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), createTemplate);
router.put('/communications/templates/:id', authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), updateTemplate);
router.delete('/communications/templates/:id', authorize('SUPER_ADMIN', 'ADMIN'), deleteTemplate);

// Communications Analytics
router.get('/communications/analytics', authorize('SUPER_ADMIN', 'ADMIN'), getAnalytics);

// Communications Settings
router.get('/communications/settings', authorize('SUPER_ADMIN', 'ADMIN'), getSettings);
router.put('/communications/settings', authorize('SUPER_ADMIN'), updateSettings);
router.post('/communications/settings/test-brevo', authorize('SUPER_ADMIN', 'ADMIN'), testBrevoConnection);

// Announcements
router.get('/communications/announcements', authorize('SUPER_ADMIN', 'ADMIN'), getAllAnnouncements);
router.post('/communications/announcements', authorize('SUPER_ADMIN'), createAnnouncement);
router.put('/communications/announcements/:id', authorize('SUPER_ADMIN'), updateAnnouncement);
router.delete('/communications/announcements/:id', authorize('SUPER_ADMIN'), deleteAnnouncement);

// Notifications
router.get('/communications/notifications', authorize('SUPER_ADMIN', 'ADMIN'), getAdminNotifications);
router.post('/communications/notifications', authorize('SUPER_ADMIN', 'ADMIN'), sendNotification);

// Abstraction & Security Gates
const { impersonateUser } = require('../controllers/adminImpersonationController');
router.post('/impersonate/:id', authorize('SUPER_ADMIN'), impersonateUser);

module.exports = router;
