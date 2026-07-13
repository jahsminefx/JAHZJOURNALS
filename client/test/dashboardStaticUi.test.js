import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('dashboard page fetches authenticated analytics with URL filters and stale-request cancellation', async () => {
  const [source, apiSource] = await Promise.all([
    read('../src/pages/Dashboard.jsx'),
    read('../src/utils/api.js'),
  ]);

  assert.match(source, /api\.get\('\/analytics\/dashboard'/);
  assert.match(source, /useSearchParams/);
  assert.match(source, /accountId/);
  assert.match(source, /startDate/);
  assert.match(source, /endDate/);
  assert.match(source, /AbortController/);
  assert.match(source, /signal:\s*controller\.signal/);
  assert.match(source, /return 'all'/);
  assert.match(source, /_refresh/);
  assert.match(source, /Cache-Control/);
  assert.match(source, /jahzjournal:data-changed/);
  assert.doesNotMatch(source, /previousPeriodComparison/);
  assert.match(source, /performanceCurve/);
  assert.match(source, /tradeOutcomes/);
  assert.match(source, /performanceBreakdown/);
  assert.match(source, /getProfitFactorDisplay/);
  assert.match(apiSource, /api\.interceptors\.response\.use/);
  assert.match(apiSource, /jahzjournal:data-version/);
});

test('dashboard page composes the premium analytics sections from reusable components', async () => {
  const source = await read('../src/pages/Dashboard.jsx');

  [
    'DashboardHeader',
    'MetricCard',
    'PerformanceCurveChart',
    'SessionEdgeChart',
    'TradingCalendar',
    'PerformanceBreakdown',
    'TopWinningPairs',
    'TradeOutcomeChart',
    'WeeklyGoalProgress',
    'RecentTrades',
    'UpgradeCard',
    'DisciplineBanner',
    'DashboardSkeleton',
    'DashboardEmptyState',
    'DashboardErrorState',
  ].forEach((component) => assert.match(source, new RegExp(component)));

  assert.match(source, /xl:grid-cols-12/);
  assert.match(source, /grid-cols-2/);
  assert.match(source, /md:grid-cols-3/);
  assert.match(source, /lg:grid-cols-5/);
});

test('dashboard charts, pair links, goals, and responsive states are wired in components', async () => {
  const [
    metricCard,
    equity,
    session,
    calendar,
    topPairs,
    outcomes,
    goals,
    recentTrades,
    sidebar,
  ] = await Promise.all([
    read('../src/components/dashboard/MetricCard.jsx'),
    read('../src/components/dashboard/EquityCurveChart.jsx'),
    read('../src/components/dashboard/SessionEdgeChart.jsx'),
    read('../src/components/dashboard/TradingCalendar.jsx'),
    read('../src/components/dashboard/TopWinningPairs.jsx'),
    read('../src/components/dashboard/TradeOutcomeChart.jsx'),
    read('../src/components/dashboard/WeeklyGoalProgress.jsx'),
    read('../src/components/dashboard/RecentTrades.jsx'),
    read('../src/components/Sidebar.jsx'),
  ]);

  assert.doesNotMatch(metricCard, /changeTone|changeClass/);
  assert.doesNotMatch(metricCard, /absolute bottom-0 right-1/);
  assert.match(metricCard, /border border-slate-400\/15/);
  assert.match(metricCard, /rounded-2xl/);
  assert.match(metricCard, /hover:-translate-y-0\.5/);
  assert.match(metricCard, /supportingText/);
  assert.match(metricCard, /statusTone/);
  assert.match(metricCard, /font-mono text-\[1\.65rem\]/);
  assert.match(equity, /AreaChart/);
  assert.match(equity, /Performance Curve/);
  assert.match(equity, /Cumulative P\/L/);
  assert.match(equity, /Account Balance/);
  assert.match(equity, /Track cumulative trading results without deposits affecting performance\./);
  assert.match(equity, /getCumulativeDomain/);
  assert.match(equity, /getBalanceDomain/);
  assert.match(equity, /curveType = isCumulative \? 'monotone' : 'stepAfter'/);
  assert.match(equity, /formatTimestamp/);
  assert.match(equity, /getRepeatedDateKeys/);
  assert.match(equity, /domain=\{yDomain\}/);
  assert.match(equity, /PerformanceTooltip/);
  assert.match(equity, /EventDot/);
  assert.match(equity, /ActiveEventDot/);
  assert.match(equity, /aria-pressed/);
  assert.match(equity, /dataKey="value"/);
  assert.match(equity, /trade_win/);
  assert.match(equity, /trade_loss/);
  assert.match(equity, /trade_breakeven/);
  assert.match(equity, /balance_adjustment/);
  assert.match(equity, /balanceAdjustments/);
  assert.match(equity, /Total deposits/);
  assert.match(equity, /Total withdrawals/);
  assert.match(equity, /Number\(summary\.totalWithdrawals \|\| 0\) > 0 \? 'text-amber-300' : 'text-slate-400'/);

  assert.match(equity, /Info/);
  assert.match(equity, /sm:h-80/);
  assert.doesNotMatch(equity, /Equity Curve/);
  assert.doesNotMatch(equity, /dataKey="equity"/);
  assert.match(session, /PieChart/);
  assert.match(session, /max-w-56/);
  assert.match(session, /2xl:grid-cols-\[auto_minmax\(0,1fr\)_auto\]/);
  assert.doesNotMatch(session, /sm:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
  assert.match(outcomes, /PieChart/);
  assert.match(outcomes, /max-w-52/);
  assert.doesNotMatch(outcomes, /sm:grid-cols-\[1fr_0\.85fr\]/);
  assert.match(calendar, /moveMonth/);
  assert.match(topPairs, /\/trades\?pair=/);
  assert.match(goals, /Set weekly goals to track your progress/);
  assert.match(goals, /\/settings\?section=trading/);
  assert.match(recentTrades, /\/trades\/\$\{trade\.id\}/);
  assert.match(recentTrades, /getTradeStateLabel/);
  assert.match(recentTrades, /trade\.status === 'CLOSED'/);
  assert.match(sidebar, /UpgradeCard/);
});

test('trades list accepts dashboard query filters for pair navigation', async () => {
  const [client, server] = await Promise.all([
    read('../src/pages/TradesList.jsx'),
    read('../../server/src/controllers/tradeController.js'),
  ]);

  assert.match(client, /useSearchParams/);
  assert.match(client, /api\.get\('\/trades',\s*{\s*params\s*}/);
  assert.match(server, /query\.pair/);
  assert.match(server, /query\.date/);
  assert.match(server, /tradingAccount:\s*{\s*userId\s*}/);
});

test('logged trades can be deleted from the list and detail views', async () => {
  const [list, detail, dialog, server] = await Promise.all([
    read('../src/pages/TradesList.jsx'),
    read('../src/pages/TradeDetail.jsx'),
    read('../src/components/trades/DeleteTradeDialog.jsx'),
    read('../../server/src/controllers/tradeController.js'),
  ]);

  assert.doesNotMatch(list, /window\.confirm/);
  assert.doesNotMatch(detail, /window\.confirm/);
  assert.match(list, /DeleteTradeDialog/);
  assert.match(list, /setTradePendingDelete\(trade\)/);
  assert.match(list, /api\.delete\(`\/trades\/\$\{trade\.id\}`\)/);
  assert.match(list, /setTrades\(\(current\) => current\.filter/);
  assert.match(detail, /DeleteTradeDialog/);
  assert.match(detail, /api\.delete\(`\/trades\/\$\{id\}`\)/);
  assert.match(detail, /navigate\('\/trades'\)/);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /Remove \{trade\.pair\}\?/);
  assert.match(dialog, /This will permanently remove this trade, along with its review, emotions, broken rules, and screenshots\./);
  assert.match(server, /await tx\.trade\.delete/);
});

test('settings page can load and save weekly dashboard goals', async () => {
  const source = await read('../src/pages/Settings.jsx');

  assert.match(source, /useSearchParams/);
  assert.match(source, /Weekly Dashboard Goals/);
  assert.match(source, /api\.get\('\/users\/trading-goals\/weekly'\)/);
  assert.match(source, /api\.put\('\/users\/trading-goals\/weekly'/);
  assert.match(source, /Goal account/);
  assert.match(source, /Maximum loss goal/);
});
