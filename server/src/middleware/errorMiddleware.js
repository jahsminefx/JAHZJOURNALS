const logger = require('../utils/logger');

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  if (err.statusCode) statusCode = err.statusCode;
  if (err.code === 'LIMIT_FILE_SIZE') statusCode = 400;
  
  // Log the raw error securely server-side before scrubbing it for the client
  if (statusCode >= 500) {
    logger.error('Unhandled Application Exception', { 
      message: err.message, 
      stack: err.stack,
      route: req.originalUrl,
      method: req.method
    });
  }

  let message = statusCode >= 500 ? 'We hit an unexpected snag. Please try again.' : err.message;
  if (err.code === 'LIMIT_FILE_SIZE') message = 'This image is a bit too large for your journal.';

  res.status(statusCode).json({
    success: false,
    message,
    errors: [],
  });
};

module.exports = { notFound, errorHandler };
