const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const configuredClientOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedClientOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...configuredClientOrigins,
]);
const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Middleware
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedClientOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'JahzJournals API is running' });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/accounts', require('./routes/tradingAccountRoutes'));
app.use('/api/prop-firm-phases', require('./routes/propFirmPhaseRoutes'));
app.use('/api/trades', require('./routes/tradeRoutes'));
app.use('/api', require('./routes/miscRoutes'));

// Error handlers
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
