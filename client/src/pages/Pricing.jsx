import React, { useState, useEffect } from 'react';
import { Check, Minus, Globe, Shield, Sparkles, Brain, Eye, TrendingUp, Bot, FileText, ArrowRight, Lock, ExternalLink } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PricingCard from '../components/PricingCard';
import FAQItem from '../components/FAQItem';
import CTASection from '../components/CTASection';
import FoundingTraderBadge from '../components/FoundingTraderBadge';
import Button from '../components/Button';
import { useAuth } from '../context/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';

const REGIONAL_CONFIG = {
  NG: {
    region: 'NG',
    label: 'Nigeria & Regional Corridors',
    badge: '🇳🇬 NGN (Paystack)',
    currencySymbol: '₦',
    gatewayNote: 'Billed in Nigerian Naira (NGN) via Paystack. Supports local debit cards (Mastercard, Visa, Verve), instant bank transfers, and USSD.',
    plans: [
      {
        id: 'price_ngn_free',
        planKey: 'FREE',
        name: 'Free',
        tagline: 'Build the habit.',
        price: '₦0',
        numericPrice: 0,
        description: 'Designed for beginner traders starting out with basic trade logging and habit formation.',
        targetAudience: 'Start journaling and understand basic performance.',
        limits: ['20 trades / month', '1 trading account', '1 screenshot per trade', '2 AI trial reviews'],
        features: [
          'Manual trade entry & execution notes',
          'Basic equity curve & P&L stats',
          'Position-size risk calculator',
          'Weekly review template',
          'Multi-currency account display (USD/NGN)',
          'Full mobile & PWA responsive access',
        ],
      },
      {
        id: 'price_ngn_starter_monthly',
        planKey: 'STARTER',
        name: 'Starter',
        tagline: 'Build discipline.',
        price: '₦4,000',
        numericPrice: 4000,
        description: 'Designed for active retail traders tracking emotions, session execution, and rule discipline.',
        targetAudience: 'Record more trades and identify recurring mistakes.',
        limits: ['100 trades / month', '3 trading accounts', '3 screenshots per trade'],
        features: [
          'All Free plan capabilities',
          'Weekly AI coaching summaries',
          'Trading psychology & emotion tracking',
          'Rule violation & mistake tagging',
          'Session analysis (London, NY, Asian)',
          'Strategy & setup performance tracking',
          'Detailed trade filtering & export',
        ],
      },
      {
        id: 'price_ngn_pro_monthly',
        planKey: 'PRO',
        name: 'Pro',
        tagline: 'Find your edge.',
        price: '₦8,500',
        numericPrice: 8500,
        highlighted: true,
        badgeText: 'Best for Serious Traders',
        badgeVariant: 'emerald',
        description: 'The comprehensive journal for serious traders and prop-firm candidates preparing for funded evaluations.',
        targetAudience: 'Analyse performance in greater depth and manage prop-firm risk.',
        limits: ['Unlimited trades / month', 'Unlimited trading accounts', '10 screenshots per trade'],
        features: [
          'All Starter plan capabilities',
          'Log Trades with JAHZ AI (300 trades/month)',
          'Prop-firm challenge tracker & drawdown guards',
          'AI Trade Review (150 reviews/month)',
          'Weekly AI coaching summaries',
          'Screenshot Vision setup extraction',
          'JAHZ Edge Finder statistical analytics',
          'PDF performance report exports',
        ],
      },
      {
        id: 'price_ngn_starter_sync_monthly',
        planKey: 'STARTER_SYNC',
        name: 'Starter Sync',
        tagline: 'Automate your core accounts.',
        price: '₦38,000',
        numericPrice: 38000,
        highlighted: false,
        badgeText: 'Early Access • Jan 2027',
        badgeVariant: 'sky',
        description: 'Full Pro features plus automated MetaTrader 4/5 Cloud Sync for up to 2 active trading accounts.',
        targetAudience: 'Automate trade journaling for your personal and primary funded account.',
        limits: ['Automated MT4/MT5 Cloud Sync (2 accounts)', 'Unlimited trades & manual accounts', '10 screenshots per trade'],
        features: [
          'All Pro plan capabilities',
          'Automated MetaTrader (MT4/MT5) Cloud Sync (2 accounts)',
          'Log Trades with JAHZ AI (300 trades/month)',
          'Instant trade ingestion on broker close',
          'Prop-firm real-time drawdown monitoring',
          'Automated balance & equity sync',
        ],
        isWaitlist: true,
      },
      {
        id: 'price_ngn_pro_sync_monthly',
        planKey: 'PRO_SYNC',
        name: 'Pro Sync',
        tagline: 'Automate your journal with power.',
        price: '₦72,000',
        numericPrice: 72000,
        highlighted: false,
        badgeText: 'Early Access • Jan 2027',
        badgeVariant: 'sky',
        description: 'Everything in Pro plus automated MetaTrader 4/5 Cloud Sync for up to 5 trading accounts with priority processing.',
        targetAudience: 'Engineered for multi-funded prop traders managing multiple evaluation and live accounts.',
        limits: ['Priority MT4/MT5 Cloud Sync (Up to 5 accounts)', 'Unlimited trades & manual accounts', '10 screenshots per trade'],
        features: [
          'All Starter Sync capabilities',
          'Up to 5 synced MetaTrader (MT4/MT5) accounts',
          'Log Trades with JAHZ AI (Unlimited)',
          'Priority 1-minute cloud sync polling',
          'Multi-broker aggregated risk dashboard',
          'Priority VIP support & direct channel',
        ],
        isWaitlist: true,
      },
    ],
  },
  GLOBAL: {
    region: 'GLOBAL',
    label: 'International & Global Markets',
    badge: '🌍 USD Reference Pricing (Coming Soon)',
    currencySymbol: '$',
    gatewayNote: 'Listed prices ($12, $27, $32) represent our approved international reference pricing. Active international payment rails are currently in preparation. Select Nigeria & Africa (NGN) to subscribe immediately via Paystack.',
    plans: [
      {
        id: 'price_usd_free',
        planKey: 'FREE',
        name: 'Free',
        tagline: 'Build the habit.',
        price: '$0',
        numericPrice: 0,
        description: 'Designed for beginner traders starting out with basic trade logging and habit formation.',
        targetAudience: 'Start journaling and understand basic performance.',
        limits: ['20 trades / month', '1 trading account', '1 screenshot per trade', '2 AI trial reviews'],
        features: [
          'Manual trade entry & execution notes',
          'Basic equity curve & P&L stats',
          'Position-size risk calculator',
          'Weekly review template',
          'Multi-currency account display',
          'Full mobile & PWA access',
        ],
      },
      {
        id: 'price_usd_starter_monthly',
        planKey: 'STARTER',
        name: 'Starter',
        tagline: 'Reference Pricing',
        price: '$12',
        numericPrice: 12,
        description: 'Entry-level paid plan designed for active traders tracking emotions, mistakes, and execution.',
        targetAudience: 'Best for active traders logging multiple trades weekly seeking to eliminate repeat mistakes.',
        limits: ['100 trades / month', '3 trading accounts', '3 screenshots per trade'],
        features: [
          'All Free plan capabilities',
          'Weekly AI coaching summaries',
          'Trading psychology & emotion tracking',
          'Rule violation & mistake tracking',
          'Strategy & setup performance tracking',
          'Session analysis (London, NY, Asian)',
          'Detailed trade analytics & filters',
        ],
      },
      {
        id: 'price_usd_pro_sync_monthly',
        planKey: 'PRO_SYNC',
        name: 'Pro Sync',
        tagline: 'Reference Pricing • Recommended',
        price: '$27',
        numericPrice: 27,
        highlighted: true,
        badgeText: 'Reference Pricing',
        badgeVariant: 'sky',
        description: 'Paid plan with automated MT4/MT5 live sync, prop-firm challenge tracking, and AI reviews.',
        targetAudience: 'Best for serious traders wanting automated MetaTrader cloud sync and prop-firm risk monitoring.',
        limits: ['Automated 24/7 Cloud Sync', 'Unlimited trades / accounts', '10 screenshots per trade'],
        features: [
          'All Starter plan capabilities',
          'Automated MetaTrader (MT4/MT5) Cloud Sync',
          'Log Trades with JAHZ AI (Unlimited)',
          'AI Trade Review & AI Coach',
          'Prop-firm challenge tracker & drawdown guards',
          'Expectancy, profit factor & drawdown metrics',
          'Emotion vs profitability analysis',
          'PDF performance report exports',
        ],
      },
      {
        id: 'price_usd_elite_monthly',
        planKey: 'ELITE',
        name: 'Elite',
        tagline: 'Reference Pricing • Highest Tier',
        price: '$32',
        numericPrice: 32,
        badgeText: 'Highest Tier',
        badgeVariant: 'muted',
        description: 'Highest individual tier with priority cloud sync, expanded AI quota, unlimited screenshots, and dedicated support.',
        targetAudience: 'Best for institutional and high-volume individual traders requiring priority sync and unlimited visual storage.',
        limits: ['Priority 24/7 Cloud Sync', 'Unlimited trades / accounts', 'Unlimited screenshots'],
        features: [
          'All Pro Sync plan capabilities',
          'Priority MT4/MT5 sync frequency',
          'Expanded AI monthly allowance (500 reviews/mo)',
          'JAHZ Edge Finder quantitative analytics',
          'Unlimited screenshots per trade',
          'Multi-device priority session sync',
          'VIP priority support desk',
        ],
      },
    ],
  },
};

