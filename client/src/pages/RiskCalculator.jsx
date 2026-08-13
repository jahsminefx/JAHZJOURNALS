import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Calculator, ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, 
  RefreshCw, Info, ArrowRight, Save, Copy, Check, Sliders, ChevronDown, ChevronUp, Globe, Activity, Layers, DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import PageHeader from '../components/PageHeader';
import { INSTRUMENT_SPECS, SPECIFICATION_SOURCES, getInstrumentSpec } from '../config/instrumentSpecs.js';
import { getMarketData, resolveExecutionPrice, MARKET_DATA_STATUS } from '../services/marketDataService.js';
import { getSavedBrokerProfiles, DEFAULT_BROKER_PROFILE } from '../services/brokerProfileService.js';
import { 
  calculatePositionSize, 
  calculateReverseStopLoss, 
  calculateReverseRisk, 
  generateRiskScenarios,
  evaluateTradeRiskCheck 
} from '../services/riskCalculatorService.js';

const RISK_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0];
const RR_PRESETS = [1, 2, 3, 5];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF'];

const RiskCalculator = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Mode: 'STANDARD' | 'REVERSE_SL' | 'REVERSE_RISK'
  const [calcMode, setCalcMode] = useState('STANDARD');

  // User accounts & settings
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [userSettings, setUserSettings] = useState(null);
  const [existingOpenTradeRisk, setExistingOpenTradeRisk] = useState(0);

  // Broker Profiles
  const [brokerProfiles, setBrokerProfiles] = useState(() => getSavedBrokerProfiles());
  const [selectedProfileId, setSelectedProfileId] = useState(DEFAULT_BROKER_PROFILE.id);

  // Form State
  const [accountBalance, setAccountBalance] = useState('10000');
  const [accountCurrency, setAccountCurrency] = useState('USD');
  const [pair, setPair] = useState('EURUSD');
  const [direction, setDirection] = useState('BUY');
  const [entryPrice, setEntryPrice] = useState('1.1000');
  const [stopLoss, setStopLoss] = useState('1.0980');
  const [takeProfit, setTakeProfit] = useState('1.1060');
  const [stopLossPipsInput, setStopLossPipsInput] = useState('');
  const [riskPercent, setRiskPercent] = useState('1.0');
  const [manualRiskAmount, setManualRiskAmount] = useState('');
  const [manualLotSize, setManualLotSize] = useState('0.50');

  // V3 Execution Costs & Specs
  const [spreadPips, setSpreadPips] = useState('0');
  const [slippagePips, setSlippagePips] = useState('0');
  const [commissionPerLot, setCommissionPerLot] = useState('0');

  // Custom Broker Inputs
  const [specSource, setSpecSource] = useState(SPECIFICATION_SOURCES.STANDARD);
  const [isAdvancedSpecsOpen, setIsAdvancedSpecsOpen] = useState(false);
  const [customContractSize, setCustomContractSize] = useState('');
  const [customTickSize, setCustomTickSize] = useState('');
  const [customTickValue, setCustomTickValue] = useState('');
  const [customLotStep, setCustomLotStep] = useState('0.01');
  const [customMinLot, setCustomMinLot] = useState('0.01');
  const [customMaxLot, setCustomMaxLot] = useState('100');

  // Currency Conversion Manual Rate
  const [manualConversionRate, setManualConversionRate] = useState('');

  // UI state
  const [isCopied, setIsCopied] = useState(false);
  const [savedCalculations, setSavedCalculations] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('jahzjournals-risk-calc-history') || '[]');
    } catch (_) {
      return [];
    }
  });

  // Live Market Data Feed
  const marketData = useMemo(() => getMarketData(pair), [pair]);

  // Selected Broker Profile
  const selectedProfile = useMemo(() => {
    return brokerProfiles.find((p) => p.id === selectedProfileId) || DEFAULT_BROKER_PROFILE;
  }, [brokerProfiles, selectedProfileId]);

  // Standard Spec for pair
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

  // Fetch Accounts & Open Trades Risk
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

        // Sum existing open trades risk
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

  // Account Selection
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

  // Main Position Size Calculation Result V3
  const calculationResult = useMemo(() => {
    return calculatePositionSize({
      balance: accountBalance,
      riskPercent,
      riskAmountInput: manualRiskAmount,
      entryPrice,
      stopLoss,
      takeProfit,
      stopLossPipsInput,
      direction,
      pair,
      accountCurrency,
      customSpec: activeCustomSpec,
      manualConversionRate,
      spreadPips,
      slippagePips,
      commissionPerLot,
      marketData,
      brokerProfile: selectedProfile,
    });
  }, [accountBalance, riskPercent, manualRiskAmount, entryPrice, stopLoss, takeProfit, stopLossPipsInput, direction, pair, accountCurrency, activeCustomSpec, manualConversionRate, spreadPips, slippagePips, commissionPerLot, marketData, selectedProfile]);

  // Risk Scenario Matrix Simulation
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

  // Expanded 11-Point Safety Check Evaluation
  const riskCheck = useMemo(() => {
    return evaluateTradeRiskCheck({
      calculationResult,
      userSettings: userSettings?.tradingPreferences || userSettings || {},
      account: selectedAccount,
      existingOpenTradeRisk,
    });
  }, [calculationResult, userSettings, selectedAccount, existingOpenTradeRisk]);

  // Reverse Calculations
  const reverseSLResult = useMemo(() => {
    if (calcMode !== 'REVERSE_SL') return null;
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
  }, [calcMode, accountBalance, riskPercent, manualLotSize, pair, entryPrice, direction, accountCurrency, activeCustomSpec, manualConversionRate]);

  const reverseRiskResult = useMemo(() => {
    if (calcMode !== 'REVERSE_RISK') return null;
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
  }, [calcMode, accountBalance, manualLotSize, entryPrice, stopLoss, direction, pair, accountCurrency, activeCustomSpec, manualConversionRate]);

  // Quick R:R Presets
  const applyRRPreset = (rrMultiplier) => {
    const entry = Number(entryPrice);
    const slPips = calculationResult.stopLossPips;
    if (!entry || !slPips) {
      toast.error('Please enter Entry Price and Stop Loss first');
      return;
    }
    const targetPipsDistance = slPips * rrMultiplier * calculationResult.spec.pipSize;
    let newTP = 0;
    if (direction === 'BUY') {
      newTP = entry + targetPipsDistance;
    } else {
      newTP = entry - targetPipsDistance;
    }
    setTakeProfit(newTP.toFixed(calculationResult.spec.pricePrecision || 5));
  };

  // Save History
  const handleSaveCalculation = () => {
    const newEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      pair,
      direction,
      entryPrice,
      stopLoss,
      safeLotSize: calculationResult.safeLotSize,
      estimatedTotalRisk: calculationResult.estimatedTotalRisk,
      riskPercent,
      rr: calculationResult.riskRewardRatio,
    };
    const updated = [newEntry, ...savedCalculations.slice(0, 9)];
    setSavedCalculations(updated);
    try {
      localStorage.setItem('jahzjournals-risk-calc-history', JSON.stringify(updated));
    } catch (_) {}
    toast.success('Calculation saved to local history.');
  };

  // Copy Summary
  const handleCopySummary = () => {
    const summaryText = `[JAHZJOURNALS RISK CALCULATOR V3]
Pair: ${pair} (${direction}) | Source: ${calculationResult.isCustomSpec ? 'Custom Broker' : 'Standard'}
Entry: ${entryPrice} | SL: ${stopLoss} (${calculationResult.stopLossPips} pips)
Target Risk: $${calculationResult.targetCapitalAtRisk} (${riskPercent}%)
Executable Position: ${calculationResult.safeLotSize} lots (Step: ${calculationResult.lotStep})
Price Risk: $${calculationResult.actualPriceRisk} | Spread: $${calculationResult.actualSpreadCost} | Commission: $${calculationResult.actualCommissionCost}
Estimated Total Risk: $${calculationResult.estimatedTotalRisk} (Unused Buffer: $${calculationResult.unusedRiskBuffer})
Target R:R: 1:${calculationResult.riskRewardRatio || 'N/A'}
Status: ${riskCheck.status === 'PASS' ? '✅ PASS' : riskCheck.status === 'WARN' ? '⚠️ WARNING' : '🚨 BLOCKED'}`;

    navigator.clipboard.writeText(summaryText);
    setIsCopied(true);
    toast.success('Calculation summary copied!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Transfer to Quick Trade /trades/new
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
      lotSize: String(calculationResult.safeLotSize),
      riskAmount: String(calculationResult.estimatedTotalRisk),
      tradingAccountId: selectedAccountId || '',
      specSource: calculationResult.isCustomSpec ? 'CUSTOM' : 'STANDARD',
      priceSource: marketData?.source || 'MANUAL',
      conversionSource: calculationResult.rateDetails?.source || 'DIRECT',
      spreadPips: String(spreadPips),
      commissionPerLot: String(commissionPerLot),
    }).toString();

    navigate(`/trades/new?${query}`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans text-foreground">
      <SEO 
        title="Live Broker-Aware Risk Engine V3 | JAHZJOURNALS"
        description="Professional live broker and market-aware position size calculator. Calculate lot sizes with spread, commission, slippage, custom broker specs, and prop-firm combined risk."
        canonical="https://jahzjournal.com/risk-calculator"
      />

      <Breadcrumbs />

      <PageHeader
        eyebrow="Market & Execution-Aware Risk Engine V3"
        title="Live Position Size & Risk Management Engine"
        description="Calculate exact broker-safe lot sizes incorporating spread, commission, slippage buffers, custom broker contract specs, and prop-firm combined drawdown."
        heroImage="/heroes/hero-analytics.png"
        heroAlt="Risk Calculator"
      />

      {/* Mode Switcher & Execution Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-2 rounded-2xl border border-border">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCalcMode('STANDARD')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              calcMode === 'STANDARD' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-muted hover:text-foreground hover:bg-surface-muted'
            }`}
          >
            📊 Position Sizing
          </button>
          <button
            type="button"
            onClick={() => setCalcMode('REVERSE_SL')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              calcMode === 'REVERSE_SL' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-muted hover:text-foreground hover:bg-surface-muted'
            }`}
          >
            📏 Reverse SL
          </button>
          <button
            type="button"
            onClick={() => setCalcMode('REVERSE_RISK')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              calcMode === 'REVERSE_RISK' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-muted hover:text-foreground hover:bg-surface-muted'
            }`}
          >
            💰 Reverse Risk
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-surface-muted rounded-xl border border-border text-muted">
            <span className={`h-2 w-2 rounded-full ${
              marketData.source === 'LIVE' ? 'bg-emerald-400 animate-pulse' : marketData.source === 'CACHED' ? 'bg-amber-400' : 'bg-sky-400'
            }`} />
            <span>Price Feed: <strong className="text-foreground">{marketData.source}</strong></span>
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Input Form */}
        <div className="lg:col-span-7 space-y-6">

          {/* Section 1: Trading Account */}
          <div className="bg-surface p-6 rounded-2xl border border-border shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              🏛️ Section 1 — Trading Account
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Select Account</label>
                <select
                  value={selectedAccountId}
                  onChange={handleAccountChange}
                  className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Custom Account</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName || acc.brokerName} (${Number(acc.accountBalance).toLocaleString()}) {acc.isPropFirmAccount ? '🏆 Prop Firm' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Account Currency</label>
                <select
                  value={accountCurrency}
                  onChange={(e) => setAccountCurrency(e.target.value)}
                  className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none font-bold"
                >
                  {CURRENCIES.map(curr => (
                    <option key={curr} value={curr}>{curr}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">Account Balance ({accountCurrency})</label>
              <input
                type="number"
                step="0.01"
                value={accountBalance}
                onChange={(e) => setAccountBalance(e.target.value)}
                className="w-full bg-surface-muted border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                placeholder="10000"
              />
            </div>
          </div>

          {/* Section 2: Instrument & Live Market Data Panel */}
          <div className="bg-surface p-6 rounded-2xl border border-border shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              ⚡ Section 2 — Instrument & Market Price
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Instrument / Pair</label>
                <select
                  value={pair}
                  onChange={(e) => {
                    const newPair = e.target.value;
                    setPair(newPair);
                    const md = getMarketData(newPair);
                    if (md.mid) setEntryPrice(String(md.mid));
                  }}
                  className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2.5 text-xs font-bold text-foreground focus:border-emerald-500 focus:outline-none"
                >
                  {Object.keys(INSTRUMENT_SPECS).map((sym) => (
                    <option key={sym} value={sym}>
                      {INSTRUMENT_SPECS[sym].displayName} ({INSTRUMENT_SPECS[sym].assetClass})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Direction</label>
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

            {/* Live Market Price Panel */}
            {marketData.bid && (
              <div className="p-3 bg-surface-muted rounded-xl border border-border space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Market Price Feed ({marketData.provider}):</span>
                  <span className="font-bold text-emerald-400 font-mono">Spread: {marketData.spreadPips} pips</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="p-2 bg-surface rounded-lg border border-border">
                    <span className="text-[10px] text-muted block">BID</span>
                    <span className="font-bold text-foreground">{marketData.bid}</span>
                  </div>
                  <div className="p-2 bg-surface rounded-lg border border-border">
                    <span className="text-[10px] text-muted block">MID</span>
                    <span className="font-bold text-sky-400">{marketData.mid}</span>
                  </div>
                  <div className="p-2 bg-surface rounded-lg border border-border">
                    <span className="text-[10px] text-muted block">ASK</span>
                    <span className="font-bold text-foreground">{marketData.ask}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleApplyMarketPrice('ASK')}
                    className="flex-1 py-1 bg-surface hover:bg-surface/80 border border-border rounded-lg text-[10px] font-bold text-muted hover:text-emerald-400"
                  >
                    Use Ask (BUY)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyMarketPrice('BID')}
                    className="flex-1 py-1 bg-surface hover:bg-surface/80 border border-border rounded-lg text-[10px] font-bold text-muted hover:text-rose-400"
                  >
                    Use Bid (SELL)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyMarketPrice('MID')}
                    className="flex-1 py-1 bg-surface hover:bg-surface/80 border border-border rounded-lg text-[10px] font-bold text-muted hover:text-sky-400"
                  >
                    Use Mid
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Entry Price</label>
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
                <label className="block text-xs font-semibold text-muted mb-1.5">Stop Loss Price</label>
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
                <label className="block text-xs font-semibold text-muted mb-1.5">Take Profit Price</label>
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
            <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-muted">Quick R:R Presets:</span>
              <div className="flex gap-2">
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

          {/* Section 3: Risk Settings */}
          <div className="bg-surface p-6 rounded-2xl border border-border shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              🎯 Section 3 — Target Risk
            </h3>

            {calcMode === 'STANDARD' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">Risk Percentage (%)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={riskPercent}
                      onChange={(e) => {
                        setRiskPercent(e.target.value);
                        setManualRiskAmount('');
                      }}
                      className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2.5 text-sm font-bold text-amber-400 focus:border-amber-500 focus:outline-none"
                      placeholder="1.0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">Direct Risk Amount ({accountCurrency})</label>
                    <input
                      type="number"
                      step="1"
                      value={manualRiskAmount}
                      onChange={(e) => {
                        setManualRiskAmount(e.target.value);
                        if (e.target.value && Number(accountBalance) > 0) {
                          const computed = (Number(e.target.value) / Number(accountBalance)) * 100;
                          setRiskPercent(computed.toFixed(2));
                        }
                      }}
                      className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2.5 text-sm font-bold text-amber-400 focus:border-amber-500 focus:outline-none"
                      placeholder="e.g. 100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-muted">Preset Risk %:</span>
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
              </>
            )}

            {calcMode !== 'STANDARD' && (
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Fixed Lot Size (Lots)</label>
                <input
                  type="number"
                  step="0.01"
                  value={manualLotSize}
                  onChange={(e) => setManualLotSize(e.target.value)}
                  className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2.5 text-sm font-bold text-sky-400 focus:border-sky-500 focus:outline-none"
                  placeholder="0.50"
                />
              </div>
            )}
          </div>

          {/* Section 4: Execution Costs & Broker Specifications */}
          <div className="bg-surface p-6 rounded-2xl border border-border shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                ⚙️ Section 4 — Execution Costs & Broker Specs
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSpecSource(SPECIFICATION_SOURCES.STANDARD)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                    specSource === SPECIFICATION_SOURCES.STANDARD ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-border text-muted'
                  }`}
                >
                  Standard Spec
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSpecSource(SPECIFICATION_SOURCES.CUSTOM);
                    setIsAdvancedSpecsOpen(true);
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                    specSource === SPECIFICATION_SOURCES.CUSTOM ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'border-border text-muted'
                  }`}
                >
                  Custom Broker Spec
                </button>
              </div>
            </div>

            {/* Execution Costs Inputs (Spread, Slippage, Commission) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-muted mb-1">Spread (Pips)</label>
                <input
                  type="number"
                  step="0.1"
                  value={spreadPips}
                  onChange={(e) => setSpreadPips(e.target.value)}
                  className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 font-mono font-bold text-foreground focus:border-emerald-500 focus:outline-none"
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
                  className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 font-mono font-bold text-amber-400 focus:border-amber-500 focus:outline-none"
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
                  className="w-full bg-surface-muted border border-border rounded-xl px-3 py-2 font-mono font-bold text-sky-400 focus:border-sky-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Collapsible Advanced Broker Specifications */}
            <div className="border border-border/80 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setIsAdvancedSpecsOpen(!isAdvancedSpecsOpen)}
                className="w-full px-4 py-3 bg-surface-muted flex items-center justify-between text-xs font-bold text-muted hover:text-foreground transition-all"
              >
                <span className="flex items-center gap-2">
                  <Sliders size={14} className="text-emerald-400" />
                  Advanced Broker Contract Specifications
                </span>
                {isAdvancedSpecsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {isAdvancedSpecsOpen && (
                <div className="p-4 space-y-4 bg-surface-muted/40 border-t border-border">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted mb-1">Contract Size</label>
                      <input
                        type="number"
                        value={customContractSize}
                        onChange={(e) => setCustomContractSize(e.target.value)}
                        placeholder={String(standardSpec.contractSize)}
                        className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted mb-1">Tick Size</label>
                      <input
                        type="number"
                        step="any"
                        value={customTickSize}
                        onChange={(e) => setCustomTickSize(e.target.value)}
                        placeholder={String(standardSpec.tickSize)}
                        className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted mb-1">Tick Value</label>
                      <input
                        type="number"
                        step="any"
                        value={customTickValue}
                        onChange={(e) => setCustomTickValue(e.target.value)}
                        placeholder={String(standardSpec.tickValue)}
                        className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted mb-1">Lot Step</label>
                      <input
                        type="number"
                        step="any"
                        value={customLotStep}
                        onChange={(e) => setCustomLotStep(e.target.value)}
                        placeholder="0.01"
                        className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted mb-1">Min Lot</label>
                      <input
                        type="number"
                        step="any"
                        value={customMinLot}
                        onChange={(e) => setCustomMinLot(e.target.value)}
                        placeholder="0.01"
                        className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted mb-1">Max Lot</label>
                      <input
                        type="number"
                        step="any"
                        value={customMaxLot}
                        onChange={(e) => setCustomMaxLot(e.target.value)}
                        placeholder="100"
                        className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {!calculationResult.customSpecValidation.isValid && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400 space-y-1">
                      {calculationResult.customSpecValidation.errors.map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Currency Conversion Panel */}
          {accountCurrency.toUpperCase() !== calculationResult.spec.quoteCurrency.toUpperCase() && (
            <div className="bg-surface p-6 rounded-2xl border border-sky-500/30 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                <Globe size={16} className="text-sky-400" />
                Section 5 — Currency Conversion Panel
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-surface-muted p-2.5 rounded-xl border border-border">
                  <span className="text-muted block text-[10px]">Account Currency</span>
                  <span className="font-bold text-emerald-400">{accountCurrency}</span>
                </div>
                <div className="bg-surface-muted p-2.5 rounded-xl border border-border">
                  <span className="text-muted block text-[10px]">Quote Currency</span>
                  <span className="font-bold text-foreground">{calculationResult.spec.quoteCurrency}</span>
                </div>
                <div className="bg-surface-muted p-2.5 rounded-xl border border-border">
                  <span className="text-muted block text-[10px]">Rate Source</span>
                  <span className="font-bold text-sky-400">{calculationResult.rateDetails.source}</span>
                </div>
                <div className="bg-surface-muted p-2.5 rounded-xl border border-border">
                  <span className="text-muted block text-[10px]">Exchange Rate</span>
                  <span className="font-bold text-foreground font-mono">{calculationResult.rateDetails.rate}</span>
                </div>
              </div>

              {!calculationResult.rateDetails.isAvailable && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-2">
                  <p className="text-amber-300 font-bold">Live currency conversion rate unavailable for {calculationResult.spec.quoteCurrency} to {accountCurrency}.</p>
                  <label className="block text-[11px] font-semibold text-muted">Enter Manual Rate (1 {calculationResult.spec.quoteCurrency} = ? {accountCurrency})</label>
                  <input
                    type="number"
                    step="any"
                    value={manualConversionRate}
                    onChange={(e) => setManualConversionRate(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs font-bold font-mono text-emerald-400 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Section 6: Risk Scenario Simulator Matrix Table */}
          <div className="bg-surface p-6 rounded-2xl border border-border shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <Layers size={16} className="text-amber-400" />
              Section 6 — Risk Scenario Simulator Matrix
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-muted text-muted font-bold text-[11px]">
                  <tr>
                    <th className="p-2.5 rounded-l-lg">Target Risk %</th>
                    <th className="p-2.5">Target Amount</th>
                    <th className="p-2.5">Safe Lot Size</th>
                    <th className="p-2.5">Actual Total Risk</th>
                    <th className="p-2.5 rounded-r-lg">Unused Buffer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {scenarioMatrix.map((sc, idx) => (
                    <tr key={idx} className={Number(riskPercent) === sc.riskPercent ? 'bg-amber-500/10 font-bold' : 'hover:bg-surface-muted/50'}>
                      <td className="p-2.5 text-amber-400 font-bold">{sc.riskPercent}%</td>
                      <td className="p-2.5 font-mono">${sc.targetCapitalAtRisk}</td>
                      <td className="p-2.5 font-mono text-emerald-400">{sc.isBelowMinLot ? 'Blocked (<Min)' : `${sc.safeLotSize} lots`}</td>
                      <td className="p-2.5 font-mono text-rose-400">${sc.estimatedTotalRisk}</td>
                      <td className="p-2.5 font-mono text-sky-400">+${sc.unusedRiskBuffer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Results & Safety Checks */}
        <div className="lg:col-span-5 space-y-6">

          {/* Visual Trade Risk Preview Card */}
          <div className="bg-surface p-6 rounded-2xl border border-emerald-500/30 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Executable Risk Preview V3</h3>
                <p className="text-xs text-muted">Floor-rounded for zero risk overshoot</p>
              </div>

              <div className="text-right">
                <span className="text-xs text-muted block">Estimated Total Risk</span>
                <span className="text-lg font-black text-rose-400">
                  -${calculationResult.estimatedTotalRisk} {accountCurrency}
                </span>
              </div>
            </div>

            {/* Main Lot Size Display */}
            <div className="bg-surface-muted p-5 rounded-xl border border-emerald-500/40 text-center space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Broker Executable Lot Size</span>
              <div className="text-4xl sm:text-5xl font-black text-emerald-400 tracking-tight">
                {calculationResult.safeLotSize} <span className="text-lg text-emerald-500 font-semibold">Lots</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Raw Theoretical: <span className="font-mono text-foreground font-bold">{calculationResult.rawLotSize}</span> lots (Step: {calculationResult.lotStep})
              </p>
            </div>

            {/* Itemized Executable Risk Breakdown */}
            <div className="p-4 bg-surface-muted/60 rounded-xl border border-border space-y-2 text-xs">
              <h4 className="text-[11px] font-bold uppercase text-muted tracking-wider border-b border-border/80 pb-1.5">
                Itemized Cost Breakdown
              </h4>
              <div className="flex justify-between">
                <span className="text-muted">Target Capital Risk ({riskPercent}%):</span>
                <span className="font-bold font-mono text-foreground">${calculationResult.targetCapitalAtRisk}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Price Risk (Stop Loss):</span>
                <span className="font-bold font-mono text-rose-400">${calculationResult.actualPriceRisk}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Estimated Spread Cost ({spreadPips} pips):</span>
                <span className="font-bold font-mono text-amber-400">${calculationResult.actualSpreadCost}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Slippage Buffer Cost ({slippagePips} pips):</span>
                <span className="font-bold font-mono text-amber-400">${calculationResult.actualSlippageCost}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Broker Commission (${commissionPerLot}/lot):</span>
                <span className="font-bold font-mono text-sky-400">${calculationResult.actualCommissionCost}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border/80 font-bold text-foreground">
                <span>Estimated Total Risk:</span>
                <span className="text-rose-400 font-mono">${calculationResult.estimatedTotalRisk}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted">Unused Risk Buffer:</span>
                <span className="text-emerald-400 font-bold font-mono">+${calculationResult.unusedRiskBuffer} ({100 - calculationResult.riskUtilizationPercent}%)</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleApplyToNewTrade}
                disabled={!riskCheck.isPassed}
                className={`w-full py-3 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                  riskCheck.isPassed ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-surface-muted text-muted cursor-not-allowed border border-border'
                }`}
              >
                <span>Apply Position Size to New Trade</span>
                <ArrowRight size={16} />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSaveCalculation}
                  className="py-2.5 bg-surface-muted hover:bg-surface border border-border rounded-xl text-xs font-bold text-muted hover:text-foreground transition-all flex items-center justify-center gap-1.5"
                >
                  <Save size={14} />
                  <span>Save History</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="py-2.5 bg-surface-muted hover:bg-surface border border-border rounded-xl text-xs font-bold text-muted hover:text-foreground transition-all flex items-center justify-center gap-1.5"
                >
                  {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{isCopied ? 'Copied!' : 'Copy Summary'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Prop Firm Combined Exposure Evaluation Card */}
          {riskCheck.propFirmDetails && (
            <div className="p-5 bg-surface rounded-2xl border border-amber-500/30 shadow-xl space-y-3 text-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <ShieldCheck size={16} /> Prop Firm Combined Exposure Assessment
              </h4>
              <div className="flex justify-between">
                <span className="text-muted">Remaining Daily Loss Allowance:</span>
                <span className="font-bold text-emerald-400 font-mono">${riskCheck.propFirmDetails.remainingDaily.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Existing Open Trades Risk:</span>
                <span className="font-bold text-amber-400 font-mono">${riskCheck.propFirmDetails.existingOpenRisk.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Proposed New Trade Risk:</span>
                <span className="font-bold text-rose-400 font-mono">${riskCheck.propFirmDetails.newTradeRisk.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border font-bold text-foreground">
                <span>Combined Daily Risk Exposure:</span>
                <span className={riskCheck.propFirmDetails.combinedRisk <= riskCheck.propFirmDetails.dailyLimit ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>
                  ${riskCheck.propFirmDetails.combinedRisk.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Expanded 11-Point Safety Check Card */}
          <div className={`p-6 rounded-2xl border shadow-xl space-y-4 ${
            riskCheck.status === 'PASS' 
              ? 'bg-emerald-500/5 border-emerald-500/40' 
              : riskCheck.status === 'WARN'
                ? 'bg-amber-500/5 border-amber-500/40'
                : 'bg-rose-500/5 border-rose-500/40'
          }`}>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-foreground">11-Point Safety Evaluation</h4>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${
                riskCheck.status === 'PASS'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : riskCheck.status === 'WARN'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {riskCheck.status === 'PASS' ? '✅ PASS' : riskCheck.status === 'WARN' ? '⚠️ WARNING' : '🚨 BLOCKED'}
              </span>
            </div>

            <p className="text-xs font-bold text-foreground leading-relaxed">
              {riskCheck.summaryMessage}
            </p>

            {/* Itemized 11-Point Safety Checklist */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              {riskCheck.checklist.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-muted flex items-center gap-1.5">
                    {item.status === 'PASS' && <CheckCircle2 size={14} className="text-emerald-400" />}
                    {item.status === 'WARN' && <AlertTriangle size={14} className="text-amber-400" />}
                    {item.status === 'FAIL' && <AlertCircle size={14} className="text-rose-400" />}
                    <span className="text-[10px] text-muted-foreground uppercase">{item.category}:</span> {item.label}
                  </span>
                  <span className={`font-semibold font-mono text-[11px] ${
                    item.status === 'PASS' ? 'text-foreground' : item.status === 'WARN' ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {item.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Broker Disclaimer Notice */}
          <div className="p-4 bg-surface/50 border border-border rounded-xl text-[11px] text-muted-foreground flex gap-2.5 items-start leading-relaxed">
            <Info size={16} className="shrink-0 text-sky-400 mt-0.5" />
            <p>
              <strong>Financial Risk Disclaimer:</strong> Estimated risk is based on the broker specifications, market data, spread, slippage, commission, and conversion rates available at calculation time. Actual execution may differ. Always verify settings with your broker prior to live order placement.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default RiskCalculator;
