import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, RefreshCw, ShieldCheck, CheckCheck,
  Search, Bell, ExternalLink, Headphones, Sparkles,
  AlertCircle, MessageSquare,
  Ticket
} from 'lucide-react';
import api, { resolveImageUrl, subscribeToRealtimeSync } from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  isPushNotificationSupported,
  getPushPermissionState,
  enablePushNotifications,
} from '../../utils/pushNotificationHelper';

const TRADER_QUICK_QUESTIONS = [
  {
    label: "Account settings",
    prompt: "I need help updating my account settings or profile details.",
  },
  {
    label: "MT5 synchronization",
    prompt: "I need assistance connecting or troubleshooting MT5 broker sync.",
  },
  {
    label: "Subscription and billing",
    prompt: "I have a question about subscription plans, pricing, or billing.",
  },
  {
    label: "Trading analytics",
    prompt: "I have a question regarding my trading analytics and performance metrics.",
  },
  {
    label: "Report a technical issue",
    prompt: "I would like to report a technical issue or unexpected behavior on the platform.",
  },
];

const ADMIN_QUICK_RESPONSES = [
  {
    label: "Under review",
    prompt: "Hello! We are looking into this right now for you.",
  },
  {
    label: "Account updated",
    prompt: "Your account settings and permissions have been refreshed.",
  },
  {
    label: "Issue resolved",
    prompt: "This issue has been resolved. Please refresh your browser and check now.",
  },
  {
    label: "Request screenshot",
    prompt: "Could you please provide a screenshot or more details of what you're seeing?",
  },
];

