import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Sun,
  Moon,
  Monitor,
  AlertTriangle,
  Bell,
  Brain,
  Camera,
  CreditCard,
  Database,
  Download,
  KeyRound,
  Layers,
  Lock,
  Palette,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  History,
  ShieldAlert,
  X,
  ExternalLink,
  CheckCircle2,
  BellRing,
  Send,
  RefreshCw,
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/ThemeProvider';
import { loadSettings, saveSettings, fetchAndSyncSettings } from '../utils/settings';
import AiUsageDashboard from '../components/settings/AiUsageDashboard';
import StrategySettings from '../components/settings/StrategySettings';
import { useConsent } from '../context/ConsentProvider';
import { getConsentTimestamp } from '../utils/consentService';
import {
  isPushNotificationSupported,
  getPushPermissionState,
  getPushBackendStatus,
  enablePushNotifications,
  disablePushNotifications,
  sendTestPushNotification,
  syncPushSubscription,
} from '../utils/pushNotificationHelper';

const inputClass = 'mt-2 block w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-emerald-500 focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60 shadow-sm';

const sectionNav = [
  { id: 'profile', label: 'Profile', icon: UserRound, description: 'Personal details, bio & trading style', group: 'Account & Security' },
  { id: 'security', label: 'Security', icon: Lock, description: 'Password, active sessions & login alerts', group: 'Account & Security' },
  { id: 'billing', label: 'Billing & Plan', icon: CreditCard, description: 'Subscription tier & payment preferences', group: 'Account & Security' },
  
  { id: 'trading', label: 'Trading Preferences', icon: SlidersHorizontal, description: 'Default accounts & execution rules', group: 'Trading Setup' },
  { id: 'risk', label: 'Risk Management', icon: ShieldCheck, description: 'Daily limits, max drawdown & targets', group: 'Trading Setup' },
  { id: 'strategies', label: 'Trading Strategies', icon: Layers, description: 'Custom playbooks & strategy setups', group: 'Trading Setup' },
  { id: 'journal', label: 'Journal Preferences', icon: Camera, description: 'Checklists, trade tags & review prompts', group: 'Trading Setup' },
  
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme mode, density & date formats', group: 'App Settings' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email alerts & reminder triggers', group: 'App Settings' },
  { id: 'data', label: 'Data & Privacy', icon: Database, description: 'Data export, AI privacy & cookies', group: 'App Settings' },
];

const profileFromUser = (user, settings) => ({
  name: user?.name || '',
  email: user?.email || '',
  phoneNumber: user?.phoneNumber || '',
  country: user?.country || '',
  timezone: user?.timezone || '',
  preferredCurrency: settings.profile.preferredCurrency,
  profilePhotoUrl: user?.avatarUrl || settings.profile.profilePhotoUrl,
  tradingExperience: user?.tradingExperience || '',
  tradingStyle: user?.tradingStyle || '',
  mainSession: user?.mainSession || '',
  mainTradingPairs: Array.isArray(user?.mainTradingPairs) ? user.mainTradingPairs.join(', ') : '',
});

const emptyWeeklyGoal = {
  tradingAccountId: '',
  profitTarget: '',
  tradeCountTarget: '',
  winRateTarget: '',
  maxLossTarget: '',
};

const weeklyGoalFromApi = (goal) => ({
  tradingAccountId: goal?.tradingAccountId || '',
  profitTarget: goal?.profitTarget ?? '',
  tradeCountTarget: goal?.tradeCountTarget ?? '',
  winRateTarget: goal?.winRateTarget ?? '',
  maxLossTarget: goal?.maxLossTarget ?? '',
});

const getInitialSettingsSection = (searchParams) => {
  const requested = searchParams.get('section');
  return sectionNav.some((section) => section.id === requested) ? requested : 'profile';
};

const Field = ({ label, description, children }) => (
  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
    <span className="text-foreground">{label}</span>
    {description && <span className="mt-1 block text-xs leading-5 text-muted font-normal normal-case">{description}</span>}
    {children}
  </label>
);

const TextInput = ({ label, description, ...props }) => (
  <Field label={label} description={description}>
    <input {...props} className={inputClass} />
  </Field>
);

const SelectInput = ({ label, description, children, ...props }) => (
  <Field label={label} description={description}>
    <select {...props} className={inputClass}>
      {children}
    </select>
  </Field>
);

const Toggle = ({ label, description, checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex w-full items-start justify-between gap-4 rounded-xl border border-border bg-surface p-4 text-left transition hover:border-emerald-500/50 shadow-sm"
  >
    <span>
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      {description && <span className="mt-1 block text-sm leading-6 text-muted">{description}</span>}
    </span>
    <span className={`mt-1 flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition ${checked ? 'bg-emerald-500' : 'bg-surface-muted border border-border'}`}>
      <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
    </span>
  </button>
);

const SettingsCard = ({ title, description, children, actions }) => (
  <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
    <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-xl font-black text-foreground tracking-tight">{title}</h2>
        {description && <p className="mt-1.5 text-xs text-muted leading-relaxed">{description}</p>}
      </div>
      {actions}
    </div>
    <div className="pt-6">
      {children}
    </div>
  </section>
);

const SaveButton = ({ section, savingSection, children = 'Save settings' }) => (
  <button
    type="submit"
    disabled={savingSection === section}
    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-sm transition disabled:opacity-70"
  >
    <Save size={15} />
    {savingSection === section ? 'Saving...' : children}
  </button>
);

const CheckboxGroup = ({ options, value, onChange }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    {options.map((option) => {
      const checked = value.includes(option.value);
      return (
        <label key={option.value} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm text-muted">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => {
              onChange(event.target.checked
                ? [...value, option.value]
                : value.filter((item) => item !== option.value));
            }}
            className="h-4 w-4 rounded border-border bg-background text-green-500"
          />
          {option.label}
        </label>
      );
    })}
  </div>
);

