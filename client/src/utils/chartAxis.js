import { getCurrencySymbol } from '../services/currencyConversionService.js';

const NICE_FACTORS = [1, 2, 2.5, 5];

const roundClean = (value) => {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-12) return 0;
  return Number(Number(value).toPrecision(12));
};

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

export const selectNiceTickInterval = (rawSpan, targetTickCount = 5) => {
  const safeSpan = Number(rawSpan);
  if (!Number.isFinite(safeSpan) || safeSpan <= 0) return 10;

  const intervals = Math.max(2, targetTickCount - 1);
  const roughStep = safeSpan / intervals;
  const minAllowedStep = safeSpan >= 4 ? 1 : 0.25;
  const effectiveRough = Math.max(roughStep, minAllowedStep);
  const magnitude = 10 ** Math.floor(Math.log10(effectiveRough));
  const candidates = [];

  [0.1, 1, 10, 100].forEach((scale) => {
    NICE_FACTORS.forEach((factor) => {
      const candidate = roundClean(factor * magnitude * scale);
      if (candidate >= minAllowedStep) candidates.push(candidate);
    });
  });

  candidates.sort((a, b) => a - b);
  return candidates.find((step) => step >= effectiveRough - 1e-9) || candidates[candidates.length - 1] || 10;
};

const collectCandidateSteps = (span) => {
  const minAllowedStep = span >= 4 ? 1 : 0.25;
  const baseMagnitude = 10 ** Math.floor(Math.log10(Math.max(span / 8, minAllowedStep)));
  const set = new Set();

  [0.1, 1, 10, 100, 1000].forEach((scale) => {
    NICE_FACTORS.forEach((factor) => {
      const candidate = roundClean(factor * baseMagnitude * scale);
      if (candidate >= minAllowedStep) set.add(candidate);
    });
  });

  return [...set].sort((a, b) => a - b);
};

const buildTickSeries = (minVal, maxVal, step) => {
  const ticks = [];
  const count = Math.round((maxVal - minVal) / step);
  for (let i = 0; i <= count; i += 1) {
    ticks.push(roundClean(minVal + i * step));
  }
  return ticks;
};