const featureMatrixCategories = [
  {
    category: 'Core Journaling Limits',
    rows: [
      { feature: 'Monthly Trade Log Quota', free: '20 trades / mo', starter: '100 trades / mo', pro: 'Unlimited', starterSync: 'Unlimited', proSync: 'Unlimited' },
      { feature: 'Active Trading Accounts (Manual)', free: '1 account', starter: '3 accounts', pro: 'Unlimited', starterSync: 'Unlimited', proSync: 'Unlimited' },
      { feature: 'Automated MT4/MT5 Cloud Synced Accounts', free: 'Not included', starter: 'Not included', pro: 'Not included', starterSync: 'Up to 2 accounts', proSync: 'Up to 5 accounts (Priority)' },
      { feature: 'Screenshots per Trade', free: '1 screenshot', starter: '3 screenshots', pro: '10 screenshots', starterSync: '10 screenshots', proSync: '10 screenshots' },
      { feature: 'Account Deposit Currencies', free: 'USD, NGN, GBP, EUR', starter: 'USD, NGN, GBP, EUR', pro: 'Normalized Multi-Currency', starterSync: 'Normalized Multi-Currency', proSync: 'Normalized Multi-Currency' },
      { feature: 'CSV Broker Statement Import', free: 'Included', starter: 'Included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'Position-Size Risk Calculator', free: 'Included', starter: 'Included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'Economic News Calendar', free: 'Included', starter: 'Included', pro: 'Included (Auto-Correlation)', starterSync: 'Included (Auto-Correlation)', proSync: 'Included (Auto-Correlation)' },
      { feature: 'Structured Weekly Review', free: 'Included', starter: 'Included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
    ],
  },
  {
    category: 'Execution & Psychology Analytics',
    rows: [
      { feature: 'Basic Equity Curve & P&L', free: 'Included', starter: 'Included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'Trading Psychology & Emotion Tracking', free: 'Not included', starter: 'Included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'Rule Violations & Mistake Tagging', free: 'Included', starter: 'Included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'Session Analytics (London, NY, Asian)', free: 'Not included', starter: 'Included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'Strategy & Setup Performance Matrix', free: 'Not included', starter: 'Included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'Expectancy & Profit Factor Analytics', free: 'Basic', starter: 'Detailed', pro: 'Advanced Quantitative', starterSync: 'Advanced Quantitative', proSync: 'Advanced Quantitative' },
    ],
  },
  {
    category: 'Prop Firm Cockpit & Reporting',
    rows: [
      { feature: 'Prop-Firm Challenge Tracker', free: 'Not included', starter: 'Not included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'Daily & Overall Drawdown Guards', free: 'Not included', starter: 'Not included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'Remaining Risk Allowance Engine', free: 'Not included', starter: 'Not included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'Prop-Firm News Restriction Buffers', free: 'Not included', starter: 'Not included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'PDF Performance Report Export', free: 'Not included', starter: 'Not included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
    ],
  },
  {
    category: 'MetaTrader Automation & AI Intelligence',
    rows: [
      { feature: 'Automated 24/7 MT4/MT5 Cloud Sync', free: 'Not included', starter: 'Not included', pro: 'Not included', starterSync: 'Included (2 Accounts)', proSync: 'Included (5 Accounts)' },
      { feature: 'Cloud Sync Engine Priority', free: 'Not included', starter: 'Not included', pro: 'Not included', starterSync: 'Standard Sync Engine', proSync: 'Priority High-Speed Engine' },
      { feature: 'Log Trades with JAHZ AI (Chat & Screenshots)', free: 'Not included', starter: 'Not included', pro: '300 trades / mo', starterSync: 'Unlimited', proSync: 'Unlimited' },
      { feature: 'AI Trade Review & Mistake Detection', free: '2 trial reviews', starter: 'Not included', pro: '150 reviews / mo', starterSync: '150 reviews / mo', proSync: '200 reviews / mo' },
      { feature: 'Weekly AI Coaching Summaries', free: 'Not included', starter: 'Included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'Screenshot Vision Setup Extraction', free: 'Not included', starter: 'Not included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'JAHZ Edge Finder Analytics', free: 'Not included', starter: 'Not included', pro: 'Included', starterSync: 'Included', proSync: 'Included' },
      { feature: 'Natural Language Journal Assistant', free: 'Not included', starter: '20 drafts / mo', pro: '100 drafts / mo', starterSync: '100 drafts / mo', proSync: '100 drafts / mo' },
    ],
  },
];


const faqs = [
  [
    'Can I start for free?',
    'Yes! The Free plan allows you to log up to 20 trades per month with 1 trading account and 1 screenshot per trade. You also receive 2 complimentary AI trade reviews to experience our analysis tools firsthand. It is completely free with no expiration date.',
  ],
  [
    'Do I need a payment card to sign up?',
    'No. Creating a Free account requires only your name, email, and password. No credit card, debit card, or payment details of any kind are requested.',
  ],
  [
    'What happens when I reach a trade or AI limit?',
    'Your existing journal entries, statistics, and reports remain 100% accessible and safe. If you reach your monthly limit (20 trades on Free, 100 on Starter), you can either wait until your calendar quota resets on the 1st of the next month, or upgrade to a higher tier for immediate additional capacity.',
  ],
  [
    'Can I cancel a paid subscription?',
    'Yes, absolutely. You can cancel your subscription at any time directly from your Account Billing settings with one click. Upon cancellation, you will retain full paid access until the end of your current prepaid billing cycle, after which your account will smoothly transition to the Free tier without losing any past trade data.',
  ],
  [
    'What happens to my data if I downgrade?',
    'All your past trades, attached chart screenshots, analytics history, and review notes remain permanently saved in your account. If your account count or screenshot numbers exceed the lower tier\'s limits, existing data is preserved in read-only format; you simply cannot add new records beyond the tier\'s active limits until upgraded.',
  ],
  [
    'Does JAHZJOURNALS support MT4/MT5 synchronization?',
    'Yes, automated cloud synchronization is powered via MetaApi to automatically ingest trades from your MetaTrader 4 and 5 broker accounts. Cloud sync is available in two plans: Starter Sync (up to 2 accounts at ₦38,000/mo) and Pro Sync (up to 5 accounts with priority processing at ₦72,000/mo).',
  ],
  [
    'Which payment methods are supported?',
    'We accept all Nigerian bank debit cards (Mastercard, Visa, and Verve), instant bank transfers, and USSD via our secured Paystack integration. All transactions are processed in Nigerian Naira (NGN) with 256-bit bank-grade encryption.',
  ],
  [
    'Are international USD payments available yet?',
    'Currently, active subscription checkout is processed in Nigerian Naira (NGN) via Paystack. International billing in US Dollars (USD) via global card networks (Stripe) is undergoing configuration and will be activated once merchant banking rails are finalized. International reference prices ($12, $27, $32) are displayed for transparency.',
  ],
  [
    'Is JAHZJOURNALS a broker or financial adviser?',
    'No. JAHZJOURNALS is strictly a performance tracking, analytics, and trade journaling software platform. We do not accept deposits, execute live market orders, hold client funds, or provide financial, investment, or trading advice. Our mission is to help you measure and understand your own execution discipline.',
  ],
];

const Pricing = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const REGION_STORAGE_KEY = 'jahz_pricing_region_override';

  // Development-only pricing preview parameters:
  // /pricing?previewRegion=nigeria
  // /pricing?previewRegion=international
  // Strictly restricted to development environments (import.meta.env.DEV).
  // Automatically ignored in production builds.
  const [devPreviewActive, setDevPreviewActive] = useState(() => {
    if (!import.meta.env.DEV) return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('previewRegion')?.toLowerCase()?.trim();
      if (raw === 'nigeria') return 'nigeria';
      if (raw === 'international') return 'international';
      return null;
    } catch {
      return null;
    }
  });

  const [hasManualOverride, setHasManualOverride] = useState(() => {
    try {
      // Clean up any legacy permanent localStorage overrides so temporary VPNs never stick
      localStorage.removeItem(REGION_STORAGE_KEY);
      return Boolean(sessionStorage.getItem(REGION_STORAGE_KEY));
    } catch {
      return false;
    }
  });

  const [detectedCountryCode, setDetectedCountryCode] = useState(null);
  const [isVpnDetected, setIsVpnDetected] = useState(false);
  const [isDetectionFallback, setIsDetectionFallback] = useState(false);

  const [selectedRegion, setSelectedRegion] = useState(() => {
    // 0. Development-only preview parameter (DEV mode only, presentation preview)
    if (import.meta.env.DEV) {
      try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('previewRegion')?.toLowerCase()?.trim();
        if (raw === 'nigeria') return 'NG';
        if (raw === 'international') return 'GLOBAL';
      } catch {}
    }

    // 1. Session override takes precedence for this browser tab/session (never persistent indefinitely)
    try {
      const saved = sessionStorage.getItem(REGION_STORAGE_KEY);
      if (saved === 'NG' || saved === 'GLOBAL') return saved;
    } catch {}

    // 2. Authenticated user preference
    if (user?.billingCountry) {
      return ['NG', 'GH', 'KE', 'ZA'].includes(user.billingCountry) ? 'NG' : 'GLOBAL';
    }

    // 3. Safe initial baseline: Nigeria
    return 'NG';
  });

  const [promoCode, setPromoCode] = useState('');
  const [redeemingPromo, setRedeemingPromo] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [activePublicPromo, setActivePublicPromo] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(null);

  const [waitlistCounts, setWaitlistCounts] = useState({
    PRO_SYNC: { count: 186 },
    MENTOR_MEGA: { count: 43 }
  });

  useEffect(() => {
    api.get('/waitlist/counts')
      .then(res => { if (res.data) setWaitlistCounts(res.data); })
      .catch(() => {});
  }, []);


  const handleDevSwitchPreview = (targetPreview) => {
    if (!import.meta.env.DEV) return;
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('previewRegion', targetPreview);
    window.history.replaceState({}, '', newUrl.toString());
    setDevPreviewActive(targetPreview);
    setSelectedRegion(targetPreview === 'nigeria' ? 'NG' : 'GLOBAL');
  };

  const handleExitDevPreview = () => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('previewRegion');
    window.history.replaceState({}, '', newUrl.toString());
    setDevPreviewActive(null);
    handleResetToDetected();
  };

  const handleManualRegionOverride = async (targetRegion) => {
    if (targetRegion !== 'NG' && targetRegion !== 'GLOBAL') return;
    setSelectedRegion(targetRegion);

    // If dev preview is active, update URL and state without persisting to storage or backend profile
    if (devPreviewActive && import.meta.env.DEV) {
      const previewName = targetRegion === 'NG' ? 'nigeria' : 'international';
      setDevPreviewActive(previewName);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('previewRegion', previewName);
      window.history.replaceState({}, '', newUrl.toString());
      toast.success(`Switched dev preview to ${targetRegion === 'NG' ? 'Nigeria (NGN)' : 'International (USD)'}`);
      return;
    }

    setHasManualOverride(true);
    try {
      sessionStorage.setItem(REGION_STORAGE_KEY, targetRegion);
      localStorage.removeItem(REGION_STORAGE_KEY);
    } catch {}

    if (user) {
      api.post('/subscriptions/region', {
        country: targetRegion === 'NG' ? 'NG' : 'US',
        currency: targetRegion === 'NG' ? 'NGN' : 'USD',
      }).catch(() => {});
    }

    toast.success(
      targetRegion === 'NG'
        ? 'Switched to Nigerian pricing (NGN)'
        : 'Switched to International reference pricing (USD)'
    );
  };

  const handleResetToDetected = () => {
    try {
      sessionStorage.removeItem(REGION_STORAGE_KEY);
      localStorage.removeItem(REGION_STORAGE_KEY);
    } catch {}
    setHasManualOverride(false);

    const isPreviewActive = Boolean(import.meta.env.DEV && devPreviewActive);
    const catalogueUrl = isPreviewActive
      ? `/subscriptions/pricing-catalogue?previewRegion=${encodeURIComponent(devPreviewActive)}`
      : '/subscriptions/pricing-catalogue';

    api.get(catalogueUrl)
      .then(({ data }) => {
        if (data?.detectedCountry) {
          setDetectedCountryCode(data.detectedCountry);
        }
        if (data?.isVpnDetected !== undefined) {
          setIsVpnDetected(Boolean(data.isVpnDetected));
        }
        if (data?.isFallback !== undefined) {
          setIsDetectionFallback(Boolean(data.isFallback));
        }
        const autoRegion = data?.region === 'GLOBAL' ? 'GLOBAL' : 'NG';
        setSelectedRegion(autoRegion);
        toast.success(`Reset to auto-detected region (${autoRegion === 'NG' ? 'Nigeria' : 'International'})`);
      })
      .catch(() => {
        setSelectedRegion('NG');
      });
  };

  const handleRedeemCode = async (e) => {
    if (e) e.preventDefault();
    const codeToTest = (promoCode || '').trim();
    if (!codeToTest) return toast.error('Please enter a promo code');

    try {
      setRedeemingPromo(true);
      const { data } = await api.post('/promotions/redeem-code', { code: codeToTest });
      
      if (data.type === 'PERCENTAGE_DISCOUNT') {
        setAppliedPromo({
          code: data.code || codeToTest,
          discountPercent: data.discountPercent || 50,
          applicablePlans: data.applicablePlans || [data.planGranted],
          promotion: data.promotion,
          isAutomatic: false
        });
        toast.success(data.message || `🎉 ${data.discountPercent}% discount code applied!`);
      } else {
        toast.success(data.message || 'Promo code redeemed!');
        setPromoCode('');
        await refreshUser();
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid or expired promo code.');
    } finally {
      setRedeemingPromo(false);
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const reference = searchParams.get('reference') || searchParams.get('trxref') || searchParams.get('session_id');
    const promoParam = searchParams.get('promo') || searchParams.get('code');

    if (reference) {
      api.get(`/subscriptions/verify/${encodeURIComponent(reference)}`)
        .then(async ({ data }) => {
          await refreshUser();
          toast.success(data.message || 'Subscription activated successfully!');
          navigate('/dashboard', { replace: true });
        })
        .catch((err) => {
          console.error('Verification error:', err);
          toast.error(err.response?.data?.message || 'Payment verification failed.');
        });
    }

    // Automatic country-level and VPN detection from server infrastructure
    const manualSaved = (() => {
      try {
        return sessionStorage.getItem(REGION_STORAGE_KEY);
      } catch {
        return null;
      }
    })();

    const isPreviewActive = Boolean(import.meta.env.DEV && devPreviewActive);
    const catalogueUrl = isPreviewActive
      ? `/subscriptions/pricing-catalogue?previewRegion=${encodeURIComponent(devPreviewActive)}`
      : '/subscriptions/pricing-catalogue';

    api.get(catalogueUrl)
      .then(({ data }) => {
        if (data?.detectedCountry) {
          setDetectedCountryCode(data.detectedCountry);
        }
        if (data?.isVpnDetected !== undefined) {
          setIsVpnDetected(Boolean(data.isVpnDetected));
        }
        if (data?.isFallback !== undefined) {
          setIsDetectionFallback(Boolean(data.isFallback));
        }
        // If visitor is NOT in dev preview and has not set a manual session override, adopt auto-detected region smoothly
        if (!isPreviewActive && !manualSaved && data?.region) {
          const autoRegion = data.region === 'GLOBAL' ? 'GLOBAL' : 'NG';
          setSelectedRegion((prev) => (prev !== autoRegion ? autoRegion : prev));
        }
      })
      .catch((err) => {
        // Safe default stays 'NG' on network or detection failure
        console.debug('Country/VPN detection fallback to default NG:', err);
      });

    // Fetch active public promotion (e.g. 50% Off)
    api.get('/promotions/public-active')
      .then(({ data }) => {
        if (data && data.active && data.promotion) {
          setActivePublicPromo(data.promotion);
          if (!promoParam) {
            setAppliedPromo({
              code: data.promotion.slug,
              discountPercent: data.promotion.discountPercent || 50,
              applicablePlans: data.promotion.applicablePlans || [data.promotion.planGranted],
              promotion: data.promotion,
              isAutomatic: true
            });
          }
        }
      })
      .catch(() => {});

    if (promoParam) {
      setPromoCode(promoParam);
      api.get(`/promotions/${encodeURIComponent(promoParam)}`)
        .then(({ data }) => {
          if (data && (data.discountType === 'PERCENTAGE_DISCOUNT' || data.discountPercent)) {
            setAppliedPromo({
              code: data.slug || promoParam,
              discountPercent: data.discountPercent || 50,
              applicablePlans: data.applicablePlans || [data.planGranted],
              promotion: data,
              isAutomatic: false
            });
            toast.success(`🎉 Promo '${data.name}' active! ${data.discountPercent || 50}% off applied.`);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Countdown timer effect
  useEffect(() => {
    const promoTarget = activePublicPromo || appliedPromo?.promotion;
    if (!promoTarget?.endsAt) {
      setTimeLeft(null);
      return;
    }

    const calcTime = () => {
      const diff = new Date(promoTarget.endsAt).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        expired: false
      });
    };

    calcTime();
    const interval = setInterval(calcTime, 1000);
    return () => clearInterval(interval);
  }, [activePublicPromo?.endsAt, appliedPromo?.promotion?.endsAt]);

  const handleProSyncWaitlist = async (targetTier = 'PRO_SYNC') => {
    let emailToUse = user?.email;
    if (!emailToUse) {
      const tierLabel = targetTier === 'STARTER_SYNC' ? 'Starter Sync' : 'Pro Sync';
      const input = window.prompt(`Enter your email to reserve your spot on the ${tierLabel} early-access waitlist:`);
      if (!input || !input.includes('@')) return;
      emailToUse = input.trim();
    }

    try {
      const res = await api.post('/waitlist/join', {
        tier: targetTier,
        email: emailToUse,
        name: user?.name || 'Trader'
      });
      toast.success(res.data.message || "🎉 You're on the early-access list!", { duration: 6000 });
      if (res.data.count) {
        setWaitlistCounts(prev => ({
          ...prev,
          [targetTier]: { ...(prev[targetTier] || {}), count: res.data.count },
          PRO_SYNC: { ...(prev.PRO_SYNC || {}), count: res.data.count }
        }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to join waitlist');
    }
  };

  const handleUpgrade = async (planItem) => {
    if (!planItem || planItem.planKey === 'FREE') return;

    if (planItem.isWaitlist) {
      handleProSyncWaitlist(planItem.planKey);
      return;
    }

    if (selectedRegion === 'GLOBAL') {
      toast.error('International USD checkout is currently in preparation. Please switch to Nigeria (NGN) to subscribe via Paystack.');
      return;
    }

    try {
      setLoadingPlan(planItem.id || planItem.planKey);
      const payload = {
        priceId: planItem.id,
        plan: planItem.planKey,
        country: 'NG',
      };
      if (appliedPromo?.code) {
        payload.promoCode = appliedPromo.code;
      }
      const { data } = await api.post('/subscriptions/initialize', payload);
      await refreshUser();
      
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        toast.success(data.message || `Upgraded to ${planItem.name} successfully!`);
        navigate('/dashboard');
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Upgrade failed.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const planRank = {
    FREE: 1,
    STARTER: 2,
    PRO: 3,
    STARTER_SYNC: 4,
    SYNC_PLUS: 4,
    PRO_SYNC: 5,
    ELITE: 6,
    MENTOR: 7,
  };

  const userPlanKey = (user?.subscriptionPlan || 'FREE').toUpperCase();
  const userRank = planRank[userPlanKey] || 1;

  const currentRegionalConfig = REGIONAL_CONFIG[selectedRegion] || REGIONAL_CONFIG.NG;
  const currentPlans = currentRegionalConfig.plans;

  const getPlanStatus = (planItem) => {
    // International view: Individual paid tiers are reference-only while USD checkout is in preparation
    if (selectedRegion === 'GLOBAL' && planItem.planKey !== 'FREE') {
      return {
        cta: 'International Billing Coming Soon',
        to: undefined,
        onClick: undefined,
        highlighted: false,
        disabled: true,
      };
    }

    if (planItem.isWaitlist) {
      return {
        cta: `Join ${planItem.name} Waitlist`,
        to: undefined,
        onClick: () => handleProSyncWaitlist(planItem.planKey),
        highlighted: false,
      };
    }

    const targetKey = planItem.planKey;
    const isApplicable = appliedPromo?.applicablePlans && appliedPromo.applicablePlans.length > 0
      ? appliedPromo.applicablePlans.includes(targetKey)
      : (targetKey === 'STARTER' || targetKey === 'PRO' || targetKey === 'PRO_SYNC');

    if (!user) {
      let ctaText = 'Get Started Free';
      if (targetKey === 'STARTER') ctaText = 'Choose Starter';
      if (targetKey === 'PRO') ctaText = 'Choose Pro';

      if (appliedPromo && isApplicable && appliedPromo.discountPercent && targetKey !== 'FREE') {
        ctaText = `${ctaText} (${appliedPromo.discountPercent}% Off)`;
      }

      const toUrl = appliedPromo
        ? `/register?promo=${encodeURIComponent(appliedPromo.code)}&plan=${targetKey.toLowerCase()}`
        : (targetKey === 'FREE' ? '/register' : `/register?plan=${targetKey.toLowerCase()}`);

      return {
        cta: ctaText,
        to: toUrl,
        onClick: undefined,
        highlighted: Boolean(planItem.highlighted),
      };
    }

    const targetRank = planRank[targetKey] || 1;

    if (userRank === targetRank) {
      return {
        cta: 'Current Plan',
        to: '/dashboard',
        onClick: undefined,
        highlighted: true,
      };
    }

    if (userRank > targetRank) {
      return {
        cta: 'Included in Your Plan',
        to: '/dashboard',
        onClick: undefined,
        highlighted: false,
      };
    }

    let upgradeLabel = targetKey === 'STARTER' ? 'Choose Starter' : (targetKey === 'PRO' ? 'Choose Pro' : `Upgrade to ${planItem.name}`);
    if (appliedPromo && isApplicable && appliedPromo.discountPercent) {
      upgradeLabel = `${upgradeLabel} (${appliedPromo.discountPercent}% Off)`;
    }

    return {
      cta: loadingPlan === (planItem.id || planItem.planKey) ? 'Redirecting...' : upgradeLabel,
      to: undefined,
      onClick: () => handleUpgrade(planItem),
      highlighted: Boolean(planItem.highlighted),
    };
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  };

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'JAHZJOURNALS',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web, Mobile (PWA)',
    offers: [
      {
        '@type': 'Offer',
        name: 'Free Plan',
        price: '0',
        priceCurrency: 'NGN',
      },
      {
        '@type': 'Offer',
        name: 'Starter Plan',
        price: '4000',
        priceCurrency: 'NGN',
      },
      {
        '@type': 'Offer',
        name: 'Pro Plan',
        price: '8500',
        priceCurrency: 'NGN',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Pricing & Plans — Transparent Forex Journaling | JAHZJOURNALS"
        description="Simple, transparent regional pricing for disciplined forex and gold traders. Start free with 20 trades/mo, upgrade to Starter or Pro for psychology tracking, prop-firm guards, and AI reviews."
        canonical="https://www.jahzjournal.com/pricing"
        schemas={[faqSchema, productSchema]}
      />
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-16">
        <Breadcrumbs />

        {/* Development-Only Pricing Preview Indicator */}
        {import.meta.env.DEV && devPreviewActive && (
          <aside
            role="status"
            aria-label="Development Pricing Preview Indicator"
            className="mb-6 rounded-2xl border-2 border-dashed border-amber-500/70 bg-amber-500/10 px-5 py-3.5 shadow-lg backdrop-blur-md text-amber-200"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
              <div className="flex items-center gap-2.5 flex-wrap justify-center md:justify-start">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow">
                  <span>🛠️</span> DEV PREVIEW ACTIVE: {devPreviewActive === 'nigeria' ? '🇳🇬 Nigeria (NGN)' : '🌍 International (USD)'}
                </span>
                <span className="text-xs text-amber-100 font-medium">
                  Presentation only. Does not authorize checkout sessions, alter user billing preferences, or modify backend pricing.
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-xs font-bold">
                {devPreviewActive === 'nigeria' ? (
                  <button
                    type="button"
                    onClick={() => handleDevSwitchPreview('international')}
                    className="px-3 py-1.5 rounded-lg bg-surface border border-amber-400/40 text-amber-300 hover:bg-amber-400/20 transition-all cursor-pointer"
                  >
                    Preview International (USD) →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDevSwitchPreview('nigeria')}
                    className="px-3 py-1.5 rounded-lg bg-surface border border-amber-400/40 text-amber-300 hover:bg-amber-400/20 transition-all cursor-pointer"
                  >
                    Preview Nigeria (NGN) →
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExitDevPreview}
                  className="px-3 py-1.5 rounded-lg bg-surface border border-border text-muted hover:text-foreground transition-all cursor-pointer"
                >
                  Exit Preview ✕
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* 1. Compact Promotional Banner (Only if promotion is valid and active) */}
        {(activePublicPromo || appliedPromo) && timeLeft && !timeLeft.expired && (
          <section className="mb-4">
            <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 via-surface to-emerald-950/40 px-4 py-2.5 sm:px-5 sm:py-3 shadow-md backdrop-blur-md">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 text-center sm:text-left">
                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[11px] font-black uppercase tracking-wider shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                    Launch Offer • {appliedPromo?.discountPercent || activePublicPromo?.discountPercent || 50}% OFF
                  </span>
                  <span className="text-xs text-foreground font-semibold">
                    Starter & Pro plans automatically discounted at checkout.
                  </span>
                  <span className="text-[11px] font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                    CODE: {(appliedPromo?.code || activePublicPromo?.slug || '50OFF').toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs shrink-0">
                  <div className="flex items-center gap-1.5 text-muted font-mono">
                    <span className="text-[11px] font-sans text-muted">Expires in:</span>
                    <span className="font-bold text-emerald-400 bg-surface-muted px-2 py-0.5 rounded border border-border">
                      {timeLeft.days}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
                    </span>
                  </div>
                  <a 
                    href="#pricing-cards"
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors cursor-pointer hidden md:inline"
                  >
                    View Plans ↓
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 2. Pricing Headline and Concise Supporting Description */}
        <section className="text-center max-w-3xl mx-auto pt-2 pb-5 px-4">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-500 dark:text-emerald-400 mb-2">
            PRICING & PLANS
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight">
            Build Better Trading Habits. Understand Your Edge.
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed max-w-2xl mx-auto">
            Journal your forex and gold trades, identify recurring mistakes, analyse your performance, and keep your risk under control—all in one place.
          </p>
          
          <div className="mt-4 flex items-center justify-center gap-3">
            {user ? (
              <Button to="/dashboard" size="sm">Go to Dashboard</Button>
            ) : (
              <Button to="/register" size="sm">Get Started Free</Button>
            )}
            <Button href="#compare-plans" variant="secondary" size="sm">Compare Plans</Button>
          </div>
        </section>

        {/* International Reference Notice (Shown ONLY when viewing International USD reference pricing) */}
        {selectedRegion === 'GLOBAL' && (
          <section className="mb-6 px-4">
            <div 
              role="region"
              aria-label="International Reference Pricing Notice"
              className="mx-auto max-w-3xl rounded-2xl border border-sky-500/30 bg-sky-500/10 px-5 py-4 shadow-lg backdrop-blur-xl"
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-[11px] font-bold uppercase tracking-wider">
                    <span>🌍</span> International Reference Notice
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    International billing is coming soon. Prices shown are reference prices only; international checkout is not yet available.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleManualRegionOverride('NG')}
                  className="shrink-0 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold shadow hover:bg-emerald-400 transition-all flex items-center gap-1.5 whitespace-nowrap font-black cursor-pointer"
                >
                  <span>🇳🇬</span> Switch to Nigeria (NGN)
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 5. Pricing Cards Grid (5 Columns for Individual Traders) */}
        <section id="pricing-cards" className="py-6 scroll-mt-20">
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {currentPlans.map((plan) => {
              const status = getPlanStatus(plan);
              let displayPrice = plan.price;
              let originalPrice = null;
              const planKey = plan.planKey;
              const applicable = appliedPromo?.applicablePlans && appliedPromo.applicablePlans.length > 0 
                ? appliedPromo.applicablePlans.includes(planKey) 
                : (planKey === 'STARTER' || planKey === 'PRO' || planKey === 'STARTER_SYNC' || planKey === 'PRO_SYNC');
              
              if (appliedPromo && appliedPromo.discountPercent && applicable && plan.numericPrice > 0) {
                const disc = Math.round(plan.numericPrice * (1 - appliedPromo.discountPercent / 100));
                originalPrice = plan.price;
                displayPrice = `${currentRegionalConfig.currencySymbol}${disc.toLocaleString()}`;
              }

              return (
                <PricingCard
                  key={plan.id || plan.name}
                  {...plan}
                  badgeText={plan.badgeText}
                  badgeVariant={plan.badgeVariant}
                  waitlistCount={plan.isWaitlist ? (waitlistCounts?.[plan.planKey]?.count || waitlistCounts?.PRO_SYNC?.count) : undefined}
                  planHeader={plan.targetAudience}
                  price={displayPrice}
                  originalPrice={originalPrice}
                  tagline={appliedPromo && applicable && plan.numericPrice > 0 ? `🔥 ${appliedPromo.discountPercent}% OFF APPLIED` : plan.tagline}
                  highlighted={status.highlighted}
                  cta={status.cta}
                  onClick={status.onClick}
                  to={status.to}
                />
              );
            })}
          </div>

          {/* Dedicated Mentor & Academy Spotlight Banner */}
          <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-surface to-surface p-6 sm:p-8 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-2 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <span>🎓</span> For Mentors, Coaches & Academies
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-foreground">
                Managing a Telegram channel or coaching students?
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                Stop reviewing messy screenshots in group chats. Give your students structured trading journals, enforce strict strategy risk guards (e.g. max 1% risk rules), and issue graded feedback directly on their setups.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted pt-1">
                <span className="flex items-center gap-1.5 text-emerald-400">✓ From ₦8,000 / month</span>
                <span className="flex items-center gap-1.5 text-emerald-400">✓ 25 to 1,000+ student capacity</span>
                <span className="flex items-center gap-1.5 text-emerald-400">✓ Paid student cohort checkout via Paystack</span>
              </div>
            </div>
            <Button to="/pricing/mentor" variant="primary" size="lg" className="shrink-0 w-full sm:w-auto">
              View Mentor Plans & Capacity →
            </Button>
          </div>

          {/* Promo Code Box */}
          <div className="mt-8 max-w-2xl mx-auto rounded-2xl border border-border bg-surface p-6 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                🏷️ Have an official promo code?
              </h3>
              <p className="text-xs text-muted mt-1">
                Enter your code to unlock promotional discounts across Starter and Pro.
              </p>
            </div>
            <form onSubmit={handleRedeemCode} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="e.g. FOUNDING50"
                className="bg-surface-muted border border-border px-3 py-2 rounded-xl text-xs font-mono font-bold text-sky-500 dark:text-sky-400 uppercase placeholder:text-muted outline-none focus:border-sky-500 w-full sm:w-36 text-foreground"
              />
              <button
                type="submit"
                disabled={redeemingPromo || !promoCode.trim()}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-md disabled:opacity-50 transition-all shrink-0 cursor-pointer"
              >
                {redeemingPromo ? 'Applying...' : 'Apply'}
              </button>
            </form>
          </div>

          {/* Subtle Regional Pricing Override */}
          <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5 font-medium">
              <Globe size={14} className="text-muted shrink-0" />
              <span>Viewing:</span>
            </span>
            <div className="relative inline-flex items-center">
              <select
                value={selectedRegion}
                onChange={(e) => handleManualRegionOverride(e.target.value)}
                aria-label="Select pricing region override"
                className="bg-surface border border-border text-foreground rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-sm hover:border-border/80 transition-all"
              >
                <option value="NG">🇳🇬 Pricing for Nigeria (NGN)</option>
                <option value="GLOBAL">🌍 International pricing (USD)</option>
              </select>
            </div>
            {hasManualOverride ? (
              <button
                type="button"
                onClick={handleResetToDetected}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors cursor-pointer"
                title="Reset to automatically detected region"
              >
                Reset to auto-detected
              </button>
            ) : (
              <span className="text-[11px] text-muted/70 italic">
                {isVpnDetected
                  ? '(VPN/proxy connection detected)'
                  : detectedCountryCode
                    ? `(Auto-detected: ${detectedCountryCode})`
                    : '(Auto-detected from connection)'}
              </span>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PLAIN-LANGUAGE AI SHOWCASE SECTION                                        */}
        {/* ========================================================================= */}
        <section className="py-12 border-t border-border">
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles size={14} /> JAHZ AI Intelligence
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              Understand Your Trading Edge with JAHZ AI
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              Practical, objective analysis of your real trade execution—designed for self-reflection and discipline, not market predictions or get-rich-quick claims.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-6 space-y-3 shadow-sm hover:border-emerald-500/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Brain size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">AI Trade Review</h3>
              <p className="text-xs text-muted leading-relaxed">
                Compares your executed entry, stop loss, and exit against your trading rules. Flags premature profit-taking, stop-widening, and rule violations so you can break destructive habits.
              </p>
              <div className="text-[11px] font-semibold text-emerald-400 pt-1">
                ✓ Available on Pro & Pro Sync (150 reviews/mo)
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-6 space-y-3 shadow-sm hover:border-emerald-500/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400">
                <TrendingUp size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">Weekly Coaching Summaries</h3>
              <p className="text-xs text-muted leading-relaxed">
                Synthesizes your weekly trade log into an honest behavioral report. Identifies session patterns (London vs New York) and flags revenge trading risks before they wipe out capital.
              </p>
              <div className="text-[11px] font-semibold text-sky-400 pt-1">
                ✓ Available on Starter, Pro & Pro Sync
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-6 space-y-3 shadow-sm hover:border-emerald-500/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Eye size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">Screenshot Vision Extraction</h3>
              <p className="text-xs text-muted leading-relaxed">
                Attach MT4/MT5 or TradingView chart screenshots. JAHZ Vision automatically reads your pair, order direction, entry price, and stop levels to eliminate tedious manual typing.
              </p>
              <div className="text-[11px] font-semibold text-amber-400 pt-1">
                ✓ Available on Pro & Pro Sync
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-6 space-y-3 shadow-sm hover:border-emerald-500/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                <TrendingUp size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">JAHZ Edge Finder</h3>
              <p className="text-xs text-muted leading-relaxed">
                Quantitative statistical analysis that cuts through market noise. Reveals which setups, session overlaps, and currency pairs (e.g. Gold vs EURUSD) yield your highest statistical profit factor.
              </p>
              <div className="text-[11px] font-semibold text-purple-400 pt-1">
                ✓ Available on Pro & Pro Sync
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-6 space-y-3 shadow-sm hover:border-emerald-500/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400">
                <Bot size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">Natural Language Journal Assistant</h3>
              <p className="text-xs text-muted leading-relaxed">
                Log thoughts on the go using plain conversational English. The assistant formats your reflections, emotions, and setup rationale into structured journal entries in seconds.
              </p>
              <div className="text-[11px] font-semibold text-teal-400 pt-1">
                ✓ Available on Starter, Pro & Pro Sync
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wide">
                  <Shield size={16} /> Responsible AI Policy
                </div>
                <h4 className="text-sm font-bold text-foreground">Objective Reflection, Not Signals</h4>
                <p className="text-xs text-muted leading-relaxed">
                  JAHZ AI analyzes your historical journal data to assist your personal self-reflection. It does not provide financial advice, make trade predictions, or guarantee profitable outcomes.
                </p>
              </div>
              <Link to="/register" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300">
                Test 2 Free AI Reviews Today →
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* RESPONSIVE FEATURE COMPARISON TABLE                                       */}
        {/* ========================================================================= */}
        <section id="compare-plans" className="py-12 border-t border-border scroll-mt-20">
          <div className="text-center mb-10 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">Compare Plan Features</h2>
            <p className="text-sm text-muted">Complete breakdown of limits, analytics, and automation across every tier</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-surface-muted text-muted uppercase tracking-wider border-b border-border font-bold">
                <tr>
                  <th className="p-4 border-r border-border sticky left-0 bg-surface-muted z-10 min-w-[200px]">
                    Feature
                  </th>
                  <th className="p-4 text-center border-r border-border min-w-[110px]">Free</th>
                  <th className="p-4 text-center border-r border-border min-w-[110px]">Starter</th>
                  <th className="p-4 text-center border-r border-border min-w-[130px] text-amber-500 dark:text-amber-400 font-extrabold bg-amber-500/5">
                    Pro (Recommended)
                  </th>
                  <th className="p-4 text-center border-r border-border min-w-[140px] text-sky-500 dark:text-sky-400 font-extrabold bg-sky-500/5">
                    Starter Sync (2 Sync)
                  </th>
                  <th className="p-4 text-center min-w-[140px] text-purple-500 dark:text-purple-400 font-extrabold bg-purple-500/5">
                    Pro Sync (5 Sync)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted">
                {featureMatrixCategories.map((category, catIdx) => (
                  <React.Fragment key={catIdx}>
                    <tr className="bg-surface-muted/70 font-black text-foreground uppercase tracking-wider text-[11px]">
                      <td colSpan={6} className="p-3 px-4 text-center border-y border-border/80 bg-surface-muted/90">
                        {category.category}
                      </td>
                    </tr>
                    {category.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-surface-muted/40 transition-colors">
                        <td className="p-4 font-semibold text-foreground border-r border-border sticky left-0 bg-surface z-10 shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">
                          {row.feature}
                        </td>
                        <td className="p-4 text-center border-r border-border">
                          {row.free === 'Included' ? (
                            <Check size={16} className="mx-auto text-emerald-500 dark:text-emerald-400" />
                          ) : row.free === 'Not included' ? (
                            <Minus size={16} className="mx-auto text-muted/40" />
                          ) : (
                            <span className="font-semibold text-foreground">{row.free}</span>
                          )}
                        </td>
                        <td className="p-4 text-center border-r border-border">
                          {row.starter === 'Included' ? (
                            <Check size={16} className="mx-auto text-emerald-500 dark:text-emerald-400" />
                          ) : row.starter === 'Not included' ? (
                            <Minus size={16} className="mx-auto text-muted/40" />
                          ) : (
                            <span className="font-semibold text-foreground">{row.starter}</span>
                          )}
                        </td>
                        <td className="p-4 text-center border-r border-border bg-amber-500/5 font-semibold text-foreground">
                          {row.pro === 'Included' ? (
                            <Check size={16} className="mx-auto text-emerald-500 dark:text-emerald-400 font-bold" />
                          ) : row.pro === 'Not included' ? (
                            <Minus size={16} className="mx-auto text-muted/40" />
                          ) : (
                            <span className="font-bold text-amber-500 dark:text-amber-400">{row.pro}</span>
                          )}
                        </td>
                        <td className="p-4 text-center border-r border-border bg-sky-500/5 font-semibold text-foreground">
                          {row.starterSync === 'Included' ? (
                            <Check size={16} className="mx-auto text-emerald-500 dark:text-emerald-400 font-bold" />
                          ) : row.starterSync === 'Not included' ? (
                            <Minus size={16} className="mx-auto text-muted/40" />
                          ) : (
                            <span className="font-bold text-sky-500 dark:text-sky-400">{row.starterSync}</span>
                          )}
                        </td>
                        <td className="p-4 text-center bg-purple-500/5 font-semibold text-foreground">
                          {row.proSync === 'Included' ? (
                            <Check size={16} className="mx-auto text-emerald-500 dark:text-emerald-400 font-bold" />
                          ) : row.proSync === 'Not included' ? (
                            <Minus size={16} className="mx-auto text-muted/40" />
                          ) : (
                            <span className="font-bold text-purple-500 dark:text-purple-400">{row.proSync}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* COMPREHENSIVE 9-QUESTION FAQ SECTION                                      */}
        {/* ========================================================================= */}
        <section className="py-12 border-t border-border">
          <div className="text-center mb-10 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">Frequently Asked Questions</h2>
            <p className="text-sm text-muted">Transparent answers to all your billing, data, and sync questions</p>
          </div>
          <div className="mx-auto max-w-4xl space-y-4">
            {faqs.map(([question, answer]) => (
              <FAQItem key={question} question={question} answer={answer} />
            ))}
          </div>
        </section>

        {/* Genuine Security & Trust Information */}
        <section className="py-8 border-t border-border">
          <div className="max-w-4xl mx-auto rounded-2xl border border-border bg-surface p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <Lock size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Bank-Grade 256-Bit SSL Encryption</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Your payments are processed securely by Paystack. JAHZJOURNALS never stores your credit card, debit card, or banking PINs.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-muted shrink-0">
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
              <span>•</span>
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            </div>
          </div>
        </section>

        <CTASection 
          title="Build Better Trading Habits. Understand Your Edge." 
          cta={user ? "Go to Dashboard" : "Get Started Free"} 
        />
      </main>

      <Footer />
    </div>
  );
};

export default Pricing;