const Settings = () => {
  const { user, refreshUser } = useAuth();
  const { setTheme } = useTheme();
  const { consent, acceptAll: consentAcceptAll, rejectNonEssential: consentRejectNonEssential, savePreferences: consentSavePreferences, resetConsent: consentReset, openPreferences: consentOpenPrefs } = useConsent();
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState(() => getInitialSettingsSection(searchParams));
  const [mobileActiveSection, setMobileActiveSection] = useState(() => {
    const sec = searchParams.get('section');
    return sec && sectionNav.some((s) => s.id === sec) ? sec : null;
  });
  const [settings, setSettings] = useState(() => loadSettings());
  const [profile, setProfile] = useState(() => profileFromUser(user, loadSettings()));
  const [weeklyGoal, setWeeklyGoal] = useState(emptyWeeklyGoal);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingSection, setSavingSection] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '' });
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);

  // Billing & Plan Interactive States
  const [showBillingHistoryModal, setShowBillingHistoryModal] = useState(false);
  const [billingHistoryData, setBillingHistoryData] = useState(null);
  const [loadingBillingHistory, setLoadingBillingHistory] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showCancelSubModal, setShowCancelSubModal] = useState(false);
  const [cancellingSub, setCancellingSub] = useState(false);

  // Web Push Notification Device States
  const [pushSupported, setPushSupported] = useState(true);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushBackendStatus, setPushBackendStatus] = useState({ subscribed: false, deviceCount: 0, devices: [] });
  const [pushLoading, setPushLoading] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  useEffect(() => {
    async function initPushStatus() {
      const supported = isPushNotificationSupported();
      setPushSupported(supported);
      if (supported) {
        const perm = await getPushPermissionState();
        setPushPermission(perm);
        if (perm === 'granted') {
          await syncPushSubscription().catch(() => {});
        }
        const status = await getPushBackendStatus();
        setPushBackendStatus(status);
      }
    }
    initPushStatus();
  }, []);

  const handleEnablePush = async () => {
    setPushLoading(true);
    try {
      await enablePushNotifications();
      setPushPermission('granted');
      const status = await getPushBackendStatus();
      setPushBackendStatus(status);
      toast.success('🎉 Push notifications enabled! You will now receive instant trade alerts and daily reminders.');
    } catch (err) {
      toast.error(err.message || 'Failed to enable push notifications.');
      const perm = await getPushPermissionState();
      setPushPermission(perm);
    } finally {
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setPushLoading(true);
    try {
      await disablePushNotifications();
      const status = await getPushBackendStatus();
      setPushBackendStatus(status);
      setPushPermission('default');
      toast.success('Push notifications removed for this device.');
    } catch (err) {
      toast.error('Failed to disable push notifications.');
    } finally {
      setPushLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestingPush(true);
    try {
      await syncPushSubscription().catch(() => {});
      const res = await sendTestPushNotification();
      toast.success(res.message || 'Test push notification sent! Check your desktop/phone screen.');
      const status = await getPushBackendStatus();
      setPushBackendStatus(status);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to send test push notification.');
    } finally {
      setTestingPush(false);
    }
  };

  const handleUpgradePlan = () => {
    navigate('/pricing');
  };

  const handleOpenBillingHistory = async () => {
    setShowBillingHistoryModal(true);
    setLoadingBillingHistory(true);
    try {
      const { data } = await api.get('/subscriptions/history');
      setBillingHistoryData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to retrieve billing history.');
    } finally {
      setLoadingBillingHistory(false);
    }
  };

  const handleOpenPaymentMethod = () => {
    setShowPaymentMethodModal(true);
  };

  const handleOpenCancelSubscription = () => {
    if (user?.subscriptionPlan === 'FREE') {
      toast('You are currently on the Free plan. There is no active paid subscription to cancel.');
      return;
    }
    setShowCancelSubModal(true);
  };

  const handleConfirmCancelSub = async () => {
    setCancellingSub(true);
    try {
      const { data } = await api.post('/subscriptions/cancel');
      toast.success(data?.message || 'Subscription cancelled successfully.');
      await refreshUser();
      setShowCancelSubModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel subscription.');
    } finally {
      setCancellingSub(false);
    }
  };

  useEffect(() => {
    const sec = searchParams.get('section');
    if (sec && sectionNav.some((s) => s.id === sec)) {
      setActiveSection(sec);
      setMobileActiveSection(sec);
    }
  }, [searchParams]);

  const handleSelectSection = (sectionId) => {
    setActiveSection(sectionId);
    setMobileActiveSection(sectionId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchSettingsData = async () => {
      setIsLoading(true);
      try {
        const savedSettings = loadSettings();
        const [profileResponse, accountsResponse, weeklyGoalResponse, fetchedSettings] = await Promise.all([
          api.get('/users/profile'),
          api.get('/accounts'),
          api.get('/users/trading-goals/weekly'),
          fetchAndSyncSettings(),
        ]);

        setSettings(fetchedSettings);
        setProfile(profileFromUser(profileResponse.data, fetchedSettings));
        setAccounts(accountsResponse.data);
        setWeeklyGoal(weeklyGoalFromApi(weeklyGoalResponse.data));
      } catch (error) {
        toast.error(error.response?.data?.message || 'We had trouble loading your settings.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettingsData();
  }, []);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile]);

  const updateSettingsSection = (section, key, value) => {
    if (section === 'appearance' && key === 'theme') {
      setTheme(value);
    }
    setSettings((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }));
  };

  const saveSectionToBackend = async (section, endpoint, message = 'Settings saved', customPayload = null) => {
    setSavingSection(section);
    try {
      if (endpoint) {
        const payload = customPayload || settings[section];
        await api.put(`/users/settings/${endpoint}`, payload);
      }
      saveSettings(settings);
      toast.success(message);
    } catch (error) {
      if (section === 'appearance') {
        toast.error('Your theme changed on this device, but we could not save it to your account yet.');
      } else {
        toast.error(error.response?.data?.message || 'We hit a snag saving your settings.');
      }
    } finally {
      setSavingSection(null);
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setSavingSection('profile');

    try {
      const nextSettings = {
        ...settings,
        profile: {
          ...settings.profile,
          preferredCurrency: profile.preferredCurrency,
        },
      };

      const { data } = await api.put('/users/profile', {
        name: profile.name,
        country: profile.country,
        timezone: profile.timezone,
        phoneNumber: profile.phoneNumber,
        tradingExperience: profile.tradingExperience,
        tradingStyle: profile.tradingStyle,
        mainSession: profile.mainSession,
        mainTradingPairs: profile.mainTradingPairs,
      });

      saveSettings(nextSettings);
      setSettings(nextSettings);
      setProfile(profileFromUser(data, nextSettings));
      await refreshUser();
      toast.success('Your profile is up to date.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t save your profile right now.');
    } finally {
      setSavingSection(null);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) {
      toast.error('Please select an image to upload.');
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);

      const { data } = await api.put('/users/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const nextSettings = {
        ...settings,
        profile: {
          ...settings.profile,
          profilePhotoUrl: '',
        },
      };

      saveSettings(nextSettings);
      setSettings(nextSettings);
      setProfile(profileFromUser(data, nextSettings));
      setAvatarFile(null);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
      await refreshUser();
      toast.success('Looking good. Photo uploaded.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'We couldn\'t upload that photo. Try a different one.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handlePasswordReset = async () => {
    setSavingSection('password');
    try {
      await api.post('/auth/password-reset/request', { email: profile.email || user?.email });
      toast.success('If that email is registered, we\'ve sent reset instructions to it.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'We couldn\'t process that reset right now.');
    } finally {
      setSavingSection(null);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setSavingSection('changePassword');
    try {
      await api.put('/users/security/password', passwordData);
      toast.success('Your password has been successfully updated.');
      setPasswordData({ currentPassword: '', newPassword: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'We hit a snag changing your password.');
    } finally {
      setSavingSection(null);
    }
  };

  const handleLogoutAll = async () => {
    setSavingSection('logoutAll');
    try {
      await api.post('/users/security/logout-all');
      toast.success('Logged out of all devices.');
      await refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.message || 'We hit a snag logging you out of all devices.');
      setSavingSection(null);
    }
  };

  const updateWeeklyGoal = (key, value) => {
    setWeeklyGoal((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleWeeklyGoalSave = async (event) => {
    event.preventDefault();
    setSavingSection('weeklyGoal');

    try {
      const payload = {
        tradingAccountId: weeklyGoal.tradingAccountId || null,
        profitTarget: weeklyGoal.profitTarget === '' ? null : weeklyGoal.profitTarget,
        tradeCountTarget: weeklyGoal.tradeCountTarget === '' ? null : weeklyGoal.tradeCountTarget,
        winRateTarget: weeklyGoal.winRateTarget === '' ? null : weeklyGoal.winRateTarget,
        maxLossTarget: weeklyGoal.maxLossTarget === '' ? null : weeklyGoal.maxLossTarget,
      };

      const { data } = await api.put('/users/trading-goals/weekly', payload);
      setWeeklyGoal(weeklyGoalFromApi(data));
      toast.success('Weekly targets locked in.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t save your weekly targets.');
    } finally {
      setSavingSection(null);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const response = await api.get('/users/profile/export', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `jahzjournals-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      toast.success('Your data is yours. Export complete.');
    } catch (error) {
      toast.error('We hit a snag exporting your data.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirmation) {
      toast.error('Please enter your current password to confirm account deletion.');
      return;
    }
    setSavingSection('deleteAccount');
    try {
      await api.delete('/users/profile', { data: { currentPassword: deleteConfirmation } });
      toast.success('Your account and all data have been permanently deleted.');
      await refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.message || 'We hit a snag trying to delete your account.');
      setSavingSection(null);
    }
  };

  const comingSoon = (label) => {
    toast(`${label} is coming to your sanctuary soon.`);
  };

  const renderProfile = () => (
    <form onSubmit={handleProfileSave} className="space-y-5">
      <SettingsCard
        title="Profile Settings"
        description="Keep your identity, location, and trading profile accurate for journal analytics."
        actions={<SaveButton section="profile" savingSection={savingSection}>Save profile</SaveButton>}
      >
        <div className="mb-6 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
                {avatarPreview || profile.profilePhotoUrl ? (
                  <img src={avatarPreview || profile.profilePhotoUrl} alt={`${profile.name || 'Trader'} profile`} className="h-full w-full object-cover" />
                ) : (
                  <UserRound size={34} className="text-muted" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-foreground">Profile photo</h3>
                <p className="mt-1 text-sm leading-6 text-muted">Upload a JPG, PNG, WEBP, or GIF up to the configured image limit.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAvatarUpload}
              disabled={!avatarFile || avatarUploading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Camera size={16} />
              {avatarUploading ? 'Uploading...' : 'Upload photo'}
            </button>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
            className="mt-4 block w-full text-xs text-muted file:mr-4 file:rounded-xl file:border file:border-border file:bg-surface-muted file:px-4 file:py-2 file:font-bold file:text-foreground hover:file:bg-surface-muted/80 cursor-pointer"
          />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <TextInput label="Full name" value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} />
          <TextInput label="Email" value={profile.email} disabled readOnly />
          <TextInput label="Phone number" value={profile.phoneNumber} onChange={(event) => setProfile((current) => ({ ...current, phoneNumber: event.target.value }))} />
          <TextInput label="Country" value={profile.country} onChange={(event) => setProfile((current) => ({ ...current, country: event.target.value }))} />
          <SelectInput label="Timezone" value={profile.timezone} onChange={(event) => setProfile((current) => ({ ...current, timezone: event.target.value }))}>
            <option value="">Select timezone</option>
            <option value="Africa/Lagos">Africa/Lagos</option>
            <option value="UTC">UTC</option>
            <option value="Europe/London">Europe/London</option>
            <option value="America/New_York">America/New_York</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
          </SelectInput>
          <SelectInput label="Preferred currency" value={profile.preferredCurrency} onChange={(event) => setProfile((current) => ({ ...current, preferredCurrency: event.target.value }))}>
            <option value="USD">USD</option>
            <option value="NGN">NGN</option>
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
          </SelectInput>
          <SelectInput label="Trading experience level" value={profile.tradingExperience} onChange={(event) => setProfile((current) => ({ ...current, tradingExperience: event.target.value }))}>
            <option value="">Select level</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="professional">Professional</option>
          </SelectInput>
          <SelectInput label="Main trading style" value={profile.tradingStyle} onChange={(event) => setProfile((current) => ({ ...current, tradingStyle: event.target.value }))}>
            <option value="">Select style</option>
            <option value="scalping">Scalping</option>
            <option value="day_trading">Day trading</option>
            <option value="swing_trading">Swing trading</option>
            <option value="position">Position trading</option>
          </SelectInput>
          <SelectInput label="Preferred trading session" value={profile.mainSession} onChange={(event) => setProfile((current) => ({ ...current, mainSession: event.target.value }))}>
            <option value="">Select session</option>
            <option value="ASIAN">Asian</option>
            <option value="LONDON">London</option>
            <option value="NEW_YORK">New York</option>
            <option value="LONDON_NEW_YORK_OVERLAP">London/NY Overlap</option>
          </SelectInput>
          <div className="md:col-span-2">
            <TextInput label="Main instruments traded" description="Separate symbols with commas." value={profile.mainTradingPairs} onChange={(event) => setProfile((current) => ({ ...current, mainTradingPairs: event.target.value }))} placeholder="XAUUSD, EURUSD, NAS100" />
          </div>
        </div>
      </SettingsCard>
    </form>
  );

  const renderTrading = () => (
    <div className="space-y-5">
      <form onSubmit={(event) => { event.preventDefault(); saveSectionToBackend('trading', 'trading', 'Trading preferences saved'); }} className="space-y-5">
        <SettingsCard
          title="Trading Preferences"
          description="These defaults prefill the new-trade form where matching fields already exist."
          actions={<SaveButton section="trading" savingSection={savingSection} />}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <SelectInput label="Default trading account" value={settings.trading.defaultTradingAccountId} onChange={(event) => updateSettingsSection('trading', 'defaultTradingAccountId', event.target.value)}>
              <option value="">First available account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </SelectInput>
            <TextInput type="number" step="0.1" label="Default risk percentage" value={settings.trading.defaultRiskPercent} onChange={(event) => updateSettingsSection('trading', 'defaultRiskPercent', event.target.value)} />
            <TextInput type="number" step="0.1" label="Minimum risk-to-reward ratio" value={settings.trading.minimumRiskRewardRatio} onChange={(event) => updateSettingsSection('trading', 'minimumRiskRewardRatio', event.target.value)} />
            <TextInput type="number" label="Maximum trades per day" value={settings.trading.maxTradesPerDay} onChange={(event) => updateSettingsSection('trading', 'maxTradesPerDay', event.target.value)} />
            <TextInput type="number" label="Maximum losses per day" value={settings.trading.maxLossesPerDay} onChange={(event) => updateSettingsSection('trading', 'maxLossesPerDay', event.target.value)} />
            <TextInput type="number" step="0.1" label="Daily loss limit (%)" value={settings.trading.dailyLossLimit} onChange={(event) => updateSettingsSection('trading', 'dailyLossLimit', event.target.value)} />
            <SelectInput label="Preferred trading session" value={settings.trading.preferredSession} onChange={(event) => updateSettingsSection('trading', 'preferredSession', event.target.value)}>
              <option value="">Unspecified</option>
              <option value="ASIAN">Asian</option>
              <option value="LONDON">London</option>
              <option value="NEW_YORK">New York</option>
              <option value="LONDON_NEW_YORK_OVERLAP">London/NY Overlap</option>
              <option value="OTHER">Other</option>
            </SelectInput>
            <TextInput label="Default entry timeframe" value={settings.trading.defaultEntryTimeframe} onChange={(event) => updateSettingsSection('trading', 'defaultEntryTimeframe', event.target.value)} />
            <TextInput label="Default higher timeframe" value={settings.trading.defaultHigherTimeframe} onChange={(event) => updateSettingsSection('trading', 'defaultHigherTimeframe', event.target.value)} />
            <TextInput label="Main strategy" value={settings.trading.mainStrategy} onChange={(event) => updateSettingsSection('trading', 'mainStrategy', event.target.value)} />
            <div className="md:col-span-2">
              <TextInput label="Main pairs or instruments" description="The first item will prefill Pair / Instrument on new trades." value={settings.trading.mainPairs} onChange={(event) => updateSettingsSection('trading', 'mainPairs', event.target.value)} />
            </div>
          </div>
        </SettingsCard>
      </form>

      <form onSubmit={handleWeeklyGoalSave}>
        <SettingsCard
          title="Weekly Dashboard Goals"
          description="Set targets for the dashboard weekly-goal card. Leave all targets blank to disable the active weekly goal."
          actions={<SaveButton section="weeklyGoal" savingSection={savingSection}>Save goals</SaveButton>}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <SelectInput label="Goal account" description="Use all accounts or focus the weekly target on one account." value={weeklyGoal.tradingAccountId} onChange={(event) => updateWeeklyGoal('tradingAccountId', event.target.value)}>
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </SelectInput>
            <TextInput type="number" step="0.01" min="0" label="Profit goal" value={weeklyGoal.profitTarget} onChange={(event) => updateWeeklyGoal('profitTarget', event.target.value)} placeholder="2000" />
            <TextInput type="number" min="0" label="Trade-count goal" value={weeklyGoal.tradeCountTarget} onChange={(event) => updateWeeklyGoal('tradeCountTarget', event.target.value)} placeholder="20" />
            <TextInput type="number" step="0.1" min="0" max="100" label="Win-rate goal (%)" value={weeklyGoal.winRateTarget} onChange={(event) => updateWeeklyGoal('winRateTarget', event.target.value)} placeholder="60" />
            <TextInput type="number" step="0.01" min="0" label="Maximum loss goal" description="Track how much of the weekly loss budget has been used." value={weeklyGoal.maxLossTarget} onChange={(event) => updateWeeklyGoal('maxLossTarget', event.target.value)} placeholder="500" />
          </div>
        </SettingsCard>
      </form>
    </div>
  );

  const renderRisk = () => (
    <form onSubmit={(event) => { event.preventDefault(); saveSectionToBackend('risk', 'risk', 'Risk management settings saved'); }} className="space-y-5">
      <SettingsCard
        title="Risk Management"
        description="Define personal risk limits and warnings before the risk calculator and trade flow enforce them."
        actions={<SaveButton section="risk" savingSection={savingSection} />}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <TextInput type="number" step="0.1" label="Risk per trade (%)" value={settings.risk.riskPerTrade} onChange={(event) => updateSettingsSection('risk', 'riskPerTrade', event.target.value)} />
          <TextInput type="number" step="0.1" label="Daily drawdown limit (%)" value={settings.risk.dailyDrawdownLimit} onChange={(event) => updateSettingsSection('risk', 'dailyDrawdownLimit', event.target.value)} />
          <TextInput type="number" step="0.1" label="Weekly drawdown limit (%)" value={settings.risk.weeklyDrawdownLimit} onChange={(event) => updateSettingsSection('risk', 'weeklyDrawdownLimit', event.target.value)} />
          <TextInput type="number" label="Maximum open trades" value={settings.risk.maximumOpenTrades} onChange={(event) => updateSettingsSection('risk', 'maximumOpenTrades', event.target.value)} />
          <TextInput type="number" label="Stop trading after losses" value={settings.risk.stopAfterLosses} onChange={(event) => updateSettingsSection('risk', 'stopAfterLosses', event.target.value)} />
          <div className="grid gap-3">
            <Toggle label="Warn when risk is above personal limit" checked={settings.risk.warnRiskAboveLimit} onChange={(value) => updateSettingsSection('risk', 'warnRiskAboveLimit', value)} />
            <Toggle label="Warn when RR is below minimum" checked={settings.risk.warnRiskRewardBelowMinimum} onChange={(value) => updateSettingsSection('risk', 'warnRiskRewardBelowMinimum', value)} />
          </div>
        </div>
      </SettingsCard>
    </form>
  );

  const renderJournal = () => {
    const handleJournalSave = (event) => {
      event.preventDefault();
      const journalCombinedPayload = {
        ...settings.journal,
        ...settings.screenshot,
        ...settings.ai,
        ...settings.mentor,
      };
      saveSectionToBackend('journal', 'journal', 'Journal preferences saved', journalCombinedPayload);
    };

    return (
      <form onSubmit={handleJournalSave} className="space-y-5">
      <SettingsCard
        title="Journal Preferences"
        description="Set trade logging requirements, list behavior, screenshot defaults, AI review preferences, and mentor sharing."
        actions={<SaveButton section="journal" savingSection={savingSection} />}
      >
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <SelectInput label="Default trade grade" value={settings.journal.defaultTradeGrade} onChange={(event) => updateSettingsSection('journal', 'defaultTradeGrade', event.target.value)}>
              <option value="">Ungraded</option>
              <option value="A_PLUS">A+</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="MISTAKE">Mistake</option>
            </SelectInput>
            <SelectInput label="Default trade-list view" value={settings.journal.defaultTradeListView} onChange={(event) => updateSettingsSection('journal', 'defaultTradeListView', event.target.value)}>
              <option value="table">Table</option>
              <option value="cards">Cards</option>
              <option value="compact">Compact</option>
            </SelectInput>
            <SelectInput label="Default analytics period" value={settings.journal.defaultAnalyticsPeriod} onChange={(event) => updateSettingsSection('journal', 'defaultAnalyticsPeriod', event.target.value)}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="ytd">Year to date</option>
            </SelectInput>
            <SelectInput label="Default screenshot type" value={settings.screenshot.defaultScreenshotType} onChange={(event) => updateSettingsSection('screenshot', 'defaultScreenshotType', event.target.value)}>
              <option value="HIGHER_TIMEFRAME_ANALYSIS">Higher timeframe analysis</option>
              <option value="BEFORE_ENTRY">Before entry</option>
              <option value="ENTRY">Entry</option>
              <option value="DURING_TRADE">During trade</option>
              <option value="EXIT">Exit</option>
              <option value="POST_ANALYSIS">Post analysis</option>
              <option value="MARKED_CHART">Marked chart</option>
            </SelectInput>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-muted">Required trade fields</h3>
            <CheckboxGroup
              value={settings.journal.requiredTradeFields}
              onChange={(value) => updateSettingsSection('journal', 'requiredTradeFields', value)}
              options={[
                { value: 'pair', label: 'Pair / instrument' },
                { value: 'direction', label: 'Direction' },
                { value: 'entryPrice', label: 'Entry price' },
                { value: 'stopLoss', label: 'Stop loss' },
                { value: 'takeProfit', label: 'Take profit' },
                { value: 'notesAfter', label: 'Post-trade notes' },
              ]}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Toggle label="Require screenshot before completing a trade" checked={settings.journal.requireScreenshotBeforeCompletion} onChange={(value) => updateSettingsSection('journal', 'requireScreenshotBeforeCompletion', value)} />
            <Toggle label="Require post-trade notes" checked={settings.journal.requirePostTradeNotes} onChange={(value) => updateSettingsSection('journal', 'requirePostTradeNotes', value)} />
            <Toggle label="Require emotion tracking" checked={settings.journal.requireEmotionTracking} onChange={(value) => updateSettingsSection('journal', 'requireEmotionTracking', value)} />
            <Toggle label="Require rule checklist" checked={settings.journal.requireRuleChecklist} onChange={(value) => updateSettingsSection('journal', 'requireRuleChecklist', value)} />
            <Toggle label="Show open trades first" checked={settings.journal.showOpenTradesFirst} onChange={(value) => updateSettingsSection('journal', 'showOpenTradesFirst', value)} />
            <Toggle label="Automatically compress images" checked={settings.screenshot.automaticallyCompressImages} onChange={(value) => updateSettingsSection('screenshot', 'automaticallyCompressImages', value)} />
            <Toggle label="Keep original image" checked={settings.screenshot.keepOriginalImage} onChange={(value) => updateSettingsSection('screenshot', 'keepOriginalImage', value)} />
            <Toggle label="Delete Cloudinary images when a trade is deleted" checked={settings.screenshot.deleteCloudinaryImagesWithTrade} onChange={(value) => updateSettingsSection('screenshot', 'deleteCloudinaryImagesWithTrade', value)} />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <SelectInput label="Default screenshot quality" value={settings.screenshot.defaultScreenshotQuality} onChange={(event) => updateSettingsSection('screenshot', 'defaultScreenshotQuality', event.target.value)}>
              <option value="standard">Standard</option>
              <option value="high">High</option>
              <option value="original">Original</option>
            </SelectInput>
            <TextInput type="number" label="Maximum screenshots per trade" value={settings.screenshot.maximumScreenshotsPerTrade} onChange={(event) => updateSettingsSection('screenshot', 'maximumScreenshotsPerTrade', event.target.value)} />
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-4 flex items-center gap-3">
              <Brain size={20} className="text-green-400" />
              <h3 className="font-bold text-foreground">AI Settings</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Toggle label="Enable AI trade reviews" checked={settings.ai.enableAiTradeReviews} onChange={(value) => updateSettingsSection('ai', 'enableAiTradeReviews', value)} />
              <Toggle label="Generate review after closing a trade" checked={settings.ai.generateReviewAfterClose} onChange={(value) => updateSettingsSection('ai', 'generateReviewAfterClose', value)} />
              <Toggle label="Include emotions in AI analysis" checked={settings.ai.includeEmotions} onChange={(value) => updateSettingsSection('ai', 'includeEmotions', value)} />
              <Toggle label="Include rule violations" checked={settings.ai.includeRuleViolations} onChange={(value) => updateSettingsSection('ai', 'includeRuleViolations', value)} />
              <Toggle label="Include screenshots" checked={settings.ai.includeScreenshots} onChange={(value) => updateSettingsSection('ai', 'includeScreenshots', value)} />
              <Toggle label="Weekly AI summary" checked={settings.ai.weeklyAiSummary} onChange={(value) => updateSettingsSection('ai', 'weeklyAiSummary', value)} />
            </div>
            <div className="mt-5 max-w-sm">
              <SelectInput label="AI coaching tone" value={settings.ai.coachingTone} onChange={(event) => updateSettingsSection('ai', 'coachingTone', event.target.value)}>
                <option value="direct">Direct</option>
                <option value="supportive">Supportive</option>
                <option value="analytical">Analytical</option>
              </SelectInput>
            </div>
            <button type="button" onClick={() => comingSoon('Clear AI review history')} className="mt-4 rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface-muted">
              Clear AI review history
            </button>
          </div>
          
          <AiUsageDashboard />

          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-4 flex items-center gap-3">
              <Users size={20} className="text-green-400" />
              <h3 className="font-bold text-foreground">Mentor Settings</h3>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <TextInput label="Assigned mentor" value={settings.mentor.assignedMentor} onChange={(event) => updateSettingsSection('mentor', 'assignedMentor', event.target.value)} />
              <div className="grid gap-3">
                <Toggle label="Share trades with mentor" checked={settings.mentor.shareTradesWithMentor} onChange={(value) => updateSettingsSection('mentor', 'shareTradesWithMentor', value)} />
                <Toggle label="Share screenshots" checked={settings.mentor.shareScreenshots} onChange={(value) => updateSettingsSection('mentor', 'shareScreenshots', value)} />
                <Toggle label="Share emotions" checked={settings.mentor.shareEmotions} onChange={(value) => updateSettingsSection('mentor', 'shareEmotions', value)} />
                <Toggle label="Share weekly reviews" checked={settings.mentor.shareWeeklyReviews} onChange={(value) => updateSettingsSection('mentor', 'shareWeeklyReviews', value)} />
                <Toggle label="Allow mentor comments" checked={settings.mentor.allowMentorComments} onChange={(value) => updateSettingsSection('mentor', 'allowMentorComments', value)} />
                <button type="button" onClick={() => comingSoon('Leave mentor group')} className="rounded-lg border border-border px-4 py-3 text-left text-sm text-muted hover:bg-surface-muted">
                  Leave mentor group
                </button>
              </div>
            </div>
          </div>
        </div>
      </SettingsCard>
    </form>
  );
};

  const renderNotifications = () => (
    <div className="space-y-6">
      {/* Desktop & Mobile Push Notifications Card */}
      <SettingsCard
        title="Desktop & Mobile Push Notifications"
        description="Receive instant alerts for MT4/MT5 trade syncs, support replies, and daily trading discipline check-ins even when JahzJournal is minimized or closed."
      >
        <div className="rounded-xl border border-border bg-surface-muted/50 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`mt-0.5 rounded-xl p-3 shrink-0 ${
                pushPermission === 'granted'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : pushPermission === 'denied'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                <BellRing className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-foreground">
                    Device Push Notifications
                  </h4>
                  {pushPermission === 'granted' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active on this device
                    </span>
                  ) : pushPermission === 'denied' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-400 border border-red-500/30">
                      Blocked in browser
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/30">
                      Not Enabled
                    </span>
                  )}
                  {pushBackendStatus?.deviceCount > 0 && (
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted border border-border">
                      {pushBackendStatus.deviceCount} {pushBackendStatus.deviceCount === 1 ? 'device' : 'devices'} linked
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {pushPermission === 'granted'
                    ? 'Your browser is linked to receive native system notifications outside the app. Clicking any notification automatically opens the relevant trade or daily review page.'
                    : pushPermission === 'denied'
                    ? 'Notifications are blocked in your browser settings. To enable them, click the padlock/tune icon beside the URL in your browser address bar and set Notifications to "Allow".'
                    : 'Enable browser notifications to receive real-time MT5 sync alerts and daily morning discipline check-ins on your phone and laptop screen.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0 self-end sm:self-center">
              {pushPermission === 'granted' ? (
                <>
                  <button
                    type="button"
                    disabled={testingPush || pushLoading}
                    onClick={handleSendTestPush}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-gray-950 hover:bg-emerald-400 transition-colors shadow-sm disabled:opacity-60"
                  >
                    {testingPush ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {testingPush ? 'Sending Test...' : 'Send Test Notification'}
                  </button>
                  <button
                    type="button"
                    disabled={pushLoading}
                    onClick={handleDisablePush}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
                  >
                    Unlink Device
                  </button>
                </>
              ) : pushPermission === 'default' ? (
                <button
                  type="button"
                  disabled={pushLoading}
                  onClick={handleEnablePush}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-gray-950 hover:bg-emerald-400 transition-colors shadow-md shadow-emerald-500/10 disabled:opacity-60"
                >
                  {pushLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                  {pushLoading ? 'Enabling...' : 'Enable Push Notifications'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Notification Preferences Form */}
      <form onSubmit={(event) => { event.preventDefault(); saveSectionToBackend('notifications', 'notifications', 'Notification settings saved'); }}>
        <SettingsCard
          title="Notification Preferences"
          description="Choose which trading reminders, warnings, and channels should reach you."
          actions={<SaveButton section="notifications" savingSection={savingSection} />}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle label="Weekly review reminders" checked={settings.notifications.weeklyReviewReminders} onChange={(value) => updateSettingsSection('notifications', 'weeklyReviewReminders', value)} />
            <Toggle label="Daily journaling reminders" checked={settings.notifications.dailyJournalingReminders} onChange={(value) => updateSettingsSection('notifications', 'dailyJournalingReminders', value)} />
            <Toggle label="Trade follow-up reminders" checked={settings.notifications.tradeFollowUpReminders} onChange={(value) => updateSettingsSection('notifications', 'tradeFollowUpReminders', value)} />
            <Toggle label="Risk-limit warnings" checked={settings.notifications.riskLimitWarnings} onChange={(value) => updateSettingsSection('notifications', 'riskLimitWarnings', value)} />
            <Toggle label="Prop firm drawdown warnings" checked={settings.notifications.propFirmDrawdownWarnings} onChange={(value) => updateSettingsSection('notifications', 'propFirmDrawdownWarnings', value)} />
            <Toggle label="Mentor feedback notifications" checked={settings.notifications.mentorFeedbackNotifications} onChange={(value) => updateSettingsSection('notifications', 'mentorFeedbackNotifications', value)} />
            <Toggle label="Product updates" checked={settings.notifications.productUpdates} onChange={(value) => updateSettingsSection('notifications', 'productUpdates', value)} />
            <Toggle label="Email notifications" checked={settings.notifications.emailNotifications} onChange={(value) => updateSettingsSection('notifications', 'emailNotifications', value)} />
            <Toggle label="In-app notifications" checked={settings.notifications.inAppNotifications} onChange={(value) => updateSettingsSection('notifications', 'inAppNotifications', value)} />
          </div>
        </SettingsCard>
      </form>
    </div>
  );

  const renderAppearance = () => (
    <form onSubmit={(event) => { event.preventDefault(); saveSectionToBackend('appearance', 'appearance', 'Appearance settings saved'); }}>
      <SettingsCard
        title="Appearance Settings"
        description="Save display preferences for the dashboard, tables, charts, dates, and numbers."
        actions={<SaveButton section="appearance" savingSection={savingSection} />}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <h3 className="mb-3 text-sm font-medium text-foreground">Theme</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { id: 'light', label: 'Light', Icon: Sun },
                { id: 'dark', label: 'Dark', Icon: Moon },
                { id: 'system', label: 'System', Icon: Monitor },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border p-4 text-sm font-semibold transition ${settings.appearance.theme === opt.id ? 'border-green-500 bg-green-500/10 text-green-500' : 'border-border bg-surface text-muted hover:border-foreground/30 hover:bg-surface-muted'}`}
                >
                  <input
                    type="radio"
                    name="themePreference"
                    value={opt.id}
                    checked={settings.appearance.theme === opt.id}
                    onChange={(e) => updateSettingsSection('appearance', 'theme', e.target.value)}
                    className="sr-only"
                  />
                  <opt.Icon size={24} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <SelectInput label="Dashboard density" value={settings.appearance.dashboardDensity} onChange={(event) => updateSettingsSection('appearance', 'dashboardDensity', event.target.value)}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </SelectInput>
          <SelectInput label="Trade table density" value={settings.appearance.tradeTableDensity} onChange={(event) => updateSettingsSection('appearance', 'tradeTableDensity', event.target.value)}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </SelectInput>
          <Toggle label="Chart animation" checked={settings.appearance.chartAnimations} onChange={(value) => updateSettingsSection('appearance', 'chartAnimations', value)} />
          <SelectInput label="Preferred date format" value={settings.appearance.preferredDateFormat} onChange={(event) => updateSettingsSection('appearance', 'preferredDateFormat', event.target.value)}>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </SelectInput>
          <SelectInput label="Preferred number format" value={settings.appearance.preferredNumberFormat} onChange={(event) => updateSettingsSection('appearance', 'preferredNumberFormat', event.target.value)}>
            <option value="1,234.56">1,234.56</option>
            <option value="1.234,56">1.234,56</option>
            <option value="1234.56">1234.56</option>
          </SelectInput>
        </div>
      </SettingsCard>
    </form>
  );

  const renderSecurity = () => (
    <form onSubmit={(event) => { event.preventDefault(); saveSectionToBackend('security', 'security', 'Security settings saved'); }} className="space-y-5">
      <SettingsCard
        title="Security Settings"
        description="Manage password recovery, login alerts, sessions, and future account protection controls."
        actions={<SaveButton section="security" savingSection={savingSection} />}
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-5">
            <Toggle label="Login alerts" description="Receive an alert when a new login is detected." checked={settings.security.loginAlerts} onChange={(value) => updateSettingsSection('security', 'loginAlerts', value)} />
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="font-semibold text-foreground">Active session</h3>
              <p className="mt-2 text-sm text-muted">Current browser session, secured with an HTTP-only auth cookie.</p>
            </div>
            <button type="button" onClick={() => comingSoon('Active session history')} className="w-full rounded-lg border border-border px-4 py-3 text-left text-sm text-muted hover:bg-surface-muted">
              View active sessions
            </button>
            <button type="button" onClick={() => comingSoon('Account activity history')} className="w-full rounded-lg border border-border px-4 py-3 text-left text-sm text-muted hover:bg-surface-muted">
              Account activity history
            </button>
            <div className="pt-4 border-t border-border">
              <button type="button" onClick={handleLogoutAll} disabled={savingSection === 'logoutAll'} className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                {savingSection === 'logoutAll' ? 'Revoking sessions...' : 'Log out of all devices'}
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <KeyRound size={24} className="text-green-400" />
            <h3 className="mt-3 font-bold text-foreground">Change password</h3>
            <p className="mt-2 text-sm leading-6 text-muted">Update your password securely. You must know your current password.</p>
            <div className="mt-5 space-y-4">
              <TextInput type="password" label="Current password" value={passwordData.currentPassword} onChange={(e) => setPasswordData(cur => ({ ...cur, currentPassword: e.target.value }))} placeholder="••••••••" />
              <TextInput type="password" label="New password" value={passwordData.newPassword} onChange={(e) => setPasswordData(cur => ({ ...cur, newPassword: e.target.value }))} placeholder="••••••••" />
              <button type="button" onClick={handlePasswordChange} disabled={savingSection === 'changePassword' || !passwordData.currentPassword || !passwordData.newPassword} className="w-full rounded-lg bg-green-500 px-4 py-3 text-sm font-bold text-gray-900 hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-70">
                {savingSection === 'changePassword' ? 'Updating...' : 'Update password'}
              </button>
            </div>
            
            <div className="mt-6 border-t border-border pt-6">
              <h4 className="text-sm font-semibold text-muted">Forgot your password?</h4>
              <p className="mt-1 text-xs text-muted">Start a password reset flow for {profile.email || 'your account email'}.</p>
              <button type="button" onClick={handlePasswordReset} disabled={savingSection === 'password'} className="mt-3 rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface-muted disabled:opacity-70">
                {savingSection === 'password' ? 'Sending...' : 'Send reset instructions'}
              </button>
            </div>
          </div>
        </div>
      </SettingsCard>
    </form>
  );

  const renderBilling = () => {
    const activeSub = user?.subscriptions?.[0];
    const isFoundingTrader = activeSub?.source === 'PROMOTION';
    const promotion = activeSub?.promotion;

    return (
    <form onSubmit={(event) => { event.preventDefault(); saveSectionToBackend('billing', 'billing', 'Billing preferences saved'); }}>
      <SettingsCard
        title="Subscription and Billing"
        description="Review your plan and keep billing preferences ready for Paystack billing."
        actions={<SaveButton section="billing" savingSection={savingSection} />}
      >
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-5 relative overflow-hidden">
            {isFoundingTrader && <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-500/20 blur-xl" />}
            <p className="relative z-10 text-xs font-bold uppercase tracking-[0.2em] text-green-300">Current plan</p>
            <h3 className="relative z-10 mt-3 text-3xl font-black text-foreground">{user?.subscriptionPlan || 'FREE'}</h3>
            
            <div className="relative z-10 mt-6 space-y-3 border-t border-green-500/20 pt-4">
              <div className="flex justify-between text-sm">
                 <span className="text-muted">Status</span>
                 <span className="text-foreground font-medium">{user?.subscriptionStatus || 'ACTIVE'}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                 <span className="text-muted">Access Type</span>
                 <span className="font-medium text-foreground">
                   {isFoundingTrader ? (
                     <span className="flex items-center gap-1.5 text-amber-400">
                       🏅 {promotion?.badge?.name || 'Founding Trader'}
                     </span>
                   ) : 'Standard'}
                 </span>
              </div>
              <div className="flex justify-between text-sm">
                 <span className="text-muted">Source</span>
                 <span className="text-foreground font-medium capitalize">{activeSub?.source?.toLowerCase() || 'Free Tier'}</span>
              </div>
              <div className="flex justify-between text-sm">
                 <span className="text-muted">Valid Until</span>
                 <span className="text-foreground font-medium">
                    {activeSub?.expiresAt ? new Date(activeSub.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Ongoing'}
                 </span>
              </div>
              <div className="flex justify-between text-sm">
                 <span className="text-muted">Auto Renewal</span>
                 <span className="text-foreground font-medium">{activeSub?.autoRenew ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <TextInput label="Billing email" value={settings.billing.billingEmail} onChange={(event) => updateSettingsSection('billing', 'billingEmail', event.target.value)} placeholder={profile.email} />
            <Toggle label="Subscription renewal reminders" checked={settings.billing.renewalReminders} onChange={(value) => updateSettingsSection('billing', 'renewalReminders', value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleUpgradePlan}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition shadow-sm shadow-emerald-500/20 active:scale-95"
              >
                <Sparkles size={16} />
                <span>Upgrade plan</span>
              </button>
              <button
                type="button"
                onClick={handleOpenBillingHistory}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm font-semibold text-foreground hover:bg-surface hover:border-emerald-500/40 transition active:scale-95"
              >
                <History size={16} className="text-emerald-400" />
                <span>Billing history</span>
              </button>
              <button
                type="button"
                onClick={handleOpenPaymentMethod}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm font-semibold text-foreground hover:bg-surface hover:border-emerald-500/40 transition active:scale-95"
              >
                <CreditCard size={16} className="text-emerald-400" />
                <span>Payment method</span>
              </button>
              <button
                type="button"
                onClick={handleOpenCancelSubscription}
                disabled={user?.subscriptionPlan === 'FREE'}
                className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-400 hover:bg-rose-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                <ShieldAlert size={16} />
                <span>Cancel subscription</span>
              </button>
            </div>

            {/* Live Plan Limits & Paystack Gateway Status */}
            <div className="rounded-xl border border-border bg-surface p-4 text-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <span className="font-semibold text-foreground text-xs uppercase tracking-wider">Tier Privileges & Limits</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {user?.subscriptionPlan || 'FREE'} Tier Active
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-surface-muted/60 border border-border/50">
                  <span className="text-muted text-[11px]">MT4 / MT5 Sync</span>
                  <span className="font-bold text-foreground">
                    {user?.subscriptionPlan === 'PRO' ? 'Unlimited Accounts' : user?.subscriptionPlan === 'STARTER' ? '3 Accounts' : '1 Account'}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-surface-muted/60 border border-border/50">
                  <span className="text-muted text-[11px]">Monthly Trades</span>
                  <span className="font-bold text-foreground">
                    {user?.subscriptionPlan === 'PRO' ? 'Unlimited' : user?.subscriptionPlan === 'STARTER' ? '100 / month' : '20 / month'}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-surface-muted/60 border border-border/50">
                  <span className="text-muted text-[11px]">AI Trade Reviews</span>
                  <span className="font-bold text-foreground">
                    {user?.subscriptionPlan === 'PRO' ? 'Full AI Coach' : user?.subscriptionPlan === 'STARTER' ? 'Standard' : 'Basic'}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-surface-muted/60 border border-border/50">
                  <span className="text-muted text-[11px]">Paystack Gateway</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Connected
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsCard>
    </form>
  );
};

  const renderDataPrivacy = () => {
    const consentTimestamp = getConsentTimestamp();
    const consentCategories = consent?.categories || { necessary: true, preferences: false, analytics: false, advertising: false };

    return (
    <div className="space-y-5">
      {/* Privacy & Cookies */}
      <SettingsCard
        title="Privacy & Cookies"
        description="Manage your cookie and privacy preferences. Necessary cookies are always active for authentication and security."
      >
        <div className="space-y-4">
          {/* Necessary — always on */}
          <div className="flex w-full items-start justify-between gap-4 rounded-xl border border-border bg-surface p-4">
            <span>
              <span className="block text-sm font-semibold text-foreground">Necessary</span>
              <span className="mt-1 block text-sm leading-6 text-muted">Required for authentication, security, and core platform functionality.</span>
            </span>
            <span className="mt-1 text-xs font-semibold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded whitespace-nowrap">Always On</span>
          </div>

          <Toggle label="Preferences" description="Remembers your choices like theme, sidebar layout, and display preferences." checked={consentCategories.preferences} onChange={(value) => consentSavePreferences({ ...consentCategories, preferences: value })} />
          <Toggle label="Analytics" description="Helps us understand how the platform is used to improve the experience. Not currently active." checked={consentCategories.analytics} onChange={(value) => consentSavePreferences({ ...consentCategories, analytics: value })} />
          <Toggle label="Advertising" description="Enables third-party advertising on eligible public pages. Your private trading data is never shared with advertising providers." checked={consentCategories.advertising} onChange={(value) => consentSavePreferences({ ...consentCategories, advertising: value })} />

          {consentTimestamp && (
            <p className="text-xs text-muted">Consent last updated: {new Date(consentTimestamp).toLocaleString()}</p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <button type="button" onClick={consentAcceptAll} className="rounded-lg bg-green-500 px-4 py-3 text-sm font-bold text-gray-900 hover:bg-green-400">Accept All</button>
            <button type="button" onClick={consentRejectNonEssential} className="rounded-lg border border-border px-4 py-3 text-sm text-muted hover:bg-surface-muted">Reject Non-Essential</button>
            <button type="button" onClick={consentReset} className="rounded-lg border border-border px-4 py-3 text-sm text-muted hover:bg-surface-muted">Withdraw Consent</button>
          </div>
        </div>
      </SettingsCard>

      {/* AI Data & Export */}
      <form onSubmit={(event) => { event.preventDefault(); saveSectionToBackend('dataPrivacy', 'data-privacy', 'Data and privacy settings saved'); }} className="space-y-5">
        <SettingsCard
          title="Data Controls"
          description="Control AI data usage, export your journal data, and manage account deletion."
          actions={<SaveButton section="dataPrivacy" savingSection={savingSection} />}
        >
          <div className="space-y-5">
            <Toggle label="Allow AI screenshot analysis" description="Enables AI vision models to review trade chart screenshots for trade breakdowns." checked={settings.dataPrivacy.allowScreenshotAnalysis ?? settings.ai.includeScreenshots} onChange={(value) => { updateSettingsSection('dataPrivacy', 'allowScreenshotAnalysis', value); updateSettingsSection('ai', 'includeScreenshots', value); }} />
            <Toggle label="Allow AI usage of journal data" description="Controls whether future AI features can use journal content for analysis." checked={settings.dataPrivacy.allowAiUseOfJournalData} onChange={(value) => updateSettingsSection('dataPrivacy', 'allowAiUseOfJournalData', value)} />
            <div className="grid gap-3 md:grid-cols-3">
              <button type="button" onClick={handleExportData} disabled={exporting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 text-sm font-bold text-gray-900 hover:bg-green-400 disabled:opacity-70">
                <Download size={16} />
                {exporting ? 'Exporting...' : 'Export all data'}
              </button>
              <button type="button" onClick={() => comingSoon('Screenshot download archive')} className="rounded-lg border border-border px-4 py-3 text-sm text-muted hover:bg-surface-muted">
                Download screenshots
              </button>
              <button type="button" onClick={() => comingSoon('Account-only export')} className="rounded-lg border border-border px-4 py-3 text-sm text-muted hover:bg-surface-muted">
                Export account data
              </button>
              <button type="button" onClick={() => comingSoon('Delete individual trading account data')} className="rounded-lg border border-border px-4 py-3 text-sm text-muted hover:bg-surface-muted">
                Delete account data
              </button>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-1 shrink-0 text-red-300" size={20} />
                <div>
                  <h3 className="font-bold text-red-100">Danger zone</h3>
                  <p className="mt-2 text-sm leading-6 text-red-100/70">Destructive actions should require password confirmation. Backend delete endpoints for all journal data and account deletion are not connected yet.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <input
                  type="password"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  placeholder="Type your current password to confirm"
                  className="rounded-lg border border-red-500/30 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-red-300"
                />
                <button type="button" onClick={() => comingSoon('Delete all journal data')} disabled={!deleteConfirmation} className="rounded-lg border border-red-400/40 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50">
                  Delete journal data
                </button>
                <button type="button" onClick={handleDeleteAccount} disabled={!deleteConfirmation || savingSection === 'deleteAccount'} className="rounded-lg bg-red-500 px-4 py-3 text-sm font-bold text-foreground hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {savingSection === 'deleteAccount' ? 'Deleting...' : 'Delete account'}
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link to="/privacy" className="rounded-lg border border-border px-4 py-3 text-sm text-muted hover:bg-surface-muted text-center">Privacy Policy</Link>
              <Link to="/terms" className="rounded-lg border border-border px-4 py-3 text-sm text-muted hover:bg-surface-muted text-center">Terms of Service</Link>
              <Link to="/cookies" className="rounded-lg border border-border px-4 py-3 text-sm text-muted hover:bg-surface-muted text-center">Cookie Policy</Link>
            </div>
          </div>
        </SettingsCard>
      </form>
    </div>
  );
  };

  const contentBySection = {
    profile: renderProfile,
    trading: renderTrading,
    risk: renderRisk,
    strategies: () => <StrategySettings />,
    journal: renderJournal,
    notifications: renderNotifications,
    appearance: renderAppearance,
    security: renderSecurity,
    billing: renderBilling,
    data: renderDataPrivacy,
  };

  const activeLabel = sectionNav.find((section) => section.id === activeSection)?.label || 'Settings';

  const groups = ['Account & Security', 'Trading Setup', 'App Settings'];

  if (isLoading) {
    return <div className="py-12 text-center text-muted font-bold">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 text-foreground">
      {/* ========================================================================= */}
      {/* MOBILE / SMARTPHONE VIEW (lg:hidden)                                      */}
      {/* ========================================================================= */}
      <div className="block lg:hidden">
        {!mobileActiveSection ? (
          /* SMARTPHONE SETTINGS MENU */
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Page Header */}
            <div>
              <h1 className="text-2xl font-black text-foreground">Settings</h1>
              <p className="text-xs text-muted mt-1">Manage your account, trading rules, and app preferences</p>
            </div>

            {/* Profile Summary Card */}
            <button
              type="button"
              onClick={() => handleSelectSection('profile')}
              className="flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition active:scale-[0.99] hover:border-emerald-500/50"
            >
              <div className="relative shrink-0">
                {profile.profilePhotoUrl ? (
                  <img
                    src={profile.profilePhotoUrl}
                    alt={profile.name || 'User'}
                    className="h-14 w-14 rounded-full object-cover border-2 border-emerald-500/30"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 font-black text-lg border border-emerald-500/30">
                    {profile.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface border border-border text-emerald-500">
                  <UserRound size={11} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-base text-foreground truncate">{profile.name || 'Trader'}</h2>
                  <span className="shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                    {user?.subscriptionPlan || 'STARTER'}
                  </span>
                </div>
                <p className="text-xs text-muted truncate mt-0.5">{profile.email}</p>
                <p className="text-[11px] text-emerald-500 font-bold mt-1 flex items-center gap-0.5">
                  View Profile <ChevronRight size={13} />
                </p>
              </div>
            </button>

            {/* Grouped Settings Categories */}
            {groups.map((groupName) => {
              const groupSections = sectionNav.filter((s) => s.group === groupName);
              return (
                <div key={groupName} className="space-y-1.5">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-muted px-2">
                    {groupName}
                  </h3>
                  <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden divide-y divide-border">
                    {groupSections.map((section) => {
                      const Icon = section.icon;
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => handleSelectSection(section.id)}
                          className="flex w-full items-center justify-between p-3.5 text-left transition hover:bg-surface-muted active:bg-surface-muted/80"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                              <Icon size={19} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{section.label}</p>
                              <p className="text-xs text-muted truncate mt-0.5">{section.description}</p>
                            </div>
                          </div>
                          <ChevronRight size={18} className="shrink-0 text-muted ml-2" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* SMARTPHONE CATEGORY DETAIL VIEW */
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Top Navigation Bar with Back Button */}
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <button
                type="button"
                onClick={() => setMobileActiveSection(null)}
                className="flex items-center gap-1 text-xs font-bold text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-xl transition shrink-0 active:scale-95"
              >
                <ChevronLeft size={16} />
                <span>Settings</span>
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-black text-foreground truncate">{activeLabel}</h2>
              </div>
            </div>

            {/* Active Section Content */}
            <div className="pt-1">
              {contentBySection[activeSection]()}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP / TABLET VIEW (hidden lg:block)                                   */}
      {/* ========================================================================= */}
      <div className="hidden lg:block space-y-6">
        <div className="rounded-xl border border-border bg-surface-muted p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-green-400">Account controls</p>
          <h1 className="mt-3 text-3xl font-black text-foreground">Settings</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Manage your profile, trading defaults, journal rules, notifications, subscription, security, and data controls in one place.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-2xl border border-border bg-surface p-3 shadow-sm self-start sticky top-6">
            <nav className="space-y-1">
              {sectionNav.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-xs font-bold transition ${
                      isActive
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'text-muted hover:bg-surface-muted hover:text-foreground'
                    }`}
                  >
                    <Icon size={17} />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{activeLabel}</h2>
            </div>
            {contentBySection[activeSection]()}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BILLING HISTORY MODAL                                                     */}
      {/* ========================================================================= */}
      {showBillingHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-5 bg-surface-muted/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Billing & Payment History</h3>
                  <p className="text-xs text-muted">Past receipts, Paystack transactions, and tier changes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBillingHistoryModal(false)}
                className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {loadingBillingHistory ? (
                <div className="py-12 text-center text-sm text-muted">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mb-3" />
                  <p>Loading billing records...</p>
                </div>
              ) : (
                <>
                  {/* Transactions Section */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center justify-between">
                      <span>Payment Transactions</span>
                      <span className="text-[11px] font-normal text-muted lowercase">
                        {billingHistoryData?.payments?.length || 0} recorded
                      </span>
                    </h4>
                    {billingHistoryData?.payments && billingHistoryData.payments.length > 0 ? (
                      <div className="rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-surface-muted/80 text-muted uppercase tracking-wider border-b border-border font-semibold">
                            <tr>
                              <th className="p-3">Date</th>
                              <th className="p-3">Reference</th>
                              <th className="p-3">Amount</th>
                              <th className="p-3">Gateway</th>
                              <th className="p-3 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border text-foreground">
                            {billingHistoryData.payments.map((pmt) => (
                              <tr key={pmt.id} className="hover:bg-surface-muted/40 transition">
                                <td className="p-3 whitespace-nowrap text-muted">
                                  {new Date(pmt.paidAt || pmt.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="p-3 font-mono text-[11px] text-muted truncate max-w-[120px]" title={pmt.reference}>
                                  {pmt.reference}
                                </td>
                                <td className="p-3 font-bold">
                                  {pmt.currency === 'USD' ? `$${pmt.amount}` : `₦${Number(pmt.amount).toLocaleString()}`}
                                </td>
                                <td className="p-3 capitalize text-muted">{pmt.provider || 'Paystack'}</td>
                                <td className="p-3 text-right">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    pmt.status?.toUpperCase() === 'SUCCESS' || pmt.status?.toUpperCase() === 'PAID'
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                      : pmt.status?.toUpperCase() === 'PENDING'
                                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  }`}>
                                    {pmt.status || 'SUCCESS'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-surface-muted/30 p-6 text-center">
                        <CreditCard size={24} className="mx-auto text-muted/60 mb-2" />
                        <p className="text-xs text-foreground font-medium">No payment transactions yet</p>
                        <p className="text-[11px] text-muted mt-1">When you make payments or renew subscriptions, invoice receipts will appear here.</p>
                      </div>
                    )}
                  </div>

                  {/* Plan History / Migrations */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
                      Plan Activity & Changes
                    </h4>
                    {billingHistoryData?.histories && billingHistoryData.histories.length > 0 ? (
                      <div className="space-y-2">
                        {billingHistoryData.histories.map((hist) => (
                          <div key={hist.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface-muted/40 text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">
                                  {hist.previousPlan ? `${hist.previousPlan} → ` : ''}{hist.newPlan}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] text-muted uppercase">
                                  {hist.source}
                                </span>
                                {hist.promotion && (
                                  <span className="text-amber-400 text-[10px] font-medium">
                                    🏅 {hist.promotion.name}
                                  </span>
                                )}
                              </div>
                              {hist.notes && <p className="text-[11px] text-muted">{hist.notes}</p>}
                            </div>
                            <span className="text-[11px] text-muted whitespace-nowrap">
                              {new Date(hist.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-surface-muted/30 p-4 text-center text-xs text-muted">
                        No plan changes logged yet.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border p-4 bg-surface-muted/30">
              <span className="text-[11px] text-muted">Encrypted billing records • JahzJournal</span>
              <button
                type="button"
                onClick={() => setShowBillingHistoryModal(false)}
                className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-muted transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAYMENT METHOD MODAL                                                      */}
      {/* ========================================================================= */}
      {showPaymentMethodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-5 bg-surface-muted/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Payment Method</h3>
                  <p className="text-xs text-muted">Manage your payment gateway & security preferences</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentMethodModal(false)}
                className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Gateway Card */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs">
                      P
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Paystack Payments</h4>
                      <p className="text-[11px] text-muted">Primary African & International Gateway</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 size={12} /> Active
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  All credit and debit card transactions on JahzJournal are processed through Paystack's bank-grade, PCI-DSS Level 1 certified gateway.
                </p>
              </div>

              {/* Security & Tokenization notice */}
              <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Lock size={14} className="text-emerald-400" />
                  <span>Zero Card Storage Guarantee</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  For your security, JahzJournal never stores raw credit card numbers or CVVs on our servers. Your payment details are tokenized securely by Paystack with 3D Secure fraud prevention.
                </p>
              </div>

              {/* How to update card */}
              <div className="rounded-xl border border-border bg-surface p-4 space-y-2 text-xs">
                <h5 className="font-bold text-foreground">To change your card or payment details:</h5>
                <p className="text-muted leading-relaxed">
                  When upgrading or renewing your plan, simply select checkout to enter and authorize a new card on the Paystack secure checkout screen.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border p-4 bg-surface-muted/30">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentMethodModal(false);
                  navigate('/pricing');
                }}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition shadow-sm shadow-emerald-500/20"
              >
                <span>Change Plan on Pricing Page</span>
                <ExternalLink size={13} />
              </button>
              <button
                type="button"
                onClick={() => setShowPaymentMethodModal(false)}
                className="rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-foreground hover:bg-surface-muted transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CANCEL SUBSCRIPTION MODAL                                                 */}
      {/* ========================================================================= */}
      {showCancelSubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-md rounded-2xl border border-rose-500/30 bg-surface shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-5 bg-rose-500/5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Cancel Subscription</h3>
                  <p className="text-xs text-muted">Confirm cancellation of active plan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelSubModal(false)}
                disabled={cancellingSub}
                className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
                <p className="text-sm font-semibold text-rose-300">
                  Are you sure you want to cancel your {user?.subscriptionPlan || 'current'} subscription?
                </p>
              </div>

              <div className="space-y-2 text-xs text-muted leading-relaxed">
                <p>
                  • Your account will remain on the <strong>{user?.subscriptionPlan}</strong> plan until the end of your current billing period.
                </p>
                <p>
                  • Automatic renewals will be disabled immediately.
                </p>
                <p>
                  • After expiration, your tier will revert to <strong>Free</strong>, and access to premium features (unlimited MT5 accounts, advanced AI trade reviews, prop-firm analytics) will be limited.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border p-4 bg-surface-muted/30">
              <button
                type="button"
                onClick={() => setShowCancelSubModal(false)}
                disabled={cancellingSub}
                className="rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-foreground hover:bg-surface-muted transition disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelSub}
                disabled={cancellingSub}
                className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2.5 text-xs font-bold text-white transition shadow-sm shadow-rose-600/30 disabled:opacity-60"
              >
                {cancellingSub ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Confirm Cancellation</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
