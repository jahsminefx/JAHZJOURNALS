import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * JAHZJOURNALS PDF Report Generator Service
 * Creates production-quality, beautifully styled PDF reports for:
 * 1. Trader Performance Analytics
 * 2. Weekly Reviews
 * 3. Super Admin Business Intelligence
 */

// Helper to draw standard JAHZJOURNALS PDF Header
const drawPdfHeader = (doc, title, subtitle, pageNum, totalPages) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Dark Header Bar
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Green accent bar
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.rect(0, 27, pageWidth, 1.5, 'F');

  // Title Text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('JAHZJOURNALS', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(title.toUpperCase(), 14, 22);

  // Date & Page Numbers
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(subtitle || new Date().toLocaleDateString(), pageWidth - 14, 15, { align: 'right' });
  if (pageNum && totalPages) {
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 14, 22, { align: 'right' });
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
  chartElementRef = null
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
      `Pair: ${filters.pair || 'All Pairs'}`,
      `Session: ${filters.session || 'All Sessions'}`,
      `Strategy: ${filters.strategy || 'All Strategies'}`,
      `Setup: ${filters.setup || 'All Setups'}`
    ];
    doc.text(filterTexts.slice(0, 3).join('  |  '), 18, y + 12);
    doc.text(filterTexts.slice(3).join('  |  '), 18, y + 17);

    y += 28;

    // Executive Metrics KPI Grid
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('EXECUTIVE PERFORMANCE METRICS', 14, y);
    y += 4;

    const summaryStats = performance?.summary || {};
    const metrics = [
      { label: 'Total Trades', value: String(summaryStats.totalTrades || 0) },
      { label: 'Win Rate', value: `${Number(summaryStats.winRate || 0).toFixed(1)}%` },
      { label: 'Net P&L', value: `$${Number(summaryStats.totalPnl || 0).toFixed(2)}` },
      { label: 'Profit Factor', value: String(summaryStats.profitFactor || '0.00') },
      { label: 'Max Drawdown', value: `$${Number(drawdown?.maxDrawdown || 0).toFixed(2)}` },
      { label: 'Expectancy', value: `$${Number(summaryStats.expectancy || 0).toFixed(2)}` },
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
        doc.setTextColor(Number(summaryStats.totalPnl || 0) >= 0 ? 16 : 225, Number(summaryStats.totalPnl || 0) >= 0 ? 185 : 29, Number(summaryStats.totalPnl || 0) >= 0 ? 129 : 72);
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
        doc.text(String(item.group || item.pair || 'Group'), 18, y + 4.5);
        doc.text(String(item.trades || item.count || 0), 70, y + 4.5);
        doc.text(`${Number(item.winRate || 0).toFixed(1)}%`, 110, y + 4.5);

        const pnl = Number(item.pnl || item.netPnl || 0);
        doc.setTextColor(pnl >= 0 ? 16 : 225, pnl >= 0 ? 185 : 29, pnl >= 0 ? 129 : 72);
        doc.text(`${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, pageWidth - 18, y + 4.5, { align: 'right' });

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
export const generateWeeklyPdfReport = async ({ user, weeklyData, aiCoaching }) => {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

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
    doc.text(`Weekly Review Overview`, 18, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date Executed: ${new Date(weeklyData?.createdAt || Date.now()).toLocaleDateString()}`, 18, y + 14);

    y += 26;

    // Key Stats Cards
    const stats = [
      { label: 'Weekly P&L', value: `$${Number(weeklyData?.netPnl || 0).toFixed(2)}` },
      { label: 'Trades Executed', value: String(weeklyData?.totalTrades || 0) },
      { label: 'Win Rate', value: `${Number(weeklyData?.winRate || 0).toFixed(1)}%` },
    ];

    const colWidth = (pageWidth - 28 - 10) / 3;
    stats.forEach((s, i) => {
      const xPos = 14 + i * (colWidth + 5);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(xPos, y, colWidth, 14, 1.5, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(s.label.toUpperCase(), xPos + 4, y + 5);

      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(s.value, xPos + 4, y + 11);
    });

    y += 20;

    // AI Coaching Notes / Summary
    if (aiCoaching || weeklyData?.aiSummary) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('AI WEEKLY COACHING & INSIGHTS', 14, y);
      y += 5;

      doc.setFillColor(245, 243, 255); // Purple tint
      doc.setDrawColor(221, 214, 254);
      doc.roundedRect(14, y, pageWidth - 28, 30, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(76, 29, 149);
      const textLines = doc.splitTextToSize(aiCoaching?.summary || weeklyData?.aiSummary || 'Weekly execution insights generated by JAHZJOURNALS AI.', pageWidth - 36);
      doc.text(textLines.slice(0, 4), 18, y + 7);

      y += 36;
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
