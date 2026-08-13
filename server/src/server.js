const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { globalApiLimiter } = require('./middleware/rateLimitMiddleware');
const dotenv = require('dotenv');
const path = require('path');
const { startSchedulers } = require('./cron/scheduler');

dotenv.config();

const { validateProductionEnv } = require('./config/envValidator');
validateProductionEnv();

const app = express();
const PORT = process.env.PORT || 5000;
const configuredClientOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedClientOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://jahzjournal.com',
  'https://www.jahzjournal.com',
  'http://jahzjournal.com',
  'http://www.jahzjournal.com',
  'http://169.58.9.55',
  'https://169.58.9.55',
  'http://jahzjournals.vmi3432347.contaboserver.net',
  'https://jahzjournals.vmi3432347.contaboserver.net',
  ...configuredClientOrigins,
]);
const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Middleware
app.set('trust proxy', true);
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedClientOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true
}));
const logger = require('./utils/logger');

// Structured request logging
const morganFormat = process.env.NODE_ENV === 'production' 
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms'
  : 'dev';

app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.info('HTTP Request', { request: message.trim() })
  }
}));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use((req, res, next) => {
  if (!unsafeMethods.has(req.method)) {
    next();
    return;
  }

  const origin = req.get('origin');
  const referer = req.get('referer');
  let refererOrigin = null;
  try {
    refererOrigin = referer ? new URL(referer).origin : null;
  } catch (error) {
    return res.status(403).json({ message: 'Request origin is not allowed' });
  }

  if ((origin && !allowedClientOrigins.has(origin)) || (!origin && refererOrigin && !allowedClientOrigins.has(refererOrigin))) {
    return res.status(403).json({ message: 'Request origin is not allowed' });
  }

  next();
});

app.use('/api', globalApiLimiter);
const { maintenanceMiddleware } = require('./middleware/maintenanceMiddleware');
app.use('/api', maintenanceMiddleware);

// Routes
const { getHealthStatus } = require('./controllers/healthController');
app.get('/api/health', getHealthStatus);

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/users/settings', require('./routes/settingsRoutes'));
app.use('/api/accounts', require('./routes/tradingAccountRoutes'));
app.use('/api/prop-firm-phases', require('./routes/propFirmPhaseRoutes'));
app.use('/api/trades', require('./routes/tradeRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/mentors', require('./routes/mentorRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));
app.use('/api/promotions', require('./routes/traderPromotionRoutes'));
app.use('/api/strategies', require('./routes/strategyRoutes'));
app.use('/api/setups', require('./routes/setupRoutes'));
app.use('/api/notifications', require('./routes/userNotificationRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api', require('./routes/miscRoutes'));

// Serve built Vite React frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.resolve(__dirname, '../../client/dist');

  // Explicit static file routes with no-cache to ensure immediate updates
  app.get('/ads.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(clientBuildPath, 'ads.txt'));
  });

  app.get('/robots.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(clientBuildPath, 'robots.txt'));
  });

  app.get('/sitemap.xml', (req, res) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(clientBuildPath, 'sitemap.xml'));
  });

  // Serve hashed static assets with long cache lifetimes (1 year)
  app.use(express.static(clientBuildPath, {
    maxAge: '1y',
    immutable: true,
    index: false,
  }));

  // React Router catch-all route for client-side routing
  app.get('{*path}', (req, res, next) => {
    if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads')) {
      return next();
    }

    res.sendFile(path.join(clientBuildPath, 'index.html'), {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  });
}

// Error handlers
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
app.use(notFound);
app.use(errorHandler);

startSchedulers();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