export const calculateYAxisDomain = (points = [], options = {}) => {
  const {
    mode = 'cumulativePnl',
    targetTickCount = 5,
    maxTickCount = 7,
  } = options;

  const isCumulative = mode === 'cumulativePnl';
  const values = (points || [])
    .map((point) => Number(point?.value))
    .filter(Number.isFinite);

  if (!values.length) {
    return isCumulative
      ? { domain: [-100, 100], ticks: [-100, -50, 0, 50, 100], step: 50 }
      : { domain: [0, 1000], ticks: [0, 250, 500, 750, 1000], step: 250 };
  }

  let rawMin = Math.min(...values);
  let rawMax = Math.max(...values);

  if (isCumulative) {
    rawMin = Math.min(0, rawMin);
    rawMax = Math.max(0, rawMax);
  }

  if (rawMin === 0 && rawMax === 0) {
    return isCumulative
      ? { domain: [-100, 100], ticks: [-100, -50, 0, 50, 100], step: 50 }
      : { domain: [0, 1000], ticks: [0, 250, 500, 750, 1000], step: 250 };
  }

  const relativeSpan = rawMax !== 0 ? Math.abs(rawMax - rawMin) / Math.abs(rawMax) : 1;
  // Prevent tiny post-funding fluctuations (< 2% of balance) or flat balances from being visually exaggerated
  if (!isCumulative && rawMin > 0 && (rawMin === rawMax || relativeSpan < 0.02)) {
    const midVal = (rawMin + rawMax) / 2;
    const halfSpan = Math.max(Math.abs(rawMax) * 0.05, 25);
    const low = Math.max(0, midVal - halfSpan);
    const high = midVal + halfSpan;
    const step = selectNiceTickInterval(high - low, targetTickCount);
    const niceMin = Math.max(0, Math.floor(low / step) * step);
    let niceMax = Math.ceil(high / step) * step;
    if (niceMax <= niceMin) niceMax = niceMin + step;
    return {
      domain: [roundClean(niceMin), roundClean(niceMax)],
      ticks: buildTickSeries(niceMin, niceMax, step),
      step,
    };
  }

  // Flat zero/negative single-value fallback
  if (rawMin === rawMax) {
    const absVal = Math.abs(rawMax);
    const pad = Math.max(absVal * 0.05, 50);
    const low = rawMin >= 0 ? Math.max(0, rawMin - pad) : rawMin - pad;
    const high = rawMax + pad;
    const step = selectNiceTickInterval(high - low, targetTickCount);
    const niceMin = rawMin >= 0 ? Math.max(0, Math.floor(low / step) * step) : Math.floor(low / step) * step;
    let niceMax = Math.ceil(high / step) * step;
    if (niceMax <= niceMin) niceMax = niceMin + step;
    return {
      domain: [roundClean(niceMin), roundClean(niceMax)],
      ticks: buildTickSeries(niceMin, niceMax, step),
      step,
    };
  }

  // Only anchor to 0 when the series actually starts near 0 relative to its peak span
  const effectiveMin = !isCumulative && rawMin >= 0 && (rawMin === 0 || (rawMax - rawMin) / Math.max(rawMax, 1) >= 0.85)
    ? 0
    : (!isCumulative && rawMin > 0
      ? Math.max(0, rawMin - Math.max((rawMax - rawMin) * 0.04, 1))
      : rawMin);
  const effectiveMax = !isCumulative && rawMin > 0
    ? rawMax + Math.max((rawMax - rawMin) * 0.04, 1)
    : rawMax;

  const effectiveSpan = Math.max(effectiveMax - effectiveMin, 1);
  const candidateSteps = collectCandidateSteps(effectiveSpan);
  const scored = [];

  for (const step of candidateSteps) {
    let niceMin = Math.floor(effectiveMin / step) * step;
    if (!isCumulative && rawMin >= 0) {
      niceMin = Math.max(0, niceMin);
    }
    let niceMax = Math.ceil(effectiveMax / step) * step;
    if (niceMax <= niceMin) niceMax = niceMin + step;

    const tickCount = Math.round((niceMax - niceMin) / step) + 1;
    if (tickCount < 3 || tickCount > maxTickCount) continue;

    const rangeSpan = Math.max(niceMax - niceMin, 1);
    const fillRatio = clamp(effectiveSpan / rangeSpan, 0, 1);
    const zeroAligned = niceMin <= 0 && niceMax >= 0
      ? Math.abs(Math.round((0 - niceMin) / step) * step + niceMin) < 1e-6
      : true;
    if (isCumulative && !zeroAligned) continue;

    scored.push({
      step,
      niceMin: roundClean(niceMin),
      niceMax: roundClean(niceMax),
      tickCount,
      fillRatio,
      prefersStandardTickCount: tickCount >= 4 ? 1 : 0,
      countDistance: Math.abs(tickCount - targetTickCount),
    });
  }

  scored.sort((a, b) => (
    b.prefersStandardTickCount - a.prefersStandardTickCount
    || Math.round(b.fillRatio * 20) - Math.round(a.fillRatio * 20)
    || a.countDistance - b.countDistance
    || b.fillRatio - a.fillRatio
  ));

  const best = scored[0];
  if (best) {
    if (!isCumulative && rawMin < 0 && rawMax > 0 && Math.abs(rawMin) <= best.step * 0.15) {
      const floorDomain = roundClean(Math.min(rawMin * 1.15, -best.step * 0.06));
      return {
        domain: [floorDomain, best.niceMax],
        ticks: buildTickSeries(0, best.niceMax, best.step),
        step: best.step,
      };
    }
    return {
      domain: [best.niceMin, best.niceMax],
      ticks: buildTickSeries(best.niceMin, best.niceMax, best.step),
      step: best.step,
    };
  }

  const fallbackStep = selectNiceTickInterval(effectiveSpan, targetTickCount);
  const fallbackMin = Math.floor(effectiveMin / fallbackStep) * fallbackStep;
  const fallbackMax = Math.ceil(effectiveMax / fallbackStep) * fallbackStep;
  return {
    domain: [roundClean(fallbackMin), roundClean(fallbackMax)],
    ticks: buildTickSeries(fallbackMin, fallbackMax, fallbackStep),
    step: fallbackStep,
  };
};

export const generateYAxisTicks = (points = [], options = {}) => (
  calculateYAxisDomain(points, options).ticks
);

