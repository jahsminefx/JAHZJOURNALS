const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  if (err.statusCode) statusCode = err.statusCode;
  if (err.code === 'LIMIT_FILE_SIZE') statusCode = 400;
  let message = statusCode >= 500 ? 'Internal server error' : err.message;
  if (err.code === 'LIMIT_FILE_SIZE') message = 'Uploaded image is too large';

  res.status(statusCode).json({
    success: false,
    message,
    errors: [],
  });
};

module.exports = { notFound, errorHandler };
