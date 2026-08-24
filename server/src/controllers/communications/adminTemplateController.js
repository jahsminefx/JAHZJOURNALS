const templateService = require('../../services/communications/templateService');

exports.getTemplates = async (req, res) => {
  try {
    const { category } = req.query;
    const templates = await templateService.getTemplates(category);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch message templates' });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const { name, category, subject, content, variables } = req.body;
    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }
    const template = await templateService.createTemplate({
      name,
      category,
      subject,
      content,
      variables,
      createdById: req.user.id
    });
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await templateService.updateTemplate(id, req.body);
    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    await templateService.deleteTemplate(id);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
};
