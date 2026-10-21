import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Settings, ShieldCheck, Trash2, Wallet, Cloud, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AccountTypeCard from '../components/accounts/AccountTypeCard';
import MTCloudSyncModal from '../components/accounts/MTCloudSyncModal';
import { useAuth } from '../context/useAuth';
import { createCacheKey, getCachedData, setCachedData } from '../utils/apiCache';

const isPropFirmAccount = (account) => account.accountCategory === 'PROP_FIRM' || account.isPropFirmAccount;

const AccountsList = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const accountsKey = createCacheKey('/accounts');
  const cachedAccounts = getCachedData(accountsKey);

  const [accounts, setAccounts] = useState(cachedAccounts ? (Array.isArray(cachedAccounts.data) ? cachedAccounts.data : cachedAccounts.data.accounts || []) : []);
  const [loading, setLoading] = useState(!cachedAccounts);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [selectedSyncAccount, setSelectedSyncAccount] = useState(null);

  const planKey = (user?.subscriptionPlan || 'FREE').toUpperCase();
  const isAllowedSync =
    planKey === 'STARTER' ||
    planKey === 'PRO' ||
    planKey === 'MENTOR' ||
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'MENTOR';

  const fetchAccounts = async () => {
    try {
      const { data } = await api.get('/accounts');
      const list = Array.isArray(data) ? data : data.accounts || [];
      setCachedData(accountsKey, list, { staleTime: 120000 });
      setAccounts(list);
    } catch (error) {
      if (!cachedAccounts) {
        toast.error(error.response?.data?.message || 'We couldn\'t load your accounts right now.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Automatically trigger sync modal if URL has ?sync=true
  useEffect(() => {
    if (searchParams.get('sync') === 'true') {
      setSelectedSyncAccount(null);
      setIsCloudModalOpen(true);
    }
  }, [searchParams]);

  const deleteAccount = async (account) => {
    const label = isPropFirmAccount(account) ? 'prop-firm account' : 'regular account';
    if (!window.confirm(`Remove this ${label}? All associated trades, reviews, and screenshots will be permanently deleted.`)) return;

    try {
      if (isPropFirmAccount(account)) {
        await api.delete(`/accounts/prop-firm/${account.id}`);
      } else {
        await api.delete(`/accounts/${account.id}`);
      }
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      toast.success('Account removed successfully.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t remove that account right now.');
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Trading Accounts</h1>
          <p className="text-xs sm:text-sm text-muted mt-1">Manage your active broker connections, prop-firm challenges, and personal journal accounts.</p>
        </div>
      </div>

      {/* 2. Account Creation Options */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted mb-3.5">Account Setup Options</p>
        <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
          {/* Card 1: MetaTrader Auto-Sync (Coming Soon) */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 transition-all duration-200 hover:border-border-strong hover:shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted border border-border text-muted">
                  <Cloud size={20} />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Clock size={11} /> Coming Soon
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold text-foreground">MetaTrader 4 / 5 Auto-Sync</h3>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                Automated cloud synchronization via investor password is coming soon for Starter & Pro accounts.
              </p>
            </div>
            <div className="pt-6">
              <button
                type="button"
                onClick={() => {
                  setSelectedSyncAccount(null);
                  setIsCloudModalOpen(true);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted/80 transition"
              >
                <Clock size={14} />
                <span>Preview Auto-Sync</span>
              </button>
            </div>
          </div>

          {/* Card 2: Regular Account */}
          <AccountTypeCard
            icon={Wallet}
            title="Regular Trading Account"
            description="Manually record trades for a personal live, demo, broker, or crypto account."
            to="/accounts/new"
            action="Create Regular Account"
          />

          {/* Card 3: Prop-Firm Account */}
          <AccountTypeCard
            icon={ShieldCheck}
            title="Prop-Firm Account"
            description="Track prop-firm evaluation challenges with automated drawdown and daily loss guards."
            to="/accounts/prop-firm/new"
            action="Create Prop-Firm Account"
          />
        </div>
      </div>

      {/* 3. Accounts List Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-foreground">Your Accounts</h2>
            <span className="inline-flex items-center justify-center rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-muted border border-border">
              {accounts.length}
            </span>
          </div>
          <span className="text-xs text-muted hidden sm:inline-block">Click any account to view logs and analytics</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-muted font-medium animate-pulse">
            Loading your accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center max-w-lg mx-auto my-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-muted mb-3 border border-border">
              <Wallet size={24} />
            </div>
            <h3 className="text-sm font-bold text-foreground">No trading accounts yet</h3>
            <p className="mt-1 text-xs text-muted max-w-xs mx-auto">
              Create a regular or prop-firm account to begin logging trades and monitoring consistency.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/accounts/new"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
              >
                Create Regular Account
              </Link>
              <Link
                to="/accounts/prop-firm/new"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
              >
                Create Prop-Firm Account
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => {
              const propFirm = isPropFirmAccount(account);
              const propFirmDetails = account.propFirmAccount;
              const editPath = propFirm ? `/accounts/${account.id}/prop-firm/edit` : `/accounts/${account.id}/edit`;
              const isSynced = Boolean(
                (account.cloudSyncEnabled && account.cloudSyncStatus !== 'ERROR' && account.cloudSyncStatus !== 'DISCONNECTED' && account.cloudSyncStatus !== 'FAILED') ||
                (account.cloudSyncEnabled && account.cloudAccountId) ||
                (account.cloudServer && account.cloudLogin) ||
                account.syncEnabled ||
                (account.mtAccountNumber && account.mtServerName)
              );

              return (
                <div
                  key={account.id}
                  className="group flex flex-col justify-between rounded-2xl border border-border bg-surface transition-all duration-200 hover:border-border-strong hover:shadow-sm"
                >
                  <Link to={`/accounts/${account.id}`} className="block p-5 sm:p-6" title={account.name}>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted border border-border text-emerald-500">
                          {propFirm ? <ShieldCheck size={18} /> : <Building2 size={18} />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm sm:text-base font-bold text-foreground group-hover:text-emerald-500 transition-colors">
                            {account.name}
                          </h3>
                          <p className="mt-0.5 text-[11px] font-semibold text-muted">
                            {propFirm ? 'Prop Firm Challenge' : 'Regular Account'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          propFirm ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-surface-muted text-muted border border-border'
                        }`}>
                          {propFirmDetails?.accountStatus ? propFirmDetails.accountStatus.replaceAll('_', ' ') : 'Active'}
                        </span>
                        {isSynced && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={10} /> Synced
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl bg-surface-muted/40 p-3.5 border border-border/50 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted">{propFirm ? 'Evaluation Firm' : 'Broker'}</span>
                        <span className="font-semibold text-foreground truncate max-w-[140px]">
                          {propFirmDetails?.firmName || account.brokerName || 'Personal / Demo'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <span className="text-muted">Account Balance</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                          {Number(account.currentBalance || 0).toLocaleString()} <span className="text-xs font-semibold">{account.currency}</span>
                        </span>
                      </div>
                      {propFirmDetails?.phases?.length > 0 && (
                        <div className="flex items-center justify-between pt-1 border-t border-border/40">
                          <span className="text-muted">Phase Progress</span>
                          <span className="font-semibold text-foreground">Phase {propFirmDetails.phases.length}</span>
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="flex items-center justify-between border-t border-border/70 px-5 py-3 text-xs bg-surface-muted/20 rounded-b-2xl">
                    <div className="flex items-center gap-4">
                      <Link
                        to={editPath}
                        className="inline-flex items-center gap-1 font-semibold text-muted hover:text-foreground transition-colors"
                      >
                        <Settings size={13} />
                        <span>Settings</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSyncAccount(account);
                          setIsCloudModalOpen(true);
                        }}
                        className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${
                          isSynced ? 'text-emerald-500 hover:text-emerald-400' : 'text-muted hover:text-foreground'
                        }`}
                        title={isSynced ? 'Synced with MetaTrader' : 'MetaTrader Sync (Coming Soon)'}
                      >
                        {isSynced ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                        <span>{isSynced ? 'Synced' : 'Auto-Sync'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteAccount(account)}
                      className="inline-flex items-center gap-1 font-medium text-muted hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MetaTrader Cloud Sync Modal */}
      <MTCloudSyncModal
        isOpen={isCloudModalOpen}
        onClose={() => {
          setIsCloudModalOpen(false);
          setSelectedSyncAccount(null);
        }}
        account={selectedSyncAccount}
        accountId={selectedSyncAccount?.id}
        onConnected={() => {
          fetchAccounts();
        }}
      />
    </div>
  );
};

export default AccountsList;
