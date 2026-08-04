import React, { useState, useRef, useEffect } from 'react';
import { Bot, MessageSquarePlus, X, Send, User, AlertCircle, GripHorizontal, Sparkles } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import useDraggable from '../hooks/useDraggable';

const UnifiedAssistantWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('AI'); // 'AI' | 'FEEDBACK'

  // AI Chat State
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hello! I am JAHZ AI. Ask me about your trading metrics or platform features!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMode, setChatMode] = useState('ANALYTICS');
  const chatEndRef = useRef(null);

  // Feedback State
  const [feedbackType, setFeedbackType] = useState('SUPPORT');
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Draggable Hook Integration
  const { 
    isDragging, 
    hasMoved, 
    containerRef, 
    pointerHandlers, 
    style 
  } = useDraggable('jahzjournals-unified-widget-pos', { x: 0, y: 0 });

  const handleButtonClick = (e) => {
    e.stopPropagation();
    if (!hasMoved) {
      setIsOpen((prev) => !prev);
    }
  };

  useEffect(() => {
    if (activeTab === 'AI') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen, activeTab]);

  const handleSendAiMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const newMsgs = [...chatMessages, { role: 'user', content: chatInput.trim() }];
    setChatMessages(newMsgs);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await api.post('/ai/chat', { messages: newMsgs, chatMode });
      setChatMessages([...newMsgs, { role: 'assistant', content: res.data.message }]);
    } catch (error) {
      setChatMessages([...newMsgs, { role: 'assistant', content: 'Connection issue. Could not reach analytics.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackSubject.trim() || !feedbackDescription.trim()) {
      return toast.error("Please provide both a subject and a description.");
    }

    setFeedbackLoading(true);
    try {
      await api.post('/feedback', { 
        type: feedbackType, 
        subject: feedbackSubject, 
        description: feedbackDescription 
      });
      toast.success("Feedback submitted successfully! Our team will review this shortly.");
      setFeedbackSubject('');
      setFeedbackDescription('');
      setIsOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      style={style}
      className={`fixed bottom-6 right-6 z-[9999] flex flex-col items-end transition-transform duration-75 select-none ${
        isDragging ? 'scale-105 cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Unified Widget Modal Window */}
      {isOpen && (
        <div className="bg-surface border border-border shadow-2xl rounded-2xl w-[90vw] sm:w-[400px] mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          
          {/* Draggable Header */}
          <div 
            {...pointerHandlers}
            className="bg-slate-950 dark:bg-slate-900 border-b border-border p-3.5 flex justify-between items-center cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2">
              <GripHorizontal size={16} className="text-muted" />
              <div className="flex items-center gap-1.5 bg-surface-muted/60 p-1 rounded-xl border border-border/50">
                <button
                  type="button"
                  onClick={() => setActiveTab('AI')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'AI' 
                      ? 'bg-emerald-500 text-slate-950 shadow-xs' 
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  <Bot size={14} />
                  <span>JAHZ AI</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setActiveTab('FEEDBACK')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'FEEDBACK' 
                      ? 'bg-emerald-500 text-slate-950 shadow-xs' 
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  <MessageSquarePlus size={14} />
                  <span>Send Feedback</span>
                </button>
              </div>
            </div>

            <button 
              type="button" 
              onClick={() => setIsOpen(false)} 
              className="text-muted hover:text-foreground p-1 rounded-lg transition-colors"
              aria-label="Close widget"
            >
              <X size={18} />
            </button>
          </div>

          {/* TAB 1: JAHZ AI CHAT */}
          {activeTab === 'AI' && (
            <div className="flex flex-col h-[420px] bg-background">
              {/* Chat Sub-mode Banner */}
              <div className="bg-surface-muted/50 border-b border-border p-2 flex items-center justify-between px-3">
                <div className="flex gap-1">
                  <button 
                    onClick={() => setChatMode('ANALYTICS')} 
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                      chatMode === 'ANALYTICS' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    Analytics Mode
                  </button>
                  <button 
                    onClick={() => setChatMode('SUPPORT')} 
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                      chatMode === 'SUPPORT' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    App Support Mode
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      m.role === 'user' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-surface-muted text-emerald-400 border border-border'
                    }`}>
                      {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[80%] ${
                      m.role === 'user' 
                        ? 'bg-emerald-500 text-slate-950 font-semibold rounded-tr-none' 
                        : 'bg-surface-muted text-foreground border border-border rounded-tl-none'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-surface-muted text-emerald-400 flex items-center justify-center shrink-0 border border-border">
                      <Bot size={14} />
                    </div>
                    <div className="p-3 bg-surface-muted border border-border rounded-2xl rounded-tl-none text-xs text-muted animate-pulse">
                      Analyzing...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-3 bg-surface border-t border-border flex items-center gap-2">
                <input 
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendAiMessage()}
                  placeholder={chatMode === 'ANALYTICS' ? "Ask about your metrics..." : "Ask how to use features..."}
                  className="flex-1 bg-surface-muted border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                />
                <button 
                  onClick={handleSendAiMessage} 
                  disabled={chatLoading || !chatInput.trim()} 
                  className="p-2 bg-emerald-500 text-slate-950 rounded-xl hover:bg-emerald-400 disabled:opacity-40 transition font-bold"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SEND FEEDBACK */}
          {activeTab === 'FEEDBACK' && (
            <form onSubmit={handleFeedbackSubmit} className="p-4 space-y-4 bg-background h-[420px] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                  Type of Feedback
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['BUG', 'FEATURE', 'SUPPORT'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFeedbackType(t)}
                      className={`py-1.5 text-xs font-bold rounded-xl border transition-all ${
                        feedbackType === t 
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' 
                          : 'bg-surface-muted text-muted border-border hover:text-foreground'
                      }`}
                    >
                      {t === 'BUG' ? 'Bug Report' : t === 'FEATURE' ? 'Feature' : 'Support'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted mb-1">Subject</label>
                <input
                  type="text"
                  value={feedbackSubject}
                  onChange={(e) => setFeedbackSubject(e.target.value)}
                  placeholder="Summary of issue or idea..."
                  required
                  className="w-full bg-surface-muted border border-border text-foreground rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted mb-1">Description</label>
                <textarea
                  value={feedbackDescription}
                  onChange={(e) => setFeedbackDescription(e.target.value)}
                  placeholder="Describe details here..."
                  required
                  rows={4}
                  className="w-full bg-surface-muted border border-border text-foreground rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={feedbackLoading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all disabled:opacity-50 shadow-xs"
              >
                {feedbackLoading ? 'Submitting...' : <><Send size={14} /> Submit Feedback</>}
              </button>
            </form>
          )}

        </div>
      )}

      {/* SINGLE UNIFIED FLOATING BUTTON */}
      {!isOpen && (
        <button 
          type="button"
          {...pointerHandlers}
          onClick={handleButtonClick}
          className="relative bg-slate-950 dark:bg-surface border border-emerald-500/40 text-emerald-400 p-3.5 rounded-full shadow-2xl hover:scale-105 transition-all active:scale-95 group flex items-center justify-center ring-2 ring-emerald-500/20"
          aria-label="Open JAHZ Assistant & Support"
          title="Drag to move • Click to open Assistant & Support"
        >
          <div className="relative flex items-center justify-center">
            <Bot size={26} className="text-emerald-400 group-hover:rotate-12 transition-transform" />
            <Sparkles size={12} className="absolute -top-1 -right-1 text-amber-400 animate-pulse" />
          </div>
        </button>
      )}
    </div>
  );
};

export default UnifiedAssistantWidget;
