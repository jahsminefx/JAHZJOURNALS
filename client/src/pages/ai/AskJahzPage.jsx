import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bot,
  Send,
  User,
  AlertCircle,
  MessageSquare,
  Sparkles,
  RotateCcw,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import AiTradeCaptureModal from '../../components/trades/AiTradeCaptureModal';
import api from '../../utils/api';
import {
  createInitialMessagesByMode,
  buildChatRequestMessages,
  extractActiveAnalyticsContext,
  mapChatError
} from '../../utils/jahzChatHelpers';

const AskJahzPage = () => {
  const [messagesByMode, setMessagesByMode] = useState(createInitialMessagesByMode);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMode, setChatMode] = useState('ANALYTICS');
  const [showAiCapture, setShowAiCapture] = useState(false);
  const [lastFailedByMode, setLastFailedByMode] = useState({ ANALYTICS: null, SUPPORT: null });

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const endRef = useRef(null);
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef(null);
  const requestSeqRef = useRef(0);

  const messages = messagesByMode[chatMode] || [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesByMode, chatMode, loading]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleModeChange = (nextMode) => {
    if (nextMode === chatMode) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    inFlightRef.current = false;
    setLoading(false);
    setChatMode(nextMode);
  };

  const sendPrompt = async (rawText, targetMode = chatMode, options = {}) => {
    const trimmed = typeof rawText === 'string' ? rawText.trim() : '';
    if (!trimmed || inFlightRef.current) return;

    const currentHistory = messagesByMode[targetMode] || [];
    const userMessage = { role: 'user', content: trimmed };
    const nextConversation = [...currentHistory, userMessage];

    inFlightRef.current = true;
    const seq = ++requestSeqRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!options.skipUserAppend) {
      setMessagesByMode((prev) => ({
        ...prev,
        [targetMode]: [...(prev[targetMode] || []).filter((m) => !m.isError), userMessage]
      }));
      setInput('');
    } else {
      setMessagesByMode((prev) => ({
        ...prev,
        [targetMode]: (prev[targetMode] || []).filter((m) => !m.isError)
      }));
    }

    setLastFailedByMode((prev) => ({ ...prev, [targetMode]: null }));
    setLoading(true);

    try {
      const cleanMessages = options.skipUserAppend
        ? buildChatRequestMessages(currentHistory)
        : buildChatRequestMessages(nextConversation);

      const context =
        targetMode === 'ANALYTICS' ? extractActiveAnalyticsContext(searchParams) : undefined;

      const payload = {
        messages: cleanMessages,
        chatMode: targetMode,
        ...(context ? { context } : {})
      };

      const res = await api.post('/ai/chat', payload, {
        signal: controller.signal,
        timeout: 30000
      });

      if (requestSeqRef.current !== seq) return;

      const replyText =
        typeof res?.data?.message === 'string' && res.data.message.trim()
          ? res.data.message.trim()
          : 'JAHZ AI returned an empty response. Please try again.';

      setMessagesByMode((prev) => ({
        ...prev,
        [targetMode]: [...(prev[targetMode] || []), { role: 'assistant', content: replyText }]
      }));
    } catch (error) {
      const mapped = mapChatError(error, targetMode);
      if (mapped.cancelled || requestSeqRef.current !== seq) {
        return;
      }

      if (mapped.retryable) {
        setLastFailedByMode((prev) => ({ ...prev, [targetMode]: trimmed }));
      }

      setMessagesByMode((prev) => ({
        ...prev,
        [targetMode]: [
          ...(prev[targetMode] || []),
          {
            role: 'assistant',
            content: mapped.message,
            isError: true,
            errorMeta: mapped
          }
        ]
      }));
    } finally {
      if (requestSeqRef.current === seq) {
        inFlightRef.current = false;
        abortControllerRef.current = null;
        setLoading(false);
      }
    }
  };

  const handleSend = () => {
    sendPrompt(input, chatMode);
  };

  const handleRetry = () => {
    const retryText = lastFailedByMode[chatMode];
    if (!retryText || inFlightRef.current) return;
    sendPrompt(retryText, chatMode, { skipUserAppend: true });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg">
            <MessageSquare size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">JAHZ AI</h1>
            <p className="text-xs text-muted">
              Your JAHZJOURNALS trading journal analyst &amp; platform guide
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAiCapture(true)}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Sparkles size={14} className="text-amber-300" />
            Log Trade with AI
          </button>

          <div className="flex bg-surface-muted border border-border p-1 rounded-lg">
            <button
              type="button"
              aria-pressed={chatMode === 'ANALYTICS'}
              onClick={() => handleModeChange('ANALYTICS')}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                chatMode === 'ANALYTICS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Analytics Mode
            </button>
            <button
              type="button"
              aria-pressed={chatMode === 'SUPPORT'}
              onClick={() => handleModeChange('SUPPORT')}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                chatMode === 'SUPPORT'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Support Mode
            </button>
          </div>
        </div>
      </div>

      <AiTradeCaptureModal
        isOpen={showAiCapture}
        onClose={() => setShowAiCapture(false)}
      />

      {/* Mode Banner */}
      <div className="bg-blue-500/10 border-b border-blue-500/20 px-6 py-2 flex items-center justify-center gap-2 shrink-0">
        <AlertCircle size={14} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
          {chatMode === 'ANALYTICS'
            ? 'Analytics Mode reads your JAHZJOURNALS trades and prop-firm rules directly (no signals or market predictions).'
            : 'Support Mode answers questions using verified JAHZJOURNALS workflows, pages, and plan limits.'}
        </p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : m.isError
                      ? 'bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300'
                      : 'bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:bg-slate-800 dark:border-transparent dark:text-amber-400'
                }`}
              >
                {m.role === 'user' ? (
                  <User size={20} />
                ) : m.isError ? (
                  <ShieldAlert size={20} />
                ) : (
                  <Bot size={24} />
                )}
              </div>
              <div
                className={`p-4 rounded-2xl max-w-[85%] sm:max-w-[75%] shadow-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : m.isError
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 rounded-tl-none'
                      : 'bg-surface border border-border text-foreground rounded-tl-none'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm md:text-base">{m.content}</p>
                {m.isError && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {m.errorMeta?.retryable && lastFailedByMode[chatMode] && (
                      <button
                        type="button"
                        onClick={handleRetry}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                      >
                        <RotateCcw size={12} />
                        Retry
                      </button>
                    )}
                    {m.errorMeta?.actionLabel && m.errorMeta?.actionPath && (
                      <button
                        type="button"
                        onClick={() => navigate(m.errorMeta.actionPath)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-muted hover:bg-surface border border-border text-foreground text-xs font-medium transition-colors"
                      >
                        {m.errorMeta.actionLabel}
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:bg-slate-800 dark:border-transparent dark:text-amber-400 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Bot size={24} />
              </div>
              <div className="p-4 bg-surface border border-border rounded-2xl rounded-tl-none text-muted text-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-surface border-t border-border p-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!loading && !inFlightRef.current) {
                  handleSend();
                }
              }
            }}
            placeholder={
              chatMode === 'ANALYTICS'
                ? "Ask about your trades or rules (e.g. 'What is my win rate on XAUUSD?')"
                : 'Ask how JAHZJOURNALS works...'
            }
            className="flex-1 bg-surface-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none max-h-32 min-h-[50px]"
            rows={1}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-500 disabled:opacity-50 disabled:shadow-none transition-all"
          >
            <Send size={20} />
          </button>
        </div>
        <p className="text-center text-[10px] text-muted mt-2">
          JAHZ AI summarizes your journal data and verified platform workflows — not financial advice or trade signals.
        </p>
      </div>
    </div>
  );
};

export default AskJahzPage;
