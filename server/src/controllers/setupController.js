const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createSetup = async (req, res) => {
  try {
    const { strategyId, name, description, preferredSession, minimumRR, maximumRisk, notes } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    // Ensure user owns the strategy
    const strategy = await prisma.strategy.findUnique({ where: { id: strategyId } });
    if (!strategy || strategy.userId !== req.user.id) {
       return res.status(403).json({ message: 'Unauthorized or strategy not found' });
    }

    const maxSort = await prisma.setup.aggregate({
      where: { strategyId },
      _max: { sortOrder: true }
    });
    
    const nextSort = (maxSort._max.sortOrder || 0) + 1;

    const setup = await prisma.setup.create({
      data: {
        strategyId,
        name,
        description,
        preferredSession,
        minimumRR: parseFloat(minimumRR) || null,
        maximumRisk: parseFloat(maximumRisk) || null,
        notes,
        sortOrder: nextSort
      },
      include: { checklistItems: true }
    });
    res.status(201).json(setup);
  } catch (error) {
    res.status(500).json({ message: 'Error creating setup', error: error.message });
  }
};

const updateSetup = async (req, res) => {
  try {
    const { name, description, preferredSession, minimumRR, maximumRisk, notes, isActive, isArchived, sortOrder } = req.body;
    
    const existing = await prisma.setup.findUnique({ 
      where: { id: req.params.id }, 
      include: { strategy: true } 
    });
    
    if (!existing || existing.strategy.userId !== req.user.id) {
       return res.status(404).json({ message: 'Not found' });
    }

    const payload = { name, description, preferredSession, notes, isActive, isArchived, sortOrder };
    if (minimumRR !== undefined) payload.minimumRR = minimumRR ? parseFloat(minimumRR) : null;
    if (maximumRisk !== undefined) payload.maximumRisk = maximumRisk ? parseFloat(maximumRisk) : null;

    const setup = await prisma.setup.update({
      where: { id: req.params.id },
      data: payload,
      include: { checklistItems: true }
    });
    res.json(setup);
  } catch (error) {
    res.status(500).json({ message: 'Error updating setup', error: error.message });
  }
};

const deleteSetup = async (req, res) => {
  try {
    const existing = await prisma.setup.findUnique({ 
      where: { id: req.params.id }, 
      include: { strategy: true } 
    });
    
    if (!existing || existing.strategy.userId !== req.user.id) {
       return res.status(404).json({ message: 'Not found' });
    }

    try {
      await prisma.setup.delete({ where: { id: req.params.id } });
    } catch(err) {
      await prisma.setup.update({
        where: { id: req.params.id },
        data: { isArchived: true, isActive: false }
      });
    }

    res.json({ message: 'Setup removed' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting setup', error: error.message });
  }
};

const updateChecklist = async (req, res) => {
  try {
    const { items } = req.body; 
    // items should be an array of { id?, title, description, category, required, sortOrder }
    const setupId = req.params.id;

    const existing = await prisma.setup.findUnique({ 
      where: { id: setupId }, 
      include: { strategy: true } 
    });
    if (!existing || existing.strategy.userId !== req.user.id) {
       return res.status(403).json({ message: 'Unauthorized' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get all existing items for this setup
      const existingItems = await tx.checklistItem.findMany({ where: { setupId } });
      const existingIds = existingItems.map(i => i.id);

      const incomingIds = items.map(i => i.id).filter(id => id); // existing ones in payload
      const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));

      if (idsToDelete.length > 0) {
        await tx.checklistItem.deleteMany({
          where: { id: { in: idsToDelete } }
        });
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.id) {
          // Verify existence before update to handle case where ID might be fabricated
          if (existingIds.includes(item.id)) {
            await tx.checklistItem.update({
              where: { id: item.id },
              data: {
                title: item.title,
                description: item.description,
                category: item.category,
                required: item.required || false,
                sortOrder: i // enforce strictly by array order
              }
            });
          }
        } else {
          await tx.checklistItem.create({
            data: {
              setupId,
              title: item.title,
              description: item.description,
              category: item.category,
              required: item.required || false,
              sortOrder: i
            }
          });
        }
      }

      return await tx.checklistItem.findMany({
        where: { setupId },
        orderBy: { sortOrder: 'asc' }
      });
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error saving checklist', error: error.message });
  }
};

module.exports = {
  createSetup,
  updateSetup,
  deleteSetup,
  updateChecklist
};
