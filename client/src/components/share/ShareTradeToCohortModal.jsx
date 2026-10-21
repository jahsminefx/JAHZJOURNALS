import React, { useState, useEffect, useMemo } from 'react';
import {
  Check, Pin, BookOpen, Send, X, Sparkles, Image as ImageIcon,
  Sliders, TrendingUp, Eye, EyeOff, Search, Zap, CheckCircle2, ChevronDown, ChevronUp, Calculator
} from 'lucide-react';
import api, { resolveImageUrl } from '../../utils/api';
import { getInstrumentSpec } from '../../config/instrumentSpecs';
import toast from 'react-hot-toast';

/**
 * Deterministically computes Outcome (WIN/LOSS/BREAKEVEN), Pips, Realized R:R,
 * Return (%), and Profit/Loss ($) from Exit Price and setup parameters.
 */
const computeMetricsFromExitPrice = ({
  pair = 'XAUUSD',
  direction = 'BUY',
  entryPrice,
  stopLoss,
  takeProfit,
  exitPrice,
  lotSize,
}) => {
  const entry = Number.parseFloat(entryPrice);
  const exit = Number.parseFloat(exitPrice);
  if (!Number.isFinite(entry) || !Number.isFinite(exit) || entry <= 0) {
    return null;
  }

  const isBuy = String(direction || 'BUY').toUpperCase().includes('BUY');
  const priceMove = isBuy ? exit - entry : entry - exit;

  let result = 'BREAKEVEN';
  if (Math.abs(priceMove) < 1e-8) {
    result = 'BREAKEVEN';
  } else if (priceMove > 0) {
    result = 'WIN';
  } else {
    result = 'LOSS';
  }

  const spec = getInstrumentSpec(pair);
  const pipSize = spec?.pipSize || 0.0001;
  const pips = Math.round((priceMove / pipSize) * 10) / 10;

  let pipValuePerLotUSD =
    spec?.pipValue || (spec?.contractSize ? spec.contractSize * pipSize : 10);
  if (spec?.quoteCurrency === 'JPY' && exit > 0) {
    pipValuePerLotUSD = pipValuePerLotUSD / exit;
  }

  const parsedLots = Number.parseFloat(lotSize);
  const effectiveLots = Number.isFinite(parsedLots) && parsedLots > 0 ? parsedLots : 1.0;
  const profitLoss = Math.round(pips * pipValuePerLotUSD * effectiveLots * 100) / 100;

  const sl = Number.parseFloat(stopLoss);
  const tp = Number.parseFloat(takeProfit);
  const riskDistance =
    Number.isFinite(sl) && Math.abs(entry - sl) > 0 ? Math.abs(entry - sl) : null;
  const plannedRewardDistance =
    Number.isFinite(tp) && Math.abs(tp - entry) > 0 ? Math.abs(tp - entry) : null;

  let realizedRR = null;
  if (riskDistance !== null && riskDistance > 0) {
    realizedRR = Number((priceMove / riskDistance).toFixed(2));
  }

  let plannedRR = null;
  if (riskDistance !== null && plannedRewardDistance !== null && riskDistance > 0) {
    plannedRR = Number((plannedRewardDistance / riskDistance).toFixed(2));
  }

  // Standard 1% risk per 1R when Stop Loss is defined; otherwise % of $100k standard balance
  const profitLossPercent =
    realizedRR !== null
      ? Number(realizedRR.toFixed(2))
      : Number(((profitLoss / 100000) * 100).toFixed(2));

  return {
    result,
    pips,
    profitLoss,
    profitLossPercent,
    realizedRR,
    plannedRR,
    riskRewardRatio:
      realizedRR !== null ? Math.abs(realizedRR) : plannedRR,
  };
};

const DEFAULT_VISIBILITY = {
  showPrices: true,
  showRR: true,
  showResult: true,
  showPnLPercent: true,
  showPnLDollar: false,
  showPips: true,
  showLotSize: false,
  showSession: true,
};

const VISIBILITY_METRICS = [
  { key: 'showPrices', label: 'Prices (Entry/SL/TP)' },
  { key: 'showRR', label: 'R:R Ratio' },
  { key: 'showResult', label: 'Win / Loss' },
  { key: 'showPnLPercent', label: '% Return' },
  { key: 'showPnLDollar', label: '$ Profit / Loss' },
  { key: 'showPips', label: 'Pips' },
  { key: 'showLotSize', label: 'Lot Size' },
];

const QUICK_PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'NAS100', 'US30', 'USDJPY', 'BTCUSD'];
const ORDER_TYPES = ['BUY', 'SELL', 'BUY LIMIT', 'SELL LIMIT', 'BUY STOP', 'SELL STOP'];

