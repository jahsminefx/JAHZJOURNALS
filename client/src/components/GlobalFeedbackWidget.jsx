import React, { useState } from 'react';
import { MessageSquarePlus, X, Send, GripHorizontal } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import useDraggable from '../hooks/useDraggable';

const GlobalFeedbackWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState('SUPPORT');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Draggable hook integration
  const { 
    pos, 
    isDragging, 
    hasMoved, 
    containerRef, 
    pointerHandlers, 
    style 
  } = useDraggable('jahzjournals-widget-pos-feedback', { x: 0, y: 0 });

  const handleButtonClick = (e) => {
    e.stopPropagation();
    if (!hasMoved) {
      setIsOpen((prev) => !prev);
    }
  };

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
    <div
      ref={containerRef}
      style={style}
      className={`fixed bottom-20 right-5 lg:bottom-6 lg:right-6 z-[9999] transition-transform duration-75 select-none ${
        isDragging ? 'scale-105 cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Floating Action Button */}
      <button
        type="button"
        {...pointerHandlers}
        onClick={handleButtonClick}
        className={`p-3.5 md:p-4 rounded-full bg-emerald-600 text-white shadow-2xl hover:bg-emerald-500 transition-all flex items-center justify-center relative group active:scale-95 ${
          isOpen ? 'ring-4 ring-emerald-500/30' : ''
        }`}
        aria-label="Report issue or request feature"
        title="Drag to move • Click to send feedback"
      >
        <MessageSquarePlus size={22} className={isDragging ? 'animate-pulse' : ''} />
      </button>

      {/* Interactive Modal / Dialog */}
      {isOpen && (
        <div 
          className="absolute bottom-16 right-0 w-[90vw] max-w-[380px] bg-white dark:bg-surface border border-gray-200 dark:border-border rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.35)] overflow-hidden animate-in slide-in-from-bottom-3 z-[9999]"
        >
          {/* Draggable Header */}
          <div 
            {...pointerHandlers}
            className="flex justify-between items-center bg-gray-100 dark:bg-surface-muted px-4 py-3 border-b border-gray-200 dark:border-border cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2 text-gray-700 dark:text-foreground">
              <GripHorizontal size={16} className="text-muted" />
              <h3 className="font-bold text-sm">Send Feedback</h3>
            </div>
            <button 
              type="button" 
              onClick={() => setIsOpen(false)} 
              className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-md"
              aria-label="Close feedback modal"
            >
              <X size={18} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-muted-foreground mb-1 uppercase tracking-wider">
                Type of Feedback
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['BUG', 'FEATURE', 'SUPPORT'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      type === t 
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/50 font-bold' 
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
                className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-border text-gray-900 dark:text-foreground rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
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
                className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-border text-gray-900 dark:text-foreground rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 shadow-md"
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
    </div>
  );
};

export default GlobalFeedbackWidget;
