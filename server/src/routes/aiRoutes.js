const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { generateTradeInsight } = require('../controllers/aiController');

router.post('/trade-insight/:tradeId', protect, generateTradeInsight);

module.exports = router;
