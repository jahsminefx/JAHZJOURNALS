const { evaluateTradeAgainstRules } = require('../services/ruleCheckService');

const preTradeCheck = async (req, res) => {
  try {
    const tradeData = req.body;
    const evaluation = await evaluateTradeAgainstRules(req.user.id, tradeData);
    res.json(evaluation);
  } catch (error) {
    console.error('Pre-trade Check error:', error);
    res.status(500).json({ message: 'Unable to evaluate trade rules.' });
  }
};

module.exports = {
  preTradeCheck
};
