import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { X, Cloud, ShieldCheck, Lock, Eye, EyeOff, Server, User, Cpu, Sparkles } from 'lucide-react';
import api from '../../utils/api';
import Button from '../Button';
import { popularBrokers } from '../../data/popularBrokers';

const MTCloudSyncModal = ({ isOpen, onClose, accountId, defaultPlatform = 'MT5', onConnected }) => {
  const [platform, setPlatform] = useState(defaultPlatform || 'MT5');
  const [server, setServer] = useState('');
  const [login, setLogin] = useState('');
  const [investorPassword, setInvestorPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [serverSearch, setServerSearch] = useState('');

  if (!isOpen) return null;

  const filteredBrokers = popularBrokers.filter(b => 
    b.name.toLowerCase().includes(serverSearch.toLowerCase()) ||
    b.serverPrefixes.some(s => s.toLowerCase().includes(serverSearch.toLowerCase()))
  );

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!server.trim() || !login.trim() || !investorPassword.trim()) {
      toast.error('Please fill in all fields (Broker Server, Account Number, and Investor Password).');
      return;
    }

    setIsConnecting(true);
    try {
      const response = await api.post(`/accounts/${accountId}/cloud-sync/connect`, {
        platform,
        server: server.trim(),
        login: login.trim(),
        investorPassword: investorPassword.trim(),
      });

      toast.success(response.data.message || 'MetaTrader Cloud Sync connected successfully!');
      if (onConnected) onConnected();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to connect Cloud Sync. Please check your investor password and broker server name.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-muted/50">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Cloud size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                1-Click MetaTrader Cloud Sync
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  <Sparkles size={11} /> 100% Hands-Free
                </span>
              </h2>
              <p className="text-xs text-muted">Sync MT4 / MT5 trades 24/7 without running any terminal or EA</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleConnect} className="p-6 space-y-4 overflow-y-auto">
          {/* Security Banner */}
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
            <ShieldCheck size={18} className="shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <strong className="font-bold text-foreground">Read-Only Investor Password Safety:</strong>
              <p className="mt-0.5 text-emerald-300/90 leading-relaxed">
                Your broker's Investor Password provides <strong>read-only access</strong>. JAHZJOURNALS cannot place, modify, or close trades, nor access your funds.
              </p>
            </div>
          </div>

          {/* Platform Toggle */}
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
              Terminal Platform
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['MT5', 'MT4'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition-all ${
                    platform === p
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-border bg-surface-muted/40 text-muted hover:text-foreground'
                  }`}
                >
                  <Cpu size={16} />
                  {p === 'MT5' ? 'MetaTrader 5 (MT5)' : 'MetaTrader 4 (MT4)'}
                </button>
              ))}
            </div>
          </div>

          {/* Broker Server Select / Autocomplete */}
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider flex justify-between">
              <span>Broker Server Name</span>
              <span className="text-[10px] text-emerald-400 font-normal">e.g. ICMarketsSC-Live01, FTMO-Server</span>
            </label>
            <div className="relative">
              <Server size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search or enter broker server (e.g. FTMO-Server)"
                value={server}
                onChange={(e) => {
                  setServer(e.target.value);
                  setServerSearch(e.target.value);
                }}
                className="w-full rounded-xl border border-border bg-surface-muted/60 pl-10 pr-4 py-2.5 text-sm text-foreground focus:border-emerald-500 focus:outline-none transition-colors"
                required
              />
            </div>

            {/* Quick Popular Broker Pills */}
            <div className="mt-2.5">
              <p className="text-[11px] text-muted mb-1.5 font-medium">Popular Prop Firms & Brokers:</p>
              <div className="flex flex-wrap gap-1.5">
                {popularBrokers.slice(0, 7).map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => {
                      setServer(b.serverPrefixes[0]);
                      setServerSearch(b.name);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-all ${
                      server.startsWith(b.name) || b.serverPrefixes.includes(server)
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                        : 'border-border bg-surface-muted text-muted hover:border-emerald-500/50 hover:text-foreground'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Account Login Number */}
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
              MT Account Number (Login ID)
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="e.g. 1234567"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted/60 pl-10 pr-4 py-2.5 text-sm text-foreground focus:border-emerald-500 focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          {/* Investor Password */}
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider flex justify-between">
              <span>Read-Only Investor Password</span>
              <span className="text-[10px] text-muted font-normal">Provided by your broker</span>
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Investor Password"
                value={investorPassword}
                onChange={(e) => setInvestorPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted/60 pl-10 pr-10 py-2.5 text-sm text-foreground focus:border-emerald-500 focus:outline-none transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isConnecting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <span className="flex items-center gap-2">
                  <Cloud className="animate-pulse" size={16} />
                  Connecting Cloud MT...
                </span>
              ) : (
                'Connect 24/7 Cloud Sync'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MTCloudSyncModal;
