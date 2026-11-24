import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { lazyWithRetry } from './utils/chunkRecovery';
import { ThemeProvider } from './context/ThemeProvider';
import { AuthProvider } from './context/AuthProvider';
import { ConsentProvider } from './context/ConsentProvider';
import { OverlayProvider } from './context/OverlayContext';
import { DialogOverlay } from './components/common/dialog/DialogOverlay';
import { useAuth } from './context/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import SharedRouteLayout from './components/SharedRouteLayout';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './pages/admin/AdminLayout';
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard'));
const UserManagement = lazyWithRetry(() => import('./pages/admin/UserManagement'));
const AuditLogs = lazyWithRetry(() => import('./pages/admin/AuditLogs'));
const SubscriptionManagement = lazyWithRetry(() => import('./pages/admin/SubscriptionManagement'));
const PromotionManagement = lazyWithRetry(() => import('./pages/admin/PromotionManagement'));
const FoundingTraderAdmin = lazyWithRetry(() => import('./pages/admin/FoundingTraderAdmin'));
const AiConsole = lazyWithRetry(() => import('./pages/admin/AiConsole'));
const CustomerSuccessDashboard = lazyWithRetry(() => import('./pages/admin/CustomerSuccessDashboard'));
const Support = lazyWithRetry(() => import('./pages/Support'));
const SupportTickets = lazyWithRetry(() => import('./pages/admin/SupportTickets'));
const BugReports = lazyWithRetry(() => import('./pages/admin/BugReports'));
const FeatureRequests = lazyWithRetry(() => import('./pages/admin/FeatureRequests'));
const PlatformSettingsHub = lazyWithRetry(() => import('./pages/admin/PlatformSettingsHub'));
const InfrastructureHub = lazyWithRetry(() => import('./pages/admin/InfrastructureHub'));
const BusinessIntelligenceHub = lazyWithRetry(() => import('./pages/admin/BusinessIntelligenceHub'));
const CommunicationsHub = lazyWithRetry(() => import('./pages/admin/communications/CommunicationsHub'));
const BlogManagement = lazyWithRetry(() => import('./pages/admin/BlogManagement'));
const BlogEditorPage = lazyWithRetry(() => import('./pages/admin/BlogEditorPage'));

const ImpersonationBanner = lazyWithRetry(() => import('./components/ImpersonationBanner'));
const CookieConsentBanner = lazyWithRetry(() => import('./components/CookieConsentBanner'));

import Home from './pages/Home';
import Features from './pages/Features';
import Pricing from './pages/Pricing';
import MentorPricing from './pages/MentorPricing';
import PropFirmTraders from './pages/PropFirmTraders';
import Mentors from './pages/Mentors';
import About from './pages/About';
import Contact from './pages/Contact';
import Legal from './pages/Legal';
import BlogList from './pages/BlogList';
import BlogPost from './pages/BlogPost';
import TradingPsychology from './pages/TradingPsychology';
import RiskManagementPage from './pages/RiskManagementPage';
import RiskCalculator from './pages/RiskCalculator';

