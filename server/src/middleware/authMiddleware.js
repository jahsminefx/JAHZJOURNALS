const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  return process.env.JWT_SECRET;
};

const protect = async (req, res, next) => {
  let token;

  token = req.cookies.jwt;

  // Header fallback
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      req.user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, email: true, role: true, isDisabled: true, tokenVersion: true }
      });

      if (!req.user || req.user.isDisabled) {
        return res.status(401).json({ message: 'We couldn\'t recognize your credentials.' });
      }

      // IMPERSONATION VECTOR (PHASE 9)
      if (decoded.isImpersonating) {
         req.user.isImpersonating = true;
         req.user.impersonatorId = decoded.impersonatorId;
      }

      if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== req.user.tokenVersion) {
        return res.status(401).json({ message: 'Your session has been invalidated from another device. Please log in again.' });
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Your secure session has expired. Please log in again.' });
    }
  } else {
    res.status(401).json({ message: 'Please log in to access this space.' });
  }
};

const optionalProtect = async (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = await prisma.user.findFirst({
      where: { id: decoded.userId, isDisabled: false },
      select: { id: true, name: true, email: true, role: true },
    });
  } catch (error) {
    req.user = null;
  }

  next();
};

module.exports = { protect, optionalProtect };