export const formatAxisCurrency = (value, currency = 'USD', { step = null } = {}) => {
  const num = roundClean(Number(value || 0));
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  const sym = getCurrencySymbol(currency).trim();
  const prefix = /[A-Za-z]$/.test(sym) ? `${sym} ` : sym;

  if (abs === 0) return `${prefix}0`;
  if (abs >= 1_000_000_000) {
    return `${sign}${prefix}${Number((abs / 1_000_000_000).toFixed(2))}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${prefix}${Number((abs / 1_000_000).toFixed(2))}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${prefix}${Number((abs / 1_000).toFixed(2))}k`;
  }
  return `${sign}${prefix}${abs.toLocaleString('en-US', {
    maximumFractionDigits: step && step < 1 ? 2 : 0,
  })}`;
};

const inspectDateSeries = (points = [], timeZone) => {
  const validDates = (points || [])
    .map((p) => new Date(p?.date))
    .filter((d) => !Number.isNaN(d.getTime()));

  if (!validDates.length) {
    return { spanDays: 0, spansMultipleYears: false, distinctMonths: 0, spansCrossDay: false };
  }

  const times = validDates.map((d) => d.getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const spanDays = (maxTime - minTime) / 86_400_000;

  const yearFmt = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  });
  const monthFmt = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  });
  const dayFmt = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });

  const years = new Set(validDates.map((d) => yearFmt.format(d)));
  const months = new Set(validDates.map((d) => monthFmt.format(d)));
  const days = new Set(validDates.map((d) => dayFmt.format(d)));

  return {
    spanDays,
    spansMultipleYears: years.size > 1,
    distinctMonths: months.size,
    spansCrossDay: days.size > 1,
  };
};

const stripTickSuffix = (value) => String(value ?? '').replace(/__\d+$/, '');

export const formatAxisDate = (value, {
  activeRange = 'all',
  spanDays = 0,
  spansMultipleYears = false,
  distinctMonths = 0,
  timeZone,
} = {}) => {
  const rawValue = stripTickSuffix(value);
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return 'Start';

  const tzOpt = timeZone ? { timeZone } : {};

  if (activeRange === '7d') {
    if (spanDays < 6.8) {
      return new Intl.DateTimeFormat('en-US', { weekday: 'short', ...tzOpt }).format(date);
    }
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...tzOpt }).format(date);
  }

  if (activeRange === 'thisYear') {
    if (distinctMonths >= 3 && spanDays >= 45) {
      return new Intl.DateTimeFormat('en-US', { month: 'short', ...tzOpt }).format(date);
    }
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...tzOpt }).format(date);
  }

  if (activeRange === '30d' || activeRange === '90d' || activeRange === 'thisMonth' || activeRange === 'lastMonth') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      ...(spansMultipleYears ? { year: '2-digit' } : {}),
      ...tzOpt,
    }).format(date);
  }

  if (spansMultipleYears) {
    if (spanDays > 540) {
      return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', ...tzOpt }).format(date);
    }
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: '2-digit', ...tzOpt }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...tzOpt }).format(date);
};

