import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import api from '../utils/api';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', website: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/contact-messages', form);
      toast.success('Message received successfully.');
      setForm({ name: '', email: '', subject: '', message: '', website: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit message');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-16">
        <Breadcrumbs />
        <PageHeader
          eyebrow="Contact"
          title="Talk to the JAHZJOURNALS team."
          description="Questions about early access, mentors, academies, prop firm workflows, or support? Send a message."
        />
        <section className="py-12">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-black text-foreground tracking-tight">Founder message</h2>
                <p className="mt-4 text-sm leading-relaxed text-muted">
                  JAHZJOURNALS is being built for traders who want to take review seriously. Your feedback helps shape the product before launch.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-border space-y-3 text-xs sm:text-sm text-muted">
                <p><span className="font-bold text-foreground">Support:</span> support@jahzjournals.com</p>
                <p><span className="font-bold text-foreground">Social:</span> Instagram · Twitter/X · LinkedIn</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm space-y-5">
              <input
                tabIndex="-1"
                autoComplete="off"
                name="website"
                value={form.website}
                onChange={handleChange}
                className="hidden"
                aria-hidden="true"
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                    Name
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    required
                    className="w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-emerald-500 focus:bg-surface outline-none transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="trader@example.com"
                    required
                    className="w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-emerald-500 focus:bg-surface outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-subject" className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  Subject
                </label>
                <input
                  id="contact-subject"
                  name="subject"
                  type="text"
                  value={form.subject}
                  onChange={handleChange}
                  placeholder="How can we help?"
                  required
                  className="w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-emerald-500 focus:bg-surface outline-none transition-all shadow-sm"
                />
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  rows="6"
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Write your message here..."
                  required
                  className="w-full resize-none rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-emerald-500 focus:bg-surface outline-none transition-all shadow-sm"
                />
              </div>

              <Button type="submit" disabled={isSubmitting} className="mt-2 w-full sm:w-auto">
                {isSubmitting ? 'Submitting...' : 'Submit Message'}
              </Button>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;
