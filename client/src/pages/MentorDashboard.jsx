import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Users, UserPlus, FileText, Send, Sparkles, HelpCircle, Trash2, Eye, 
  Award, CheckCircle2, AlertCircle, Calendar, TrendingUp, TrendingDown, 
  ShieldAlert, ExternalLink, ChevronRight, Plus, Search, X, MessageSquare, 
  Lock, ArrowLeft, RefreshCw, BarChart2, ShieldCheck, GraduationCap,
  Copy, Check, Share2, Mail, Link as LinkIcon, DollarSign, CreditCard,
  Building2, Settings2, Edit3, Image, Target, Layers, Clock, Palette,
  Globe, PlusCircle, MinusCircle, CheckCircle, Upload, ArrowRight,
  Megaphone, Pin, BookOpen, MoreHorizontal, ChevronDown, ChevronUp, ArrowUpDown, Filter
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import api, { resolveImageUrl, subscribeToRealtimeSync } from '../utils/api';
import Button from '../components/Button';
import SectionHeader from '../components/SectionHeader';
import ImageModal from '../components/common/ImageModal';
import ShareTradeToCohortModal from '../components/share/ShareTradeToCohortModal';
import MentorStudentChatPanel from '../components/mentor/MentorStudentChatPanel';

const MentorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const resolveMentorTab = (tabParam) => {
    const raw = String(tabParam || '').toLowerCase();
    const map = {
      roster: 'roster',
      students: 'roster',
      shares: 'shares',
      trade_shares: 'shares',
      announcements: 'announcements',
      messages: 'messages',
      chat: 'messages',
    };
    return map[raw] || 'roster';
  };

  const isMentor =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    ((user?.subscriptionPlan === 'MENTOR' || user?.role === 'MENTOR') && user?.subscriptionStatus === 'ACTIVE');

  // 14-Day Free Trial & 12-Hour Grace Period Calculations
  const now = new Date();
  const trialExpiresAt = user?.mentorTrialExpiresAt ? new Date(user.mentorTrialExpiresAt) : null;
  const graceExpiresAt = trialExpiresAt ? new Date(trialExpiresAt.getTime() + 12 * 60 * 60 * 1000) : null;
  const isTrialActive = Boolean(trialExpiresAt && now < trialExpiresAt && (user?.role === 'MENTOR' || user?.subscriptionPlan === 'MENTOR'));
  const isInGracePeriod = Boolean(trialExpiresAt && graceExpiresAt && now >= trialExpiresAt && now <= graceExpiresAt && (user?.role === 'MENTOR' || user?.subscriptionPlan === 'MENTOR'));
  const graceHoursRemaining = isInGracePeriod ? Math.max(1, Math.ceil((graceExpiresAt.getTime() - now.getTime()) / (60 * 60 * 1000))) : 0;
  const trialDaysRemaining = isTrialActive ? Math.max(1, Math.ceil((trialExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 0;

  // State
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeModalImage, setActiveModalImage] = useState(null);

  // Cohort Sub-Navigation & Broadcast State
  const [cohortTab, setCohortTab] = useState(() => resolveMentorTab(searchParams.get('tab'))); // 'roster' | 'shares' | 'announcements' | 'messages'
  const [cohortShares, setCohortShares] = useState([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [isShareTradeModalOpen, setIsShareTradeModalOpen] = useState(false);
  const [editingTradeShare, setEditingTradeShare] = useState(null);
  const [isConcludeMode, setIsConcludeMode] = useState(false);
  const [headerOverflowOpen, setHeaderOverflowOpen] = useState(false);
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [shareStatusFilter, setShareStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'CLOSED' | 'WIN' | 'LOSS' | 'CASE_STUDY'
  const [shareSortBy, setShareSortBy] = useState('PINNED'); // 'PINNED' | 'NEWEST' | 'VIEWS'
  const [expandedShareAnalysis, setExpandedShareAnalysis] = useState({});
  const [openShareMenuId, setOpenShareMenuId] = useState(null);
  const [unshareConfirmTarget, setUnshareConfirmTarget] = useState(null);
  const [unsharing, setUnsharing] = useState(false);
  const [chatPreselectedStudentId, setChatPreselectedStudentId] = useState(() => searchParams.get('studentId') || null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [cohortAnnouncements, setCohortAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [isNewAnnouncementOpen, setIsNewAnnouncementOpen] = useState(false);
  const [announcementTargetCohorts, setAnnouncementTargetCohorts] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    category: 'GENERAL',
    isPinned: false,
  });
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  // Unified Mentor Settings Modal State
  const [isMentorSettingsOpen, setIsMentorSettingsOpen] = useState(false);
  const [mentorSettingsTab, setMentorSettingsTab] = useState('branding'); // 'branding' | 'curriculum' | 'pricing' | 'community' | 'payout' | 'preview' | 'cohorts'
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    academyName: '',
    logoUrl: '',
    customBadge: 'Academy Cohort Enrollment',
    targetMarkets: 'Forex, Gold & Indices',
    skillLevel: 'Beginner to Advanced',
    duration: '8 Weeks',
    benefits: [
      'Direct mentor reviews & execution grading on your journal logs',
      'Private cohort trade sharing & accountability',
      'Automated JAHZ AI weekly performance coaching summaries',
    ],
    telegramLink: '',
    discordLink: '',
    isPaid: false,
    price: 50,
    currency: 'USD',
    billingCycle: 'ONE_TIME',
    enforceRiskGuard: true,
    maxRiskPerTradePercent: 1.0,
    maxDailyLossPercent: 3.0,
    maxDailyTrades: 5,
    allowedPairs: 'EURUSD, GBPUSD, XAUUSD, USDJPY',
    requireStopLoss: true,
  });
  const [savingGroup, setSavingGroup] = useState(false);
  const logoFileInputRef = useRef(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Payout Settings Modal
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    bankName: '',
    accountNumber: '',
    accountName: '',
    bankCode: '',
    subaccountCode: '',
  });
  const [availableBanks, setAvailableBanks] = useState([]);
  const [savingPayout, setSavingPayout] = useState(false);

  // Invite Modal with Tabs (Link vs Direct Email)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteTab, setInviteTab] = useState('link');
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [invitingStudent, setInvitingStudent] = useState(false);

  // Student Trade Inspector Drawer
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentTrades, setStudentTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(false);

  // Trade Review & Grading Modal
  const [reviewingTrade, setReviewingTrade] = useState(null);
  const [feedbackGrade, setFeedbackGrade] = useState('A');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRec, setFeedbackRec] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // AI Summary Drafting State
  const [draftingFor, setDraftingFor] = useState(null);
  const [aiDraftModalStudent, setAiDraftModalStudent] = useState(null);
  const [aiDraftLetter, setAiDraftLetter] = useState('');
  const [publishingSummary, setPublishingSummary] = useState(false);

  useEffect(() => {
    if (isMentor) {
      fetchGroups();
      fetchPayoutSettings();
    } else {
      setLoading(false);
    }
  }, [isMentor]);

  const fetchGroups = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/mentors/groups');
      const loadedGroups = Array.isArray(data)
        ? data
        : (Array.isArray(data?.groups) ? data.groups : []);
      setGroups(loadedGroups);
      if (loadedGroups.length > 0) {
        const queryCohortId = searchParams.get('cohortId');
        setActiveGroupId((prev) => {
          if (queryCohortId && loadedGroups.some((g) => g.id === queryCohortId)) return queryCohortId;
          return prev && loadedGroups.some((g) => g.id === prev) ? prev : loadedGroups[0].id;
        });
      } else {
        setActiveGroupId(null);
      }
    } catch (err) {
      console.error(err);
      if (!silent) {
        toast.error('Could not load mentor cohorts.');
        setGroups([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchPayoutSettings = async () => {
    try {
      const { data } = await api.get('/mentors/payout-settings');
      if (data) {
        setPayoutForm({
          bankName: data.mentorBankName || '',
          accountNumber: data.mentorAccountNumber || '',
          accountName: data.mentorAccountName || '',
          bankCode: data.mentorBankCode || '',
          subaccountCode: data.mentorSubaccountCode || '',
        });
        if (Array.isArray(data.banks)) {
          setAvailableBanks(data.banks);
        }
      }
    } catch (_) {}
  };

  const fetchCohortShares = async (groupId, { silent = false } = {}) => {
    if (!groupId) return;
    if (!silent) setLoadingShares(true);
    try {
      const { data } = await api.get(`/mentors/cohort-trade-shares?cohortId=${groupId}`);
      setCohortShares(data?.shares || []);
    } catch (err) {
      console.error(err);
      if (!silent) toast.error('Could not load shared trades.');
    } finally {
      if (!silent) setLoadingShares(false);
    }
  };

  const fetchCohortAnnouncements = async (groupId, { silent = false } = {}) => {
    if (!groupId) return;
    if (!silent) setLoadingAnnouncements(true);
    try {
      const { data } = await api.get(`/mentors/cohort-announcements?cohortId=${groupId}`);
      setCohortAnnouncements(data?.announcements || []);
    } catch (err) {
      console.error(err);
      if (!silent) toast.error('Could not load announcements.');
    } finally {
      if (!silent) setLoadingAnnouncements(false);
    }
  };

  const fetchChatUnreadCount = async (groupId) => {
    try {
      const { data } = await api.get(`/mentors/chat/threads${groupId ? `?cohortId=${groupId}` : ''}`);
      const list = Array.isArray(data?.threads) ? data.threads : [];
      const totalUnread = list.reduce((acc, t) => acc + (t.unreadCount || 0), 0);
      setUnreadChatCount(totalUnread);
    } catch (_) {}
  };

  const handleDeleteTradeShare = async (shareOrId) => {
    const targetId = typeof shareOrId === 'string' ? shareOrId : shareOrId?.id;
    if (!targetId) return;
    setUnsharing(true);
    try {
      await api.delete(`/mentors/cohort-trade-shares/${targetId}`);
      toast.success('Shared trade removed from cohort.');
      setUnshareConfirmTarget(null);
      fetchCohortShares(activeGroupId);
    } catch (err) {
      console.error(err);
      toast.error('Failed to unshare trade.');
    } finally {
      setUnsharing(false);
    }
  };

  const handleTogglePinShare = async (share) => {
    if (!share?.id) return;
    try {
      const nextPinned = !(share.pinned || share.isPinned);
      await api.put(`/mentors/cohort-trade-shares/${share.id}`, {
        pinned: nextPinned,
      });
      toast.success(nextPinned ? 'Trade setup pinned to top of cohort feed.' : 'Trade setup unpinned.');
      setOpenShareMenuId(null);
      fetchCohortShares(activeGroupId, { silent: true });
    } catch (err) {
      toast.error('Could not update pin state.');
    }
  };

  const toggleShareAnalysis = (shareId) => {
    setExpandedShareAnalysis((prev) => ({ ...prev, [shareId]: !prev[shareId] }));
  };

  const handleTogglePinAnnouncement = async (ann) => {
    try {
      await api.put(`/mentors/cohort-announcements/${ann.id}`, {
        isPinned: !ann.isPinned,
      });
      toast.success(ann.isPinned ? 'Announcement unpinned.' : 'Announcement pinned to top of feed!');
      fetchCohortAnnouncements(activeGroupId);
    } catch (err) {
      toast.error('Failed to update announcement pin.');
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/mentors/cohort-announcements/${id}`);
      toast.success('Announcement deleted.');
      fetchCohortAnnouncements(activeGroupId);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete announcement.');
    }
  };

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      toast.error('Title and message are required.');
      return;
    }
    const targetIds = announcementTargetCohorts.length > 0 ? announcementTargetCohorts : [activeGroupId];
    setPostingAnnouncement(true);
    try {
      await api.post('/mentors/cohort-announcements', {
        mentorGroupId: activeGroupId,
        targetCohortIds: targetIds,
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        category: announcementForm.category,
        isPinned: announcementForm.isPinned,
        status: 'PUBLISHED',
      });
      toast.success(
        targetIds.length > 1
          ? `Announcement broadcasted to ${targetIds.length} cohorts!`
          : 'Announcement broadcasted to cohort!'
      );
      setIsNewAnnouncementOpen(false);
      setAnnouncementForm({
        title: '',
        content: '',
        category: 'GENERAL',
        isPinned: false,
      });
      fetchCohortAnnouncements(activeGroupId);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to post announcement.');
    } finally {
      setPostingAnnouncement(false);
    }
  };

  useEffect(() => {
    if (activeGroupId) {
      fetchCohortShares(activeGroupId);
      fetchCohortAnnouncements(activeGroupId);
      fetchChatUnreadCount(activeGroupId);
      setAnnouncementTargetCohorts([activeGroupId]);
    }
  }, [activeGroupId]);

  // Real-time cross-tab sync + silent background polling so student actions appear immediately without refresh
  useEffect(() => {
    if (!isMentor) return undefined;

    const refreshMentorDataSilently = () => {
      fetchGroups({ silent: true });
      if (activeGroupId) {
        fetchCohortShares(activeGroupId, { silent: true });
        fetchCohortAnnouncements(activeGroupId, { silent: true });
        fetchChatUnreadCount(activeGroupId);
      }
      if (selectedStudent?.id) {
        api
          .get(`/mentors/students/${selectedStudent.id}/trades`)
          .then(({ data }) => {
            if (Array.isArray(data)) setStudentTrades(data);
          })
          .catch(() => {});
      }
    };

    const unsubscribe = subscribeToRealtimeSync(refreshMentorDataSilently);
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        refreshMentorDataSilently();
      }
    }, 3500);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isMentor, activeGroupId, selectedStudent?.id]);

  const openMentorSettings = (tab = 'branding', group = null) => {
    const safeGroups = Array.isArray(groups) ? groups : [];
    const targetGroup = group || (activeGroupId ? safeGroups.find((g) => g.id === activeGroupId) : null) || (safeGroups.length > 0 ? safeGroups[0] : null);
    if (targetGroup) {
      setEditingGroup(targetGroup);
      setGroupFormData({
        name: targetGroup.name || '',
        description: targetGroup.description || '',
        academyName: targetGroup.academyName || '',
        logoUrl: targetGroup.logoUrl || '',
        customBadge: targetGroup.customBadge || 'Academy Cohort Enrollment',
        targetMarkets: targetGroup.targetMarkets || '',
        skillLevel: targetGroup.skillLevel || '',
        duration: targetGroup.duration || '',
        benefits: Array.isArray(targetGroup.benefits) && targetGroup.benefits.length > 0
          ? [...targetGroup.benefits]
          : [
              'Direct mentor reviews & execution grading on your journal logs',
              'Private cohort trade sharing & accountability',
              'Automated JAHZ AI weekly performance coaching summaries',
            ],
        telegramLink: targetGroup.telegramLink || '',
        discordLink: targetGroup.discordLink || '',
        isPaid: Boolean(targetGroup.isPaid),
        price: targetGroup.price || 0,
        currency: targetGroup.currency || 'USD',
        billingCycle: targetGroup.billingCycle || 'ONE_TIME',
        enforceRiskGuard: targetGroup.enforceRiskGuard !== undefined ? Boolean(targetGroup.enforceRiskGuard) : true,
        maxRiskPerTradePercent: targetGroup.maxRiskPerTradePercent ?? 1.0,
        maxDailyLossPercent: targetGroup.maxDailyLossPercent ?? 3.0,
        maxDailyTrades: targetGroup.maxDailyTrades ?? 5,
        allowedPairs: Array.isArray(targetGroup.allowedPairs) ? targetGroup.allowedPairs.join(', ') : (targetGroup.allowedPairs || 'EURUSD, GBPUSD, XAUUSD, USDJPY'),
        requireStopLoss: targetGroup.requireStopLoss !== undefined ? Boolean(targetGroup.requireStopLoss) : true,
      });
    } else {
      setEditingGroup(null);
      setGroupFormData({
        name: '',
        description: '',
        academyName: '',
        logoUrl: '',
        customBadge: 'Academy Cohort Enrollment',
        targetMarkets: 'Forex, Gold & Indices',
        skillLevel: 'Beginner to Advanced',
        duration: '8 Weeks',
        benefits: [
          'Direct mentor reviews & execution grading on your journal logs',
          'Private cohort trade sharing & accountability',
          'Automated JAHZ AI weekly performance coaching summaries',
        ],
        telegramLink: '',
        discordLink: '',
        isPaid: false,
        price: 50,
        currency: 'USD',
        billingCycle: 'ONE_TIME',
        enforceRiskGuard: true,
        maxRiskPerTradePercent: 1.0,
        maxDailyLossPercent: 3.0,
        maxDailyTrades: 5,
        allowedPairs: 'EURUSD, GBPUSD, XAUUSD, USDJPY',
        requireStopLoss: true,
      });
    }
    setMentorSettingsTab(tab);
    setIsMentorSettingsOpen(true);
  };

  const handleSwitchSettingsCohort = (groupId, preferredTab = null) => {
    if (groupId === 'NEW') {
      setEditingGroup(null);
      setGroupFormData({
        name: '',
        description: '',
        academyName: groupFormData.academyName || '',
        logoUrl: groupFormData.logoUrl || '',
        customBadge: 'Academy Cohort Enrollment',
        targetMarkets: 'Forex, Gold & Indices',
        skillLevel: 'Beginner to Advanced',
        duration: '8 Weeks',
        benefits: [
          'Direct mentor reviews & execution grading on your journal logs',
          'Private cohort trade sharing & accountability',
          'Automated JAHZ AI weekly performance coaching summaries',
        ],
        telegramLink: '',
        discordLink: '',
        isPaid: false,
        price: 50,
        currency: 'USD',
        billingCycle: 'ONE_TIME',
        enforceRiskGuard: true,
        maxRiskPerTradePercent: 1.0,
        maxDailyLossPercent: 3.0,
        maxDailyTrades: 5,
        allowedPairs: 'EURUSD, GBPUSD, XAUUSD, USDJPY',
        requireStopLoss: true,
      });
      setMentorSettingsTab(preferredTab || 'branding');
      return;
    }
    const safeGroups = Array.isArray(groups) ? groups : [];
    const selected = safeGroups.find((g) => g.id === groupId);
    if (selected) {
      setEditingGroup(selected);
      setActiveGroupId(selected.id);
      setGroupFormData({
        name: selected.name || '',
        description: selected.description || '',
        academyName: selected.academyName || '',
        logoUrl: selected.logoUrl || '',
        customBadge: selected.customBadge || 'Academy Cohort Enrollment',
        targetMarkets: selected.targetMarkets || '',
        skillLevel: selected.skillLevel || '',
        duration: selected.duration || '',
        benefits: Array.isArray(selected.benefits) && selected.benefits.length > 0
          ? [...selected.benefits]
          : [
              'Direct mentor reviews & execution grading on your journal logs',
              'Private cohort trade sharing & accountability',
              'Automated JAHZ AI weekly performance coaching summaries',
            ],
        telegramLink: selected.telegramLink || '',
        discordLink: selected.discordLink || '',
        isPaid: Boolean(selected.isPaid),
        price: selected.price || 0,
        currency: selected.currency || 'USD',
        billingCycle: selected.billingCycle || 'ONE_TIME',
        enforceRiskGuard: selected.enforceRiskGuard !== undefined ? Boolean(selected.enforceRiskGuard) : true,
        maxRiskPerTradePercent: selected.maxRiskPerTradePercent ?? 1.0,
        maxDailyLossPercent: selected.maxDailyLossPercent ?? 3.0,
        maxDailyTrades: selected.maxDailyTrades ?? 5,
        allowedPairs: Array.isArray(selected.allowedPairs) ? selected.allowedPairs.join(', ') : (selected.allowedPairs || 'EURUSD, GBPUSD, XAUUSD, USDJPY'),
        requireStopLoss: selected.requireStopLoss !== undefined ? Boolean(selected.requireStopLoss) : true,
      });
      if (preferredTab) {
        setMentorSettingsTab(preferredTab);
      }
    }
  };

  const handleAddBenefit = (defaultText = '') => {
    setGroupFormData((prev) => ({
      ...prev,
      benefits: [...(prev.benefits || []), defaultText],
    }));
  };

  const handleRemoveBenefit = (index) => {
    setGroupFormData((prev) => ({
      ...prev,
      benefits: (prev.benefits || []).filter((_, i) => i !== index),
    }));
  };

  const handleBenefitChange = (index, value) => {
    setGroupFormData((prev) => {
      const updated = [...(prev.benefits || [])];
      updated[index] = value;
      return { ...prev, benefits: updated };
    });
  };

  const handleLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB.');
      return;
    }

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const { data } = await api.post('/mentors/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setGroupFormData((prev) => ({ ...prev, logoUrl: data.logoUrl }));
      toast.success(data.message || 'Academy logo uploaded directly from device!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload logo.');
    } finally {
      setUploadingLogo(false);
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = '';
      }
    }
  };

  const handleSaveGroup = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!groupFormData.name.trim()) {
      toast.error('Please enter a cohort name.');
      return;
    }
    setSavingGroup(true);
    try {
      if (editingGroup) {
        // Edit existing cohort
        const { data } = await api.put(`/mentors/groups/${editingGroup.id}`, groupFormData);
        setGroups((prev) => (Array.isArray(prev) ? prev : []).map((g) => (g.id === data.id ? { ...g, ...data } : g)));
        setEditingGroup(data);
        toast.success('Cohort & banner settings updated!');
      } else {
        // Create new cohort
        const { data } = await api.post('/mentors/groups', groupFormData);
        setGroups((prev) => [data, ...(Array.isArray(prev) ? prev : [])]);
        setActiveGroupId(data.id);
        setEditingGroup(data);
        toast.success('New cohort & banner created!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save cohort.');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleSavePayout = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSavingPayout(true);
    try {
      const { data } = await api.put('/mentors/payout-settings', payoutForm);
      if (data?.payoutSettings) {
        setPayoutForm((prev) => ({
          ...prev,
          bankName: data.payoutSettings.mentorBankName || prev.bankName,
          accountNumber: data.payoutSettings.mentorAccountNumber || prev.accountNumber,
          accountName: data.payoutSettings.mentorAccountName || prev.accountName,
          bankCode: data.payoutSettings.mentorBankCode || prev.bankCode,
          subaccountCode: data.payoutSettings.mentorSubaccountCode || '',
        }));
      }
      toast.success(data?.message || 'Payout settlement details updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settlement details.');
    } finally {
      setSavingPayout(false);
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (!window.confirm(`Are you sure you want to delete the cohort "${groupName}"?`)) {
      return;
    }
    try {
      await api.delete(`/mentors/groups/${groupId}`);
      toast.success('Cohort removed.');
      const safeGroups = Array.isArray(groups) ? groups : [];
      const updated = safeGroups.filter((g) => g.id !== groupId);
      setGroups(updated);
      if (activeGroupId === groupId) {
        setActiveGroupId(updated.length > 0 ? updated[0].id : null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete cohort.');
    }
  };

  const handleInviteStudent = async (e) => {
    e.preventDefault();
    if (!activeGroupId || !newInviteEmail.trim()) {
      toast.error('Please enter a valid student email address.');
      return;
    }
    setInvitingStudent(true);
    try {
      const { data } = await api.post(`/mentors/groups/${activeGroupId}/invite`, {
        email: newInviteEmail.trim(),
      });
      toast.success(data.message || 'Student enrolled in cohort!');
      setNewInviteEmail('');
      setIsInviteModalOpen(false);
      await fetchGroups();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add student. Please ensure the student has a registered JahzJournal account.');
    } finally {
      setInvitingStudent(false);
    }
  };

  const handleRemoveStudent = async (groupId, studentId, studentName) => {
    if (!window.confirm(`Remove ${studentName || 'this student'} from this cohort?`)) {
      return;
    }
    try {
      await api.delete(`/mentors/groups/${groupId}/students/${studentId}`);
      toast.success('Student removed from cohort.');
      await fetchGroups();
      if (selectedStudent?.id === studentId) {
        setSelectedStudent(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove student.');
    }
  };

  const openStudentTrades = async (student) => {
    setSelectedStudent(student);
    setLoadingTrades(true);
    try {
      const { data } = await api.get(`/mentors/students/${student.id}/trades`);
      setStudentTrades(data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load student trades.');
      setStudentTrades([]);
    } finally {
      setLoadingTrades(false);
    }
  };

  const handleOpenReview = (trade) => {
    setReviewingTrade(trade);
    setFeedbackGrade(trade.grade || 'A');
    setFeedbackText('');
    setFeedbackRec('');
  };

  const handleIssueViolationWarning = (trade, violation) => {
    setReviewingTrade(trade);
    setFeedbackGrade('F');
    const evidenceText = violation.evidence ? `\n• Hard Proof: ${violation.evidence}` : '';
    setFeedbackText(
      `🚨 ACADEMY STRATEGY RISK BREACH NOTICE:\n` +
      `Your trade on ${trade.pair} breached our cohort risk parameters.\n` +
      `• Rule Breached: ${violation.title} (Allowed Limit: ${violation.ruleLimit})\n` +
      `• Actual Execution: ${violation.actualValue}${evidenceText}\n` +
      `• Details: ${violation.message}\n\n` +
      `Trading without discipline destroys your statistical edge. Please respect the academy risk rules on all upcoming trades.`
    );
    setFeedbackRec(`Strict adherence to ${violation.ruleLimit} risk cap and mandatory stop loss.`);
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!reviewingTrade || !feedbackText.trim()) {
      toast.error('Please enter your feedback comments.');
      return;
    }
    setSubmittingFeedback(true);
    try {
      const isBreach = feedbackGrade === 'MISTAKE' || feedbackGrade === 'F' || feedbackGrade === 'D';
      const { data } = await api.post(`/mentors/trades/${reviewingTrade.id}/feedback`, {
        feedback: feedbackText.trim(),
        grade: feedbackGrade,
        recommendation: feedbackRec.trim() || undefined,
        isViolationWarning: isBreach,
        violationDetails: reviewingTrade.riskGuardViolations?.length ? reviewingTrade.riskGuardViolations : null,
      });
      toast.success(isBreach ? 'Disciplinary rule violation notice published to student!' : 'Feedback and grade published to student!');
      
      setStudentTrades((prev) =>
        prev.map((t) =>
          t.id === reviewingTrade.id
            ? { ...t, mentorFeedbacks: [data, ...(t.mentorFeedbacks || [])] }
            : t
        )
      );
      setReviewingTrade(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to post feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleDraftSummary = async (student) => {
    setDraftingFor(student.id);
    const toastId = toast.loading(`JAHZ AI is analyzing ${student.name}'s recent trading performance...`);
    try {
      const { data } = await api.post(`/mentors/students/${student.id}/draft-summary`);
      setAiDraftModalStudent(student);
      setAiDraftLetter(data.markdownLetter || '');
      toast.success('AI Performance Review drafted!', { id: toastId });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to draft AI review.', { id: toastId });
    } finally {
      setDraftingFor(null);
    }
  };

  const handlePublishSummary = async () => {
    if (!aiDraftModalStudent || !aiDraftLetter.trim()) return;
    setPublishingSummary(true);
    try {
      await api.post(`/mentors/students/${aiDraftModalStudent.id}/send-summary`, {
        markdownLetter: aiDraftLetter,
      });
      toast.success(`Executive review sent directly to ${aiDraftModalStudent.name}'s journal!`);
      setAiDraftModalStudent(null);
      setAiDraftLetter('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send review to student.');
    } finally {
      setPublishingSummary(false);
    }
  };

  const safeGroups = useMemo(() => (Array.isArray(groups) ? groups : []), [groups]);

  const activeGroup = useMemo(() => {
    return safeGroups.find((g) => g.id === activeGroupId) || null;
  }, [safeGroups, activeGroupId]);

  const cohortInviteUrl = useMemo(() => {
    if (!activeGroupId) return '';
    const configuredBase = import.meta.env.VITE_APP_URL
      ? String(import.meta.env.VITE_APP_URL).replace(/\/$/, '')
      : typeof window !== 'undefined'
      ? window.location.origin
      : '';
    return `${configuredBase}/join/cohort/${activeGroupId}`;
  }, [activeGroupId]);

  const cohortInviteDisplayUrl = useMemo(() => {
    if (!activeGroupId) return '';
    const configuredBase = import.meta.env.VITE_APP_URL
      ? String(import.meta.env.VITE_APP_URL).replace(/\/$/, '')
      : typeof window !== 'undefined'
      ? window.location.origin
      : '';
    const hostDisplay = configuredBase.replace(/^https?:\/\//i, '');
    const slug = (activeGroup?.name || 'cohort')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 22);
    const shortCode = String(activeGroupId).slice(0, 6);
    return `${hostDisplay}/join/cohort/${slug}…${shortCode}`;
  }, [activeGroupId, activeGroup?.name]);

  const filteredAndSortedShares = useMemo(() => {
    const list = Array.isArray(cohortShares) ? [...cohortShares] : [];
    const q = shareSearchQuery.trim().toLowerCase();

    const filtered = list.filter((share) => {
      const snap = share.tradeSnapshot || {};
      const outcomeVal = String(snap.result || snap.outcome || 'OPEN').toUpperCase();
      const isClosed = ['WIN', 'LOSS', 'BREAKEVEN'].includes(outcomeVal) || snap.status === 'CLOSED';
      const isCaseStudy = Boolean(share.isCaseStudy);

      if (shareStatusFilter === 'ACTIVE' && isClosed) return false;
      if (shareStatusFilter === 'CLOSED' && !isClosed) return false;
      if (shareStatusFilter === 'WIN' && outcomeVal !== 'WIN') return false;
      if (shareStatusFilter === 'LOSS' && outcomeVal !== 'LOSS') return false;
      if (shareStatusFilter === 'CASE_STUDY' && !isCaseStudy) return false;

      if (!q) return true;
      const haystack = [
        snap.pair,
        snap.direction,
        share.title,
        share.setupThesis,
        share.entryReasoning,
        share.riskRationale,
        share.outcomeLessons,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    filtered.sort((a, b) => {
      if (shareSortBy === 'VIEWS') {
        const viewsA = a._count?.readReceipts ?? a.viewCount ?? 0;
        const viewsB = b._count?.readReceipts ?? b.viewCount ?? 0;
        if (viewsB !== viewsA) return viewsB - viewsA;
      } else if (shareSortBy === 'PINNED') {
        const pinA = Boolean(a.pinned || a.isPinned) ? 1 : 0;
        const pinB = Boolean(b.pinned || b.isPinned) ? 1 : 0;
        if (pinB !== pinA) return pinB - pinA;
      }
      const dateA = new Date(a.publishedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.publishedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return filtered;
  }, [cohortShares, shareSearchQuery, shareStatusFilter, shareSortBy]);

  const copyInviteLink = () => {
    if (!cohortInviteUrl) return;
    navigator.clipboard.writeText(cohortInviteUrl);
    setCopiedLink(true);
    toast.success('Cohort invite link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const filteredStudents = useMemo(() => {
    if (!activeGroup?.students) return [];
    if (!searchQuery.trim()) return activeGroup.students;
    const q = searchQuery.toLowerCase();
    return activeGroup.students.filter(
      (s) =>
        s.student?.name?.toLowerCase().includes(q) ||
        s.student?.email?.toLowerCase().includes(q)
    );
  }, [activeGroup, searchQuery]);

  const totalStudentsCount = useMemo(() => {
    return safeGroups.reduce((acc, g) => acc + (g.students?.length || 0), 0);
  }, [safeGroups]);

  // Total Mentor Earnings (98.5% Net Payouts across all cohorts)
  const totalEarningsSummary = useMemo(() => {
    let totalUsd = 0;
    let totalNgn = 0;
    let paidEnrollments = 0;

    safeGroups.forEach((g) => {
      g.students?.forEach((s) => {
        if (s.paidAmount && s.paidAmount > 0) {
          paidEnrollments++;
          const payout = s.mentorPayoutAmount || (s.paidAmount * 0.985);
          if (s.currency === 'NGN') {
            totalNgn += payout;
          } else {
            totalUsd += payout;
          }
        }
      });
    });

    return { totalUsd, totalNgn, paidEnrollments };
  }, [safeGroups]);

  // Non-Mentor Upgrade Landing Gate
  if (!isMentor) {
    return (
      <div className="space-y-6 sm:space-y-8 pb-12">
        <SectionHeader 
          title="Mentor Workspace" 
          description="Everything you need to run your trading academy, review student trades, and guide your community." 
          align="left" 
        />

        <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-muted p-6 sm:p-10 shadow-sm text-center max-w-4xl mx-auto">
          <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-8 ring-emerald-500/5 mb-5 sm:mb-6">
            <GraduationCap size={32} className="sm:w-9 sm:h-9" />
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground">
            Coach Your Traders with Real Trade Data & Insights
          </h2>
          <p className="mt-3 text-muted max-w-2xl mx-auto text-xs sm:text-sm md:text-base leading-relaxed">
            Stop digging through messy chat screenshots. With the JahzJournal Mentor Plan, your students' journals sync directly to your dashboard. Review real entries, grade executions, share tailored feedback, collect membership payments, and draft AI performance summaries in seconds.
          </p>

          <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-left max-w-3xl mx-auto">
            <div className="p-4 rounded-xl border border-border bg-surface shadow-xs">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm mb-1">
                <Users size={16} /> Student Cohorts
              </div>
              <p className="text-xs text-muted leading-relaxed">Create private academy groups, set paid or free entry, and easily welcome new traders.</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-surface shadow-xs">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm mb-1">
                <Eye size={16} /> Trade Audits & Feedback
              </div>
              <p className="text-xs text-muted leading-relaxed">Inspect entries, exits, risk management, and rule adherence with direct mentor grades.</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-surface shadow-xs">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm mb-1">
                <Sparkles size={16} /> AI Coaching Letters
              </div>
              <p className="text-xs text-muted leading-relaxed">Draft encouraging, constructive performance reviews powered by your student's recent trade data.</p>
            </div>
          </div>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Button
              onClick={() => navigate('/pricing')}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 text-xs sm:text-sm"
            >
              Upgrade to Mentor Plan
            </Button>
            <Link
              to="/contact"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border bg-surface hover:bg-surface-muted text-foreground text-xs sm:text-sm font-semibold transition"
            >
              <HelpCircle size={16} /> Contact Support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-muted gap-3">
        <RefreshCw size={28} className="animate-spin text-emerald-500" />
        <p className="text-sm font-medium">Loading your mentor workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-12">
      {/* 12-Hour Grace Period Alert Banner */}
      {isInGracePeriod && (
        <div className="rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-surface to-surface p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl ring-1 ring-amber-500/30">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-black text-xl border border-amber-500/30">
              ⚠️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400">
                  12-Hour Grace Period Active
                </span>
                <span className="text-xs font-bold text-amber-300">
                  ~{graceHoursRemaining} hour{graceHoursRemaining === 1 ? '' : 's'} remaining
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-black text-foreground mt-0.5">
                Your 14-day Mentor Free Trial has ended
              </h4>
              <p className="text-xs text-muted max-w-xl mt-0.5 leading-relaxed">
                You are currently in your 12-hour grace period. Upgrade to a paid plan before the grace period ends to maintain access to your student cohorts, Strategy Risk Guards, and reviews.
              </p>
            </div>
          </div>
          <Link
            to="/pricing/mentor"
            className="shrink-0 flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 px-5 text-xs transition shadow-md"
          >
            <span>Upgrade Mentor Plan</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* 14-Day Free Trial Active Banner */}
      {isTrialActive && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.06] px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-muted">
            <span className="text-blue-400 font-bold">⚡ 14-Day Free Trial:</span>
            <span>You have ~{trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'} remaining in your complimentary Private Cohort trial (with a 12-hour grace buffer).</span>
          </div>
          <Link
            to="/pricing/mentor"
            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline underline-offset-2 shrink-0"
          >
            View Plans & Pricing →
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <SectionHeader 
          title="Mentor Workspace" 
          description="Oversee your student cohorts, review live trade logs, and guide your traders toward consistency." 
          align="left" 
        />
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm py-2.5"
          >
            <UserPlus size={16} className="mr-1.5" /> Invite Students
          </Button>
          <button
            onClick={() => openMentorSettings('branding')}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-border bg-surface hover:bg-surface-muted text-foreground transition shadow-xs"
            title="Configure Academy Branding, Fees, Curriculum & Payouts"
          >
            <Settings2 size={16} className="text-emerald-500" /> Mentor Settings
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3 sm:p-4 rounded-xl border border-border bg-surface shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Active Cohorts</p>
          <div className="mt-1.5 sm:mt-2 flex items-center justify-between">
            <span className="text-xl sm:text-2xl font-black text-foreground">{safeGroups.length}</span>
            <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Users size={16} className="sm:w-4.5 sm:h-4.5" />
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-border bg-surface shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Enrolled Traders</p>
          <div className="mt-1.5 sm:mt-2 flex items-center justify-between">
            <span className="text-xl sm:text-2xl font-black text-foreground">{totalStudentsCount}</span>
            <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <GraduationCap size={16} className="sm:w-4.5 sm:h-4.5" />
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-border bg-surface shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Revenue</p>
          <div className="mt-1.5 sm:mt-2 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-base sm:text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 truncate block">
                {totalEarningsSummary.totalNgn > 0
                  ? `₦${totalEarningsSummary.totalNgn.toLocaleString()}`
                  : `$${totalEarningsSummary.totalUsd.toLocaleString()}`}
              </span>
              <span className="block text-[9px] sm:text-[10px] text-muted truncate">98.5% net payout</span>
            </div>
            <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <DollarSign size={16} className="sm:w-4.5 sm:h-4.5" />
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-border bg-surface shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">AI Coaching</p>
          <div className="mt-1.5 sm:mt-2 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold text-foreground block truncate">JAHZ AI Active</span>
              <span className="text-[9px] sm:text-[10px] text-muted truncate block">Ready for reviews</span>
            </div>
            <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Sparkles size={16} className="sm:w-4.5 sm:h-4.5" />
            </div>
          </div>
        </div>
      </div>

      {safeGroups.length === 0 ? (
        <div className="text-center py-12 sm:py-16 px-4 rounded-2xl border border-dashed border-border bg-surface/50">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4">
            <Users size={28} />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">No Cohorts Created Yet</h3>
          <p className="text-xs sm:text-sm text-muted max-w-md mx-auto mb-6 leading-relaxed">
            Create your first academy cohort to begin inviting traders, collecting mentorship fees, and reviewing live trade journals.
          </p>
          <Button onClick={() => openMentorSettings('branding', null)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm">
            <Plus size={16} className="mr-2" /> Create First Cohort
          </Button>
        </div>
      ) : (
        <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-4 lg:gap-6 items-start">
          {/* Mobile & Tablet Cohorts Horizontal Scroll Strip (visible on < lg) */}
          <div className="block lg:hidden rounded-xl border border-border bg-surface p-3 shadow-xs">
            <div className="flex items-center justify-between mb-2.5 px-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Select Cohort</span>
              <button
                onClick={() => openMentorSettings('cohorts', null)}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 hover:underline"
              >
                <Plus size={14} /> New Cohort
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {safeGroups.map((group) => {
                const isActive = group.id === activeGroupId;
                return (
                  <button
                    key={group.id}
                    onClick={() => setActiveGroupId(group.id)}
                    className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 border ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold shadow-xs'
                        : 'bg-surface-muted/40 text-muted hover:text-foreground border-border'
                    }`}
                  >
                    <span className="truncate max-w-[150px]">{group.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background border border-border text-foreground font-mono">
                      {group.students?.length || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop Left Sidebar: Cohorts List (hidden on < lg) */}
          <div className="hidden lg:block lg:col-span-1 rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
            <div className="p-3.5 sm:p-4 border-b border-border flex items-center justify-between bg-surface-muted/40">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">Your Cohorts</span>
              <button
                onClick={() => openMentorSettings('cohorts', null)}
                className="p-1 rounded-md text-muted hover:text-foreground hover:bg-surface-muted transition"
                title="Add New Cohort"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="divide-y divide-border">
              {safeGroups.map((group) => {
                const isActive = group.id === activeGroupId;
                return (
                  <div
                    key={group.id}
                    onClick={() => setActiveGroupId(group.id)}
                    className={`p-3.5 cursor-pointer transition flex items-center justify-between group ${
                      isActive
                        ? 'bg-emerald-500/10 border-l-4 border-emerald-500 text-foreground'
                        : 'hover:bg-surface-muted text-muted hover:text-foreground border-l-4 border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate text-foreground">{group.name}</p>
                        {group.isPaid && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            {group.currency === 'NGN' ? '₦' : '$'}{group.price}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted truncate mt-0.5">
                        {group.students?.length || 0} enrolled trader{group.students?.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openMentorSettings('branding', group);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-emerald-500 rounded transition"
                        title="Configure Cohort Settings"
                      >
                        <Settings2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id, group.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-rose-500 rounded transition"
                        title="Delete Cohort"
                      >
                        <Trash2 size={14} />
                      </button>
                      <ChevronRight size={16} className={`transition ${isActive ? 'text-emerald-500' : 'text-muted'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Main Panel: Active Cohort & Student Roster */}
          <div className="lg:col-span-3 rounded-xl border border-border bg-surface p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5">
            {activeGroup && (
              <>
                {/* Cohort Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-border">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight break-words">
                        {activeGroup.name}
                      </h2>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        <Users size={12} />
                        {activeGroup.students?.length || 0} Enrolled
                      </span>
                      {activeGroup.isPaid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          <DollarSign size={12} />
                          {activeGroup.currency === 'NGN' ? '₦' : '$'}
                          {activeGroup.price}
                          {activeGroup.billingCycle === 'MONTHLY' ? '/mo' : ' one-time'}
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-surface-muted text-muted border border-border">
                          Free cohort
                        </span>
                      )}
                    </div>
                    {activeGroup.description && (
                      <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-2xl">
                        {activeGroup.description}
                      </p>
                    )}
                  </div>

                  {/* Primary Action + Secondary / Mobile Overflow Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    {/* Desktop Secondary Actions */}
                    <button
                      type="button"
                      onClick={copyInviteLink}
                      className="hidden sm:inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border bg-surface hover:bg-surface-muted text-foreground transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      title="Copy public enrollment link"
                    >
                      {copiedLink ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} className="text-muted" />}
                      <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openMentorSettings('branding', activeGroup)}
                      className="hidden sm:inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border bg-surface hover:bg-surface-muted text-foreground transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      title="Configure cohort branding, curriculum, pricing & community"
                    >
                      <Settings2 size={14} className="text-muted" />
                      <span>Settings</span>
                    </button>

                    {/* Primary Action: Invite Students */}
                    <Button
                      onClick={() => setIsInviteModalOpen(true)}
                      className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3.5 shadow-xs"
                    >
                      <UserPlus size={15} className="mr-1.5" /> Invite Students
                    </Button>

                    {/* Narrow-Screen Overflow Menu for Secondary Actions */}
                    <div className="relative sm:hidden">
                      <button
                        type="button"
                        onClick={() => setHeaderOverflowOpen((prev) => !prev)}
                        aria-expanded={headerOverflowOpen}
                        aria-haspopup="menu"
                        aria-label="More cohort actions"
                        className="inline-flex items-center justify-center p-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-foreground transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {headerOverflowOpen && (
                        <div
                          role="menu"
                          className="absolute right-0 mt-1.5 w-48 rounded-xl border border-border bg-surface shadow-lg py-1.5 z-30"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              copyInviteLink();
                              setHeaderOverflowOpen(false);
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-surface-muted flex items-center gap-2"
                          >
                            {copiedLink ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} className="text-muted" />}
                            <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setHeaderOverflowOpen(false);
                              openMentorSettings('branding', activeGroup);
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-surface-muted flex items-center gap-2"
                          >
                            <Settings2 size={14} className="text-muted" />
                            <span>Cohort Settings</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Public Enrollment Link Panel */}
                <div className="rounded-xl border border-border bg-surface-muted/40 px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      <LinkIcon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          Public enrollment link
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          {activeGroup.isPaid ? 'Paid enrollment' : 'Free enrollment'}
                        </span>
                      </div>
                      <p
                        className="text-xs font-mono text-muted truncate mt-0.5"
                        title={cohortInviteUrl}
                      >
                        {cohortInviteDisplayUrl}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    {copiedLink ? (
                      <>
                        <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} className="text-muted" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Cohort View Sub-Navigation */}
                <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                  <button
                    type="button"
                    onClick={() => setCohortTab('roster')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      cohortTab === 'roster'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        : 'text-muted hover:text-foreground hover:bg-surface-muted border border-transparent'
                    }`}
                  >
                    <Users size={14} />
                    <span>Traders Roster</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-surface-muted text-muted">
                      {activeGroup.students?.length || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCohortTab('shares');
                      fetchCohortShares(activeGroupId);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      cohortTab === 'shares'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        : 'text-muted hover:text-foreground hover:bg-surface-muted border border-transparent'
                    }`}
                  >
                    <Share2 size={14} />
                    <span>Shared Trades</span>
                    {cohortShares.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                        {cohortShares.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCohortTab('announcements');
                      fetchCohortAnnouncements(activeGroupId);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      cohortTab === 'announcements'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        : 'text-muted hover:text-foreground hover:bg-surface-muted border border-transparent'
                    }`}
                  >
                    <Megaphone size={14} />
                    <span>Announcements</span>
                    {cohortAnnouncements.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                        {cohortAnnouncements.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCohortTab('messages');
                      fetchChatUnreadCount(activeGroupId);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      cohortTab === 'messages'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        : 'text-muted hover:text-foreground hover:bg-surface-muted border border-transparent'
                    }`}
                  >
                    <MessageSquare size={14} />
                    <span>1-on-1 Coaching Chat</span>
                    {unreadChatCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-600 text-white font-black">
                        {unreadChatCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* TAB 1: TRADERS ROSTER */}
                {cohortTab === 'roster' && (
                  <>
                    {/* Search Bar */}
                    <div className="relative">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                      <input
                        type="text"
                        placeholder="Search enrolled traders by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Student Cards Grid */}
                    {filteredStudents.length === 0 ? (
                      <div className="text-center py-10 sm:py-12 border border-dashed border-border rounded-xl p-4">
                        <GraduationCap size={32} className="mx-auto text-muted mb-2 opacity-50" />
                        <p className="text-sm font-semibold text-foreground">No traders found</p>
                        <p className="text-xs text-muted mt-1 mb-4 max-w-sm mx-auto leading-relaxed">
                          {searchQuery
                            ? 'Try checking for typos or searching by email address.'
                            : 'Share your cohort invitation link on WhatsApp, Telegram, or Discord to welcome your first students.'}
                        </p>
                        {!searchQuery && (
                          <Button onClick={() => setIsInviteModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
                            <UserPlus size={14} className="mr-1.5" /> Invite Traders
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                        {filteredStudents.map((item) => {
                          const st = item.student;
                          const isSharing = st?.userSettings?.shareTradesWithMentor !== false;
                          const totalTrades = st?.tradingAccounts?.reduce((sum, acc) => sum + (acc._count?.trades || 0), 0) || 0;

                          return (
                            <div
                              key={item.id}
                              className="rounded-xl border border-border bg-surface-muted/30 p-4 flex flex-col justify-between hover:border-border/80 transition space-y-3"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2.5">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/20">
                                      {st?.name ? st.name.charAt(0).toUpperCase() : 'S'}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-foreground truncate">{st?.name || 'Unnamed Trader'}</p>
                                      <p className="text-xs text-muted truncate">{st?.email}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveStudent(activeGroup.id, st.id, st.name)}
                                    className="text-muted hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition shrink-0"
                                    title="Remove Student from Cohort"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                                  <span className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                    isSharing
                                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                                  }`}>
                                    {isSharing ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                                    {isSharing ? 'Journal Connected' : 'Sync Paused'}
                                  </span>

                                  {item.paidAmount && item.paidAmount > 0 ? (
                                    <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                      {item.currency === 'NGN' ? '₦' : '$'}{item.paidAmount} Paid
                                    </span>
                                  ) : (
                                    <span className="text-[10px] sm:text-[11px] text-muted font-medium">
                                      Free Access
                                    </span>
                                  )}

                                  <span className="text-[10px] sm:text-[11px] text-muted font-medium ml-auto">
                                    {totalTrades} Logged Trade{totalTrades === 1 ? '' : 's'}
                                  </span>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-border/60">
                                <button
                                  onClick={() => openStudentTrades(st)}
                                  className="flex-1 py-2 px-2.5 rounded-lg bg-surface border border-border hover:bg-surface-muted text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
                                >
                                  <Eye size={13} /> Inspect Trades
                                </button>
                                <button
                                  onClick={() => {
                                    setChatPreselectedStudentId(st.id);
                                    setCohortTab('messages');
                                  }}
                                  className="py-2 px-2.5 rounded-lg bg-surface border border-border hover:border-emerald-500/40 hover:bg-emerald-500/10 text-foreground hover:text-emerald-700 dark:hover:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
                                  title={`Open 1-on-1 chat with ${st?.name || 'Student'}`}
                                >
                                  <MessageSquare size={13} /> Chat
                                </button>
                                <button
                                  disabled={draftingFor === st.id}
                                  onClick={() => handleDraftSummary(st)}
                                  className="py-2 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50 active:scale-95"
                                  title="Draft coaching feedback using AI"
                                >
                                  <Sparkles size={13} />
                                  {draftingFor === st.id ? 'Drafting...' : 'AI Review'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* TAB 2: SHARED TRADES */}
                {cohortTab === 'shares' && (
                  <div className="space-y-4">
                    {/* Trade-Feed Header & Compact Toolbar */}
                    <div className="rounded-xl border border-border bg-surface-muted/30 p-3.5 sm:p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm sm:text-base font-bold text-foreground">Shared trades</h4>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-surface border border-border text-muted">
                              {cohortShares.length}
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-0.5">
                            Publish live setups or post-trade case studies and control which metrics students can see.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <Link
                            to="/trades"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-muted hover:text-foreground hover:bg-surface transition"
                          >
                            <span>Trade Log</span>
                            <ExternalLink size={12} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setIsConcludeMode(false);
                              setEditingTradeShare(null);
                              setIsShareTradeModalOpen(true);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                          >
                            <Plus size={14} /> Share Trade
                          </button>
                        </div>
                      </div>

                      {/* Search, Status Filter & Sort Bar */}
                      {cohortShares.length > 0 && (
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-2.5 border-t border-border/60">
                          <div className="relative flex-1 min-w-0">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                              type="text"
                              value={shareSearchQuery}
                              onChange={(e) => setShareSearchQuery(e.target.value)}
                              placeholder="Search instrument, title, or commentary..."
                              aria-label="Search shared trades"
                              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500"
                            />
                            {shareSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setShareSearchQuery('')}
                                aria-label="Clear search"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {[
                              { id: 'ALL', label: 'All' },
                              { id: 'ACTIVE', label: 'Active' },
                              { id: 'CLOSED', label: 'Closed' },
                              { id: 'WIN', label: 'Win' },
                              { id: 'LOSS', label: 'Loss' },
                              { id: 'CASE_STUDY', label: 'Case Study' },
                            ].map((pill) => (
                              <button
                                key={pill.id}
                                type="button"
                                onClick={() => setShareStatusFilter(pill.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border ${
                                  shareStatusFilter === pill.id
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold'
                                    : 'bg-surface text-muted hover:text-foreground border-border'
                                }`}
                              >
                                {pill.label}
                              </button>
                            ))}

                            <div className="flex items-center gap-1.5 ml-auto sm:ml-1">
                              <ArrowUpDown size={13} className="text-muted shrink-0" />
                              <select
                                value={shareSortBy}
                                onChange={(e) => setShareSortBy(e.target.value)}
                                aria-label="Sort shared trades"
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:border-emerald-500"
                              >
                                <option value="PINNED">Pinned & newest</option>
                                <option value="NEWEST">Newest first</option>
                                <option value="VIEWS">Most viewed</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {loadingShares ? (
                      <div className="py-12 text-center text-xs text-muted">
                        <RefreshCw size={20} className="animate-spin mx-auto text-emerald-600 dark:text-emerald-400 mb-2" />
                        Loading shared trade setups...
                      </div>
                    ) : cohortShares.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-border rounded-xl p-4">
                        <Share2 size={32} className="mx-auto text-muted mb-2 opacity-50" />
                        <p className="text-sm font-bold text-foreground">No trades shared with this cohort yet</p>
                        <p className="text-xs text-muted mt-1 mb-4 max-w-sm mx-auto leading-relaxed">
                          Publish a live signal or share a completed trade from your journal with tailored student visibility and commentary.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsConcludeMode(false);
                            setEditingTradeShare(null);
                            setIsShareTradeModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition"
                        >
                          <Plus size={14} /> Share Trade
                        </button>
                      </div>
                    ) : filteredAndSortedShares.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-border rounded-xl p-4 space-y-2">
                        <p className="text-sm font-bold text-foreground">No matching shared trades</p>
                        <p className="text-xs text-muted">
                          No shared setups match your current search or status filter.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShareSearchQuery('');
                            setShareStatusFilter('ALL');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition"
                        >
                          Reset filters
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {filteredAndSortedShares.map((share) => {
                          const snap = share.tradeSnapshot || {};
                          const vis = snap.visibilityOptions || {};
                          const rawOutcome = String(snap.result || snap.outcome || 'OPEN').toUpperCase();
                          const isClosed = ['WIN', 'LOSS', 'BREAKEVEN'].includes(rawOutcome) || snap.status === 'CLOSED';
                          const rrVal = snap.riskRewardRatio ?? snap.plannedRR ?? snap.realizedRR;
                          const pnlPct = snap.profitLossPercent;
                          const pnlDollar = snap.profitLoss ?? snap.pnl;
                          const pipsVal = snap.pips;
                          const viewCount = share._count?.readReceipts ?? share.viewCount ?? 0;
                          const isPinned = Boolean(share.isPinned || share.pinned);
                          const isCaseStudy = Boolean(share.isCaseStudy);
                          const isBuy = snap.direction === 'BUY';

                          // Format Result summary
                          const returnParts = [];
                          if (pnlPct !== null && pnlPct !== undefined && vis.showPnLPercent !== false) {
                            returnParts.push(`${Number(pnlPct) > 0 ? '+' : ''}${Number(pnlPct)}%`);
                          }
                          if (pnlDollar !== null && pnlDollar !== undefined && Boolean(vis.showPnLDollar)) {
                            returnParts.push(`${Number(pnlDollar) >= 0 ? '+$' : '-$'}${Math.abs(Number(pnlDollar)).toLocaleString()}`);
                          }
                          if (pipsVal !== null && pipsVal !== undefined && vis.showPips !== false) {
                            returnParts.push(`${Number(pipsVal) > 0 ? '+' : ''}${Number(pipsVal)} pips`);
                          }
                          const actualReturnDisplay = returnParts.length > 0
                            ? returnParts.join(' · ')
                            : !isClosed
                            ? 'Open setup'
                            : 'Result hidden';

                          const isPositiveReturn =
                            rawOutcome === 'WIN' ||
                            (pnlPct !== null && pnlPct !== undefined && Number(pnlPct) > 0) ||
                            (pnlDollar !== null && pnlDollar !== undefined && Number(pnlDollar) > 0);
                          const isNegativeReturn =
                            rawOutcome === 'LOSS' ||
                            (pnlPct !== null && pnlPct !== undefined && Number(pnlPct) < 0) ||
                            (pnlDollar !== null && pnlDollar !== undefined && Number(pnlDollar) < 0);

                          // Count visible student metrics out of 7
                          const visibilityList = [
                            { label: 'Prices', on: vis.showPrices !== false },
                            { label: 'R:R', on: vis.showRR !== false },
                            { label: 'Win/Loss', on: vis.showResult !== false },
                            { label: '% Return', on: vis.showPnLPercent !== false },
                            { label: '$ P&L', on: Boolean(vis.showPnLDollar) },
                            { label: 'Pips', on: vis.showPips !== false },
                            { label: 'Lot size', on: Boolean(vis.showLotSize) },
                          ];
                          const visibleCount = visibilityList.filter((m) => m.on).length;
                          const visibleNames = visibilityList.filter((m) => m.on).map((m) => m.label).join(', ');

                          // Commentary progressive disclosure
                          const thesisText = (share.setupThesis || share.thesis || '').trim();
                          const entryText = (share.entryReasoning || '').trim();
                          const riskText = (share.riskRationale || '').trim();
                          const lessonsText = (share.outcomeLessons || share.takeaways || '').trim();
                          const screenshots = Array.isArray(snap.screenshots) ? snap.screenshots : [];
                          const hasExtraAnalysis =
                            Boolean(entryText || riskText || lessonsText || screenshots.length > 0) ||
                            thesisText.length > 180;
                          const isExpanded = Boolean(expandedShareAnalysis[share.id]);

                          return (
                            <article
                              key={share.id}
                              className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-3.5 shadow-2xs hover:border-border/90 transition"
                            >
                              {/* 1. Card Header: Instrument, Direction, Status, Metadata & Actions */}
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-base font-black text-foreground tracking-tight">
                                      {snap.pair || 'Instrument'}
                                    </span>

                                    {/* Semantic Direction Badge with Icon + Label */}
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${
                                        isBuy
                                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                                      }`}
                                    >
                                      {isBuy ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                      {isBuy ? 'Buy' : 'Sell'}
                                    </span>

                                    {/* Outcome / Status Badge with Icon + Label */}
                                    {!isClosed ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                                        <Clock size={11} /> Active setup
                                      </span>
                                    ) : rawOutcome === 'WIN' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                                        <CheckCircle2 size={11} /> Closed · Win
                                      </span>
                                    ) : rawOutcome === 'LOSS' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25">
                                        <AlertCircle size={11} /> Closed · Loss
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-surface-muted text-muted border border-border">
                                        Closed · Breakeven
                                      </span>
                                    )}

                                    {isCaseStudy && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-surface-muted text-foreground border border-border">
                                        <BookOpen size={11} className="text-emerald-600 dark:text-emerald-400" />
                                        Case study
                                      </span>
                                    )}

                                    {isPinned && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                                        <Pin size={11} /> Pinned
                                      </span>
                                    )}
                                  </div>

                                  {share.title && (
                                    <h5 className="text-sm font-bold text-foreground truncate">
                                      {share.title}
                                    </h5>
                                  )}

                                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted">
                                    <span>
                                      Shared {new Date(share.publishedAt || share.createdAt).toLocaleDateString()}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>{activeGroup?.name || 'Cohort'}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1">
                                      <Eye size={11} />
                                      {viewCount} student view{viewCount === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                </div>

                                {/* Card Actions: Primary Contextual Action + Edit Student View + Overflow Menu */}
                                <div className="flex flex-wrap items-center gap-2 self-end sm:self-start shrink-0">
                                  {!isClosed && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingTradeShare(share);
                                        setIsConcludeMode(true);
                                        setIsShareTradeModalOpen(true);
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
                                    >
                                      <CheckCircle2 size={13} />
                                      <span>Conclude trade</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTradeShare(share);
                                      setIsConcludeMode(false);
                                      setIsShareTradeModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-foreground text-xs font-semibold inline-flex items-center gap-1.5 transition"
                                  >
                                    <Edit3 size={12} className="text-emerald-600 dark:text-emerald-400" />
                                    <span>Edit student view</span>
                                  </button>

                                  {/* Secondary Overflow Menu (Pin / Update Outcome / Unshare with confirmation) */}
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenShareMenuId((prev) => (prev === share.id ? null : share.id))
                                      }
                                      aria-expanded={openShareMenuId === share.id}
                                      aria-haspopup="menu"
                                      aria-label="More trade actions"
                                      className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-muted hover:text-foreground transition"
                                    >
                                      <MoreHorizontal size={15} />
                                    </button>
                                    {openShareMenuId === share.id && (
                                      <div
                                        role="menu"
                                        className="absolute right-0 mt-1.5 w-48 rounded-xl border border-border bg-surface shadow-lg py-1.5 z-20"
                                      >
                                        <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => handleTogglePinShare(share)}
                                          className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-surface-muted flex items-center gap-2"
                                        >
                                          <Pin size={13} className="text-amber-600 dark:text-amber-400" />
                                          <span>{isPinned ? 'Unpin from top' : 'Pin setup to top'}</span>
                                        </button>
                                        {isClosed && (
                                          <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => {
                                              setOpenShareMenuId(null);
                                              setEditingTradeShare(share);
                                              setIsConcludeMode(true);
                                              setIsShareTradeModalOpen(true);
                                            }}
                                            className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-surface-muted flex items-center gap-2"
                                          >
                                            <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                                            <span>Update outcome & sync</span>
                                          </button>
                                        )}
                                        <div className="my-1 border-t border-border" />
                                        <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => {
                                            setOpenShareMenuId(null);
                                            setUnshareConfirmTarget(share);
                                          }}
                                          className="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                                        >
                                          <Trash2 size={13} />
                                          <span>Unshare trade…</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* 2. Core Trade Metrics: 4 Scannable Blocks (Entry, Risk, Exit, Result) */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                                {/* Block 1: Entry */}
                                <div className="p-3 rounded-xl bg-surface-muted/40 border border-border/70 space-y-1">
                                  <div className="flex items-center justify-between text-[11px] text-muted">
                                    <span className="font-semibold">Entry</span>
                                    {vis.showPrices === false && (
                                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                        Hidden
                                      </span>
                                    )}
                                  </div>
                                  <p className="font-mono font-bold text-sm text-foreground">
                                    {snap.entryPrice ?? '—'}
                                  </p>
                                  <p className="text-[11px] text-muted truncate">
                                    {[
                                      snap.session ? `${snap.session} session` : null,
                                      snap.lotSize && vis.showLotSize ? `${snap.lotSize} lots` : null,
                                    ]
                                      .filter(Boolean)
                                      .join(' · ') || 'Execution price'}
                                  </p>
                                </div>

                                {/* Block 2: Risk (SL / TP / R:R) */}
                                <div className="p-3 rounded-xl bg-surface-muted/40 border border-border/70 space-y-1">
                                  <div className="flex items-center justify-between text-[11px] text-muted">
                                    <span className="font-semibold">Risk & targets</span>
                                    {rrVal !== null && rrVal !== undefined && (
                                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                        1:{rrVal}R{vis.showRR === false ? ' (Hidden)' : ''}
                                      </span>
                                    )}
                                  </div>
                                  <p className="font-mono font-bold text-xs text-foreground truncate">
                                    SL {snap.stopLoss ?? '—'} · TP {snap.takeProfit ?? '—'}
                                  </p>
                                  <p className="text-[11px] text-muted">
                                    {vis.showPrices === false && vis.showRR === false
                                      ? 'Prices & R:R hidden from students'
                                      : 'Stop loss & target levels'}
                                  </p>
                                </div>

                                {/* Block 3: Exit */}
                                <div className="p-3 rounded-xl bg-surface-muted/40 border border-border/70 space-y-1">
                                  <div className="flex items-center justify-between text-[11px] text-muted">
                                    <span className="font-semibold">Exit</span>
                                    <span className="text-[10px] font-semibold">
                                      {isClosed ? 'Closed' : 'Open'}
                                    </span>
                                  </div>
                                  <p className="font-mono font-bold text-sm text-foreground">
                                    {snap.exitPrice ?? (isClosed ? 'Closed' : 'Active position')}
                                  </p>
                                  <p className="text-[11px] text-muted">
                                    {isClosed ? 'Final close level' : 'Awaiting trade conclusion'}
                                  </p>
                                </div>

                                {/* Block 4: Result */}
                                <div className="p-3 rounded-xl bg-surface-muted/40 border border-border/70 space-y-1">
                                  <div className="flex items-center justify-between text-[11px] text-muted">
                                    <span className="font-semibold">Result</span>
                                    {vis.showResult === false && (
                                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                        Outcome hidden
                                      </span>
                                    )}
                                  </div>
                                  <p
                                    className={`font-mono font-bold text-sm truncate ${
                                      isPositiveReturn
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : isNegativeReturn
                                        ? 'text-rose-700 dark:text-rose-400'
                                        : 'text-foreground'
                                    }`}
                                  >
                                    {actualReturnDisplay}
                                  </p>
                                  <p className="text-[11px] text-muted">
                                    {!isClosed
                                      ? 'Live signal in progress'
                                      : `Outcome: ${rawOutcome}`}
                                  </p>
                                </div>
                              </div>

                              {/* 3. Concise Student Visibility Bar */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-muted/30 border border-border/60 text-xs">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
                                    <Eye size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    Student view: {visibleCount} of 7 metrics visible
                                  </span>
                                  <span className="text-muted truncate text-[11px]">
                                    ({visibleNames || 'Commentary only'})
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTradeShare(share);
                                    setIsConcludeMode(false);
                                    setIsShareTradeModalOpen(true);
                                  }}
                                  className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline self-start sm:self-center shrink-0"
                                >
                                  Customize visibility
                                </button>
                              </div>

                              {/* 4. Progressive Disclosure Educational Commentary */}
                              {(thesisText || entryText || riskText || lessonsText || screenshots.length > 0) && (
                                <div className="space-y-2.5 pt-1">
                                  {thesisText && (
                                    <div className="text-xs space-y-1">
                                      <span className="text-[11px] font-bold text-muted">
                                        Thesis & market context
                                      </span>
                                      <p
                                        className={`text-foreground leading-relaxed whitespace-pre-wrap ${
                                          !isExpanded && hasExtraAnalysis ? 'line-clamp-2' : ''
                                        }`}
                                      >
                                        {thesisText}
                                      </p>
                                    </div>
                                  )}

                                  {isExpanded && (
                                    <div className="space-y-2.5 pt-2 border-t border-border/60 animate-fadeIn">
                                      {(entryText || riskText) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                          {entryText && (
                                            <div className="p-3 rounded-lg bg-surface-muted/30 border border-border/60 text-xs space-y-1">
                                              <span className="text-[11px] font-bold text-foreground block">
                                                Entry confirmation
                                              </span>
                                              <p className="text-muted leading-relaxed whitespace-pre-wrap">
                                                {entryText}
                                              </p>
                                            </div>
                                          )}
                                          {riskText && (
                                            <div className="p-3 rounded-lg bg-surface-muted/30 border border-border/60 text-xs space-y-1">
                                              <span className="text-[11px] font-bold text-foreground block">
                                                Invalidation & risk plan
                                              </span>
                                              <p className="text-muted leading-relaxed whitespace-pre-wrap">
                                                {riskText}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {lessonsText && (
                                        <div className="p-3 rounded-lg bg-surface-muted/30 border border-border/60 text-xs space-y-1">
                                          <span className="text-[11px] font-bold text-foreground block">
                                            Lesson & outcome
                                          </span>
                                          <p className="text-muted leading-relaxed whitespace-pre-wrap">
                                            {lessonsText}
                                          </p>
                                        </div>
                                      )}

                                      {screenshots.length > 0 && (
                                        <div className="space-y-1.5">
                                          <span className="text-[11px] font-bold text-muted block">
                                            Chart screenshots ({screenshots.length})
                                          </span>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {screenshots.map((shot, idx) => (
                                              <button
                                                key={shot.id || idx}
                                                type="button"
                                                onClick={() =>
                                                  setActiveModalImage({
                                                    ...shot,
                                                    imageUrl: resolveImageUrl(shot.imageUrl),
                                                  })
                                                }
                                                className="group relative rounded-lg overflow-hidden border border-border bg-surface-muted aspect-video text-left"
                                              >
                                                <img
                                                  src={resolveImageUrl(shot.imageUrl)}
                                                  alt={shot.note || 'Shared trade chart'}
                                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                                />
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {hasExtraAnalysis && (
                                    <button
                                      type="button"
                                      onClick={() => toggleShareAnalysis(share.id)}
                                      aria-expanded={isExpanded}
                                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline pt-0.5"
                                    >
                                      {isExpanded ? (
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
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: ANNOUNCEMENTS */}
                {cohortTab === 'announcements' && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-muted/30 border border-border">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">Cohort Announcements</h4>
                        <p className="text-xs text-muted">Broadcast market updates, session schedules, assignments, or risk notices directly to students' feeds.</p>
                      </div>
                      <Button
                        onClick={() => {
                          setAnnouncementTargetCohorts([activeGroupId]);
                          setIsNewAnnouncementOpen(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2"
                      >
                        <Plus size={14} className="mr-1.5" /> Post Announcement
                      </Button>
                    </div>

                    {/* Post Announcement Form */}
                    {isNewAnnouncementOpen && (
                      <div className="p-4 rounded-xl border border-emerald-500/30 bg-surface shadow-md space-y-3.5 animate-fadeIn">
                        <div className="flex items-center justify-between pb-2 border-b border-border">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                            <Megaphone size={14} /> New Cohort Broadcast
                          </h5>
                          <button
                            onClick={() => setIsNewAnnouncementOpen(false)}
                            className="text-muted hover:text-foreground text-xs"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <form onSubmit={handlePostAnnouncement} className="space-y-3">
                          {safeGroups.length > 1 && (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider">
                                  Target Cohorts
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAnnouncementTargetCohorts(
                                      announcementTargetCohorts.length === safeGroups.length
                                        ? [activeGroupId]
                                        : safeGroups.map((g) => g.id)
                                    )
                                  }
                                  className="text-[11px] font-bold text-emerald-500 hover:underline"
                                >
                                  {announcementTargetCohorts.length === safeGroups.length
                                    ? 'Current Cohort Only'
                                    : 'Broadcast to All My Cohorts'}
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {safeGroups.map((g) => {
                                  const isSelected = announcementTargetCohorts.includes(g.id);
                                  return (
                                    <button
                                      key={g.id}
                                      type="button"
                                      onClick={() =>
                                        setAnnouncementTargetCohorts((prev) =>
                                          prev.includes(g.id)
                                            ? prev.length > 1
                                              ? prev.filter((id) => id !== g.id)
                                              : prev
                                            : [...prev, g.id]
                                        )
                                      }
                                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                                        isSelected
                                          ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40'
                                          : 'bg-background text-muted border-border hover:text-foreground'
                                      }`}
                                    >
                                      {isSelected && <Check size={12} />}
                                      <span>{g.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                              Announcement Title *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. CPI Release & Gold Trading Bias for Today"
                              value={announcementForm.title}
                              onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, title: e.target.value }))}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                                Category
                              </label>
                              <select
                                value={announcementForm.category}
                                onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, category: e.target.value }))}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                              >
                                <option value="GENERAL">General Announcement</option>
                                <option value="MARKET_UPDATE">Market Analysis & Bias</option>
                                <option value="TRADE_ALERT">Trade Execution Alert</option>
                                <option value="WEBINAR">Live Session / Webinar</option>
                                <option value="ASSIGNMENT">Homework / Assignment</option>
                                <option value="RISK_NOTICE">Risk Management Notice</option>
                              </select>
                            </div>

                            <div className="flex items-center gap-2 pt-5">
                              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                                <input
                                  type="checkbox"
                                  checked={announcementForm.isPinned}
                                  onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, isPinned: e.target.checked }))}
                                  className="rounded text-emerald-600 focus:ring-emerald-500"
                                />
                                <Pin size={13} className="text-amber-500" /> Pin announcement to top of feed
                              </label>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                              Message Content *
                            </label>
                            <textarea
                              required
                              rows={4}
                              placeholder="Write clear instructions, session links, or market levels for your students..."
                              value={announcementForm.content}
                              onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, content: e.target.value }))}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500 leading-relaxed"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setIsNewAnnouncementOpen(false)}
                              className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-foreground"
                            >
                              Cancel
                            </button>
                            <Button
                              type="submit"
                              disabled={postingAnnouncement}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-1.5"
                            >
                              <Send size={13} className="mr-1.5" />
                              {postingAnnouncement
                                ? 'Broadcasting...'
                                : announcementTargetCohorts.length > 1
                                ? `Broadcast to ${announcementTargetCohorts.length} Cohorts`
                                : 'Broadcast to Cohort'}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}

                    {loadingAnnouncements ? (
                      <div className="py-12 text-center text-xs text-muted">
                        <RefreshCw size={20} className="animate-spin mx-auto text-emerald-500 mb-2" />
                        Loading cohort announcements...
                      </div>
                    ) : cohortAnnouncements.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-border rounded-xl p-4">
                        <Megaphone size={32} className="mx-auto text-muted mb-2 opacity-50" />
                        <p className="text-sm font-bold text-foreground">No announcements yet</p>
                        <p className="text-xs text-muted mt-1 mb-4 max-w-sm mx-auto">
                          Keep your students updated on high-impact news events, live webinars, and market biases.
                        </p>
                        <Button
                          onClick={() => setIsNewAnnouncementOpen(true)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                        >
                          <Plus size={14} className="mr-1.5" /> Create First Announcement
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {cohortAnnouncements.map((ann) => (
                          <div
                            key={ann.id}
                            className="rounded-xl border border-border bg-surface-muted/20 p-4 space-y-2.5 hover:border-border/80 transition"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                                    {(ann.category || 'ANNOUNCEMENT').replace(/_/g, ' ')}
                                  </span>
                                  {ann.isPinned && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 flex items-center gap-1">
                                      <Pin size={10} /> Pinned
                                    </span>
                                  )}
                                  <span className="text-[11px] text-muted">
                                    {new Date(ann.publishedAt || ann.createdAt).toLocaleDateString()} · {ann._count?.readReceipts || 0} student views
                                  </span>
                                </div>
                                <h5 className="text-sm font-bold text-foreground">{ann.title}</h5>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePinAnnouncement(ann)}
                                  className={`p-1.5 rounded-lg transition ${
                                    ann.isPinned
                                      ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
                                      : 'text-muted hover:text-amber-500 hover:bg-surface-muted'
                                  }`}
                                  title={ann.isPinned ? 'Unpin announcement' : 'Pin announcement to top'}
                                >
                                  <Pin size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAnnouncement(ann.id)}
                                  className="text-muted hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10 transition"
                                  title="Delete announcement"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                              {ann.body || ann.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: 1-ON-1 DIRECT COACHING CHAT */}
                {cohortTab === 'messages' && (
                  <div className="space-y-3">
                    <MentorStudentChatPanel
                      role="MENTOR"
                      activeGroup={activeGroup}
                      groups={safeGroups}
                      initialStudentId={chatPreselectedStudentId}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* UNIFIED MENTOR SETTINGS HUB MODAL */}
      {isMentorSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
            {/* Settings Modal Header */}
            <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Settings2 size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">Mentor & Academy Settings</h3>
                  <p className="text-xs text-muted">
                    {editingGroup ? `Customizing: ${editingGroup.name}` : 'Create a new cohort & customize settings'}
                  </p>
                </div>
              </div>

              {/* Cohort Selector Switcher in Settings Header */}
              <div className="flex items-center gap-2">
                {safeGroups.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1 text-xs">
                    <span className="text-muted font-medium text-[11px] hidden sm:inline">Cohort:</span>
                    <select
                      value={editingGroup ? editingGroup.id : 'NEW'}
                      onChange={(e) => handleSwitchSettingsCohort(e.target.value)}
                      className="bg-transparent text-foreground font-semibold text-xs focus:outline-none cursor-pointer py-1"
                    >
                      {safeGroups.map((g) => (
                        <option key={g.id} value={g.id} className="bg-surface text-foreground">
                          {g.name} {g.isPaid ? `(${g.currency === 'NGN' ? '₦' : '$'}${g.price})` : '(Free)'}
                        </option>
                      ))}
                      <option value="NEW" className="bg-surface text-emerald-600 font-bold">
                        + Create New Cohort
                      </option>
                    </select>
                  </div>
                )}
                <button
                  onClick={() => setIsMentorSettingsOpen(false)}
                  className="text-muted hover:text-foreground p-1.5 rounded-lg hover:bg-surface-muted transition"
                  title="Close Settings"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Settings Layout: Left Navigation + Right Content */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
              {/* Left Settings Sidebar */}
              <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-border bg-surface-muted/20 p-2 sm:p-3 flex md:flex-col gap-1 overflow-x-auto no-scrollbar shrink-0">
                <button
                  type="button"
                  onClick={() => setMentorSettingsTab('branding')}
                  className={`shrink-0 md:w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                    mentorSettingsTab === 'branding'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-muted hover:text-foreground hover:bg-surface-muted'
                  }`}
                >
                  <Image size={15} /> Branding & Banner
                </button>
                <button
                  type="button"
                  onClick={() => setMentorSettingsTab('curriculum')}
                  className={`shrink-0 md:w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                    mentorSettingsTab === 'curriculum'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-muted hover:text-foreground hover:bg-surface-muted'
                  }`}
                >
                  <CheckCircle size={15} /> Benefits & Curriculum
                </button>
                <button
                  type="button"
                  onClick={() => setMentorSettingsTab('risk')}
                  className={`shrink-0 md:w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                    mentorSettingsTab === 'risk'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-muted hover:text-foreground hover:bg-surface-muted'
                  }`}
                >
                  <ShieldCheck size={15} /> Strategy & Risk Guard
                </button>
                <button
                  type="button"
                  onClick={() => setMentorSettingsTab('pricing')}
                  className={`shrink-0 md:w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                    mentorSettingsTab === 'pricing'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-muted hover:text-foreground hover:bg-surface-muted'
                  }`}
                >
                  <CreditCard size={15} /> Pricing & Access
                </button>
                <button
                  type="button"
                  onClick={() => setMentorSettingsTab('community')}
                  className={`shrink-0 md:w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                    mentorSettingsTab === 'community'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-muted hover:text-foreground hover:bg-surface-muted'
                  }`}
                >
                  <MessageSquare size={15} /> Community Links
                </button>
                <button
                  type="button"
                  onClick={() => setMentorSettingsTab('payout')}
                  className={`shrink-0 md:w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                    mentorSettingsTab === 'payout'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-muted hover:text-foreground hover:bg-surface-muted'
                  }`}
                >
                  <Building2 size={15} /> Payout Account
                </button>
                <button
                  type="button"
                  onClick={() => setMentorSettingsTab('preview')}
                  className={`shrink-0 md:w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                    mentorSettingsTab === 'preview'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-muted hover:text-foreground hover:bg-surface-muted'
                  }`}
                >
                  <Eye size={15} /> Banner Preview
                </button>
                <button
                  type="button"
                  onClick={() => setMentorSettingsTab('cohorts')}
                  className={`shrink-0 md:w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                    mentorSettingsTab === 'cohorts'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-muted hover:text-foreground hover:bg-surface-muted'
                  }`}
                >
                  <Users size={15} /> All Cohorts
                </button>
              </div>

              {/* Right Settings Content */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                {/* TAB 1: Banner & Branding */}
                {mentorSettingsTab === 'branding' && (
                  <div className="space-y-4">
                    {!editingGroup ? (
                      <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <Sparkles size={18} className="shrink-0 text-emerald-500" />
                          <div>
                            <span className="font-bold text-foreground block">Creating a Brand New Cohort</span>
                            <p className="text-[11px] text-muted">Enter your cohort name below and customize your public banner.</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0 uppercase tracking-wider">
                          New Cohort
                        </span>
                      </div>
                    ) : (
                      <div>
                        <h4 className="text-sm font-bold text-foreground">Cohort Identity & Academy Branding</h4>
                        <p className="text-xs text-muted">Customize how your mentorship program looks on the public invitation banner.</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                          Cohort Name *
                        </label>
                        <input
                          type="text"
                          required
                          autoFocus={!editingGroup}
                          placeholder="e.g. Alpha FX Mastermind 2026"
                          value={groupFormData.name}
                          onChange={(e) => setGroupFormData((prev) => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                          Academy Brand Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Apex Trading Academy"
                          value={groupFormData.academyName}
                          onChange={(e) => setGroupFormData((prev) => ({ ...prev, academyName: e.target.value }))}
                          className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                        Description / Program Focus
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Smart-money concepts, liquidity sweeps, and prop firm funded challenge prep."
                        value={groupFormData.description}
                        onChange={(e) => setGroupFormData((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5 flex items-center justify-between">
                          <span>Academy Logo</span>
                          {groupFormData.logoUrl && (
                            <button
                              type="button"
                              onClick={() => setGroupFormData((prev) => ({ ...prev, logoUrl: '' }))}
                              className="text-[10px] text-rose-500 hover:text-rose-400 font-bold transition-colors"
                            >
                              Remove Logo
                            </button>
                          )}
                        </label>
                        
                        {/* Hidden File Input */}
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
                          onChange={handleLogoFileChange}
                          className="hidden"
                        />

                        {/* Upload Button + Preview */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => logoFileInputRef.current?.click()}
                              disabled={uploadingLogo}
                              className="flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-border bg-surface-muted hover:bg-surface-hover text-foreground transition-all duration-200 shadow-sm active:scale-95 disabled:opacity-50"
                            >
                              {uploadingLogo ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                  <span>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <Upload size={14} className="text-emerald-500" />
                                  <span>Upload from Device</span>
                                </>
                              )}
                            </button>

                            {groupFormData.logoUrl ? (
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-9 w-9 rounded-xl border border-border bg-surface-muted p-1 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                                  <img
                                    src={groupFormData.logoUrl}
                                    alt="Logo preview"
                                    className="h-full w-full object-contain"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                </div>
                                <span className="text-[11px] text-muted truncate max-w-[120px]">
                                  Logo selected
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted italic">
                                No logo selected
                              </span>
                            )}
                          </div>

                          {/* Fallback URL input */}
                          <div className="pt-0.5">
                            <input
                              type="url"
                              placeholder="Or paste direct image URL (https://...)"
                              value={groupFormData.logoUrl}
                              onChange={(e) => setGroupFormData((prev) => ({ ...prev, logoUrl: e.target.value }))}
                              className="w-full px-3 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                          Custom Badge / Tagline
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 🔥 VIP Masterclass 2026"
                          value={groupFormData.customBadge}
                          onChange={(e) => setGroupFormData((prev) => ({ ...prev, customBadge: e.target.value }))}
                          className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1">
                          <Target size={13} className="text-emerald-500" /> Target Markets
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Forex, Gold & Indices"
                          value={groupFormData.targetMarkets}
                          onChange={(e) => setGroupFormData((prev) => ({ ...prev, targetMarkets: e.target.value }))}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1">
                          <Layers size={13} className="text-emerald-500" /> Skill Level
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Beginner to Advanced"
                          value={groupFormData.skillLevel}
                          onChange={(e) => setGroupFormData((prev) => ({ ...prev, skillLevel: e.target.value }))}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1">
                          <Clock size={13} className="text-emerald-500" /> Duration
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 8-Week Intensive"
                          value={groupFormData.duration}
                          onChange={(e) => setGroupFormData((prev) => ({ ...prev, duration: e.target.value }))}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: Curriculum & Benefits */}
                {mentorSettingsTab === 'curriculum' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">Curriculum & "What You'll Receive" Points</h4>
                        <p className="text-xs text-muted">Customize the exact bullet points students see on the invitation banner.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddBenefit('')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 transition"
                      >
                        <PlusCircle size={14} /> Add Bullet
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(groupFormData.benefits || []).map((benefit, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="text-emerald-500 shrink-0">
                            <CheckCircle2 size={16} />
                          </div>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Weekly live trade breakdowns and risk-management reviews"
                            value={benefit}
                            onChange={(e) => handleBenefitChange(idx, e.target.value)}
                            className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveBenefit(idx)}
                            className="p-2 rounded-lg text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                            title="Remove bullet point"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}

                      {(!groupFormData.benefits || groupFormData.benefits.length === 0) && (
                        <div className="py-6 text-center border border-dashed border-border rounded-xl text-muted text-xs">
                          No custom bullets added. Click below to add curriculum points.
                        </div>
                      )}
                    </div>

                    {/* Quick Suggested Benefit Chips */}
                    <div className="pt-2 border-t border-border/60">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-2">
                        Click to Quick-Add Suggestions:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Direct mentor trade execution grading & feedback',
                          'Personalized JAHZ AI weekly performance coaching summaries',
                          'Exclusive VIP Telegram trade alerts & daily outlook',
                          'Strict risk management & prop firm funded challenge prep',
                          'Weekly live Zoom Q&A and trade breakdown sessions',
                          'Access to private cohort trader accountability room',
                        ].map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => handleAddBenefit(sug)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-muted hover:bg-surface border border-border text-foreground hover:border-emerald-500/40 flex items-center gap-1 transition"
                          >
                            <Plus size={11} className="text-emerald-500" /> {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: Strategy & Risk Guard */}
                {mentorSettingsTab === 'risk' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <ShieldCheck size={16} className="text-emerald-500" />
                          Student Strategy Risk Guard & Rule Enforcement
                        </h4>
                        <p className="text-xs text-muted">
                          Set strict cohort risk parameters. JahzJournal audits student logs and flags rule breaches with mathematical proof.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={groupFormData.enforceRiskGuard}
                          onChange={(e) => setGroupFormData((prev) => ({ ...prev, enforceRiskGuard: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-muted leading-relaxed">
                      💡 <strong className="text-foreground">Why this eliminates Telegram arguments:</strong> Students often blow funded or personal accounts by risking 10%–15% on Gold, then run to group chats claiming "the strategy failed". JahzJournal's Risk Guard engine automatically captures the mathematical violation and attaches cold-hard proof before you give feedback.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Max Risk Per Trade */}
                      <div className="p-3.5 rounded-xl border border-border bg-surface space-y-2">
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                          <span>Max Risk Per Trade (%)</span>
                          <span className="text-emerald-500 font-mono font-bold text-xs">{groupFormData.maxRiskPerTradePercent || 1.0}%</span>
                        </label>
                        <p className="text-[11px] text-muted">
                          Trades where calculated risk or loss exceeds this % of account balance are immediately flagged.
                        </p>
                        <div className="relative mt-1">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="50"
                            value={groupFormData.maxRiskPerTradePercent ?? 1.0}
                            onChange={(e) => setGroupFormData((prev) => ({ ...prev, maxRiskPerTradePercent: parseFloat(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                            placeholder="1.0"
                          />
                          <span className="absolute right-3 top-2 text-xs text-muted font-bold">%</span>
                        </div>
                      </div>

                      {/* Max Daily Loss */}
                      <div className="p-3.5 rounded-xl border border-border bg-surface space-y-2">
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                          <span>Max Daily Loss Drawdown (%)</span>
                          <span className="text-rose-500 font-mono font-bold text-xs">{groupFormData.maxDailyLossPercent || 3.0}%</span>
                        </label>
                        <p className="text-[11px] text-muted">
                          Daily stop-out threshold to teach prop firm drawdown management.
                        </p>
                        <div className="relative mt-1">
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="50"
                            value={groupFormData.maxDailyLossPercent ?? 3.0}
                            onChange={(e) => setGroupFormData((prev) => ({ ...prev, maxDailyLossPercent: parseFloat(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                            placeholder="3.0"
                          />
                          <span className="absolute right-3 top-2 text-xs text-muted font-bold">%</span>
                        </div>
                      </div>

                      {/* Max Daily Trades */}
                      <div className="p-3.5 rounded-xl border border-border bg-surface space-y-2">
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                          <span>Max Daily Trades (Overtrading Guard)</span>
                          <span className="text-foreground font-mono font-bold text-xs">{groupFormData.maxDailyTrades || 5} trades/day</span>
                        </label>
                        <p className="text-[11px] text-muted">
                          Prevents tilt & revenge trading. Any trade past this daily execution limit gets flagged.
                        </p>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          max="50"
                          value={groupFormData.maxDailyTrades ?? 5}
                          onChange={(e) => setGroupFormData((prev) => ({ ...prev, maxDailyTrades: parseInt(e.target.value, 10) || 1 }))}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500 mt-1"
                          placeholder="5"
                        />
                      </div>

                      {/* Mandatory Stop Loss */}
                      <div className="p-3.5 rounded-xl border border-border bg-surface space-y-2">
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                          <span>Mandatory Stop Loss Rule</span>
                          <input
                            type="checkbox"
                            checked={groupFormData.requireStopLoss}
                            onChange={(e) => setGroupFormData((prev) => ({ ...prev, requireStopLoss: e.target.checked }))}
                            className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                          />
                        </label>
                        <p className="text-[11px] text-muted">
                          Strict requirement: automatically flags any trade opened or closed without a Stop Loss.
                        </p>
                        <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                          groupFormData.requireStopLoss ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-surface-muted text-muted'
                        }`}>
                          {groupFormData.requireStopLoss ? 'Strict Stop Loss Required' : 'Optional Stop Loss'}
                        </span>
                      </div>
                    </div>

                    {/* Approved Strategy Pairs */}
                    <div className="p-3.5 rounded-xl border border-border bg-surface space-y-2">
                      <label className="text-xs font-bold text-foreground block">
                        Approved Focus Trading Pairs (Curriculum Scope)
                      </label>
                      <p className="text-[11px] text-muted">
                        Comma-separated list of symbols taught in this cohort (e.g. <code className="text-emerald-500 font-mono">EURUSD, GBPUSD, XAUUSD, USDJPY, NAS100</code>). Trades taken outside these pairs will be flagged as unauthorized. Leave blank to allow all pairs.
                      </p>
                      <input
                        type="text"
                        value={groupFormData.allowedPairs || ''}
                        onChange={(e) => setGroupFormData((prev) => ({ ...prev, allowedPairs: e.target.value }))}
                        placeholder="e.g. EURUSD, GBPUSD, XAUUSD, USDJPY"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500 uppercase font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 3: Pricing & Fees */}
                {mentorSettingsTab === 'pricing' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Mentorship Enrollment & Pricing Structure</h4>
                      <p className="text-xs text-muted">Choose whether student enrollment is free or requires a fee.</p>
                    </div>

                    <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-foreground">Paid Mentorship Enrollment</p>
                          <p className="text-[11px] text-muted">Require students to complete payment before joining this cohort.</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={groupFormData.isPaid}
                          onChange={(e) => setGroupFormData((prev) => ({ ...prev, isPaid: e.target.checked }))}
                          className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>

                      {groupFormData.isPaid && (
                        <div className="pt-3 border-t border-border space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                                Fee Amount *
                              </label>
                              <input
                                type="number"
                                min="1"
                                required
                                value={groupFormData.price}
                                onChange={(e) => setGroupFormData((prev) => ({ ...prev, price: e.target.value }))}
                                className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                                Currency
                              </label>
                              <select
                                value={groupFormData.currency}
                                onChange={(e) => setGroupFormData((prev) => ({ ...prev, currency: e.target.value }))}
                                className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                              >
                                <option value="USD">USD ($)</option>
                                <option value="NGN">NGN (₦)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                                Billing Cycle
                              </label>
                              <select
                                value={groupFormData.billingCycle}
                                onChange={(e) => setGroupFormData((prev) => ({ ...prev, billingCycle: e.target.value }))}
                                className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                              >
                                <option value="ONE_TIME">One-Time Lifetime</option>
                                <option value="MONTHLY">Monthly Recurring</option>
                              </select>
                            </div>
                          </div>

                          {/* Revenue Split Transparent Note */}
                          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 leading-relaxed">
                            <strong>Transparent Revenue Split:</strong> Mentor net payout is <strong>98.5%</strong> ({groupFormData.currency === 'NGN' ? '₦' : '$'}{(groupFormData.price * 0.985).toLocaleString()}), JahzJournals platform commission is <strong>1.5%</strong> ({groupFormData.currency === 'NGN' ? '₦' : '$'}{(groupFormData.price * 0.015).toLocaleString()}).
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: Community Links */}
                {mentorSettingsTab === 'community' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Community & Group Channels</h4>
                      <p className="text-xs text-muted">Attach your private trader channels to show on the invitation banner and student welcome receipt.</p>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5">
                          <Send size={14} className="text-sky-500" /> VIP Telegram Channel / Group Link
                        </label>
                        <input
                          type="url"
                          placeholder="https://t.me/+YourTelegramInviteHash"
                          value={groupFormData.telegramLink}
                          onChange={(e) => setGroupFormData((prev) => ({ ...prev, telegramLink: e.target.value }))}
                          className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5">
                          <MessageSquare size={14} className="text-indigo-500" /> VIP Discord Server Invite Link
                        </label>
                        <input
                          type="url"
                          placeholder="https://discord.gg/YourDiscordCode"
                          value={groupFormData.discordLink}
                          onChange={(e) => setGroupFormData((prev) => ({ ...prev, discordLink: e.target.value }))}
                          className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: Settlement Bank Details */}
                {mentorSettingsTab === 'payout' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">Settlement Bank Account (98.5% Payouts · 1.5% Platform Fee)</h4>
                        <p className="text-xs text-muted">Configure the bank account where your 98.5% student mentorship fees will be deposited directly via Paystack.</p>
                      </div>
                      {payoutForm.subaccountCode && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[11px] font-bold">
                          <CheckCircle2 size={12} /> Paystack Subaccount: {payoutForm.subaccountCode}
                        </span>
                      )}
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                          Settlement Bank *
                        </label>
                        {availableBanks.length > 0 ? (
                          <select
                            required
                            value={payoutForm.bankCode || ''}
                            onChange={(e) => {
                              const code = e.target.value;
                              const matched = availableBanks.find((b) => b.code === code);
                              setPayoutForm((prev) => ({
                                ...prev,
                                bankCode: code,
                                bankName: matched ? matched.name : prev.bankName,
                              }));
                            }}
                            className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">{payoutForm.bankName ? `${payoutForm.bankName} (Select to change)` : 'Select your bank...'}</option>
                            {availableBanks.map((bank) => (
                              <option key={`${bank.code}-${bank.name}`} value={bank.code}>
                                {bank.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            required
                            placeholder="e.g. Guaranty Trust Bank / Access Bank"
                            value={payoutForm.bankName}
                            onChange={(e) => setPayoutForm((prev) => ({ ...prev, bankName: e.target.value }))}
                            className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                            Account Number (10-digit NUBAN) *
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={10}
                            placeholder="e.g. 0123456789"
                            value={payoutForm.accountNumber}
                            onChange={(e) => setPayoutForm((prev) => ({ ...prev, accountNumber: e.target.value }))}
                            className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                            Account Holder / Business Name *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Jahz FX Trading Academy"
                            value={payoutForm.accountName}
                            onChange={(e) => setPayoutForm((prev) => ({ ...prev, accountName: e.target.value }))}
                            className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-muted space-y-1">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <ShieldCheck size={14} className="text-emerald-500" /> Automated Direct Payouts via Paystack Subaccount
                        </span>
                        <p>
                          Saving your bank details automatically creates or updates your Paystack subaccount so student mentorship payments are split automatically (98.5% to your settlement account, 1.5% platform fee).
                        </p>
                      </div>

                      <div className="pt-2">
                        <Button
                          onClick={handleSavePayout}
                          disabled={savingPayout}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                        >
                          {savingPayout ? 'Syncing Paystack Subaccount...' : 'Save Bank & Sync Subaccount'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 6: Live Banner Preview */}
                {mentorSettingsTab === 'preview' && (
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Live Public Banner Preview</h4>
                      <p className="text-xs text-muted">This is how your enrollment page appears to students at <code className="text-emerald-500 font-mono text-[11px]">/join/cohort/{editingGroup?.id || ':id'}</code></p>
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-5 space-y-4 shadow-inner">
                      <div className="text-center space-y-2">
                        {groupFormData.logoUrl && (
                          <div className="mx-auto h-12 w-12 rounded-xl border border-border bg-surface p-1.5 overflow-hidden flex items-center justify-center">
                            <img src={groupFormData.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                          </div>
                        )}
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
                          <GraduationCap size={12} /> {groupFormData.customBadge || 'Academy Cohort Enrollment'}
                        </span>
                        <h4 className="text-lg font-black text-foreground">{groupFormData.name || 'Cohort Title'}</h4>
                        {groupFormData.description && (
                          <p className="text-xs text-muted max-w-sm mx-auto">{groupFormData.description}</p>
                        )}
                        {(groupFormData.targetMarkets || groupFormData.skillLevel || groupFormData.duration) && (
                          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                            {groupFormData.targetMarkets && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-surface border border-border text-foreground">
                                🎯 {groupFormData.targetMarkets}
                              </span>
                            )}
                            {groupFormData.skillLevel && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-surface border border-border text-foreground">
                                ⚡ {groupFormData.skillLevel}
                              </span>
                            )}
                            {groupFormData.duration && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-surface border border-border text-foreground">
                                ⏳ {groupFormData.duration}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Pricing Badge in Preview */}
                      <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted block">Mentorship Fee</span>
                          <span className="text-base font-black text-foreground">
                            {groupFormData.isPaid
                              ? `${groupFormData.currency === 'NGN' ? '₦' : '$'}${Number(groupFormData.price || 0).toLocaleString()} ${groupFormData.billingCycle === 'MONTHLY' ? '/mo' : 'one-time'}`
                              : 'Free Community Access'}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                          {groupFormData.isPaid ? 'Paid Enrollment' : 'Free Access'}
                        </span>
                      </div>

                      {/* Benefits in Preview */}
                      <div className="space-y-1.5 text-xs text-foreground">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">What Students Receive:</span>
                        {(groupFormData.benefits && groupFormData.benefits.length > 0
                          ? groupFormData.benefits
                          : ['Direct mentor reviews & execution grading on your journal logs']
                        ).map((b, bIdx) => (
                          <div key={bIdx} className="flex items-start gap-1.5 text-[11px]">
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 7: Manage Cohorts */}
                {mentorSettingsTab === 'cohorts' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">All Academy Cohorts</h4>
                        <p className="text-xs text-muted">Create new cohorts, switch active selection, or delete cohorts.</p>
                      </div>
                      <Button
                        onClick={() => handleSwitchSettingsCohort('NEW', 'branding')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                      >
                        <Plus size={14} className="mr-1" /> New Cohort
                      </Button>
                    </div>

                    {/* Direct Quick Create Card */}
                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <PlusCircle size={15} className="text-emerald-500" /> Create New Cohort
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSwitchSettingsCohort('NEW', 'branding')}
                          className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          Full Customization (Branding & Curriculum) →
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          placeholder="Enter new cohort name (e.g. Forex & Gold Mastermind 2026)..."
                          value={!editingGroup ? groupFormData.name : ''}
                          onChange={(e) => {
                            if (editingGroup) {
                              setEditingGroup(null);
                            }
                            setGroupFormData((prev) => ({ ...prev, name: e.target.value }));
                          }}
                          className="flex-1 px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500 font-medium"
                        />
                        <Button
                          type="button"
                          onClick={handleSaveGroup}
                          disabled={savingGroup || (editingGroup ? false : !groupFormData.name.trim())}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0"
                        >
                          {savingGroup ? 'Creating...' : 'Create Cohort'}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {safeGroups.map((g) => (
                        <div
                          key={g.id}
                          className="p-3.5 rounded-xl border border-border bg-surface-muted/30 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground">{g.name}</span>
                              {g.isPaid ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                  {g.currency === 'NGN' ? '₦' : '$'}{g.price}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-surface text-muted border border-border">
                                  Free
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted mt-0.5">{g.students?.length || 0} students enrolled</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                handleSwitchSettingsCohort(g.id);
                                setMentorSettingsTab('branding');
                              }}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface border border-border hover:bg-surface-muted text-foreground transition"
                            >
                              Edit Details
                            </button>
                            <button
                              onClick={() => handleDeleteGroup(g.id, g.name)}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                              title="Delete Cohort"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-border bg-surface-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted">
                {editingGroup ? (
                  <span>Editing <strong>{editingGroup.name}</strong></span>
                ) : (
                  <span>Creating a brand new cohort</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsMentorSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-foreground"
                >
                  Close
                </button>
                {mentorSettingsTab !== 'payout' && (
                  <Button
                    onClick={handleSaveGroup}
                    disabled={savingGroup}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                  >
                    {savingGroup ? 'Saving...' : editingGroup ? 'Save Cohort Settings' : 'Create Cohort'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Invite & Enroll Student Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <UserPlus size={18} className="text-emerald-500" /> Student Enrollment Tools
              </h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl bg-surface-muted p-1 border border-border">
              <button
                type="button"
                onClick={() => setInviteTab('link')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  inviteTab === 'link'
                    ? 'bg-surface text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <LinkIcon size={14} /> Shareable Invite Link
              </button>
              <button
                type="button"
                onClick={() => setInviteTab('email')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  inviteTab === 'email'
                    ? 'bg-surface text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <Mail size={14} /> Direct Email Add
              </button>
            </div>

            {inviteTab === 'link' ? (
              <div className="space-y-4">
                <p className="text-xs text-muted leading-relaxed">
                  Share this unique cohort link with your community on Telegram, Discord, or WhatsApp. Anyone who clicks will be automatically enrolled into <span className="font-semibold text-foreground">{activeGroup?.name}</span>.
                </p>

                <div className="rounded-xl border border-border bg-background p-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-foreground font-mono truncate">{cohortInviteUrl}</span>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInviteStudent} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                    Student Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="student@example.com"
                    value={newInviteEmail}
                    onChange={(e) => setNewInviteEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-muted mt-1.5">
                    Enter the registered email of the student you wish to enroll into this cohort.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <Button type="submit" disabled={invitingStudent} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
                    {invitingStudent ? 'Enrolling...' : 'Enroll Student'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: Student Trade Inspector Drawer */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full sm:max-w-2xl md:max-w-3xl h-full bg-surface border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface-muted/40">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-muted transition shrink-0"
                  title="Back"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2 truncate">
                    {selectedStudent.name}'s Trade Journal
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted truncate">{selectedStudent.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const stId = selectedStudent.id;
                    setSelectedStudent(null);
                    setChatPreselectedStudentId(stId);
                    setCohortTab('messages');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <MessageSquare size={13} /> 1-on-1 Chat
                </button>
                <button 
                  onClick={() => setSelectedStudent(null)} 
                  className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-muted transition shrink-0"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Drawer Body: Trades List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
              {loadingTrades ? (
                <div className="py-16 text-center text-muted">
                  <RefreshCw size={24} className="animate-spin mx-auto text-emerald-500 mb-2" />
                  <p className="text-xs">Loading student trade history...</p>
                </div>
              ) : studentTrades.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-border rounded-xl p-4">
                  <p className="text-sm font-semibold text-foreground">No trades logged yet</p>
                  <p className="text-xs text-muted mt-1 max-w-sm mx-auto leading-relaxed">
                    This student hasn't logged any trades yet, or trade sync is currently paused in their settings.
                  </p>
                </div>
              ) : (
                studentTrades.map((trade) => {
                  const isWin = trade.result === 'WIN';
                  const isLoss = trade.result === 'LOSS';

                  return (
                    <div
                      key={trade.id}
                      className="rounded-xl border border-border bg-background p-4 space-y-3 shadow-xs"
                    >
                      {/* Trade Top Bar */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="font-black text-sm text-foreground">{trade.pair}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            trade.direction === 'BUY'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-500'
                          }`}>
                            {trade.direction}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isWin
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : isLoss
                              ? 'bg-rose-500/15 text-rose-400'
                              : 'bg-surface-muted text-muted'
                          }`}>
                            {trade.result}
                          </span>
                          {trade.grade && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Grade: {trade.grade}
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs sm:text-sm font-black ${
                            trade.profitLossAmount > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : trade.profitLossAmount < 0
                              ? 'text-rose-500'
                              : 'text-muted'
                          }`}>
                            {trade.profitLossAmount !== null && trade.profitLossAmount !== undefined
                              ? `${trade.profitLossAmount >= 0 ? '+' : ''}$${trade.profitLossAmount.toLocaleString()}`
                              : '-'}
                          </span>
                          {trade.profitLossPercent && (
                            <span className="text-[10px] sm:text-[11px] text-muted ml-1">
                              ({trade.profitLossPercent > 0 ? '+' : ''}{trade.profitLossPercent}%)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Trade Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-surface border border-border/50">
                          <span className="text-[10px] text-muted block">Entry Price</span>
                          <span className="font-semibold text-foreground">{trade.entryPrice || '-'}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface border border-border/50">
                          <span className="text-[10px] text-muted block">Exit Price</span>
                          <span className="font-semibold text-foreground">{trade.exitPrice || '-'}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface border border-border/50">
                          <span className="text-[10px] text-muted block">R:R Ratio</span>
                          <span className="font-semibold text-foreground">{trade.riskRewardRatio ? `${trade.riskRewardRatio}R` : '-'}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface border border-border/50">
                          <span className="text-[10px] text-muted block">Stop Loss</span>
                          <span className={`font-semibold ${!trade.stopLoss ? 'text-rose-500 font-bold' : 'text-foreground'}`}>
                            {trade.stopLoss || 'None (Unprotected)'}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface border border-border/50">
                          <span className="text-[10px] text-muted block">Risk Amount</span>
                          <span className="font-semibold text-foreground">
                            {trade.riskAmount ? `$${trade.riskAmount.toLocaleString()}` : '-'}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface border border-border/50">
                          <span className="text-[10px] text-muted block">Calculated Risk %</span>
                          <span className={`font-semibold ${
                            trade.riskGuardViolations?.some((v) => v.type === 'EXCESSIVE_RISK')
                              ? 'text-rose-500 font-bold flex items-center gap-1'
                              : 'text-foreground'
                          }`}>
                            {trade.calculatedRiskPercent !== null && trade.calculatedRiskPercent !== undefined
                              ? `${trade.calculatedRiskPercent}%`
                              : '-'}
                            {trade.riskGuardViolations?.some((v) => v.type === 'EXCESSIVE_RISK') && (
                              <ShieldAlert size={12} className="text-rose-500 shrink-0" />
                            )}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface border border-border/50">
                          <span className="text-[10px] text-muted block">Trading Session</span>
                          <span className="font-semibold text-foreground">{trade.session || 'Standard'}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface border border-border/50">
                          <span className="text-[10px] text-muted block">Account Balance</span>
                          <span className="font-semibold text-foreground">
                            {trade.tradingAccount?.startingBalance
                              ? `$${trade.tradingAccount.startingBalance.toLocaleString()}`
                              : '-'}
                          </span>
                        </div>
                      </div>

                      {/* ACADEMY STRATEGY RISK GUARD VIOLATIONS */}
                      {trade.riskGuardViolations && trade.riskGuardViolations.length > 0 && (
                        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 sm:p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/20 text-rose-500">
                                <ShieldAlert size={15} />
                              </span>
                              <span className="text-xs font-bold text-rose-500 tracking-wide uppercase">
                                Strategy Risk Violation Proof ({trade.riskGuardViolations.length} Detected)
                              </span>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-semibold border border-rose-500/30">
                              Academy Rule Breach
                            </span>
                          </div>

                          <div className="space-y-2">
                            {trade.riskGuardViolations.map((v, vIdx) => (
                              <div key={vIdx} className="p-2.5 rounded-lg bg-background/80 border border-rose-500/20 text-xs space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-1 font-bold text-rose-500">
                                  <span className="flex items-center gap-1.5">
                                    <AlertCircle size={13} /> {v.title}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
                                    Rule Limit: {v.ruleLimit} vs Actual: {v.actualValue}
                                  </span>
                                </div>
                                <p className="text-foreground text-[11px] leading-relaxed">
                                  {v.message}
                                </p>
                                {v.evidence && (
                                  <p className="text-muted text-[10px] font-mono">
                                    Proof: {v.evidence}
                                  </p>
                                )}
                                <div className="pt-1 flex justify-end">
                                  <button
                                    onClick={() => handleIssueViolationWarning(trade, v)}
                                    className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:underline transition"
                                  >
                                    <FileText size={12} /> 1-Click Disciplinary Warning Notice &rarr;
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reasons & Notes */}
                      {trade.entryReason && (
                        <div className="text-xs text-muted bg-surface p-2.5 rounded-lg border border-border/50 leading-relaxed">
                          <span className="font-semibold text-foreground">Entry Reason: </span>
                          {trade.entryReason}
                        </div>
                      )}

                      {/* Trade Chart Screenshots */}
                      {trade.screenshots && trade.screenshots.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                            <Image size={13} className="text-emerald-500" /> Student's Chart Screenshots ({trade.screenshots.length}):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {trade.screenshots.map((s) => (
                              <div
                                key={s.id}
                                onClick={() => setActiveModalImage(s)}
                                className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-surface hover:border-emerald-500/60 transition shadow-xs"
                              >
                                <div className="aspect-video w-full overflow-hidden bg-surface-muted flex items-center justify-center">
                                  <img
                                    src={resolveImageUrl(s.imageUrl)}
                                    alt={s.note || s.screenshotType}
                                    className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                                  />
                                </div>
                                <div className="p-2 flex items-center justify-between text-[11px] bg-surface">
                                  <span className="font-semibold text-foreground px-1.5 py-0.5 rounded bg-surface-muted border border-border text-[10px]">
                                    {s.screenshotType?.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 group-hover:underline text-[11px]">
                                    <Eye size={12} /> View Full
                                  </span>
                                </div>
                                {s.note && (
                                  <p className="px-2 pb-2 text-[10px] text-muted truncate">
                                    {s.note}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rule Violations */}
                      {trade.ruleViolations && trade.ruleViolations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {trade.ruleViolations.map((v, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1"
                            >
                              <ShieldAlert size={11} />
                              {v.tradeRule?.name || v.rule?.name || v.note || 'Rule Breach'}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Existing Mentor Feedbacks */}
                      {trade.mentorFeedbacks && trade.mentorFeedbacks.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-border/60">
                          <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                            <Award size={13} className="text-amber-400" /> Mentor Reviews Given:
                          </span>
                          {trade.mentorFeedbacks.map((fb) => (
                            <div key={fb.id} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs space-y-1">
                              <div className="flex items-center justify-between font-bold text-amber-500">
                                <span>Reviewed by {fb.mentor?.name || 'Mentor'}</span>
                                {fb.grade && <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-[11px]">Grade: {fb.grade}</span>}
                              </div>
                              <p className="text-foreground leading-relaxed">{fb.feedback}</p>
                              {fb.recommendation && (
                                <p className="text-muted text-[11px] italic">Focus: {fb.recommendation}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action: Grade & Review Button */}
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => handleOpenReview(trade)}
                          className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
                        >
                          <Award size={14} /> Review & Grade Trade
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Review & Grade Trade Modal */}
      {reviewingTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-xl space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <Award size={18} className="text-emerald-500" /> Review Trade: {reviewingTrade.pair} ({reviewingTrade.direction})
                </h3>
                <p className="text-xs text-muted">Leave clear coaching feedback and an execution grade to guide your student.</p>
              </div>
              <button 
                onClick={() => setReviewingTrade(null)} 
                className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-muted transition shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Student's Attached Chart Screenshots inside Review Modal */}
            {reviewingTrade.screenshots && reviewingTrade.screenshots.length > 0 && (
              <div className="p-3 rounded-xl border border-border bg-surface-muted/40 space-y-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Image size={14} className="text-emerald-500" /> Student's Chart Screenshots ({reviewingTrade.screenshots.length})
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {reviewingTrade.screenshots.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setActiveModalImage(s)}
                      className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-background hover:border-emerald-500/60 transition shadow-xs"
                    >
                      <div className="aspect-video w-full overflow-hidden bg-surface-muted flex items-center justify-center">
                        <img
                          src={resolveImageUrl(s.imageUrl)}
                          alt={s.note || s.screenshotType}
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                        />
                      </div>
                      <div className="p-1.5 text-[10px] text-center font-semibold text-muted group-hover:text-emerald-500 truncate">
                        {s.screenshotType?.replace(/_/g, ' ')}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted italic">Click any screenshot above to expand and zoom.</p>
              </div>
            )}

            {/* Risk Guard Violation Banner inside Review Modal */}
            {reviewingTrade.riskGuardViolations && reviewingTrade.riskGuardViolations.length > 0 && (
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-1.5 text-xs">
                <span className="font-bold text-rose-500 flex items-center gap-1.5">
                  <ShieldAlert size={14} /> Strategy Risk Breaches Detected ({reviewingTrade.riskGuardViolations.length}):
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-foreground text-[11px]">
                  {reviewingTrade.riskGuardViolations.map((v, i) => (
                    <li key={i}>
                      <strong className="text-rose-400">{v.title}:</strong> {v.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleSubmitFeedback} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                  Execution Grade
                </label>
                <select
                  value={feedbackGrade}
                  onChange={(e) => setFeedbackGrade(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="A+">A+ · Flawless execution according to plan</option>
                  <option value="A">A · Solid trade with minor execution details</option>
                  <option value="B">B · Acceptable setup, but room for better timing</option>
                  <option value="C">C · Hesitation, early close, or skewed R:R</option>
                  <option value="D">D · Off-session entry or rushed setup</option>
                  <option value="MISTAKE">Rule Breach · Emotional entry, FOMO, or oversized risk</option>
                  <option value="F">F · Critical Strategy Risk Breach (Disciplinary Flag)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                  Coaching Notes & Observations *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Great patience waiting for the 15m shift. Next time, consider locking partial profits around the 1:2 mark on GBPUSD."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                  Key Focus for Next Trade (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Focus exclusively on London Open setups next week."
                  value={feedbackRec}
                  onChange={(e) => setFeedbackRec(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewingTrade(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-foreground text-center"
                >
                  Cancel
                </button>
                <Button 
                  type="submit" 
                  disabled={submittingFeedback} 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2"
                >
                  {submittingFeedback ? 'Publishing...' : 'Publish Feedback to Student'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: JAHZ AI Performance Review Editor Modal */}
      {aiDraftModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-xl space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                    JAHZ AI Coaching Draft: {aiDraftModalStudent.name}
                  </h3>
                  <p className="text-xs text-muted truncate">Review and refine this performance summary before sending it directly to your student.</p>
                </div>
              </div>
              <button 
                onClick={() => setAiDraftModalStudent(null)} 
                className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-muted transition shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                Drafted Coaching Letter (Markdown)
              </label>
              <textarea
                rows={9}
                value={aiDraftLetter}
                onChange={(e) => setAiDraftLetter(e.target.value)}
                className="w-full p-3.5 text-xs sm:text-sm font-mono rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500 leading-relaxed resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-muted">
                This coaching summary will be attached directly to your student's recent trade log for them to study.
              </p>
              <div className="flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setAiDraftModalStudent(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted hover:text-foreground"
                >
                  Discard
                </button>
                <Button
                  onClick={handlePublishSummary}
                  disabled={publishingSummary}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2"
                >
                  <Send size={14} className="mr-1.5" />
                  {publishingSummary ? 'Sending...' : 'Send to Student'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unshare Trade Confirmation Modal */}
      {unshareConfirmTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unshare-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <Trash2 size={16} />
                </div>
                <div>
                  <h3 id="unshare-confirm-title" className="text-sm font-bold text-foreground">
                    Unshare trade from cohort?
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    {unshareConfirmTarget.tradeSnapshot?.pair || 'Setup'} —{' '}
                    {unshareConfirmTarget.title || 'Shared trade'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUnshareConfirmTarget(null)}
                aria-label="Close confirmation dialog"
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-muted transition"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Removing this shared trade revokes cohort student access to this setup and its commentary. Your personal journal trade record will not be deleted.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setUnshareConfirmTarget(null)}
                disabled={unsharing}
                className="px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTradeShare(unshareConfirmTarget)}
                disabled={unsharing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition disabled:opacity-60"
              >
                <Trash2 size={13} />
                {unsharing ? 'Removing…' : 'Unshare trade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share or Customize Trade Setup Modal */}
      <ShareTradeToCohortModal
        isOpen={isShareTradeModalOpen}
        onClose={() => {
          setIsShareTradeModalOpen(false);
          setEditingTradeShare(null);
          setIsConcludeMode(false);
        }}
        trade={editingTradeShare?.trade || null}
        editingShare={editingTradeShare}
        concludeMode={isConcludeMode}
        defaultCohortId={activeGroupId}
        onShared={() => fetchCohortShares(activeGroupId)}
      />

      {/* Image Modal Lightbox for Trade Screenshots */}
      <ImageModal
        isOpen={Boolean(activeModalImage)}
        onClose={() => setActiveModalImage(null)}
        imageUrl={activeModalImage?.imageUrl}
        title={activeModalImage?.screenshotType ? activeModalImage.screenshotType.replace(/_/g, ' ') : 'Chart Screenshot'}
        note={activeModalImage?.note}
      />
    </div>
  );
};

export default MentorDashboard;
