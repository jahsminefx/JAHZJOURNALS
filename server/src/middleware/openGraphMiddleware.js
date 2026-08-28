const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CRAWLER_USER_AGENTS = /facebookexternalhit|twitterbot|whatsapp|telegrambot|linkedinbot|discordbot|slackbot|bingbot|googlebot/i;

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const handleSharedOpenGraphMeta = async (req, res, next) => {
  const userAgent = req.get('user-agent') || '';
  const isCrawler = CRAWLER_USER_AGENTS.test(userAgent);

  // If request is for shared trade
  if (req.path.startsWith('/shared/trade/')) {
    const shareToken = req.path.split('/shared/trade/')[1]?.split('/')[0];
    if (!shareToken) return next();

    try {
      const sharedTrade = await prisma.sharedTrade.findUnique({
        where: { shareToken },
        include: {
          trade: {
            include: {
              tradingAccount: { select: { currency: true } },
              screenshots: { select: { imageUrl: true }, take: 1 },
            },
          },
        },
      });

      if (!sharedTrade || !sharedTrade.isActive || !sharedTrade.trade) {
        return next();
      }

      const t = sharedTrade.trade;
      const title = escapeHtml(`${t.pair} ${t.direction} Trade Result — JAHZJOURNALS`);
      const pnlFormatted = `${t.profitLossAmount >= 0 ? '+' : ''}${t.tradingAccount?.currency === 'NGN' ? '₦' : t.tradingAccount?.currency === 'GBP' ? '£' : t.tradingAccount?.currency === 'EUR' ? '€' : '$'}${Math.abs(t.profitLossAmount).toLocaleString()} ${t.tradingAccount?.currency || 'USD'}`;
      const description = escapeHtml(`Result: ${t.result} | P/L: ${pnlFormatted} | Pips: ${t.pips || 0} | R:R: 1:${t.riskRewardRatio || 0}. Verified trade result tracked with JAHZJOURNALS.`);
      const image = (sharedTrade.includeScreenshot && t.screenshots[0]?.imageUrl)
        ? escapeHtml(t.screenshots[0].imageUrl)
        : `${req.protocol}://${req.get('host')}/assets/jahzjournals-social-banner.png`;

      if (isCrawler) {
        return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
</body>
</html>`);
      }
    } catch (err) {
      console.error('[OpenGraph Middleware Error]', err);
    }
  }

  // If request is for shared daily review
  if (req.path.startsWith('/shared/daily-review/')) {
    const shareToken = req.path.split('/shared/daily-review/')[1]?.split('/')[0];
    if (!shareToken) return next();

    try {
      const sharedReview = await prisma.sharedDailyReview.findUnique({
        where: { shareToken },
        include: { dailyReview: true },
      });

      if (!sharedReview || !sharedReview.isActive || !sharedReview.dailyReview) {
        return next();
      }

      const dr = sharedReview.dailyReview;
      const dateStr = dr.reviewDate ? dr.reviewDate.toISOString().split('T')[0] : 'Trading Day';
      const title = escapeHtml(`Daily Trading Review (${dateStr}) — JAHZJOURNALS`);
      const pnlFormatted = `${dr.netProfitLoss >= 0 ? '+' : ''}$${Math.abs(dr.netProfitLoss).toLocaleString()}`;
      const description = escapeHtml(`Daily Summary: ${dr.totalTrades} Trades | Win Rate: ${dr.winRate}% | Net P/L: ${pnlFormatted}. Verified performance report on JAHZJOURNALS.`);
      const image = `${req.protocol}://${req.get('host')}/assets/jahzjournals-social-banner.png`;

      if (isCrawler) {
        return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
</body>
</html>`);
      }
    } catch (err) {
      console.error('[OpenGraph Middleware Error]', err);
    }
  }

  next();
};

module.exports = { handleSharedOpenGraphMeta };
