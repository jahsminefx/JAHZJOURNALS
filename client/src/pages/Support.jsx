import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Headphones, Mail, Clock, ShieldCheck, ChevronRight,
  Info, X, Sparkles, Ticket
} from 'lucide-react';
import SupportChatPanel from '../components/support/SupportChatPanel';
import SupportInfoPanel from '../components/support/SupportInfoPanel';
import SubmitTicketModal from '../components/support/SubmitTicketModal';
import { useAuth } from '../context/useAuth';

export default function Support() {
  const [searchParams] = useSearchParams();
  const threadId = searchParams.get('threadId');
  const { user } = useAuth();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(user?.role);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Refined Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-1.5 text-xs text-muted mb-1 select-none">
            <Link to="/dashboard" className="hover:text-foreground transition">
              Dashboard
            </Link>
            <ChevronRight size={12} className="opacity-60" />
            <span className="text-foreground font-semibold">Support Desk</span>
          </div>

          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              {isAdmin ? 'Super Admin Support Console' : 'Support Desk'}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 select-none">
              <Clock size={11} />
              <span>Monitored Daily</span>
            </span>
          </div>

          <p className="text-xs text-muted mt-1 max-w-2xl">
            {isAdmin
              ? 'Real-time trader inquiry desk. Review inbound support requests, dispatch immediate replies, and manage customer tickets.'
              : 'Get help with your journal, trading analytics, account, or subscription.'}
          </p>
        </div>

        {/* Compact Contact Action */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowTicketModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-bold text-emerald-400 transition shadow-2xs cursor-pointer"
            title="Open an official tracked ticket with reference number"
          >
            <Ticket size={13} className="text-emerald-400" />
            <span>Submit Formal Ticket</span>
          </button>

          <a
            href="mailto:jahzjournals@gmail.com"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-muted hover:text-foreground transition shadow-2xs"
            title="Direct administrative email"
          >
            <Mail size={13} className="text-emerald-500" />
            <span>jahzjournals@gmail.com</span>
          </a>

          {!isAdmin && (
            <button
              type="button"
              onClick={() => setMobileInfoOpen(!mobileInfoOpen)}
              className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-muted hover:text-foreground transition"
              title="Toggle help topics & availability"
              aria-label="Toggle help topics"
            >
              <Info size={13} />
              <span>{mobileInfoOpen ? 'Hide Info' : 'Help Info'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Workspace Layout */}
      {isAdmin ? (
        // Super Admin View: Full Width Split Console
        <div className="w-full">
          <SupportChatPanel initialThreadId={threadId} />
        </div>
      ) : (
        // Trader View: Balanced 2-Column Desktop Grid
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Primary Conversation Panel (~72% width on desktop) */}
          <div className="lg:col-span-8 xl:col-span-8 min-w-0">
            <SupportChatPanel
              initialThreadId={threadId}
              showInfoToggle={true}
              onToggleInfoPanel={() => setMobileInfoOpen(!mobileInfoOpen)}
            />
          </div>

          {/* Secondary Contextual Panel (~28% width on desktop) */}
          <div className="hidden lg:block lg:col-span-4 xl:col-span-4 min-w-0">
            <SupportInfoPanel />
          </div>

          {/* Mobile / Tablet Collapsible Contextual Drawer */}
          {mobileInfoOpen && (
            <div className="lg:hidden col-span-1 border-t border-border pt-4 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  Support Resources & Information
                </span>
                <button
                  type="button"
                  onClick={() => setMobileInfoOpen(false)}
                  className="p-1 text-muted hover:text-foreground rounded-lg"
                  aria-label="Close help info"
                >
                  <X size={15} />
                </button>
              </div>
              <SupportInfoPanel />
            </div>
          )}
        </div>
      )}

      {/* 3. Formal Ticket Submission Modal */}
      <SubmitTicketModal
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        onSuccess={() => {
          // Trigger silent refresh of chat panel by window event
          window.dispatchEvent(new CustomEvent('support:ticket-created'));
        }}
      />
    </div>
  );
}