export default function ShareTradeToCohortModal({
  isOpen,
  onClose,
  trade = null,
  editingShare = null,
  concludeMode = false,
  defaultCohortId = null,
  onShared = null,
}) {
  const [cohorts, setCohorts] = useState([]);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [selectedCohortIds, setSelectedCohortIds] = useState([]);

  // 'DIRECT_SETUP' (Live Signal) | 'JOURNAL_TRADE' (Already Logged Trade)
  const [shareMode, setShareMode] = useState(trade ? 'JOURNAL_TRADE' : 'DIRECT_SETUP');
  const [mentorTrades, setMentorTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState('');
  const [tradeSearch, setTradeSearch] = useState('');

  // Whether the mentor is concluding/updating the outcome of a trade
  const [isConcluding, setIsConcluding] = useState(false);
  // Whether to automatically log/sync this trade into the mentor's personal trading account
  const [logToMentorAccount, setLogToMentorAccount] = useState(true);
  const [showExtendedAnalysis, setShowExtendedAnalysis] = useState(false);

  const [customSetup, setCustomSetup] = useState({
    pair: 'XAUUSD',
    direction: 'BUY',
    result: 'OPEN',
    status: 'ACTIVE',
    entryPrice: '',
    stopLoss: '',
    takeProfit: '',
    exitPrice: '',
    riskRewardRatio: '',
    pips: '',
    profitLoss: '',
    profitLossPercent: '',
    lotSize: '',
    session: 'NEW_YORK',
    higherTimeframe: '4H',
    entryTimeframe: '15m',
    htfBias: 'BULLISH',
    currency: 'USD',
  });

  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);
  const [quickNote, setQuickNote] = useState('');
  const [entryReasoning, setEntryReasoning] = useState('');
  const [riskRationale, setRiskRationale] = useState('');
  const [outcomeLessons, setOutcomeLessons] = useState('');
  const [title, setTitle] = useState('');
  const [isCaseStudy, setIsCaseStudy] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const activeJournalTrade = useMemo(() => {
    if (trade) return trade;
    if (selectedTradeId && mentorTrades.length > 0) {
      return mentorTrades.find((t) => t.id === selectedTradeId) || null;
    }
    return null;
  }, [trade, selectedTradeId, mentorTrades]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      fetchMentorCohorts();
      if (!trade && !editingShare) {
        fetchMentorJournalTrades();
      }
    }
  }, [isOpen, trade, editingShare]);

  useEffect(() => {
    if (!isOpen) return;

    if (editingShare) {
      const snap = editingShare.tradeSnapshot || {};
      const isDirect =
        (snap.shareMode || (editingShare.sourceTradeId ? 'JOURNAL_TRADE' : 'DIRECT_SETUP')) ===
        'DIRECT_SETUP';
      setShareMode(isDirect ? 'DIRECT_SETUP' : 'JOURNAL_TRADE');
      setSelectedTradeId(editingShare.sourceTradeId || '');
      setTitle(editingShare.title || '');
      setQuickNote(editingShare.setupThesis || editingShare.generalNotes || '');
      setEntryReasoning(editingShare.entryReasoning || '');
      setRiskRationale(editingShare.riskRationale || '');
      setOutcomeLessons(editingShare.outcomeLessons || '');
      setShowExtendedAnalysis(
        Boolean(editingShare.entryReasoning || editingShare.riskRationale || editingShare.outcomeLessons)
      );
      setIsCaseStudy(Boolean(editingShare.isCaseStudy));
      setPinned(Boolean(editingShare.pinned || editingShare.isPinned));
      setIsConcluding(
        Boolean(
          concludeMode ||
            snap.result === 'WIN' ||
            snap.result === 'LOSS' ||
            snap.result === 'BREAKEVEN'
        )
      );
      setLogToMentorAccount(true);
      const savedVis = snap.visibilityOptions || snap.visibility || {};
      const wasOpenSignal = !snap.result || snap.result === 'OPEN' || snap.result === 'SHARED';
      setVisibility({
        ...DEFAULT_VISIBILITY,
        ...savedVis,
        // When concluding a previously open signal, automatically enable Win/Loss, % Return, and Pips for students
        ...(concludeMode && wasOpenSignal
          ? {
              showResult: true,
              showPnLPercent: true,
              showPips: true,
            }
          : {}),
      });

      const initialResult =
        concludeMode && wasOpenSignal
          ? 'WIN'
          : snap.result || 'OPEN';
      const initialExit =
        concludeMode && !snap.exitPrice && initialResult === 'WIN' && snap.takeProfit
          ? snap.takeProfit
          : snap.exitPrice ?? '';

      const autoCalc = computeMetricsFromExitPrice({
        pair: snap.pair || 'XAUUSD',
        direction: snap.direction || 'BUY',
        entryPrice: snap.entryPrice,
        stopLoss: snap.stopLoss,
        takeProfit: snap.takeProfit,
        exitPrice: initialExit,
        lotSize: snap.lotSize,
      });

      setCustomSetup({
        pair: snap.pair || 'XAUUSD',
        direction: snap.direction || 'BUY',
        result: autoCalc?.result || initialResult,
        status: (autoCalc?.result || initialResult) === 'OPEN' ? 'ACTIVE' : 'CLOSED',
        entryPrice: snap.entryPrice ?? '',
        stopLoss: snap.stopLoss ?? '',
        takeProfit: snap.takeProfit ?? '',
        exitPrice: initialExit,
        riskRewardRatio:
          snap.riskRewardRatio ??
          snap.plannedRR ??
          autoCalc?.riskRewardRatio ??
          '',
        pips: snap.pips ?? autoCalc?.pips ?? '',
        profitLoss: snap.profitLoss ?? autoCalc?.profitLoss ?? '',
        profitLossPercent: snap.profitLossPercent ?? autoCalc?.profitLossPercent ?? '',
        lotSize: snap.lotSize ?? '',
        session: snap.session || 'NEW_YORK',
        higherTimeframe: snap.higherTimeframe || '4H',
        entryTimeframe: snap.entryTimeframe || '15m',
        htfBias: snap.htfBias || 'BULLISH',
        currency: snap.currency || 'USD',
      });
      if (editingShare.targets && editingShare.targets.length > 0) {
        setSelectedCohortIds(
          editingShare.targets.map((t) => t.mentorGroupId || t.mentorGroup?.id).filter(Boolean)
        );
      }
      return;
    }

    setIsConcluding(false);
    setLogToMentorAccount(true);
    setShowExtendedAnalysis(false);

    if (trade) {
      setShareMode('JOURNAL_TRADE');
    }

    if (activeJournalTrade && shareMode === 'JOURNAL_TRADE') {
      const t = activeJournalTrade;
      setTitle(`${t.pair} ${t.direction} — ${t.result === 'OPEN' ? 'Trade Setup' : 'Trade Breakdown'}`);
      setQuickNote(t.notesBefore || t.entryReason || '');
      setEntryReasoning(t.entryReason || '');
      setRiskRationale(
        t.stopLoss
          ? `Invalidation set at ${t.stopLoss}${t.riskRewardRatio ? ` targeting 1:${t.riskRewardRatio} R:R` : ''}.`
          : ''
      );
      setOutcomeLessons(t.notesAfter || '');
      setCustomSetup({
        pair: t.pair || 'EURUSD',
        direction: t.direction || 'BUY',
        result: t.result || 'OPEN',
        status: t.status || 'ACTIVE',
        entryPrice: t.entryPrice ?? '',
        stopLoss: t.stopLoss ?? '',
        takeProfit: t.takeProfit ?? '',
        exitPrice: t.exitPrice ?? '',
        riskRewardRatio: t.riskRewardRatio ?? '',
        pips: t.pips ?? '',
        profitLoss: t.profitLossAmount ?? '',
        profitLossPercent: t.profitLossPercent ?? '',
        lotSize: t.lotSize ?? '',
        session: t.session || 'LONDON',
        higherTimeframe: t.higherTimeframe || '4H',
        entryTimeframe: t.entryTimeframe || '15m',
        htfBias: t.htfBias || 'BULLISH',
        currency: t.tradingAccount?.currency || 'USD',
      });
      if (t.screenshots && t.screenshots.length > 0) {
        setSelectedAttachmentIds(t.screenshots.map((s) => s.id));
      } else {
        setSelectedAttachmentIds([]);
      }
    }
  }, [isOpen, activeJournalTrade, editingShare, concludeMode, shareMode, trade]);

  const fetchMentorCohorts = async () => {
    setLoadingCohorts(true);
    try {
      const { data } = await api.get('/mentors/groups');
      const safeGroups = Array.isArray(data)
        ? data
        : Array.isArray(data?.groups)
        ? data.groups
        : [];
      setCohorts(safeGroups);
      if (!editingShare) {
        if (defaultCohortId && safeGroups.some((g) => g.id === defaultCohortId)) {
          setSelectedCohortIds([defaultCohortId]);
        } else if (safeGroups.length > 0) {
          setSelectedCohortIds(safeGroups.map((g) => g.id));
        }
      }
    } catch (err) {
      console.error('Failed to load mentor cohorts:', err);
      toast.error('Could not load your academy cohorts.');
    } finally {
      setLoadingCohorts(false);
    }
  };

  const fetchMentorJournalTrades = async () => {
    setLoadingTrades(true);
    try {
      const { data } = await api.get('/trades?limit=40');
      const list = Array.isArray(data) ? data : Array.isArray(data?.trades) ? data.trades : [];
      setMentorTrades(list);
      if (list.length > 0 && !selectedTradeId) {
        setSelectedTradeId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load mentor trades:', err);
    } finally {
      setLoadingTrades(false);
    }
  };

  const toggleCohort = (cohortId) => {
    setSelectedCohortIds((prev) =>
      prev.includes(cohortId)
        ? prev.length > 1
          ? prev.filter((id) => id !== cohortId)
          : prev
        : [...prev, cohortId]
    );
  };

  const toggleVisibility = (key) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyVisibilityPreset = (preset) => {
    if (preset === 'ALL') {
      setVisibility({
        showPrices: true,
        showRR: true,
        showResult: true,
        showPnLPercent: true,
        showPnLDollar: true,
        showPips: true,
        showLotSize: true,
        showSession: true,
      });
    } else if (preset === 'RR_PERCENT_ONLY') {
      setVisibility({
        showPrices: true,
        showRR: true,
        showResult: true,
        showPnLPercent: true,
        showPnLDollar: false,
        showPips: true,
        showLotSize: false,
        showSession: true,
      });
    } else if (preset === 'SETUP_LEVELS_ONLY') {
      setVisibility({
        showPrices: true,
        showRR: true,
        showResult: false,
        showPnLPercent: false,
        showPnLDollar: false,
        showPips: false,
        showLotSize: false,
        showSession: true,
      });
    }
  };

  const toggleAttachment = (screenshotId) => {
    setSelectedAttachmentIds((prev) =>
      prev.includes(screenshotId)
        ? prev.filter((id) => id !== screenshotId)
        : [...prev, screenshotId]
    );
  };

  const previewData = useMemo(() => {
    const entry = parseFloat(customSetup.entryPrice);
    const sl = parseFloat(customSetup.stopLoss);
    const tp = parseFloat(customSetup.takeProfit);
    let calcRR = customSetup.riskRewardRatio;
    if (
      Number.isFinite(entry) &&
      Number.isFinite(sl) &&
      Number.isFinite(tp) &&
      Math.abs(entry - sl) > 0
    ) {
      calcRR = Number((Math.abs(tp - entry) / Math.abs(entry - sl)).toFixed(2));
    }
    return {
      ...customSetup,
      computedRR: calcRR,
    };
  }, [customSetup]);

  const visibleMetricCount = useMemo(() => {
    return VISIBILITY_METRICS.filter((m) => Boolean(visibility[m.key])).length;
  }, [visibility]);

  const handleSelectConcludedResult = (nextResult) => {
    setCustomSetup((prev) => {
      let autoExit = prev.exitPrice;
      if (nextResult === 'WIN' && prev.takeProfit) {
        autoExit = prev.takeProfit;
      } else if (nextResult === 'LOSS' && prev.stopLoss) {
        autoExit = prev.stopLoss;
      } else if (nextResult === 'BREAKEVEN' && prev.entryPrice) {
        autoExit = prev.entryPrice;
      }

      const calc = computeMetricsFromExitPrice({
        pair: prev.pair,
        direction: prev.direction,
        entryPrice: prev.entryPrice,
        stopLoss: prev.stopLoss,
        takeProfit: prev.takeProfit,
        exitPrice: autoExit,
        lotSize: prev.lotSize,
      });

      return {
        ...prev,
        result: nextResult,
        status: nextResult === 'OPEN' ? 'ACTIVE' : 'CLOSED',
        exitPrice: autoExit,
        ...(calc
          ? {
              pips: calc.pips,
              profitLoss: calc.profitLoss,
              profitLossPercent: calc.profitLossPercent,
              riskRewardRatio: calc.riskRewardRatio ?? prev.riskRewardRatio,
            }
          : nextResult === 'BREAKEVEN'
          ? {
              pips: 0,
              profitLoss: 0,
              profitLossPercent: 0,
            }
          : {}),
      };
    });
  };

  const handleExitPriceChange = (newExitValue) => {
    setCustomSetup((prev) => {
      if (newExitValue === '' || newExitValue === null || newExitValue === undefined) {
        return {
          ...prev,
          exitPrice: newExitValue,
        };
      }

      const calc = computeMetricsFromExitPrice({
        pair: prev.pair,
        direction: prev.direction,
        entryPrice: prev.entryPrice,
        stopLoss: prev.stopLoss,
        takeProfit: prev.takeProfit,
        exitPrice: newExitValue,
        lotSize: prev.lotSize,
      });

      if (!calc) {
        return {
          ...prev,
          exitPrice: newExitValue,
        };
      }

      return {
        ...prev,
        exitPrice: newExitValue,
        result: calc.result,
        status: 'CLOSED',
        pips: calc.pips,
        profitLoss: calc.profitLoss,
        profitLossPercent: calc.profitLossPercent,
        riskRewardRatio: calc.riskRewardRatio ?? prev.riskRewardRatio,
      };
    });
  };

  const filteredJournalTrades = useMemo(() => {
    if (!tradeSearch.trim()) return mentorTrades;
    const q = tradeSearch.toLowerCase();
    return mentorTrades.filter(
      (t) =>
        t.pair?.toLowerCase().includes(q) ||
        t.direction?.toLowerCase().includes(q) ||
        t.result?.toLowerCase().includes(q)
    );
  }, [mentorTrades, tradeSearch]);

  const isLiveSignalOnly = shareMode === 'DIRECT_SETUP' && !editingShare && !isConcluding;

  const handlePublish = async (e) => {
    if (e) e.preventDefault();
    if (selectedCohortIds.length === 0) {
      toast.error('Please select at least one cohort.');
      return;
    }
    if (!customSetup.pair.trim()) {
      toast.error('Please enter a trading pair (e.g. XAUUSD).');
      return;
    }

    setSubmitting(true);
    try {
      const finalResult = isLiveSignalOnly ? 'OPEN' : customSetup.result || 'OPEN';
      const finalStatus = finalResult === 'OPEN' ? 'ACTIVE' : 'CLOSED';

      const autoTitle =
        title.trim() ||
        `${customSetup.pair.trim().toUpperCase()} ${customSetup.direction} — ${
          finalResult === 'OPEN' ? 'Trade Setup' : `Trade Breakdown (${finalResult})`
        }`;

      const payload = {
        targetCohortIds: selectedCohortIds,
        sourceTradeId:
          shareMode === 'JOURNAL_TRADE'
            ? activeJournalTrade?.id || editingShare?.sourceTradeId || null
            : editingShare?.sourceTradeId || null,
        title: autoTitle,
        setupThesis: quickNote.trim(),
        entryReasoning: entryReasoning.trim(),
        riskRationale: riskRationale.trim(),
        managementReasoning: '',
        outcomeLessons: outcomeLessons.trim(),
        generalNotes: '',
        isCaseStudy,
        pinned,
        status: 'PUBLISHED',
        attachmentIds: shareMode === 'JOURNAL_TRADE' ? selectedAttachmentIds : [],
        visibilityOptions: visibility,
        logToMentorAccount: Boolean(logToMentorAccount),
        customTradeSetup: {
          ...customSetup,
          pair: customSetup.pair.trim().toUpperCase(),
          result: finalResult,
          status: finalStatus,
          riskRewardRatio: previewData.computedRR !== '' ? previewData.computedRR : null,
          shareMode,
        },
      };

      if (editingShare?.id) {
        const { data } = await api.put(`/mentors/cohort-trade-shares/${editingShare.id}`, payload);
        toast.success(
          isConcluding
            ? `Trade concluded (${finalResult}) & synced with cohort!`
            : 'Student view updated!'
        );
        if (onShared) onShared(data.tradeShare);
      } else {
        const { data } = await api.post('/mentors/cohort-trade-shares', payload);
        toast.success(
          isLiveSignalOnly
            ? 'Trade setup shared with cohort!'
            : 'Trade shared with cohort!'
        );
        if (onShared) onShared(data.tradeShare);
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to share trade with academy.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const screenshots = activeJournalTrade?.screenshots || [];
  const isPositiveDir = customSetup.direction.includes('BUY');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-trade-modal-title"
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl text-foreground overflow-hidden">
        {/* Compact Header */}
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-5 border-b border-border bg-surface-muted/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              {concludeMode ? <CheckCircle2 size={18} /> : <Zap size={18} />}
            </div>
            <div>
              <h3 id="share-trade-modal-title" className="text-sm sm:text-base font-black text-foreground">
                {concludeMode
                  ? `Conclude ${customSetup.pair} ${customSetup.direction} Setup`
                  : editingShare
                  ? 'Edit Student View & Analysis'
                  : 'Share Trade Setup'}
              </h3>
              <p className="text-[11px] text-muted">
                {concludeMode
                  ? 'Record the final outcome for students and sync it to your personal Mentor Account.'
                  : editingShare
                  ? 'Customize which metrics students can see and refine your educational commentary.'
                  : 'Publish a trade setup now — private account numbers and balances are never shared.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-muted hover:text-foreground rounded-lg hover:bg-surface-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handlePublish} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {/* Mode Switcher (Only when creating a brand new share) */}
          {!trade && !editingShare && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-background border border-border">
              <button
                type="button"
                onClick={() => {
                  setShareMode('DIRECT_SETUP');
                  setIsConcluding(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  shareMode === 'DIRECT_SETUP'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <Zap size={14} /> Fast Active Setup
              </button>
              <button
                type="button"
                onClick={() => setShareMode('JOURNAL_TRADE')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  shareMode === 'JOURNAL_TRADE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <TrendingUp size={14} /> From Journal Log
              </button>
            </div>
          )}

          {/* Compact 1-Line Target Cohort Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-muted/40 border border-border">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted mr-1">
                Cohort:
              </span>
              {loadingCohorts ? (
                <span className="text-xs text-muted">Loading...</span>
              ) : cohorts.length === 0 ? (
                <span className="text-xs text-amber-700 dark:text-amber-400">No cohorts created yet</span>
              ) : (
                cohorts.map((cohort) => {
                  const isSelected = selectedCohortIds.includes(cohort.id);
                  return (
                    <button
                      key={cohort.id}
                      type="button"
                      onClick={() => toggleCohort(cohort.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                          : 'bg-background border-border text-muted hover:text-foreground'
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                      <span>{cohort.name}</span>
                      <span className="text-[10px] opacity-75">
                        ({cohort.students?.length || 0})
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* STAGE 1: FAST LIVE SIGNAL (Only Pair, Order, Entry/SL/TP, Note) */}
          {/* ============================================================== */}
          {shareMode === 'DIRECT_SETUP' && !concludeMode && (
            <div className="p-3.5 rounded-xl border border-border bg-surface-muted/20 space-y-3">
              {/* Quick Pair Chips */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    Instrument & Direction
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_PAIRS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCustomSetup((prev) => ({ ...prev, pair: p }))}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold transition border ${
                          customSetup.pair === p
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                            : 'bg-background border-border text-muted hover:text-foreground'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pair Input + 1-Click Direction Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={customSetup.pair}
                      onChange={(e) =>
                        setCustomSetup((prev) => ({ ...prev, pair: e.target.value.toUpperCase() }))
                      }
                      placeholder="XAUUSD"
                      aria-label="Instrument or Pair"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground font-mono font-black text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-8 grid grid-cols-3 sm:grid-cols-6 gap-1">
                    {ORDER_TYPES.map((dir) => {
                      const active = customSetup.direction === dir;
                      const isBuyType = dir.includes('BUY');
                      return (
                        <button
                          key={dir}
                          type="button"
                          onClick={() => setCustomSetup((prev) => ({ ...prev, direction: dir }))}
                          className={`py-2 px-1 rounded-lg text-[10px] font-black transition border text-center truncate ${
                            active
                              ? isBuyType
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
                                : 'bg-rose-600 border-rose-500 text-white shadow-xs'
                              : 'bg-background border-border text-muted hover:text-foreground'
                          }`}
                        >
                          {dir}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3 Price Boxes + Auto R:R */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-muted uppercase block mb-1">
                    Entry Price
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={customSetup.entryPrice}
                    onChange={(e) =>
                      setCustomSetup((prev) => ({ ...prev, entryPrice: e.target.value }))
                    }
                    placeholder="2715.00"
                    className="w-full px-2.5 py-2 rounded-xl border border-border bg-background text-foreground font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase block mb-1">
                    Stop Loss (SL)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={customSetup.stopLoss}
                    onChange={(e) =>
                      setCustomSetup((prev) => ({ ...prev, stopLoss: e.target.value }))
                    }
                    placeholder="2706.00"
                    className="w-full px-2.5 py-2 rounded-xl border border-rose-500/30 bg-background text-rose-700 dark:text-rose-400 font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block mb-1">
                    Take Profit (TP)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={customSetup.takeProfit}
                    onChange={(e) =>
                      setCustomSetup((prev) => ({ ...prev, takeProfit: e.target.value }))
                    }
                    placeholder="2742.00"
                    className="w-full px-2.5 py-2 rounded-xl border border-emerald-500/30 bg-background text-emerald-700 dark:text-emerald-400 font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <label className="text-[10px] font-bold text-muted uppercase block mb-1">
                    Planned R:R
                  </label>
                  <div className="w-full px-2.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono font-black text-xs sm:text-sm text-center">
                    {previewData.computedRR ? `1 : ${previewData.computedRR}R` : 'Auto'}
                  </div>
                </div>
              </div>

              {/* Quick Signal Note */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-muted uppercase">
                    Setup Thesis & Market Context (Optional)
                  </label>
                  {editingShare && (
                    <button
                      type="button"
                      onClick={() => setShowExtendedAnalysis((prev) => !prev)}
                      className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      {showExtendedAnalysis ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      <span>{showExtendedAnalysis ? 'Hide structured analysis' : 'Edit structured analysis'}</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder="e.g. Sweep of London session low into 4H demand zone..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STAGE 2: CONCLUDE SIGNAL / RECORD OUTCOME & LOG TO MY ACCOUNT   */}
          {/* ============================================================== */}
          {(concludeMode || (editingShare && isConcluding)) && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Trade Outcome & Result
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <Calculator size={10} /> Auto-calculated from Exit Price
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-muted">
                  {customSetup.pair} {customSetup.direction} @ {customSetup.entryPrice || 'Market'}
                  {customSetup.stopLoss ? ` · SL ${customSetup.stopLoss}` : ''}
                  {customSetup.takeProfit ? ` · TP ${customSetup.takeProfit}` : ''}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'WIN', label: 'Win (TP Hit)', cls: 'bg-emerald-600 border-emerald-500 text-white' },
                  { id: 'LOSS', label: 'Loss (SL Hit)', cls: 'bg-rose-600 border-rose-500 text-white' },
                  { id: 'BREAKEVEN', label: 'Breakeven', cls: 'bg-amber-600 border-amber-500 text-white' },
                ].map((opt) => {
                  const active = customSetup.result === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectConcludedResult(opt.id)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black border transition ${
                        active
                          ? `${opt.cls} shadow-md`
                          : 'bg-background border-border text-muted hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block mb-1">
                    Exit Price
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={customSetup.exitPrice}
                    onChange={(e) => handleExitPriceChange(e.target.value)}
                    placeholder={customSetup.takeProfit || 'Enter exit price'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-background text-foreground font-mono font-bold text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted uppercase block mb-1">
                    Return (%) <span className="text-[9px] font-normal opacity-75">(Auto)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={customSetup.profitLossPercent}
                    onChange={(e) =>
                      setCustomSetup((prev) => ({ ...prev, profitLossPercent: e.target.value }))
                    }
                    placeholder="Auto"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted uppercase block mb-1">
                    Profit / Loss ($) <span className="text-[9px] font-normal opacity-75">(Auto)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={customSetup.profitLoss}
                    onChange={(e) =>
                      setCustomSetup((prev) => ({ ...prev, profitLoss: e.target.value }))
                    }
                    placeholder="Auto"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted uppercase block mb-1">
                    Pips <span className="text-[9px] font-normal opacity-75">(Auto)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={customSetup.pips}
                    onChange={(e) =>
                      setCustomSetup((prev) => ({ ...prev, pips: e.target.value }))
                    }
                    placeholder="e.g. 65"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted uppercase block mb-1">
                  Lesson & Outcome Takeaway (Optional)
                </label>
                <textarea
                  rows={2}
                  value={outcomeLessons}
                  onChange={(e) => setOutcomeLessons(e.target.value)}
                  placeholder="What can students learn from how this trade played out?"
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* MODE B: SHARE FROM EXISTING JOURNAL TRADE                       */}
          {/* ============================================================== */}
          {shareMode === 'JOURNAL_TRADE' && !concludeMode && (
            <div className="space-y-3">
              {!trade && !editingShare && (
                <div className="p-3 rounded-xl border border-border bg-surface-muted/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                      Select Trade from Journal
                    </label>
                    <div className="relative w-44">
                      <Search
                        size={12}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                      />
                      <input
                        type="text"
                        value={tradeSearch}
                        onChange={(e) => setTradeSearch(e.target.value)}
                        placeholder="Search pair..."
                        className="w-full pl-7 pr-2 py-1 text-[11px] rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {loadingTrades ? (
                    <p className="text-xs text-muted py-2">Loading your journal trades...</p>
                  ) : filteredJournalTrades.length === 0 ? (
                    <p className="text-xs text-muted py-2">No matching trades found.</p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {filteredJournalTrades.map((t) => {
                        const isSelected = t.id === selectedTradeId;
                        return (
                          <div
                            key={t.id}
                            onClick={() => setSelectedTradeId(t.id)}
                            className={`p-2 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                              isSelected
                                ? 'bg-emerald-500/15 border-emerald-500/50 text-foreground font-semibold'
                                : 'bg-background border-border hover:border-border/80 text-muted hover:text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 rounded font-black text-[10px] ${
                                  t.direction === 'BUY'
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                                }`}
                              >
                                {t.direction}
                              </span>
                              <span className="font-bold text-foreground">{t.pair}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  t.result === 'WIN'
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                    : t.result === 'LOSS'
                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                                    : 'bg-surface-muted text-muted'
                                }`}
                              >
                                {t.result}
                              </span>
                              {t.riskRewardRatio && (
                                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                                  1:{t.riskRewardRatio}R
                                </span>
                              )}
                              {t.profitLossAmount !== null && t.profitLossAmount !== undefined && (
                                <span
                                  className={`text-[11px] font-mono ${
                                    t.profitLossAmount >= 0
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-rose-700 dark:text-rose-400'
                                  }`}
                                >
                                  {t.profitLossAmount >= 0
                                    ? `+$${t.profitLossAmount}`
                                    : `-$${Math.abs(t.profitLossAmount)}`}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted">
                              {new Date(t.entryTime || t.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-muted uppercase">
                    Thesis & Market Context
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowExtendedAnalysis((prev) => !prev)}
                    className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    {showExtendedAnalysis ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    <span>{showExtendedAnalysis ? 'Hide additional sections' : 'Add entry, risk & lesson notes'}</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder="Why you took this trade and what students should study..."
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500"
                />
              </div>

              {screenshots.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon size={13} className="text-emerald-600 dark:text-emerald-400" />
                    Attach Chart Screenshots ({selectedAttachmentIds.length}/{screenshots.length})
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {screenshots.map((s) => {
                      const isSelected = selectedAttachmentIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => toggleAttachment(s.id)}
                          className={`relative rounded-lg border overflow-hidden cursor-pointer transition ${
                            isSelected
                              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                              : 'border-border opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={resolveImageUrl(s.imageUrl)}
                            alt="Chart"
                            className="w-full h-16 object-cover"
                          />
                          <div className="absolute top-1 right-1 bg-black/70 p-0.5 rounded">
                            {isSelected && <Check size={11} className="text-emerald-400" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Optional Structured Mentor Analysis Sections */}
          {showExtendedAnalysis && !concludeMode && (
            <div className="p-3.5 rounded-xl border border-border bg-surface-muted/20 space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-muted uppercase block mb-1">
                  Title (Optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`${customSetup.pair} ${customSetup.direction} — Trade Setup`}
                  className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-muted block mb-1">
                    Entry Confirmation
                  </label>
                  <textarea
                    rows={2}
                    value={entryReasoning}
                    onChange={(e) => setEntryReasoning(e.target.value)}
                    placeholder="Entry trigger & confluence..."
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted block mb-1">
                    Invalidation & Risk Plan
                  </label>
                  <textarea
                    rows={2}
                    value={riskRationale}
                    onChange={(e) => setRiskRationale(e.target.value)}
                    placeholder="Stop loss rationale..."
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted block mb-1">
                    Lesson & Outcome
                  </label>
                  <textarea
                    rows={2}
                    value={outcomeLessons}
                    onChange={(e) => setOutcomeLessons(e.target.value)}
                    placeholder="Key student takeaway..."
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* VISIBILITY CHIPS: Shown when concluding, editing, or journal    */}
          {/* ============================================================== */}
          {!isLiveSignalOnly && (
            <div className="p-3 rounded-xl border border-border bg-surface-muted/30 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Sliders size={13} className="text-emerald-600 dark:text-emerald-400" />
                  Student View ({visibleMetricCount} of {VISIBILITY_METRICS.length} metrics visible)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyVisibilityPreset('ALL')}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface border border-border hover:border-emerald-500/50 text-foreground"
                  >
                    Show All
                  </button>
                  <button
                    type="button"
                    onClick={() => applyVisibilityPreset('RR_PERCENT_ONLY')}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface border border-border hover:border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
                  >
                    Hide $ Amount
                  </button>
                  <button
                    type="button"
                    onClick={() => applyVisibilityPreset('SETUP_LEVELS_ONLY')}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface border border-border hover:border-emerald-500/50 text-muted hover:text-foreground"
                  >
                    Levels & R:R Only
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {VISIBILITY_METRICS.map((opt) => {
                  const active = Boolean(visibility[opt.key]);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleVisibility(opt.key)}
                      aria-pressed={active}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition flex items-center gap-1.5 ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-foreground'
                          : 'bg-background border-border text-muted hover:text-foreground'
                      }`}
                    >
                      {active ? (
                        <Eye size={12} className="text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <EyeOff size={12} className="text-muted" />
                      )}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sync / Log to Mentor Account Checkbox */}
          {shareMode === 'DIRECT_SETUP' && (
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-border bg-surface-muted/20 cursor-pointer hover:border-emerald-500/40 transition">
              <input
                type="checkbox"
                checked={logToMentorAccount}
                onChange={(e) => setLogToMentorAccount(e.target.checked)}
                className="mt-0.5 rounded border-border accent-emerald-600"
              />
              <div className="text-xs">
                <span className="font-bold text-foreground block">
                  {concludeMode || isConcluding
                    ? 'Log / Update this concluded trade in my personal Mentor Trading Account'
                    : 'Also log this setup as an Active trade in my Mentor Account'}
                </span>
                <span className="text-[11px] text-muted">
                  {concludeMode || isConcluding
                    ? 'Saves the final Win/Loss, Exit Price, and P&L directly into your personal trade journal.'
                    : 'When the trade concludes later, updating it in your journal or clicking "Conclude Trade" will automatically update the cohort.'}
                </span>
              </div>
            </label>
          )}
        </form>

        {/* Sticky Action Footer */}
        <div className="px-4 py-3 sm:px-5 border-t border-border bg-surface-muted/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="rounded border-border accent-emerald-600"
              />
              <Pin size={13} className="text-amber-600 dark:text-amber-400" /> Pin
            </label>
            {!isLiveSignalOnly && (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCaseStudy}
                  onChange={(e) => setIsCaseStudy(e.target.checked)}
                  className="rounded border-border accent-emerald-600"
                />
                <BookOpen size={13} className="text-purple-700 dark:text-purple-400" /> Case study
              </label>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-border text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={submitting || cohorts.length === 0}
              className={`px-5 py-2 rounded-xl text-white text-xs font-black transition flex items-center gap-1.5 shadow-md disabled:opacity-50 ${
                isLiveSignalOnly && !isPositiveDir
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              <Send size={13} />
              <span>
                {submitting
                  ? 'Saving...'
                  : concludeMode || isConcluding
                  ? `Conclude (${customSetup.result}) & Sync`
                  : editingShare
                  ? 'Save Student View'
                  : 'Share Trade'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
