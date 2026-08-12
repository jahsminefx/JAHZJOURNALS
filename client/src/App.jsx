import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeProvider';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './context/useAuth';
import ProtectedRoute from './components/ProtectedRoute';

const Layout = lazy(() => import('./components/Layout'));
const AdminRoute = lazy(() => import('./components/AdminRoute'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const SubscriptionManagement = lazy(() => import('./pages/admin/SubscriptionManagement'));
const PromotionManagement = lazy(() => import('./pages/admin/PromotionManagement'));
const FoundingTraderAdmin = lazy(() => import('./pages/admin/FoundingTraderAdmin'));
const AiConsole = lazy(() => import('./pages/admin/AiConsole'));
const CustomerSuccessDashboard = lazy(() => import('./pages/admin/CustomerSuccessDashboard'));
const SupportTickets = lazy(() => import('./pages/admin/SupportTickets'));
const BugReports = lazy(() => import('./pages/admin/BugReports'));
const FeatureRequests = lazy(() => import('./pages/admin/FeatureRequests'));
const PlatformSettingsHub = lazy(() => import('./pages/admin/PlatformSettingsHub'));
const InfrastructureHub = lazy(() => import('./pages/admin/InfrastructureHub'));
const BusinessIntelligenceHub = lazy(() => import('./pages/admin/BusinessIntelligenceHub'));
const CommunicationsHub = lazy(() => import('./pages/admin/communications/CommunicationsHub'));

const ImpersonationBanner = lazy(() => import('./components/ImpersonationBanner'));

const Home = lazy(() => import('./pages/Home'));
const Features = lazy(() => import('./pages/Features'));
const Pricing = lazy(() => import('./pages/Pricing'));
const PropFirmTraders = lazy(() => import('./pages/PropFirmTraders'));
const Mentors = lazy(() => import('./pages/Mentors'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const AccountsList = lazy(() => import('./pages/AccountsList'));
const AccountForm = lazy(() => import('./pages/AccountForm'));
const AccountDetail = lazy(() => import('./pages/AccountDetail'));
const PropFirmAccountForm = lazy(() => import('./pages/PropFirmAccountForm'));
const PropFirmAdvancedSettingsPage = lazy(() => import('./pages/PropFirmAdvancedSettingsPage'));
const TradesList = lazy(() => import('./pages/TradesList'));
const QuickTradePage = lazy(() => import('./pages/QuickTradePage'));
const TradeReviewPage = lazy(() => import('./pages/TradeReviewPage'));
const TradeDetail = lazy(() => import('./pages/TradeDetail'));
const RiskCalculator = lazy(() => import('./pages/RiskCalculator'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const WeeklyReview = lazy(() => import('./pages/WeeklyReview'));
const RulesPage = lazy(() => import('./pages/RulesPage'));
const StrategiesPage = lazy(() => import('./pages/StrategiesPage'));
const TradingPlanBuilder = lazy(() => import('./pages/TradingPlanBuilder'));
const Settings = lazy(() => import('./pages/Settings'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const PromotionsPage = lazy(() => import('./pages/PromotionsPage'));
const PromotionDetailPage = lazy(() => import('./pages/PromotionDetailPage'));
const MentorDashboard = lazy(() => import('./pages/MentorDashboard'));
const Legal = lazy(() => import('./pages/Legal'));
const BlogList = lazy(() => import('./pages/BlogList'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const TradingPsychology = lazy(() => import('./pages/TradingPsychology'));
const RiskManagementPage = lazy(() => import('./pages/RiskManagementPage'));

const AiHubPage = lazy(() => import('./pages/ai/AiHubPage'));
const AiTradeReviewsPage = lazy(() => import('./pages/ai/AiTradeReviewsPage'));
const AiWeeklyCoachPage = lazy(() => import('./pages/ai/AiWeeklyCoachPage'));
const AiEdgeFinderPage = lazy(() => import('./pages/ai/AiEdgeFinderPage'));
const AiTradingPlanPage = lazy(() => import('./pages/ai/AiTradingPlanPage'));
const AiPsychologyPage = lazy(() => import('./pages/ai/AiPsychologyPage'));
const AiScreenshotsPage = lazy(() => import('./pages/ai/AiScreenshotsPage'));
const AskJahzPage = lazy(() => import('./pages/ai/AskJahzPage'));
const AiHistoryPage = lazy(() => import('./pages/ai/AiHistoryPage'));
const AiUsagePage = lazy(() => import('./pages/ai/AiUsagePage'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-400">
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
      <AuthProvider>
        <Router>
        <Toaster position="top-right" />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/features" element={<Features />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/prop-firm-traders" element={<PropFirmTraders />} />
            <Route path="/mentors" element={<Mentors />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/terms" element={<Legal type="terms" />} />
            <Route path="/privacy" element={<Legal type="privacy" />} />
            <Route path="/disclaimer" element={<Legal type="disclaimer" />} />
            <Route path="/blog" element={<BlogList />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/trading-psychology" element={<TradingPsychology />} />
            <Route path="/risk-management" element={<RiskManagementPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/mentor-workspace" element={<MentorDashboard />} />
              <Route
                element={(
                  <RequireOnboarding>
                    <Layout />
                  </RequireOnboarding>
                )}
              >
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
                <Route path="/risk-calculator" element={<RiskCalculator />} />
                <Route path="/weekly-review" element={<WeeklyReview />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/promotions" element={<PromotionsPage />} />
                <Route path="/promotions/:id" element={<PromotionDetailPage />} />
                <Route path="/settings" element={<Settings />} />

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
                <Route path="communications/:tab?" element={<CommunicationsHub />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
