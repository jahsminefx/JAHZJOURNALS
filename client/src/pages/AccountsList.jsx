import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Settings, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AccountTypeCard from '../components/accounts/AccountTypeCard';

const isPropFirmAccount = (account) => account.accountCategory === 'PROP_FIRM' || account.isPropFirmAccount;

const AccountsList = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

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
      toast.success('Account removed from your sanctuary.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t remove that account right now.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-muted p-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">Account setup</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">Trading Accounts</h2>
        <p className="mt-2 text-sm text-muted">Choose the right workflow for a regular account or a prop-firm challenge.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AccountTypeCard
          icon={Wallet}
          title="Regular Trading Account"
          description="Track a personal, demo, broker, or live trading account."
          to="/accounts/new"
          action="Create Regular Account"
        />
        <AccountTypeCard
          icon={ShieldCheck}
          title="Prop-Firm Account"
          description="Track a prop-firm evaluation, challenge, instant-funded, or funded account."
          to="/accounts/prop-firm/new"
          action="Create Prop-Firm Account"
        />
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-6">
        <h3 className="text-lg font-bold text-foreground">Your accounts</h3>
        <p className="mt-1 text-sm text-muted">Open an account to view details, progress, and recent trades.</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted">Gathering your accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted py-16 text-center">
          <Wallet size={48} className="mx-auto mb-4 text-muted" />
          <h3 className="text-xl font-medium text-muted">No trading accounts yet</h3>
          <p className="mt-2 text-muted">Create a regular or prop-firm account to start journaling your trades.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const propFirm = isPropFirmAccount(account);
            const propFirmDetails = account.propFirmAccount;
            const editPath = propFirm ? `/accounts/${account.id}/prop-firm/edit` : `/accounts/${account.id}/edit`;

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
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${propFirm ? 'bg-green-500/10 text-green-300' : 'bg-gray-700 text-muted'}`}>
                      {propFirmDetails?.accountStatus ? propFirmDetails.accountStatus.replaceAll('_', ' ') : 'Active'}
                    </span>
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
                  <Link to={editPath} className="inline-flex items-center gap-2 text-sm text-muted hover:text-green-400">
                    <Settings size={16} />
                    Edit
                  </Link>
                  <button type="button" onClick={() => deleteAccount(account)} className="inline-flex items-center gap-2 text-sm text-muted hover:text-red-400">
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AccountsList;
