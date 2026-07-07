const {
  createPropFirmAccountSchema,
  updatePropFirmAccountSchema,
  propFirmPhaseSchema,
  propFirmProgressSnapshotSchema,
  formatZodError,
} = require('../validation/accountSchemas');
const {
  getPropFirmAccountForUser,
  createPropFirmAccount,
  updatePropFirmAccount,
  deletePropFirmAccount,
  createPhase,
  updatePhase,
  deletePhase,
  listProgressSnapshots,
  createProgressSnapshot,
} = require('../services/propFirmAccountService');

const sendPrismaError = (res, error, fallbackMessage) => {
  if (error.code === 'P2002') {
    return res.status(400).json({ message: 'A record with that unique value already exists' });
  }

  console.error(error);
  return res.status(500).json({ message: fallbackMessage });
};

const createPropFirm = async (req, res) => {
  try {
    const parsed = createPropFirmAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const account = await createPropFirmAccount(req.user.id, parsed.data);
    res.status(201).json(account);
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create prop-firm account');
  }
};

const getPropFirm = async (req, res) => {
  try {
    const account = await getPropFirmAccountForUser(req.params.id, req.user.id);
    if (!account) {
      return res.status(404).json({ message: 'Prop-firm account not found' });
    }

    res.json(account);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch prop-firm account' });
  }
};

const updatePropFirm = async (req, res) => {
  try {
    const parsed = updatePropFirmAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const account = await updatePropFirmAccount(req.user.id, req.params.id, parsed.data);
    if (!account) {
      return res.status(404).json({ message: 'Prop-firm account not found' });
    }

    res.json(account);
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update prop-firm account');
  }
};

const removePropFirm = async (req, res) => {
  try {
    const account = await deletePropFirmAccount(req.user.id, req.params.id);
    if (!account) {
      return res.status(404).json({ message: 'Prop-firm account not found' });
    }

    res.json({ message: 'Prop-firm account deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete prop-firm account' });
  }
};

const addPhase = async (req, res) => {
  try {
    const parsed = propFirmPhaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const phase = await createPhase(req.user.id, req.params.id, parsed.data);
    if (!phase) {
      return res.status(404).json({ message: 'Prop-firm account not found' });
    }

    res.status(201).json(phase);
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create prop-firm phase');
  }
};

const editPhase = async (req, res) => {
  try {
    const parsed = propFirmPhaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const phase = await updatePhase(req.user.id, req.params.phaseId, parsed.data);
    if (!phase) {
      return res.status(404).json({ message: 'Prop-firm phase not found' });
    }

    res.json(phase);
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update prop-firm phase');
  }
};

const removePhase = async (req, res) => {
  try {
    const phase = await deletePhase(req.user.id, req.params.phaseId);
    if (!phase) {
      return res.status(404).json({ message: 'Prop-firm phase not found' });
    }

    res.json({ message: 'Prop-firm phase deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete prop-firm phase' });
  }
};

const getProgress = async (req, res) => {
  try {
    const snapshots = await listProgressSnapshots(req.user.id, req.params.id);
    if (!snapshots) {
      return res.status(404).json({ message: 'Prop-firm account not found' });
    }

    res.json(snapshots);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch prop-firm progress' });
  }
};

const addProgressSnapshot = async (req, res) => {
  try {
    const parsed = propFirmProgressSnapshotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const snapshot = await createProgressSnapshot(req.user.id, req.params.id, parsed.data);
    if (!snapshot) {
      return res.status(404).json({ message: 'Prop-firm account not found' });
    }

    res.status(201).json(snapshot);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create progress snapshot' });
  }
};

module.exports = {
  createPropFirm,
  getPropFirm,
  updatePropFirm,
  removePropFirm,
  addPhase,
  editPhase,
  removePhase,
  getProgress,
  addProgressSnapshot,
};
