import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Cpu, Copy, RefreshCw, Trash2, Download, HelpCircle, Eye, EyeOff, CheckCircle2, AlertCircle, Cloud, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import api from '../../utils/api';
import Button from '../Button';
import MTSyncGuideModal from './MTSyncGuideModal';
import MTCloudSyncModal from './MTCloudSyncModal';

const MTSyncSettings = ({ account, onAccountUpdated }) => {
  const [showToken, setShowToken] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isDisconnectingCloud, setIsDisconnectingCloud] = useState(false);

  if (!account) return null;

  const isCloudConnected = account.cloudSyncEnabled && (account.cloudSyncStatus === 'CONNECTED' || account.cloudSyncStatus === 'CONNECTING');

  const handleDisconnectCloud = async () => {
    if (!window.confirm('Are you sure you want to disconnect MetaTrader Cloud Sync for this account?')) {
      return;
    }
    setIsDisconnectingCloud(true);
    try {
      const response = await api.delete(`/accounts/${account.id}/cloud-sync/disconnect`);
      toast.success(response.data.message || 'MetaTrader Cloud Sync disconnected.');
      if (onAccountUpdated) onAccountUpdated();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to disconnect Cloud Sync.');
    } finally {
      setIsDisconnectingCloud(false);
    }
  };

  const handleGenerateToken = async () => {
    setIsGenerating(true);
    try {
      const response = await api.post(`/accounts/${account.id}/sync-token`);
      toast.success(response.data.message || 'MetaTrader sync token generated successfully.');
      if (onAccountUpdated) onAccountUpdated();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate MetaTrader sync token.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeToken = async () => {
    if (!window.confirm('Are you sure you want to revoke this MetaTrader Sync Token? Your active EA will stop syncing trades.')) {
      return;
    }
    setIsRevoking(true);
    try {
      const response = await api.delete(`/accounts/${account.id}/sync-token`);
      toast.success(response.data.message || 'MetaTrader sync token revoked.');
      if (onAccountUpdated) onAccountUpdated();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to revoke sync token.');
    } finally {
      setIsRevoking(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="rounded-3xl border border-border bg-surface shadow-sm overflow-hidden p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Cpu size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              MetaTrader 4 / 5 Live Sync
              {isCloudConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={12} /> 24/7 Cloud Sync Active
                </span>
              ) : account.syncEnabled ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={12} /> Desktop EA Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted bg-surface-muted border border-border px-2 py-0.5 rounded-full">
                  <AlertCircle size={12} /> Not Connected
                </span>
              )}
            </h3>
            <p className="text-xs text-muted">
              Connect your MT4 or MT5 broker account to automatically log real-time trade fills, stop-loss edits, and P&L
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsGuideOpen(true)}
          className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors self-start sm:self-center"
        >
          <HelpCircle size={16} />
          EA Setup Guide
        </button>
      </div>

      {/* METHOD 1: 1-CLICK CLOUD SYNC (RECOMMENDED) */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <Cloud size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                Method 1: 1-Click Cloud Sync (Investor Password)
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                  <Sparkles size={11} /> Recommended
                </span>
              </h4>
              <p className="text-xs text-muted">
                100% read-only broker connection. Syncs trades 24/7 without needing MetaTrader open or installing EAs.
              </p>
            </div>
          </div>

          {!isCloudConnected && (
            <Button
              type="button"
              onClick={() => setIsCloudModalOpen(true)}
              className="shrink-0 font-bold"
            >
              <Zap size={16} className="mr-1.5 fill-current" />
              Connect MT Cloud Sync
            </Button>
          )}
        </div>

        {isCloudConnected ? (
          <div className="rounded-xl border border-emerald-500/30 bg-surface/80 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted block">Broker Server:</span>
                <span className="font-bold text-foreground font-mono">{account.cloudServer || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted block">MT Account Login:</span>
                <span className="font-bold text-foreground font-mono">{account.cloudLogin || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted block">Sync Status:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} /> {account.cloudSyncStatus}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
              <p className="text-[11px] text-muted flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                Read-Only Investor Password connected.
                {account.cloudLastSyncedAt && (
                  <span>Last synced: <strong className="text-foreground">{new Date(account.cloudLastSyncedAt).toLocaleTimeString()}</strong></span>
                )}
              </p>

              <Button
                type="button"
                variant="outline"
                onClick={handleDisconnectCloud}
                disabled={isDisconnectingCloud}
                className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                Disconnect Cloud Sync
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted pt-1">
            <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
            <span>Uses official broker Investor Passwords (Read-Only). No trade execution or withdrawal permissions.</span>
          </div>
        )}
      </div>

      {/* METHOD 2: DESKTOP EA WEBHOOK SYNC (ALTERNATIVE) */}
      <div className="rounded-2xl border border-border bg-surface-muted/30 p-5 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            Method 2: Desktop EA Webhook Sync (Advanced / Manual EA)
          </h4>
          <p className="text-xs text-muted">
            Attach a custom Expert Advisor script inside your MetaTrader 4 or MetaTrader 5 desktop terminal.
          </p>
        </div>

        {/* Sync Token Sub-card */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-muted uppercase tracking-wider">
            Secret Account Sync Token
          </label>
          
          {account.syncToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showToken ? 'text' : 'password'}
                    readOnly
                    value={account.syncToken}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-xs text-foreground font-mono pr-10 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                  >
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyToClipboard(account.syncToken)}
                  className="shrink-0"
                >
                  <Copy size={16} className="mr-1.5" />
                  Copy Token
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-muted">
                  {account.lastSyncedAt ? (
                    <>Last EA sync: <strong className="text-foreground">{new Date(account.lastSyncedAt).toLocaleString()}</strong></>
                  ) : (
                    'No EA sync events received yet.'
                  )}
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateToken}
                    disabled={isGenerating}
                    className="text-xs"
                  >
                    <RefreshCw size={14} className={`mr-1.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRevokeToken}
                    disabled={isRevoking}
                    className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} className="mr-1.5" />
                    Revoke
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-dashed border-border bg-surface p-4">
              <div>
                <p className="text-xs font-semibold text-foreground">No EA Sync Token active</p>
                <p className="text-xs text-muted">Generate a unique token if you prefer running the EA on your MetaTrader desktop.</p>
              </div>
              <Button
                type="button"
                onClick={handleGenerateToken}
                disabled={isGenerating}
                className="shrink-0"
              >
                {isGenerating ? 'Generating...' : 'Generate Sync Token'}
              </Button>
            </div>
          )}
        </div>

        {/* EA Downloads */}
        <div className="pt-2 border-t border-border/60">
          <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
            <Download size={14} className="text-emerald-500" /> Download EA Scripts:
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/downloads/JahzJournals_Sync_MT4.mq4"
              download
              className="inline-flex items-center gap-2 rounded-xl bg-surface border border-border px-3.5 py-2 text-xs font-bold text-foreground hover:border-emerald-500/50 hover:text-emerald-400 transition-all shadow-sm"
            >
              <Download size={14} />
              MT4 EA Script (.mq4)
            </a>
            <a
              href="/downloads/JahzJournals_Sync_MT5.mq5"
              download
              className="inline-flex items-center gap-2 rounded-xl bg-surface border border-border px-3.5 py-2 text-xs font-bold text-foreground hover:border-emerald-500/50 hover:text-emerald-400 transition-all shadow-sm"
            >
              <Download size={14} />
              MT5 EA Script (.mq5)
            </a>
          </div>
        </div>
      </div>

      {/* Cloud Sync Modal */}
      <MTCloudSyncModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        accountId={account.id}
        defaultPlatform={account.platform || 'MT5'}
        onConnected={() => {
          if (onAccountUpdated) onAccountUpdated();
        }}
      />

      {/* Setup Guide Modal */}
      <MTSyncGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        syncToken={account.syncToken}
      />
    </div>
  );
};

export default MTSyncSettings;
