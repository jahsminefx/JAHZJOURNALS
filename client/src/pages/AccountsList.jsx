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
      toast.error(error.response?.data?.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const deleteAccount = async (account) => {
    const label = isPropFirmAccount(account) ? 'prop-firm account' : 'regular account';
    if (!window.confirm(`Delete this ${label}? This also removes its trades and screenshots.`)) return;

    try {
      if (isPropFirmAccount(account)) {
        await api.delete(`/accounts/prop-firm/${account.id}`);
      } else {
        await api.delete(`/accounts/${account.id}`);
      }
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      toast.success('Account deleted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete account');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">Account setup</p>
        <h2 className="mt-2 text-2xl font-bold text-gray-100">Trading Accounts</h2>
        <p className="mt-2 text-sm text-gray-400">Choose the right workflow for a regular account or a prop-firm challenge.</p>
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

      <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        <h3 className="text-lg font-bold text-gray-100">Your accounts</h3>
        <p className="mt-1 text-sm text-gray-400">Open an account to view details, progress, and recent trades.</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800 py-16 text-center">
          <Wallet size={48} className="mx-auto mb-4 text-gray-500" />
          <h3 className="text-xl font-medium text-gray-300">No trading accounts yet</h3>
          <p className="mt-2 text-gray-500">Create a regular or prop-firm account to start journaling your trades.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const propFirm = isPropFirmAccount(account);
            const propFirmDetails = account.propFirmAccount;
            const editPath = propFirm ? `/accounts/${account.id}/prop-firm/edit` : `/accounts/${account.id}/edit`;

            return (
              <div key={account.id} className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800 transition hover:border-green-500">
                <Link to={`/accounts/${account.id}`} className="block p-6">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
                        {propFirm ? <ShieldCheck size={20} /> : <Building2 size={20} />}
                      </div>
                      <div>
                        <h3 className="line-clamp-1 text-lg font-bold text-gray-100">{account.name}</h3>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-gray-500">{propFirm ? 'Prop firm' : 'Regular'}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${propFirm ? 'bg-green-500/10 text-green-300' : 'bg-gray-700 text-gray-300'}`}>
                      {propFirmDetails?.accountStatus ? propFirmDetails.accountStatus.replaceAll('_', ' ') : 'Active'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-500">{propFirm ? 'Firm' : 'Broker'}</span>
                      <span className="font-medium text-gray-300">{propFirmDetails?.firmName || account.brokerName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-500">Balance</span>
                      <span className="font-bold text-green-400">{Number(account.currentBalance || 0).toLocaleString()} {account.currency}</span>
                    </div>
                    {propFirmDetails?.phases?.length > 0 && (
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="text-gray-500">Phases</span>
                        <span className="font-medium text-gray-300">{propFirmDetails.phases.length}</span>
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex items-center justify-between border-t border-gray-700 px-6 py-3">
                  <Link to={editPath} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-green-400">
                    <Settings size={16} />
                    Edit
                  </Link>
                  <button type="button" onClick={() => deleteAccount(account)} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-red-400">
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
