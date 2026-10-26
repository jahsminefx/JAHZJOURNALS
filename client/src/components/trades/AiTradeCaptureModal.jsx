import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Sparkles,
  Bot,
  Send,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Shield,
  Trash2,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  Layers,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  Paperclip,
  ShieldCheck,
  SlidersHorizontal,
  Info,
  Calendar,
  DollarSign,
  Tag,
  Smile,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import TradeOutcomeBadge from './TradeOutcomeBadge';
import {
  calculateRiskReward,
  calculatePips,
  detectTradingSession,
  getTradingSessionLabel,
  resolveTradeRiskReward,
} from '../../utils/tradeCalculations';

const PROMPT_SUGGESTIONS = [
  'I bought 0.22 BTCUSD at 82351.75 and closed at 82361.97.',
  'Extract the details from my screenshot.',
  'I moved my stop to break-even before closing.',
  'Help me journal this trade.',
];

const TRADING_EMOTIONS = [
  'CONFIDENT',
  'PATIENT',
  'DISCIPLINED',
  'CALM',
  'FOMO',
  'ANXIOUS',
  'REVENGE',
  'HESITANT',
  'FRUSTRATED',
];

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const sanitizeDateForSave = (val) => {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const INITIAL_TRADE_STATE = {
  tradingAccountId: '',
  accountName: '',
  accountCurrency: 'USD',
  screenshotCurrency: null,
  pair: '',
  direction: 'BUY',
  status: 'CLOSED', // 'PLANNED' | 'ACTIVE' | 'CLOSED'
  entryPrice: '',
  exitPrice: '',
  stopLoss: '',
  takeProfit: '',
  lotSize: '',
  grossProfit: '',
  commission: '',
  swap: '',
  fees: '',
  profitLossAmount: '',
  result: 'BREAKEVEN',
  breakEvenActivated: false,
  breakEvenPrice: '',
  breakEvenEvidenceStatus: 'UNKNOWN',
  breakEvenEvidenceSource: null,
  entryTime: '',
  exitTime: '',
  strategyId: '',
  setupId: '',
  emotions: [],
  notesBefore: '',
  notesAfter: '',
  externalId: '',
};

const AiTradeCaptureModal = ({
  isOpen,
  onClose,
  onTradeSaved,
  initialAccountId = '',
}) => {
  const navigate = useNavigate();

  // Accounts & Strategies
  const [accounts, setAccounts] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Chat conversation messages
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome_msg',
      role: 'assistant',
      content:
        "Hi! Tell me about your trade or attach an MT4/MT5 screenshot. I'll help fill in the details so you can review and save your trade.",
      trades: null,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Active draft reference (tracks the most recently touched draft for conversational follow-ups)
  const [activeDraft, setActiveDraft] = useState(INITIAL_TRADE_STATE);

  // Post-save celebration and journaling assistant
  const [savedTradeResult, setSavedTradeResult] = useState(null);
  const [journalSuggestions, setJournalSuggestions] = useState(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const [enrichingNotes, setEnrichingNotes] = useState(false);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const composerInputRef = useRef(null);

  // ----------------------------------------------------
  // Prevent background scroll and signal modal visibility to hide floating widgets
  // ----------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    window.dispatchEvent(
      new CustomEvent('jahz-modal-visibility', { detail: { open: true, modal: 'ai-trade-capture' } })
    );

    return () => {
      document.body.style.overflow = '';
      window.dispatchEvent(
        new CustomEvent('jahz-modal-visibility', { detail: { open: false, modal: 'ai-trade-capture' } })
      );
    };
  }, [isOpen]);

  // ----------------------------------------------------
  // Initial Data Fetching (Accounts & Strategies)
  // ----------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    setLoadingAccounts(true);

    Promise.all([
      api.get('/accounts').catch(() => ({ data: [] })),
      api.get('/strategies').catch(() => ({ data: [] })),
    ])
      .then(([accRes, stratRes]) => {
        const accList = Array.isArray(accRes.data)
          ? accRes.data
          : accRes.data?.accounts || [];
        setAccounts(accList);

        const stratList = Array.isArray(stratRes.data) ? stratRes.data : [];
        setStrategies(stratList);

        if (accList.length > 0 && !activeDraft.tradingAccountId) {
          const defaultAcc =
            initialAccountId && accList.find((a) => a.id === initialAccountId)
              ? accList.find((a) => a.id === initialAccountId)
              : accList[0];
          setActiveDraft((prev) => ({
            ...prev,
            tradingAccountId: defaultAcc.id,
            accountName: defaultAcc.name,
            accountCurrency: defaultAcc.currency || 'USD',
          }));
        }
      })
      .catch((err) => console.error('Failed to load accounts/strategies:', err))
      .finally(() => setLoadingAccounts(false));
  }, [isOpen, initialAccountId]);

  // Auto-scroll conversation smoothly
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Keyboard navigation & Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else if (isDirty || selectedAttachments.length > 0) {
          setShowDiscardConfirm(true);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDirty, selectedAttachments.length, showDiscardConfirm, onClose]);

  // Safe Close Request
  const handleRequestClose = useCallback(() => {
    if (isDirty || selectedAttachments.length > 0) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, selectedAttachments.length, onClose]);

  // ----------------------------------------------------
  // Attachment Handlers (File input, Paste, Drag & Drop)
  // ----------------------------------------------------
  const handleFilesAdded = (files) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const valid = [];
    const currentCount = selectedAttachments.length;

    for (const f of list) {
      if (currentCount + valid.length >= 10) {
        toast.error('Maximum 10 screenshot attachments allowed per message.');
        break;
      }
      if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(f.type)) {
        toast.error(`"${f.name}" is not a supported image (PNG, JPG, WEBP).`);
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`"${f.name}" exceeds 10MB size limit.`);
        continue;
      }
      const previewUrl = URL.createObjectURL(f);
      valid.push({
        id: `att_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        file: f,
        name: f.name,
        size: f.size,
        previewUrl,
      });
    }

    if (valid.length > 0) {
      setSelectedAttachments((prev) => [...prev, ...valid]);
      setIsDirty(true);
    }
  };

  const handleRemoveAttachment = (attId) => {
    setSelectedAttachments((prev) => {
      const found = prev.find((a) => a.id === attId);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((a) => a.id !== attId);
    });
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedImages = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) pastedImages.push(file);
      }
    }
    if (pastedImages.length > 0) {
      e.preventDefault();
      handleFilesAdded(pastedImages);
      toast.success(`Attached ${pastedImages.length} image(s) from clipboard!`);
    }
  };

  // ----------------------------------------------------
  // Unified Message Processing (Text + Attachments)
  // ----------------------------------------------------
  const handleSendMessage = async (customText = null) => {
    const textToSend = customText !== null ? customText : chatInput;
    const hasText = Boolean(textToSend && textToSend.trim());
    const hasAttachments = selectedAttachments.length > 0;

    if ((!hasText && !hasAttachments) || chatLoading) return;

    const userMsgId = `usr_${Date.now()}`;
    const userMessageObj = {
      id: userMsgId,
      role: 'user',
      content: textToSend.trim(),
      attachments: selectedAttachments.map((a) => ({
        name: a.name,
        size: (a.size / 1024).toFixed(0) + ' KB',
        previewUrl: a.previewUrl,
      })),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMessageObj]);
    setChatInput('');
    const attachmentsToSend = [...selectedAttachments];
    setSelectedAttachments([]);
    setChatLoading(true);
    setIsDirty(true);

    try {
      let resData;
      if (attachmentsToSend.length > 0) {
        const formData = new FormData();
        if (textToSend.trim()) formData.append('message', textToSend.trim());
        formData.append('currentDraft', JSON.stringify(activeDraft || {}));
        attachmentsToSend.forEach((att) => formData.append('images', att.file));

        const res = await api.post('/ai/trade-capture/chat', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        resData = res.data;
      } else {
        const res = await api.post('/ai/trade-capture/chat', {
          message: textToSend.trim(),
          currentDraft: activeDraft || {},
        });
        resData = res.data;
      }

      const assistantMsgId = `ast_${Date.now()}`;

      if (resData.isBatch && Array.isArray(resData.batch)) {
        const defaultAcc = accounts[0];
        const tradeCards = resData.batch
          .filter((b) => b.candidateTrade !== null)
          .map((item, idx) => {
            const accId = item.candidateTrade.tradingAccountId || defaultAcc?.id || '';
            const acc = accounts.find((a) => a.id === accId) || defaultAcc;
            return {
              draftId: `card_${Date.now()}_${idx}`,
              trade: {
                ...item.candidateTrade,
                entryTime: toDateTimeLocal(item.candidateTrade.entryTime),
                exitTime: toDateTimeLocal(item.candidateTrade.exitTime),
                tradingAccountId: accId,
                accountName: acc?.name || '',
                accountCurrency: acc?.currency || 'USD',
              },
              fieldStatuses: item.fieldStatuses || {},
              duplicateInfo: item.duplicateInfo || null,
              accountResolution: item.accountResolution || null,
              currencyConflict: item.currencyConflict || null,
              isDuplicateInBatch: item.isDuplicateInBatch,
              duplicateReasonInBatch: item.duplicateReasonInBatch,
              isSaved: false,
              savedTradeId: null,
              isSaving: false,
              showFeeBreakdown: false,
              showJournalSection: false,
              originalFilename: item.originalFilename,
            };
          });

        if (tradeCards.length > 0) {
          setActiveDraft(tradeCards[0].trade);
        }

        setChatMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content:
              resData.assistantReply ||
              `Extracted ${tradeCards.length} trade candidate(s) from your screenshots. Review each card below.`,
            trades: tradeCards,
            isBatch: true,
          },
        ]);
        toast.success(`Extracted ${tradeCards.length} trade ticket(s)!`);
      } else if (resData.trade) {
        const defaultAcc = accounts[0];
        const accId = resData.trade.tradingAccountId || activeDraft.tradingAccountId || defaultAcc?.id || '';
        const acc = accounts.find((a) => a.id === accId) || defaultAcc;

        const candidate = {
          ...resData.trade,
          entryTime: toDateTimeLocal(resData.trade.entryTime || activeDraft.entryTime),
          exitTime: toDateTimeLocal(resData.trade.exitTime || activeDraft.exitTime),
          tradingAccountId: accId,
          accountName: acc?.name || activeDraft.accountName || '',
          accountCurrency: acc?.currency || activeDraft.accountCurrency || 'USD',
        };

        setActiveDraft(candidate);

        const card = {
          draftId: `card_${Date.now()}`,
          trade: candidate,
          fieldStatuses: resData.fieldStatuses || {},
          duplicateInfo: resData.duplicateInfo || null,
          accountResolution: resData.accountResolution || null,
          currencyConflict: resData.currencyConflict || null,
          isSaved: false,
          savedTradeId: null,
          isSaving: false,
          showFeeBreakdown: false,
          showJournalSection: false,
        };

        setChatMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content:
              resData.assistantReply ||
              `Extracted trade details for ${candidate.pair || 'trade'}. Review the card below and confirm before saving.`,
            trades: [card],
            isBatch: false,
          },
        ]);
        toast.success('Successfully extracted trade ticket details!');
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: resData.assistantReply || 'Updated your trade draft.',
            trades: null,
          },
        ]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errMsg =
        err.response?.data?.message || err.message || "We couldn't process this trade request. Please try again or enter the trade details manually.";
      setChatMessages((prev) => [
        ...prev,
        {
          id: `ast_err_${Date.now()}`,
          role: 'assistant',
          content: errMsg,
          isError: true,
          trades: null,
        },
      ]);
      toast.error(errMsg);
    } finally {
      setChatLoading(false);
    }
  };

  // ----------------------------------------------------
  // Inline Card Field Modification & Deterministic Math
  // ----------------------------------------------------
  const handleUpdateCardField = (msgId, draftId, fieldKey, value) => {
    setIsDirty(true);
    setChatMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId || !msg.trades) return msg;
        const updatedTrades = msg.trades.map((item) => {
          if (item.draftId !== draftId) return item;
          const updatedTrade = { ...item.trade, [fieldKey]: value };

          // Recalculate deterministic Net Profit when gross profit or fee fields change
          if (['grossProfit', 'commission', 'swap', 'fees'].includes(fieldKey)) {
            const gross = Number(updatedTrade.grossProfit);
            if (!Number.isNaN(gross) && updatedTrade.grossProfit !== '') {
              const comm = Number(updatedTrade.commission) || 0;
              const swap = Number(updatedTrade.swap) || 0;
              const fees = Number(updatedTrade.fees) || 0;
              const calcNet = Math.round((gross + comm + swap + fees) * 100) / 100;
              updatedTrade.profitLossAmount = calcNet;

              if (calcNet > 0) updatedTrade.result = 'WIN';
              else if (calcNet < 0) updatedTrade.result = 'LOSS';
              else updatedTrade.result = 'BREAKEVEN';

              // If closed trade is a realized loss, ensure inferred BE protection is turned off
              if (calcNet < -3.0 && updatedTrade.breakEvenEvidenceStatus !== 'USER_CONFIRMED') {
                updatedTrade.breakEvenActivated = false;
              }
            }
          }

          if (fieldKey === 'profitLossAmount') {
            const net = Number(value);
            if (!Number.isNaN(net) && value !== '') {
              if (net > 0) updatedTrade.result = 'WIN';
              else if (net < 0) updatedTrade.result = 'LOSS';
              else updatedTrade.result = 'BREAKEVEN';

              if (net < -3.0 && updatedTrade.breakEvenEvidenceStatus !== 'USER_CONFIRMED') {
                updatedTrade.breakEvenActivated = false;
              }
            }
          }

          // If entry/exit/stopLoss changes on a closed trade, re-verify BE sanity
          if (['entryPrice', 'exitPrice', 'stopLoss', 'direction'].includes(fieldKey)) {
            const entry = Number(updatedTrade.entryPrice);
            const exit = Number(updatedTrade.exitPrice);
            const pnl = Number(updatedTrade.profitLossAmount);
            const dir = updatedTrade.direction;
            const isClosed = updatedTrade.status === 'CLOSED' || !Number.isNaN(exit);
            const isLossExit = (dir === 'BUY' && !Number.isNaN(exit) && !Number.isNaN(entry) && exit < entry - 1e-4) ||
              (dir === 'SELL' && !Number.isNaN(exit) && !Number.isNaN(entry) && exit > entry + 1e-4);
            const isNetLoss = !Number.isNaN(pnl) && pnl < -3.0;

            if (isClosed && (isLossExit || isNetLoss) && updatedTrade.breakEvenEvidenceStatus !== 'USER_CONFIRMED') {
              updatedTrade.breakEvenActivated = false;
            }
          }

          // Dynamically recalculate Pips
          if (['entryPrice', 'exitPrice', 'direction', 'pair'].includes(fieldKey)) {
            const p = calculatePips({
              pair: updatedTrade.pair,
              direction: updatedTrade.direction,
              entryPrice: updatedTrade.entryPrice,
              exitPrice: updatedTrade.exitPrice,
            });
            if (p !== null) updatedTrade.pips = p;
          }

          // Dynamically recalculate Risk/Reward Ratio
          if (['entryPrice', 'stopLoss', 'takeProfit', 'direction', 'exitPrice'].includes(fieldKey)) {
            const { riskRewardRatio: plannedRR } = calculateRiskReward(
              updatedTrade.direction,
              updatedTrade.entryPrice,
              updatedTrade.stopLoss,
              updatedTrade.takeProfit
            );
            const resolvedRR = plannedRR ?? resolveTradeRiskReward({
              entryPrice: updatedTrade.entryPrice,
              stopLoss: updatedTrade.stopLoss,
              takeProfit: updatedTrade.takeProfit,
              exitPrice: updatedTrade.exitPrice,
              direction: updatedTrade.direction,
              profitLossAmount: updatedTrade.profitLossAmount,
            });
            if (resolvedRR !== null) updatedTrade.riskRewardRatio = resolvedRR;
          }

          // Dynamically recalculate Session when entryTime changes
          if (fieldKey === 'entryTime' && value) {
            const sess = detectTradingSession(value);
            if (sess) updatedTrade.session = sess;
          }

          setActiveDraft(updatedTrade);

          return {
            ...item,
            trade: updatedTrade,
            fieldStatuses: {
              ...item.fieldStatuses,
              [fieldKey]: 'USER_CONFIRMED',
            },
          };
        });
        return { ...msg, trades: updatedTrades };
      })
    );
  };

  const handleToggleCardSection = (msgId, draftId, sectionKey) => {
    setChatMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId || !msg.trades) return msg;
        return {
          ...msg,
          trades: msg.trades.map((t) =>
            t.draftId === draftId ? { ...t, [sectionKey]: !t[sectionKey] } : t
          ),
        };
      })
    );
  };

  // ----------------------------------------------------
  // Inline Card Account Switch & Currency Context
  // ----------------------------------------------------
  const handleCardAccountSelect = async (msgId, draftId, newAccountId) => {
    setIsDirty(true);
    const targetAccount = accounts.find((a) => a.id === newAccountId);
    if (!targetAccount) return;
    const newCurrency = targetAccount.currency || 'USD';

    let updatedTargetTrade = null;

    setChatMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId || !msg.trades) return msg;
        const updatedTrades = msg.trades.map((item) => {
          if (item.draftId !== draftId) return item;

          const conflict =
            item.trade.screenshotCurrency &&
            item.trade.screenshotCurrency.toUpperCase() !== newCurrency.toUpperCase()
              ? {
                  hasCurrencyConflict: true,
                  accountCurrency: newCurrency,
                  screenshotCurrency: item.trade.screenshotCurrency,
                  warning: `Currency mismatch: Screenshot indicates ${item.trade.screenshotCurrency}, but account "${targetAccount.name}" is denominated in ${newCurrency}.`,
                }
              : null;

          const newTrade = {
            ...item.trade,
            tradingAccountId: newAccountId,
            accountName: targetAccount.name,
            accountCurrency: newCurrency,
          };
          updatedTargetTrade = newTrade;

          return {
            ...item,
            accountResolution: null, // cleared upon explicit action
            currencyConflict: conflict,
            trade: newTrade,
            fieldStatuses: {
              ...item.fieldStatuses,
              account: 'USER_CONFIRMED',
              currency: conflict ? 'UNCERTAIN' : 'CONFIRMED',
            },
          };
        });
        return { ...msg, trades: updatedTrades };
      })
    );

    if (updatedTargetTrade) {
      setActiveDraft(updatedTargetTrade);
      // Re-run duplicate detection against new account boundary
      if (updatedTargetTrade.pair && updatedTargetTrade.direction) {
        try {
          const { data } = await api.post('/ai/trade-capture/check-duplicate', {
            candidateTrade: {
              ...updatedTargetTrade,
              tradingAccountId: newAccountId,
            },
          });
          setChatMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== msgId || !msg.trades) return msg;
              return {
                ...msg,
                trades: msg.trades.map((t) =>
                  t.draftId === draftId
                    ? {
                        ...t,
                        duplicateInfo:
                          data.hasDuplicate || data.isPossibleDuplicate ? data : null,
                      }
                    : t
                ),
              };
            })
          );
        } catch (err) {
          console.error('Duplicate recheck failed:', err);
        }
      }
    }
  };

  // ----------------------------------------------------
  // Save Single Trade Candidate
  // ----------------------------------------------------
  const handleSaveCardTrade = async (msgId, draftId) => {
    const card = chatMessages
      .find((m) => m.id === msgId)
      ?.trades?.find((t) => t.draftId === draftId);

    if (!card) return;
    const { trade } = card;

    if (!trade.tradingAccountId) {
      toast.error('Please select a trading account.');
      return;
    }
    if (!trade.pair) {
      toast.error('Please specify a trading pair (e.g. BTCUSD, EURUSD).');
      return;
    }
    if (!trade.direction) {
      toast.error('Please specify direction (BUY or SELL).');
      return;
    }

    // Set card saving state
    setChatMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId || !msg.trades) return msg;
        return {
          ...msg,
          trades: msg.trades.map((t) => (t.draftId === draftId ? { ...t, isSaving: true } : t)),
        };
      })
    );

    const idempotencyKey = `ai_capture_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      const payload = {
        trade: {
          ...trade,
          entryTime: sanitizeDateForSave(trade.entryTime),
          exitTime: sanitizeDateForSave(trade.exitTime),
        },
      };

      const { data } = await api.post('/ai/trade-capture/confirm-save', payload, {
        headers: { 'x-idempotency-key': idempotencyKey },
      });

      const saved = data.savedTrades?.[0];
      setSavedTradeResult(saved || data.savedTrades);
      setIsDirty(false);
      toast.success(data.message || `Saved ${trade.pair} trade to your journal!`);
      if (onTradeSaved) onTradeSaved(saved || data.savedTrades);

      // Update card to saved state
      setChatMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== msgId || !msg.trades) return msg;
          return {
            ...msg,
            trades: msg.trades.map((t) =>
              t.draftId === draftId
                ? { ...t, isSaving: false, isSaved: true, savedTradeId: saved?.id || true }
                : t
            ),
          };
        })
      );
    } catch (err) {
      console.error('Error saving trade:', err);
      const msg = err.response?.data?.message || 'Failed to save trade.';
      toast.error(msg);
      setChatMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== msgId || !msg.trades) return msg;
          return {
            ...msg,
            trades: msg.trades.map((t) => (t.draftId === draftId ? { ...t, isSaving: false } : t)),
          };
        })
      );
    }
  };

  // ----------------------------------------------------
  // Save All Batch Trades
  // ----------------------------------------------------
  const handleSaveBatchCards = async (msgId) => {
    const msg = chatMessages.find((m) => m.id === msgId);
    if (!msg || !msg.trades) return;

    const unsavedTrades = msg.trades.filter(
      (t) => !t.isSaved && t.trade?.pair && t.trade?.tradingAccountId && !t.isDuplicateInBatch
    );

    if (unsavedTrades.length === 0) {
      toast.error('No unsaved valid trades to save.');
      return;
    }

    const idempotencyKey = `ai_batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      const payload = {
        trades: unsavedTrades.map((t) => ({
          ...t.trade,
          entryTime: sanitizeDateForSave(t.trade.entryTime),
          exitTime: sanitizeDateForSave(t.trade.exitTime),
        })),
      };

      const { data } = await api.post('/ai/trade-capture/confirm-save', payload, {
        headers: { 'x-idempotency-key': idempotencyKey },
      });

      toast.success(`Successfully saved ${data.savedCount} trade(s) to your journal!`);
      setIsDirty(false);
      if (onTradeSaved) onTradeSaved(data.savedTrades);

      setChatMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId || !m.trades) return m;
          return {
            ...m,
            trades: m.trades.map((t) =>
              unsavedTrades.some((u) => u.draftId === t.draftId)
                ? { ...t, isSaved: true, savedTradeId: true }
                : t
            ),
          };
        })
      );
    } catch (err) {
      console.error('Batch save error:', err);
      const msg = err.response?.data?.message || 'Failed to save batch trades.';
      toast.error(msg);
    }
  };

  // ----------------------------------------------------
  // Exclude / Remove Candidate from Batch
  // ----------------------------------------------------
  const handleRemoveCard = (msgId, draftId) => {
    setChatMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.trades) return m;
        return {
          ...m,
          trades: m.trades.filter((t) => t.draftId !== draftId),
        };
      })
    );
    toast.success('Removed trade candidate.');
  };

  // ----------------------------------------------------
  // Post-Save Journaling Assistant
  // ----------------------------------------------------
  const handleRequestJournalEnrichment = async (tradeId) => {
    if (!tradeId) return;
    setJournalLoading(true);

    try {
      const { data } = await api.post('/ai/trade-capture/journal-assist', {
        tradeId,
        userNotes: activeDraft.notesBefore || '',
      });
      setJournalSuggestions(data.suggestions);
    } catch (err) {
      console.error('Journal assist error:', err);
      toast.error('Could not generate journal suggestions right now.');
    } finally {
      setJournalLoading(false);
    }
  };

  const handleApplyJournalEnrichment = async (tradeId) => {
    if (!tradeId || !journalSuggestions) return;
    setEnrichingNotes(true);

    try {
      const combinedNotes = [
        activeDraft.notesBefore,
        journalSuggestions.suggestedEntryReason
          ? `\nEntry Rationale: ${journalSuggestions.suggestedEntryReason}`
          : '',
        journalSuggestions.suggestedExitReason
          ? `\nExit Execution: ${journalSuggestions.suggestedExitReason}`
          : '',
        journalSuggestions.ruleAdherenceFeedback
          ? `\nDiscipline Feedback: ${journalSuggestions.ruleAdherenceFeedback}`
          : '',
        journalSuggestions.keyLessons?.length > 0
          ? `\nKey Lessons: ${journalSuggestions.keyLessons.join('; ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
        .trim();

      await api.put(`/trades/${tradeId}`, {
        notesBefore: combinedNotes,
      });

      toast.success('Reflections successfully attached to your trade journal!');
      onClose();
      navigate(`/trades/${tradeId}`);
    } catch (err) {
      console.error('Error applying journal enrichment:', err);
      toast.error('Failed to attach reflections to trade.');
    } finally {
      setEnrichingNotes(false);
    }
  };

  // Helper for field certainty badge
  const renderCertaintyBadge = (status) => {
    if (status === 'CONFIRMED' || status === 'USER_CONFIRMED') {
      return (
        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 inline-flex items-center gap-1">
          <Check size={11} /> Verified
        </span>
      );
    }
    if (status === 'UNCERTAIN') {
      return (
        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-flex items-center gap-1">
          <AlertCircle size={11} /> Review
        </span>
      );
    }
    return null;
  };

  // Direction-aware Break-Even helper
  const getBeHelper = (trade) => {
    const entry = Number(trade.entryPrice);
    const sl = Number(trade.stopLoss);
    const exit = Number(trade.exitPrice);
    const pnl = Number(trade.profitLossAmount);
    const gross = Number(trade.grossProfit);
    if (Number.isNaN(entry) || Number.isNaN(sl) || !entry || !sl) return null;

    const isClosed = trade.status === 'CLOSED' || !Number.isNaN(exit);
    const netLoss = (!Number.isNaN(pnl) && pnl < -3.0) || (!Number.isNaN(gross) && gross < -3.0);
    const isLossExit = (trade.direction === 'BUY' && !Number.isNaN(exit) && exit < entry - 1e-4) ||
      (trade.direction === 'SELL' && !Number.isNaN(exit) && exit > entry + 1e-4);

    if (isClosed && (netLoss || isLossExit)) {
      return {
        type: 'warning',
        text: `Trade closed at a loss on the loss side of entry (${exit || 'exit'} vs ${entry}) — break-even was not achieved.`,
      };
    }

    if (trade.direction === 'BUY') {
      if (sl >= entry - 1e-6) {
        return {
          type: 'success',
          text: `Stop loss (${sl}) is at or above entry (${entry}) — protected in profit.`,
        };
      }
      return {
        type: 'warning',
        text: `Stop loss (${sl}) is below entry (${entry}) on the loss side.`,
      };
    }

    if (trade.direction === 'SELL') {
      if (sl <= entry + 1e-6) {
        return {
          type: 'success',
          text: `Stop loss (${sl}) is at or below entry (${entry}) — protected in profit.`,
        };
      }
      return {
        type: 'warning',
        text: `Stop loss (${sl}) is above entry (${entry}) on the loss side.`,
      };
    }

    return null;
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-headline"
      onPaste={handlePaste}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFilesAdded(e.dataTransfer.files);
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-2 sm:p-4 md:p-6 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="flex flex-col h-[92vh] max-h-[920px] w-full max-w-4xl rounded-3xl bg-surface border border-border shadow-2xl overflow-hidden relative">
        
        {/* ======================================================== */}
        {/* Drag & Drop Visual Overlay */}
        {/* ======================================================== */}
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-indigo-950/80 backdrop-blur-xs border-2 border-dashed border-indigo-400 rounded-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 mb-4 animate-bounce">
              <Upload size={32} />
            </div>
            <h3 className="text-lg font-black text-white">Drop Screenshots to Attach</h3>
            <p className="text-xs text-indigo-200 mt-1 max-w-sm">
              Attach MT4/MT5 trade tickets, open positions, or broker receipts directly to your message.
            </p>
          </div>
        )}

        {/* ======================================================== */}
        {/* Header */}
        {/* ======================================================== */}
        <header className="flex items-center justify-between px-5 sm:px-7 py-3.5 border-b border-border bg-surface-muted/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm shrink-0">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 id="modal-headline" className="text-base sm:text-lg font-black text-foreground tracking-tight">
                Log Trade with JAHZ AI
              </h2>
              <p className="text-xs text-muted hidden sm:block">
                Describe your trade or upload a screenshot.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/trades/new', { state: { prefill: activeDraft } });
              }}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground font-semibold px-3 py-2 rounded-xl border border-border hover:bg-surface-muted transition-colors"
              title="Open full manual form"
            >
              <SlidersHorizontal size={14} />
              <span className="hidden sm:inline">Manual Form</span>
            </button>

            <button
              type="button"
              onClick={handleRequestClose}
              aria-label="Close modal"
              className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-surface-muted transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* Unsaved Changes Discard Overlay */}
        {/* ======================================================== */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-foreground">Discard Unsaved Trade Draft?</h3>
                <p className="text-xs text-muted leading-relaxed">
                  You have uncommitted trade details in progress. If you close now, any extracted or edited fields will be lost.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-foreground text-xs font-bold hover:bg-surface-muted transition-colors"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
                >
                  Discard & Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* Post-Save Journaling Assistant Modal Card */}
        {/* ======================================================== */}
        {journalSuggestions && (
          <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-surface border border-border rounded-3xl p-6 shadow-2xl space-y-4 text-left animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">AI Performance Reflections</h3>
                    <p className="text-[11px] text-muted">Review and accept suggestions into your journal</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setJournalSuggestions(null)}
                  className="p-1.5 rounded-lg text-muted hover:text-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto text-xs pr-1">
                {journalSuggestions.suggestedEntryReason && (
                  <div className="p-3 bg-surface-muted/40 rounded-xl border border-border">
                    <span className="font-bold text-muted block mb-1">Entry Rationale</span>
                    <p className="text-foreground">{journalSuggestions.suggestedEntryReason}</p>
                  </div>
                )}
                {journalSuggestions.suggestedExitReason && (
                  <div className="p-3 bg-surface-muted/40 rounded-xl border border-border">
                    <span className="font-bold text-muted block mb-1">Exit Execution</span>
                    <p className="text-foreground">{journalSuggestions.suggestedExitReason}</p>
                  </div>
                )}
                {journalSuggestions.ruleAdherenceFeedback && (
                  <div className="p-3 bg-surface-muted/40 rounded-xl border border-border">
                    <span className="font-bold text-muted block mb-1">Discipline & Rules</span>
                    <p className="text-foreground">{journalSuggestions.ruleAdherenceFeedback}</p>
                  </div>
                )}
                {journalSuggestions.keyLessons?.length > 0 && (
                  <div className="p-3 bg-surface-muted/40 rounded-xl border border-border">
                    <span className="font-bold text-muted block mb-1">Key Lessons</span>
                    <ul className="list-disc pl-4 space-y-1 text-foreground">
                      {journalSuggestions.keyLessons.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setJournalSuggestions(null)}
                  className="px-3 py-2 text-xs text-muted hover:text-foreground"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyJournalEnrichment(savedTradeResult?.id)}
                  disabled={enrichingNotes}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{enrichingNotes ? 'Attaching...' : 'Attach to Journal'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* Main Conversation Stream */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

          {/* Conversation Messages */}
          {chatMessages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-col sm:flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs text-xs font-bold ${
                    isUser
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/25'
                  }`}
                >
                  {isUser ? 'You' : <Bot size={16} />}
                </div>

                {/* Message Body */}
                <div className={`space-y-3 max-w-full ${isUser ? 'max-w-[85%]' : 'flex-1'}`}>
                  
                  {/* Text bubble & attachments for User */}
                  {isUser && (
                    <div className="space-y-2">
                      {msg.attachments?.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-end">
                          {msg.attachments.map((att, attIdx) => (
                            <div
                              key={attIdx}
                              className="p-1.5 rounded-xl bg-surface border border-border flex items-center gap-2 max-w-[200px]"
                            >
                              <img
                                src={att.previewUrl}
                                alt={att.name}
                                className="w-10 h-10 object-cover rounded-lg border border-border shrink-0"
                              />
                              <div className="truncate text-left">
                                <p className="text-[11px] font-semibold text-foreground truncate">{att.name}</p>
                                <span className="text-[9px] text-muted">{att.size}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.content && (
                        <div className="p-3.5 bg-indigo-600 text-white rounded-2xl rounded-tr-none text-xs sm:text-sm leading-relaxed shadow-xs">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assistant response text */}
                  {!isUser && (
                    <div
                      className={`p-3.5 border rounded-2xl rounded-tl-none text-xs sm:text-sm leading-relaxed shadow-xs ${
                        msg.isError
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                          : 'bg-surface-muted/70 border-border text-foreground'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {msg.isError && <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />}
                        <p className="whitespace-pre-wrap flex-1">{msg.content}</p>
                      </div>

                      {msg.isError && (
                        <div className="mt-3 pt-3 border-t border-amber-500/20 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              navigate('/trades/new', { state: { prefill: activeDraft } });
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-xs"
                          >
                            <SlidersHorizontal size={13} />
                            <span>Enter Trade Manually</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 hover:bg-amber-500/15 text-amber-100 font-semibold text-xs transition-colors"
                          >
                            <Paperclip size={13} />
                            <span>Attach Different Screenshot</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* INLINE TRADE REVIEW CARDS */}
                  {/* ======================================================== */}
                  {!isUser && msg.trades && msg.trades.length > 0 && (
                    <div className="space-y-4 pt-1">
                      
                      {/* Batch Action Header (when multiple cards in message) */}
                      {msg.trades.length > 1 && (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs">
                          <div className="flex items-center gap-2">
                            <Layers size={16} className="text-indigo-400" />
                            <span className="font-bold text-indigo-200">
                              Batch Extraction ({msg.trades.length} candidates)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSaveBatchCards(msg.id)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                          >
                            <Check size={13} />
                            <span>Save All Valid Candidates</span>
                          </button>
                        </div>
                      )}

                      {/* Trade Cards List */}
                      {msg.trades.map((item, cardIdx) => {
                        const { trade, draftId, fieldStatuses, duplicateInfo, accountResolution, currencyConflict, isSaved, isSaving } = item;
                        const accountCurrency = trade.accountCurrency || 'USD';
                        const beHelper = getBeHelper(trade);
                        const selectedAcc = accounts.find((a) => a.id === trade.tradingAccountId);

                        return (
                          <div
                            key={draftId}
                            className={`rounded-2xl border transition-all overflow-hidden ${
                              isSaved
                                ? 'bg-emerald-500/5 border-emerald-500/30'
                                : 'bg-surface border-border shadow-md'
                            }`}
                          >
                            {/* Card Top Banner / Identity */}
                            <div className="p-4 border-b border-border bg-surface-muted/40 flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2.5">
                                <span className="font-black text-sm text-foreground uppercase tracking-tight">
                                  {trade.pair || 'UNSPECIFIED SYMBOL'}
                                </span>
                                
                                {/* Direction Badge */}
                                <span
                                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-md ${
                                    trade.direction === 'BUY'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}
                                >
                                  {trade.direction}
                                </span>

                                {/* Status Selector */}
                                <div className="flex items-center bg-surface p-0.5 rounded-lg border border-border text-[10px] font-bold">
                                  {['PLANNED', 'ACTIVE', 'CLOSED'].map((st) => (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => handleUpdateCardField(msg.id, draftId, 'status', st)}
                                      disabled={isSaved}
                                      className={`px-1.5 py-0.5 rounded transition-all ${
                                        trade.status === st
                                          ? 'bg-indigo-600 text-white'
                                          : 'text-muted hover:text-foreground'
                                      }`}
                                    >
                                      {st.charAt(0) + st.slice(1).toLowerCase()}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <TradeOutcomeBadge
                                  result={trade.result}
                                  breakEvenActivated={trade.breakEvenActivated}
                                  breakEvenPrice={trade.breakEvenPrice}
                                  profitLossAmount={trade.profitLossAmount}
                                  status={trade.status}
                                  size="sm"
                                />

                                {msg.trades.length > 1 && !isSaved && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCard(msg.id, draftId)}
                                    title="Exclude this candidate from batch"
                                    aria-label="Remove candidate"
                                    className="p-1 rounded-lg text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Account Confirmation Discrepancy Alert */}
                            {accountResolution?.status === 'CONFIRMATION_REQUIRED' && !isSaved && (
                              <div className="bg-amber-500/10 border-b border-amber-500/30 p-3.5 space-y-2 text-xs">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                                  <p className="text-amber-300/90 leading-tight">
                                    Detected trade belongs to{' '}
                                    <strong className="text-white underline">
                                      {accountResolution.suggestedAccountName}
                                    </strong>{' '}
                                    ({accountResolution.suggestedAccountCurrency}), but current selection is{' '}
                                    <strong className="text-white">{trade.accountName || selectedAcc?.name}</strong>.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 pl-6">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCardAccountSelect(msg.id, draftId, accountResolution.suggestedAccountId)
                                    }
                                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors"
                                  >
                                    Switch to {accountResolution.suggestedAccountName}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateCardField(msg.id, draftId, 'accountResolution', null)
                                    }
                                    className="px-2 py-1 rounded border border-border text-foreground hover:bg-surface-muted text-[11px]"
                                  >
                                    Keep Current
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Ambiguous Account Prompt */}
                            {accountResolution?.status === 'AMBIGUOUS' && !isSaved && (
                              <div className="bg-indigo-500/10 border-b border-indigo-500/30 p-3 space-y-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <HelpCircle size={15} className="text-indigo-400 shrink-0" />
                                  <span className="font-bold text-indigo-200">
                                    Which trading account does this trade belong to?
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pl-6">
                                  {accounts.map((acc) => (
                                    <button
                                      key={acc.id}
                                      type="button"
                                      onClick={() => handleCardAccountSelect(msg.id, draftId, acc.id)}
                                      className="text-[11px] px-2 py-1 rounded-lg border border-border bg-surface hover:border-indigo-500 text-foreground font-semibold"
                                    >
                                      {acc.name} ({acc.currency})
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Currency Conflict Banner */}
                            {currencyConflict?.hasCurrencyConflict && !isSaved && (
                              <div className="bg-amber-500/10 border-b border-amber-500/20 p-2.5 flex items-center gap-2 text-[11px] text-amber-300">
                                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                                <span>
                                  Currency mismatch: Screenshot indicates {currencyConflict.screenshotCurrency}, but account operates in {currencyConflict.accountCurrency}. Amounts flagged for review.
                                </span>
                              </div>
                            )}

                            {/* Duplicate Warning */}
                            {duplicateInfo && !isSaved && (
                              <div className="bg-amber-500/10 border-b border-amber-500/20 p-2.5 flex items-center gap-2 text-[11px] text-amber-300">
                                <AlertCircle size={14} className="text-amber-400 shrink-0" />
                                <span>
                                  {duplicateInfo.isExactTicketMatch
                                    ? 'Confirmed ticket duplicate match.'
                                    : `Possible duplicate trade (${duplicateInfo.similarityScore}% match).`}
                                </span>
                              </div>
                            )}

                            {/* Core Form Body */}
                            <div className="p-4 space-y-4 text-xs">
                              
                              {/* Account & Symbol Row */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="font-bold text-muted">Trading Account *</label>
                                    {renderCertaintyBadge(fieldStatuses.account)}
                                  </div>
                                  <select
                                    value={trade.tradingAccountId || ''}
                                    onChange={(e) => handleCardAccountSelect(msg.id, draftId, e.target.value)}
                                    disabled={isSaved}
                                    className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 text-foreground font-semibold focus:border-indigo-500 focus:outline-none"
                                  >
                                    <option value="" disabled>Select account</option>
                                    {accounts.map((acc) => (
                                      <option key={acc.id} value={acc.id}>
                                        {acc.name} · {acc.currency || 'USD'} account (Balance: {acc.currency || 'USD'} ${Number(acc.currentBalance || 0).toFixed(2)})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="font-bold text-muted">Symbol / Pair *</label>
                                    {renderCertaintyBadge(fieldStatuses.instrument)}
                                  </div>
                                  <input
                                    type="text"
                                    value={trade.pair || ''}
                                    onChange={(e) => handleUpdateCardField(msg.id, draftId, 'pair', e.target.value.toUpperCase().trim())}
                                    disabled={isSaved}
                                    placeholder="e.g. BTCUSD"
                                    className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 font-bold text-foreground uppercase focus:border-indigo-500 focus:outline-none"
                                  />
                                </div>
                              </div>

                              {/* Prices & Lots Row */}
                              <div className="grid grid-cols-3 gap-2.5">
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="font-bold text-muted">Entry Price</label>
                                    {renderCertaintyBadge(fieldStatuses.entryPrice)}
                                  </div>
                                  <input
                                    type="number"
                                    step="any"
                                    value={trade.entryPrice ?? ''}
                                    onChange={(e) => handleUpdateCardField(msg.id, draftId, 'entryPrice', e.target.value)}
                                    disabled={isSaved}
                                    placeholder="0.00"
                                    className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 text-foreground font-semibold focus:border-indigo-500 focus:outline-none"
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="font-bold text-muted">Exit Price</label>
                                    {renderCertaintyBadge(fieldStatuses.exitPrice)}
                                  </div>
                                  <input
                                    type="number"
                                    step="any"
                                    value={trade.exitPrice ?? ''}
                                    onChange={(e) => handleUpdateCardField(msg.id, draftId, 'exitPrice', e.target.value)}
                                    disabled={isSaved || trade.status !== 'CLOSED'}
                                    placeholder="0.00"
                                    className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 text-foreground font-semibold focus:border-indigo-500 focus:outline-none disabled:opacity-40"
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="font-bold text-muted">Volume (Lots)</label>
                                    {renderCertaintyBadge(fieldStatuses.volume)}
                                  </div>
                                  <input
                                    type="number"
                                    step="any"
                                    value={trade.lotSize ?? ''}
                                    onChange={(e) => handleUpdateCardField(msg.id, draftId, 'lotSize', e.target.value)}
                                    disabled={isSaved}
                                    placeholder="0.10"
                                    className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 text-foreground font-semibold focus:border-indigo-500 focus:outline-none"
                                  />
                                </div>
                              </div>

                              {/* Risk & Break-Even Card */}
                              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2.5">
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="font-bold text-muted block mb-1">Stop Loss</label>
                                    <input
                                      type="number"
                                      step="any"
                                      value={trade.stopLoss ?? ''}
                                      onChange={(e) => handleUpdateCardField(msg.id, draftId, 'stopLoss', e.target.value)}
                                      disabled={isSaved}
                                      placeholder="0.00"
                                      className="w-full bg-surface border border-border rounded-xl px-3 py-1.5 text-foreground font-semibold"
                                    />
                                  </div>
                                  <div>
                                    <label className="font-bold text-muted block mb-1">Take Profit</label>
                                    <input
                                      type="number"
                                      step="any"
                                      value={trade.takeProfit ?? ''}
                                      onChange={(e) => handleUpdateCardField(msg.id, draftId, 'takeProfit', e.target.value)}
                                      disabled={isSaved}
                                      placeholder="0.00"
                                      className="w-full bg-surface border border-border rounded-xl px-3 py-1.5 text-foreground font-semibold"
                                    />
                                  </div>
                                </div>

                                {/* Break-Even Protection Switch */}
                                <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <Shield size={15} className="text-amber-400" />
                                    <div>
                                      <span className="font-bold text-foreground">Break-Even Protection</span>
                                      <p className="text-[10px] text-muted">Stop loss moved to entry or beyond</p>
                                    </div>
                                  </div>
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(trade.breakEvenActivated)}
                                      disabled={isSaved}
                                      onChange={(e) => {
                                        handleUpdateCardField(msg.id, draftId, 'breakEvenActivated', e.target.checked);
                                        handleUpdateCardField(
                                          msg.id,
                                          draftId,
                                          'breakEvenEvidenceStatus',
                                          e.target.checked ? 'USER_CONFIRMED' : 'UNKNOWN'
                                        );
                                        if (e.target.checked && !trade.breakEvenPrice) {
                                          handleUpdateCardField(
                                            msg.id,
                                            draftId,
                                            'breakEvenPrice',
                                            trade.stopLoss || trade.entryPrice || ''
                                          );
                                        }
                                      }}
                                      className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-surface-muted border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                                  </label>
                                </div>

                                {beHelper && (
                                  <div
                                    className={`text-[10px] p-2 rounded-lg border flex items-center gap-1.5 ${
                                      beHelper.type === 'success'
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                        : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                                    }`}
                                  >
                                    <Info size={12} className="shrink-0" />
                                    <span>{beHelper.text}</span>
                                  </div>
                                )}
                              </div>

                              {/* Trade Intelligence Bar: Session, Target R:R, Pips */}
                              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-surface-muted/50 border border-border">
                                <div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <label className="text-[10px] font-bold text-muted">Session</label>
                                    {renderCertaintyBadge(fieldStatuses.session)}
                                  </div>
                                  <select
                                    value={trade.session || ''}
                                    onChange={(e) => handleUpdateCardField(msg.id, draftId, 'session', e.target.value)}
                                    disabled={isSaved}
                                    className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-xs font-bold text-indigo-400 focus:outline-none"
                                  >
                                    <option value="">Auto-Detect</option>
                                    <option value="LONDON">London</option>
                                    <option value="NEW_YORK">New York</option>
                                    <option value="ASIAN">Asian</option>
                                    <option value="LONDON_NEW_YORK_OVERLAP">London/NY Overlap</option>
                                    <option value="OTHER">Other</option>
                                  </select>
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <label className="text-[10px] font-bold text-muted">Target R:R</label>
                                    {renderCertaintyBadge(fieldStatuses.riskRewardRatio)}
                                  </div>
                                  <div className="bg-surface border border-border rounded-lg px-2 py-1 text-xs font-black text-emerald-400">
                                    {trade.riskRewardRatio !== null && trade.riskRewardRatio !== undefined && trade.riskRewardRatio !== ''
                                      ? `1 : ${trade.riskRewardRatio}`
                                      : '—'}
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <label className="text-[10px] font-bold text-muted">Pips</label>
                                    {renderCertaintyBadge(fieldStatuses.pips)}
                                  </div>
                                  <div className="bg-surface border border-border rounded-lg px-2 py-1 text-xs font-black">
                                    <span className={Number(trade.pips) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                      {trade.pips !== null && trade.pips !== undefined && trade.pips !== ''
                                        ? `${Number(trade.pips) > 0 ? '+' : ''}${trade.pips} pips`
                                        : '—'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Deterministic Net Realized P&L Summary */}
                              <div className="p-3 rounded-xl bg-surface-muted/40 border border-border space-y-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="text-[10px] font-bold text-muted block">Deterministic Net P&L</span>
                                    <span className="text-base font-black text-foreground">
                                      {trade.profitLossAmount !== '' && trade.profitLossAmount !== null ? (
                                        <span className={Number(trade.profitLossAmount) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                          {Number(trade.profitLossAmount) >= 0 ? '+' : '-'}
                                          {accountCurrency} {Math.abs(Number(trade.profitLossAmount)).toFixed(2)}
                                        </span>
                                      ) : (
                                        <span className="text-muted text-xs">Pending calculation</span>
                                      )}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleCardSection(msg.id, draftId, 'showFeeBreakdown')}
                                    className="text-[10px] font-bold text-muted hover:text-foreground flex items-center gap-1"
                                  >
                                    <Coins size={12} />
                                    <span>{item.showFeeBreakdown ? 'Hide Fees' : 'Fee Breakdown'}</span>
                                    {item.showFeeBreakdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  </button>
                                </div>

                                {/* Fees Collapsible */}
                                {item.showFeeBreakdown && (
                                  <div className="pt-2 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div>
                                      <label className="text-[9px] font-bold text-muted block mb-0.5">Gross ({accountCurrency})</label>
                                      <input
                                        type="number"
                                        step="any"
                                        value={trade.grossProfit ?? ''}
                                        onChange={(e) => handleUpdateCardField(msg.id, draftId, 'grossProfit', e.target.value)}
                                        disabled={isSaved}
                                        placeholder="0.00"
                                        className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-bold text-muted block mb-0.5">Comm ({accountCurrency})</label>
                                      <input
                                        type="number"
                                        step="any"
                                        value={trade.commission ?? ''}
                                        onChange={(e) => handleUpdateCardField(msg.id, draftId, 'commission', e.target.value)}
                                        disabled={isSaved}
                                        placeholder="-0.00"
                                        className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-bold text-muted block mb-0.5">Swap ({accountCurrency})</label>
                                      <input
                                        type="number"
                                        step="any"
                                        value={trade.swap ?? ''}
                                        onChange={(e) => handleUpdateCardField(msg.id, draftId, 'swap', e.target.value)}
                                        disabled={isSaved}
                                        placeholder="0.00"
                                        className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-bold text-muted block mb-0.5">Override Net ({accountCurrency})</label>
                                      <input
                                        type="number"
                                        step="any"
                                        value={trade.profitLossAmount ?? ''}
                                        onChange={(e) => handleUpdateCardField(msg.id, draftId, 'profitLossAmount', e.target.value)}
                                        disabled={isSaved}
                                        placeholder="0.00"
                                        className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Progressive Disclosure: Strategy, Timestamps & Reflections */}
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCardSection(msg.id, draftId, 'showJournalSection')}
                                  className="w-full flex items-center justify-between text-[11px] font-bold text-muted hover:text-foreground transition-colors p-2 rounded-xl hover:bg-surface-muted/50"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <BookOpen size={13} className="text-indigo-400" />
                                    <span>Strategy, Emotions & Reflections</span>
                                  </div>
                                  {item.showJournalSection ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>

                                {item.showJournalSection && (
                                  <div className="space-y-3 pt-2.5 pb-1">
                                    {/* Timestamps */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[10px] font-bold text-muted block mb-1">Opened Date/Time</label>
                                        <input
                                          type="datetime-local"
                                          value={trade.entryTime || ''}
                                          onChange={(e) => handleUpdateCardField(msg.id, draftId, 'entryTime', e.target.value)}
                                          disabled={isSaved}
                                          className="w-full bg-surface border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-bold text-muted block mb-1">Closed Date/Time</label>
                                        <input
                                          type="datetime-local"
                                          value={trade.exitTime || ''}
                                          onChange={(e) => handleUpdateCardField(msg.id, draftId, 'exitTime', e.target.value)}
                                          disabled={isSaved || trade.status !== 'CLOSED'}
                                          className="w-full bg-surface border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground disabled:opacity-40"
                                        />
                                      </div>
                                    </div>

                                    {/* Strategy Select */}
                                    {strategies.length > 0 && (
                                      <div>
                                        <label className="text-[10px] font-bold text-muted block mb-1">Trading Strategy</label>
                                        <select
                                          value={trade.strategyId || ''}
                                          onChange={(e) => handleUpdateCardField(msg.id, draftId, 'strategyId', e.target.value)}
                                          disabled={isSaved}
                                          className="w-full bg-surface border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-semibold"
                                        >
                                          <option value="">Select strategy (optional)</option>
                                          {strategies.map((strat) => (
                                            <option key={strat.id} value={strat.id}>
                                              {strat.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}

                                    {/* Emotions */}
                                    <div>
                                      <label className="text-[10px] font-bold text-muted block mb-1">Trading Emotions</label>
                                      <div className="flex flex-wrap gap-1">
                                        {TRADING_EMOTIONS.map((emo) => {
                                          const isSelected = Array.isArray(trade.emotions) && trade.emotions.includes(emo);
                                          return (
                                            <button
                                              key={emo}
                                              type="button"
                                              disabled={isSaved}
                                              onClick={() => {
                                                const current = Array.isArray(trade.emotions) ? trade.emotions : [];
                                                const updated = isSelected ? current.filter((e) => e !== emo) : [...current, emo];
                                                handleUpdateCardField(msg.id, draftId, 'emotions', updated);
                                              }}
                                              className={`text-[9px] px-2 py-0.5 rounded font-bold border transition-all ${
                                                isSelected
                                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                                  : 'bg-surface border-border text-muted hover:border-border-hover'
                                              }`}
                                            >
                                              {emo}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    {/* Notes */}
                                    <div>
                                      <label className="text-[10px] font-bold text-muted block mb-1">Trade Notes</label>
                                      <textarea
                                        rows={2}
                                        value={trade.notesBefore || ''}
                                        onChange={(e) => handleUpdateCardField(msg.id, draftId, 'notesBefore', e.target.value)}
                                        disabled={isSaved}
                                        placeholder="Setup execution or lessons..."
                                        className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                            </div>

                            {/* Card Footer: Save Actions */}
                            <div className="p-3.5 border-t border-border bg-surface-muted/30 flex items-center justify-between gap-3">
                              {isSaved ? (
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                                    <CheckCircle2 size={16} />
                                    <span>Saved to Journal ✓</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleRequestJournalEnrichment(trade.id || savedTradeResult?.id)}
                                      disabled={journalLoading}
                                      className="px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-xs hover:bg-indigo-500/25 transition-colors flex items-center gap-1.5"
                                    >
                                      <Sparkles size={13} />
                                      <span>{journalLoading ? 'Analyzing...' : 'Enrich Notes'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onClose();
                                        navigate(`/trades/${trade.id || savedTradeResult?.id}`);
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-surface border border-border text-foreground hover:bg-surface-muted font-bold text-xs transition-colors flex items-center gap-1"
                                    >
                                      <span>View Trade</span>
                                      <ArrowRight size={13} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <span className="text-[11px] text-muted font-medium">
                                    Verify fields before saving
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => handleSaveCardTrade(msg.id, draftId)}
                                    disabled={
                                      isSaving ||
                                      !trade.pair ||
                                      !trade.tradingAccountId ||
                                      accountResolution?.status === 'AMBIGUOUS' ||
                                      accountResolution?.status === 'CONFIRMATION_REQUIRED'
                                    }
                                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {isSaving ? (
                                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                      <>
                                        <Check size={14} />
                                        <span>
                                          {accountResolution?.status === 'CONFIRMATION_REQUIRED'
                                            ? 'Confirm Account to Save'
                                            : accountResolution?.status === 'AMBIGUOUS'
                                            ? 'Select Account'
                                            : 'Save Trade to Journal'}
                                        </span>
                                      </>
                                    )}
                                  </button>
                                </>
                              )}
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              </div>
            );
          })}

          {/* Quick Prompt Suggestions */}
          {chatMessages.length <= 1 && (
            <div className="pt-1 pl-0 sm:pl-11 space-y-2">
              <div className="flex flex-wrap gap-2">
                {PROMPT_SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(s)}
                    className="text-xs bg-surface border border-border hover:border-indigo-500/40 hover:bg-surface-muted text-muted hover:text-foreground rounded-xl px-3 py-1.5 text-left transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Sparkles size={12} className="text-indigo-400 shrink-0" />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading Animation */}
          {chatLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/15 text-indigo-400 border border-indigo-500/25 flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="p-3 bg-surface-muted/80 border border-border rounded-2xl rounded-tl-none text-muted text-xs flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                <span className="text-xs text-indigo-300 ml-1">
                  JAHZ AI is reading trade details & receipts...
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* ======================================================== */}
        {/* Pinned Composer at Bottom */}
        {/* ======================================================== */}
        <div className="border-t border-border bg-surface-muted/40 p-3 sm:p-4 shrink-0 space-y-2">
          
          {/* Attachment Tray (above composer when attachments exist) */}
          {selectedAttachments.length > 0 && (
            <div className="p-2.5 rounded-xl bg-surface border border-border flex items-center gap-2 overflow-x-auto">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {selectedAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="relative group p-1 rounded-xl bg-surface-muted border border-border flex items-center gap-2 pr-2 shrink-0"
                  >
                    <img
                      src={att.previewUrl}
                      alt={att.name}
                      className="w-8 h-8 object-cover rounded-lg border border-border shrink-0"
                    />
                    <div className="truncate max-w-[120px]">
                      <p className="text-[11px] font-semibold text-foreground truncate">{att.name}</p>
                      <span className="text-[9px] text-muted">{(att.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="p-1 rounded-full text-muted hover:text-rose-400 hover:bg-surface transition-colors"
                      title="Remove screenshot"
                      aria-label="Remove screenshot"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttachments([])}
                className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold px-2 shrink-0"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFilesAdded(e.target.files);
                e.target.value = '';
              }}
            />

            {/* Paperclip Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach screenshots"
              title="Attach MT4/MT5 screenshots (PNG, JPG, WEBP up to 10MB each)"
              className="p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-muted text-muted hover:text-foreground transition-colors shrink-0 flex items-center justify-center relative min-h-[44px] min-w-[44px]"
            >
              <Paperclip size={18} />
              {selectedAttachments.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {selectedAttachments.length}
                </span>
              )}
            </button>

            {/* Message Text Input */}
            <input
              ref={composerInputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={
                selectedAttachments.length > 0
                  ? 'Add optional notes or send to extract...'
                  : 'Describe your trade or attach a screenshot...'
              }
              className="flex-1 bg-surface border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-foreground focus:outline-none focus:border-indigo-500 transition-colors min-h-[44px]"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={chatLoading || (!chatInput.trim() && selectedAttachments.length === 0)}
              aria-label="Send trade message"
              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-40 transition-colors shrink-0 flex items-center justify-center shadow-xs min-h-[44px] min-w-[44px]"
            >
              <Send size={18} />
            </button>
          </form>

        </div>

      </div>
    </div>
  );
};

export default AiTradeCaptureModal;
