const {
  createPropFirmAccountSchema,
  updatePropFirmAccountSchema,
  propFirmAdvancedSettingsSchema,
  propFirmPhaseSchema,
  propFirmProgressSnapshotSchema,
  formatZodError,
} = require('../validation/accountSchemas');
const {
  getPropFirmAccountForUser,
  createPropFirmAccount,
  updatePropFirmAccount,
  updateAdvancedSettings,
  deletePropFirmAccount,
  createPhase,
  updatePhase,
  deletePhase,
  listProgressSnapshots,
  createProgressSnapshot,
} = require('../services/propFirmAccountService');

const sendPrismaError = (res, error, fallbackMessage) => {
  if (error.code === 'P2002') {
    return res.status(400).json({ message: 'A record with these unique details already exists.' });
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
    sendPrismaError(res, error, 'We couldn\'t set up your prop-firm account right now.');
  }
};

const getPropFirm = async (req, res) => {
  try {
    const account = await getPropFirmAccountForUser(req.params.id, req.user.id);
    if (!account) {
      return res.status(404).json({ message: 'We couldn\'t find that prop-firm account' });
    }

    res.json(account);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t retrieve your prop-firm account.' });
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
      return res.status(404).json({ message: 'We couldn\'t find that prop-firm account.' });
    }

    res.json(account);
  } catch (error) {
    sendPrismaError(res, error, 'We hit a snag updating your prop-firm account.');
  }
};

const updatePropFirmAdvancedSettings = async (req, res) => {
  try {
    const parsed = propFirmAdvancedSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const account = await updateAdvancedSettings(req.user.id, req.params.id, parsed.data);
    if (!account) {
      return res.status(404).json({ message: 'We couldn\'t find that prop-firm account.' });
    }

    res.json(account);
  } catch (error) {
    sendPrismaError(res, error, 'We hit a snag updating your advanced settings.');
  }
};

const removePropFirm = async (req, res) => {
  try {
    const account = await deletePropFirmAccount(req.user.id, req.params.id);
    if (!account) {
      return res.status(404).json({ message: 'We couldn\'t find that prop-firm account.' });
    }

    res.json({ message: 'Prop-firm account removed from your sanctuary.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t delete that prop-firm account right now.' });
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
      return res.status(404).json({ message: 'We couldn\'t find that prop-firm account.' });
    }

    res.status(201).json(phase);
  } catch (error) {
    sendPrismaError(res, error, 'We couldn\'t create that evaluation phase.');
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
      return res.status(404).json({ message: 'We couldn\'t find that evaluation phase.' });
    }

    res.json(phase);
  } catch (error) {
    sendPrismaError(res, error, 'We hit a snag updating that evaluation phase.');
  }
};

const removePhase = async (req, res) => {
  try {
    const phase = await deletePhase(req.user.id, req.params.phaseId);
    if (!phase) {
      return res.status(404).json({ message: 'We couldn\'t find that evaluation phase.' });
    }

    res.json({ message: 'Prop-firm phase removed safely.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t remove that phase right now.' });
  }
};

const getProgress = async (req, res) => {
  try {
    const snapshots = await listProgressSnapshots(req.user.id, req.params.id);
    if (!snapshots) {
      return res.status(404).json({ message: 'We couldn\'t find your prop-firm account.' });
    }

    res.json(snapshots);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t fetch your progress journey.' });
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
      return res.status(404).json({ message: 'We couldn\'t find your prop-firm account.' });
    }

    res.status(201).json(snapshot);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t record your progress right now.' });
  }
};

module.exports = {
  createPropFirm,
  getPropFirm,
  updatePropFirm,
  updatePropFirmAdvancedSettings,
  removePropFirm,
  addPhase,
  editPhase,
  removePhase,
  getProgress,
  addProgressSnapshot,
};
