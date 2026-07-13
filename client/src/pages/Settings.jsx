import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Lock,
  Palette,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/ThemeProvider';
import { loadSettings, saveSettings, fetchAndSyncSettings } from '../utils/settings';

const inputClass = 'mt-2 block w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-green-400 disabled:cursor-not-allowed disabled:opacity-60';

const sectionNav = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'trading', label: 'Trading Preferences', icon: SlidersHorizontal },
  { id: 'risk', label: 'Risk Management', icon: ShieldCheck },
  { id: 'journal', label: 'Journal Preferences', icon: Camera },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'data', label: 'Data & Privacy', icon: Database },
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
  <label className="block text-sm text-muted">
    <span className="font-medium text-foreground">{label}</span>
    {description && <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>}
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
    className="flex w-full items-start justify-between gap-4 rounded-xl border border-border bg-surface p-4 text-left transition hover:border-foreground/20"
  >
    <span>
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      {description && <span className="mt-1 block text-sm leading-6 text-muted">{description}</span>}
    </span>
    <span className={`mt-1 flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition ${checked ? 'bg-green-500' : 'bg-gray-700'}`}>
      <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
    </span>
  </button>
);

const SettingsCard = ({ title, description, children, actions }) => (
  <section className="rounded-xl border border-border bg-surface-muted p-5 sm:p-6">
    <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        {description && <p className="mt-2 text-sm leading-6 text-muted">{description}</p>}
      </div>
      {actions}
    </div>
    <div className="pt-5">
      {children}
    </div>
  </section>
);

const SaveButton = ({ section, savingSection, children = 'Save settings' }) => (
  <button
    type="submit"
    disabled={savingSection === section}
    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 transition hover:bg-green-400 disabled:opacity-70"
  >
    <Save size={16} />
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
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState(() => getInitialSettingsSection(searchParams));
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
  const avatarInputRef = useRef(null);

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

  const saveSectionToBackend = async (section, endpoint, message = 'Settings saved') => {
    setSavingSection(section);
    try {
      if (endpoint) {
        await api.put(`/users/settings/${endpoint}`, settings[section]);
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
            className="mt-4 block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-gray-700 file:px-4 file:py-2 file:font-semibold file:text-foreground hover:file:bg-gray-600"
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

  const renderJournal = () => (
    <form onSubmit={(event) => { event.preventDefault(); saveSectionToBackend('journal', 'journal', 'Journal preferences saved'); }} className="space-y-5">
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

  const renderNotifications = () => (
    <form onSubmit={(event) => { event.preventDefault(); saveSectionToBackend('notifications', 'notifications', 'Notification settings saved'); }}>
      <SettingsCard
        title="Notification Settings"
        description="Choose which reminders and warnings should reach you."
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
    <form onSubmit={(event) => { event.preventDefault(); saveSectionToBackend('security', null, 'Security settings saved'); }} className="space-y-5">
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

  const renderBilling = () => (
    <form onSubmit={(event) => { event.preventDefault(); saveSectionToBackend('billing', null, 'Billing preferences saved'); }}>
      <SettingsCard
        title="Subscription and Billing"
        description="Review your plan and keep billing preferences ready for Paystack billing."
        actions={<SaveButton section="billing" savingSection={savingSection} />}
      >
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-300">Current plan</p>
            <h3 className="mt-3 text-3xl font-black text-foreground">{user?.subscriptionPlan || 'FREE'}</h3>
            <p className="mt-2 text-sm text-muted">Status: {user?.subscriptionStatus || 'ACTIVE'}</p>
            <p className="mt-4 text-sm text-muted">Renewal date: Not scheduled on Free plan</p>
          </div>
          <div className="space-y-4">
            <TextInput label="Billing email" value={settings.billing.billingEmail} onChange={(event) => updateSettingsSection('billing', 'billingEmail', event.target.value)} placeholder={profile.email} />
            <Toggle label="Subscription renewal reminders" checked={settings.billing.renewalReminders} onChange={(value) => updateSettingsSection('billing', 'renewalReminders', value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              {['Upgrade plan', 'Billing history', 'Payment method', 'Cancel subscription'].map((label) => (
                <button key={label} type="button" onClick={() => comingSoon(label)} className="rounded-lg border border-border px-4 py-3 text-sm text-muted hover:bg-surface-muted">
                  {label}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
              Plan limits and Paystack payment status will appear here when billing endpoints are connected.
            </div>
          </div>
        </div>
      </SettingsCard>
    </form>
  );

  const renderDataPrivacy = () => (
    <form onSubmit={(event) => { event.preventDefault(); saveSectionToBackend('dataPrivacy', 'data-privacy', 'Data and privacy settings saved'); }} className="space-y-5">
      <SettingsCard
        title="Data and Privacy"
        description="Export your journal data, control AI data usage, and prepare destructive actions with confirmation."
        actions={<SaveButton section="dataPrivacy" savingSection={savingSection} />}
      >
        <div className="space-y-5">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => comingSoon('Privacy Policy page')} className="rounded-lg border border-border px-4 py-3 text-sm text-muted hover:bg-surface-muted">Read Privacy Policy</button>
            <button type="button" onClick={() => comingSoon('Terms of Service page')} className="rounded-lg border border-border px-4 py-3 text-sm text-muted hover:bg-surface-muted">Read Terms of Service</button>
          </div>
        </div>
      </SettingsCard>
    </form>
  );

  const contentBySection = {
    profile: renderProfile,
    trading: renderTrading,
    risk: renderRisk,
    journal: renderJournal,
    notifications: renderNotifications,
    appearance: renderAppearance,
    security: renderSecurity,
    billing: renderBilling,
    data: renderDataPrivacy,
  };

  const activeLabel = sectionNav.find((section) => section.id === activeSection)?.label || 'Settings';

  if (isLoading) {
    return <div className="py-12 text-center text-muted">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 text-foreground">
      <div className="rounded-xl border border-border bg-surface-muted p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-green-400">Account controls</p>
        <h1 className="mt-3 text-3xl font-black text-foreground">Settings</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Manage your profile, trading defaults, journal rules, notifications, subscription, security, and data controls in one place.
        </p>
      </div>

      <div className="lg:hidden">
        <SelectInput label="Settings section" value={activeSection} onChange={(event) => setActiveSection(event.target.value)}>
          {sectionNav.map((section) => (
            <option key={section.id} value={section.id}>{section.label}</option>
          ))}
        </SelectInput>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden rounded-xl border border-border bg-surface-muted p-3 lg:block">
          <nav className="space-y-1">
            {sectionNav.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${
                    isActive ? 'bg-gray-700 text-green-400' : 'text-muted hover:bg-surface-muted hover:text-gray-900 dark:hover:text-foreground'
                  }`}
                >
                  <Icon size={18} />
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
  );
};

export default Settings;
