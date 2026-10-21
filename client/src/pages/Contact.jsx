import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Mail, Clock, Send, MessageSquare, CheckCircle2, Copy, Sparkles } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import api from '../utils/api';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';

const inputClass = 'w-full rounded-xl border border-border/80 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition shadow-sm';

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', website: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('support@jahzjournals.com');
    setCopiedEmail(true);
    toast.success('Email copied to clipboard!');
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/contact-messages', form);
      toast.success('Message received. We will get back to you shortly!');
      setForm({ name: '', email: '', subject: '', message: '', website: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit message');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <SEO 
        title="Contact JAHZJOURNALS | Forex Journal & Academy Support"
        description="Get in touch with the JAHZJOURNALS team for questions regarding early access, mentor academies, prop-firm tracking, or technical support."
      />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20">
        <Breadcrumbs />

        {/* Hero Section */}
        <div className="py-8 sm:py-12 text-center max-w-2xl mx-auto space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-400">
            Contact & Support
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Talk to the JAHZJOURNALS team.
          </h1>
          <p className="text-sm sm:text-base text-muted leading-relaxed">
            Have questions about early access, mentor cohorts, prop firm challenge tracking, or platform feedback? We're here to help.
          </p>
        </div>

        {/* Content Section: 2 Column Layout */}
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.4fr] items-start">
          {/* Left Column: Direct Info & Founder Note */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-6 sm:p-7 shadow-sm space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Mail size={16} />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">Direct Contact</h2>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Reach out directly to our engineering and trader success team.
                </p>
              </div>

              {/* Clickable Email Card */}
              <div className="rounded-xl border border-border/80 bg-surface-muted/60 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">Support Email</span>
                  <a 
                    href="mailto:support@jahzjournals.com" 
                    className="text-sm font-medium text-emerald-400 hover:underline truncate block"
                  >
                    support@jahzjournals.com
                  </a>
                </div>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="rounded-lg border border-border/80 bg-surface p-2 text-muted hover:text-foreground hover:bg-surface-muted transition shrink-0"
                  title="Copy email address"
                >
                  {copiedEmail ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Copy size={15} />}
                </button>
              </div>

              {/* Response Time SLA */}
              <div className="flex items-center gap-2.5 text-xs text-muted">
                <Clock size={15} className="text-emerald-400 shrink-0" />
                <span>Typical response time: <strong className="text-foreground font-medium">Within 24 hours</strong> on trading days.</span>
              </div>

              {/* Founder Note */}
              <div className="border-t border-border/70 pt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                  Built for Serious Traders
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  JAHZJOURNALS is crafted specifically for disciplined forex and prop-firm traders. Your questions, bug reports, and suggestions directly shape our product roadmap.
                </p>
              </div>
            </div>

            {/* Inquiries Badges Card */}
            <div className="rounded-2xl border border-border/70 bg-surface/60 p-5 space-y-3">
              <span className="text-xs font-semibold text-foreground block">Common Inquiries</span>
              <div className="flex flex-wrap gap-2">
                {[
                  'Mentor Academy Setup',
                  'Prop Firm Tracking',
                  'MT4 / MT5 Sync',
                  'Custom Billing & Invoicing',
                  'Feature Requests'
                ].map((tag) => (
                  <span 
                    key={tag}
                    className="rounded-lg border border-border/80 bg-surface-muted px-2.5 py-1 text-xs text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <form 
            onSubmit={handleSubmit} 
            className="rounded-2xl border border-border/80 bg-surface/90 p-6 sm:p-8 shadow-sm space-y-5"
          >
            <div>
              <h2 className="text-lg font-semibold text-foreground">Send a Message</h2>
              <p className="text-xs text-muted mt-0.5">Fill out the details below and we will get back to you promptly.</p>
            </div>

            {/* Anti-spam Honeypot Field */}
            <input
              tabIndex="-1"
              autoComplete="off"
              name="website"
              value={form.website}
              onChange={handleChange}
              className="hidden"
              aria-hidden="true"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-name" className="block text-xs font-medium text-foreground mb-1.5">
                  Your Name <span className="text-emerald-400">*</span>
                </label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Alex Trader"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-xs font-medium text-foreground mb-1.5">
                  Email Address <span className="text-emerald-400">*</span>
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="alex@example.com"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="contact-subject" className="block text-xs font-medium text-foreground mb-1.5">
                Subject <span className="text-emerald-400">*</span>
              </label>
              <input
                id="contact-subject"
                name="subject"
                type="text"
                value={form.subject}
                onChange={handleChange}
                placeholder="e.g. Question about Mentor Cohorts or Early Access"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-xs font-medium text-foreground mb-1.5">
                Message <span className="text-emerald-400">*</span>
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={5}
                value={form.message}
                onChange={handleChange}
                placeholder="Share your question or feedback with as much detail as possible..."
                required
                className={`${inputClass} resize-y leading-relaxed`}
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400 active:translate-y-0.5 disabled:opacity-60 w-full sm:w-auto"
              >
                <Send size={15} />
                <span>{isSubmitting ? 'Sending...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
