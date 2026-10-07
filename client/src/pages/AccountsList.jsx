import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Settings, ShieldCheck, Trash2, Wallet, Cloud, Sparkles, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AccountTypeCard from '../components/accounts/AccountTypeCard';
import MTCloudSyncModal from '../components/accounts/MTCloudSyncModal';
import { useAuth } from '../context/useAuth';

const isPropFirmAccount = (account) => account.accountCategory === 'PROP_FIRM' || account.isPropFirmAccount;

const AccountsList = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
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
      setAccounts(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'We couldn\'t load your accounts right now.');
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
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-muted p-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">Account setup</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">Trading Accounts</h2>
        <p className="mt-2 text-sm text-muted">Auto-import your live MetaTrader account or create manual regular and challenge accounts.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {/* Featured Card: 1-Click MetaTrader Auto-Sync (Zero Manual Setup) */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-b from-emerald-500/10 via-surface-muted to-surface p-6 shadow-md flex flex-col justify-between group hover:border-emerald-400 transition-all">
          <div className="absolute top-3 right-3">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm ${
              isAllowedSync
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              <Sparkles size={11} /> {isAllowedSync ? '100% Automated' : 'Starter & Pro'}
            </span>
          </div>
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-4 group-hover:scale-105 transition-transform">
              <Cloud size={26} />
            </div>
            <h3 className="text-lg font-black text-foreground">MetaTrader 4 / 5 Auto-Sync</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Connect in 1 click via investor password. We automatically import your broker, live balance, currency, and trade history—zero manual typing!
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedSyncAccount(null);
              setIsCloudModalOpen(true);
            }}
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400 transition shadow-sm"
          >
            <Cloud size={16} />
            {isAllowedSync ? 'Connect MetaTrader Now' : 'Connect MetaTrader (Starter & Pro)'}
          </button>
        </div>

        <AccountTypeCard
          icon={Wallet}
          title="Regular Trading Account"
          description="Manually track a personal, demo, broker, or custom trading account."
          to="/accounts/new"
          action="Create Regular Account"
        />
        <AccountTypeCard
          icon={ShieldCheck}
          title="Prop-Firm Account"
          description="Manually track a prop-firm evaluation, challenge, or funded account."
          to="/accounts/prop-firm/new"
          action="Create Prop-Firm Account"
        />
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-6">
        <h3 className="text-lg font-bold text-foreground">Your accounts</h3>
        <p className="mt-1 text-sm text-muted">Open an account to view details, progress, and recent trades.</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted">Loading your accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted py-16 text-center">
          <Wallet size={48} className="mx-auto mb-4 text-muted" />
          <h3 className="text-xl font-medium text-muted">No trading accounts yet</h3>
          <p className="mt-2 text-muted">Connect your MetaTrader account or create a manual account to start journaling.</p>
          <button
            type="button"
            onClick={() => {
              setSelectedSyncAccount(null);
              setIsCloudModalOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400 transition shadow-sm"
          >
            <Cloud size={16} /> Connect MetaTrader Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const propFirm = isPropFirmAccount(account);
            const propFirmDetails = account.propFirmAccount;
            const editPath = propFirm ? `/accounts/${account.id}/prop-firm/edit` : `/accounts/${account.id}/edit`;
            const isSynced = account.cloudSyncEnabled && account.cloudSyncStatus === 'CONNECTED';

            return (
              <div key={account.id} className="overflow-hidden rounded-xl border border-border bg-surface-muted transition hover:border-green-500">
                <Link to={`/accounts/${account.id}`} className="block p-6">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
                        {propFirm ? <ShieldCheck size={20} /> : <Building2 size={20} />}
                      </div>
                      <div>
                        <h3 className="line-clamp-1 text-lg font-bold text-foreground">{account.name}</h3>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-muted">{propFirm ? 'Prop firm' : 'Regular'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${propFirm ? 'bg-green-500/10 text-green-300' : 'bg-gray-700 text-muted'}`}>
                        {propFirmDetails?.accountStatus ? propFirmDetails.accountStatus.replaceAll('_', ' ') : 'Active'}
                      </span>
                      {isSynced && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={11} /> MT5 Synced
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted">{propFirm ? 'Firm' : 'Broker'}</span>
                      <span className="font-medium text-muted">{propFirmDetails?.firmName || account.brokerName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted">Balance</span>
                      <span className="font-bold text-green-400">{Number(account.currentBalance || 0).toLocaleString()} {account.currency}</span>
                    </div>
                    {propFirmDetails?.phases?.length > 0 && (
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="text-muted">Phases</span>
                        <span className="font-medium text-muted">{propFirmDetails.phases.length}</span>
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex items-center justify-between border-t border-border px-6 py-3">
                  <div className="flex items-center gap-3">
                    <Link to={editPath} className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-green-400">
                      <Settings size={14} />
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSyncAccount(account);
                        setIsCloudModalOpen(true);
                      }}
                      className={`inline-flex items-center gap-1 text-xs font-bold transition ${
                        isSynced ? 'text-emerald-400 hover:text-emerald-300' : 'text-indigo-400 hover:text-indigo-300'
                      }`}
                    >
                      <Cloud size={14} />
                      {isSynced ? 'MT Settings' : 'Sync MT5'}
                    </button>
                  </div>
                  <button type="button" onClick={() => deleteAccount(account)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-red-400">
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
