import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Headphones,
  X,
  Send,
  User,
  GripHorizontal,
  Sparkles,
  LogIn,
  RotateCcw,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react';
import api from '../utils/api';
import useDraggable from '../hooks/useDraggable';
import { useAuth } from '../context/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import SupportChatPanel from './support/SupportChatPanel';
import {
  createInitialMessagesByMode,
  buildChatRequestMessages,
  extractActiveAnalyticsContext,
  mapChatError,
} from '../utils/jahzChatHelpers';

const UnifiedAssistantWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('AI'); // 'AI' | 'SUPPORT'
  const [isCoveredByModal, setIsCoveredByModal] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Separate, mode-isolated AI chat histories
  const [messagesByMode, setMessagesByMode] = useState(createInitialMessagesByMode);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMode, setChatMode] = useState('ANALYTICS'); // 'ANALYTICS' | 'SUPPORT'

  const chatEndRef = useRef(null);
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef(null);
  const requestSeqRef = useRef(0);

  const chatMessages = messagesByMode[chatMode] || [];

  // Draggable Hook Integration
  const {
    isDragging,
    hasMoved,
    containerRef,
    pointerHandlers,
    style,
  } = useDraggable('jahzjournals-unified-widget-pos', { x: 0, y: 0 });

  const abortActiveRequest = useCallback(() => {
    requestSeqRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    inFlightRef.current = false;
    setChatLoading(false);
  }, []);

  // Cleanup any in-flight request on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleButtonClick = (e) => {
    e.stopPropagation();
    if (!hasMoved) {
      setIsOpen((prev) => {
        if (prev) abortActiveRequest();
        return !prev;
      });
    }
  };

  const handleCloseWidget = () => {
    abortActiveRequest();
    setIsOpen(false);
  };

  const handleTabChange = (nextTab) => {
    if (nextTab !== activeTab) {
      if (nextTab !== 'AI') {
        abortActiveRequest();
      }
      setActiveTab(nextTab);
    }
  };

  const handleChatModeChange = (nextMode) => {
    if (nextMode === chatMode) return;
    abortActiveRequest();
    setChatMode(nextMode);
  };

  useEffect(() => {
    if (activeTab === 'AI' && isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesByMode, chatMode, isOpen, activeTab]);

  // Hide widget completely when full-screen modal overlays are open
  useEffect(() => {
    const handleModalVisibility = (e) => {
      setIsCoveredByModal(!!e.detail?.open);
    };
    window.addEventListener('jahz-modal-visibility', handleModalVisibility);
    return () => window.removeEventListener('jahz-modal-visibility', handleModalVisibility);
  }, []);

  const dispatchAiMessage = useCallback(
    async (textToSend, options = {}) => {
      const trimmed = String(textToSend || '').trim();
      const targetMode = options.mode || chatMode;
      const isRetry = Boolean(options.isRetry);

      if (!trimmed || inFlightRef.current || chatLoading) return;

      inFlightRef.current = true;
      setChatLoading(true);
      if (!isRetry) {
        setChatInput('');
      }

      const seq = ++requestSeqRef.current;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const baseHistory = messagesByMode[targetMode] || [];
      const cleanedBaseHistory = isRetry
        ? baseHistory.filter((msg, idx) => !(idx === baseHistory.length - 1 && msg.isError))
        : baseHistory;

      const updatedHistory = isRetry
        ? cleanedBaseHistory
        : [...cleanedBaseHistory, { role: 'user', content: trimmed }];

      setMessagesByMode((prev) => ({
        ...prev,
        [targetMode]: updatedHistory,
      }));

      const requestMessages = buildChatRequestMessages(updatedHistory);
      const contextPayload =
        targetMode === 'ANALYTICS' ? extractActiveAnalyticsContext(location.search) : undefined;

      try {
        const res = await api.post(
          '/ai/chat',
          {
            messages: requestMessages,
            chatMode: targetMode,
            ...(contextPayload ? { context: contextPayload } : {}),
          },
          { signal: controller.signal, timeout: 30000 }
        );

        if (requestSeqRef.current !== seq) return;

        const replyText =
          typeof res.data?.message === 'string' && res.data.message.trim()
            ? res.data.message
            : 'I processed your request, but no response text was returned.';

        setMessagesByMode((prev) => ({
          ...prev,
          [targetMode]: [
            ...(prev[targetMode] || []).filter((m) => !m.isError),
            { role: 'assistant', content: replyText },
          ],
        }));
      } catch (error) {
        if (requestSeqRef.current !== seq) return;
        const mapped = mapChatError(error, targetMode);
        if (mapped.cancelled) return;

        setMessagesByMode((prev) => ({
          ...prev,
          [targetMode]: [
            ...(prev[targetMode] || []).filter((m) => !m.isError),
            {
              role: 'assistant',
              isError: true,
              content: mapped.message,
              errorCode: mapped.code,
              retryable: mapped.retryable,
              retryPrompt: trimmed,
              actionLabel: mapped.actionLabel,
              actionPath: mapped.actionPath,
            },
          ],
        }));
      } finally {
        if (requestSeqRef.current === seq) {
          inFlightRef.current = false;
          abortControllerRef.current = null;
          setChatLoading(false);
        }
      }
    },
    [chatMode, chatLoading, location.search, messagesByMode]
  );

  const handleSendAiMessage = () => {
    dispatchAiMessage(chatInput, { mode: chatMode, isRetry: false });
  };

  return (
    <div
      ref={containerRef}
      style={style}
      className={`fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end transition-transform duration-75 select-none ${
        isDragging ? 'scale-105 cursor-grabbing' : 'cursor-grab'
      } ${isCoveredByModal ? 'hidden' : ''}`}
    >
      {/* Unified Widget Modal Window */}
      {isOpen && (
        <div className="bg-surface border border-border shadow-2xl rounded-2xl w-[min(440px,calc(100vw-24px))] h-[min(650px,calc(100dvh-85px))] min-h-[500px] max-h-[680px] mb-3 sm:mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Draggable Header with AI / Support Mode Switcher */}
          <div
            {...pointerHandlers}
            className="bg-surface border-b border-border px-3.5 py-2.5 flex justify-between items-center cursor-grab active:cursor-grabbing select-none shrink-0"
          >
            <div className="flex items-center gap-2">
              <GripHorizontal size={15} className="text-muted/60 hover:text-muted shrink-0" />
              <div className="flex items-center gap-1 bg-surface-muted/80 p-1 rounded-xl border border-border/50">
                <button
                  type="button"
                  onClick={() => handleTabChange('AI')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'AI'
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  <Bot size={13} />
                  <span>JAHZ AI</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange('SUPPORT')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'SUPPORT'
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  <Headphones size={13} />
                  <span>Support Chat</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseWidget}
              className="text-muted hover:text-foreground hover:bg-surface-muted p-1.5 rounded-lg transition-colors"
              aria-label="Close widget"
              title="Close widget"
            >
              <X size={16} />
            </button>
          </div>

          {/* TAB 1: JAHZ AI CHAT */}
          <div className={`flex-1 min-h-0 flex flex-col bg-background ${activeTab === 'AI' ? '' : 'hidden'}`}>
            {/* Chat Sub-mode Banner */}
            <div className="bg-surface-muted/50 border-b border-border py-1.5 px-3 flex items-center justify-between shrink-0">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleChatModeChange('ANALYTICS')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                    chatMode === 'ANALYTICS'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  Analytics Mode
                </button>
                <button
                  type="button"
                  onClick={() => handleChatModeChange('SUPPORT')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                    chatMode === 'SUPPORT'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  App Support Mode
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 min-h-0 p-3.5 sm:p-4 overflow-y-auto space-y-3 select-text">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      m.role === 'user'
                        ? 'bg-emerald-600 text-white font-bold'
                        : m.isError
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-surface-muted text-emerald-600 dark:text-emerald-400 border border-border'
                    }`}
                  >
                    {m.role === 'user' ? (
                      <User size={13} />
                    ) : m.isError ? (
                      <AlertCircle size={13} />
                    ) : (
                      <Bot size={13} />
                    )}
                  </div>
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[82%] whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-emerald-600 text-white font-normal rounded-tr-none'
                        : m.isError
                        ? 'bg-amber-500/10 text-foreground border border-amber-500/30 rounded-tl-none space-y-2'
                        : 'bg-surface-muted text-foreground border border-border rounded-tl-none'
                    }`}
                  >
                    <div>{m.content}</div>
                    {m.isError && (m.retryable || m.actionPath) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {m.retryable && m.retryPrompt && (
                          <button
                            type="button"
                            disabled={chatLoading}
                            onClick={() => dispatchAiMessage(m.retryPrompt, { mode: chatMode, isRetry: true })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border text-[11px] font-semibold text-foreground hover:bg-surface-muted transition disabled:opacity-50"
                          >
                            <RotateCcw size={11} />
                            <span>Retry</span>
                          </button>
                        )}
                        {m.actionPath && (
                          <button
                            type="button"
                            onClick={() => {
                              handleCloseWidget();
                              navigate(m.actionPath);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-500 transition"
                          >
                            <span>{m.actionLabel || 'Open'}</span>
                            <ArrowUpRight size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-surface-muted text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-border">
                    <Bot size={13} />
                  </div>
                  <div className="p-3 bg-surface-muted border border-border rounded-2xl rounded-tl-none text-xs text-muted animate-pulse">
                    {chatMode === 'ANALYTICS' ? 'Analyzing journal data...' : 'Checking JAHZJOURNALS docs...'}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-2.5 sm:p-3 bg-surface border-t border-border flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendAiMessage();
                  }
                }}
                placeholder={
                  chatMode === 'ANALYTICS'
                    ? 'Ask about your metrics or symbol counts...'
                    : 'Ask how JAHZJOURNALS features work...'
                }
                aria-label="Message JAHZ AI"
                className="flex-1 bg-surface-muted border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleSendAiMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 disabled:opacity-40 transition font-bold shrink-0"
                aria-label="Send AI message"
              >
                <Send size={14} />
              </button>
            </div>
          </div>

          {/* TAB 2: LIVE SUPPORT CHAT WITH SUPER ADMIN */}
          <div className={`flex-1 min-h-0 flex flex-col bg-background ${activeTab === 'SUPPORT' ? '' : 'hidden'}`}>
            {user ? (
              <SupportChatPanel
                compact={true}
                onExpand={() => {
                  handleCloseWidget();
                  navigate('/support');
                }}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <Headphones size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Log in for Direct Support</h4>
                  <p className="text-xs text-muted max-w-xs mt-1 leading-relaxed">
                    Direct 1-on-1 support chat with Super Admin is reserved for logged-in traders.
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseWidget();
                      navigate('/login');
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <LogIn size={13} />
                    <span>Log In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseWidget();
                      navigate('/contact');
                    }}
                    className="px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-muted hover:text-foreground transition"
                  >
                    General Contact
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SINGLE UNIFIED FLOATING BUTTON */}
      {!isOpen && (
        <button
          type="button"
          {...pointerHandlers}
          onClick={handleButtonClick}
          className="relative bg-surface border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 p-3.5 rounded-full shadow-2xl hover:scale-105 transition-all active:scale-95 group flex items-center justify-center ring-2 ring-emerald-500/20"
          aria-label="Open JAHZ Assistant & Support"
          title="Drag to move • Click to open Assistant & Support"
        >
          <div className="relative flex items-center justify-center">
            <Bot size={26} className="text-emerald-600 dark:text-emerald-400 group-hover:rotate-12 transition-transform" />
            <Sparkles size={12} className="absolute -top-1 -right-1 text-amber-500 dark:text-amber-400 animate-pulse" />
          </div>
        </button>
      )}
    </div>
  );
};

export default UnifiedAssistantWidget;
