import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Calculator, ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, 
  ArrowRight, Copy, Check, Sliders, ChevronDown, ChevronUp, Info, RefreshCw, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import PageHeader from '../components/PageHeader';
import { INSTRUMENT_SPECS, SPECIFICATION_SOURCES, getInstrumentSpec } from '../config/instrumentSpecs.js';
import { getMarketData, resolveExecutionPrice } from '../services/marketDataService.js';
import { getSavedBrokerProfiles, DEFAULT_BROKER_PROFILE } from '../services/brokerProfileService.js';
import { 
  calculatePositionSize, 
  calculateReverseStopLoss, 
  calculateReverseRisk, 
  generateRiskScenarios,
  evaluateTradeRiskCheck 
} from '../services/riskCalculatorService.js';

const RISK_PRESETS = [0.25, 0.5, 1.0, 1.5, 2.0];
const RR_PRESETS = [1, 2, 3, 5];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF'];

const RiskCalculator = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Accounts & User Settings
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [userSettings, setUserSettings] = useState(null);
  const [existingOpenTradeRisk, setExistingOpenTradeRisk] = useState(0);

  // Form State
  const [accountBalance, setAccountBalance] = useState('10000');
  const [accountCurrency, setAccountCurrency] = useState('USD');
  const [pair, setPair] = useState('EURUSD');
  const [direction, setDirection] = useState('BUY');
  const [entryPrice, setEntryPrice] = useState('1.1000');
  const [stopLoss, setStopLoss] = useState('1.0980');
  const [takeProfit, setTakeProfit] = useState('1.1060');
  const [riskPercent, setRiskPercent] = useState('1.0');
  const [manualRiskAmount, setManualRiskAmount] = useState('');

  // Execution Costs & Broker Custom Specs
  const [spreadPips, setSpreadPips] = useState('0');
  const [slippagePips, setSlippagePips] = useState('0');
  const [commissionPerLot, setCommissionPerLot] = useState('0');

  // Broker Spec Accordion State
  const [specSource, setSpecSource] = useState(SPECIFICATION_SOURCES.STANDARD);
  const [isBrokerSpecsOpen, setIsBrokerSpecsOpen] = useState(false);
  const [customContractSize, setCustomContractSize] = useState('');
  const [customTickSize, setCustomTickSize] = useState('');
  const [customTickValue, setCustomTickValue] = useState('');
  const [customLotStep, setCustomLotStep] = useState('0.01');
  const [customMinLot, setCustomMinLot] = useState('0.01');
  const [customMaxLot, setCustomMaxLot] = useState('100');

  // Secondary Tools Accordion State
  const [isAdvancedToolsOpen, setIsAdvancedToolsOpen] = useState(false);
  const [manualConversionRate, setManualConversionRate] = useState('');
  const [reverseMode, setReverseMode] = useState('OFF'); // 'OFF' | 'REVERSE_SL' | 'REVERSE_RISK'
  const [manualLotSize, setManualLotSize] = useState('0.50');

  // UI state
  const [isCopied, setIsCopied] = useState(false);

  // Market Data Feed
  const marketData = useMemo(() => getMarketData(pair), [pair]);

  // Standard Spec
  const standardSpec = useMemo(() => getInstrumentSpec(pair), [pair]);

  // Active Custom Spec
  const activeCustomSpec = useMemo(() => {
    if (specSource !== SPECIFICATION_SOURCES.CUSTOM) return null;
    return {
      contractSize: customContractSize || standardSpec.contractSize,
      tickSize: customTickSize || standardSpec.tickSize,
      tickValue: customTickValue || standardSpec.tickValue,
      lotStep: customLotStep || standardSpec.lotStep,
      minLot: customMinLot || standardSpec.minLot,
      maxLot: customMaxLot || standardSpec.maxLot,
    };
  }, [specSource, customContractSize, customTickSize, customTickValue, customLotStep, customMinLot, customMaxLot, standardSpec]);

  // Load Accounts & User Preferences
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accRes, settingsRes, openTradesRes] = await Promise.all([
          api.get('/accounts').catch(() => ({ data: [] })),
          api.get('/settings').catch(() => ({ data: null })),
          api.get('/trades?status=OPEN').catch(() => ({ data: { trades: [] } })),
        ]);
        
        const fetchedAccounts = accRes.data || [];
        setAccounts(fetchedAccounts);
        if (settingsRes.data) setUserSettings(settingsRes.data);

        const openTrades = openTradesRes.data?.trades || openTradesRes.data || [];
        const openRiskSum = openTrades.reduce((sum, t) => sum + (Number(t.riskAmount) || 0), 0);
        setExistingOpenTradeRisk(openRiskSum);

        const paramAccId = searchParams.get('accountId');
        const targetAcc = fetchedAccounts.find(a => a.id === paramAccId) || fetchedAccounts[0];
        if (targetAcc) {
          setSelectedAccountId(targetAcc.id);
          setAccountBalance(String(targetAcc.accountBalance || 10000));
          if (targetAcc.currency) setAccountCurrency(targetAcc.currency);
        }
      } catch (_) {}
    };

    fetchData();
  }, [searchParams]);

  // Account Dropdown Handler
  const handleAccountChange = (e) => {
    const accId = e.target.value;
    setSelectedAccountId(accId);
    const acc = accounts.find(a => a.id === accId);
    if (acc) {
      setAccountBalance(String(acc.accountBalance || 10000));
      if (acc.currency) setAccountCurrency(acc.currency);
    }
  };

  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedAccountId) || null;
  }, [accounts, selectedAccountId]);

  // Price Mode Click Handlers
  const handleApplyMarketPrice = (mode) => {
    const resolved = resolveExecutionPrice({ marketData, direction, priceMode: mode });
    if (resolved) {
      setEntryPrice(String(resolved));
      toast.success(`Entry set to ${mode} price (${resolved})`);
    } else {
      toast.error('Market price feed unavailable for this selection');
    }
  };

  // Main Calculation Result
  const calc = useMemo(() => {
    return calculatePositionSize({
      balance: accountBalance,
      riskPercent,
      riskAmountInput: manualRiskAmount,
      entryPrice,
      stopLoss,
      takeProfit,
      direction,
      pair,
      accountCurrency,
      customSpec: activeCustomSpec,
      manualConversionRate,
      spreadPips,
      slippagePips,
      commissionPerLot,
      marketData,
    });
  }, [accountBalance, riskPercent, manualRiskAmount, entryPrice, stopLoss, takeProfit, direction, pair, accountCurrency, activeCustomSpec, manualConversionRate, spreadPips, slippagePips, commissionPerLot, marketData]);

  // Single Compact Safety Evaluation
  const riskCheck = useMemo(() => {
    return evaluateTradeRiskCheck({
      calculationResult: calc,
      userSettings: userSettings?.tradingPreferences || userSettings || {},
      account: selectedAccount,
      existingOpenTradeRisk,
    });
  }, [calc, userSettings, selectedAccount, existingOpenTradeRisk]);

  // Scenario Simulator Matrix
  const scenarioMatrix = useMemo(() => {
    return generateRiskScenarios({
      balance: accountBalance,
      entryPrice,
      stopLoss,
      direction,
      pair,
      accountCurrency,
      customSpec: activeCustomSpec,
      manualConversionRate,
      spreadPips,
      slippagePips,
      commissionPerLot,
    });
  }, [accountBalance, entryPrice, stopLoss, direction, pair, accountCurrency, activeCustomSpec, manualConversionRate, spreadPips, slippagePips, commissionPerLot]);

  // Reverse Calculations
  const reverseSLResult = useMemo(() => {
    if (reverseMode !== 'REVERSE_SL') return null;
    return calculateReverseStopLoss({
      balance: accountBalance,
      riskPercent,
      lotSize: manualLotSize,
      pair,
      entryPrice,
      direction,
      accountCurrency,
      customSpec: activeCustomSpec,
      manualConversionRate,
    });
  }, [reverseMode, accountBalance, riskPercent, manualLotSize, pair, entryPrice, direction, accountCurrency, activeCustomSpec, manualConversionRate]);

  const reverseRiskResult = useMemo(() => {
    if (reverseMode !== 'REVERSE_RISK') return null;
    return calculateReverseRisk({
      balance: accountBalance,
      lotSize: manualLotSize,
      entryPrice,
      stopLoss,
      direction,
      pair,
      accountCurrency,
      customSpec: activeCustomSpec,
      manualConversionRate,
    });
  }, [reverseMode, accountBalance, manualLotSize, entryPrice, stopLoss, direction, pair, accountCurrency, activeCustomSpec, manualConversionRate]);

  // R:R Quick Preset
  const applyRRPreset = (rrMultiplier) => {
    const entry = Number(entryPrice);
    const slPips = calc.stopLossPips;
    if (!entry || !slPips) {
      toast.error('Enter Entry Price and Stop Loss first');
      return;
    }
    const targetPipsDistance = slPips * rrMultiplier * calc.spec.pipSize;
    let newTP = direction === 'BUY' ? entry + targetPipsDistance : entry - targetPipsDistance;
    setTakeProfit(newTP.toFixed(calc.spec.pricePrecision || 5));
  };

  // Reset Calculator
  const handleReset = () => {
    setEntryPrice('1.1000');
    setStopLoss('1.0980');
    setTakeProfit('1.1060');
    setRiskPercent('1.0');
    setManualRiskAmount('');
    setSpreadPips('0');
    setSlippagePips('0');
    setCommissionPerLot('0');
    setSpecSource(SPECIFICATION_SOURCES.STANDARD);
    setManualConversionRate('');
    setReverseMode('OFF');
    toast.success('Calculator reset to default settings');
  };

  // Copy Summary
  const handleCopySummary = () => {
    const text = `[JAHZJOURNALS RISK CALCULATOR]
Pair: ${pair} (${direction}) | Position Size: ${calc.safeLotSize} lots
Entry: ${entryPrice} | SL: ${stopLoss} (${calc.stopLossPips} pips)
Target Risk: $${calc.targetCapitalAtRisk} (${riskPercent}%)
Actual Risk: $${calc.estimatedTotalRisk} (Buffer: $${calc.unusedRiskBuffer})
R:R Ratio: 1:${calc.riskRewardRatio || 'N/A'}
Safety Check: ${riskCheck.status === 'PASS' ? '✅ SAFE' : riskCheck.status === 'WARN' ? '⚠️ REVIEW REQUIRED' : '🚨 BLOCKED'}`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success('Position summary copied');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Apply to New Trade
  const handleApplyToNewTrade = () => {
    if (!riskCheck.isPassed) {
      toast.error('Cannot apply trade: Risk and safety evaluation is BLOCKED.');
      return;
    }

    const query = new URLSearchParams({
      pair,
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      lotSize: String(calc.safeLotSize),
      riskAmount: String(calc.estimatedTotalRisk),
      tradingAccountId: selectedAccountId || '',
    }).toString();

    navigate(`/trades/new?${query}`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans text-foreground pb-12">
      <SEO 
        title="Position Size & Risk Calculator | JAHZJOURNALS"
        description="Calculate exact broker-safe lot sizes and verify pre-trade risk for Forex, Metals, and Indices."
        canonical="https://jahzjournal.com/risk-calculator"
      />

      <Breadcrumbs />

      <PageHeader
        eyebrow="Position Size & Risk Engine"
        title="Forex Position Size & Risk Calculator"
        description="Calculate exact executable lot sizes and verify safety rules before placing your trade."
        heroImage="/heroes/hero-analytics.png"
        heroAlt="Risk Calculator"
      />

      {/* Main 2-Column Responsive Layout */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        
        {/* SECTION 1 — TRADE SETUP (Left Column on Desktop / Top on Mobile) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Calculator size={18} className="text-emerald-400" />
                1. Trade Setup
              </h2>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-1 transition-all"
              >
                <RefreshCw size={12} /> Reset
              </button>
            </div>

            {/* Account & Currency Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-muted mb-1">Trading Account</label>
                <select
                  value={selectedAccountId}
                  onChange={handleAccountChange}
                  className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Custom Trading Account</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName || acc.brokerName} (${Number(acc.accountBalance).toLocaleString()}) {acc.isPropFirmAccount ? '🏆 Prop Firm' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Account Currency</label>
                <select
                  value={accountCurrency}
                  onChange={(e) => setAccountCurrency(e.target.value)}
                  className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-emerald-500 focus:outline-none"
                >
                  {CURRENCIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Balance & Risk % Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Account Balance ({accountCurrency})</label>
                <input
                  type="number"
                  step="any"
                  value={accountBalance}
                  onChange={(e) => setAccountBalance(e.target.value)}
                  className="w-full bg-surface-muted border border-border rounded-xl px-3.5 py-2 text-sm font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                  placeholder="10000"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-muted">Risk Percentage (%)</label>
                  <span className="text-[11px] font-bold text-amber-400 font-mono">${calc.targetCapitalAtRisk}</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={riskPercent}
                  onChange={(e) => {
                    setRiskPercent(e.target.value);
                    setManualRiskAmount('');
                  }}
                  className="w-full bg-surface-muted border border-border rounded-xl px-3.5 py-2 text-sm font-bold text-amber-400 focus:border-amber-500 focus:outline-none"
                  placeholder="1.0"
                />
              </div>
            </div>

            {/* Quick Risk Presets */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] font-semibold text-muted">Quick Risk Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {RISK_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setRiskPercent(String(p));
                      setManualRiskAmount('');
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                      Number(riskPercent) === p ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-surface-muted border-border text-muted hover:text-foreground'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            {/* Instrument & Direction Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/80">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Instrument / Pair</label>
                <select
                  value={pair}
                  onChange={(e) => {
                    const newPair = e.target.value;
                    setPair(newPair);
                    const md = getMarketData(newPair);
                    if (md.mid) setEntryPrice(String(md.mid));
                  }}
                  className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-emerald-500 focus:outline-none"
                >
                  {Object.keys(INSTRUMENT_SPECS).map((sym) => (
                    <option key={sym} value={sym}>
                      {INSTRUMENT_SPECS[sym].displayName} ({INSTRUMENT_SPECS[sym].assetClass})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Trade Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection('BUY')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      direction === 'BUY' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-border text-muted hover:text-foreground'
                    }`}
                  >
                    📈 BUY (Long)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('SELL')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      direction === 'SELL' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'border-border text-muted hover:text-foreground'
                    }`}
                  >
                    📉 SELL (Short)
                  </button>
                </div>
              </div>
            </div>

            {/* Entry, Stop Loss, Take Profit Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-muted">Entry Price</label>
                  {marketData.bid && (
                    <div className="flex gap-1 text-[10px]">
                      <button type="button" onClick={() => handleApplyMarketPrice('ASK')} className="text-emerald-400 hover:underline">Ask</button>
                      <span className="text-muted">|</span>
                      <button type="button" onClick={() => handleApplyMarketPrice('BID')} className="text-rose-400 hover:underline">Bid</button>
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-foreground focus:border-emerald-500 focus:outline-none"
                  placeholder="1.1000"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-muted">Stop Loss</label>
                  <span className="text-[10px] text-muted font-mono">{calc.stopLossPips} pips</span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-rose-400 focus:border-rose-500 focus:outline-none"
                  placeholder="1.0980"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-muted">Take Profit</label>
                  <span className="text-[10px] text-muted font-mono">{calc.takeProfitPips} pips</span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                  placeholder="1.1060"
                />
              </div>
            </div>

            {/* Quick R:R Presets */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] font-semibold text-muted">Quick Target R:R:</span>
              <div className="flex gap-1.5">
                {RR_PRESETS.map((multiplier) => (
                  <button
                    key={multiplier}
                    type="button"
                    onClick={() => applyRRPreset(multiplier)}
                    className="px-2.5 py-1 bg-surface-muted border border-border rounded-lg text-xs font-bold text-muted hover:text-emerald-400 hover:border-emerald-500/50 transition-all"
                  >
                    1:{multiplier}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — RESULTS, SAFETY & ACTIONS (Desktop Right / Mobile Bottom) */}
        <div className="lg:col-span-5 space-y-5">

          {/* SECTION 2 — POSITION SIZE RESULT (HERO CARD) */}
          <div className="bg-surface p-6 rounded-2xl border border-emerald-500/40 shadow-2xl space-y-5 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />

            <div className="text-center space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-muted">Calculated Position Size</span>
              <div className="text-5xl sm:text-6xl font-black text-emerald-400 tracking-tight my-1">
                {calc.safeLotSize} <span className="text-xl text-emerald-500 font-bold">LOTS</span>
              </div>
              <p className="text-[11px] text-muted">
                Safe Executable Lot (Step: <span className="font-mono font-bold text-foreground">{calc.lotStep}</span>)
              </p>
            </div>

            {/* Compact Results Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-border/80">
              <div className="p-2.5 bg-surface-muted rounded-xl border border-border">
                <span className="text-muted block text-[10px]">Target Risk ({riskPercent}%)</span>
                <span className="font-bold font-mono text-foreground">${calc.targetCapitalAtRisk}</span>
              </div>
              <div className="p-2.5 bg-surface-muted rounded-xl border border-border">
                <span className="text-muted block text-[10px]">Actual Executable Risk</span>
                <span className="font-bold font-mono text-rose-400">${calc.estimatedTotalRisk}</span>
              </div>
              <div className="p-2.5 bg-surface-muted rounded-xl border border-border">
                <span className="text-muted block text-[10px]">Stop Loss Distance</span>
                <span className="font-bold font-mono text-foreground">{calc.stopLossPips} pips</span>
              </div>
              <div className="p-2.5 bg-surface-muted rounded-xl border border-border">
                <span className="text-muted block text-[10px]">Target Risk / Reward</span>
                <span className="font-bold font-mono text-emerald-400">1 : {calc.riskRewardRatio || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* SECTION 3 — CAN I TAKE THIS TRADE? (SINGLE COMPACT SAFETY CARD) */}
          <div className={`p-5 rounded-2xl border shadow-xl space-y-3 ${
            riskCheck.status === 'PASS' 
              ? 'bg-emerald-500/5 border-emerald-500/40' 
              : riskCheck.status === 'WARN'
                ? 'bg-amber-500/5 border-amber-500/40'
                : 'bg-rose-500/5 border-rose-500/40'
          }`}>
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Can I Take This Trade?</h3>
              <span className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wide ${
                riskCheck.status === 'PASS'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : riskCheck.status === 'WARN'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {riskCheck.status === 'PASS' ? '✅ SAFE TO EXECUTE' : riskCheck.status === 'WARN' ? '⚠️ REVIEW REQUIRED' : '🚨 TRADE BLOCKED'}
              </span>
            </div>

            <p className="text-xs font-semibold text-foreground leading-relaxed">
              {riskCheck.summaryMessage}
            </p>

            {/* Consolidated Bullet Checklist */}
            <div className="space-y-1.5 pt-1 text-xs">
              {riskCheck.checklist.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5 text-[11px]">
                    {item.status === 'PASS' && <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />}
                    {item.status === 'WARN' && <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
                    {item.status === 'FAIL' && <AlertCircle size={13} className="text-rose-400 shrink-0" />}
                    <span>{item.label}</span>
                  </span>
                  <span className="font-mono text-[10px] font-bold text-foreground">{item.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 5 — PRIMARY ACTIONS & DISCLAIMER */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleApplyToNewTrade}
              disabled={!riskCheck.isPassed}
              className={`w-full py-3.5 px-4 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                riskCheck.isPassed 
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20' 
                  : 'bg-surface-muted text-muted cursor-not-allowed border border-border'
              }`}
            >
              <span>Apply Position Size to New Trade</span>
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              className="w-full py-2 bg-surface-muted hover:bg-surface border border-border rounded-xl text-xs font-bold text-muted hover:text-foreground transition-all flex items-center justify-center gap-1.5"
            >
              {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{isCopied ? 'Summary Copied!' : 'Copy Summary'}</span>
            </button>

            {/* MANDATORY BROKER DISCLAIMER */}
            <div className="p-3 bg-surface-muted/50 border border-border rounded-xl text-[11px] text-muted-foreground flex gap-2 items-start leading-relaxed">
              <Info size={15} className="shrink-0 text-amber-400 mt-0.5" />
              <p>
                <strong>Broker Specification Disclaimer:</strong> Broker contract specifications can vary by broker. Always verify tick size, tick value, contract size, lot step and minimum/maximum lot requirements with your broker before executing a live trade.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 4 — BROKER SPECIFICATION (COLLAPSED BY DEFAULT) */}
      <div className="bg-surface rounded-2xl border border-border shadow-md overflow-hidden">
        <button
          type="button"
          onClick={() => setIsBrokerSpecsOpen(!isBrokerSpecsOpen)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-bold text-muted hover:text-foreground transition-all"
        >
          <span className="flex items-center gap-2">
            <Sliders size={15} className="text-emerald-400" />
            Broker Specification: <span className="text-foreground">{calc.isCustomSpec ? 'Custom Broker Spec' : `Standard (${pair})`}</span>
          </span>
          {isBrokerSpecsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {isBrokerSpecsOpen && (
          <div className="p-5 bg-surface-muted/30 border-t border-border space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-muted">Specification Source:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSpecSource(SPECIFICATION_SOURCES.STANDARD)}
                  className={`px-3 py-1 rounded-lg border text-xs font-bold transition-all ${
                    specSource === SPECIFICATION_SOURCES.STANDARD ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-border text-muted'
                  }`}
                >
                  Standard Spec
                </button>
                <button
                  type="button"
                  onClick={() => setSpecSource(SPECIFICATION_SOURCES.CUSTOM)}
                  className={`px-3 py-1 rounded-lg border text-xs font-bold transition-all ${
                    specSource === SPECIFICATION_SOURCES.CUSTOM ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'border-border text-muted'
                  }`}
                >
                  Custom Broker Spec
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-surface p-3 rounded-xl border border-border">
                <span className="text-muted block text-[10px]">Contract Size</span>
                <span className="font-mono font-bold text-foreground">{calc.spec.contractSize}</span>
              </div>
              <div className="bg-surface p-3 rounded-xl border border-border">
                <span className="text-muted block text-[10px]">Tick Size</span>
                <span className="font-mono font-bold text-foreground">{calc.spec.tickSize}</span>
              </div>
              <div className="bg-surface p-3 rounded-xl border border-border">
                <span className="text-muted block text-[10px]">Tick Value / Lot</span>
                <span className="font-mono font-bold text-foreground">${calc.tickValuePerLot}</span>
              </div>
              <div className="bg-surface p-3 rounded-xl border border-border">
                <span className="text-muted block text-[10px]">Lot Step</span>
                <span className="font-mono font-bold text-foreground">{calc.lotStep}</span>
              </div>
              <div className="bg-surface p-3 rounded-xl border border-border">
                <span className="text-muted block text-[10px]">Min Lot</span>
                <span className="font-mono font-bold text-foreground">{calc.minLot}</span>
              </div>
              <div className="bg-surface p-3 rounded-xl border border-border">
                <span className="text-muted block text-[10px]">Max Lot</span>
                <span className="font-mono font-bold text-foreground">{calc.maxLot}</span>
              </div>
            </div>

            {specSource === SPECIFICATION_SOURCES.CUSTOM && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-border">
                <div>
                  <label className="block text-[10px] font-semibold text-muted mb-1">Custom Contract Size</label>
                  <input
                    type="number"
                    value={customContractSize}
                    onChange={(e) => setCustomContractSize(e.target.value)}
                    placeholder={String(standardSpec.contractSize)}
                    className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-muted mb-1">Custom Tick Size</label>
                  <input
                    type="number"
                    step="any"
                    value={customTickSize}
                    onChange={(e) => setCustomTickSize(e.target.value)}
                    placeholder={String(standardSpec.tickSize)}
                    className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-muted mb-1">Custom Tick Value</label>
                  <input
                    type="number"
                    step="any"
                    value={customTickValue}
                    onChange={(e) => setCustomTickValue(e.target.value)}
                    placeholder={String(standardSpec.tickValue)}
                    className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECONDARY / ADVANCED TOOLS (COLLAPSED BY DEFAULT) */}
      <div className="bg-surface rounded-2xl border border-border shadow-md overflow-hidden">
        <button
          type="button"
          onClick={() => setIsAdvancedToolsOpen(!isAdvancedToolsOpen)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-bold text-muted hover:text-foreground transition-all"
        >
          <span className="flex items-center gap-2">
            <Layers size={15} className="text-amber-400" />
            Advanced Tools & Execution Costs
          </span>
          {isAdvancedToolsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {isAdvancedToolsOpen && (
          <div className="p-5 bg-surface-muted/30 border-t border-border space-y-6 text-xs">
            
            {/* Execution Costs Inputs */}
            <div>
              <h4 className="font-bold text-foreground mb-2">Execution Cost Adjustments</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Spread (Pips)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={spreadPips}
                    onChange={(e) => setSpreadPips(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 font-mono font-bold text-foreground focus:border-emerald-500 focus:outline-none"
                    placeholder="0.0"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Slippage Buffer (Pips)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={slippagePips}
                    onChange={(e) => setSlippagePips(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 font-mono font-bold text-amber-400 focus:border-amber-500 focus:outline-none"
                    placeholder="0.0"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Commission ($ / Lot)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={commissionPerLot}
                    onChange={(e) => setCommissionPerLot(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 font-mono font-bold text-sky-400 focus:border-sky-500 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Risk Scenario Simulator Matrix Table */}
            <div>
              <h4 className="font-bold text-foreground mb-2">Risk Scenario Simulator Matrix</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface text-muted font-bold text-[11px]">
                    <tr>
                      <th className="p-2 rounded-l-lg">Target Risk %</th>
                      <th className="p-2">Target Amount</th>
                      <th className="p-2">Safe Lot Size</th>
                      <th className="p-2">Actual Total Risk</th>
                      <th className="p-2 rounded-r-lg">Unused Buffer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {scenarioMatrix.map((sc, idx) => (
                      <tr key={idx} className={Number(riskPercent) === sc.riskPercent ? 'bg-amber-500/10 font-bold' : 'hover:bg-surface/50'}>
                        <td className="p-2 text-amber-400 font-bold">{sc.riskPercent}%</td>
                        <td className="p-2 font-mono">${sc.targetCapitalAtRisk}</td>
                        <td className="p-2 font-mono text-emerald-400">{sc.safeLotSize} lots</td>
                        <td className="p-2 font-mono text-rose-400">${sc.estimatedTotalRisk}</td>
                        <td className="p-2 font-mono text-sky-400">+${sc.unusedRiskBuffer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reverse Calculator */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-foreground">Reverse Risk Calculator</h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReverseMode(reverseMode === 'REVERSE_SL' ? 'OFF' : 'REVERSE_SL')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                      reverseMode === 'REVERSE_SL' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-border text-muted'
                    }`}
                  >
                    Reverse Stop Loss
                  </button>
                  <button
                    type="button"
                    onClick={() => setReverseMode(reverseMode === 'REVERSE_RISK' ? 'OFF' : 'REVERSE_RISK')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                      reverseMode === 'REVERSE_RISK' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'border-border text-muted'
                    }`}
                  >
                    Reverse Risk
                  </button>
                </div>
              </div>

              {reverseMode === 'REVERSE_SL' && reverseSLResult && (
                <div className="p-3 bg-surface rounded-xl border border-border space-y-1">
                  <span className="text-muted block text-[11px]">Maximum Stop Loss Distance for {manualLotSize} lots:</span>
                  <span className="font-bold font-mono text-emerald-400 text-sm">{reverseSLResult.maxStopLossPips} pips</span>
                  <span className="text-muted block text-[10px]">Suggested Stop Price: {reverseSLResult.suggestedStopLossPrice}</span>
                </div>
              )}

              {reverseMode === 'REVERSE_RISK' && reverseRiskResult && (
                <div className="p-3 bg-surface rounded-xl border border-border space-y-1">
                  <span className="text-muted block text-[11px]">Calculated Monetary Risk for {manualLotSize} lots:</span>
                  <span className="font-bold font-mono text-rose-400 text-sm">${reverseRiskResult.riskAmount} ({reverseRiskResult.riskPercent}%)</span>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

export default RiskCalculator;
