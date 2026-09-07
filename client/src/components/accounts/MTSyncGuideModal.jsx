import React from 'react';
import { X, Download, ShieldCheck, Cpu, CheckCircle2, Copy } from 'lucide-react';
import Button from '../Button';

const MTSyncGuideModal = ({ isOpen, onClose, syncToken }) => {
  if (!isOpen) return null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 animate-fade-in">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-muted/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Cpu size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">MetaTrader 4 / 5 Live Sync Guide</h2>
              <p className="text-xs text-muted">Connect MT4 / MT5 to JAHZJOURNALS for automated real-time trade journal updates</p>
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-muted">
          {/* Step 1 */}
          <div className="rounded-2xl border border-border bg-surface-muted/30 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-slate-950 font-bold text-xs">
                1
              </span>
              <h3 className="text-base font-bold text-foreground">Download the Expert Advisor (EA)</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed pl-10">
              Download the official JAHZJOURNALS EA script for your specific MetaTrader terminal version and place the file inside your MetaTrader <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Experts</code> folder.
            </p>
            <div className="pl-10 flex flex-wrap gap-3 pt-1">
              <a
                href="/downloads/JahzJournals_Sync_MT4.mq4"
                download
                className="inline-flex items-center gap-2 rounded-xl bg-surface-muted border border-border px-4 py-2 text-xs font-bold text-foreground hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
              >
                <Download size={15} />
                Download MT4 Script (.mq4)
              </a>
              <a
                href="/downloads/JahzJournals_Sync_MT5.mq5"
                download
                className="inline-flex items-center gap-2 rounded-xl bg-surface-muted border border-border px-4 py-2 text-xs font-bold text-foreground hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
              >
                <Download size={15} />
                Download MT5 Script (.mq5)
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-2xl border border-border bg-surface-muted/30 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-slate-950 font-bold text-xs">
                2
              </span>
              <h3 className="text-base font-bold text-foreground">Enable WebRequest in MetaTrader Options</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed pl-10">
              In MT4 or MT5, go to <strong className="text-foreground">Tools &rarr; Options &rarr; Expert Advisors</strong>. Check the box for <strong className="text-foreground">"Allow WebRequest for listed URL"</strong> and add the URL below:
            </p>
            <div className="pl-10 flex items-center gap-2">
              <code className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-emerald-400 font-mono truncate">
                https://jahzjournal.com/api/webhooks/mt-sync
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard('https://jahzjournal.com/api/webhooks/mt-sync')}
                className="rounded-xl border border-border bg-surface p-2 text-muted hover:text-foreground hover:border-emerald-500/50 transition-colors"
                title="Copy WebRequest URL"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-2xl border border-border bg-surface-muted/30 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-slate-950 font-bold text-xs">
                3
              </span>
              <h3 className="text-base font-bold text-foreground">Attach EA to Chart & Enter Sync Token</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed pl-10">
              Drag <strong className="text-foreground">JahzJournals_Sync</strong> onto any active chart. In the EA Inputs tab, paste your account's secret Sync Token:
            </p>
            {syncToken ? (
              <div className="pl-10 flex items-center gap-2">
                <code className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground font-mono truncate">
                  {syncToken}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(syncToken)}
                  className="rounded-xl border border-border bg-surface p-2 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  title="Copy Sync Token"
                >
                  <Copy size={16} />
                </button>
              </div>
            ) : (
              <p className="pl-10 text-xs text-amber-400 font-semibold">
                Generate a Sync Token in Account Settings first to copy your unique token.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end border-t border-border px-6 py-4 bg-surface-muted/50">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
};

export default MTSyncGuideModal;
