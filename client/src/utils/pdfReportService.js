import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { formatCurrency } from './dashboard';

/**
 * JAHZJOURNALS PDF Report Generator Service
 * Creates production-quality, beautifully styled PDF reports for:
 * 1. Trader Performance Analytics
 * 2. Weekly Reviews
 * 3. Super Admin Business Intelligence
 */

const LOGO_MARK_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAADwElEQVRYR7WXX0hTYRzHv21O3VzO9Zqduf26s7nRlr0quuvFFpaZGXnnDNOjB4pOUO9I0yN056e3687p1vL0VqKQMj3+Rv+ef/5+cu8+IkP/sQHveb7vBtDukMCcDtzmCgACsAA8eQEQ3X/6/3kAmAigF4A0vBAA6PgJ6cHzPATASf2LIPaLEPSLf0/dBSrg38D4m1w7DxF4D+n2/buhh50vBui4v0ne/Y9ZsLBA5yyLpOn1ANy1lT+P3N+Py7ezy8tx16P3+1L4x39sRojOr3wzC8DtqP7b2jNAuT73lJ2FEwDhdQC8Fsdf5qHNT3axzdZWO93w9Da4L0P3Q2+sL8/Q0K5upP7Y9owtTcFCItYd3s3SWJgCw5anadSWLdbmxW7wAH7fL3jDT3jzLz/Qge9s3j3LlhQEwM8AZG8H+sQD0A1A/gOABMC4/kMAQD0GAC01CAAgvw829ZygW+KkzIDLg8gb731bmq2b1y8DlyVesG+77qItXg/s5r2Hj0QoY51o+Zet0y4W1kftB698d2uW99aVaoZ7d+C01y+w5YvD5zMA0Qc4t8VwL7pYl/u262u6eKWWg91/vG/wz9/3U0X68KWDWnRA4j2A6wLAdwDE3hD4fAA6AYj/A6C5AD6h/6N22z1D4y7p7P0/hB/x76Sj09Uf3rLgY2dmt0y23Zp56V4/w96x0S1u9+Q3dlybFwO6y6Pvu+Xy0o78zB2fD1DQA4ipmQegfRbg2lYjPn8n2bIuhxb2yNKSv2W+5IOPdc/ojM1omrU06wTgA0gfTR4ARACIQIS62drK+QAAoYIxr/nQBcgf0a4f5t886J2N158z+F1//aKvvvjTPvxCgC4A3wPQ62+0EIBzABr8+Qh38b+2eT12u0y2rN/h7FqW2aV53gE0BtR/tQnNv3m68819r5i7038166X03Fp+z713n66G169vS2a+1L8CgPEHkBAAs3v0t/b1lF0e/5Sdr6u189yX6/81aZ0H4m8Gfg/4tUcA4S80r8f1L92437s5K1wB2JbBw44n0TEtnhxE9b1k0CPhqF90kM8A+gQAw772Yv85r8yv5+769P41+W32z9z4a796o2l9pGk9h12P9hL3v2mH9152O8wz2G1+3vP3nly5Nn9+VlG6y5w9wLgSggAAL+d/wM/6d/o0EAAfAAAAAElFTkSuQmCC';

// Helper to draw standard JAHZJOURNALS PDF Header
const drawPdfHeader = (doc, title, subtitle, pageNum, totalPages) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Dark Header Bar
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Emerald Accent Bar
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.rect(0, 27, pageWidth, 1.5, 'F');

  // Embedded Brand Logo Icon
  try {
    doc.addImage(LOGO_MARK_BASE64, 'PNG', 14, 5, 16, 16);
  } catch (err) {
    console.warn('Could not render logo in PDF header:', err);
  }

  // Brand Logo Text: JAHZ (Red) JOURNALS (Green)
  const textX = 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);

  // "JAHZ" in Red (#EF4444)
  doc.setTextColor(239, 68, 68);
  doc.text('JAHZ', textX, 14);

  const jahzWidth = doc.getTextWidth('JAHZ');

  // "JOURNALS" in Emerald (#10B981)
  doc.setTextColor(16, 185, 129);
  doc.text('JOURNALS', textX + jahzWidth + 1, 14);

  // Document Title Subheader below logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(title.toUpperCase(), textX, 21);

  // Date & Page Numbers on Right
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(subtitle || new Date().toLocaleDateString(), pageWidth - 14, 14, { align: 'right' });
  if (pageNum && totalPages) {
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 14, 21, { align: 'right' });
  }
};

