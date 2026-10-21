import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  GraduationCap, ShieldAlert, ShieldCheck, CheckCircle2, Clock, 
  AlertTriangle, LogOut, FileText, ChevronRight, RefreshCw, Send,
  Lock, BookOpen, ExternalLink, Pin, Sparkles, TrendingUp, TrendingDown,
  Eye, Filter, MessageSquare, Calendar, Award, AlertCircle, X, Bell,
  Users, Check, ArrowRight, PlusCircle, Megaphone, ChevronDown, ChevronUp, MoreHorizontal
} from 'lucide-react';
import api, { resolveImageUrl, subscribeToRealtimeSync } from '../utils/api';
import toast from 'react-hot-toast';
import Button from '../components/Button';
import { useAuth } from '../context/useAuth';
import MentorStudentChatPanel from '../components/mentor/MentorStudentChatPanel';

const SECONDARY_TABS = [
  { id: 'risk_guard', label: 'Risk Guard', icon: ShieldAlert },
  { id: 'assignments', label: 'Assignments', icon: BookOpen },
  { id: 'curriculum', label: 'Academy Info', icon: Users },
];

const StudentCohortsPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isMentorUser = user?.role === 'MENTOR' || user?.subscriptionPlan === 'MENTOR';

  const resolveInitialStudentTab = (tabParam) => {
    const raw = String(tabParam || '').toLowerCase();
    const map = {
      feed: 'feed',
      trade_shares: 'trade_shares',
      shares: 'trade_shares',
      trades: 'trade_shares',
      announcements: 'announcements',
      chat: 'chat',
      messages: 'chat',
      my_reviews: 'my_reviews',
      reviews: 'my_reviews',
      risk_guard: 'risk_guard',
      assignments: 'assignments',
      curriculum: 'curriculum',
    };
    return map[raw] || 'feed';
  };

  // Overall data state
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ memberships: [], settings: {}, tradingAccounts: [] });
  const [feedItems, setFeedItems] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [myReviews, setMyReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Filter & Navigation states
  const [selectedCohortFilter, setSelectedCohortFilter] = useState(() => searchParams.get('cohortId') || 'ALL');
  const [activeTab, setActiveTab] = useState(() => resolveInitialStudentTab(searchParams.get('tab'))); // 'feed' | 'trade_shares' | 'announcements' | 'chat' | 'my_reviews' | 'risk_guard' | 'assignments' | 'curriculum'
  const [feedFilterType, setFeedFilterType] = useState('ALL'); // 'ALL' | 'UNREAD' | 'CASE_STUDY'
  const [moreTabsOpen, setMoreTabsOpen] = useState(false);
  const [expandedFeedCommentary, setExpandedFeedCommentary] = useState({});
  const [expandedAnnouncements, setExpandedAnnouncements] = useState({});

  // Modals & Action states
  const [activeTradeModal, setActiveTradeModal] = useState(null);
  const [activeImageModal, setActiveImageModal] = useState(null);
  const [leavingCohortId, setLeavingCohortId] = useState(null);
  const [confirmLeaveGroup, setConfirmLeaveGroup] = useState(null);
  const [chatReferencedShare, setChatReferencedShare] = useState(null);
  const [loggingShareId, setLoggingShareId] = useState(null);

  // Assignment submission modal state
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissionContent, setSubmissionContent] = useState('');
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  // Student reply on review state
  const [replyTextMap, setReplyTextMap] = useState({});
  const [submittingReplyId, setSubmittingReplyId] = useState(null);

  useEffect(() => {
    fetchEnrolledCohorts();
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const cohortParam = searchParams.get('cohortId');
    const shareParam = searchParams.get('shareId');
    if (tabParam) {
      setActiveTab(resolveInitialStudentTab(tabParam));
    }
    if (cohortParam) {
      setSelectedCohortFilter(cohortParam);
    }
    if (shareParam && feedItems.length > 0) {
      const targetShare = feedItems.find((item) => item.type === 'TRADE_SHARE' && item.id === shareParam);
      if (targetShare) {
        handleOpenTradeDetailModal(targetShare);
      }
    }
  }, [searchParams, feedItems.length]);

  // Close open modals or menus on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (activeImageModal) setActiveImageModal(null);
        else if (activeTradeModal) setActiveTradeModal(null);
        else if (confirmLeaveGroup) setConfirmLeaveGroup(null);
        else if (selectedAssignment) setSelectedAssignment(null);
        else if (moreTabsOpen) setMoreTabsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeImageModal, activeTradeModal, confirmLeaveGroup, selectedAssignment, moreTabsOpen]);

  // Real-time cross-tab sync + silent background polling so mentor signals/updates appear immediately
  useEffect(() => {
    const refreshStudentAcademySilently = () => {
      fetchFeed(selectedCohortFilter, { silent: true });
      fetchStudentReviews({ silent: true });
      api
        .get('/mentors/my-cohorts')
        .then((res) => {
          if (res?.data) {
            setData(res.data);
          }
        })
        .catch(() => {});
    };

    const unsubscribe = subscribeToRealtimeSync(refreshStudentAcademySilently);
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        refreshStudentAcademySilently();
      }
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [selectedCohortFilter]);

  const fetchEnrolledCohorts = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/mentors/my-cohorts');
      setData(res.data || { memberships: [], settings: {}, tradingAccounts: [] });
      await Promise.all([
        fetchFeed(selectedCohortFilter, { silent }),
        fetchStudentReviews({ silent }),
      ]);
    } catch (err) {
      console.error(err);
      if (!silent) {
        toast.error(err.response?.data?.message || 'Failed to load your academy cohorts.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchFeed = async (cohortId = 'ALL', { silent = false } = {}) => {
    if (!silent) setLoadingFeed(true);
    try {
      const params = {};
      if (cohortId && cohortId !== 'ALL') {
        params.cohortId = cohortId;
      }
      const { data: feedRes } = await api.get('/mentors/student-feed', { params });
      const nextFeed = feedRes.feed || [];
      setFeedItems(nextFeed);
      setUnreadCount(feedRes.unreadCount || 0);
      setActiveTradeModal((prev) => {
        if (!prev) return null;
        const updatedItem = nextFeed.find((f) => f.id === prev.id);
        return updatedItem || prev;
      });
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      if (!silent) setLoadingFeed(false);
    }
  };

  const fetchStudentReviews = async ({ silent = false } = {}) => {
    if (!silent) setLoadingReviews(true);
    try {
      const { data: reviewsRes } = await api.get('/mentors/my-reviews');
      setMyReviews(reviewsRes.feedbacks || []);
    } catch (err) {
      console.error('Failed to load student reviews:', err);
    } finally {
      if (!silent) setLoadingReviews(false);
    }
  };

  const handleCohortFilterChange = (cohortId) => {
    setSelectedCohortFilter(cohortId);
    fetchFeed(cohortId);
  };

  const handleOpenTradeDetailModal = async (tradeShare) => {
    setActiveTradeModal(tradeShare);
    // Mark as read immediately on open
    if (!tradeShare.isRead) {
      try {
        await api.post(`/mentors/feed/TRADE_SHARE/${tradeShare.id}/read`);
        setFeedItems((prev) =>
          prev.map((item) => (item.id === tradeShare.id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (_) {}
    }
  };

  const handleMarkAnnouncementRead = async (announcementId) => {
    try {
      await api.post(`/mentors/feed/ANNOUNCEMENT/${announcementId}/read`);
      setFeedItems((prev) =>
        prev.map((item) => (item.id === announcementId ? { ...item, isRead: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (_) {}
  };

  const handleLeaveCohort = async (groupId) => {
    setLeavingCohortId(groupId);
    try {
      const res = await api.post(`/mentors/cohorts/${groupId}/leave`);
      toast.success(res.data.message || 'Successfully left cohort.');
      setConfirmLeaveGroup(null);
      fetchEnrolledCohorts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave cohort.');
    } finally {
      setLeavingCohortId(null);
    }
  };

  const handleSubmitAssignment = async () => {
    if (!submissionContent.trim() || !selectedAssignment) return;
    setSubmittingAssignment(true);
    try {
      await api.post(`/mentors/assignments/${selectedAssignment.id}/submit`, {
        content: submissionContent.trim(),
      });
      toast.success('Assignment submitted successfully!');
      setSelectedAssignment(null);
      setSubmissionContent('');
      fetchEnrolledCohorts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit assignment.');
    } finally {
      setSubmittingAssignment(false);
    }
  };

  const handleSendFeedbackReply = async (feedbackId, tradeId) => {
    const text = (replyTextMap[feedbackId] || '').trim();
    if (!text) return;
    setSubmittingReplyId(feedbackId);
    try {
      const { data } = await api.post(`/mentors/trades/${tradeId}/feedback/${feedbackId}/reply`, { reply: text });
      toast.success('Reply sent to your mentor!');
      setReplyTextMap((prev) => ({ ...prev, [feedbackId]: '' }));
      setMyReviews((prev) =>
        prev.map((fb) => (fb.id === feedbackId ? { ...fb, studentReply: text, studentRepliedAt: new Date() } : fb))
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reply to mentor.');
    } finally {
      setSubmittingReplyId(null);
    }
  };

  const handleLogSetupToJournal = async (shareItem) => {
    if (!shareItem?.id) return;
    setLoggingShareId(shareItem.id);
    try {
      const defaultAccountId = data?.tradingAccounts?.[0]?.id;
      const res = await api.post(`/mentors/cohort-trade-shares/${shareItem.id}/log-to-journal`, {
        tradingAccountId: defaultAccountId,
        status: 'PLANNED',
      });
      toast.success(res.data?.message || 'Mentor trade setup logged to your personal journal!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not log setup to your journal.');
    } finally {
      setLoggingShareId(null);
    }
  };

  const memberships = Array.isArray(data?.memberships) ? data.memberships : [];
  const settings = data?.settings || {};
  const tradeSharesCount = useMemo(
    () => feedItems.filter((i) => i.type === 'TRADE_SHARE').length,
    [feedItems]
  );

  // Filtered feed items
  const filteredFeed = useMemo(() => {
    return feedItems.filter((item) => {
      if (activeTab === 'trade_shares' && item.type !== 'TRADE_SHARE') return false;
      if (activeTab === 'announcements' && item.type !== 'ANNOUNCEMENT') return false;
      if (feedFilterType === 'UNREAD' && item.isRead) return false;
      if (feedFilterType === 'CASE_STUDY' && activeTab !== 'announcements' && !item.isCaseStudy) return false;
      return true;
    });
  }, [feedItems, activeTab, feedFilterType]);

  const activeCohort = useMemo(() => {
    if (selectedCohortFilter === 'ALL') return null;
    return memberships.find((m) => m.mentorGroupId === selectedCohortFilter)?.mentorGroup || null;
  }, [memberships, selectedCohortFilter]);

  const activeSecondaryTab = useMemo(
    () => SECONDARY_TABS.find((t) => t.id === activeTab) || null,
    [activeTab]
  );

  const toggleFeedCommentary = (id) => {
    setExpandedFeedCommentary((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAnnouncementExpand = (id) => {
    setExpandedAnnouncements((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3 text-muted">
        <RefreshCw size={24} className="animate-spin text-emerald-600 dark:text-emerald-400" />
        <p className="text-sm">Loading your academy cohorts & trade feed...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 font-sans">
      {/* Top Banner for Mentors */}
      {isMentorUser && (
        <div className="p-3.5 sm:p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-foreground">
                Mentor Account Active
              </p>
              <p className="text-xs text-muted">
                You are viewing the student academy hub. Open your mentor workspace to manage cohorts and publish trade setups.
              </p>
            </div>
          </div>
          <Link
            to="/mentors"
            className="shrink-0 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            Open Mentor Workspace <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Page Header (without duplicate unread badge) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <GraduationCap className="text-emerald-600 dark:text-emerald-400 h-7 w-7 sm:h-8 sm:w-8 shrink-0" />
            <span>My Academy Hub</span>
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-1 max-w-2xl">
            Study your mentors' trade breakdowns, review academy broadcasts, and track personalized feedback on your journal.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/settings"
            className="text-xs px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-foreground font-semibold transition flex items-center gap-1.5 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <Lock size={13} className="text-muted" /> Privacy Settings
          </Link>
        </div>
      </div>

      {/* 3 Actionable Summary Cards Backed by Real Data */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => {
            setActiveTab('feed');
            setFeedFilterType(unreadCount > 0 ? 'UNREAD' : 'ALL');
          }}
          className={`text-left p-4 rounded-xl border transition shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
            activeTab === 'feed' && feedFilterType === 'UNREAD'
              ? 'border-emerald-500/50 bg-emerald-500/[0.06]'
              : 'border-border bg-surface hover:bg-surface-muted/60 hover:border-border/90'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-muted">Unread Updates</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <Bell size={15} />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-2xl font-black ${
                unreadCount > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'
              }`}
            >
              {unreadCount}
            </span>
            <span className="text-[11px] font-semibold text-muted inline-flex items-center gap-1">
              {unreadCount > 0 ? 'Review new items' : 'All caught up'} <ChevronRight size={12} />
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('trade_shares');
            setFeedFilterType('ALL');
          }}
          className={`text-left p-4 rounded-xl border transition shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
            activeTab === 'trade_shares'
              ? 'border-emerald-500/50 bg-emerald-500/[0.06]'
              : 'border-border bg-surface hover:bg-surface-muted/60 hover:border-border/90'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-muted">Mentor Trade Setups</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-black text-foreground">{tradeSharesCount}</span>
            <span className="text-[11px] font-semibold text-muted inline-flex items-center gap-1">
              Study breakdowns <ChevronRight size={12} />
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my_reviews')}
          className={`text-left p-4 rounded-xl border transition shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
            activeTab === 'my_reviews'
              ? 'border-emerald-500/50 bg-emerald-500/[0.06]'
              : 'border-border bg-surface hover:bg-surface-muted/60 hover:border-border/90'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-muted">My Journal Reviews</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-400">
              <Award size={15} />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-black text-foreground">{myReviews.length}</span>
            <span className="text-[11px] font-semibold text-muted inline-flex items-center gap-1">
              View mentor grades <ChevronRight size={12} />
            </span>
          </div>
        </button>
      </div>

      {/* Cohort Selector & Quiet Privacy State */}
      {memberships.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-3 bg-surface rounded-xl border border-border">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted mr-1">
              {memberships.length > 1 ? 'Cohort filter:' : 'Enrolled cohort:'}
            </span>
            {memberships.length > 1 && (
              <button
                type="button"
                onClick={() => handleCohortFilterChange('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                  selectedCohortFilter === 'ALL'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-background border-border text-muted hover:text-foreground'
                }`}
              >
                All Academies ({memberships.length})
              </button>
            )}
            {memberships.map((m) => (
              <button
                key={m.mentorGroupId}
                type="button"
                onClick={() => handleCohortFilterChange(m.mentorGroupId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                  selectedCohortFilter === m.mentorGroupId || memberships.length === 1
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-background border-border text-muted hover:text-foreground'
                }`}
              >
                {m.mentorGroup.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Journal sharing:{' '}
              <strong
                className={
                  settings.shareTradesWithMentor !== false
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }
              >
                {settings.shareTradesWithMentor !== false ? 'Connected' : 'Paused'}
              </strong>{' '}
              —{' '}
              <Link to="/settings" className="underline hover:text-foreground">
                you control access
              </Link>
            </span>
          </div>
        </div>
      )}

      {/* Empty State if No Memberships */}
      {memberships.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-surface/40 space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
            <GraduationCap size={32} />
          </div>
          <h3 className="text-lg font-bold text-foreground">You haven't joined any academy cohorts yet</h3>
          <p className="text-xs sm:text-sm text-muted max-w-md mx-auto leading-relaxed">
            When your forex mentor or academy invites you via email or link, your private cohort trade feed, curriculum, and risk guard rules will appear here.
          </p>
          <div className="pt-3">
            <Link
              to="/mentors"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              Explore Mentor Workspace & Cohorts
            </Link>
          </div>
        </div>
      ) : (
        /* Main Hub Content Area */
        <div className="space-y-4">
          {/* Responsive Student Navigation: Primary Learning Views + Secondary Academy Tools Menu */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('feed')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                  activeTab === 'feed'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                    : 'border-transparent text-muted hover:text-foreground hover:bg-surface-muted'
                }`}
              >
                <Sparkles size={14} />
                <span>Academy Feed</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-600 text-white font-black">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('trade_shares')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                  activeTab === 'trade_shares'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                    : 'border-transparent text-muted hover:text-foreground hover:bg-surface-muted'
                }`}
              >
                <TrendingUp size={14} />
                <span>Trade Setups</span>
                {tradeSharesCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-surface-muted text-muted font-bold">
                    {tradeSharesCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('announcements')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                  activeTab === 'announcements'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                    : 'border-transparent text-muted hover:text-foreground hover:bg-surface-muted'
                }`}
              >
                <Megaphone size={14} />
                <span>Announcements</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('my_reviews')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                  activeTab === 'my_reviews'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                    : 'border-transparent text-muted hover:text-foreground hover:bg-surface-muted'
                }`}
              >
                <Award size={14} />
                <span>Reviews ({myReviews.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                  activeTab === 'chat'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                    : 'border-transparent text-muted hover:text-foreground hover:bg-surface-muted'
                }`}
              >
                <MessageSquare size={14} />
                <span>Ask Mentor</span>
              </button>
            </div>

            {/* Grouped Secondary Utilities: Risk Guard, Assignments, Academy Info */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreTabsOpen((prev) => !prev)}
                aria-expanded={moreTabsOpen}
                aria-haspopup="menu"
                className={`px-3 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 border ${
                  activeSecondaryTab
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'border-border bg-surface hover:bg-surface-muted text-foreground'
                }`}
              >
                {activeSecondaryTab ? (
                  <>
                    <activeSecondaryTab.icon size={14} />
                    <span>{activeSecondaryTab.label}</span>
                  </>
                ) : (
                  <>
                    <MoreHorizontal size={14} />
                    <span>Academy Tools</span>
                  </>
                )}
                <ChevronDown size={13} className="text-muted" />
              </button>

              {moreTabsOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1.5 w-52 rounded-xl border border-border bg-surface shadow-lg py-1.5 z-30"
                >
                  {SECONDARY_TABS.map((tab) => {
                    const IconComponent = tab.icon;
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setActiveTab(tab.id);
                          setMoreTabsOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between transition ${
                          isSelected
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold'
                            : 'text-foreground hover:bg-surface-muted'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <IconComponent size={14} className="text-muted" />
                          {tab.label}
                        </span>
                        {isSelected && <Check size={13} className="text-emerald-600 dark:text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* TAB: 1-ON-1 MENTOR CHAT */}
          {activeTab === 'chat' && (
            <div className="space-y-3">
              <MentorStudentChatPanel
                role="STUDENT"
                activeGroup={activeCohort || memberships[0]?.mentorGroup || null}
                groups={memberships.map((m) => m.mentorGroup)}
                referencedTradeShare={chatReferencedShare}
                onClearReference={() => setChatReferencedShare(null)}
              />
            </div>
          )}

          {/* TAB 1 & 2 & 3: FEED / TRADE SETUPS / ANNOUNCEMENTS */}
          {(activeTab === 'feed' || activeTab === 'trade_shares' || activeTab === 'announcements') && (
            <div className="space-y-4">
              {/* Concise Filter Sub-strip for Feed */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted pb-1">
                <span className="font-semibold text-foreground">
                  {filteredFeed.length}{' '}
                  {activeTab === 'announcements'
                    ? `announcement${filteredFeed.length === 1 ? '' : 's'}`
                    : activeTab === 'trade_shares'
                    ? `trade setup${filteredFeed.length === 1 ? '' : 's'}`
                    : `item${filteredFeed.length === 1 ? '' : 's'}`}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFeedFilterType('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      feedFilterType === 'ALL'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold'
                        : 'bg-surface border-border text-muted hover:text-foreground'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedFilterType('UNREAD')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      feedFilterType === 'UNREAD'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold'
                        : 'bg-surface border-border text-muted hover:text-foreground'
                    }`}
                  >
                    Unread
                  </button>
                  {activeTab !== 'announcements' && (
                    <button
                      type="button"
                      onClick={() => setFeedFilterType('CASE_STUDY')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                        feedFilterType === 'CASE_STUDY'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold'
                          : 'bg-surface border-border text-muted hover:text-foreground'
                      }`}
                    >
                      Case Studies
                    </button>
                  )}
                </div>
              </div>

              {loadingFeed ? (
                <div className="py-12 text-center text-muted text-xs">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                  Updating academy feed...
                </div>
              ) : filteredFeed.length === 0 ? (
                <div className="p-10 text-center border border-dashed border-border rounded-2xl bg-surface/30 space-y-2">
                  <BookOpen size={28} className="mx-auto text-muted mb-1 opacity-50" />
                  <p className="text-sm font-semibold text-foreground">
                    {feedFilterType !== 'ALL' ? 'No items match this filter' : 'No broadcasts published yet'}
                  </p>
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    {feedFilterType !== 'ALL'
                      ? 'Try switching back to All items to view earlier trade breakdowns and announcements.'
                      : 'When your mentor shares trade setups, case studies, or academy announcements, they will appear here.'}
                  </p>
                  {feedFilterType !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setFeedFilterType('ALL')}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition"
                    >
                      Show all items
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredFeed.map((item) => {
                    const isTrade = item.type === 'TRADE_SHARE';
                    const snap = item.tradeSnapshot || {};
                    const vis = snap.visibilityOptions || {};
                    const rawOutcome = String(snap.result || snap.outcome || 'OPEN').toUpperCase();
                    const isClosed = ['WIN', 'LOSS', 'BREAKEVEN'].includes(rawOutcome) || snap.status === 'CLOSED';
                    const rrVal = snap.riskRewardRatio ?? snap.plannedRR ?? snap.realizedRR;
                    const pnlPct = snap.profitLossPercent;
                    const pnlDollar = snap.profitLoss ?? snap.pnl;
                    const isBuy = snap.direction === 'BUY';

                    // Build student-visible metric cards ONLY for metrics the mentor enabled
                    const visibleMetricBlocks = [];
                    if (vis.showPrices !== false && (snap.entryPrice || snap.exitPrice)) {
                      visibleMetricBlocks.push({
                        key: 'entry_exit',
                        label: 'Entry & exit',
                        primary: `Entry ${snap.entryPrice ?? '—'}`,
                        secondary: snap.exitPrice
                          ? `Exit ${snap.exitPrice}`
                          : 'Active — open setup',
                        tone: 'neutral',
                      });
                    }
                    if (vis.showPrices !== false && (snap.stopLoss || snap.takeProfit)) {
                      visibleMetricBlocks.push({
                        key: 'sl_tp',
                        label: 'Invalidation & target',
                        primary: `SL ${snap.stopLoss ?? '—'}`,
                        secondary: `TP ${snap.takeProfit ?? '—'}`,
                        tone: 'neutral',
                      });
                    }
                    if (
                      (vis.showRR !== false && rrVal !== null && rrVal !== undefined) ||
                      (vis.showLotSize && snap.lotSize) ||
                      snap.session
                    ) {
                      const primaryRR =
                        vis.showRR !== false && rrVal !== null && rrVal !== undefined
                          ? `1:${rrVal}R`
                          : snap.session || 'Setup profile';
                      const subParts = [];
                      if (snap.session && primaryRR !== snap.session) subParts.push(`${snap.session} session`);
                      if (vis.showLotSize && snap.lotSize) subParts.push(`${snap.lotSize} lots`);
                      visibleMetricBlocks.push({
                        key: 'rr_profile',
                        label: 'Risk profile',
                        primary: primaryRR,
                        secondary: subParts.join(' · ') || 'Planned structure',
                        tone: 'emerald',
                      });
                    }

                    // Outcome / Return block (only if mentor enabled at least one outcome metric)
                    const visibleReturnParts = [];
                    if (vis.showPnLPercent !== false && pnlPct !== null && pnlPct !== undefined) {
                      visibleReturnParts.push(`${Number(pnlPct) > 0 ? '+' : ''}${Number(pnlPct)}%`);
                    }
                    if (Boolean(vis.showPnLDollar) && pnlDollar !== null && pnlDollar !== undefined) {
                      visibleReturnParts.push(
                        `${Number(pnlDollar) >= 0 ? '+$' : '-$'}${Math.abs(Number(pnlDollar)).toLocaleString()}`
                      );
                    }
                    if (vis.showPips !== false && snap.pips !== null && snap.pips !== undefined) {
                      visibleReturnParts.push(`${Number(snap.pips) > 0 ? '+' : ''}${Number(snap.pips)} pips`);
                    }
                    if (vis.showResult !== false || visibleReturnParts.length > 0) {
                      const outcomeHeadline = !isClosed
                        ? 'Educational study'
                        : vis.showResult !== false
                        ? rawOutcome
                        : visibleReturnParts[0] || 'Completed';
                      visibleMetricBlocks.push({
                        key: 'result',
                        label: !isClosed ? 'Status' : 'Outcome',
                        primary: visibleReturnParts.length > 0 ? visibleReturnParts.join(' · ') : outcomeHeadline,
                        secondary: !isClosed
                          ? 'Active setup — study only'
                          : vis.showResult !== false
                          ? `Closed · ${rawOutcome}`
                          : 'Realized performance',
                        tone:
                          rawOutcome === 'WIN'
                            ? 'emerald'
                            : rawOutcome === 'LOSS'
                            ? 'rose'
                            : 'neutral',
                      });
                    }

                    // Progressive disclosure for student trade commentary
                    const thesisText = (item.setupThesis || '').trim();
                    const entryText = (item.entryReasoning || '').trim();
                    const riskText = (item.riskRationale || '').trim();
                    const lessonsText = (item.outcomeLessons || '').trim();
                    const hasMoreAnalysis =
                      Boolean(entryText || riskText || lessonsText) || thesisText.length > 180;
                    const isCommentaryExpanded = Boolean(expandedFeedCommentary[item.id]);

                    // Progressive disclosure for long announcements
                    const announcementBody = (item.content || '').trim();
                    const isLongAnnouncement = announcementBody.length > 260;
                    const isAnnouncementExpanded = Boolean(expandedAnnouncements[item.id]);

                    return (
                      <article
                        key={item.id}
                        className={`rounded-2xl border bg-surface p-4 sm:p-5 transition space-y-3.5 shadow-2xs ${
                          !isTrade
                            ? 'border-l-4 border-l-emerald-600 dark:border-l-emerald-500 border-border'
                            : item.isPinned
                            ? 'border-emerald-500/40 bg-emerald-500/[0.02]'
                            : 'border-border'
                        }`}
                      >
                        {/* Top Metadata Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/60 pb-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.mentor?.avatarUrl ? (
                              <img
                                src={resolveImageUrl(item.mentor.avatarUrl)}
                                alt="Mentor"
                                className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                                {item.mentor?.name?.charAt(0) || 'M'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-bold text-foreground truncate">
                                  {item.mentor?.name || 'Academy Mentor'}
                                </span>

                                {/* Clear Content-Type Label with Icon */}
                                {isTrade ? (
                                  item.isCaseStudy ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25">
                                      <BookOpen size={10} /> Case study
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                                      <TrendingUp size={10} /> Trade setup
                                    </span>
                                  )
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25">
                                    <Megaphone size={10} />
                                    {(item.category || 'Announcement').replace(/_/g, ' ')}
                                  </span>
                                )}

                                {item.isPinned && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                                    <Pin size={10} /> Pinned
                                  </span>
                                )}

                                {!item.isRead && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                    New
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span>{item.cohorts?.map((c) => c.name).join(', ') || 'Academy'}</span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {new Date(item.publishedAt).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Card Actions: Primary "View Full Breakdown" + Secondary Student Actions */}
                          <div className="flex flex-wrap items-center gap-2">
                            {isTrade ? (
                              <>
                                <button
                                  type="button"
                                  disabled={loggingShareId === item.id}
                                  onClick={() => handleLogSetupToJournal(item)}
                                  className="px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-foreground text-xs font-semibold transition inline-flex items-center gap-1.5 disabled:opacity-50"
                                  title="Save to your personal journal as a study/reflection entry (you control mentor sharing in Privacy Settings)"
                                >
                                  <PlusCircle size={13} className="text-emerald-600 dark:text-emerald-400" />
                                  <span>{loggingShareId === item.id ? 'Saving…' : 'Log to My Journal'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setChatReferencedShare(item);
                                    setActiveTab('chat');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-foreground text-xs font-semibold transition inline-flex items-center gap-1.5"
                                  title="Ask your mentor a question about this setup"
                                >
                                  <MessageSquare size={13} className="text-muted" />
                                  <span>Ask Mentor</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenTradeDetailModal(item)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs"
                                >
                                  <Eye size={13} /> View Full Breakdown
                                </button>
                              </>
                            ) : (
                              !item.isRead && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkAnnouncementRead(item.id)}
                                  className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-surface-muted text-xs text-foreground font-semibold transition"
                                >
                                  Mark as read
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {/* Card Body */}
                        {isTrade ? (
                          <div className="space-y-3.5">
                            {/* Instrument, Semantic Direction Badge & Educational Status */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base font-black text-foreground tracking-tight">
                                  {snap.pair || 'Instrument'}
                                </span>

                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border ${
                                    isBuy
                                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                                  }`}
                                >
                                  {isBuy ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                  {isBuy ? 'Buy' : 'Sell'}
                                </span>

                                {!isClosed ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                                    <Clock size={11} /> Active setup — For educational study only
                                  </span>
                                ) : (
                                  vis.showResult !== false && (
                                    <span
                                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                                        rawOutcome === 'WIN'
                                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                                          : rawOutcome === 'LOSS'
                                          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                                          : 'bg-surface-muted text-muted border-border'
                                      }`}
                                    >
                                      {rawOutcome === 'WIN' ? (
                                        <CheckCircle2 size={11} />
                                      ) : rawOutcome === 'LOSS' ? (
                                        <AlertCircle size={11} />
                                      ) : null}
                                      Closed · {rawOutcome}
                                    </span>
                                  )
                                )}
                              </div>

                              {item.title && (
                                <h4 className="text-sm font-bold text-foreground">{item.title}</h4>
                              )}
                            </div>

                            {/* Visible Execution & Outcome Metrics Grid (Only what mentor enabled) */}
                            {visibleMetricBlocks.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                                {visibleMetricBlocks.map((block) => (
                                  <div
                                    key={block.key}
                                    className="p-3 rounded-xl bg-surface-muted/40 border border-border/70 space-y-0.5"
                                  >
                                    <span className="text-[11px] font-semibold text-muted block">
                                      {block.label}
                                    </span>
                                    <p
                                      className={`font-mono font-bold text-sm truncate ${
                                        block.tone === 'emerald'
                                          ? 'text-emerald-700 dark:text-emerald-400'
                                          : block.tone === 'rose'
                                          ? 'text-rose-700 dark:text-rose-400'
                                          : 'text-foreground'
                                      }`}
                                    >
                                      {block.primary}
                                    </p>
                                    <p className="text-[11px] text-muted truncate">{block.secondary}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Progressive Disclosure Mentor Commentary */}
                            {(thesisText || entryText || riskText || lessonsText) && (
                              <div className="p-3.5 rounded-xl bg-background border border-border/70 text-xs space-y-2 leading-relaxed">
                                {thesisText && (
                                  <div>
                                    <span className="text-[11px] font-bold text-muted block mb-0.5">
                                      Thesis & market context
                                    </span>
                                    <p
                                      className={`text-foreground whitespace-pre-line ${
                                        !isCommentaryExpanded && hasMoreAnalysis ? 'line-clamp-2' : ''
                                      }`}
                                    >
                                      {thesisText}
                                    </p>
                                  </div>
                                )}

                                {isCommentaryExpanded && (
                                  <div className="space-y-2 pt-2 border-t border-border/60">
                                    {entryText && (
                                      <div>
                                        <span className="text-[11px] font-bold text-foreground block">
                                          Entry confirmation
                                        </span>
                                        <p className="text-muted whitespace-pre-line">{entryText}</p>
                                      </div>
                                    )}
                                    {riskText && (
                                      <div>
                                        <span className="text-[11px] font-bold text-foreground block">
                                          Invalidation & risk plan
                                        </span>
                                        <p className="text-muted whitespace-pre-line">{riskText}</p>
                                      </div>
                                    )}
                                    {lessonsText && (
                                      <div>
                                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                                          Key lesson & takeaway
                                        </span>
                                        <p className="text-foreground font-medium whitespace-pre-line">
                                          {lessonsText}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {hasMoreAnalysis && (
                                  <button
                                    type="button"
                                    onClick={() => toggleFeedCommentary(item.id)}
                                    aria-expanded={isCommentaryExpanded}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline pt-0.5"
                                  >
                                    {isCommentaryExpanded ? (
                                      <>
                                        <ChevronUp size={13} /> Hide mentor analysis
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown size={13} /> Expand mentor analysis
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Attachments preview */}
                            {item.attachments && item.attachments.length > 0 && (
                              <div className="flex items-center gap-2 pt-1">
                                {item.attachments.slice(0, 3).map((att) => (
                                  <button
                                    key={att.id}
                                    type="button"
                                    onClick={() => setActiveImageModal(resolveImageUrl(att.imageUrl))}
                                    className="w-20 h-14 overflow-hidden rounded-lg border border-border bg-surface-muted hover:opacity-90 transition"
                                    title="Click to expand chart markup"
                                  >
                                    <img
                                      src={resolveImageUrl(att.imageUrl)}
                                      alt="Chart preview"
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ))}
                                {item.attachments.length > 3 && (
                                  <span className="text-[11px] text-muted font-mono">
                                    +{item.attachments.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Announcement Card (Visually distinct with Read more / Show less) */
                          <div className="space-y-2">
                            <h4 className="text-sm sm:text-base font-bold text-foreground">
                              {item.title}
                            </h4>
                            <p
                              className={`text-xs sm:text-sm text-foreground/90 whitespace-pre-line leading-relaxed ${
                                isLongAnnouncement && !isAnnouncementExpanded ? 'line-clamp-3' : ''
                              }`}
                            >
                              {announcementBody}
                            </p>
                            {isLongAnnouncement && (
                              <button
                                type="button"
                                onClick={() => toggleAnnouncementExpand(item.id)}
                                aria-expanded={isAnnouncementExpanded}
                                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                              >
                                {isAnnouncementExpanded ? (
                                  <>
                                    <ChevronUp size={13} /> Show less
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown size={13} /> Read more
                                  </>
                                )}
                              </button>
                            )}
                            {item.attachments && item.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-2">
                                {item.attachments.map((att, idx) => (
                                  <a
                                    key={idx}
                                    href={att.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-muted hover:bg-surface border border-border text-xs text-foreground font-semibold transition"
                                  >
                                    <ExternalLink size={12} /> {att.title || 'Open Attachment'}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MY REVIEWS & GRADES */}
          {activeTab === 'my_reviews' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Personal Mentorship Reviews</h3>
                  <p className="text-xs text-muted">Feedback and grades left by your mentors on your personal trade logs.</p>
                </div>
                <span className="text-xs font-mono font-bold text-muted">{myReviews.length} Total</span>
              </div>

              {loadingReviews ? (
                <div className="py-12 text-center text-muted text-xs">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                  Loading your trade reviews...
                </div>
              ) : myReviews.length === 0 ? (
                <div className="p-10 text-center border border-dashed border-border rounded-2xl bg-surface/30">
                  <Award size={28} className="mx-auto text-muted mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-foreground">No mentor reviews yet</p>
                  <p className="text-xs text-muted max-w-sm mx-auto mt-1">
                    When your mentor inspects your trades and writes execution feedback or grades, you will see their complete review history here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {myReviews.map((fb) => (
                    <div
                      key={fb.id}
                      className="rounded-2xl border border-border bg-surface p-4 sm:p-5 space-y-3 shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-400 font-bold text-xs">
                            Grade: <span className="text-sm font-black text-foreground">{fb.grade || 'Reviewed'}</span>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">
                              {fb.trade?.pair} {fb.trade?.direction} &bull; {fb.trade?.result}
                            </p>
                            <p className="text-[11px] text-muted">
                              Reviewed by <strong>{fb.mentor?.name}</strong> on {new Date(fb.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <Link
                          to={`/trades/${fb.trade?.id}`}
                          className="text-xs px-3 py-1.5 rounded-lg bg-surface border border-border hover:bg-surface-muted text-foreground font-semibold flex items-center gap-1 transition"
                        >
                          <Eye size={13} /> View Trade in Journal
                        </Link>
                      </div>

                      {/* Feedback Body */}
                      <div className="p-3 rounded-xl bg-background border border-border/60 text-xs text-foreground space-y-1.5 leading-relaxed">
                        <p className="italic text-muted">"{fb.feedback}"</p>
                        {fb.recommendation && (
                          <p className="pt-1 text-emerald-700 dark:text-emerald-400 font-medium">
                            <strong>Recommendation:</strong> {fb.recommendation}
                          </p>
                        )}
                      </div>

                      {/* Reply from Student */}
                      {fb.studentReply ? (
                        <div className="pl-4 border-l-2 border-emerald-500 text-xs text-muted">
                          <span className="font-semibold text-foreground block mb-0.5">Your Response:</span>
                          <p className="italic">"{fb.studentReply}"</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="Acknowledge feedback or reply to mentor..."
                            value={replyTextMap[fb.id] || ''}
                            onChange={(e) => setReplyTextMap((prev) => ({ ...prev, [fb.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSendFeedbackReply(fb.id, fb.trade?.id);
                            }}
                            className="flex-1 bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500"
                          />
                          <button
                            onClick={() => handleSendFeedbackReply(fb.id, fb.trade?.id)}
                            disabled={submittingReplyId === fb.id || !(replyTextMap[fb.id] || '').trim()}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-50"
                          >
                            <Send size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: RISK GUARD RULES */}
          {activeTab === 'risk_guard' && (
            <div className="space-y-4">
              {memberships.map((m) => {
                const group = m.mentorGroup;
                return (
                  <div key={m.id} className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-border/50 pb-3">
                      <div>
                        <h3 className="text-base font-bold text-foreground">{group.name} — Capital Protection Rules</h3>
                        <p className="text-xs text-muted">Mandatory risk compliance thresholds monitored by your mentor.</p>
                      </div>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold">
                        Enforced
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-background border border-border">
                        <span className="text-[11px] text-muted block mb-0.5">Max Risk / Trade</span>
                        <strong className="text-sm font-bold text-foreground">
                          {group.maxRiskPerTradePercent ? `${group.maxRiskPerTradePercent}%` : 'Not Set'}
                        </strong>
                      </div>
                      <div className="p-3 rounded-xl bg-background border border-border">
                        <span className="text-[11px] text-muted block mb-0.5">Daily Drawdown Cap</span>
                        <strong className="text-sm font-bold text-foreground">
                          {group.maxDailyLossPercent ? `${group.maxDailyLossPercent}%` : 'Not Set'}
                        </strong>
                      </div>
                      <div className="p-3 rounded-xl bg-background border border-border">
                        <span className="text-[11px] text-muted block mb-0.5">Max Daily Trades</span>
                        <strong className="text-sm font-bold text-foreground">
                          {group.maxDailyTrades ? `${group.maxDailyTrades} trades` : 'Unlimited'}
                        </strong>
                      </div>
                      <div className="p-3 rounded-xl bg-background border border-border">
                        <span className="text-[11px] text-muted block mb-0.5">Stop Loss Rule</span>
                        <strong className={`text-sm font-bold ${group.requireStopLoss ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted'}`}>
                          {group.requireStopLoss ? 'Mandatory' : 'Optional'}
                        </strong>
                      </div>
                    </div>

                    {group.allowedPairs && group.allowedPairs.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-foreground">Approved Focus Markets:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {group.allowedPairs.map((pair, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-background border border-border rounded text-[11px] font-mono text-foreground font-semibold">
                              {pair}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 6: ASSIGNMENTS */}
          {activeTab === 'assignments' && (
            <div className="space-y-4">
              {memberships.map((m) => {
                const group = m.mentorGroup;
                const assignments = group.assignments || [];

                return (
                  <div key={m.id} className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-border/50 pb-3">
                      <div>
                        <h3 className="text-base font-bold text-foreground">{group.name} Assignments</h3>
                        <p className="text-xs text-muted">Weekly tasks, chart analysis homework, and trade reflection prompts.</p>
                      </div>
                      <span className="text-xs font-mono font-bold text-muted">{assignments.length} Total</span>
                    </div>

                    {assignments.length === 0 ? (
                      <p className="text-xs text-muted py-4 text-center">No assignments assigned for this cohort yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {assignments.map((assignment) => {
                          const submission = assignment.submissions?.[0];
                          const isSubmitted = Boolean(submission);

                          return (
                            <div
                              key={assignment.id}
                              className="p-3.5 rounded-xl bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-foreground">{assignment.title}</span>
                                  {isSubmitted ? (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                      <CheckCircle2 size={11} /> {submission.status}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                                      <Clock size={11} /> Pending
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted mt-1 leading-relaxed">{assignment.instructions}</p>
                                {assignment.dueDate && (
                                  <span className="text-[11px] text-muted/80 block mt-1">
                                    Due: {new Date(assignment.dueDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={() => {
                                  setSelectedAssignment(assignment);
                                  setSubmissionContent(submission?.content || '');
                                }}
                                className="text-xs px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shrink-0 transition shadow-xs"
                              >
                                {isSubmitted ? 'Edit Submission' : 'Submit Work'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 7: ACADEMY INFO & CURRICULUM */}
          {activeTab === 'curriculum' && (
            <div className="space-y-4">
              {memberships.map((m) => {
                const group = m.mentorGroup;
                return (
                  <div key={m.id} className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
                      <div className="flex items-center gap-3">
                        {group.logoUrl ? (
                          <img src={resolveImageUrl(group.logoUrl)} alt={group.name} className="w-12 h-12 rounded-xl object-cover border border-border" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-base">
                            {group.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h3 className="text-base font-bold text-foreground">{group.name}</h3>
                          <p className="text-xs text-muted">
                            Led by <strong>{group.mentor?.name}</strong> ({group.mentor?.email})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {group.telegramLink && (
                          <a
                            href={group.telegramLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400 font-semibold hover:bg-blue-500/20 transition flex items-center gap-1.5"
                          >
                            <ExternalLink size={13} /> Telegram Group
                          </a>
                        )}
                        <button
                          onClick={() => setConfirmLeaveGroup(group)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 font-medium transition flex items-center gap-1.5"
                        >
                          <LogOut size={13} /> Leave Cohort
                        </button>
                      </div>
                    </div>

                    {group.description && (
                      <div>
                        <h4 className="text-xs font-bold text-foreground mb-1 uppercase tracking-wider">About This Academy</h4>
                        <p className="text-xs text-muted leading-relaxed">{group.description}</p>
                      </div>
                    )}

                    {group.benefits && group.benefits.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Member Curriculum & Benefits</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {group.benefits.map((b, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-background border border-border/70 text-xs text-foreground flex items-center gap-2">
                              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>{b}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FULL TRADE BREAKDOWN MODAL */}
      {activeTradeModal && (() => {
        const mSnap = activeTradeModal.tradeSnapshot || {};
        const mVis = mSnap.visibilityOptions || {};
        const mRawOutcome = String(mSnap.result || mSnap.outcome || 'OPEN').toUpperCase();
        const mIsClosed = ['WIN', 'LOSS', 'BREAKEVEN'].includes(mRawOutcome) || mSnap.status === 'CLOSED';
        const mRr = mSnap.riskRewardRatio ?? mSnap.plannedRR ?? mSnap.realizedRR;
        const mPnlPct = mSnap.profitLossPercent;
        const mPnlDollar = mSnap.profitLoss ?? mSnap.pnl;

        const mReturnParts = [];
        if (mVis.showPnLPercent !== false && mPnlPct !== null && mPnlPct !== undefined) {
          mReturnParts.push(`${Number(mPnlPct) > 0 ? '+' : ''}${Number(mPnlPct)}%`);
        }
        if (Boolean(mVis.showPnLDollar) && mPnlDollar !== null && mPnlDollar !== undefined) {
          mReturnParts.push(`${Number(mPnlDollar) >= 0 ? '+$' : '-$'}${Math.abs(Number(mPnlDollar)).toLocaleString()}`);
        }
        if (mVis.showPips !== false && mSnap.pips !== null && mSnap.pips !== undefined) {
          mReturnParts.push(`${Number(mSnap.pips) > 0 ? '+' : ''}${Number(mSnap.pips)} pips`);
        }

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-trade-breakdown-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs overflow-y-auto"
          >
            <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl text-foreground">
              {/* Modal Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h3 id="student-trade-breakdown-title" className="text-base sm:text-lg font-bold text-foreground">
                      {activeTradeModal.title || `${mSnap.pair || 'Instrument'} Setup Breakdown`}
                    </h3>
                    <p className="text-xs text-muted">
                      Shared by {activeTradeModal.mentor?.name || 'Academy Mentor'} on{' '}
                      {new Date(activeTradeModal.publishedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={loggingShareId === activeTradeModal.id}
                    onClick={() => handleLogSetupToJournal(activeTradeModal)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                    title="Save to your personal journal as a study/reflection entry"
                  >
                    <PlusCircle size={13} />
                    <span>{loggingShareId === activeTradeModal.id ? 'Saving…' : 'Log to My Journal'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = activeTradeModal;
                      setActiveTradeModal(null);
                      setChatReferencedShare(target);
                      setActiveTab('chat');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-surface-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <MessageSquare size={13} />
                    <span>Ask Mentor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTradeModal(null)}
                    aria-label="Close trade breakdown"
                    className="p-1.5 text-muted hover:text-foreground rounded-lg hover:bg-surface-muted transition"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
                {/* Snapshot Stats Bar (Strict Student Visibility) */}
                <div className="p-3.5 bg-background rounded-xl border border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] font-semibold text-muted block">Market & direction</span>
                    <strong className="text-foreground text-sm font-black">
                      {mSnap.pair} ({mSnap.direction === 'BUY' ? 'Buy' : 'Sell'})
                    </strong>
                  </div>

                  {(mVis.showResult !== false || mReturnParts.length > 0) && (
                    <div>
                      <span className="text-[11px] font-semibold text-muted block">
                        {!mIsClosed ? 'Status' : 'Outcome / Return'}
                      </span>
                      <strong
                        className={`text-sm font-black ${
                          mRawOutcome === 'WIN'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : mRawOutcome === 'LOSS'
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-foreground'
                        }`}
                      >
                        {!mIsClosed
                          ? 'Active setup — study only'
                          : [
                              mVis.showResult !== false ? mRawOutcome : null,
                              mReturnParts.length > 0 ? mReturnParts.join(' · ') : null,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Completed'}
                      </strong>
                    </div>
                  )}

                  {(mVis.showRR !== false && mRr !== null && mRr !== undefined) && (
                    <div>
                      <span className="text-[11px] font-semibold text-muted block">Risk : Reward</span>
                      <strong className="text-emerald-700 dark:text-emerald-400 text-sm font-bold font-mono">
                        1:{mRr}R
                      </strong>
                    </div>
                  )}

                  <div>
                    <span className="text-[11px] font-semibold text-muted block">Session & size</span>
                    <strong className="text-foreground text-sm font-bold">
                      {[
                        mSnap.session || 'Standard session',
                        mVis.showLotSize && mSnap.lotSize ? `${mSnap.lotSize} lots` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </strong>
                  </div>
                </div>

                {/* Execution Levels (only when mentor enabled prices) */}
                {mVis.showPrices !== false &&
                  (mSnap.entryPrice || mSnap.stopLoss || mSnap.takeProfit || mSnap.exitPrice) && (
                    <div className="p-3.5 bg-surface-muted/30 rounded-xl border border-border/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      <div>
                        <span className="text-[11px] text-muted block font-sans">Entry price</span>
                        <span className="font-bold text-foreground">{mSnap.entryPrice ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted block font-sans">Stop loss</span>
                        <span className="font-bold text-rose-700 dark:text-rose-400">{mSnap.stopLoss ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted block font-sans">Take profit</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">{mSnap.takeProfit ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted block font-sans">Exit price</span>
                        <span className="font-bold text-foreground">
                          {mSnap.exitPrice ?? (mIsClosed ? 'Closed' : 'Open setup')}
                        </span>
                      </div>
                    </div>
                  )}

                {/* Educational Commentary Sections (Only render non-empty sections) */}
                <div className="space-y-3.5">
                  {activeTradeModal.setupThesis && (
                    <div className="p-3.5 rounded-xl bg-background border border-border space-y-1">
                      <h5 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <Sparkles size={13} /> Thesis & market context
                      </h5>
                      <p className="text-foreground/90 whitespace-pre-line leading-relaxed">
                        {activeTradeModal.setupThesis}
                      </p>
                    </div>
                  )}

                  {activeTradeModal.entryReasoning && (
                    <div className="p-3.5 rounded-xl bg-background border border-border space-y-1">
                      <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" /> Entry confirmation
                      </h5>
                      <p className="text-foreground/90 whitespace-pre-line leading-relaxed">
                        {activeTradeModal.entryReasoning}
                      </p>
                    </div>
                  )}

                  {activeTradeModal.riskRationale && (
                    <div className="p-3.5 rounded-xl bg-background border border-border space-y-1">
                      <h5 className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <ShieldAlert size={13} /> Invalidation & risk plan
                      </h5>
                      <p className="text-foreground/90 whitespace-pre-line leading-relaxed">
                        {activeTradeModal.riskRationale}
                      </p>
                    </div>
                  )}

                  {activeTradeModal.managementReasoning && (
                    <div className="p-3.5 rounded-xl bg-background border border-border space-y-1">
                      <h5 className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                        <TrendingUp size={13} /> Trade management & exits
                      </h5>
                      <p className="text-foreground/90 whitespace-pre-line leading-relaxed">
                        {activeTradeModal.managementReasoning}
                      </p>
                    </div>
                  )}

                  {activeTradeModal.outcomeLessons && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                      <h5 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <Award size={13} /> Key lesson & takeaway
                      </h5>
                      <p className="text-foreground whitespace-pre-line font-medium leading-relaxed">
                        {activeTradeModal.outcomeLessons}
                      </p>
                    </div>
                  )}
                </div>

                {/* Attached Chart Screenshots */}
                {activeTradeModal.attachments && activeTradeModal.attachments.length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold text-foreground mb-2">
                      Attached chart markups
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeTradeModal.attachments.map((att) => (
                        <button
                          key={att.id}
                          type="button"
                          className="rounded-xl border border-border overflow-hidden bg-background cursor-pointer hover:border-emerald-500/50 transition group text-left"
                          onClick={() => setActiveImageModal(resolveImageUrl(att.imageUrl))}
                        >
                          <img
                            src={resolveImageUrl(att.imageUrl)}
                            alt="Chart"
                            className="w-full h-44 object-cover group-hover:scale-[1.01] transition"
                          />
                          <div className="p-2 text-xs font-semibold text-foreground flex items-center justify-between">
                            <span>{(att.screenshotType || 'Chart Screenshot').replace(/_/g, ' ')}</span>
                            <span className="text-[11px] text-muted">Click to zoom</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="p-3 rounded-xl bg-surface-muted/30 border border-border text-[11px] text-muted leading-relaxed text-center">
                  <strong>Educational study notice:</strong> This trade breakdown was published by your academy mentor for educational review and personal journal study. You control whether your logged journal reflections are shared in Privacy Settings.
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* LIGHTBOX IMAGE MODAL */}
      {activeImageModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Expanded chart image"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setActiveImageModal(null)}
        >
          <div className="max-w-5xl max-h-[90vh] relative">
            <button
              type="button"
              onClick={() => setActiveImageModal(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 font-bold text-sm bg-black/50 px-3 py-1 rounded-full"
            >
              Close ✕
            </button>
            <img src={activeImageModal} alt="Expanded chart" className="max-w-full max-h-[85vh] object-contain rounded-xl border border-white/20" />
          </div>
        </div>
      )}

      {/* CONFIRM LEAVE MODAL */}
      {confirmLeaveGroup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-cohort-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4"
        >
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={24} />
              <h3 id="leave-cohort-modal-title" className="text-lg font-bold text-foreground">
                Leave {confirmLeaveGroup.name}?
              </h3>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Leaving this cohort will immediately revoke your access to this academy's private trade feed, announcements, and mentor reviews.
            </p>
            <div className="p-3 bg-background border border-border rounded-lg text-xs text-muted">
              <strong className="text-foreground block mb-1">Your Data Guarantee:</strong>
              Your personal trading journal, accounts, trades, screenshots, and private history will remain <strong>100% intact and unaffected</strong>.
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmLeaveGroup(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-surface-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleLeaveCohort(confirmLeaveGroup.id)}
                disabled={leavingCohortId === confirmLeaveGroup.id}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                {leavingCohortId === confirmLeaveGroup.id ? 'Leaving...' : 'Confirm Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGNMENT MODAL */}
      {selectedAssignment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4"
        >
          <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div>
              <h3 id="assignment-modal-title" className="text-lg font-bold text-foreground">
                {selectedAssignment.title}
              </h3>
              <p className="text-xs text-muted mt-1">{selectedAssignment.instructions}</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Your Written Review / Reflection</label>
              <textarea
                rows={5}
                value={submissionContent}
                onChange={(e) => setSubmissionContent(e.target.value)}
                placeholder="Write your trade review reflections, strategy observations, or execution notes for your mentor..."
                className="w-full bg-background border border-border rounded-xl p-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setSelectedAssignment(null); setSubmissionContent(''); }}
                className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-surface-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitAssignment}
                disabled={submittingAssignment || !submissionContent.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send size={13} /> {submittingAssignment ? 'Submitting...' : 'Submit to Mentor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentCohortsPage;