export const generateXAxisTicks = (points = [], {
  activeRange = 'all',
  isMobile = false,
  containerWidth = 0,
  timeZone,
} = {}) => {
  const meta = inspectDateSeries(points, timeZone);
  const maxTicks = containerWidth > 0
    ? (containerWidth < 360 ? 4 : containerWidth < 540 ? 5 : containerWidth < 900 ? 6 : 7)
    : (isMobile ? 4 : 6);

  const items = (points || [])
    .filter((point) => point?.date || point?.xKey)
    .map((point) => {
      const key = point.xKey || point.date;
      const rawDate = point.date || stripTickSuffix(point.xKey);
      return {
        key,
        label: formatAxisDate(rawDate, { activeRange, ...meta, timeZone }),
      };
    });

  if (!items.length) {
    return { ticks: [], meta };
  }

  const lastIndex = items.length - 1;
  const sampledIndices = items.length <= maxTicks
    ? items.map((_, i) => i)
    : Array.from({ length: maxTicks }, (_, i) => Math.round((i / (maxTicks - 1)) * lastIndex));

  const chosen = [];
  sampledIndices.forEach((idx) => {
    const item = items[idx];
    const existingIdx = chosen.findIndex((entry) => entry.label === item.label);
    if (existingIdx < 0) {
      chosen.push({ idx, key: item.key, label: item.label });
    } else if (idx === lastIndex && chosen[existingIdx].idx > 0) {
      chosen.splice(existingIdx, 1);
      chosen.push({ idx, key: item.key, label: item.label });
    }
  });

  // If tail clustering left fewer distinct labels than maxTicks, fill largest visual index gaps
  if (chosen.length < maxTicks) {
    const distinctFirsts = [];
    const seen = new Set();
    items.forEach((item, idx) => {
      if (!seen.has(item.label)) {
        seen.add(item.label);
        distinctFirsts.push({ idx, key: item.key, label: item.label });
      }
    });

    if (chosen.length < Math.min(maxTicks, distinctFirsts.length)) {
      const usedLabels = new Set(chosen.map((c) => c.label));
      const minSpacing = Math.max(1, Math.floor(items.length / (maxTicks * 1.4)));
      for (const candidate of distinctFirsts) {
        if (chosen.length >= maxTicks) break;
        if (usedLabels.has(candidate.label)) continue;
        const tooClose = chosen.some((c) => Math.abs(c.idx - candidate.idx) < minSpacing);
        if (!tooClose) {
          chosen.push(candidate);
          usedLabels.add(candidate.label);
        }
      }
      chosen.sort((a, b) => a.idx - b.idx);
    }
  }

  return { ticks: chosen.map((c) => c.key), meta };
};

export const prepareAccountBalanceDisplayPoints = (points = []) => {
  const safePoints = Array.isArray(points) ? points.filter(Boolean) : [];
  if (!safePoints.length) return [];

  const firstPoint = safePoints[0];
  if (firstPoint.eventType === 'period_start' && Number(firstPoint.value || 0) !== 0) {
    return safePoints;
  }

  const firstDepositIndex = safePoints.findIndex(
    (point) => point?.eventType === 'opening_balance'
      || (point?.eventType === 'deposit' && Number(point?.change ?? point?.value ?? 0) > 0),
  );
  if (firstDepositIndex < 0) return safePoints;

  const firstDepositPoint = safePoints[firstDepositIndex];
  const firstDepositAmount = Number(firstDepositPoint?.change ?? firstDepositPoint?.value ?? 0);

  if (firstDepositIndex > 0) {
    const leadIn = safePoints.slice(0, firstDepositIndex);
    const leadInValues = leadIn.map((p) => Number(p?.value ?? 0)).filter(Number.isFinite);
    const leadInMax = leadInValues.length ? Math.max(...leadInValues) : 0;
    const startsUnfunded = Number(firstPoint?.value || 0) === 0
      && leadInMax <= Math.max(0, firstDepositAmount * 0.15)
      && !leadIn.some((p) => p?.eventType === 'deposit' || p?.eventType === 'opening_balance');
    if (!startsUnfunded) return safePoints;
  }

  const firstDepositTime = new Date(firstDepositPoint.date).getTime();
  let startIndex = firstDepositIndex;
  let combinedInitialFunding = Number(firstDepositPoint.change ?? firstDepositPoint.value ?? 0);

  if (Number.isFinite(firstDepositTime)) {
    for (let i = firstDepositIndex + 1; i < safePoints.length; i += 1) {
      const candidate = safePoints[i];
      const candidateTime = new Date(candidate?.date).getTime();
      if (candidateTime !== firstDepositTime) break;
      const isSameMomentInit = (candidate?.eventType === 'opening_balance')
        || (candidate?.eventType === 'deposit' && candidate?.source === 'startingBalance')
        || (candidate?.eventType === 'account_start' && Number(candidate?.change || 0) === 0);
      if (!isSameMomentInit) break;
      startIndex = i;
      combinedInitialFunding += Number(candidate?.change || 0);
    }
  }

  const sliced = safePoints.slice(startIndex);
  const basePoint = sliced[0];
  const initialPoint = {
    ...basePoint,
    isInitialFundingStart: true,
    initialFundingAmount: roundClean(combinedInitialFunding || Number(basePoint.change ?? basePoint.value ?? 0)),
    label: basePoint.eventType === 'opening_balance'
      ? 'Opening balance'
      : (basePoint.source === 'startingBalance' ? 'Initial funding' : (basePoint.label || 'Initial deposit')),
  };

  if (sliced.length === 1) {
    return [
      initialPoint,
      {
        date: initialPoint.date,
        value: initialPoint.value,
        change: 0,
        eventType: 'period_end',
        label: 'Current balance',
        accountId: initialPoint.accountId,
        accountName: initialPoint.accountName,
      },
    ];
  }

  return [initialPoint, ...sliced.slice(1)];
};

