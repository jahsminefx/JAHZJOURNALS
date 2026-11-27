import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  calculateYAxisDomain,
  detectInitialDepositJump,
  prepareAccountBalanceDisplayPoints,
} from '../src/utils/chartAxis.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Account Transactions UI avoids native dialogs/selects and wires required flows', async () => {
  const [
    modalSrc,
    panelSrc,
    detailSrc,
    listSrc,
    formSrc,
    payoutLedgerSrc,
    dashSrc,
    dashFiltersSrc,
    equityChartSrc,
    dailySrc,
    weeklySrc,
    pdfSrc,
  ] = await Promise.all([
    read('../src/components/accounts/RecordTransactionModal.jsx'),
    read('../src/components/accounts/AccountTransactionsPanel.jsx'),
    read('../src/pages/AccountDetail.jsx'),
    read('../src/pages/AccountsList.jsx'),
    read('../src/components/accounts/RegularAccountForm.jsx'),
    read('../src/components/propfirm/PropFirmPayoutLedger.jsx'),
    read('../src/pages/Dashboard.jsx'),
    read('../src/components/dashboard/DashboardFilters.jsx'),
    read('../src/components/dashboard/EquityCurveChart.jsx'),
    read('../src/pages/DailyReviewPage.jsx'),
    read('../src/pages/WeeklyReview.jsx'),
    read('../src/utils/pdfReportService.js'),
  ]);

  // No browser-native select or confirm/alert/prompt in new Account Transaction & Payout modals
  for (const src of [modalSrc, panelSrc, payoutLedgerSrc]) {
    assert.equal(src.includes('<select'), false, 'Must use CustomSelect instead of native <select>');
    assert.equal(/\bwindow\.(alert|confirm|prompt)\b/.test(src), false, 'Must use branded dialog instead of window dialogs');
    assert.match(src, /CustomSelect/);
  }

  assert.match(modalSrc, /dialog\.confirm/);
  assert.match(modalSrc, /Increase balance \(\+\)/);
  assert.match(modalSrc, /Decrease balance/);
  assert.match(modalSrc, /X-Idempotency-Key/);
  assert.match(modalSrc, /Trading P&amp;L stays unchanged/);
  assert.equal(modalSrc.includes('accounts = []'), false, 'Must use stable EMPTY_ACCOUNTS default to prevent modal state resets');
  assert.match(modalSrc, /initializedSessionRef/);

  assert.match(panelSrc, /dialog\.confirm/);
  assert.match(panelSrc, /Resulting Balance/);
  assert.match(panelSrc, /Archive/);
  assert.match(panelSrc, /Edit/);
  assert.match(panelSrc, /MT Sync · Read-only/);
  assert.match(panelSrc, /confirm-payout/);
  assert.match(panelSrc, /Mark as Payout/);
  assert.match(panelSrc, /Record transaction/);
  assert.match(panelSrc, /fixedAccount=\{account\}/);

  assert.match(detailSrc, /AccountTransactionsPanel/);
  assert.match(detailSrc, /Record transaction/);
  assert.match(detailSrc, /whitespace-nowrap/);
  assert.match(listSrc, /RecordTransactionModal/);
  assert.match(listSrc, /Record transaction/);
  assert.match(listSrc, /fixedAccount=\{txModalAccount\}/);
  assert.equal(listSrc.includes('setTxModalAccount(null);\n                setIsTxModalOpen(true)'), false, 'AccountsList should only launch transaction modal for a specific account');
  assert.match(formSrc, /Direct balance overwrites are disabled/);

  assert.equal(dashSrc.includes('RecordTransactionModal'), false, 'Dashboard is strictly view-only and must not render transaction modal');
  assert.equal(dashSrc.includes('Record transaction'), false, 'Dashboard must not show Record transaction button');
  assert.equal(dashSrc.includes('Add cash flow'), false, 'Dashboard must remain view-only without Add cash flow button');
  assert.match(dashSrc, /View ledger/);
  assert.equal(dashFiltersSrc.includes('Record transaction'), false, 'DashboardFilters must not show Record transaction button');
  assert.equal(dashFiltersSrc.includes('Add cash flow'), false, 'DashboardFilters must remain filters-only');
  assert.match(dashSrc, /Cash Flow &amp; Net Account Change/);
  assert.match(equityChartSrc, /opening_balance/);
  assert.match(equityChartSrc, /payout/);
  assert.match(equityChartSrc, /fee/);
  assert.match(dailySrc, /Excluded from Trading P&amp;L/);
  assert.match(weeklySrc, /Excluded from Trading P&amp;L/);
  assert.match(pdfSrc, /ACCOUNT CASH FLOW SUMMARY/);
});

test('chartAxis recognizes explicit OPENING_BALANCE, PAYOUT, and FEE markers cleanly', () => {
  const rawSeries = [
    { date: '2026-11-01T00:00:00Z', value: 0, change: 0, eventType: 'account_start', label: 'Account created' },
    { date: '2026-11-01T00:00:00Z', value: 50000, change: 50000, eventType: 'opening_balance', label: 'Opening balance' },
    { date: '2026-11-05T10:00:00Z', value: 54000, change: 4000, eventType: 'trade_win', label: 'Closed trade', result: 'WIN' },
    { date: '2026-11-08T12:00:00Z', value: 51000, change: -3000, eventType: 'payout', label: 'Payout' },
    { date: '2026-11-09T12:00:00Z', value: 50975, change: -25, eventType: 'fee', label: 'Fee' },
  ];

  const prepared = prepareAccountBalanceDisplayPoints(rawSeries);
  assert.equal(prepared.length, 4);
  assert.equal(prepared[0].value, 50000);
  assert.equal(prepared[0].eventType, 'opening_balance');
  assert.equal(prepared[0].label, 'Opening balance');
  assert.equal(prepared[2].eventType, 'payout');
  assert.equal(prepared[3].eventType, 'fee');

  const jump = detectInitialDepositJump(prepared);
  assert.equal(jump.hasInitialFundingStart, true);
  assert.ok(jump.fundingPoints.some((p) => p.eventType === 'payout'));
  assert.ok(jump.fundingPoints.some((p) => p.eventType === 'fee'));

  const axis = calculateYAxisDomain(prepared, { mode: 'accountBalance' });
  assert.ok(axis.ticks[0] >= 48000, `Expected non-zero baseline ticks, got ${axis.ticks}`);
});
