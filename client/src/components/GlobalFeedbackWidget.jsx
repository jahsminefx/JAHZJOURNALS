import React, { useState } from 'react';
import { MessageSquarePlus, X, Send } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const GlobalFeedbackWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState('SUPPORT');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      return toast.error("Please provide both a subject and a description.");
    }

    setLoading(true);
    try {
      await api.post('/feedback', { type, subject, description });
      toast.success("Feedback submitted successfully! Our team will review this shortly.");
      setIsOpen(false);
      setSubject('');
      setDescription('');
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit feedback.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 right-5 lg:bottom-6 lg:right-6 p-3 md:p-4 rounded-full bg-emerald-600 text-white shadow-xl hover:bg-emerald-500 hover:scale-105 transition-all z-[9999] ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        title="Report Issue or Request Feature"
      >
        <MessageSquarePlus size={22} />
      </button>

      {/* Modal / Dialog */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 lg:bottom-6 lg:right-6 w-[90vw] max-w-[400px] bg-white dark:bg-surface border border-gray-200 dark:border-border rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.2)] z-[9999] overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center bg-gray-50 dark:bg-surface-muted px-4 py-3 border-b border-gray-200 dark:border-border">
            <h3 className="font-bold text-gray-900 dark:text-foreground text-sm">Send Feedback</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-red-500 transition">
              <X size={18} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-muted-foreground mb-1 uppercase tracking-wider">Type of Feedback</label>
              <div className="grid grid-cols-3 gap-2">
                {['BUG', 'FEATURE', 'SUPPORT'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`py-1.5 text-xs font-semibold rounded-md border transition-all ${
                      type === t 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/50' 
                        : 'bg-transparent text-gray-500 border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-surface-muted'
                    }`}
                  >
                    {t === 'BUG' ? 'Bug Report' : t === 'FEATURE' ? 'Feature' : 'Support'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-muted-foreground mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What is this regarding?"
                required
                className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-border text-gray-900 dark:text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-muted-foreground mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe the issue or your idea in detail..."
                required
                rows={4}
                className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-border text-gray-900 dark:text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-sm transition-all disabled:opacity-50"
            >
              {loading ? (
                'Submitting...'
              ) : (
                <>
                  <Send size={16} /> Submit Feedback
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default GlobalFeedbackWidget;
