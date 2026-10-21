import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, RefreshCw, User, GraduationCap,
  CheckCheck, Clock, Sparkles, Search, TrendingUp, X
} from 'lucide-react';
import api, { resolveImageUrl, subscribeToRealtimeSync } from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/useAuth';

const MENTOR_QUICK_PROMPTS = [
  "Check today's shared trade setup in the academy feed!",
  "Great risk discipline and execution on your recent trades.",
  "Let's keep risk strictly within the 1% cohort rule this week.",
  "How are you finding this week's London session price action?",
];

const STUDENT_QUICK_PROMPTS = [
  "Hi Coach, I have a question about the shared trade setup.",
  "Could you review my latest journal entry when you have a moment?",
  "I logged your shared setup into my journal to study the entry confluence.",
  "Thank you for the feedback on my trade!",
];

export default function MentorStudentChatPanel({
  cohortId: cohortIdProp = 'ALL',
  activeGroup = null,
  initialStudentId = null,
  initialGroupId = null,
  referencedTrade: referencedTradeProp = null,
  referencedTradeShare = null,
  onClearReferencedTrade: onClearReferencedTradeProp = null,
  onClearReference = null,
  onUnreadChange = null,
}) {
  const cohortId = cohortIdProp !== 'ALL' ? cohortIdProp : (activeGroup?.id || 'ALL');
  const referencedTrade = referencedTradeProp || referencedTradeShare;
  const onClearReferencedTrade = onClearReferencedTradeProp || onClearReference;
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchThreads();
  }, [cohortId, initialStudentId, initialGroupId]);

  useEffect(() => {
    if (referencedTrade && !messageText) {
      const snap = referencedTrade.tradeSnapshot || {};
      setMessageText(
        `Regarding shared setup "${referencedTrade.title || `${snap.pair || ''} ${snap.direction || ''}`}": `
      );
    }
  }, [referencedTrade]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Real-time cross-tab sync + silent polling so chat messages appear immediately without refresh
  useEffect(() => {
    const syncChatSilently = () => {
      fetchThreads({ silent: true });
      if (activeThread) {
        fetchMessagesForThread(activeThread, { silent: true });
      }
    };

    const unsubscribe = subscribeToRealtimeSync(syncChatSilently);
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        syncChatSilently();
      }
    }, 2500);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [cohortId, activeThread?.threadKey]);

  const fetchThreads = async ({ silent = false } = {}) => {
    if (!silent) setLoadingThreads(true);
    try {
      const params = {};
      if (cohortId && cohortId !== 'ALL') {
        params.cohortId = cohortId;
      }
      const { data } = await api.get('/mentors/chat/threads', { params });
      const loadedThreads = data?.threads || [];
      setThreads(loadedThreads);
      if (onUnreadChange) {
        onUnreadChange(data?.totalUnread || 0);
      }

      if (!silent) {
        if (loadedThreads.length > 0) {
          let target = null;
          if (initialStudentId && initialGroupId) {
            target = loadedThreads.find(
              (t) => t.studentId === initialStudentId && t.mentorGroupId === initialGroupId
            );
          } else if (initialStudentId) {
            target = loadedThreads.find((t) => t.studentId === initialStudentId);
          } else if (activeThread) {
            target = loadedThreads.find((t) => t.threadKey === activeThread.threadKey);
          }
          const chosen = target || loadedThreads[0];
          setActiveThread(chosen);
          fetchMessagesForThread(chosen);
        } else {
          setActiveThread(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to load chat threads:', err);
    } finally {
      if (!silent) setLoadingThreads(false);
    }
  };

  const fetchMessagesForThread = async (thread, { silent = false } = {}) => {
    if (!thread) return;
    if (!silent) setLoadingMessages(true);
    try {
      const { data } = await api.get(
        `/mentors/groups/${thread.mentorGroupId}/students/${thread.studentId}/messages`
      );
      setMessages(data?.messages || []);
      // Clear unread badge locally for this thread
      setThreads((prev) => {
        const updated = prev.map((t) =>
          t.threadKey === thread.threadKey ? { ...t, unreadCount: 0 } : t
        );
        if (onUnreadChange) {
          const newTotal = updated.reduce((sum, item) => sum + (item.unreadCount || 0), 0);
          onUnreadChange(newTotal);
        }
        return updated;
      });
    } catch (err) {
      console.error('Failed to load messages:', err);
      if (!silent) toast.error('Could not load conversation messages.');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  const handleSelectThread = (thread) => {
    setActiveThread(thread);
    fetchMessagesForThread(thread);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!activeThread || !messageText.trim()) return;

    setSending(true);
    try {
      const payload = {
        content: messageText.trim(),
        tradeShareId: referencedTrade?.id || null,
      };
      const { data } = await api.post(
        `/mentors/groups/${activeThread.mentorGroupId}/students/${activeThread.studentId}/messages`,
        payload
      );
      const newMsg = data?.directMessage;
      if (newMsg) {
        setMessages((prev) => [...prev, newMsg]);
        setThreads((prev) =>
          prev.map((t) =>
            t.threadKey === activeThread.threadKey
              ? { ...t, lastMessage: newMsg, updatedAt: newMsg.createdAt }
              : t
          )
        );
      }
      setMessageText('');
      if (onClearReferencedTrade) onClearReferencedTrade();
    } catch (err) {
      console.error('Send message error:', err);
      toast.error(err.response?.data?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const filteredThreads = threads.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.partner?.name?.toLowerCase().includes(q) ||
      t.partner?.email?.toLowerCase().includes(q) ||
      t.cohortName?.toLowerCase().includes(q)
    );
  });

  const quickPrompts = activeThread?.roleInThread === 'MENTOR' ? MENTOR_QUICK_PROMPTS : STUDENT_QUICK_PROMPTS;

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs grid grid-cols-1 lg:grid-cols-12 min-h-[520px] max-h-[680px]">
      {/* Left Sidebar: Threads List */}
      <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-border flex flex-col bg-surface-muted/20 max-h-[240px] lg:max-h-[680px]">
        <div className="p-3.5 border-b border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <MessageSquare size={14} className="text-emerald-500" />
              Direct 1-on-1 Coaching Chat
            </h4>
            <button
              type="button"
              onClick={fetchThreads}
              className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-surface-muted transition"
              title="Refresh conversations"
            >
              <RefreshCw size={13} className={loadingThreads ? 'animate-spin text-emerald-500' : ''} />
            </button>
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or mentor..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {loadingThreads ? (
            <div className="p-6 text-center text-xs text-muted">
              Loading conversations...
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted space-y-1">
              <p className="font-semibold text-foreground">No active chat threads</p>
              <p>Once students are enrolled in a cohort, 1-on-1 direct messaging threads appear here automatically.</p>
            </div>
          ) : (
            filteredThreads.map((thread) => {
              const isSelected = activeThread?.threadKey === thread.threadKey;
              const partner = thread.partner || {};
              return (
                <button
                  key={thread.threadKey}
                  type="button"
                  onClick={() => handleSelectThread(thread)}
                  className={`w-full p-3.5 text-left transition flex items-start gap-3 ${
                    isSelected
                      ? 'bg-emerald-500/10 border-l-4 border-l-emerald-500'
                      : 'hover:bg-surface-muted/50'
                  }`}
                >
                  {partner.avatarUrl ? (
                    <img
                      src={resolveImageUrl(partner.avatarUrl)}
                      alt={partner.name}
                      className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/20">
                      {partner.name ? partner.name.charAt(0).toUpperCase() : 'T'}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-foreground truncate">
                        {partner.name || 'Trader'}
                      </span>
                      {thread.unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px] font-black">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                      {thread.cohortName} ({thread.roleInThread === 'MENTOR' ? 'Student' : 'Mentor'})
                    </p>
                    <p className="text-[11px] text-muted truncate mt-0.5">
                      {thread.lastMessage
                        ? thread.lastMessage.content
                        : 'Start a 1-on-1 coaching conversation...'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Main Area: Active Conversation */}
      <div className="lg:col-span-8 flex flex-col bg-background/50 h-[440px] lg:h-[680px]">
        {!activeThread ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted">
            <MessageSquare size={36} className="mb-2 opacity-40 text-emerald-500" />
            <p className="text-sm font-bold text-foreground">Select a conversation</p>
            <p className="text-xs max-w-xs mt-1">
              Choose a student or mentor from the list to send direct 1-on-1 messages, discuss shared trades, or ask questions.
            </p>
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            <div className="p-3.5 sm:px-5 border-b border-border bg-surface flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/20">
                  {activeThread.partner?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground truncate">
                      {activeThread.partner?.name || 'Academy Member'}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {activeThread.roleInThread === 'MENTOR' ? 'Enrolled Student' : 'Academy Mentor'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted truncate">
                    Cohort: <strong>{activeThread.cohortName}</strong> &bull; {activeThread.partner?.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fetchMessagesForThread(activeThread)}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-surface-muted/40 hover:bg-surface-muted text-xs text-muted hover:text-foreground flex items-center gap-1 transition"
              >
                <RefreshCw size={12} className={loadingMessages ? 'animate-spin text-emerald-500' : ''} />
                <span className="hidden sm:inline">Sync</span>
              </button>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="py-12 text-center text-xs text-muted">
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                    <Sparkles size={22} />
                  </div>
                  <p className="text-xs font-bold text-foreground">
                    Direct 1-on-1 Coaching Channel with {activeThread.partner?.name}
                  </p>
                  <p className="text-[11px] text-muted max-w-sm mx-auto">
                    Messages sent here are private between the mentor and this individual student. Use a quick prompt below or type a message to begin.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[82%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                          isMine
                            ? 'bg-emerald-600 text-white rounded-br-xs'
                            : 'bg-surface border border-border text-foreground rounded-bl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-muted">
                        <span>{isMine ? 'You' : msg.sender?.name || activeThread.partner?.name}</span>
                        <span>&bull;</span>
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isMine && (
                          <CheckCheck
                            size={12}
                            className={msg.isRead ? 'text-emerald-500' : 'text-muted opacity-60'}
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Referenced Trade Banner (if student/mentor clicked 'Discuss Setup') */}
            {referencedTrade && (
              <div className="px-4 py-2 bg-emerald-500/10 border-t border-emerald-500/30 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <TrendingUp size={14} className="text-emerald-500 shrink-0" />
                  <span className="truncate font-semibold text-foreground">
                    Discussing Setup: <strong>{referencedTrade.title || referencedTrade.tradeSnapshot?.pair}</strong>
                  </span>
                </div>
                {onClearReferencedTrade && (
                  <button
                    type="button"
                    onClick={onClearReferencedTrade}
                    className="text-muted hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            {/* Quick Coaching Prompts */}
            <div className="px-3.5 py-2 border-t border-border/60 bg-surface/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setMessageText(prompt)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-surface border border-border hover:border-emerald-500/40 text-[11px] text-muted hover:text-foreground transition"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Message Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 border-t border-border bg-surface flex items-center gap-2"
            >
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={`Message ${activeThread.partner?.name || 'trader'} directly...`}
                className="flex-1 bg-background border border-border rounded-xl px-3.5 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={sending || !messageText.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                <Send size={14} />
                <span>{sending ? 'Sending...' : 'Send'}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
