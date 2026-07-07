import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './context/useAuth';
import ProtectedRoute from './components/ProtectedRoute';

const Layout = lazy(() => import('./components/Layout'));
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
const TradesList = lazy(() => import('./pages/TradesList'));
const TradeForm = lazy(() => import('./pages/TradeForm'));
const TradeDetail = lazy(() => import('./pages/TradeDetail'));
const RiskCalculator = lazy(() => import('./pages/RiskCalculator'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const WeeklyReview = lazy(() => import('./pages/WeeklyReview'));
const RulesPage = lazy(() => import('./pages/RulesPage'));
const Settings = lazy(() => import('./pages/Settings'));

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

            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<Onboarding />} />
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
                <Route path="/trades" element={<TradesList />} />
                <Route path="/trades/new" element={<TradeForm />} />
                <Route path="/trades/:id/edit" element={<TradeForm />} />
                <Route path="/trades/:id" element={<TradeDetail />} />
                <Route path="/rules" element={<RulesPage />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/risk-calculator" element={<RiskCalculator />} />
                <Route path="/weekly-review" element={<WeeklyReview />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
