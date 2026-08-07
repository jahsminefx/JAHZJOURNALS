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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumbs />
        <PageHeader
          eyebrow="Contact"
          title="Talk to the JAHZJOURNALS team."
          description="Questions about early access, mentors, academies, prop firm workflows, or support? Send a message."
        />
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-2xl border border-border bg-surface dark:border-white/10 dark:bg-white/[0.04] p-6 shadow-sm dark:shadow-none">
              <h2 className="text-2xl font-bold text-foreground">Founder message</h2>
              <p className="mt-4 leading-7 text-muted">
                JAHZJOURNALS is being built for traders who want to take review seriously. Your feedback helps shape the product before launch.
              </p>
              <div className="mt-8 space-y-4 text-sm text-muted">
                <p><span className="font-semibold text-foreground">Support:</span> support@jahzjournals.com</p>
                <p><span className="font-semibold text-foreground">Social:</span> Instagram · Twitter/X · LinkedIn</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface dark:border-white/10 dark:bg-white/[0.04] p-6 shadow-sm dark:shadow-none">
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
                <label className="text-sm text-muted">
                  Name
                  <input name="name" value={form.name} onChange={handleChange} required className="mt-2 w-full rounded-lg border border-border dark:border-white/10 bg-background px-4 py-3 text-foreground outline-none focus:border-emerald-400" />
                </label>
                <label className="text-sm text-muted">
                  Email
                  <input name="email" type="email" value={form.email} onChange={handleChange} required className="mt-2 w-full rounded-lg border border-border dark:border-white/10 bg-background px-4 py-3 text-foreground outline-none focus:border-emerald-400" />
                </label>
              </div>
              <label className="mt-5 block text-sm text-muted">
                Subject
                <input name="subject" value={form.subject} onChange={handleChange} required className="mt-2 w-full rounded-lg border border-border dark:border-white/10 bg-background px-4 py-3 text-foreground outline-none focus:border-emerald-400" />
              </label>
              <label className="mt-5 block text-sm text-muted">
                Message
                <textarea name="message" rows="6" value={form.message} onChange={handleChange} required className="mt-2 w-full resize-none rounded-lg border border-border dark:border-white/10 bg-background px-4 py-3 text-foreground outline-none focus:border-emerald-400" />
              </label>
              <Button type="submit" disabled={isSubmitting} className="mt-6 w-full sm:w-auto">
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