export const detectInitialDepositJump = (points = []) => {
  const safePoints = Array.isArray(points) ? points : [];
  if (safePoints.length < 2) {
    return {
      hasInitialFundingStart: Boolean(safePoints[0]?.isInitialFundingStart),
      initialFundingPoint: safePoints[0]?.isInitialFundingStart ? safePoints[0] : null,
      hasInitialDepositJump: false,
      initialDepositPoint: safePoints[0]?.isInitialFundingStart ? safePoints[0] : null,
      initialDepositIndex: safePoints[0]?.isInitialFundingStart ? 0 : -1,
      postDepositMin: null,
      postDepositMax: null,
      balanceMin: null,
      balanceMax: null,
      fundingPoints: [],
    };
  }

  const fundingPoints = safePoints.filter(
    (point) => (
      point?.eventType === 'opening_balance'
      || point?.eventType === 'deposit'
      || point?.eventType === 'withdrawal'
      || point?.eventType === 'payout'
      || point?.eventType === 'fee'
      || point?.eventType === 'balance_adjustment'
    ),
  );

  if (safePoints[0]?.isInitialFundingStart) {
    const allValues = safePoints.map((p) => Number(p?.value)).filter(Number.isFinite);
    const balanceMin = allValues.length ? Math.min(...allValues) : null;
    const balanceMax = allValues.length ? Math.max(...allValues) : null;
    return {
      hasInitialFundingStart: true,
      initialFundingPoint: safePoints[0],
      hasInitialDepositJump: false,
      initialDepositPoint: safePoints[0],
      initialDepositIndex: 0,
      postDepositMin: balanceMin,
      postDepositMax: balanceMax,
      balanceMin,
      balanceMax,
      fundingPoints,
    };
  }

  let initialDepositIndex = safePoints.findIndex(
    (point) => point?.eventType === 'opening_balance'
      || (point?.eventType === 'deposit' && point?.source === 'startingBalance'),
  );
  if (initialDepositIndex < 0) {
    initialDepositIndex = safePoints.findIndex((point) => point?.eventType === 'deposit');
  }

  if (initialDepositIndex < 0) {
    return {
      hasInitialFundingStart: false,
      initialFundingPoint: null,
      hasInitialDepositJump: false,
      initialDepositPoint: null,
      initialDepositIndex: -1,
      postDepositMin: null,
      postDepositMax: null,
      balanceMin: null,
      balanceMax: null,
      fundingPoints,
    };
  }

  const initialDepositPoint = safePoints[initialDepositIndex];
  const prevBalance = initialDepositIndex > 0 ? Number(safePoints[initialDepositIndex - 1]?.value || 0) : 0;
  const depositAmount = Number(initialDepositPoint?.change || initialDepositPoint?.value || 0);
  const allValues = safePoints.map((p) => Number(p?.value)).filter(Number.isFinite);
  const totalSpan = Math.max(Math.max(...allValues) - Math.min(...allValues), 1);

  const postDepositValues = safePoints
    .slice(initialDepositIndex)
    .map((p) => Number(p?.value))
    .filter(Number.isFinite);
  const postDepositMin = postDepositValues.length ? Math.min(...postDepositValues) : null;
  const postDepositMax = postDepositValues.length ? Math.max(...postDepositValues) : null;

  const hasInitialDepositJump = safePoints.length > initialDepositIndex + 1
    && depositAmount > 0
    && (prevBalance <= 0 || prevBalance <= depositAmount * 0.15)
    && depositAmount / totalSpan >= 0.5;

  return {
    hasInitialFundingStart: false,
    initialFundingPoint: null,
    hasInitialDepositJump,
    initialDepositPoint,
    initialDepositIndex,
    postDepositMin,
    postDepositMax,
    balanceMin: postDepositMin,
    balanceMax: postDepositMax,
    fundingPoints,
  };
};
