import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Users, UserPlus, FileText, Send, Sparkles, HelpCircle, Trash2, Eye, 
  Award, CheckCircle2, AlertCircle, Calendar, TrendingUp, TrendingDown, 
  ShieldAlert, ExternalLink, ChevronRight, Plus, Search, X, MessageSquare, 
  Lock, ArrowLeft, RefreshCw, BarChart2, ShieldCheck, GraduationCap,
  Copy, Check, Share2, Mail, Link as LinkIcon, DollarSign, CreditCard,
  Building2, Settings2, Edit3, Image, Target, Layers, Clock, Palette,
  Globe, PlusCircle, MinusCircle, CheckCircle, Upload
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import api, { resolveImageUrl } from '../utils/api';
import Button from '../components/Button';
import SectionHeader from '../components/SectionHeader';
import ImageModal from '../components/common/ImageModal';

const MentorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isMentor =
    user?.subscriptionPlan === 'MENTOR' ||
    user?.role === 'MENTOR' ||
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN';

  // State
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeModalImage, setActiveModalImage] = useState(null);

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
  });
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

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/mentors/groups');
      setGroups(data || []);
      if (data && data.length > 0) {
        setActiveGroupId((prev) => (prev && data.some((g) => g.id === prev) ? prev : data[0].id));
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not load mentor cohorts.');
    } finally {
      setLoading(false);
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
        });
      }
    } catch (_) {}
  };

  const openMentorSettings = (tab = 'branding', group = null) => {
    const targetGroup = group || (activeGroupId ? groups.find((g) => g.id === activeGroupId) : null) || (groups.length > 0 ? groups[0] : null);
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
      });
      setMentorSettingsTab(preferredTab || 'branding');
      return;
    }
    const selected = groups.find((g) => g.id === groupId);
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
        setGroups((prev) => prev.map((g) => (g.id === data.id ? { ...g, ...data } : g)));
        setEditingGroup(data);
        toast.success('Cohort & banner settings updated!');
      } else {
        // Create new cohort
        const { data } = await api.post('/mentors/groups', groupFormData);
        setGroups((prev) => [data, ...prev]);
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
      await api.put('/mentors/payout-settings', payoutForm);
      toast.success('Payout settlement details updated!');
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
      const updated = groups.filter((g) => g.id !== groupId);
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

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!reviewingTrade || !feedbackText.trim()) {
      toast.error('Please enter your feedback comments.');
      return;
    }
    setSubmittingFeedback(true);
    try {
      const { data } = await api.post(`/mentors/trades/${reviewingTrade.id}/feedback`, {
        feedback: feedbackText.trim(),
        grade: feedbackGrade,
        recommendation: feedbackRec.trim() || undefined,
      });
      toast.success('Feedback and grade published to student!');
      
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

  const activeGroup = useMemo(() => {
    return groups.find((g) => g.id === activeGroupId) || null;
  }, [groups, activeGroupId]);

  const cohortInviteUrl = useMemo(() => {
    if (!activeGroupId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/join/cohort/${activeGroupId}`;
  }, [activeGroupId]);

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
    return groups.reduce((acc, g) => acc + (g.students?.length || 0), 0);
  }, [groups]);

  // Total Mentor Earnings (95% Net Payouts across all cohorts)
  const totalEarningsSummary = useMemo(() => {
    let totalUsd = 0;
    let totalNgn = 0;
    let paidEnrollments = 0;

    groups.forEach((g) => {
      g.students?.forEach((s) => {
        if (s.paidAmount && s.paidAmount > 0) {
          paidEnrollments++;
          const payout = s.mentorPayoutAmount || (s.paidAmount * 0.95);
          if (s.currency === 'NGN') {
            totalNgn += payout;
          } else {
            totalUsd += payout;
          }
        }
      });
    });

    return { totalUsd, totalNgn, paidEnrollments };
  }, [groups]);

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
            <span className="text-xl sm:text-2xl font-black text-foreground">{groups.length}</span>
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
              <span className="block text-[9px] sm:text-[10px] text-muted truncate">95% net payout</span>
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

      {groups.length === 0 ? (
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
              {groups.map((group) => {
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
              {groups.map((group) => {
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-border">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-black text-foreground break-words">{activeGroup.name}</h2>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {activeGroup.students?.length || 0} Enrolled
                      </span>
                      {activeGroup.isPaid ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <DollarSign size={12} /> {activeGroup.currency === 'NGN' ? '₦' : '$'}{activeGroup.price} {activeGroup.billingCycle === 'MONTHLY' ? '/mo' : ''}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-muted text-muted border border-border">
                          Free Community
                        </span>
                      )}
                    </div>
                    {activeGroup.description && (
                      <p className="text-xs text-muted mt-1 leading-relaxed">{activeGroup.description}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={copyInviteLink}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border bg-surface hover:bg-surface-muted text-foreground transition"
                      title="Copy Shareable Invite Link"
                    >
                      {copiedLink ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      <span className="truncate">{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
                    </button>
                    <button
                      onClick={() => openMentorSettings('branding', activeGroup)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border bg-surface-muted hover:bg-surface text-foreground transition"
                      title="Configure Cohort Branding, Curriculum, Pricing & Community"
                    >
                      <Settings2 size={14} className="text-emerald-500" />
                      <span>Settings</span>
                    </button>
                    <Button
                      onClick={() => setIsInviteModalOpen(true)}
                      className="col-span-2 sm:col-span-1 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2"
                    >
                      <UserPlus size={15} className="mr-1.5" /> Invite Students
                    </Button>
                  </div>
                </div>

                {/* Shareable Invite Banner */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Share2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">
                        {activeGroup.isPaid ? 'Public Paid Enrollment Link' : 'Shareable Cohort Invitation Link'}
                      </p>
                      <p className="text-[11px] text-muted truncate">{cohortInviteUrl}</p>
                    </div>
                  </div>
                  <button
                    onClick={copyInviteLink}
                    className="shrink-0 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 flex items-center justify-center gap-1 transition px-3 py-1.5 rounded-lg bg-emerald-500/10 sm:bg-transparent"
                  >
                    {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                    {copiedLink ? 'Copied' : 'Copy Link'}
                  </button>
                </div>

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
                                <div className="h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/20">
                                  {st?.name ? st.name.charAt(0).toUpperCase() : 'S'}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-foreground truncate">{st?.name || 'Unnamed Trader'}</p>
                                  <p className="text-xs text-muted truncate">{st?.email}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveStudent(activeGroup.id, st.id, st.name)}
                                className="text-muted hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10 transition shrink-0"
                                title="Remove Student from Cohort"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                              <span className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                isSharing
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              }`}>
                                {isSharing ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                                {isSharing ? 'Journal Connected' : 'Sync Paused'}
                              </span>

                              {item.paidAmount && item.paidAmount > 0 ? (
                                <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
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
                          <div className="flex items-center gap-2 pt-2.5 border-t border-border/60">
                            <button
                              onClick={() => openStudentTrades(st)}
                              className="flex-1 py-2 px-3 rounded-lg bg-surface border border-border hover:bg-surface-muted text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
                            >
                              <Eye size={14} /> Inspect Trades
                            </button>
                            <button
                              disabled={draftingFor === st.id}
                              onClick={() => handleDraftSummary(st)}
                              className="py-2 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50 active:scale-95"
                              title="Draft coaching feedback using AI"
                            >
                              <Sparkles size={14} />
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
                {groups.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1 text-xs">
                    <span className="text-muted font-medium text-[11px] hidden sm:inline">Cohort:</span>
                    <select
                      value={editingGroup ? editingGroup.id : 'NEW'}
                      onChange={(e) => handleSwitchSettingsCohort(e.target.value)}
                      className="bg-transparent text-foreground font-semibold text-xs focus:outline-none cursor-pointer py-1"
                    >
                      {groups.map((g) => (
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
                            <strong>Transparent Revenue Split:</strong> Mentor net payout is <strong>95%</strong> ({groupFormData.currency === 'NGN' ? '₦' : '$'}{(groupFormData.price * 0.95).toLocaleString()}), JahzJournals platform commission is <strong>5%</strong> ({groupFormData.currency === 'NGN' ? '₦' : '$'}{(groupFormData.price * 0.05).toLocaleString()}).
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
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Settlement Bank Account (95% Payouts)</h4>
                      <p className="text-xs text-muted">Configure the bank account where your 95% student mentorship fees will be deposited.</p>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                          Bank Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Guaranty Trust Bank / Chase Bank"
                          value={payoutForm.bankName}
                          onChange={(e) => setPayoutForm((prev) => ({ ...prev, bankName: e.target.value }))}
                          className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                            Account Number *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 0123456789"
                            value={payoutForm.accountNumber}
                            onChange={(e) => setPayoutForm((prev) => ({ ...prev, accountNumber: e.target.value }))}
                            className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                            Account Holder Name *
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
                          <ShieldCheck size={14} className="text-emerald-500" /> Automated Direct Payouts
                        </span>
                        <p>
                          Student mentorship payments processed via Paystack/Card are automatically credited to your settlement account net of the 5% platform fee.
                        </p>
                      </div>

                      <div className="pt-2">
                        <Button
                          onClick={handleSavePayout}
                          disabled={savingPayout}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                        >
                          {savingPayout ? 'Saving Settlement Bank...' : 'Save Bank Details'}
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
                      {groups.map((g) => (
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
              <button 
                onClick={() => setSelectedStudent(null)} 
                className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-muted transition shrink-0"
              >
                <X size={20} />
              </button>
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
                          <span className="text-[10px] text-muted block">Trading Session</span>
                          <span className="font-semibold text-foreground">{trade.session || 'Standard'}</span>
                        </div>
                      </div>

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
