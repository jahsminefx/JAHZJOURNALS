const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getStrategies = async (req, res) => {
  try {
    const strategies = await prisma.strategy.findMany({
      where: { userId: req.user.id, isArchived: false },
      include: {
        setups: {
          where: { isArchived: false },
          include: { checklistItems: true },
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(strategies);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching strategies', error: error.message });
  }
};

const getStrategyById = async (req, res) => {
  try {
    const strategy = await prisma.strategy.findUnique({
      where: { id: req.params.id },
      include: {
        setups: {
          where: { isArchived: false },
          include: { checklistItems: true },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });
    if (!strategy || strategy.userId !== req.user.id) {
      return res.status(404).json({ message: 'Strategy not found' });
    }
    res.json(strategy);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching strategy', error: error.message });
  }
};

const createStrategy = async (req, res) => {
  try {
    const { name, description, style, market, defaultRiskPercent } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const strategy = await prisma.strategy.create({
      data: {
        userId: req.user.id,
        name,
        description,
        style,
        market,
        defaultRiskPercent: parseFloat(defaultRiskPercent) || null,
      }
    });
    res.status(201).json(strategy);
  } catch (error) {
    res.status(500).json({ message: 'Error creating strategy', error: error.message });
  }
};

const updateStrategy = async (req, res) => {
  try {
    const { name, description, style, market, defaultRiskPercent, isActive, isArchived } = req.body;
    
    const existing = await prisma.strategy.findUnique({ where: { id: req.params.id }});
    if (!existing || existing.userId !== req.user.id) {
       return res.status(404).json({ message: 'Not found' });
    }

    const parsedRisk = defaultRiskPercent !== undefined
      ? (parseFloat(defaultRiskPercent) || null)
      : undefined;

    const strategy = await prisma.strategy.update({
      where: { id: req.params.id },
      data: { name, description, style, market, defaultRiskPercent: parsedRisk, isActive, isArchived }
    });
    res.json(strategy);
  } catch (error) {
    res.status(500).json({ message: 'Error updating strategy', error: error.message });
  }
};

const deleteStrategy = async (req, res) => {
  try {
    const existing = await prisma.strategy.findUnique({ where: { id: req.params.id }});
    if (!existing || existing.userId !== req.user.id) return res.status(404).json({ message: 'Not found' });

    // Try hard delete, if constraints fail (e.g. trades exist without cascade), soft delete
    try {
      await prisma.strategy.delete({ where: { id: req.params.id } });
    } catch(err) {
      // Soft delete fallback since trades depend on it via setnull, but we want it archived instead to keep the history valid
      await prisma.strategy.update({
        where: { id: req.params.id },
        data: { isArchived: true, isActive: false }
      });
    }

    res.json({ message: 'Strategy removed' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting strategy', error: error.message });
  }
};

module.exports = {
  getStrategies,
  getStrategyById,
  createStrategy,
  updateStrategy,
  deleteStrategy
};