const Login = lazyWithRetry(() => import('./pages/Login'));
const Register = lazyWithRetry(() => import('./pages/Register'));
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('./pages/ResetPasswordPage'));
const Onboarding = lazyWithRetry(() => import('./pages/Onboarding'));
const AccountsList = lazyWithRetry(() => import('./pages/AccountsList'));
const AccountForm = lazyWithRetry(() => import('./pages/AccountForm'));
const AccountDetail = lazyWithRetry(() => import('./pages/AccountDetail'));
const PropFirmAccountForm = lazyWithRetry(() => import('./pages/PropFirmAccountForm'));
const PropFirmAdvancedSettingsPage = lazyWithRetry(() => import('./pages/PropFirmAdvancedSettingsPage'));
const TradesList = lazyWithRetry(() => import('./pages/TradesList'));
const QuickTradePage = lazyWithRetry(() => import('./pages/QuickTradePage'));
const TradeReviewPage = lazyWithRetry(() => import('./pages/TradeReviewPage'));
const TradeDetail = lazyWithRetry(() => import('./pages/TradeDetail'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const DailyReviewPage = lazyWithRetry(() => import('./pages/DailyReviewPage'));
const SharedTradePage = lazyWithRetry(() => import('./pages/shared/SharedTradePage'));
const SharedDailyReviewPage = lazyWithRetry(() => import('./pages/shared/SharedDailyReviewPage'));
const Analytics = lazyWithRetry(() => import('./pages/Analytics'));
const WeeklyReview = lazyWithRetry(() => import('./pages/WeeklyReview'));
const EconomicCalendarPage = lazyWithRetry(() => import('./pages/EconomicCalendarPage'));
const RulesPage = lazyWithRetry(() => import('./pages/RulesPage'));
const StrategiesPage = lazyWithRetry(() => import('./pages/StrategiesPage'));
const TradingPlanBuilder = lazyWithRetry(() => import('./pages/TradingPlanBuilder'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));
const NotificationsPage = lazyWithRetry(() => import('./pages/Notifications'));
const PromotionsPage = lazyWithRetry(() => import('./pages/PromotionsPage'));
const PromotionDetailPage = lazyWithRetry(() => import('./pages/PromotionDetailPage'));
const MentorDashboard = lazyWithRetry(() => import('./pages/MentorDashboard'));
const JoinCohortPage = lazyWithRetry(() => import('./pages/JoinCohortPage'));
const StudentCohortsPage = lazyWithRetry(() => import('./pages/StudentCohortsPage'));

const AiHubPage = lazyWithRetry(() => import('./pages/ai/AiHubPage'));
const AiTradeReviewsPage = lazyWithRetry(() => import('./pages/ai/AiTradeReviewsPage'));
const AiWeeklyCoachPage = lazyWithRetry(() => import('./pages/ai/AiWeeklyCoachPage'));
const AiEdgeFinderPage = lazyWithRetry(() => import('./pages/ai/AiEdgeFinderPage'));
const AiTradingPlanPage = lazyWithRetry(() => import('./pages/ai/AiTradingPlanPage'));
const AiPsychologyPage = lazyWithRetry(() => import('./pages/ai/AiPsychologyPage'));
const AiScreenshotsPage = lazyWithRetry(() => import('./pages/ai/AiScreenshotsPage'));
const AskJahzPage = lazyWithRetry(() => import('./pages/ai/AskJahzPage'));
const AiHistoryPage = lazyWithRetry(() => import('./pages/ai/AiHistoryPage'));
const AiUsagePage = lazyWithRetry(() => import('./pages/ai/AiUsagePage'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-muted">
    Loading...
  </div>
);

const RequireOnboarding = ({ children }) => {
  const { user } = useAuth();

  if (user && !user.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

function App() {
  return (
    <ThemeProvider>
      <ConsentProvider>
      <AuthProvider>
        <OverlayProvider>
        <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgb(var(--surface))',
              color: 'rgb(var(--foreground))',
              border: '1px solid rgb(var(--border))',
            },
          }}
        />
        <DialogOverlay />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/shared/trade/:shareToken" element={<SharedTradePage />} />
            <Route path="/shared/daily-review/:shareToken" element={<SharedDailyReviewPage />} />
            <Route path="/join/cohort/:groupId" element={<JoinCohortPage />} />
            <Route path="/cohorts/join/:groupId" element={<JoinCohortPage />} />

            {/* Shared Public/Legal Pages (Accessible to both Anonymous and Authenticated Traders) */}
            <Route element={<SharedRouteLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/features" element={<Features />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/pricing/mentor" element={<MentorPricing />} />
              <Route path="/prop-firm-traders" element={<PropFirmTraders />} />
              <Route path="/mentors" element={<Mentors />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Legal type="terms" />} />
              <Route path="/privacy" element={<Legal type="privacy" />} />
              <Route path="/disclaimer" element={<Legal type="disclaimer" />} />
              <Route path="/cookies" element={<Legal type="cookies" />} />
              <Route path="/refund" element={<Legal type="refund" />} />
              <Route path="/refund-policy" element={<Legal type="refund" />} />
              <Route path="/blog" element={<BlogList />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/trading-psychology" element={<TradingPsychology />} />
              <Route path="/risk-management" element={<RiskManagementPage />} />
              <Route path="/risk-calculator" element={<RiskCalculator />} />
              <Route path="/calendar" element={<EconomicCalendarPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route
                element={(
                  <RequireOnboarding>
                    <Layout />
                  </RequireOnboarding>
                )}
              >
                <Route path="/mentor-workspace" element={<MentorDashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/accounts" element={<AccountsList />} />
                <Route path="/accounts/new" element={<AccountForm />} />
                <Route path="/accounts/prop-firm/new" element={<PropFirmAccountForm />} />
                <Route path="/accounts/:id" element={<AccountDetail />} />
                <Route path="/accounts/:id/edit" element={<AccountForm />} />
                <Route path="/accounts/:id/prop-firm/edit" element={<PropFirmAccountForm />} />
                <Route path="/accounts/:id/prop-firm/edit-account" element={<PropFirmAccountForm editSection="account" />} />
                <Route path="/accounts/:id/prop-firm/edit-challenge-rules" element={<PropFirmAccountForm editSection="challenge" />} />
                <Route path="/accounts/:id/prop-firm/advanced-settings" element={<PropFirmAdvancedSettingsPage />} />
                <Route path="/trades" element={<TradesList />} />
                <Route path="/trades/new" element={<QuickTradePage />} />
                <Route path="/trades/:id/edit" element={<QuickTradePage />} />
                <Route path="/trades/:id/review" element={<TradeReviewPage />} />
                <Route path="/trades/:id" element={<TradeDetail />} />
                <Route path="/rules" element={<RulesPage />} />
                <Route path="/strategies" element={<StrategiesPage />} />
                <Route path="/trading-plan" element={<TradingPlanBuilder />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/weekly-review" element={<WeeklyReview />} />
                <Route path="/daily-review" element={<DailyReviewPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/promotions" element={<PromotionsPage />} />
                <Route path="/promotions/:id" element={<PromotionDetailPage />} />
                <Route path="/student-cohorts" element={<StudentCohortsPage />} />
                <Route path="/my-cohorts" element={<StudentCohortsPage />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/support" element={<Support />} />

                {/* AI Hub Routes */}
                <Route path="/ai" element={<AiHubPage />} />
                <Route path="/ai/trade-reviews" element={<AiTradeReviewsPage />} />
                <Route path="/ai/weekly-coach" element={<AiWeeklyCoachPage />} />
                <Route path="/ai/edge-finder" element={<AiEdgeFinderPage />} />
                <Route path="/ai/trading-plan" element={<AiTradingPlanPage />} />
                <Route path="/ai/psychology" element={<AiPsychologyPage />} />
                <Route path="/ai/screenshots" element={<AiScreenshotsPage />} />
                <Route path="/ai/ask-jahz" element={<AskJahzPage />} />
                <Route path="/ai/history" element={<AiHistoryPage />} />
                <Route path="/ai/usage" element={<AiUsagePage />} />
              </Route>
            </Route>

            <Route path="/admin" element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="audit" element={<AuditLogs />} />
                <Route path="subscriptions" element={<SubscriptionManagement />} />
                <Route path="promotions" element={<PromotionManagement />} />
                <Route path="founding-trader" element={<FoundingTraderAdmin />} />
                <Route path="ai" element={<AiConsole />} />
                <Route path="customer-success" element={<CustomerSuccessDashboard />} />
                <Route path="support" element={<SupportTickets />} />
                <Route path="bugs" element={<BugReports />} />
                <Route path="features" element={<FeatureRequests />} />
                <Route path="platform/:tab?" element={<PlatformSettingsHub />} />
                <Route path="infrastructure" element={<InfrastructureHub />} />
                <Route path="business/:tab?" element={<BusinessIntelligenceHub />} />
                <Route path="analytics" element={<BusinessIntelligenceHub />} />
                <Route path="communications/:tab?" element={<CommunicationsHub />} />
                <Route path="blog" element={<BlogManagement />} />
                <Route path="blog/new" element={<BlogEditorPage />} />
                <Route path="blog/edit/:id" element={<BlogEditorPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
        <Suspense fallback={null}><CookieConsentBanner /></Suspense>
        </Router>
        </OverlayProvider>
      </AuthProvider>
      </ConsentProvider>
    </ThemeProvider>
  );
}

export default App;