// Helper to draw standard JAHZJOURNALS PDF Footer
const drawPdfFooter = (doc) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setLineWidth(0.5);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Confidential — Generated for personal trading review on JAHZJOURNALS.COM', 14, pageHeight - 6);
  doc.text(`Generated: ${new Date().toUTCString()}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
};

/**
 * 1. GENERATE TRADER PERFORMANCE PDF REPORT
 */
export const generatePerformancePdfReport = async ({
  user,
  performance,
  equityMetrics,
  drawdown,
  filters = {},
  breakdownData = [],
  chartElementRef = null,
  currency = 'USD',
}) => {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header & Footer
    drawPdfHeader(doc, 'TRADER PERFORMANCE & ANALYTICS REPORT', `Trader: ${user?.name || 'Trader'} (${user?.subscriptionPlan || 'PRO'})`, 1, 1);
    drawPdfFooter(doc);

    let y = 36;

    // Report Information Card
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Report Period & Applied Filters`, 18, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);

    const filterTexts = [
      `Date Range: ${filters.startDate || 'All Time'} to ${filters.endDate || 'Present'}`,
      `Currency: ${currency} ${filters.accountId ? '(Native Account Currency)' : '(Reporting Currency: USD Normalized)'}`,
      `Pair: ${filters.pair || 'All Pairs'}`,
      `Strategy: ${filters.strategy || 'All Strategies'}`,
      `Setup: ${filters.setup || 'All Setups'}`
    ];
    doc.text(filterTexts.slice(0, 2).join('  |  '), 18, y + 12);
    doc.text(filterTexts.slice(2).join('  |  '), 18, y + 17);

    y += 28;

    // Executive Metrics KPI Grid
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('EXECUTIVE PERFORMANCE METRICS', 14, y);
    y += 4;

    const summaryStats = performance?.summary || {};
    const netPnlVal = summaryStats.netRealisedProfitLoss !== undefined
      ? Number(summaryStats.netRealisedProfitLoss)
      : Number(summaryStats.totalPnl || summaryStats.netPnl || 0);

    const maxDdVal = drawdown?.maximumDrawdown !== undefined
      ? Number(drawdown.maximumDrawdown)
      : Number(drawdown?.maxDrawdown || 0);

    const metrics = [
      { label: 'Total Trades', value: String(summaryStats.totalTrades || 0) },
      { label: 'Win Rate', value: `${Number(summaryStats.winRate || 0).toFixed(1)}%` },
      { label: 'Net P&L', value: formatCurrency(netPnlVal, currency, { signDisplay: netPnlVal === 0 ? 'auto' : 'always' }) },
      { label: 'Profit Factor', value: summaryStats.profitFactor === null ? 'N/A' : String(summaryStats.profitFactor || '0.00') },
      { label: 'Max Drawdown', value: formatCurrency(maxDdVal, currency) },
      { label: 'Expectancy', value: formatCurrency(Number(summaryStats.expectancy || 0), currency, { signDisplay: 'always' }) },
    ];

    const colWidth = (pageWidth - 28 - 10) / 3;
    const rowHeight = 14;

    metrics.forEach((m, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const xPos = 14 + col * (colWidth + 5);
      const yPos = y + row * (rowHeight + 4);

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(xPos, yPos, colWidth, rowHeight, 1.5, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(m.label.toUpperCase(), xPos + 4, yPos + 5);

      doc.setFontSize(10);
      if (m.label === 'Net P&L') {
        doc.setTextColor(netPnlVal >= 0 ? 16 : 225, netPnlVal >= 0 ? 185 : 29, netPnlVal >= 0 ? 129 : 72);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(m.value, xPos + 4, yPos + 11);
    });

    y += 2 * (rowHeight + 4) + 6;

    // Optional Chart Rendering
    if (chartElementRef && chartElementRef.current) {
      try {
        const canvas = await html2canvas(chartElementRef.current, { scale: 1.5 });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - 28;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (y + imgHeight < doc.internal.pageSize.getHeight() - 20) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text('EQUITY CURVE & PERFORMANCE VISUALIZATION', 14, y);
          y += 4;
          doc.addImage(imgData, 'PNG', 14, y, imgWidth, Math.min(imgHeight, 50));
          y += Math.min(imgHeight, 50) + 8;
        }
      } catch (chartErr) {
        console.warn('Could not capture chart image:', chartErr);
      }
    }

    // Breakdown Table
    if (breakdownData && breakdownData.length > 0) {
      if (y > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        drawPdfHeader(doc, 'TRADER PERFORMANCE BREAKDOWN', `Trader: ${user?.name || 'Trader'}`, 2, 2);
        drawPdfFooter(doc);
        y = 36;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('PERFORMANCE BREAKDOWN SUMMARY', 14, y);
      y += 6;

      // Table Header
      doc.setFillColor(30, 41, 59);
      doc.rect(14, y, pageWidth - 28, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text('GROUP / ASSET', 18, y + 5);
      doc.text('TRADES', 70, y + 5);
      doc.text('WIN RATE', 110, y + 5);
      doc.text('NET P&L', pageWidth - 18, y + 5, { align: 'right' });
      y += 7;

      // Table Rows
      breakdownData.slice(0, 15).forEach((item, index) => {
        if (y > doc.internal.pageSize.getHeight() - 20) return;

        doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
        doc.rect(14, y, pageWidth - 28, 6, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        const itemLabel = String(item.label || item.group || item.pair || item.key || 'Group');
        const itemTrades = String(item.totalTrades ?? item.trades ?? item.count ?? 0);
        doc.text(itemLabel, 18, y + 4.5);
        doc.text(itemTrades, 70, y + 4.5);
        doc.text(`${Number(item.winRate || 0).toFixed(1)}%`, 110, y + 4.5);

        const pnl = Number(item.netRealisedProfitLoss ?? item.pnl ?? item.netPnl ?? 0);
        doc.setTextColor(pnl >= 0 ? 16 : 225, pnl >= 0 ? 185 : 29, pnl >= 0 ? 129 : 72);
        doc.text(formatCurrency(pnl, currency, { signDisplay: pnl === 0 ? 'auto' : 'always' }), pageWidth - 18, y + 4.5, { align: 'right' });

        y += 6;
      });
    }

    const fileName = `JahzJournal_Performance_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    return true;
  } catch (err) {
    console.error('PDF Generation Error:', err);
    throw new Error('Failed to generate performance PDF report');
  }
};

/**
 * 2. GENERATE WEEKLY REVIEW PDF REPORT
 */
export const generateWeeklyPdfReport = async ({ user, weeklyData, aiCoaching, currency = 'USD' }) => {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const weeklyCurrency = weeklyData?.account?.currency || currency || 'USD';

    drawPdfHeader(doc, 'WEEKLY TRADING PERFORMANCE REVIEW', `Trader: ${user?.name || 'Trader'}`, 1, 1);
    drawPdfFooter(doc);

    let y = 36;

    // Header Summary Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, pageWidth - 28, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    const startDateStr = weeklyData?.weekStartDate ? new Date(weeklyData.weekStartDate).toLocaleDateString() : '';
    const endDateStr = weeklyData?.weekEndDate ? new Date(weeklyData.weekEndDate).toLocaleDateString() : '';
    doc.text(`Weekly Review Overview${startDateStr ? ` (${startDateStr} - ${endDateStr})` : ''}`, 18, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date Executed: ${new Date(weeklyData?.createdAt || Date.now()).toLocaleDateString()}  |  Account: ${weeklyData?.account?.name || 'All Accounts'} (${weeklyCurrency})`, 18, y + 14);

    y += 26;

    // Key Stats Cards (4 items: Weekly P&L, Trades, Win Rate, Discipline Score)
    const netPnlVal = weeklyData?.netProfitLoss !== undefined && weeklyData?.netProfitLoss !== null
      ? Number(weeklyData.netProfitLoss)
      : Number(weeklyData?.netPnl || 0);

    const stats = [
      { label: 'Weekly P&L', value: formatCurrency(netPnlVal, weeklyCurrency, { signDisplay: netPnlVal === 0 ? 'auto' : 'always' }), color: netPnlVal >= 0 ? [16, 185, 129] : [225, 29, 72] },
      { label: 'Trades Executed', value: String(weeklyData?.totalTrades || 0), color: [15, 23, 42] },
      { label: 'Win Rate', value: `${Number(weeklyData?.winRate || 0).toFixed(1)}%`, color: [15, 23, 42] },
      { label: 'Discipline Score', value: weeklyData?.disciplineScore !== undefined && weeklyData?.disciplineScore !== null ? `${weeklyData.disciplineScore}/100` : 'N/A', color: [245, 158, 11] }
    ];

    const colWidth = (pageWidth - 28 - 15) / 4;
    stats.forEach((s, i) => {
      const xPos = 14 + i * (colWidth + 5);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(xPos, y, colWidth, 14, 1.5, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(s.label.toUpperCase(), xPos + 4, y + 5);

      doc.setFontSize(9.5);
      doc.setTextColor(s.color[0], s.color[1], s.color[2]);
      doc.text(s.value, xPos + 4, y + 11);
    });

    y += 22;

    // Safely Parse AI Coaching Data
    let parsedAi = aiCoaching;
    if (!parsedAi && weeklyData?.aiSummary) {
      try {
        parsedAi = typeof weeklyData.aiSummary === 'string' ? JSON.parse(weeklyData.aiSummary) : weeklyData.aiSummary;
      } catch (e) {
        parsedAi = { weeklySummary: weeklyData.aiSummary };
      }
    }

    if (parsedAi && typeof parsedAi === 'object') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text('JAHZ AI WEEKLY COACHING & INSIGHTS', 14, y);
      y += 7;

      const aiSections = [
        { title: 'Weekly Execution Summary', text: parsedAi.weeklySummary || parsedAi.summary },
        { title: 'Key Strengths Identified', text: parsedAi.mainStrength || parsedAi.strengths },
        { title: 'Key Weaknesses & Areas to Watch', text: parsedAi.mainWeakness || parsedAi.weaknesses },
        { title: 'Actionable Next Steps', text: parsedAi.recommendedAction || parsedAi.actionPlan }
      ].filter(s => Boolean(s.text));

      if (aiSections.length > 0) {
        aiSections.forEach(sec => {
          if (y > pageHeight - 35) {
            doc.addPage();
            drawPdfHeader(doc, 'WEEKLY TRADING PERFORMANCE REVIEW', `Trader: ${user?.name || 'Trader'}`, 2, 2);
            drawPdfFooter(doc);
            y = 36;
          }

          // Section Title
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(124, 58, 237); // Purple 600
          doc.text(sec.title.toUpperCase(), 16, y);
          y += 5.5; // Clear separation baseline between title and body

          // Section Body Text with generous line-height
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);

          const lines = doc.splitTextToSize(String(sec.text), pageWidth - 36);
          lines.forEach((line, lineIdx) => {
            if (y > pageHeight - 20) {
              doc.addPage();
              drawPdfHeader(doc, 'WEEKLY TRADING PERFORMANCE REVIEW', `Trader: ${user?.name || 'Trader'}`, 2, 2);
              drawPdfFooter(doc);
              y = 36;
            }
            doc.text(line, 16, y);
            y += 4.5;
          });

          y += 5; // Spacing after section block
        });
      }
      y += 3;
    }

    // Trader Reflection Notes (if logged)
    const reflections = [
      { label: 'Main Mistake Logged', val: weeklyData?.mainMistake },
      { label: 'Personal Lesson Learned', val: weeklyData?.personalLesson },
      { label: "Next Week's Focus Area", val: weeklyData?.nextWeekFocus },
      { label: 'General Execution Reflection', val: weeklyData?.generalReflection }
    ].filter(r => Boolean(r.val && String(r.val).trim()));

    if (reflections.length > 0) {
      if (y > pageHeight - 40) {
        doc.addPage();
        drawPdfHeader(doc, 'WEEKLY TRADING PERFORMANCE REVIEW', `Trader: ${user?.name || 'Trader'}`, 2, 2);
        drawPdfFooter(doc);
        y = 36;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text('TRADER SELF-REFLECTIONS & NOTES', 14, y);
      y += 7;

      reflections.forEach(r => {
        if (y > pageHeight - 25) {
          doc.addPage();
          drawPdfHeader(doc, 'WEEKLY TRADING PERFORMANCE REVIEW', `Trader: ${user?.name || 'Trader'}`, 2, 2);
          drawPdfFooter(doc);
          y = 36;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(r.label.toUpperCase(), 16, y);
        y += 5.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);

        const lines = doc.splitTextToSize(String(r.val), pageWidth - 36);
        lines.forEach((line) => {
          if (y > pageHeight - 20) {
            doc.addPage();
            drawPdfHeader(doc, 'WEEKLY TRADING PERFORMANCE REVIEW', `Trader: ${user?.name || 'Trader'}`, 2, 2);
            drawPdfFooter(doc);
            y = 36;
          }
          doc.text(line, 16, y);
          y += 4.5;
        });

        y += 4;
      });
    }

    const fileName = `JahzJournal_Weekly_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    return true;
  } catch (err) {
    console.error('Weekly PDF Error:', err);
    throw new Error('Failed to generate weekly review PDF report');
  }
};

/**
 * 3. GENERATE SUPER ADMIN BUSINESS INTELLIGENCE PDF REPORT
 */
export const generateBusinessIntelligencePdfReport = async ({ user, execData, tradeData, aiData }) => {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    drawPdfHeader(doc, 'EXECUTIVE BUSINESS INTELLIGENCE REPORT', `Admin: ${user?.name || 'Super Admin'}`, 1, 1);
    drawPdfFooter(doc);

    let y = 36;

    // Executive Summary Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('PLATFORM HEALTH & METRICS OVERVIEW', 14, y);
    y += 6;

    const platformStats = [
      { label: 'Total Users', value: String(execData?.platformHealth?.totalUsers || 0) },
      { label: 'Active Founders', value: String(execData?.platformHealth?.activeFounders || 0) },
      { label: 'Total Trades Logged', value: String(execData?.productUsage?.totalTradesLogged || 0) },
      { label: 'AI Transmissions', value: String(execData?.productUsage?.totalAiRequests || 0) },
      { label: 'Monthly Revenue', value: String(execData?.revenue?.mrrText || '$0.00') },
      { label: 'Annualized Revenue', value: String(execData?.revenue?.arrText || '$0.00') }
    ];

    const colWidth = (pageWidth - 28 - 10) / 3;
    const rowHeight = 14;

    platformStats.forEach((m, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const xPos = 14 + col * (colWidth + 5);
      const yPos = y + row * (rowHeight + 4);

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(xPos, yPos, colWidth, rowHeight, 1.5, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(m.label.toUpperCase(), xPos + 4, yPos + 5);

      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(m.value, xPos + 4, yPos + 11);
    });

    y += 2 * (rowHeight + 4) + 10;

    // Live Platform Trade Intelligence Table
    if (tradeData?.recentTrades && tradeData.recentTrades.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('RECENT PLATFORM TRADES INSPECTION', 14, y);
      y += 6;

      doc.setFillColor(30, 41, 59);
      doc.rect(14, y, pageWidth - 28, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text('TRADER', 18, y + 5);
      doc.text('ACCOUNT', 75, y + 5);
      doc.text('PAIR', 125, y + 5);
      doc.text('RESULT', 155, y + 5);
      doc.text('P&L', pageWidth - 18, y + 5, { align: 'right' });
      y += 7;

      tradeData.recentTrades.slice(0, 15).forEach((t, idx) => {
        if (y > doc.internal.pageSize.getHeight() - 20) return;

        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(14, y, pageWidth - 28, 6, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(t.tradingAccount?.user?.name || 'Trader', 18, y + 4.5);
        doc.text(t.tradingAccount?.name || 'Account', 75, y + 4.5);
        doc.text(t.pair || '-', 125, y + 4.5);
        doc.text(t.result || 'OPEN', 155, y + 4.5);

        const pnl = Number(t.pnl || 0);
        doc.setTextColor(pnl >= 0 ? 16 : 225, pnl >= 0 ? 185 : 29, pnl >= 0 ? 129 : 72);
        doc.text(`${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, pageWidth - 18, y + 4.5, { align: 'right' });

        y += 6;
      });
    }

    const fileName = `JahzJournal_Business_Intelligence_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    return true;
  } catch (err) {
    console.error('BI PDF Error:', err);
    throw new Error('Failed to generate business intelligence PDF report');
  }
};
