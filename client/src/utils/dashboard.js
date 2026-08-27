export const DATE_RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'thisYear', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom date range' },
];

export const toDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDateRange = (range, now = new Date()) => {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);

  if (range === '7d') start.setDate(end.getDate() - 6);
  if (range === '30d') start.setDate(end.getDate() - 29);
  if (range === '90d') start.setDate(end.getDate() - 89);
  if (range === 'thisMonth') start.setDate(1);
  if (range === 'lastMonth') {
    start.setDate(1);
    start.setMonth(start.getMonth() - 1);
    const lastMonthEnd = new Date(start);
    lastMonthEnd.setMonth(start.getMonth() + 1, 0);
    lastMonthEnd.setHours(23, 59, 59, 999);
    return { startDate: toDateInput(start), endDate: toDateInput(lastMonthEnd) };
  }
  if (range === 'thisYear') {
    start.setMonth(0, 1);
  }
  if (range === 'all') {
    return { startDate: null, endDate: null };
  }

  start.setHours(0, 0, 0, 0);
  return { startDate: toDateInput(start), endDate: toDateInput(end) };
};

export const formatCurrency = (value, currency = 'USD', options = {}) => {
  const number = Number(value || 0);
  const safeCurrency = String(currency || 'USD').trim().toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: options.maximumFractionDigits ?? 2,
      signDisplay: options.signDisplay || 'auto',
    }).format(number);
  } catch (err) {
    const formattedNum = number.toLocaleString(undefined, {
      maximumFractionDigits: options.maximumFractionDigits ?? 2,
    });
    return `${formattedNum} ${safeCurrency}`;
  }
};

export const formatNumber = (value, maximumFractionDigits = 1) => Number(value || 0).toLocaleString(undefined, {
  maximumFractionDigits,
});

export const formatPercent = (value, maximumFractionDigits = 1) => `${formatNumber(value, maximumFractionDigits)}%`;

export const formatProfitFactor = (value) => (value === null || value === undefined ? '--' : formatNumber(value, 2));

export const formatDateLabel = (value) => {
  if (!value) return 'Start';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
};

export const enumLabel = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

export const getChangeLabel = (value, suffix = '') => {
  if (value === null || value === undefined) return 'No comparison';
  const number = Number(value || 0);
  const sign = number > 0 ? '+' : '';
  return `${sign}${formatNumber(number, suffix === '%' ? 1 : 2)}${suffix}`;
};
