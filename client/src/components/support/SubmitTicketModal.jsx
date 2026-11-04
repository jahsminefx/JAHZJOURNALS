import React, { useState } from 'react';
import { X, Ticket, Send, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'TECHNICAL', label: 'Technical Issue / Bug' },
  { value: 'MT5_SYNC', label: 'MetaTrader (MT4/MT5) Sync' },
  { value: 'BILLING', label: 'Billing, Invoices & Subscriptions' },
  { value: 'ACCOUNT', label: 'Account Settings & Security' },
  { value: 'FEATURE', label: 'Feature Request & Feedback' },
  { value: 'GENERAL', label: 'General Inquiry' },
];

const PRIORITIES = [
  { value: 'NORMAL', label: 'Normal (Standard SLA - within 24h)', color: 'text-gray-300' },
  { value: 'HIGH', label: 'High Priority (within 6h)', color: 'text-amber-400' },
  { value: 'URGENT', label: 'Urgent / Active Trading Blocked (within 2h)', color: 'text-red-400' },
];

export default function SubmitTicketModal({ isOpen, onClose, onSuccess }) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('TECHNICAL');
  const [priority, setPriority] = useState('NORMAL');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim()) {
      toast.error('Please enter a ticket subject');
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      toast.error('Please provide more details (at least 10 characters)');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/support/tickets', {
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
      });

      const ticketNum = res.data?.ticketNumber || 'TK-XXXX';
      toast.success(`Formal Support Ticket #${ticketNum} submitted!`);
      
      if (onSuccess) {
        onSuccess(res.data?.ticket || { ticketNumber: ticketNum });
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-muted/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Ticket size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Submit Formal Support Ticket</h2>
              <p className="text-[11px] text-muted">Generate an official tracking reference with SLA monitoring</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-surface-muted transition"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Subject */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Ticket Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. MT5 Cloud sync disconnected with code 104"
              className="w-full px-3 py-2 bg-surface-muted border border-border rounded-xl text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500 transition"
              maxLength={150}
            />
          </div>

          {/* Category & Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-surface-muted border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-emerald-500 transition cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Urgency & SLA
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-surface-muted border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-emerald-500 transition cursor-pointer"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Detailed Description <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe what happened, expected behavior, and steps to reproduce..."
              className="w-full px-3 py-2 bg-surface-muted border border-border rounded-xl text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500 transition resize-none"
              maxLength={3000}
            />
            <p className="text-[10px] text-muted text-right mt-1">
              {description.length} / 3000 characters
            </p>
          </div>

          {/* SLA Info Card */}
          <div className="p-3 rounded-xl border border-border bg-surface-muted/30 flex items-start gap-2.5 text-xs text-muted">
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed">
              Upon submission, a unique ticket ID (e.g. <strong className="text-foreground">#TK-1082</strong>) will be assigned and bridged to your live support desk. Staff will be notified immediately.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-gray-950 transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Send size={13} />
              <span>{submitting ? 'Submitting...' : 'Create Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