const formatDateSeparator = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffTime = today.getTime() - target.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7 && diffDays > 1) {
    return date.toLocaleDateString([], { weekday: 'long' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatMessageTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
};

export default function SupportChatPanel({
  compact = false,
  onExpand = null,
  initialThreadId = null,
  onToggleInfoPanel = null,
  showInfoToggle = false,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(user?.role);

  // Admin view state
  const [adminThreads, setAdminThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(initialThreadId);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(isAdmin && !compact);

  // Active thread & messages state
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [pushState, setPushState] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const justSentRef = useRef(false);
  const textareaRef = useRef(null);

  // Check push notification permission state
  useEffect(() => {
    if (isPushNotificationSupported()) {
      setPushState(getPushPermissionState());
    }
  }, []);

  const handleEnablePush = async () => {
    try {
      await enablePushNotifications();
      setPushState(getPushPermissionState());
      toast.success('Instant browser push alerts activated!');
    } catch (err) {
      toast.error('Failed to enable push notifications: ' + (err.message || 'Permission denied'));
    }
  };

  // Scroll position observer: detects if user is reading older messages
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceToBottom < 80;
  }, []);

  // Smart auto-scroll: only scrolls to bottom if user is already at the bottom or just sent a message
  useEffect(() => {
    if (justSentRef.current || isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      justSentRef.current = false;
    }
  }, [messages]);

  // Initial load
  useEffect(() => {
    if (isAdmin && !compact) {
      fetchAdminThreads();
    } else {
      fetchUserActiveThread();
    }
  }, [isAdmin, compact, initialThreadId]);

  
  const [convertingTicket, setConvertingTicket] = useState(false);

  const handleConvertToTicket = async (thread) => {
    if (!thread) return;
    const confirmConvert = window.confirm(
      `Escalate conversation "${thread.subject || 'Inquiry'}" to an official tracked Support Ticket (#TK-xxxx)?\n\nThis will link this conversation to the Engineering/Support queue and post an official status update in the chat.`
    );
    if (!confirmConvert) return;

    setConvertingTicket(true);
    try {
      const res = await api.post(`/admin/communications/contact/${thread.id}/convert-to-ticket`, {
        category: thread.category,
        priority: thread.priority,
        subject: thread.subject,
        description: thread.message,
      });

      const ticketNum = res.data?.ticketNumber || 'TK-XXXX';
      toast.success(`Escalated to Support Ticket #${ticketNum}!`);

      if (thread.id) {
        await fetchThreadById(thread.id, { silent: true });
      }
      fetchAdminThreads({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to convert to ticket');
    } finally {
      setConvertingTicket(false);
    }
  };

  // Real-time sync + silent polling so replies appear immediately without refresh
  useEffect(() => {
    const syncChatSilently = () => {
      if (isAdmin && !compact) {
        fetchAdminThreads({ silent: true });
        if (selectedThreadId) {
          fetchThreadById(selectedThreadId, { silent: true });
        }
      } else {
        fetchUserActiveThread({ silent: true });
      }
    };

    const unsubscribe = subscribeToRealtimeSync(syncChatSilently);
    window.addEventListener('support:ticket-created', syncChatSilently);
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        syncChatSilently();
      }
    }, 2500);

    return () => {
      window.removeEventListener('support:ticket-created', syncChatSilently);
      unsubscribe();
      clearInterval(interval);
    };
  }, [isAdmin, compact, selectedThreadId, activeThread?.id]);

  // Fetch all threads for Super Admin
  const fetchAdminThreads = async ({ silent = false } = {}) => {
    if (!silent) setLoadingThreads(true);
    try {
      const res = await api.get('/support/threads?adminView=true');
      const threads = res.data || [];
      setAdminThreads(threads);

      // Auto-select first thread or initialThreadId
      if (!silent) {
        let chosen = null;
        if (selectedThreadId) {
          chosen = threads.find((t) => t.id === selectedThreadId);
        }
        if (!chosen && threads.length > 0) {
          chosen = threads[0];
        }
        if (chosen) {
          setSelectedThreadId(chosen.id);
          fetchThreadById(chosen.id, { silent: false });
        } else {
          setLoadingMessages(false);
        }
      }
    } catch (err) {
      console.error('Failed to fetch admin support threads:', err);
      if (!silent) toast.error('Could not load support inquiries.');
    } finally {
      if (!silent) setLoadingThreads(false);
    }
  };

  // Fetch specific thread by ID (used by Super Admin or when opening linked thread)
  const fetchThreadById = async (threadId, { silent = false } = {}) => {
    if (!threadId) return;
    if (!silent) {
      setLoadingMessages(true);
      setSyncing(true);
    }
    try {
      const res = await api.get(`/support/threads/${threadId}`);
      setActiveThread(res.data);
      setMessages(res.data?.threads || []);
      // Clear unread counter locally
      setAdminThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, unreadForAdmin: 0 } : t))
      );
    } catch (err) {
      console.error('Failed to load thread details:', err);
      if (!silent) toast.error('Could not load conversation messages.');
    } finally {
      if (!silent) {
        setLoadingMessages(false);
        setSyncing(false);
      }
    }
  };

  // Fetch or create logged-in user's active direct conversation
  const fetchUserActiveThread = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoadingMessages(true);
      setSyncing(true);
    }
    try {
      const res = await api.get('/support/my-thread');
      const thread = res.data;
      setActiveThread(thread);
      setMessages(thread?.threads || []);
      setSelectedThreadId(thread?.id);
    } catch (err) {
      console.error('Failed to load user support thread:', err);
      if (!silent) toast.error('Could not connect to support channel.');
    } finally {
      if (!silent) {
        setLoadingMessages(false);
        setSyncing(false);
      }
    }
  };

  // Send message handler
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const textToSend = messageText.trim();
    if (!textToSend || sending) return;

    setSending(true);
    justSentRef.current = true;

    try {
      const payload = {
        message: textToSend,
        threadId: activeThread?.id || selectedThreadId,
      };

      const res = await api.post('/support/message', payload);
      const newMsg = res.data?.data;

      if (newMsg) {
        setMessages((prev) => [...prev, newMsg]);
      }

      // Clear input only upon verified success
      setMessageText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      // Refresh threads to update order and lastMessageAt
      if (isAdmin && !compact) {
        fetchAdminThreads({ silent: true });
      } else if (activeThread?.id) {
        fetchThreadById(activeThread.id, { silent: true });
      }
    } catch (err) {
      console.error('Failed to send support message:', err);
      toast.error(err.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleChipClick = (promptText) => {
    setMessageText(promptText);
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Adjust height to fit prompt text
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
      }, 0);
    }
  };

  // Filtered threads for Super Admin sidebar
  const filteredThreads = adminThreads.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.subject?.toLowerCase().includes(q) ||
      t.user?.name?.toLowerCase().includes(q)
    );
  });

  const quickQuestions = isAdmin ? ADMIN_QUICK_RESPONSES : TRADER_QUICK_QUESTIONS;

  // -------------------------------------------------------------
  // RENDER: SUPER ADMIN VIEW (SPLIT INBOX LAYOUT)
  // -------------------------------------------------------------
  if (isAdmin && !compact) {
    return (
      <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs grid grid-cols-1 lg:grid-cols-12 h-[calc(100dvh-180px)] min-h-[580px] max-h-[820px]">
        {/* Left Column: Trader Conversations List */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-border flex flex-col bg-surface-muted/20 min-h-0">
          {/* Search & Actions Header */}
          <div className="p-3.5 border-b border-border space-y-2 bg-surface shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                <ShieldCheck size={15} className="text-emerald-500" />
                <span>Trader Inquiries</span>
              </div>
              <button
                type="button"
                onClick={() => fetchAdminThreads()}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-muted transition"
                title="Sync inquiries"
                aria-label="Sync conversations"
              >
                <RefreshCw size={13} className={loadingThreads ? 'animate-spin text-emerald-500' : ''} />
              </button>
            </div>

            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search trader or email..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {loadingThreads ? (
              <div className="p-8 text-center text-xs text-muted">
                Loading trader conversations...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted space-y-1">
                <p className="font-semibold text-foreground">No conversations found</p>
                <p>Support inquiries submitted by registered traders will appear here in real-time.</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = selectedThreadId === thread.id;
                const traderUser = thread.user || {};
                const displayName = traderUser.name || thread.name || 'Trader';
                const displayEmail = traderUser.email || thread.email || '';
                const unread = thread.unreadForAdmin || 0;

                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => {
                      setSelectedThreadId(thread.id);
                      fetchThreadById(thread.id);
                    }}
                    className={`w-full p-3.5 text-left transition flex items-start gap-3 ${
                      isSelected
                        ? 'bg-emerald-500/10 border-l-4 border-l-emerald-500'
                        : 'hover:bg-surface-muted/50'
                    }`}
                  >
                    {traderUser.avatarUrl ? (
                      <img
                        src={resolveImageUrl(traderUser.avatarUrl)}
                        alt={displayName}
                        className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/20">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-foreground truncate">
                          {displayName}
                        </span>
                        {unread > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px] font-black shrink-0">
                            {unread} new
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted truncate">{displayEmail}</p>
                      <p className="text-[11px] text-foreground/80 truncate mt-1">
                        {thread.subject ? `${thread.subject}: ` : ''}
                        {thread.message || 'Support inquiry'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation */}
        <div className="lg:col-span-8 flex flex-col bg-background/50 min-h-0">
          {!activeThread ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted">
              <Headphones size={36} className="mb-2 opacity-40 text-emerald-500" />
              <p className="text-sm font-bold text-foreground">Select a conversation</p>
              <p className="text-xs max-w-xs mt-1">
                Choose a trader on the left to review their inquiry and respond in real-time.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-3.5 sm:px-5 border-b border-border bg-surface flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/20">
                    {(activeThread.user?.name || activeThread.name || 'T').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground truncate">
                        {activeThread.user?.name || activeThread.name}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        {activeThread.user?.subscriptionPlan || 'Trader'}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted truncate">
                      {activeThread.user?.email || activeThread.email} &bull; Channel ID: {activeThread.id?.slice(0, 8)}
                    </p>
                  </div>
                </div>

                
                <button
                  type="button"
                  onClick={() => handleConvertToTicket(activeThread)}
                  disabled={convertingTicket}
                  className="px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold text-amber-400 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  title="Escalate conversation to official Support Ticket (#TK-xxxx)"
                >
                  <Ticket size={12} />
                  <span>{convertingTicket ? 'Escalating...' : 'Convert to Ticket'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fetchThreadById(activeThread.id)}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-surface-muted/40 hover:bg-surface-muted text-xs text-muted hover:text-foreground flex items-center gap-1 transition"
                  title="Sync conversation"
                  aria-label="Sync conversation"
                >
                  <RefreshCw size={12} className={syncing ? 'animate-spin text-emerald-500' : ''} />
                  <span className="hidden sm:inline">Sync</span>
                </button>
              </div>

              {/* Messages Stream */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {loadingMessages ? (
                  <div className="py-12 text-center text-xs text-muted">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted">
                    No messages yet in this conversation.
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isStaff = msg.senderType === 'ADMIN';
                    const prevMsg = messages[index - 1];
                    const showDateSeparator =
                      !prevMsg ||
                      new Date(prevMsg.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

                    return (
                      <React.Fragment key={msg.id || index}>
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-3 select-none">
                            <span className="px-3 py-0.5 rounded-full text-[10px] font-semibold bg-surface border border-border text-muted shadow-2xs">
                              {formatDateSeparator(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        <div className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                              isStaff
                                ? 'bg-emerald-600 text-white rounded-br-xs font-normal'
                                : 'bg-surface border border-border text-foreground rounded-bl-xs'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-muted select-none">
                            <span className="font-semibold">
                              {isStaff ? 'Super Admin (You)' : msg.senderName || activeThread.name || 'Trader'}
                            </span>
                            <span>&bull;</span>
                            <span>{formatMessageTime(msg.createdAt)}</span>
                            {isStaff && <CheckCheck size={12} className="text-emerald-500" />}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Admin Responses Chips */}
              <div className="px-4 py-2 border-t border-border/60 bg-surface/70 shrink-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Quick responses</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {quickQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleChipClick(q.prompt)}
                      className="px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-emerald-500/40 text-[11px] text-muted hover:text-foreground transition font-medium text-left"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Composer */}
              <div className="p-3 sm:p-4 border-t border-border bg-surface shrink-0">
                <div className="flex items-end gap-2 bg-background border border-border rounded-2xl p-2 focus-within:border-emerald-500 transition shadow-2xs">
                  <textarea
                    ref={textareaRef}
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Reply to ${activeThread.user?.name || activeThread.name}...`}
                    rows={1}
                    className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted focus:outline-none resize-none max-h-[120px] py-1 px-2 leading-relaxed"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={sending || !messageText.trim()}
                    className="h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs shrink-0"
                    aria-label="Send reply"
                  >
                    <Send size={13} className={sending ? 'animate-pulse' : ''} />
                    <span>{sending ? 'Sending...' : 'Send'}</span>
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted px-2 mt-1.5 select-none">
                  <span className="hidden sm:inline">Press Enter to send, Shift + Enter for new line</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: LOGGED-IN TRADER VIEW (PRIMARY CHAT EXPERIENCE)
  // -------------------------------------------------------------
  return (
    <div
      className={`overflow-hidden flex flex-col ${
        compact
          ? 'flex-1 min-h-0 bg-background'
          : 'rounded-2xl border border-border bg-surface shadow-xs h-[calc(100dvh-180px)] min-h-[580px] max-h-[820px]'
      }`}
    >
      {/* 1. Conversation Header */}
      <div
        className={`border-b border-border bg-surface flex items-center justify-between gap-2.5 shrink-0 select-none ${
          compact ? 'px-3.5 py-2.5' : 'p-3.5 sm:px-5 bg-surface-muted/30'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <div className="relative shrink-0">
            <div
              className={`rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 ${
                compact ? 'w-8 h-8' : 'w-10 h-10 rounded-2xl'
              }`}
            >
              <Headphones size={compact ? 16 : 20} />
            </div>
            {/* Status indicator dot */}
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface"
              title="Monitored daily"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                JAHZ Support
              </h4>
              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <ShieldCheck size={10} className="text-emerald-500" />
                <span>{compact ? 'Admin' : 'Super Admin Support'}</span>
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted truncate mt-0.5">
              {compact ? 'Super Admin Support • Monitored daily' : 'Direct 1-on-1 Channel • Super Admin Monitored'}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {pushState === 'default' && !compact && (
            <button
              type="button"
              onClick={handleEnablePush}
              className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-xl border border-emerald-500/20 transition"
              title="Enable browser push notifications"
            >
              <Bell size={12} />
              <span>Enable Push Alerts</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchUserActiveThread()}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border border-border bg-surface-muted/40 hover:bg-surface-muted text-xs text-muted hover:text-foreground flex items-center gap-1 transition"
            title="Sync conversation messages"
            aria-label="Sync conversation"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin text-emerald-500' : ''} />
            {!compact && <span className="hidden sm:inline">Sync</span>}
          </button>

          {showInfoToggle && onToggleInfoPanel && (
            <button
              type="button"
              onClick={onToggleInfoPanel}
              className="lg:hidden p-1.5 rounded-lg border border-border bg-surface-muted/40 hover:bg-surface-muted text-xs text-muted hover:text-foreground transition"
              title="Toggle support details"
              aria-label="Toggle support details"
            >
              <MessageSquare size={14} />
            </button>
          )}

          {compact && onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="p-1.5 rounded-lg border border-border bg-surface-muted/40 hover:bg-surface-muted text-xs text-muted hover:text-foreground transition"
              title="Open full Support Desk (/support)"
              aria-label="Open full Support Desk"
            >
              <ExternalLink size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Messages Stream */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto overflow-x-hidden space-y-3 bg-background/50 min-h-0 ${
          compact ? 'p-3 sm:p-3.5' : 'p-4 sm:p-5 space-y-4'
        }`}
      >
        {loadingMessages ? (
          <div className="py-12 text-center text-xs text-muted flex flex-col items-center justify-center space-y-2">
            <RefreshCw size={16} className="animate-spin text-emerald-500 opacity-80" />
            <span>Connecting to support channel...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className={`text-center space-y-2.5 max-w-sm mx-auto ${compact ? 'py-6 px-2' : 'py-12'}`}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
              <Sparkles size={compact ? 18 : 22} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-foreground">
                How can we assist you today?
              </h3>
              <p className="text-[11px] sm:text-xs text-muted mt-1 leading-relaxed">
                Send a message directly to JAHZ Super Admin. Whether you have questions on MT5 sync, prop firm challenge tracking, or account billing, we are here to help.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMine = msg.senderType === 'USER';
            const prevMsg = messages[index - 1];
            const showDateSeparator =
              !prevMsg ||
              new Date(prevMsg.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

            return (
              <React.Fragment key={msg.id || index}>
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-2 select-none">
                    <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-surface border border-border text-muted shadow-2xs">
                      {formatDateSeparator(msg.createdAt)}
                    </span>
                  </div>
                )}

                <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs ${
                      isMine
                        ? 'bg-emerald-600 text-white rounded-br-xs font-normal'
                        : 'bg-surface border border-border text-foreground rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 px-1 text-[9.5px] text-muted select-none">
                    <span className="font-semibold">
                      {isMine ? 'You' : (
                        <span className="inline-flex items-center gap-1">
                          <span>{msg.senderName || 'JAHZ Support'}</span>
                          <span className="text-[8.5px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">Admin</span>
                        </span>
                      )}
                    </span>
                    <span>&bull;</span>
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {isMine && <CheckCheck size={11} className="text-emerald-500" />}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Quick Questions Chips (Multi-line wrap, no horizontal scrollbar) */}
      <div
        className={`border-t border-border/60 bg-surface/90 shrink-0 select-none ${
          compact ? 'px-3 py-1.5' : 'px-4 py-2.5 bg-surface/80'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-muted">
            Quick questions
          </span>
          <span className="text-[9.5px] sm:text-[10px] text-muted">Click to draft</span>
        </div>
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleChipClick(q.prompt)}
              className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-surface hover:bg-surface-muted border border-border hover:border-emerald-500/40 text-[10px] sm:text-[11px] text-muted hover:text-foreground transition font-medium text-left truncate max-w-full"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Message Composer */}
      <div
        className={`border-t border-border bg-surface shrink-0 ${
          compact ? 'p-2 sm:p-2.5' : 'p-3 sm:p-4'
        }`}
      >
        <div className="flex items-end gap-1.5 sm:gap-2 bg-background border border-border rounded-xl sm:rounded-2xl p-1.5 sm:p-2 focus-within:border-emerald-500 transition shadow-2xs">
          <textarea
            ref={textareaRef}
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, compact ? 90 : 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Write a message to JAHZ Support..."
            rows={1}
            className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted focus:outline-none resize-none max-h-[90px] py-1 px-2 leading-relaxed"
            disabled={sending}
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={sending || !messageText.trim()}
            className="h-8 px-3 rounded-lg sm:rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs shrink-0"
            aria-label="Send message"
          >
            <Send size={12} className={sending ? 'animate-pulse' : ''} />
            <span className={compact ? 'inline' : 'hidden sm:inline'}>{sending ? 'Sending...' : 'Send'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[9.5px] text-muted px-1 mt-1 select-none">
          <span>Enter to send &bull; Shift+Enter for new line</span>
          <span className="hidden sm:inline text-muted/70">Encrypted direct channel</span>
        </div>
      </div>
    </div>
  );
}
